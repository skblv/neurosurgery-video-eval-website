"""S3 access for dataset manifests, frame streaming, and result upload.

The eval instance has a 40 GiB disk and the three datasets total roughly 151 GiB,
so frames are never materialised as a local corpus. Each worker thread pulls one
object into memory, base64-encodes it for the API call, and drops it — peak
footprint is bounded by ``num_workers`` frames, a few megabytes.
"""

from __future__ import annotations

import csv
import io
import json
import logging
from dataclasses import dataclass
from pathlib import Path, PurePosixPath

import boto3
from botocore import UNSIGNED
from botocore.config import Config
from botocore.exceptions import ClientError, NoCredentialsError

from runner.config import AWS_REGION, S3_BUCKET, S3_RESULTS_PREFIX, ServiceConfig
from runner.metrics import DatasetMetrics

LOGGER = logging.getLogger(__name__)

# Retries are handled by botocore; the pool must cover every eval worker or
# threads serialise on connection checkout.
MAX_POOL_CONNECTIONS = 64
BOTO_MAX_ATTEMPTS = 8


class MissingObjectError(RuntimeError):
    """Raised when a required S3 object does not exist."""


class S3AuthModeError(RuntimeError):
    """Raised when a request fails in a way the configured auth mode explains."""


@dataclass
class S3Client:
    """Thin wrapper over the bucket used by the eval pipeline.

    The signing mode is configuration, never inference. Hosts with an instance
    role sign normally; hosts without one — where the bucket policy grants
    access by source IP instead — must set ``S3_UNSIGNED=true``. The client
    deliberately does not probe for credentials and fall back, because a
    deployment that quietly switched auth mode would present as a permissions
    mystery rather than a configuration error.
    """

    bucket: str = S3_BUCKET
    region: str = AWS_REGION
    unsigned: bool = False

    def __post_init__(self) -> None:
        """Build the shared boto3 client in the configured signing mode."""
        signing_options = {"signature_version": UNSIGNED} if self.unsigned else {}
        self._client = boto3.client(
            "s3",
            region_name=self.region,
            config=Config(
                max_pool_connections=MAX_POOL_CONNECTIONS,
                retries={"max_attempts": BOTO_MAX_ATTEMPTS, "mode": "adaptive"},
                **signing_options,
            ),
        )
        LOGGER.info(
            "S3 client ready for s3://%s (%s) in %s mode",
            self.bucket, self.region, self.mode_name,
        )

    @classmethod
    def from_config(cls, config: ServiceConfig) -> S3Client:
        """Build the client from the resolved service configuration."""
        return cls(unsigned=config.s3_unsigned)

    @property
    def mode_name(self) -> str:
        """Human-readable name of the configured signing mode."""
        return "UNSIGNED" if self.unsigned else "SIGNED"

    def _auth_mode_hint(self) -> str:
        """Guidance naming the mode in force and how to change it."""
        if self.unsigned:
            return (
                "Requests are UNSIGNED because S3_UNSIGNED=true. The bucket "
                "grants access by source IP, so check the host's Elastic IP "
                "still matches the bucket policy. If an instance role has since "
                "been attached, set S3_UNSIGNED=false to sign requests."
            )
        return (
            "Requests are SIGNED because S3_UNSIGNED is false or unset, but no "
            "credentials were found. If this host has no IAM role, set "
            "S3_UNSIGNED=true in /etc/svc-eval/.env so requests go out unsigned "
            "against the IP-scoped bucket policy."
        )

    def get_bytes(self, key: str) -> bytes:
        """Read one object into memory.

        Args:
            key: Object key inside the bucket.

        Returns:
            The object's bytes.

        Raises:
            MissingObjectError: If the key does not exist.
            S3AuthModeError: If the request failed for a reason the configured
                signing mode explains.
        """
        try:
            response = self._client.get_object(Bucket=self.bucket, Key=key)
        except NoCredentialsError as error:
            raise S3AuthModeError(
                f"Could not read s3://{self.bucket}/{key}. {self._auth_mode_hint()}"
            ) from error
        except ClientError as error:
            code = error.response.get("Error", {}).get("Code", "")
            if code in ("NoSuchKey", "404"):
                raise MissingObjectError(
                    f"s3://{self.bucket}/{key} does not exist"
                ) from error
            if code in ("AccessDenied", "403", "InvalidAccessKeyId",
                        "SignatureDoesNotMatch"):
                raise S3AuthModeError(
                    f"S3 denied reading s3://{self.bucket}/{key} ({code}). "
                    f"{self._auth_mode_hint()}"
                ) from error
            raise
        return response["Body"].read()

    def put_bytes(self, key: str, payload: bytes, content_type: str) -> str:
        """Write one object.

        Args:
            key: Destination key inside the bucket.
            payload: Body bytes.
            content_type: MIME type recorded on the object.

        Returns:
            The ``s3://`` URI of the written object.

        Raises:
            S3AuthModeError: If the write failed for a reason the configured
                signing mode explains.
        """
        try:
            self._client.put_object(
                Bucket=self.bucket, Key=key, Body=payload, ContentType=content_type
            )
        except NoCredentialsError as error:
            raise S3AuthModeError(
                f"Could not write s3://{self.bucket}/{key}. {self._auth_mode_hint()}"
            ) from error
        except ClientError as error:
            code = error.response.get("Error", {}).get("Code", "")
            if code in ("AccessDenied", "403", "InvalidAccessKeyId",
                        "SignatureDoesNotMatch"):
                raise S3AuthModeError(
                    f"S3 denied writing s3://{self.bucket}/{key} ({code}). "
                    f"{self._auth_mode_hint()}"
                ) from error
            raise
        return f"s3://{self.bucket}/{key}"


