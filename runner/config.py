"""Environment and infrastructure configuration for the eval service.

Every value that differs between machines is read from the process environment,
which on the eval instance is populated by systemd from ``/etc/svc-eval/.env``.
Nothing here reads Secrets Manager or SSM Parameter Store: the instance role has
no permission for either.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

# ---------------------------------------------------------------- constants

RANDOM_SEED = 42

AWS_REGION = "us-east-2"
S3_BUCKET = "caai-surgical-eval"
S3_DATASETS_PREFIX = "datasets"
S3_RESULTS_PREFIX = "results"

BOOTSTRAP_SAMPLES = 1000
BOOTSTRAP_CONFIDENCE = 0.95

SAMPLE_SCOPE_N_OBS = 1000

MAX_RETRIES = 5
RETRY_BASE_DELAY = 2.0
TEMPERATURE = 1.0

# GPT-5.x and other reasoning models bill reasoning tokens against the output
# cap, so the reference evals raised it from 1024 to 4096 for those families.
MAX_OUTPUT_TOKENS = 4096

PUBLIC_REPO_SSH_URL = "git@github.com:skblv/neurosurgery-video-eval-website.git"
PUBLIC_REPO_RESULTS_PATH = Path("src/data/results.json")
PUBLIC_REPO_BRANCH = "main"

# Schema v2 dropped paramsB. The site's loader compares this exactly and its
# requireExactKeys check rejects any entry carrying an unlisted key, so these two
# constants must track src/data/resultsSchema.ts.
RESULTS_SCHEMA_VERSION = 2
RESULT_ENTRY_KEYS = ("id", "model", "provider", "sourceRunId", "metrics")

SUBMISSIONS_DB_NAME = "submissions.db"

# The admin panel is reachable only at an unguessable path and then only behind
# HTTP Basic auth. The path is not a substitute for the password; it just keeps the
# panel from being found by anyone scanning the host.
ADMIN_USERNAME = "admin"

S3_LOGOS_PREFIX = "submission-logos"

# A logo is an icon on a leaderboard row, so anything large is a mistake. The cap
# is enforced while streaming the upload, not after buffering it.
MAX_LOGO_BYTES = 2 * 1024 * 1024
ALLOWED_LOGO_SUFFIXES = frozenset({".svg", ".png", ".jpg", ".jpeg", ".webp"})

# A run can be tens of thousands of frames and each progress report is a write
# other processes may be reading, so progress moves in steps rather than per frame.
PROGRESS_REPORT_STEP_PCT = 5

# The submitter reads status_detail on a status page, not in a log viewer, so it
# is capped rather than allowed to carry a stack trace.
MAX_STATUS_DETAIL_CHARS = 200

MEDIA_TYPES = {
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".gif": "image/gif",
}

# ------------------------------------------------------------------- config


def _require_env(name: str) -> str:
    """Read a required environment variable.

    Args:
        name: Variable name.

    Returns:
        The variable's value.

    Raises:
        RuntimeError: If the variable is unset or empty.
    """
    value = os.environ.get(name, "").strip()
    if not value:
        raise RuntimeError(
            f"Required environment variable {name} is unset or empty. "
            f"On the eval instance it comes from /etc/svc-eval/.env."
        )
    return value


def _optional_env(name: str) -> str | None:
    """Read an optional environment variable, treating empty as absent."""
    value = os.environ.get(name, "").strip()
    return value or None


def _bool_env(name: str, default: bool) -> bool:
    """Read a boolean environment variable with a default.

    Raises:
        RuntimeError: If the variable is set to something other than a
            recognised truthy or falsy word.
    """
    raw = os.environ.get(name, "").strip().lower()
    if not raw:
        return default
    if raw in ("1", "true", "yes", "on"):
        return True
    if raw in ("0", "false", "no", "off"):
        return False
    raise RuntimeError(
        f"Environment variable {name}={raw!r} is not a boolean; "
        f"use true/false."
    )


def _int_env(name: str, default: int) -> int:
    """Read an integer environment variable with a default.

    Raises:
        RuntimeError: If the variable is set but not parseable as an int.
    """
    raw = os.environ.get(name, "").strip()
    if not raw:
        return default
    if not raw.lstrip("-").isdigit():
        raise RuntimeError(f"Environment variable {name}={raw!r} is not an integer.")
    return int(raw)


@dataclass(frozen=True)
class ServiceConfig:
    """Resolved runtime configuration.

    Attributes:
        state_dir: Root for per-run caches and working copies.
        spool_dir: Directory the webhook writes job files into.
        log_dir: Directory for webhook and worker log files.
        num_workers: Concurrent model API calls per dataset.
        s3_unsigned: Send S3 requests unsigned. Required on hosts with no
            instance role, where the bucket grants access by source IP instead.
            Always explicit: the client never probes for credentials and
            downgrades on its own, because a deployment that silently changed
            auth mode would be near-impossible to diagnose.
        submissions_db: SQLite file holding submissions and their live state.
        admin_path: Unguessable URL segment the admin panel is mounted under.
        admin_password: Password for the ``admin`` account on that panel.
        webhook_shared_secret: Bearer token for the maintainer-only endpoints.
        webhook_host: Bind address for the webhook service.
        webhook_port: Bind port for the webhook service.
        github_deploy_key_path: Private half of the repo-scoped deploy key.
        git_author_name: Commit author name used when publishing results.
        git_author_email: Commit author email used when publishing results.
        openai_api_key: OpenAI key, or None if not provisioned.
        anthropic_api_key: Anthropic key, or None if not provisioned.
        gemini_api_key: Google Gemini key, or None if not provisioned.
        openrouter_api_key: OpenRouter key, or None if not provisioned.
    """

    state_dir: Path
    spool_dir: Path
    log_dir: Path
    num_workers: int
    s3_unsigned: bool
    submissions_db: Path
    admin_path: str
    admin_password: str
    webhook_shared_secret: str
    webhook_host: str
    webhook_port: int
    github_deploy_key_path: Path
    git_author_name: str
    git_author_email: str
    openai_api_key: str | None
    anthropic_api_key: str | None
    gemini_api_key: str | None
    openrouter_api_key: str | None


def load_config() -> ServiceConfig:
    """Build the service configuration from the process environment.

    Returns:
        The resolved configuration.

    Raises:
        RuntimeError: If a required variable is missing or malformed.
    """
    state_dir = Path(os.environ.get("SVC_EVAL_STATE_DIR", "/var/lib/svc-eval"))
    log_dir = Path(os.environ.get("SVC_EVAL_LOG_DIR", "/var/log/svc-eval"))

    return ServiceConfig(
        state_dir=state_dir,
        spool_dir=state_dir / "spool",
        log_dir=log_dir,
        num_workers=_int_env("SVC_EVAL_NUM_WORKERS", 8),
        s3_unsigned=_bool_env("S3_UNSIGNED", False),
        submissions_db=state_dir / SUBMISSIONS_DB_NAME,
        admin_path=_require_env("ADMIN_PANEL_PATH").strip("/"),
        admin_password=_require_env("ADMIN_PASSWORD"),
        webhook_shared_secret=_require_env("WEBHOOK_SHARED_SECRET"),
        webhook_host=os.environ.get("WEBHOOK_HOST", "0.0.0.0"),
        webhook_port=_int_env("WEBHOOK_PORT", 8080),
        github_deploy_key_path=Path(
            os.environ.get("GITHUB_DEPLOY_KEY_PATH", "/etc/svc-eval/deploy_key")
        ),
        git_author_name=os.environ.get("GIT_AUTHOR_NAME", "surgical-eval-bot"),
        git_author_email=os.environ.get(
            "GIT_AUTHOR_EMAIL", "surgical-eval-bot@users.noreply.github.com"
        ),
        openai_api_key=_optional_env("OPENAI_API_KEY"),
        anthropic_api_key=_optional_env("ANTHROPIC_API_KEY"),
        gemini_api_key=_optional_env("GEMINI_API_KEY"),
        openrouter_api_key=_optional_env("OPENROUTER_API_KEY"),
    )
