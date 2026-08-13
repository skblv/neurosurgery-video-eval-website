"""Maintainer panel: submit models, watch runs, re-queue parked new families.

Mounted under an unguessable path and guarded by HTTP Basic auth. Everything that
used to live on a public form lives here instead, so nothing about intake is in
the public GitHub Pages bundle.
"""

from __future__ import annotations

import hmac
import html
import logging
from pathlib import PurePosixPath

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    Request,
    Response,
    UploadFile,
    status,
)
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.security import HTTPBasic, HTTPBasicCredentials
from pydantic import ValidationError

from runner.config import (
    ADMIN_USERNAME,
    MEDIA_TYPES,
    ServiceConfig,
)
from runner.datasets import DATASET_CONFIGS, DATASET_KEYS
from runner.jobspec import (
    FAMILY_TO_WEBSITE_PROVIDER,
    NEW_FAMILY,
    Submission,
    build_job_spec,
    slugify_model_id,
)
from runner.s3io import MissingObjectError, S3Client
from runner.store import (
    STATUS_QUEUED,
    FamilyRecord,
    SubmissionRecord,
    SubmissionStore,
)
from webhook.intake import accept_submission
from webhook.queue import JobQueue, QueueError

LOGGER = logging.getLogger(__name__)

BASIC_AUTH = HTTPBasic(realm="Surgical eval admin")

# The form no longer asks for an email; the store column still expects one.
ADMIN_SUBMITTER_EMAIL = "admin@example.org"

KNOWN_FAMILIES = sorted(FAMILY_TO_WEBSITE_PROVIDER)
API_PROVIDERS = ("openai", "anthropic", "google", "openrouter")
EVAL_SCOPES = ("sample_1000", "full")

STATUS_COLOURS = {
    "queued": "#6b6b6b",
    "running": "#1a56db",
    "completed": "#046c4e",
    "failed": "#b91c1c",
    "rejected": "#92400e",
}

PAGE_STYLE = """
*, *::before, *::after { box-sizing: border-box; }
body {
  margin: 0; padding: 2.5rem 1.5rem; color: #000; background: #fff;
  font: 400 15px/1.5 Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}
main { max-width: 1200px; margin: 0 auto; }
h1 { font-size: 1.5rem; font-weight: 600; margin: 0 0 0.25rem; }
p.lede { margin: 0 0 1.5rem; color: #000; }
h2 { font-size: 1.05rem; font-weight: 600; margin: 2.5rem 0 0.75rem; }
.flash {
  margin: 0 0 1.5rem; padding: 0.7rem 0.9rem; border-left: 3px solid #000;
  background: #f4f4f4; max-width: 40rem;
}
.flash--error { border-left-color: #b91c1c; background: #fdf3f3; }
.form {
  max-width: 34rem; display: grid; gap: 1rem; margin-bottom: 0.5rem;
}
.field { display: grid; gap: 0.3rem; }
.field label, .field legend {
  font-size: 12px; letter-spacing: 0.05em; text-transform: uppercase;
  font-weight: 600; padding: 0;
}
.field input:not([type="checkbox"]):not([type="file"]),
.field select {
  font: inherit; border: 1px solid #000; border-radius: 0; padding: 0.45rem 0.6rem;
  background: #fff; color: #000; width: 100%;
}
.field input[type="file"] {
  font: inherit; width: 100%;
}
.checks {
  display: flex; flex-wrap: wrap; gap: 0.75rem 1.5rem; align-items: center;
}
.check {
  display: inline-flex; align-items: center; gap: 0.45rem;
  font-size: 14px; white-space: nowrap;
}
.check input[type="checkbox"] {
  width: 1rem; height: 1rem; margin: 0; flex: none; accent-color: #000;
}
.hint { font-size: 13px; color: #444; }
.new-family { display: none; }
.new-family.is-open { display: grid; gap: 1rem; }
table { width: 100%; border-collapse: collapse; font-size: 14px; }
th, td { text-align: left; padding: 0.6rem 0.75rem; border-bottom: 1px solid #e5e5e5;
         vertical-align: top; }
th { font-weight: 600; border-bottom: 1px solid #000; white-space: nowrap; }
td.num { text-align: right; font-variant-numeric: tabular-nums; }
code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 13px; }
.status { font-weight: 600; }
.detail { color: #444; font-size: 13px; max-width: 34rem; }
.bar { height: 6px; background: #eee; width: 90px; }
.bar > span { display: block; height: 100%; background: #000; }
form.inline { display: flex; gap: 0.4rem; align-items: center; margin: 0; }
button {
  font: inherit; border: 1px solid #000; background: #000; color: #fff;
  padding: 0.45rem 0.9rem; border-radius: 0; cursor: pointer; width: fit-content;
}
button:hover { background: #fff; color: #000; }
form.inline button { background: #fff; color: #000; padding: 0.3rem 0.5rem; }
form.inline button:hover { background: #000; color: #fff; }
.empty { color: #444; font-style: italic; }
a { color: #000; }
fieldset { border: 0; padding: 0; margin: 0; }
"""

