"""Checks for the admin-only intake panel.

Runs against a temporary state directory with S3 stubbed out.
"""

from __future__ import annotations

import base64
import os
import tempfile
from pathlib import Path

STATE_DIR = Path(tempfile.mkdtemp(prefix="svc-eval-admin-"))

ADMIN_PATH = "panel-test-path"
ADMIN_PASSWORD = "test-admin-password"

os.environ.update(
    SVC_EVAL_STATE_DIR=str(STATE_DIR),
    SVC_EVAL_LOG_DIR=str(STATE_DIR / "log"),
    ADMIN_PANEL_PATH=ADMIN_PATH,
    ADMIN_PASSWORD=ADMIN_PASSWORD,
    WEBHOOK_SHARED_SECRET="test-shared-secret",
    S3_UNSIGNED="true",
)

from fastapi.testclient import TestClient  # noqa: E402

from webhook import admin as admin_module  # noqa: E402
from webhook import app as app_module  # noqa: E402
from webhook import intake as intake_module  # noqa: E402

UPLOADED: dict[str, bytes] = {}


class FakeS3:
    @classmethod
    def from_config(cls, _config) -> "FakeS3":
        return cls()

    def put_bytes(self, key: str, payload: bytes, content_type: str) -> str:
        UPLOADED[key] = payload
        return f"s3://test-bucket/{key}"

    def get_bytes(self, key: str) -> bytes:
        return UPLOADED[key]


admin_module.S3Client = FakeS3
intake_module.S3Client = FakeS3


class FakeChoice:
    effective_provider = "openai"
    effective_model_api_id = "gpt-admin"
    fallback_reason = None


def fake_verify(api_provider, model_api_id, config):
    choice = FakeChoice()
    choice.effective_provider = api_provider
    choice.effective_model_api_id = model_api_id
    return choice


intake_module.verify_model_available = fake_verify

CLIENT = TestClient(app_module.app)
AUTH = {
    "Authorization": "Basic "
    + base64.b64encode(f"admin:{ADMIN_PASSWORD}".encode()).decode()
}


def check(label: str, condition: bool, extra: str = "") -> None:
    if not condition:
        raise AssertionError(f"{label} FAILED {extra}")
    print(f"ok   {label}")


def main() -> None:
    check("healthz", CLIENT.get("/healthz").status_code == 200)
    check("public submit gone", CLIENT.post("/public/submissions").status_code == 404)
    check("public status gone", CLIENT.get("/public/runs/x").status_code == 404)
    check("admin needs auth", CLIENT.get(f"/{ADMIN_PATH}/").status_code == 401)

    panel = CLIENT.get(f"/{ADMIN_PATH}/", headers=AUTH)
    check("admin panel renders", panel.status_code == 200, panel.text[:200])
    check("panel has submit form", 'action="/' + ADMIN_PATH + '/submit"' in panel.text)
    production_admin_path = os.environ.get("PROD_ADMIN_PANEL_PATH", "prod-admin-path-placeholder")
    check("secret path not in public site contract", production_admin_path not in panel.text)

    bad = CLIENT.post(
        f"/{ADMIN_PATH}/submit",
        data={
            "model_name": "X",
            "model_family": "openai",
            "api_provider": "openai",
            "model_api_id": "gpt-x",
            "eval_scope": "sample_1000",
            "datasets": ["nosuch"],
        },
        headers=AUTH,
    )
    check("bad dataset rejected", bad.status_code == 422, bad.text)

    accepted = CLIENT.post(
        f"/{ADMIN_PATH}/submit",
        data={
            "model_name": "Admin Model",
            "model_family": "openai",
            "api_provider": "openai",
            "model_api_id": "gpt-admin",
            "eval_scope": "sample_1000",
            "datasets": ["cholect50"],
        },
        headers=AUTH,
        follow_redirects=False,
    )
    check("submit redirects", accepted.status_code == 303, accepted.text)
    check("notice=queued", "notice=queued" in accepted.headers.get("location", ""))

    after = CLIENT.get(f"/{ADMIN_PATH}/?notice=queued", headers=AUTH)
    check("table lists model", "Admin Model" in after.text)

    parked = CLIENT.post(
        f"/{ADMIN_PATH}/submit",
        data={
            "model_name": "Qwen Admin",
            "model_family": "new_family",
            "new_family_name": "Qwen",
            "api_provider": "openrouter",
            "model_api_id": "qwen/x",
            "eval_scope": "sample_1000",
            "datasets": ["cholect50"],
        },
        files={"logo": ("qwen.svg", b"<svg/>", "image/svg+xml")},
        headers=AUTH,
        follow_redirects=False,
    )
    check("new family queues", parked.status_code == 303, parked.text)
    check("notice=queued", "notice=queued" in parked.headers.get("location", ""))
    check("logo stored", len(UPLOADED) == 1, str(list(UPLOADED)))
    counts = CLIENT.get("/healthz").json()["queue"]
    check("two jobs pending", counts["pending"] == 2, str(counts))

    after_family = CLIENT.get(f"/{ADMIN_PATH}/", headers=AUTH)
    check(
        "qwen listed as family option",
        'value="qwen"' in after_family.text,
        after_family.text,
    )
    check(
        "submission stored under qwen family",
        ">qwen (Qwen)<" in after_family.text or ">qwen<" in after_family.text,
        after_family.text,
    )

    print(f"\nAll checks passed. State dir: {STATE_DIR}")


if __name__ == "__main__":
    main()
