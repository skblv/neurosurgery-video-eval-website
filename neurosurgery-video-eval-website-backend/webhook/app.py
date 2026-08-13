"""HTTP surface for the eval service.

Intake and status live on the admin panel (unguessable path + HTTP Basic auth).
This module only exposes health, the admin router, and a shared-secret operator
probe for queue state. Evaluation itself runs in a separate worker.
"""

from __future__ import annotations

import hmac
import logging

from fastapi import Depends, FastAPI, Header, HTTPException, status
from pydantic import BaseModel

from runner.config import ServiceConfig, load_config
from runner.logging_setup import configure_logging
from runner.store import SubmissionStore
from webhook.admin import build_admin_router
from webhook.queue import JobQueue

LOGGER = logging.getLogger(__name__)

CONFIG: ServiceConfig = load_config()
configure_logging(CONFIG.log_dir, "webhook")

QUEUE = JobQueue(spool_dir=CONFIG.spool_dir)
QUEUE.ensure_dirs()

STORE = SubmissionStore(CONFIG.submissions_db)
STORE.initialise()

app = FastAPI(
    title="Surgical AI leaderboard eval service",
    description="Admin intake and evaluation queue for the surgical leaderboard.",
    version="3.0.0",
)

app.include_router(build_admin_router(CONFIG, STORE, QUEUE))


class HealthStatus(BaseModel):
    """Response body for the health probe."""

    status: str
    queue: dict[str, int]


def _presented_secret(
    authorization: str | None, x_eval_secret: str | None
) -> str | None:
    """Extract the caller's secret from either accepted header."""
    if x_eval_secret:
        return x_eval_secret
    if authorization and authorization.lower().startswith("bearer "):
        return authorization[len("bearer "):].strip()
    return None


async def require_shared_secret(
    authorization: str | None = Header(default=None),
    x_eval_secret: str | None = Header(default=None, alias="X-Eval-Secret"),
) -> None:
    """Reject callers that do not present the maintainer shared secret."""
    presented = _presented_secret(authorization, x_eval_secret)
    if presented is None:
        LOGGER.warning("rejected request: no credential presented")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing credential. Send Authorization: Bearer <secret> "
                   "or X-Eval-Secret: <secret>.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not hmac.compare_digest(presented, CONFIG.webhook_shared_secret):
        LOGGER.warning("rejected request: shared secret did not match")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credential.",
            headers={"WWW-Authenticate": "Bearer"},
        )


@app.get("/healthz", response_model=HealthStatus)
async def healthz() -> HealthStatus:
    """Report service liveness and current queue depth."""
    return HealthStatus(status="ok", queue=QUEUE.counts())


@app.get("/runs/{run_id}", dependencies=[Depends(require_shared_secret)])
async def run_state(run_id: str) -> dict[str, str]:
    """Report the queue state of a run, for operators."""
    state = QUEUE.state_of(run_id)
    if state is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=f"Unknown run {run_id}"
        )
    return {"run_id": run_id, "state": state}