FORM_SCRIPT = """
<script>
(function () {
  const family = document.getElementById("model_family");
  const block = document.getElementById("new-family-fields");
  if (!family || !block) return;
  const sync = () => {
    const open = family.value === "new_family";
    block.classList.toggle("is-open", open);
    block.querySelectorAll("input").forEach((el) => {
      el.required = open;
    });
  };
  family.addEventListener("change", sync);
  sync();
})();
</script>
"""


def _make_admin_guard(config: ServiceConfig):
    """Build the dependency that authenticates admin requests."""

    async def require_admin(
        credentials: HTTPBasicCredentials = Depends(BASIC_AUTH),
    ) -> None:
        username_ok = hmac.compare_digest(credentials.username, ADMIN_USERNAME)
        password_ok = hmac.compare_digest(credentials.password, config.admin_password)
        if not (username_ok and password_ok):
            LOGGER.warning("admin auth failed for username=%r", credentials.username)
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect username or password.",
                headers={"WWW-Authenticate": 'Basic realm="Surgical eval admin"'},
            )

    return require_admin


def _options(values: list[str] | tuple[str, ...], labels: dict[str, str] | None = None) -> str:
    """Render ``<option>`` tags."""
    return "".join(
        f'<option value="{html.escape(value)}">'
        f'{html.escape((labels or {}).get(value, value))}</option>'
        for value in values
    )


def _dataset_checks() -> str:
    """Render dataset checkboxes, all selected by default."""
    return "".join(
        f'<label class="check"><input type="checkbox" name="datasets" '
        f'value="{html.escape(key)}" checked>'
        f'<span>{html.escape(DATASET_CONFIGS[key].display_name)}</span></label>'
        for key in DATASET_KEYS
    )


def _family_choices(
    registered: list[FamilyRecord],
) -> tuple[list[str], dict[str, str]]:
    """Build the family dropdown: built-ins, then registered, then new."""
    labels = {family: family for family in KNOWN_FAMILIES}
    choices = list(KNOWN_FAMILIES)
    for family in registered:
        if family.family_id in labels:
            continue
        choices.append(family.family_id)
        labels[family.family_id] = family.display_name
    choices.append(NEW_FAMILY)
    labels[NEW_FAMILY] = "A family not listed here"
    return choices, labels


