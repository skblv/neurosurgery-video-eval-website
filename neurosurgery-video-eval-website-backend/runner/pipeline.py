"""Job orchestration: sample frames, call the model, score, upload, publish.

One :class:`JobSpec` evaluates one model over one or more datasets. Responses are
appended to a per-dataset JSONL cache as they arrive, so a run interrupted by a
reboot or a spot reclaim resumes without re-billing the frames it already paid
for.
"""

from __future__ import annotations

import json
import logging
import threading
import time
from collections.abc import Callable
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path

from tqdm.auto import tqdm

from runner.config import PROGRESS_REPORT_STEP_PCT, ServiceConfig
from runner.datasets import DATASET_CONFIGS, DatasetConfig, EvalFrame
from runner.datasets import load_manifest, select_eval_frames
from runner.jobspec import JobSpec
from runner.metrics import DatasetMetrics, score_dataset
from runner.prompts import create_prompt
from runner.providers import AdapterChoice, ModelAdapter, resolve_adapter
from runner.s3io import (
    MissingObjectError,
    S3Client,
    frame_suffix,
    local_cache_path,
    upload_dataset_results,
    upload_run_manifest,
    upload_run_summary,
)

LOGGER = logging.getLogger(__name__)

_CACHE_LOCK = threading.Lock()


@dataclass
class RunOutcome:
    """What a completed run produced.

    Attributes:
        run_id: Run identifier.
        adapter_choice: Which provider actually served the job.
        dataset_metrics: Metrics per evaluated dataset.
        uploaded_uris: Every ``s3://`` object the run wrote.
    """

    run_id: str
    adapter_choice: AdapterChoice
    dataset_metrics: list[DatasetMetrics]
    uploaded_uris: list[str]


# ------------------------------------------------------------------- cache


def load_cache(cache_path: Path) -> dict[str, dict]:
    """Load a JSONL response cache into a dict keyed by frame id.

    Args:
        cache_path: Path of the cache file; a missing file yields an empty dict.

    Returns:
        Cached per-frame records.

    Raises:
        ValueError: If a cache line is not valid JSON, which would otherwise
            silently drop already-paid-for responses.
    """
    cache: dict[str, dict] = {}
    if not cache_path.exists():
        return cache

    with cache_path.open("r", encoding="utf-8") as handle:
        for line_number, line in enumerate(handle, start=1):
            line = line.strip()
            if not line:
                continue
            try:
                entry = json.loads(line)
            except json.JSONDecodeError as error:
                raise ValueError(
                    f"{cache_path}:{line_number} is not valid JSON: {error}"
                ) from error
            cache[entry["frame_id"]] = entry

    return cache


def append_cache(cache_path: Path, entry: dict) -> None:
    """Append one record to the JSONL cache, serialised across threads."""
    cache_path.parent.mkdir(parents=True, exist_ok=True)
    with _CACHE_LOCK:
        with cache_path.open("a", encoding="utf-8") as handle:
            handle.write(json.dumps(entry, ensure_ascii=False) + "\n")


# --------------------------------------------------------------- evaluation


def _score_one_frame(
    frame: EvalFrame,
    adapter: ModelAdapter,
    s3_client: S3Client,
    prompt: str,
    valid_tools: list[str],
) -> dict:
    """Stream one frame from S3, score it, and build its cache record.

    The image bytes are held only for the duration of the call so the 40 GiB
    instance disk is never involved.
    """
    try:
        image_bytes = s3_client.get_bytes(frame.s3_key)
    except MissingObjectError as error:
        outcome_fields = {
            "predicted_tools": [],
            "status": "skip",
            "raw_response": f"Frame missing in S3: {error}",
            "stop_reason": None,
            "refusal_category": None,
            "refusal_explanation": None,
            "usage": {},
        }
    else:
        outcome = adapter.score_frame(
            prompt=prompt,
            image_bytes=image_bytes,
            suffix=frame_suffix(frame.s3_key),
            valid_tools=valid_tools,
        )
        outcome_fields = asdict(outcome)

    return {
        "frame_id": frame.frame_id,
        "s3_key": frame.s3_key,
        "ground_truth_tools": frame.ground_truth_tools,
        "model_api_id": adapter.model_api_id,
        "provider": adapter.name,
        "timestamp": time.time(),
        **outcome_fields,
    }


