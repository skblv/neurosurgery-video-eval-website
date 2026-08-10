"""Durable record of every submission and the live state of its evaluation.

This is the system of record that used to be a spreadsheet behind AppSheet: the
public form writes a row here, the worker updates status and progress on the same
row, and the public status page reads it back through an unguessable per-submission
token. Two processes write to it — the webhook and the worker — so the connection
is opened in WAL mode with a busy timeout rather than held open per process.

Every mutation asserts that it touched exactly one row. A status update that
silently matched nothing would leave a submitter watching a progress page that
never moves, which is worse than a loud failure in the log.
"""

from __future__ import annotations

import json
import logging
import secrets
import sqlite3
from collections.abc import Iterator
from contextlib import contextmanager
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Literal

from runner.config import MAX_STATUS_DETAIL_CHARS
from runner.jobspec import FAMILY_TO_WEBSITE_PROVIDER, Submission, slugify_model_id

LOGGER = logging.getLogger(__name__)

SubmissionStatus = Literal["queued", "running", "completed", "failed", "rejected"]

STATUS_QUEUED: SubmissionStatus = "queued"
STATUS_RUNNING: SubmissionStatus = "running"
STATUS_COMPLETED: SubmissionStatus = "completed"
STATUS_FAILED: SubmissionStatus = "failed"
STATUS_REJECTED: SubmissionStatus = "rejected"

TERMINAL_STATUSES = frozenset({STATUS_COMPLETED, STATUS_FAILED, STATUS_REJECTED})

# 32 bytes of urlsafe randomness. The token is the only thing guarding a status
# page, so it has to be long enough that guessing one is hopeless.
STATUS_TOKEN_BYTES = 32

BUSY_TIMEOUT_SECONDS = 30.0

SCHEMA_STATEMENTS = (
    """
    CREATE TABLE IF NOT EXISTS submissions (
        submission_id   TEXT PRIMARY KEY,
        status_token    TEXT NOT NULL UNIQUE,
        run_id          TEXT NOT NULL,
        model_name      TEXT NOT NULL,
        model_family    TEXT NOT NULL,
        new_family_name TEXT,
        api_provider    TEXT NOT NULL,
        model_api_id    TEXT NOT NULL,
        eval_scope      TEXT NOT NULL,
        datasets        TEXT NOT NULL,
        submitter_email TEXT NOT NULL,
        logo_key        TEXT,
        status          TEXT NOT NULL,
        status_detail   TEXT NOT NULL DEFAULT '',
        progress_pct    INTEGER NOT NULL DEFAULT 0,
        metrics         TEXT NOT NULL DEFAULT '[]',
        submitted_at    TEXT NOT NULL,
        updated_at      TEXT NOT NULL
    )
    """,
    "CREATE INDEX IF NOT EXISTS submissions_status_token ON submissions(status_token)",
    "CREATE INDEX IF NOT EXISTS submissions_run_id ON submissions(run_id)",
    """
    CREATE TABLE IF NOT EXISTS families (
        family_id    TEXT PRIMARY KEY,
        display_name TEXT NOT NULL,
        logo_key     TEXT NOT NULL,
        created_at   TEXT NOT NULL
    )
    """,
)


class StoreError(RuntimeError):
    """Raised when the store cannot record what the caller asked it to."""


@dataclass(frozen=True)
class FamilyRecord:
    """A model family that has an uploaded icon and can be picked again.

    Attributes:
        family_id: Stable slug used as the website provider id.
        display_name: Human-facing name shown in the family dropdown.
        logo_key: S3 key of the family's icon.
        created_at: When the family was first registered.
    """

    family_id: str
    display_name: str
    logo_key: str
    created_at: str


