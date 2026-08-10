"""The submission contract: what the public form posts and what the runner consumes.

``Submission`` mirrors the form payload exactly and is validated defensively:
unknown fields are rejected so a silently renamed field surfaces as a 422 instead
of an eval against the wrong model. ``JobSpec`` is the internal form the worker and
runner use, with the run identifier attached.

Both the form and this contract speak wire values — ``sample_1000`` rather than
"Quick sample (1,000 frames)". Display labels live in the frontend alone, so there
is no label table here to drift out of sync.
"""

from __future__ import annotations

import re
from datetime import datetime, timezone
from typing import Literal, Never

from pydantic import (
    BaseModel,
    ConfigDict,
    EmailStr,
    Field,
    field_validator,
    model_validator,
)

from runner.config import SAMPLE_SCOPE_N_OBS
from runner.datasets import DATASET_KEYS

ApiProvider = Literal["openai", "anthropic", "google", "openrouter"]
EvalScope = Literal["sample_1000", "full"]

# Built-in families ship with SVG icons on the public site. Additional families
# are registered in SQLite when a maintainer uploads a logo; their id is a slug
# that also becomes the website provider. `new_family` is the escape hatch for
# proposing something not yet listed.
NEW_FAMILY = "new_family"

FAMILY_TO_WEBSITE_PROVIDER: dict[str, str] = {
    "openai": "openai",
    "anthropic": "anthropic",
    "gemini": "gemini",
    "moonshot": "moonshot",
    "internal": "internal",
}

FAMILY_SLUG_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
SLUG_STRIP_RE = re.compile(r"[^a-z0-9]+")
RUN_ID_SAFE_RE = re.compile(r"[^A-Za-z0-9_.-]+")


def slugify_model_id(model_name: str) -> str:
    """Derive the stable results.json model id from a display name.

    Args:
        model_name: Human-facing model name from the submission.

    Returns:
        A lowercase, hyphen-separated identifier.

    Raises:
        ValueError: If the name contains no alphanumeric characters.
    """
    slug = SLUG_STRIP_RE.sub("-", model_name.strip().lower()).strip("-")
    if not slug:
        raise ValueError(f"model_name {model_name!r} has no alphanumeric characters")
    return slug