def _submit_form(
    admin_path: str,
    registered: list[FamilyRecord],
    error: str | None = None,
) -> str:
    """Render the model submission form."""
    family_choices, family_labels = _family_choices(registered)
    flash = (
        f'<p class="flash flash--error">{html.escape(error)}</p>' if error else ""
    )
    return (
        f"{flash}"
        f'<form class="form" method="post" action="/{admin_path}/submit" '
        f'enctype="multipart/form-data">'
        f'<div class="field"><label for="model_name">Model name</label>'
        f'<input id="model_name" name="model_name" required maxlength="200" '
        f'placeholder="Claude Sonnet 4.6"></div>'
        f'<div class="field"><label for="model_family">Model family</label>'
        f'<select id="model_family" name="model_family" required>'
        f'{_options(family_choices, family_labels)}</select>'
        f'<span class="hint">Sets the leaderboard icon. Uploaded families are '
        f"added to this list."
        f"</span></div>"
        f'<div id="new-family-fields" class="new-family">'
        f'<div class="field"><label for="new_family_name">New family name</label>'
        f'<input id="new_family_name" name="new_family_name" maxlength="100" '
        f'placeholder="Qwen"></div>'
        f'<div class="field"><label for="logo">Family logo</label>'
        f'<input id="logo" name="logo" type="file" '
        f'accept=".svg,.png,.jpg,.jpeg,.webp">'
        f'<span class="hint">SVG or PNG under 2 MB. Used as the row icon on the '
        f"leaderboard when results publish."
        f"</span></div></div>"
        f'<div class="field"><label for="api_provider">Call it through</label>'
        f'<select id="api_provider" name="api_provider" required>'
        f'{_options(API_PROVIDERS)}</select></div>'
        f'<div class="field"><label for="model_api_id">Model ID at that API</label>'
        f'<input id="model_api_id" name="model_api_id" required maxlength="300" '
        f'placeholder="claude-sonnet-4-6"></div>'
        f'<fieldset class="field"><legend>Datasets</legend>'
        f'<div class="checks">{_dataset_checks()}</div></fieldset>'
        f'<div class="field"><label for="eval_scope">Evaluate on</label>'
        f'<select id="eval_scope" name="eval_scope" required>'
        f'{_options(EVAL_SCOPES, {"sample_1000": "1,000-frame sample", "full": "Every held-out frame"})}'
        f"</select></div>"
        f'<button type="submit">Queue evaluation</button>'
        f"</form>"
        f"{FORM_SCRIPT}"
    )


def _progress_cell(record: SubmissionRecord) -> str:
    """Render a progress bar with its percentage."""
    return (
        f'<div class="bar"><span style="width:{record.progress_pct}%"></span></div>'
        f"{record.progress_pct}%"
    )


def _family_options(registered: list[FamilyRecord]) -> str:
    """Render the family dropdown used to re-run a parked submission."""
    choices, labels = _family_choices(registered)
    labels[NEW_FAMILY] = "Keep uploaded logo (new family)"
    return _options(choices, labels)


def _rerun_form(
    record: SubmissionRecord,
    admin_path: str,
    registered: list[FamilyRecord],
) -> str:
    """Render the re-run control for a parked submission."""
    logo_link = (
        f'<a href="/{admin_path}/logo/{html.escape(record.submission_id)}">'
        f"logo</a> "
        if record.logo_key
        else '<span class="empty">no logo</span> '
    )
    return (
        f"{logo_link}"
        f'<form class="inline" method="post" '
        f'action="/{admin_path}/requeue/{html.escape(record.submission_id)}">'
        f'<select name="model_family" required>'
        f"{_family_options(registered)}</select>"
        f"<button type=\"submit\">Re-run</button></form>"
    )


def _submission_row(
    record: SubmissionRecord,
    admin_path: str,
    registered: list[FamilyRecord],
) -> str:
    """Render one table row for a submission."""
    colour = STATUS_COLOURS.get(record.status, "#000")
    family = record.model_family
    if record.new_family_name:
        family = f"{family} ({record.new_family_name})"

    action = (
        _rerun_form(record, admin_path, registered)
        if record.status == "rejected"
        else f"<code>{html.escape(record.run_id)}</code>"
    )

    return (
        "<tr>"
        f"<td>{html.escape(record.submitted_at)}</td>"
        f"<td>{html.escape(record.model_name)}<br>"
        f"<code>{html.escape(record.model_api_id)}</code></td>"
        f"<td>{html.escape(family)}</td>"
        f"<td>{html.escape(record.api_provider)}</td>"
        f"<td>{html.escape(record.eval_scope)}</td>"
        f"<td>{html.escape(', '.join(record.datasets))}</td>"
        f'<td class="status" style="color:{colour}">{html.escape(record.status)}</td>'
        f'<td class="num">{_progress_cell(record)}</td>'
        f'<td class="detail">{html.escape(record.status_detail)}</td>'
        f"<td>{action}</td>"
        "</tr>"
    )


