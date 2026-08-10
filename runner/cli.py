"""Command-line entry point for running an eval job by hand.

The webhook worker calls the same code paths; this exists so an operator can
reproduce or re-run a submission without going through the public form.
"""

from __future__ import annotations

import argparse
import json
import logging
import sys
from datetime import datetime, timezone
from pathlib import Path

from runner.config import load_config
from runner.datasets import DATASET_KEYS
from runner.jobspec import JobSpec, Submission, build_job_spec
from runner.logging_setup import configure_logging
from runner.pipeline import run_job
from runner.publish import publish_results

LOGGER = logging.getLogger(__name__)


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    """Parse command line arguments."""
    parser = argparse.ArgumentParser(
        description="Run a surgical tool-detection eval and publish the results."
    )
    source = parser.add_mutually_exclusive_group(required=True)
    source.add_argument(
        "--job-file",
        type=Path,
        help="Path to a JSON file holding a submission payload.",
    )
    source.add_argument(
        "--model-name",
        type=str,
        help="Leaderboard display name; requires the other --model-* flags.",
    )

    parser.add_argument("--model-family", type=str)
    parser.add_argument(
        "--api-provider",
        type=str,
        choices=["openai", "anthropic", "google", "openrouter"],
    )
    parser.add_argument("--model-api-id", type=str)
    parser.add_argument(
        "--eval-scope", type=str, choices=["sample_1000", "full"],
        default="sample_1000",
    )
    parser.add_argument(
        "--datasets", type=str, nargs="+", choices=DATASET_KEYS,
        default=DATASET_KEYS,
    )
    parser.add_argument(
        "--submitter-email", type=str, default="operator@example.org",
        help="Recorded in the run manifest for provenance.",
    )
    parser.add_argument(
        "--no-publish", action="store_true",
        help="Write results to S3 but do not push to the website repo.",
    )
    return parser.parse_args(argv)


def build_submission(args: argparse.Namespace) -> Submission:
    """Build a submission from either a job file or the individual flags.

    Args:
        args: Parsed command line arguments.

    Returns:
        The validated submission.

    Raises:
        SystemExit: If the inline flags are incomplete.
    """
    if args.job_file is not None:
        payload = json.loads(args.job_file.read_text(encoding="utf-8"))
        return Submission.model_validate(payload)

    required = {
        "--model-family": args.model_family,
        "--api-provider": args.api_provider,
        "--model-api-id": args.model_api_id,
    }
    missing = [flag for flag, value in required.items() if value is None]
    if missing:
        raise SystemExit(f"--model-name requires {', '.join(missing)}")

    now = datetime.now(timezone.utc)
    return Submission(
        submission_id=f"cli-{now.strftime('%Y%m%dT%H%M%SZ')}",
        model_name=args.model_name,
        model_family=args.model_family,
        api_provider=args.api_provider,
        model_api_id=args.model_api_id,
        eval_scope=args.eval_scope,
        datasets=args.datasets,
        submitter_email=args.submitter_email,
        submitted_at=now,
    )


def main(argv: list[str] | None = None) -> int:
    """Run one eval job end to end.

    Args:
        argv: Argument vector; defaults to ``sys.argv[1:]``.

    Returns:
        Process exit status.
    """
    args = parse_args(argv)
    config = load_config()
    configure_logging(config.log_dir, "runner")

    job: JobSpec = build_job_spec(build_submission(args))
    LOGGER.info("starting run %s", job.run_id)

    outcome = run_job(job, config)

    for metrics in outcome.dataset_metrics:
        print(
            f"{metrics.dataset}: exact match {metrics.exact_match_pct:.2f}% "
            f"(95% CI {metrics.exact_match_ci_low_pct:.2f}-"
            f"{metrics.exact_match_ci_high_pct:.2f}), "
            f"micro-F1 {metrics.micro_f1_pct:.2f}%, "
            f"n={metrics.total_scored}"
        )

    if args.no_publish:
        LOGGER.info("run=%s: --no-publish set, skipping the website update", job.run_id)
        return 0

    commit_sha = publish_results(job, outcome.dataset_metrics, config)
    if commit_sha is None:
        print("Website already up to date; nothing pushed.")
    else:
        print(f"Published {commit_sha} to the website repo.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
