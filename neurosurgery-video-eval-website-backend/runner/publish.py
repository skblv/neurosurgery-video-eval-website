"""Publish leaderboard numbers to the public website repo over a deploy key.

A repo-scoped SSH deploy key is used rather than a personal access token: a
deploy key can only ever touch this one repository, so a compromise of the eval
instance cannot reach the rest of the account.

Only ``src/data/results.json`` is ever written. The file is validated against the
schema version the site's loader enforces before and after the edit, so a
malformed publish fails on the instance instead of breaking the deployed site.
"""

from __future__ import annotations

import json
import logging
import subprocess
import tempfile
from datetime import datetime, timezone
from pathlib import Path

from runner.config import (
    PUBLIC_REPO_BRANCH,
    PUBLIC_REPO_RESULTS_PATH,
    PUBLIC_REPO_SSH_URL,
    RESULT_ENTRY_KEYS,
    RESULTS_SCHEMA_VERSION,
    ServiceConfig,
)
from runner.datasets import DATASET_CONFIGS
from runner.jobspec import JobSpec
from runner.metrics import DatasetMetrics
from runner.s3io import S3Client

PROVIDER_LOGOS_DIR = Path("public/provider-logos")

LOGGER = logging.getLogger(__name__)

GIT_TIMEOUT_SECONDS = 300


class PublishError(RuntimeError):
    """Raised when the results file cannot be updated or pushed."""


def _run_git(args: list[str], cwd: Path, env: dict[str, str]) -> str:
    """Run a git command, raising with its stderr on failure.

    Args:
        args: Arguments after ``git``.
        cwd: Working directory.
        env: Environment for the child process.

    Returns:
        Captured stdout.

    Raises:
        PublishError: If git exits non-zero or times out.
    """
    completed = subprocess.run(
        ["git", *args],
        cwd=cwd,
        env=env,
        capture_output=True,
        text=True,
        timeout=GIT_TIMEOUT_SECONDS,
    )
    if completed.returncode != 0:
        raise PublishError(
            f"git {' '.join(args)} failed with exit {completed.returncode}: "
            f"{completed.stderr.strip()}"
        )
    return completed.stdout


def _git_env(config: ServiceConfig) -> dict[str, str]:
    """Build the git environment that pins SSH to the deploy key.

    ``IdentitiesOnly=yes`` stops ssh from offering any other agent-held key, so
    the push can only ever authenticate as this deploy key.

    Raises:
        PublishError: If the deploy key file is absent.
    """
    key_path = config.github_deploy_key_path
    if not key_path.exists():
        raise PublishError(
            f"GitHub deploy key not found at {key_path}. Generate it and add "
            f"the public half to the repository's Deploy Keys with write access; "
            f"see deploy/README or the backend README."
        )

    return {
        "PATH": "/usr/bin:/bin:/usr/local/bin",
        "HOME": str(key_path.parent),
        "GIT_SSH_COMMAND": (
            f"ssh -i {key_path} -o IdentitiesOnly=yes "
            f"-o StrictHostKeyChecking=accept-new -o BatchMode=yes"
        ),
        "GIT_AUTHOR_NAME": config.git_author_name,
        "GIT_AUTHOR_EMAIL": config.git_author_email,
        "GIT_COMMITTER_NAME": config.git_author_name,
        "GIT_COMMITTER_EMAIL": config.git_author_email,
    }


# ------------------------------------------------------------ results.json