def _render_page(
    records: list[SubmissionRecord],
    registered: list[FamilyRecord],
    admin_path: str,
    *,
    flash: str | None = None,
    form_error: str | None = None,
) -> str:
    """Render the whole panel: submit form, then the submissions table."""
    parked = [r for r in records if r.status == "rejected"]
    active = [r for r in records if r.status in ("queued", "running")]

    header = (
        "<tr><th>Submitted</th><th>Model</th><th>Family</th><th>API</th>"
        "<th>Scope</th><th>Datasets</th><th>Status</th><th>Progress</th>"
        "<th>Detail</th><th>Run / action</th></tr>"
    )

    if records:
        body = "".join(
            _submission_row(record, admin_path, registered) for record in records
        )
        table = f"<table><thead>{header}</thead><tbody>{body}</tbody></table>"
    else:
        table = '<p class="empty">No submissions yet.</p>'

    notice = f'<p class="flash">{html.escape(flash)}</p>' if flash else ""

    return (
        "<!doctype html><html lang=\"en\"><head><meta charset=\"utf-8\">"
        "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">"
        "<meta name=\"robots\" content=\"noindex, nofollow\">"
        "<title>Surgical eval admin</title>"
        f"<style>{PAGE_STYLE}</style></head><body><main>"
        "<h1>Surgical eval admin</h1>"
        f'<p class="lede">{len(records)} submissions &middot; {len(active)} in flight '
        f"&middot; {len(parked)} parked waiting for an icon &middot; "
        f"{len(registered)} custom famil"
        f'{"ies" if len(registered) != 1 else "y"} with icons.</p>'
        f"{notice}"
        "<h2>Submit a model</h2>"
        f"{_submit_form(admin_path, registered, form_error)}"
        "<h2>Submissions</h2>"
        f"{table}"
        "</main></body></html>"
    )


