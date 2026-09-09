"""Exact expected metrics after uniformly permuting observed label sets across frames.

No model inference or image access. Run on a CPU allocation on Pythia.
The output contains aggregate counts and hashes, never frame paths or answers.
"""
import argparse
from collections import Counter
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path

DATASETS = ("cholect50", "pitvis", "surgvu", "dsad", "cadis", "endoscapes",
            "pitvqa", "cholect50verbs", "pitvissteps", "sarrarp50")


def fingerprint(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, ensure_ascii=False).encode()).hexdigest()


def chance_metrics(truths):
    if not truths:
        raise ValueError("Empty label sample")
    normalized = [tuple(sorted(set(labels))) for labels in truths]
    counts = Counter(label for labels in normalized for label in labels)
    sets = Counter(normalized)
    n = len(normalized)
    positives = sum(counts.values())
    # A permutation preserves the total prediction count, making the F1
    # denominator constant. E[TP] = sum(label_count^2) / n exactly.
    return {
        "sampleCount": n,
        "positiveLabelCount": positives,
        "labelCounts": dict(sorted(counts.items())),
        "labelSetCounts": [{"labels": list(labels), "count": count} for labels, count in sorted(sets.items())],
        "metrics": {
            "microF1": 100 * sum(count * count for count in counts.values()) / (n * positives) if positives else 0.0,
            "exactMatch": 100 * sum(count * count for count in sets.values()) / (n * n),
        },
        "label_sha256": fingerprint(normalized),
    }


def main():
    parser = argparse.ArgumentParser(__doc__)
    parser.add_argument("--contracts-root", type=Path, required=True)
    parser.add_argument("--destination", type=Path, required=True)
    args = parser.parse_args()
    datasets = {}
    for board in DATASETS:
        path = args.contracts_root / board / "contract.json"
        manifest = json.loads(path.read_text())
        observations = manifest["observations"]
        expected = {"cadis": 534, "endoscapes": 409, "sarrarp50": 636}.get(board, 1000)
        if manifest["dataset"] != board or len(observations) != expected:
            raise ValueError(f"{board}: unexpected frozen sample")
        ids = [row["id"] for row in observations]
        if len(set(ids)) != expected:
            raise ValueError(f"{board}: duplicate observations")
        datasets[board] = {
            **chance_metrics([row["truth"] for row in observations]),
            "sample_sha256": fingerprint(ids),
            "source": f"{args.contracts_root.parent.name}/{args.contracts_root.name}/{board}/contract.json",
            "source_sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
        }
    result = {
        "schemaVersion": 1,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "method": "Exact expectation over uniformly random permutations of the observed ground-truth label sets, including fixed points; one fixed baseline per dataset.",
        "sampling": "Same frozen seed-42 validation sample used by completed API evaluations: at most 1000 frames, or the full validation set when smaller.",
        "datasets": datasets,
    }
    args.destination.parent.mkdir(parents=True, exist_ok=True)
    args.destination.write_text(json.dumps(result, indent=2) + "\n")
    print(json.dumps({board: row["metrics"] for board, row in datasets.items()}, indent=2))


if __name__ == "__main__":
    main()