class RunProgress:
    """Turns per-frame completion into throttled whole-percent updates.

    Datasets are weighted equally rather than by frame count, because the frame
    count of a later dataset is not known until its manifest loads. Under the
    1,000-frame scope every dataset is the same size, so equal weighting is
    exact; under the full scope the percentage advances at different speeds in
    different datasets.

    Attributes:
        n_datasets: How many datasets this run covers.
    """

    def __init__(self, n_datasets: int, publish: Callable[[int], object]) -> None:
        """Initialise a tracker.

        Args:
            n_datasets: How many datasets this run covers.
            publish: Called with a whole percent each time the run crosses a
                reporting step.
        """
        self.n_datasets = max(n_datasets, 1)
        self._publish = publish
        self._dataset_index = 0
        self._frames_done = 0
        self._frames_total = 1
        self._last_published = 0

    def start_dataset(self, index: int, frames_total: int) -> None:
        """Begin counting frames for the dataset at ``index``."""
        self._dataset_index = index
        self._frames_done = 0
        self._frames_total = max(frames_total, 1)

    def frame_scored(self) -> None:
        """Count one scored frame, publishing if a step boundary was crossed."""
        self._frames_done += 1
        percent = self.percent
        if percent >= self._last_published + PROGRESS_REPORT_STEP_PCT:
            self._last_published = percent
            self._publish(percent)

    @property
    def percent(self) -> int:
        """Whole percent of the run completed, capped at 100."""
        done_share = self._frames_done / self._frames_total
        share = (self._dataset_index + done_share) / self.n_datasets
        return min(int(share * 100), 100)


def evaluate_dataset(
    dataset_config: DatasetConfig,
    job: JobSpec,
    adapter: ModelAdapter,
    s3_client: S3Client,
    config: ServiceConfig,
    progress: RunProgress | None = None,
    dataset_index: int = 0,
) -> DatasetMetrics:
    """Evaluate one model on one dataset and return its metrics.

    Args:
        dataset_config: Dataset ontology and S3 layout.
        job: The job being executed.
        adapter: Model adapter to call.
        s3_client: Bucket wrapper.
        config: Resolved service configuration.
        progress: Tracker to report scored frames to, if progress is published.
        dataset_index: Position of this dataset within the run.

    Returns:
        Aggregated metrics for the dataset.

    Raises:
        MissingObjectError: If the dataset manifest is absent from S3.
    """
    LOGGER.info(
        "dataset=%s: loading manifest s3://%s/%s",
        dataset_config.key, s3_client.bucket, dataset_config.manifest_key,
    )
    try:
        manifest_bytes = s3_client.get_bytes(dataset_config.manifest_key)
    except MissingObjectError as error:
        raise MissingObjectError(
            f"{dataset_config.key}: {error}. The CholecT50 manifest in "
            f"particular was never part of the Pythia -> S3 sync; upload it "
            f"with deploy/05_upload_dataset_manifests.sh before running."
        ) from error

    frame_label_df = load_manifest(dataset_config, manifest_bytes)
    frames = select_eval_frames(dataset_config, frame_label_df, job.n_obs)
    LOGGER.info(
        "dataset=%s: %d validation frames selected (scope=%s)",
        dataset_config.key, len(frames), job.submission.eval_scope,
    )

    prompt = create_prompt(dataset_config.instrument_names)
    cache_path = local_cache_path(config.state_dir, job.run_id, dataset_config.key)
    frame_outcomes = load_cache(cache_path)

    pending = [frame for frame in frames if frame.frame_id not in frame_outcomes]
    LOGGER.info(
        "dataset=%s: %d cached, %d to score",
        dataset_config.key, len(frames) - len(pending), len(pending),
    )

    if progress is not None:
        progress.start_dataset(dataset_index, len(pending))

    if pending:
        with ThreadPoolExecutor(max_workers=config.num_workers) as executor:
            future_to_frame_id = {
                executor.submit(
                    _score_one_frame, frame, adapter, s3_client, prompt,
                    dataset_config.instrument_names,
                ): frame.frame_id
                for frame in pending
            }
            for future in tqdm(
                as_completed(future_to_frame_id),
                total=len(future_to_frame_id),
                desc=f"{dataset_config.key}/{job.submission.model_name}",
            ):
                frame_id = future_to_frame_id[future]
                entry = future.result()
                append_cache(cache_path, entry)
                frame_outcomes[frame_id] = entry
                if progress is not None:
                    progress.frame_scored()

    metrics = score_dataset(
        dataset=dataset_config.key,
        frame_outcomes=frame_outcomes,
        frame_ids=[frame.frame_id for frame in frames],
        valid_tools=dataset_config.instrument_names,
    )

    LOGGER.info(
        "dataset=%s: exact_match=%.2f%% (95%% CI %.2f-%.2f) micro_f1=%.2f%% "
        "scored=%d skipped=%d parse_errors=%d refusals=%d",
        dataset_config.key, metrics.exact_match_pct,
        metrics.exact_match_ci_low_pct, metrics.exact_match_ci_high_pct,
        metrics.micro_f1_pct, metrics.total_scored, metrics.skipped_technical,
        metrics.parse_failures, metrics.refusals,
    )
    if metrics.refusal_rate_pct > 1.0:
        LOGGER.warning(
            "dataset=%s: refusal rate %.2f%% exceeds 1%%",
            dataset_config.key, metrics.refusal_rate_pct,
        )
    return metrics