def build_admin_router(
    config: ServiceConfig, store: SubmissionStore, queue: JobQueue
) -> APIRouter:
    """Build the admin router mounted under the configured secret path."""
    router = APIRouter(
        prefix=f"/{config.admin_path}",
        dependencies=[Depends(_make_admin_guard(config))],
        include_in_schema=False,
    )

    @router.get("", response_class=HTMLResponse)
    @router.get("/", response_class=HTMLResponse)
    async def panel(request: Request) -> HTMLResponse:
        """Render the submissions panel and intake form."""
        flash = None
        notice = request.query_params.get("notice")
        if notice == "queued":
            flash = "Queued. Progress updates in the table below."
        return HTMLResponse(
            _render_page(
                store.list_all(),
                store.list_families(),
                config.admin_path,
                flash=flash,
            ),
            headers={"Cache-Control": "no-store"},
        )

    @router.post("/submit", response_model=None)
    async def submit(
        model_name: str = Form(...),
        model_family: str = Form(...),
        api_provider: str = Form(...),
        model_api_id: str = Form(...),
        eval_scope: str = Form(...),
        datasets: list[str] = Form(...),
        new_family_name: str | None = Form(default=None),
        logo: UploadFile | None = File(default=None),
    ) -> HTMLResponse | RedirectResponse:
        """Accept a model from the admin form and queue or park it."""
        empty_logo = logo is not None and not (logo.filename or "").strip()
        logo_arg = None if empty_logo else logo

        try:
            _submission_id, state, queued = await accept_submission(
                config=config,
                store=store,
                queue=queue,
                model_name=model_name,
                model_family=model_family,
                api_provider=api_provider,
                model_api_id=model_api_id,
                eval_scope=eval_scope,
                datasets=datasets,
                submitter_email=ADMIN_SUBMITTER_EMAIL,
                new_family_name=new_family_name,
                logo=logo_arg,
            )
        except ValidationError as error:
            message = "; ".join(
                f"{'.'.join(str(p) for p in item['loc'])}: {item['msg']}"
                for item in error.errors(include_url=False)
            )
            return HTMLResponse(
                _render_page(
                    store.list_all(),
                    store.list_families(),
                    config.admin_path,
                    form_error=message or "Invalid submission.",
                ),
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                headers={"Cache-Control": "no-store"},
            )
        except HTTPException as error:
            detail = error.detail if isinstance(error.detail, str) else str(error.detail)
            return HTMLResponse(
                _render_page(
                    store.list_all(),
                    store.list_families(),
                    config.admin_path,
                    form_error=detail,
                ),
                status_code=error.status_code,
                headers={"Cache-Control": "no-store"},
            )

        notice = "queued" if queued else "parked"
        LOGGER.info("admin form submission=%s status=%s", _submission_id, state)
        return RedirectResponse(
            url=f"/{config.admin_path}/?notice={notice}",
            status_code=status.HTTP_303_SEE_OTHER,
        )

    @router.get("/logo/{submission_id}")
    async def logo(submission_id: str) -> Response:
        """Download the logo uploaded with a new-family submission."""
        record = store.get(submission_id)
        if record is None or record.logo_key is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"No logo stored for submission {submission_id!r}",
            )

        suffix = PurePosixPath(record.logo_key).suffix.lower()
        client = S3Client.from_config(config)
        try:
            payload = client.get_bytes(record.logo_key)
        except MissingObjectError as error:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail=str(error)
            ) from error

        return Response(
            content=payload,
            media_type=MEDIA_TYPES.get(suffix, "application/octet-stream"),
            headers={
                "Content-Disposition": (
                    f'attachment; filename="{slugify_model_id(record.model_name)}{suffix}"'
                ),
                "Content-Security-Policy": "default-src 'none'; sandbox",
                "X-Content-Type-Options": "nosniff",
                "Cache-Control": "no-store",
            },
        )

    @router.get("/family-logo/{family_id}")
    async def family_logo(family_id: str) -> Response:
        """Serve the icon for a registered custom family."""
        family = store.get_family(family_id)
        if family is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Unknown family {family_id!r}",
            )

        suffix = PurePosixPath(family.logo_key).suffix.lower()
        client = S3Client.from_config(config)
        try:
            payload = client.get_bytes(family.logo_key)
        except MissingObjectError as error:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail=str(error)
            ) from error

        return Response(
            content=payload,
            media_type=MEDIA_TYPES.get(suffix, "application/octet-stream"),
            headers={
                "Content-Security-Policy": "default-src 'none'; img-src 'self' data:; sandbox",
                "X-Content-Type-Options": "nosniff",
                "Cache-Control": "private, max-age=3600",
            },
        )

    @router.post("/requeue/{submission_id}")
    async def requeue(
        submission_id: str, model_family: str = Form(...)
    ) -> RedirectResponse:
        """Re-run a parked submission under a family that now has an icon."""
        record = store.get(submission_id)
        if record is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Unknown submission {submission_id!r}",
            )

        registered = {
            family.family_id: family for family in store.list_families()
        }
        if (
            model_family != NEW_FAMILY
            and model_family not in FAMILY_TO_WEBSITE_PROVIDER
            and model_family not in registered
        ):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unknown family {model_family!r}.",
            )

        logo_key = record.logo_key
        if model_family in registered and logo_key is None:
            logo_key = registered[model_family].logo_key

        submission = Submission(
            submission_id=record.submission_id,
            model_name=record.model_name,
            model_family=model_family,
            new_family_name=record.new_family_name,
            api_provider=record.api_provider,
            model_api_id=record.model_api_id,
            eval_scope=record.eval_scope,
            datasets=record.datasets,
            submitter_email=record.submitter_email,
            submitted_at=record.submitted_at,
        )
        job = build_job_spec(submission)
        if logo_key is not None:
            job = job.model_copy(update={"logo_key": logo_key})

        try:
            queue.enqueue(job)
        except QueueError as error:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT, detail=str(error)
            ) from error

        store.mark_requeued(
            submission_id,
            model_family=model_family,
            run_id=job.run_id,
            detail=f"Re-queued by a maintainer as {model_family}.",
        )
        LOGGER.info(
            "admin re-queued submission=%s as family=%s run=%s",
            submission_id, model_family, job.run_id,
        )
        return RedirectResponse(
            url=f"/{config.admin_path}/", status_code=status.HTTP_303_SEE_OTHER
        )

    return router
