"""Logging configuration shared by the CLI, the webhook and the worker.

Records go to both a rotating file and stderr: the file satisfies the operational
requirement to keep logs on the instance, and stderr keeps them visible in
``journalctl`` when systemd runs the service.
"""

from __future__ import annotations

import logging
import sys
from logging.handlers import RotatingFileHandler
from pathlib import Path

LOG_FORMAT = "%(asctime)s %(levelname)-8s %(name)s %(message)s"
LOG_DATE_FORMAT = "%Y-%m-%dT%H:%M:%S%z"
MAX_BYTES = 32 * 1024 * 1024
BACKUP_COUNT = 5


def configure_logging(log_dir: Path, component: str, level: int = logging.INFO) -> None:
    """Attach file and stderr handlers to the root logger.

    Args:
        log_dir: Directory for log files; created if absent.
        component: Log file base name, e.g. "webhook" or "worker".
        level: Minimum level to emit.
    """
    log_dir.mkdir(parents=True, exist_ok=True)
    formatter = logging.Formatter(LOG_FORMAT, datefmt=LOG_DATE_FORMAT)

    file_handler = RotatingFileHandler(
        log_dir / f"{component}.log", maxBytes=MAX_BYTES, backupCount=BACKUP_COUNT,
    )
    file_handler.setFormatter(formatter)

    stream_handler = logging.StreamHandler(sys.stderr)
    stream_handler.setFormatter(formatter)

    root = logging.getLogger()
    root.setLevel(level)
    root.handlers.clear()
    root.addHandler(file_handler)
    root.addHandler(stream_handler)

    # The provider SDKs log every request at INFO, which drowns the eval progress.
    for noisy in ("httpx", "httpcore", "botocore", "boto3", "urllib3", "s3transfer"):
        logging.getLogger(noisy).setLevel(logging.WARNING)
