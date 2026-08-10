"""A durable on-disk job queue.

A directory spool is used instead of a broker because the eval instance is a
single t3.micro with no queue service available to its IAM role, and because
runs last hours: the queue has to survive a reboot, and one file per job with an
atomic rename gives that with no moving parts.

Layout under ``<state_dir>/spool``::

    pending/<run_id>.json    enqueued, not yet claimed
    running/<run_id>.json    claimed by the worker
    done/<run_id>.json       finished successfully
    failed/<run_id>.json     finished with an error, kept for inspection
"""

from __future__ import annotations

import json
import logging
import os
from dataclasses import dataclass
from pathlib import Path

from runner.jobspec import JobSpec

LOGGER = logging.getLogger(__name__)

PENDING = "pending"
RUNNING = "running"
DONE = "done"
FAILED = "failed"
QUEUE_STATES = (PENDING, RUNNING, DONE, FAILED)


class QueueError(RuntimeError):
    """Raised when a job cannot be enqueued or transitioned."""


@dataclass(frozen=True)
class JobQueue:
    """Filesystem-backed job queue rooted at ``spool_dir``."""

    spool_dir: Path

    def ensure_dirs(self) -> None:
        """Create every state directory if it does not already exist."""
        for state in QUEUE_STATES:
            (self.spool_dir / state).mkdir(parents=True, exist_ok=True)

    def _path(self, state: str, run_id: str) -> Path:
        """Path of a job file in a given state."""
        return self.spool_dir / state / f"{run_id}.json"

    def enqueue(self, job: JobSpec) -> Path:
        """Write a job into the pending directory atomically.

        The payload is written to a temp file in the same directory and renamed,
        so the worker can never observe a partially written job.

        Args:
            job: The job to enqueue.

        Returns:
            The path of the pending job file.

        Raises:
            QueueError: If a job with this run id is already queued or running.
        """
        self.ensure_dirs()

        for state in (PENDING, RUNNING):
            if self._path(state, job.run_id).exists():
                raise QueueError(f"job {job.run_id} is already {state}")

        destination = self._path(PENDING, job.run_id)
        temp_path = destination.with_suffix(".json.tmp")
        temp_path.write_text(
            job.model_dump_json(indent=2) + "\n", encoding="utf-8"
        )
        os.replace(temp_path, destination)
        LOGGER.info("enqueued job %s at %s", job.run_id, destination)
        return destination

    def claim_next(self) -> JobSpec | None:
        """Move the oldest pending job into ``running`` and return it.

        Returns:
            The claimed job, or None if nothing is pending.

        Raises:
            QueueError: If a pending file cannot be parsed as a job.
        """
        self.ensure_dirs()

        pending_files = sorted(
            (self.spool_dir / PENDING).glob("*.json"),
            key=lambda path: path.stat().st_mtime,
        )
        for path in pending_files:
            destination = self.spool_dir / RUNNING / path.name
            try:
                os.replace(path, destination)
            except FileNotFoundError:
                # Another worker took it between the glob and the rename.
                continue

            try:
                return JobSpec.model_validate_json(
                    destination.read_text(encoding="utf-8")
                )
            except Exception as error:
                os.replace(destination, self.spool_dir / FAILED / path.name)
                raise QueueError(
                    f"pending job {path.name} is not a valid JobSpec: {error}"
                ) from error

        return None

    def finish(self, run_id: str, state: str, note: str | None = None) -> Path:
        """Move a running job into a terminal state.

        Args:
            run_id: Run identifier.
            state: Either ``DONE`` or ``FAILED``.
            note: Optional text written alongside the job for inspection.

        Returns:
            The path of the job file in its terminal state.

        Raises:
            QueueError: If the state is not terminal or the job is not running.
        """
        if state not in (DONE, FAILED):
            raise QueueError(f"{state!r} is not a terminal queue state")

        source = self._path(RUNNING, run_id)
        if not source.exists():
            raise QueueError(f"job {run_id} is not in the running state")

        destination = self._path(state, run_id)
        os.replace(source, destination)
        if note is not None:
            destination.with_suffix(".note.txt").write_text(note, encoding="utf-8")
        LOGGER.info("job %s moved to %s", run_id, state)
        return destination

    def requeue_orphans(self) -> list[str]:
        """Return jobs left in ``running`` by a crashed worker to ``pending``.

        Returns:
            The run ids that were requeued.
        """
        self.ensure_dirs()
        requeued = []
        for path in sorted((self.spool_dir / RUNNING).glob("*.json")):
            os.replace(path, self.spool_dir / PENDING / path.name)
            requeued.append(path.stem)
        if requeued:
            LOGGER.warning(
                "requeued %d job(s) left running by a previous worker: %s",
                len(requeued), ", ".join(requeued),
            )
        return requeued

    def state_of(self, run_id: str) -> str | None:
        """Return the queue state of a run id, or None if it is unknown."""
        for state in QUEUE_STATES:
            if self._path(state, run_id).exists():
                return state
        return None

    def counts(self) -> dict[str, int]:
        """Return the number of job files in each state."""
        self.ensure_dirs()
        return {
            state: len(list((self.spool_dir / state).glob("*.json")))
            for state in QUEUE_STATES
        }


def read_job(path: Path) -> JobSpec:
    """Parse a job file.

    Args:
        path: Path of a job JSON file.

    Returns:
        The parsed job.

    Raises:
        QueueError: If the file is not a valid job spec.
    """
    try:
        return JobSpec.model_validate(json.loads(path.read_text(encoding="utf-8")))
    except Exception as error:
        raise QueueError(f"{path} is not a valid JobSpec: {error}") from error