def frame_suffix(s3_key: str) -> str:
    """Return the lowercase file suffix of a frame key, including the dot."""
    return PurePosixPath(s3_key).suffix.lower()


# --------------------------------------------------------------- result CSVs

RESULTS_FIELDNAMES = [
    "frame_path", "ground_truth_tools", "predicted_tools",
    "status", "exact_match", "num_ground_truth", "num_predicted",
    "refusal_category", "refusal_explanation",
]

TOOL_METRICS_FIELDNAMES = [
    "tool_name", "ground_truth_count", "predicted_count",
    "true_positives", "false_positives", "false_negatives",
    "true_negatives", "accuracy", "precision", "recall", "f1_score",
]

SUMMARY_FIELDNAMES = [
    "dataset", "model_name", "model_api_id", "api_provider_requested",
    "api_provider_used", "eval_scope", "run_id",
    "total_sampled", "total_scored", "skipped_technical",
    "parse_failures", "refusals", "refusal_rate_pct",
    "exact_match_accuracy_pct", "exact_match_ci_low_pct",
    "exact_match_ci_high_pct", "exact_match_excl_refusals_pct",
    "micro_f1_pct", "micro_true_positives", "micro_false_positives",
    "micro_false_negatives",
    "total_prompt_tokens", "total_completion_tokens", "calls_with_usage",
]


def _to_csv_bytes(fieldnames: list[str], rows: list[dict]) -> bytes:
    """Serialise rows to CSV bytes with a header."""
    buffer = io.StringIO(newline="")
    writer = csv.DictWriter(buffer, fieldnames=fieldnames)
    writer.writeheader()
    writer.writerows(rows)
    return buffer.getvalue().encode("utf-8")


def results_rows(metrics: DatasetMetrics) -> list[dict]:
    """Build the per-frame rows for results.csv."""
    return [
        {
            "frame_path": frame.frame_id,
            "ground_truth_tools": json.dumps(frame.ground_truth_tools),
            "predicted_tools": json.dumps(frame.predicted_tools),
            "status": frame.status,
            "exact_match": frame.exact_match,
            "num_ground_truth": len(frame.ground_truth_tools),
            "num_predicted": len(frame.predicted_tools),
            "refusal_category": frame.refusal_category or "",
            "refusal_explanation": frame.refusal_explanation or "",
        }
        for frame in metrics.scored_frames
    ]


def tool_metrics_rows(metrics: DatasetMetrics) -> list[dict]:
    """Build the per-instrument rows for tool_metrics.csv."""
    return [
        {
            "tool_name": tool,
            "ground_truth_count": counters.gt,
            "predicted_count": counters.pred,
            "true_positives": counters.tp,
            "false_positives": counters.fp,
            "false_negatives": counters.fn,
            "true_negatives": counters.tn,
            "accuracy": f"{counters.accuracy:.4f}",
            "precision": f"{counters.precision:.4f}",
            "recall": f"{counters.recall:.4f}",
            "f1_score": f"{counters.f1:.4f}",
        }
        for tool, counters in sorted(metrics.tool_counters.items())
    ]