def run_job(
    job: JobSpec,
    config: ServiceConfig,
    on_progress: Callable[[int], object] | None = None,
) -> RunOutcome:
    """Execute a full evaluation job and upload its results.

    Args:
        job: The job to execute.
        config: Resolved service configuration.
        on_progress: Called with a whole percent as the run advances. Omitted
            for manual CLI runs, which have the tqdm bars instead.

    Returns:
        The run outcome, including every uploaded object.
    """
    submission = job.submission
    adapter_choice = resolve_adapter(
        api_provider=submission.api_provider,
        model_api_id=submission.model_api_id,
        config=config,
    )
    if adapter_choice.fallback_reason is not None:
        LOGGER.warning("run=%s: %s", job.run_id, adapter_choice.fallback_reason)

    LOGGER.info(
        "run=%s: model=%r provider=%s model_api_id=%s datasets=%s scope=%s",
        job.run_id, submission.model_name, adapter_choice.effective_provider,
        adapter_choice.effective_model_api_id, submission.datasets,
        submission.eval_scope,
    )

    s3_client = S3Client.from_config(config)
    provenance = {
        "model_name": submission.model_name,
        "model_api_id": adapter_choice.effective_model_api_id,
        "api_provider_requested": adapter_choice.requested_provider,
        "api_provider_used": adapter_choice.effective_provider,
        "eval_scope": submission.eval_scope,
        "run_id": job.run_id,
    }

    dataset_metrics: list[DatasetMetrics] = []
    uploaded_uris: list[str] = []
    progress = (
        None if on_progress is None
        else RunProgress(len(submission.datasets), on_progress)
    )

    for dataset_index, dataset_key in enumerate(submission.datasets):
        metrics = evaluate_dataset(
            dataset_config=DATASET_CONFIGS[dataset_key],
            job=job,
            adapter=adapter_choice.adapter,
            s3_client=s3_client,
            config=config,
            progress=progress,
            dataset_index=dataset_index,
        )
        dataset_metrics.append(metrics)
        uploaded_uris.extend(
            upload_dataset_results(s3_client, job.run_id, metrics, provenance)
        )

    uploaded_uris.append(
        upload_run_summary(s3_client, job.run_id, dataset_metrics, provenance)
    )
    uploaded_uris.append(
        upload_run_manifest(
            s3_client,
            job.run_id,
            {
                "run_id": job.run_id,
                "submission": submission.model_dump(mode="json"),
                "enqueued_at": job.enqueued_at,
                "completed_at": datetime.now(timezone.utc),
                "website_model_id": job.website_model_id,
                "website_provider": job.website_provider,
                "api_provider_requested": adapter_choice.requested_provider,
                "api_provider_used": adapter_choice.effective_provider,
                "effective_model_api_id": adapter_choice.effective_model_api_id,
                "fallback_reason": adapter_choice.fallback_reason,
                "outputs": uploaded_uris,
            },
        )
    )

    return RunOutcome(
        run_id=job.run_id,
        adapter_choice=adapter_choice,
        dataset_metrics=dataset_metrics,
        uploaded_uris=uploaded_uris,
    )
