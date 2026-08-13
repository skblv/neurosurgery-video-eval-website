"""Queue worker: drains the spool one job at a time.

Jobs run serially. The instance is a t3.micro and each job already fans out over
``SVC_EVAL_NUM_WORKERS`` concurrent API calls, so running two evals at once would
just contend for the same CPU and provider rate limits.

Failures are never swallowed: the traceback is logged, the job is moved to
``failed/`` with the error text beside it, and the worker moves on to the next
job rather than exiting and losing the queue.
"""

from __future__ import annotations

import logging
import signal
import sys
import time
import traceback
from types import FrameType

from runner.config import load_config
from runner.logging_setup import configure_logging
from runner.metrics import DatasetMetrics
from runner.pipeline import RunOutcome, run_job
from runner.publish import publish_results
from runner.store import (
    STATUS_COMPLETED,
    STATUS_FAILED,
    STATUS_RUNNING,
    StoreError,
    SubmissionStore,
)
from webhook.queue import DONE, FAILED, JobQueue

LOGGER = logging.getLogger(__name__)

POLL_INTERVAL_SECONDS = 10

_SHUTDOWN_REQUESTED = False


def _request_shutdown(signum: int, _frame: FrameType | None) -> None:
    """Ask the worker to stop after the job in flight finishes."""
    global _SHUTDOWN_REQUESTED
    _SHUTDOWN_REQUESTED = True
    LOGGER.warning("received signal %s; will stop after the current job", signum)


def completion_detail(outcome: RunOutcome) -> str:
    """Summarise a finished run for the submitter's status page.

    Args:
        outcome: The completed run.

    Returns:
        One line naming each dataset's headline numbers.
    """
    scores = "; ".join(
        f"{metrics.dataset} exact match {metrics.exact_match_pct:.1f}%, "
        f"micro-F1 {metrics.micro_f1_pct:.1f}%"
        for metrics in outcome.dataset_metrics
    )
    return f"Evaluation finished. {scores}."


def public_metrics(dataset_metrics: list[DatasetMetrics]) -> list[dict[str, object]]:
    """Project run metrics onto what the status page shows.

    Args:
        dataset_metrics: Per-dataset results of a finished run.

    Returns:
        One entry per dataset, with both headline metrics and the sample size.
    """
    return [
        {
            "dataset": metrics.dataset,
            "exactMatchPct": round(metrics.exact_match_pct, 2),
            "microF1Pct": round(metrics.micro_f1_pct, 2),
            "framesScored": metrics.total_scored,
        }
        for metrics in dataset_metrics
    ]


def failure_detail(error: BaseException) -> str:
    """Describe a failed run in terms a submitter can act on.

    The full traceback goes to the log; this is the one line that reaches an
    email, so it names the error rather than dumping frames.

    Args:
        error: The exception that ended the run.

    Returns:
        A short explanation.
    """
    return (
        f"Evaluation failed: {type(error).__name__}: {error} "
        f"The maintainers have the full log."
    )


def _require_record(store: SubmissionStore, submission_id: str) -> None:
    """Fail loudly if a claimed job has no row to report progress against.

    Every job reaching the worker was created through the submission endpoint or
    re-queued from the admin panel, both of which write a row first. A job without
    one would run for hours while its submitter watched a status page that never
    moved, so it is refused instead.

    Raises:
        RuntimeError: If the submission is not in the store.
    """
    if store.get(submission_id) is None:
        raise RuntimeError(
            f"submission {submission_id!r} has no row in the submission store, "
            f"so its progress could not be reported; refusing to run it blind"
        )


def main() -> int:
    """Drain the job spool until asked to stop.

    Returns:
        Process exit status.
    """
    config = load_config()
    configure_logging(config.log_dir, "worker")

    signal.signal(signal.SIGTERM, _request_shutdown)
    signal.signal(signal.SIGINT, _request_shutdown)

    queue = JobQueue(spool_dir=config.spool_dir)
    queue.ensure_dirs()
    queue.requeue_orphans()

    store = SubmissionStore(config.submissions_db)
    store.initialise()

    LOGGER.info("worker started; spool=%s counts=%s", config.spool_dir, queue.counts())

    while not _SHUTDOWN_REQUESTED:
        job = queue.claim_next()
        if job is None:
            time.sleep(POLL_INTERVAL_SECONDS)
            continue

        submission_id = job.submission.submission_id
        LOGGER.info("run=%s: claimed", job.run_id)
        try:
            _require_record(store, submission_id)
            store.set_status(
                submission_id,
                STATUS_RUNNING,
                f"Evaluating on {', '.join(job.submission.datasets)}.",
            )
            outcome = run_job(
                job,
                config,
                on_progress=lambda percent: store.set_progress(
                    submission_id, percent
                ),
            )
            commit_sha = publish_results(job, outcome.dataset_metrics, config)
            note = "\n".join(
                [
                    f"run_id: {job.run_id}",
                    f"provider_used: {outcome.adapter_choice.effective_provider}",
                    f"website_commit: {commit_sha or 'no change'}",
                    "outputs:",
                    *[f"  {uri}" for uri in outcome.uploaded_uris],
                ]
            )
            queue.finish(job.run_id, DONE, note)
            store.set_metrics(submission_id, public_metrics(outcome.dataset_metrics))
            store.set_progress(submission_id, 100)
            store.set_status(
                submission_id, STATUS_COMPLETED, completion_detail(outcome)
            )
            LOGGER.info("run=%s: finished", job.run_id)
        except Exception as error:
            error_text = traceback.format_exc()
            LOGGER.error("run=%s: FAILED\n%s", job.run_id, error_text)
            queue.finish(job.run_id, FAILED, error_text)
            try:
                store.set_status(submission_id, STATUS_FAILED, failure_detail(error))
            except StoreError as store_error:
                # The row is what the submitter watches, so losing this write is
                # itself a failure worth logging; the worker still stays up so the
                # rest of the queue drains.
                LOGGER.error(
                    "run=%s: could not mark submission=%s failed: %s",
                    job.run_id, submission_id, store_error,
                )

    LOGGER.info("worker stopped; counts=%s", queue.counts())
    return 0


if __name__ == "__main__":
    sys.exit(main())