@dataclass(frozen=True)
class SubmissionRecord:
    """One submission and the current state of its evaluation.

    Attributes:
        submission_id: Caller-supplied identifier, unique per submission.
        status_token: Secret that grants read access to this row's status.
        run_id: Identifier of the evaluation run this submission produced.
        model_name: Leaderboard display name.
        model_family: Submitted family, in wire form.
        new_family_name: Proposed family name when the family is new.
        api_provider: Which vendor API to call.
        model_api_id: Vendor-side model identifier.
        eval_scope: Whether to score a sample or the whole split.
        datasets: Dataset keys to score, in submission order.
        submitter_email: Where a human can be reached about this run.
        logo_key: S3 key of an uploaded logo, if one was supplied.
        status: Current lifecycle state.
        status_detail: Submitter-facing explanation of the current state.
        progress_pct: Completion percentage, 0 to 100.
        metrics: Per-dataset scores, populated once the run completes.
        submitted_at: When the submission was received.
        updated_at: When this row last changed.
    """

    submission_id: str
    status_token: str
    run_id: str
    model_name: str
    model_family: str
    new_family_name: str | None
    api_provider: str
    model_api_id: str
    eval_scope: str
    datasets: list[str]
    submitter_email: str
    logo_key: str | None
    status: str
    status_detail: str
    progress_pct: int
    metrics: list[dict[str, object]]
    submitted_at: str
    updated_at: str


def _now_iso() -> str:
    """Return the current UTC time as an ISO 8601 string."""
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _row_to_record(row: sqlite3.Row) -> SubmissionRecord:
    """Convert a database row into a record, decoding its JSON columns."""
    return SubmissionRecord(
        submission_id=row["submission_id"],
        status_token=row["status_token"],
        run_id=row["run_id"],
        model_name=row["model_name"],
        model_family=row["model_family"],
        new_family_name=row["new_family_name"],
        api_provider=row["api_provider"],
        model_api_id=row["model_api_id"],
        eval_scope=row["eval_scope"],
        datasets=json.loads(row["datasets"]),
        submitter_email=row["submitter_email"],
        logo_key=row["logo_key"],
        status=row["status"],
        status_detail=row["status_detail"],
        progress_pct=row["progress_pct"],
        metrics=json.loads(row["metrics"]),
        submitted_at=row["submitted_at"],
        updated_at=row["updated_at"],
    )