def summary_row(metrics: DatasetMetrics, provenance: dict[str, str]) -> dict:
    """Build the one-line summary row for a dataset.

    Args:
        metrics: Aggregated metrics for the dataset.
        provenance: Job-level fields (model name, providers, scope, run id).

    Returns:
        A dict keyed by :data:`SUMMARY_FIELDNAMES`.
    """
    return {
        "dataset": metrics.dataset,
        "model_name": provenance["model_name"],
        "model_api_id": provenance["model_api_id"],
        "api_provider_requested": provenance["api_provider_requested"],
        "api_provider_used": provenance["api_provider_used"],
        "eval_scope": provenance["eval_scope"],
        "run_id": provenance["run_id"],
        "total_sampled": metrics.total_sampled,
        "total_scored": metrics.total_scored,
        "skipped_technical": metrics.skipped_technical,
        "parse_failures": metrics.parse_failures,
        "refusals": metrics.refusals,
        "refusal_rate_pct": f"{metrics.refusal_rate_pct:.2f}",
        "exact_match_accuracy_pct": f"{metrics.exact_match_pct:.2f}",
        "exact_match_ci_low_pct": f"{metrics.exact_match_ci_low_pct:.2f}",
        "exact_match_ci_high_pct": f"{metrics.exact_match_ci_high_pct:.2f}",
        "exact_match_excl_refusals_pct": (
            f"{metrics.exact_match_excl_refusals_pct:.2f}"
        ),
        "micro_f1_pct": f"{metrics.micro_f1_pct:.2f}",
        "micro_true_positives": metrics.micro_true_positives,
        "micro_false_positives": metrics.micro_false_positives,
        "micro_false_negatives": metrics.micro_false_negatives,
        "total_prompt_tokens": metrics.total_prompt_tokens,
        "total_completion_tokens": metrics.total_completion_tokens,
        "calls_with_usage": metrics.calls_with_usage,
    }


def upload_dataset_results(
    client: S3Client,
    run_id: str,
    metrics: DatasetMetrics,
    provenance: dict[str, str],
) -> list[str]:
    """Upload results.csv, tool_metrics.csv and summary.csv for one dataset.

    Args:
        client: Bucket wrapper.
        run_id: Run identifier; results land under ``results/<run_id>/``.
        metrics: Aggregated metrics for the dataset.
        provenance: Job-level fields for the summary row.

    Returns:
        The ``s3://`` URIs written, in upload order.
    """
    prefix = f"{S3_RESULTS_PREFIX}/{run_id}/{metrics.dataset}"
    uploads = [
        (f"{prefix}/results.csv", RESULTS_FIELDNAMES, results_rows(metrics)),
        (f"{prefix}/tool_metrics.csv", TOOL_METRICS_FIELDNAMES,
         tool_metrics_rows(metrics)),
        (f"{prefix}/summary.csv", SUMMARY_FIELDNAMES,
         [summary_row(metrics, provenance)]),
    ]

    written = []
    for key, fieldnames, rows in uploads:
        written.append(
            client.put_bytes(key, _to_csv_bytes(fieldnames, rows), "text/csv")
        )
        LOGGER.info("uploaded %s (%d rows)", written[-1], len(rows))
    return written


def upload_run_summary(
    client: S3Client,
    run_id: str,
    dataset_metrics: list[DatasetMetrics],
    provenance: dict[str, str],
) -> str:
    """Upload the run-level summary.csv covering every dataset.

    Args:
        client: Bucket wrapper.
        run_id: Run identifier.
        dataset_metrics: Metrics for each evaluated dataset.
        provenance: Job-level fields for the summary rows.

    Returns:
        The ``s3://`` URI of the run-level summary.
    """
    rows = [summary_row(metrics, provenance) for metrics in dataset_metrics]
    key = f"{S3_RESULTS_PREFIX}/{run_id}/summary.csv"
    uri = client.put_bytes(key, _to_csv_bytes(SUMMARY_FIELDNAMES, rows), "text/csv")
    LOGGER.info("uploaded %s (%d rows)", uri, len(rows))
    return uri


def upload_run_manifest(client: S3Client, run_id: str, manifest: dict) -> str:
    """Upload the run manifest describing the job and its outputs.

    Args:
        client: Bucket wrapper.
        run_id: Run identifier.
        manifest: JSON-serialisable job description.

    Returns:
        The ``s3://`` URI of the manifest.
    """
    key = f"{S3_RESULTS_PREFIX}/{run_id}/job.json"
    payload = json.dumps(manifest, indent=2, default=str).encode("utf-8")
    return client.put_bytes(key, payload, "application/json")


def local_cache_path(state_dir: Path, run_id: str, dataset: str) -> Path:
    """Path of the per-dataset JSONL response cache for a run."""
    return state_dir / "runs" / run_id / f"cache_{dataset}.jsonl"