def _validate_results_document(document: dict) -> None:
    """Check the results file against the contract the site's loader enforces.

    The site validates with ``requireExactKeys``, which rejects an entry for
    carrying an unlisted key just as readily as for missing one. Mirroring that
    check here means a schema drift fails on the eval instance, where the run
    artefacts are still on hand, instead of at site build time.

    Raises:
        PublishError: If the document is malformed or a different schema version.
    """
    if document.get("schemaVersion") != RESULTS_SCHEMA_VERSION:
        raise PublishError(
            f"results.json schemaVersion is {document.get('schemaVersion')!r}, "
            f"expected {RESULTS_SCHEMA_VERSION}. The website schema changed; "
            f"update RESULTS_SCHEMA_VERSION and RESULT_ENTRY_KEYS in "
            f"runner/config.py to match src/data/resultsSchema.ts before "
            f"publishing again."
        )
    if not isinstance(document.get("datasets"), dict):
        raise PublishError("results.json has no 'datasets' object")

    expected_keys = sorted(RESULT_ENTRY_KEYS)
    for dataset_id, dataset_entry in document["datasets"].items():
        if not isinstance(dataset_entry.get("results"), list):
            raise PublishError(f"results.json datasets.{dataset_id}.results is not a list")
        if not isinstance(dataset_entry.get("majorityBaseline"), dict):
            raise PublishError(
                f"results.json datasets.{dataset_id}.majorityBaseline is not an object"
            )

        for index, result in enumerate(dataset_entry["results"]):
            if not isinstance(result, dict):
                raise PublishError(
                    f"results.json datasets.{dataset_id}.results[{index}] "
                    f"is not an object"
                )
            if sorted(result) != expected_keys:
                raise PublishError(
                    f"results.json datasets.{dataset_id}.results[{index}] has keys "
                    f"{sorted(result)}, expected {expected_keys}. The site's "
                    f"validator rejects unlisted keys outright."
                )

            for metric_id, metric in result["metrics"].items():
                if metric is None:
                    continue
                # The site draws whiskers from both bounds, so a one-sided
                # interval would render as a zero-length whisker rather than error.
                if (metric["ciLow"] is None) != (metric["ciHigh"] is None):
                    raise PublishError(
                        f"results.json datasets.{dataset_id}.results[{index}]"
                        f".metrics.{metric_id} has a one-sided interval "
                        f"(ciLow={metric['ciLow']!r}, ciHigh={metric['ciHigh']!r}); "
                        f"both bounds must be numbers or both null."
                    )


def build_result_entry(
    job: JobSpec,
    metrics: DatasetMetrics,
) -> dict:
    """Build the results.json entry for one model on one dataset.

    Both metrics carry a seed-42 percentile bootstrap interval, computed by the
    same procedure that produced the intervals already on the leaderboard.

    Args:
        job: The job that produced the numbers.
        metrics: Aggregated metrics for the dataset.

    Returns:
        A results.json model entry.
    """
    return {
        "id": job.website_model_id,
        "model": job.submission.model_name,
        "provider": job.website_provider,
        "sourceRunId": job.run_id,
        "metrics": {
            "exactMatch": {
                "value": round(metrics.exact_match_pct, 2),
                "ciLow": round(metrics.exact_match_ci_low_pct, 2),
                "ciHigh": round(metrics.exact_match_ci_high_pct, 2),
            },
            "microF1": {
                "value": round(metrics.micro_f1_pct, 2),
                "ciLow": round(metrics.micro_f1_ci_low_pct, 2),
                "ciHigh": round(metrics.micro_f1_ci_high_pct, 2),
            },
        },
    }


def apply_results(
    document: dict,
    job: JobSpec,
    dataset_metrics: list[DatasetMetrics],
) -> tuple[dict, list[str]]:
    """Upsert this run's numbers into a results.json document.

    Entries are keyed by model id so a re-run replaces the previous numbers in
    place rather than appending a duplicate row.

    Args:
        document: The parsed results.json.
        job: The job that produced the numbers.
        dataset_metrics: Metrics per evaluated dataset.

    Returns:
        The updated document and a human-readable list of the changes made.

    Raises:
        PublishError: If a dataset is not present in the results file.
    """
    changes: list[str] = []

    for metrics in dataset_metrics:
        website_id = DATASET_CONFIGS[metrics.dataset].website_id
        if website_id not in document["datasets"]:
            raise PublishError(
                f"results.json has no dataset {website_id!r}; the website and "
                f"the runner disagree about the dataset set"
            )

        entry = build_result_entry(job, metrics)
        results = document["datasets"][website_id]["results"]
        existing_index = next(
            (i for i, row in enumerate(results) if row.get("id") == entry["id"]),
            None,
        )
        if existing_index is None:
            results.append(entry)
            changes.append(
                f"{website_id}: added {entry['model']} "
                f"(exact match {entry['metrics']['exactMatch']['value']:.2f}%, "
                f"micro-F1 {entry['metrics']['microF1']['value']:.2f}%)"
            )
        else:
            results[existing_index] = entry
            changes.append(
                f"{website_id}: updated {entry['model']} "
                f"(exact match {entry['metrics']['exactMatch']['value']:.2f}%, "
                f"micro-F1 {entry['metrics']['microF1']['value']:.2f}%)"
            )

    document["generatedAt"] = (
        datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    )
    return document, changes


