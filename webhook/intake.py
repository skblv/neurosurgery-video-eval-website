"""Shared helpers for recording a model submission and optionally queuing it.

Used by the admin panel form. Kept out of the panel module so the HTML layer
does not also own logo streaming and S3 keys.
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from pathlib import PurePosixPath

from fastapi import HTTPException, UploadFile, status
from fastapi.concurrency import run_in_threadpool

from runner.config import (
    ALLOWED_LOGO_SUFFIXES,
    MAX_LOGO_BYTES,
    MEDIA_TYPES,
    S3_LOGOS_PREFIX,
    ServiceConfig,
)
from runner.jobspec import (
    FAMILY_TO_WEBSITE_PROVIDER,
    NEW_FAMILY,
    Submission,
    build_job_spec,
    slugify_model_id,
)
from runner.providers import verify_model_available
from runner.s3io import S3Client
from runner.store import (
    STATUS_QUEUED,
    SubmissionStore,
    StoreError,
)
from webhook.queue import JobQueue, QueueError

LOGGER = logging.getLogger(__name__)

LOGO_UPLOAD_CHUNK = 64 * 1024


async def read_logo(logo: UploadFile) -> tuple[bytes, str]:
    """Read an uploaded logo, enforcing type and size limits.

    Raises:
        HTTPException: 400 for a bad type or empty file, 413 if too large.
    """
    suffix = PurePosixPath(logo.filename or "").suffix.lower()
    if suffix not in ALLOWED_LOGO_SUFFIXES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Logo must be one of {sorted(ALLOWED_LOGO_SUFFIXES)}; "
                   f"got {suffix or 'a file with no extension'}.",
        )

    payload = bytearray()
    while chunk := await logo.read(LOGO_UPLOAD_CHUNK):
        payload.extend(chunk)
        if len(payload) > MAX_LOGO_BYTES:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"Logo is larger than {MAX_LOGO_BYTES // 1024} KB.",
            )

    if not payload:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The uploaded logo is empty.",
        )

    return bytes(payload), suffix


def store_logo(
    config: ServiceConfig, submission_id: str, payload: bytes, suffix: str
) -> str:
    """Upload a logo to S3 and return its key.

    Raises:
        HTTPException: 502 if the object cannot be written.
    """
    key = f"{S3_LOGOS_PREFIX}/{submission_id}{suffix}"
    client = S3Client.from_config(config)
    try:
        client.put_bytes(
            key, payload, MEDIA_TYPES.get(suffix, "application/octet-stream")
        )
    except Exception as error:
        LOGGER.exception("logo upload failed for submission=%s", submission_id)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Could not store the uploaded logo: {error}",
        ) from error
    return key


def record_submission(
    store: SubmissionStore,
    submission: Submission,
    run_id: str,
    state: str,
    detail: str,
    logo_key: str | None,
) -> str:
    """Persist a submission and return its status token.

    Raises:
        HTTPException: 409 if this submission was already recorded.
    """
    try:
        return store.create(
            submission,
            run_id=run_id,
            status=state,
            status_detail=detail,
            logo_key=logo_key,
        )
    except StoreError as error:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail=str(error)
        ) from error


def _resolve_family(
    store: SubmissionStore,
    submission: Submission,
) -> tuple[Submission, str | None]:
    """Normalise the family choice and return any existing logo to reuse.

    New families are rewritten to their slug and registered later once a logo
    key exists. Selecting a registered custom family reuses that family's icon.

    Returns:
        ``(submission, existing_logo_key)``. ``existing_logo_key`` is set when
        the family is already registered and no fresh upload is required.

    Raises:
        HTTPException: If the family is unknown or a new family needs a logo.
    """
    if submission.model_family == NEW_FAMILY:
        if not submission.new_family_name:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="New family name is required.",
            )
        family_id = slugify_model_id(submission.new_family_name)
        if family_id in FAMILY_TO_WEBSITE_PROVIDER:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"{submission.new_family_name!r} already matches the built-in "
                    f"family {family_id!r}. Pick that family from the list."
                ),
            )
        existing = store.get_family(family_id)
        rewritten = submission.model_copy(update={"model_family": family_id})
        if existing is None:
            return rewritten, None
        return rewritten, existing.logo_key

    if submission.model_family in FAMILY_TO_WEBSITE_PROVIDER:
        return submission, None

    existing = store.get_family(submission.model_family)
    if existing is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Unknown model family {submission.model_family!r}. "
                f"Pick a listed family or choose “A family not listed here”."
            ),
        )
    return submission, existing.logo_key


async def accept_submission(
    *,
    config: ServiceConfig,
    store: SubmissionStore,
    queue: JobQueue,
    model_name: str,
    model_family: str,
    api_provider: str,
    model_api_id: str,
    eval_scope: str,
    datasets: list[str],
    submitter_email: str,
    new_family_name: str | None,
    logo: UploadFile | None,
) -> tuple[str, str, bool]:
    """Validate, record, and optionally enqueue one submission.

    Returns:
        ``(submission_id, status, queued)``.

    Raises:
        HTTPException: On validation, logo, store, or queue failures.
    """
    submission_id = uuid.uuid4().hex
    submission = Submission(
        submission_id=submission_id,
        model_name=model_name,
        model_family=model_family,
        new_family_name=new_family_name,
        api_provider=api_provider,
        model_api_id=model_api_id,
        eval_scope=eval_scope,
        datasets=datasets,
        submitter_email=submitter_email,
        submitted_at=datetime.now(timezone.utc),
    )
    was_new_family = submission.model_family == NEW_FAMILY
    submission, existing_logo_key = _resolve_family(store, submission)

    try:
        choice = await run_in_threadpool(
            verify_model_available,
            submission.api_provider,
            submission.model_api_id,
            config,
        )
    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=str(error)
        ) from error
    except RuntimeError as error:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(error)
        ) from error

    LOGGER.info(
        "model verified submission=%s requested=%s/%s effective=%s/%s%s",
        submission_id,
        submission.api_provider,
        submission.model_api_id,
        choice.effective_provider,
        choice.effective_model_api_id,
        f" ({choice.fallback_reason})" if choice.fallback_reason else "",
    )

    logo_key: str | None = existing_logo_key
    if logo is not None:
        payload, suffix = await read_logo(logo)
        logo_key = await run_in_threadpool(
            store_logo, config, submission_id, payload, suffix
        )

    if was_new_family:
        if logo_key is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"{submission.new_family_name} is a new model family, so the "
                    f"leaderboard has no icon for it. Attach a logo and submit "
                    f"again."
                ),
            )
        display_name = submission.new_family_name or submission.model_family
        store.register_family(
            family_id=submission.model_family,
            display_name=display_name,
            logo_key=logo_key,
        )
    elif (
        submission.model_family not in FAMILY_TO_WEBSITE_PROVIDER
        and logo is not None
        and logo_key is not None
    ):
        store.register_family(
            family_id=submission.model_family,
            display_name=submission.model_family,
            logo_key=logo_key,
        )

    job = build_job_spec(submission)
    if logo_key is not None:
        job = job.model_copy(update={"logo_key": logo_key})

    detail = f"Queued for evaluation on {', '.join(submission.datasets)}."
    record_submission(
        store, submission, job.run_id, STATUS_QUEUED, detail, logo_key
    )

    try:
        queue.enqueue(job)
    except QueueError as error:
        LOGGER.error("could not enqueue %s: %s", job.run_id, error)
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail=str(error)
        ) from error
    except OSError as error:
        LOGGER.exception("spool write failed for %s", job.run_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Could not persist the job to the spool: {error}",
        ) from error

    LOGGER.info(
        "queued run=%s submission=%s model=%r family=%s provider=%s "
        "datasets=%s scope=%s submitter=%s",
        job.run_id, submission_id, submission.model_name,
        submission.model_family, submission.api_provider, submission.datasets,
        submission.eval_scope, submission.submitter_email,
    )
    return submission_id, STATUS_QUEUED, True