class SubmissionStore:
    """SQLite-backed store for submissions and their evaluation state."""

    def __init__(self, db_path: Path) -> None:
        """Bind the store to a database file.

        Args:
            db_path: Path to the SQLite file. Its parent is created on demand.
        """
        self.db_path = db_path

    @contextmanager
    def _connect(self) -> Iterator[sqlite3.Connection]:
        """Open a connection configured for multi-process use.

        Yields:
            A connection that commits on clean exit and rolls back on error.
        """
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        connection = sqlite3.connect(
            self.db_path, timeout=BUSY_TIMEOUT_SECONDS, isolation_level="DEFERRED"
        )
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA journal_mode=WAL")
        connection.execute("PRAGMA synchronous=NORMAL")
        try:
            yield connection
            connection.commit()
        except Exception:
            connection.rollback()
            raise
        finally:
            connection.close()

    def initialise(self) -> None:
        """Create the schema if it does not already exist."""
        with self._connect() as connection:
            for statement in SCHEMA_STATEMENTS:
                connection.execute(statement)
        self.backfill_families_from_submissions()
        LOGGER.info("submission store ready at %s", self.db_path)

    def register_family(
        self, family_id: str, display_name: str, logo_key: str
    ) -> FamilyRecord:
        """Record a newly uploaded family so it appears in the dropdown.

        Re-registering the same id updates the display name and logo.

        Args:
            family_id: Stable slug (also the website provider id).
            display_name: Label shown in the admin form.
            logo_key: S3 key of the uploaded icon.

        Returns:
            The stored family row.
        """
        timestamp = _now_iso()
        with self._connect() as connection:
            connection.execute(
                """
                INSERT INTO families (family_id, display_name, logo_key, created_at)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(family_id) DO UPDATE SET
                    display_name = excluded.display_name,
                    logo_key = excluded.logo_key
                """,
                (family_id, display_name, logo_key, timestamp),
            )
        LOGGER.info(
            "registered family=%s display=%r logo=%s",
            family_id, display_name, logo_key,
        )
        record = self.get_family(family_id)
        if record is None:
            raise StoreError(f"family {family_id!r} missing after register")
        return record

    def get_family(self, family_id: str) -> FamilyRecord | None:
        """Look up one registered family by id."""
        with self._connect() as connection:
            row = connection.execute(
                "SELECT * FROM families WHERE family_id = ?", (family_id,)
            ).fetchone()
        if row is None:
            return None
        return FamilyRecord(
            family_id=row["family_id"],
            display_name=row["display_name"],
            logo_key=row["logo_key"],
            created_at=row["created_at"],
        )

    def list_families(self) -> list[FamilyRecord]:
        """List registered families, oldest first."""
        with self._connect() as connection:
            rows = connection.execute(
                "SELECT * FROM families ORDER BY created_at, family_id"
            ).fetchall()
        return [
            FamilyRecord(
                family_id=row["family_id"],
                display_name=row["display_name"],
                logo_key=row["logo_key"],
                created_at=row["created_at"],
            )
            for row in rows
        ]

    def backfill_families_from_submissions(self) -> int:
        """Register families from past new-family submissions that have logos.

        Returns:
            How many families were newly inserted.
        """
        with self._connect() as connection:
            rows = connection.execute(
                """
                SELECT new_family_name, logo_key, submitted_at
                FROM submissions
                WHERE new_family_name IS NOT NULL AND logo_key IS NOT NULL
                ORDER BY submitted_at
                """
            ).fetchall()

        inserted = 0
        for row in rows:
            family_id = slugify_model_id(row["new_family_name"])
            if family_id in FAMILY_TO_WEBSITE_PROVIDER:
                continue
            if self.get_family(family_id) is not None:
                continue
            self.register_family(
                family_id=family_id,
                display_name=row["new_family_name"],
                logo_key=row["logo_key"],
            )
            inserted += 1
        if inserted:
            LOGGER.info("backfilled %d family(ies) from submissions", inserted)
        return inserted

    def create(
        self,
        submission: Submission,
        run_id: str,
        status: SubmissionStatus,
        status_detail: str = "",
        logo_key: str | None = None,
    ) -> str:
        """Record a new submission and mint its status token.

        Args:
            submission: The validated submission.
            run_id: Run identifier assigned to this submission.
            status: Initial lifecycle state.
            status_detail: Submitter-facing explanation of that state.
            logo_key: S3 key of an uploaded logo, if any.

        Returns:
            The status token the submitter uses to watch this run.

        Raises:
            StoreError: If this submission id has already been recorded.
        """
        token = secrets.token_urlsafe(STATUS_TOKEN_BYTES)
        timestamp = _now_iso()

        try:
            with self._connect() as connection:
                connection.execute(
                    """
                    INSERT INTO submissions (
                        submission_id, status_token, run_id, model_name,
                        model_family, new_family_name, api_provider, model_api_id,
                        eval_scope, datasets, submitter_email, logo_key,
                        status, status_detail, progress_pct, metrics,
                        submitted_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        submission.submission_id,
                        token,
                        run_id,
                        submission.model_name,
                        submission.model_family,
                        submission.new_family_name,
                        submission.api_provider,
                        submission.model_api_id,
                        submission.eval_scope,
                        json.dumps(submission.datasets),
                        str(submission.submitter_email),
                        logo_key,
                        status,
                        status_detail[:MAX_STATUS_DETAIL_CHARS],
                        0,
                        "[]",
                        submission.submitted_at.isoformat(timespec="seconds"),
                        timestamp,
                    ),
                )
        except sqlite3.IntegrityError as error:
            raise StoreError(
                f"submission {submission.submission_id!r} is already recorded; "
                f"a resubmission needs a fresh submission_id"
            ) from error

        LOGGER.info(
            "recorded submission=%s run=%s status=%s",
            submission.submission_id, run_id, status,
        )
        return token

    def _update(self, submission_id: str, assignments: str, values: tuple) -> None:
        """Apply one UPDATE and require that it matched exactly one row.

        Args:
            submission_id: Row to update.
            assignments: SQL assignment list, without the SET keyword.
            values: Parameters for the assignment list, in order.

        Raises:
            StoreError: If no row matched the submission id.
        """
        with self._connect() as connection:
            cursor = connection.execute(
                f"UPDATE submissions SET {assignments}, updated_at = ? "
                f"WHERE submission_id = ?",
                (*values, _now_iso(), submission_id),
            )
            if cursor.rowcount != 1:
                raise StoreError(
                    f"expected to update exactly one row for submission "
                    f"{submission_id!r}, but matched {cursor.rowcount}"
                )

    def set_status(
        self, submission_id: str, status: SubmissionStatus, detail: str = ""
    ) -> None:
        """Record a lifecycle transition.

        Args:
            submission_id: Row to update.
            status: New lifecycle state.
            detail: Submitter-facing explanation, truncated for display.

        Raises:
            StoreError: If the submission is unknown.
        """
        self._update(
            submission_id,
            "status = ?, status_detail = ?",
            (status, detail[:MAX_STATUS_DETAIL_CHARS]),
        )
        LOGGER.info("submission=%s status=%s", submission_id, status)

    def set_progress(self, submission_id: str, percent: int) -> None:
        """Record evaluation progress.

        Progress only ever moves forward: the stored value is the larger of the
        current and incoming percentages, so an out-of-order update cannot make a
        submitter's progress bar jump backwards.

        Args:
            submission_id: Row to update.
            percent: Completion percentage.

        Raises:
            StoreError: If the submission is unknown.
            ValueError: If the percentage is outside 0 to 100.
        """
        if not 0 <= percent <= 100:
            raise ValueError(f"progress percent {percent} is outside 0-100")

        self._update(
            submission_id, "progress_pct = MAX(progress_pct, ?)", (percent,)
        )

    def mark_requeued(
        self, submission_id: str, model_family: str, run_id: str, detail: str
    ) -> None:
        """Re-arm a parked submission under a family that now has an icon.

        Args:
            submission_id: The submission being re-run.
            model_family: Family it now belongs to.
            run_id: Run id of the freshly queued job.
            detail: Submitter-facing explanation.
        """
        self._update(
            submission_id,
            "model_family = ?, run_id = ?, status = ?, status_detail = ?, "
            "progress_pct = 0, metrics = '[]'",
            (model_family, run_id, STATUS_QUEUED, detail[:MAX_STATUS_DETAIL_CHARS]),
        )
        LOGGER.info(
            "submission=%s re-queued as family=%s run=%s",
            submission_id, model_family, run_id,
        )

    def set_metrics(
        self, submission_id: str, metrics: list[dict[str, object]]
    ) -> None:
        """Attach per-dataset scores to a finished submission.

        Args:
            submission_id: Row to update.
            metrics: One entry per scored dataset.

        Raises:
            StoreError: If the submission is unknown.
        """
        self._update(submission_id, "metrics = ?", (json.dumps(metrics),))

    def get(self, submission_id: str) -> SubmissionRecord | None:
        """Look up a submission by its identifier.

        Args:
            submission_id: Identifier to look up.

        Returns:
            The record, or None if no such submission exists.
        """
        with self._connect() as connection:
            row = connection.execute(
                "SELECT * FROM submissions WHERE submission_id = ?", (submission_id,)
            ).fetchone()
        return _row_to_record(row) if row is not None else None

    def get_by_token(self, status_token: str) -> SubmissionRecord | None:
        """Look up a submission by its status token.

        Args:
            status_token: The secret handed to the submitter.

        Returns:
            The record, or None if the token matches nothing.
        """
        with self._connect() as connection:
            row = connection.execute(
                "SELECT * FROM submissions WHERE status_token = ?", (status_token,)
            ).fetchone()
        return _row_to_record(row) if row is not None else None

    def list_all(self, limit: int = 500) -> list[SubmissionRecord]:
        """List submissions for the admin panel, newest first.

        Args:
            limit: Maximum number of rows to return.

        Returns:
            The most recent submissions.
        """
        with self._connect() as connection:
            rows = connection.execute(
                "SELECT * FROM submissions ORDER BY submitted_at DESC LIMIT ?",
                (limit,),
            ).fetchall()
        return [_row_to_record(row) for row in rows]

    def pending_new_families(self) -> list[SubmissionRecord]:
        """List submissions parked waiting for a maintainer to add an icon.

        Returns:
            Rejected submissions that proposed a new family, oldest first.
        """
        with self._connect() as connection:
            rows = connection.execute(
                "SELECT * FROM submissions WHERE status = ? "
                "AND new_family_name IS NOT NULL ORDER BY submitted_at",
                (STATUS_REJECTED,),
            ).fetchall()
        return [_row_to_record(row) for row in rows]