def build_commit_message(job: JobSpec, changes: list[str]) -> str:
    """Compose the publishing commit message.

    Args:
        job: The job that produced the numbers.
        changes: Human-readable per-dataset change descriptions.

    Returns:
        A subject line plus a body listing every changed dataset and the
        provenance needed to trace the numbers back to their S3 artefacts.
    """
    submission = job.submission
    subject = (
        f"Add {submission.model_name} results "
        f"({', '.join(submission.datasets)}, {submission.eval_scope})"
    )
    body_lines = [
        "",
        f"Evaluated {submission.model_name} ({submission.model_api_id}) via "
        f"{submission.api_provider} on the seed-42 validation sample.",
        "",
        *[f"- {change}" for change in changes],
        "",
        f"Run id: {job.run_id}",
        f"Submission: {submission.submission_id} by {submission.submitter_email}",
        "Artefacts: s3://caai-surgical-eval/results/" + job.run_id + "/",
    ]
    return subject + "\n" + "\n".join(body_lines)


def _publish_provider_logo(job: JobSpec, checkout: Path, config: ServiceConfig) -> Path | None:
    """Write an uploaded family logo into the site repo when the job carries one.

    Built-in families use SVG icons in the site bundle and typically have no
    ``logo_key``. Custom families (and the first submit for a new family) carry
    a logo that must land under ``public/provider-logos/<slug>.*``.

    Returns:
        The path written inside the checkout, or None if this job has no logo.

    Raises:
        PublishError: If S3 cannot return the object.
    """
    if not job.logo_key:
        return None

    suffix = Path(job.logo_key).suffix.lower() or ".png"
    destination = checkout / PROVIDER_LOGOS_DIR / f"{job.website_provider}{suffix}"
    destination.parent.mkdir(parents=True, exist_ok=True)

    try:
        payload = S3Client.from_config(config).get_bytes(job.logo_key)
    except Exception as error:
        raise PublishError(
            f"could not download logo {job.logo_key!r} for publish: {error}"
        ) from error

    destination.write_bytes(payload)
    LOGGER.info(
        "run=%s: wrote provider logo %s (%d bytes)",
        job.run_id, destination.relative_to(checkout), len(payload),
    )
    return destination


def publish_results(
    job: JobSpec,
    dataset_metrics: list[DatasetMetrics],
    config: ServiceConfig,
) -> str | None:
    """Clone the site repo, update results.json, and push.

    Args:
        job: The job that produced the numbers.
        dataset_metrics: Metrics per evaluated dataset.
        config: Resolved service configuration.

    Returns:
        The pushed commit SHA, or None if the numbers were already current.

    Raises:
        PublishError: If any git step or validation fails.
    """
    env = _git_env(config)

    with tempfile.TemporaryDirectory(prefix="svc-eval-publish-") as workdir:
        checkout = Path(workdir) / "site"
        LOGGER.info("run=%s: cloning %s", job.run_id, PUBLIC_REPO_SSH_URL)
        _run_git(
            ["clone", "--depth", "1", "--branch", PUBLIC_REPO_BRANCH,
             PUBLIC_REPO_SSH_URL, str(checkout)],
            cwd=Path(workdir),
            env=env,
        )

        results_path = checkout / PUBLIC_REPO_RESULTS_PATH
        if not results_path.exists():
            raise PublishError(
                f"{PUBLIC_REPO_RESULTS_PATH} is missing from the site repo; the "
                f"frontend refactor that introduced it may have been reverted"
            )

        document = json.loads(results_path.read_text(encoding="utf-8"))
        _validate_results_document(document)
        document, changes = apply_results(document, job, dataset_metrics)
        _validate_results_document(document)

        results_path.write_text(
            json.dumps(document, indent=2, ensure_ascii=False) + "\n",
            encoding="utf-8",
        )

        logo_path = _publish_provider_logo(job, checkout, config)
        paths_to_stage = [str(PUBLIC_REPO_RESULTS_PATH)]
        if logo_path is not None:
            paths_to_stage.append(str(logo_path.relative_to(checkout)))

        status = _run_git(
            ["status", "--porcelain", "--", *paths_to_stage],
            cwd=checkout, env=env,
        ).strip()
        if not status:
            LOGGER.info("run=%s: results.json already current, nothing to push", job.run_id)
            return None

        _run_git(["add", "--", *paths_to_stage], cwd=checkout, env=env)
        _run_git(
            ["commit", "-m", build_commit_message(job, changes)],
            cwd=checkout, env=env,
        )
        _run_git(["push", "origin", f"HEAD:{PUBLIC_REPO_BRANCH}"], cwd=checkout, env=env)

        commit_sha = _run_git(["rev-parse", "HEAD"], cwd=checkout, env=env).strip()
        LOGGER.info(
            "run=%s: published %s to %s (%s)",
            job.run_id, commit_sha, PUBLIC_REPO_BRANCH, "; ".join(changes),
        )
        return commit_sha