class Submission(BaseModel):
    """The payload sent by the public submission form."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    submission_id: str = Field(min_length=1, max_length=200)
    model_name: str = Field(min_length=1, max_length=200)
    model_family: str = Field(min_length=1, max_length=100)
    new_family_name: str | None = Field(default=None, max_length=100)
    api_provider: ApiProvider
    model_api_id: str = Field(min_length=1, max_length=300)
    eval_scope: EvalScope
    datasets: list[str] = Field(min_length=1)
    submitter_email: EmailStr
    submitted_at: datetime

    @field_validator("model_family", "api_provider", mode="before")
    @classmethod
    def _normalise_case(cls, value: object) -> object:
        """Accept differently cased spellings of the wire values."""
        return value.strip().lower() if isinstance(value, str) else value

    @field_validator("model_family")
    @classmethod
    def _family_shape(cls, value: str) -> str:
        """Accept built-ins, ``new_family``, or a registered-family slug."""
        if value == NEW_FAMILY or value in FAMILY_TO_WEBSITE_PROVIDER:
            return value
        if not FAMILY_SLUG_RE.fullmatch(value):
            raise ValueError(
                f"model_family {value!r} must be a lowercase slug "
                f"(letters, digits, hyphens) or one of "
                f"{sorted(FAMILY_TO_WEBSITE_PROVIDER) + [NEW_FAMILY]}"
            )
        return value

    @field_validator("new_family_name", mode="before")
    @classmethod
    def _blank_is_absent(cls, value: object) -> object:
        """Treat an empty field as absent, since form posts omit nothing."""
        if isinstance(value, str) and not value.strip():
            return None
        return value

    @field_validator("datasets", mode="before")
    @classmethod
    def _split_datasets(cls, value: object) -> object:
        """Accept datasets as a list or as one comma-separated string.

        A multipart form sends repeated fields, which arrive as a list, while the
        CLI and hand-written requests are easier to write as a single string.
        """
        items = value.split(",") if isinstance(value, str) else value
        if not isinstance(items, list):
            return value
        return [item.strip() for item in items if isinstance(item, str) and item.strip()]

    @field_validator("datasets")
    @classmethod
    def _known_datasets(cls, datasets: list[str]) -> list[str]:
        """Reject unknown dataset keys and duplicates, preserving order."""
        unknown = [d for d in datasets if d not in DATASET_KEYS]
        if unknown:
            raise ValueError(
                f"unknown datasets {unknown}; expected a subset of {DATASET_KEYS}"
            )
        if len(set(datasets)) != len(datasets):
            raise ValueError(f"datasets contains duplicates: {datasets}")
        return datasets

    @model_validator(mode="after")
    def _new_family_is_named(self) -> Submission:
        """Require a name whenever the submitter proposes a new family.

        Raises:
            ValueError: If the family is new but no name was given, which would
                leave a maintainer with a logo and nothing to call it.
        """
        if self.model_family == NEW_FAMILY and not self.new_family_name:
            raise ValueError(
                "new_family_name is required when model_family is 'new_family'"
            )
        return self


def website_provider_for(submission: Submission) -> str:
    """Provider identifier written into results.json for this submission.

    Built-in families map to their site icons. A brand-new family (still
    ``new_family`` on the wire) uses the slug of the name the submitter gave.
    A previously registered custom family stores that slug as ``model_family``.
    """
    if submission.model_family == NEW_FAMILY:
        if not submission.new_family_name:
            raise ValueError(
                "new_family_name is required to derive a website provider"
            )
        return slugify_model_id(submission.new_family_name)

    provider = FAMILY_TO_WEBSITE_PROVIDER.get(submission.model_family)
    if provider is not None:
        return provider
    return submission.model_family


class JobSpec(BaseModel):
    """A queued evaluation job."""

    model_config = ConfigDict(extra="forbid")

    run_id: str
    submission: Submission
    enqueued_at: datetime
    logo_key: str | None = None

    @property
    def website_provider(self) -> str:
        """Provider identifier the public site expects for this model."""
        return website_provider_for(self.submission)

    @property
    def website_model_id(self) -> str:
        """Stable results.json entry id for this model."""
        return slugify_model_id(self.submission.model_name)

    @property
    def n_obs(self) -> int | None:
        """Frames per dataset, or None for the whole validation split."""
        if self.submission.eval_scope == "sample_1000":
            return SAMPLE_SCOPE_N_OBS
        if self.submission.eval_scope == "full":
            return None
        _never: Never = self.submission.eval_scope
        raise AssertionError(f"unhandled eval_scope: {_never}")


def build_run_id(submission: Submission, now: datetime | None = None) -> str:
    """Build the S3-safe run identifier for a submission.

    Args:
        submission: The validated submission.
        now: Timestamp to stamp the run with; defaults to the current UTC time.

    Returns:
        A run id of the form ``<utc-timestamp>__<model-slug>__<submission-id>``.
    """
    stamp = (now or datetime.now(timezone.utc)).strftime("%Y%m%dT%H%M%SZ")
    model_slug = slugify_model_id(submission.model_name)
    submission_slug = RUN_ID_SAFE_RE.sub("-", submission.submission_id).strip("-")
    return f"{stamp}__{model_slug}__{submission_slug}"


def build_job_spec(submission: Submission) -> JobSpec:
    """Wrap a validated submission into a queued job.

    Args:
        submission: The validated submission.

    Returns:
        The job spec the worker will execute.
    """
    now = datetime.now(timezone.utc)
    return JobSpec(
        run_id=build_run_id(submission, now),
        submission=submission,
        enqueued_at=now,
    )
