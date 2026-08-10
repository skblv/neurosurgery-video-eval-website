"""Scoring.

Both headline metrics are defined exactly as in the published eval scripts:

* Exact-match accuracy — the share of scored frames whose predicted instrument
  set equals the ground-truth set, with a seed-42 bootstrap 95% interval.
  Parse errors and refusals count as wrong (empty prediction); technical skips
  are excluded from the denominator entirely.
* Micro-averaged F1 — ``2*sum(TP) / (2*sum(TP) + sum(FP) + sum(FN))`` pooled
  over every instrument decision on every scored frame, with a seed-42
  bootstrap 95% interval built the same way.

The published scripts write per-tool precision/recall/F1 but never pooled the
counts into a micro-F1 column, so ``micro_f1_pct`` is computed here from the
same per-tool counters the site's published micro-F1 numbers were derived from.

Both intervals use one procedure: i.i.d. frame resampling with replacement,
B=1000, percentile bounds, ``random.Random(42)``, unstratified. Micro-F1 is
recomputed from TP/FP/FN pooled across each resample, never by averaging
per-frame F1 values. This deliberately ignores within-video temporal
correlation. A clustered bootstrap would give intervals three to four times
wider, which would make the micro-F1 whiskers incomparable to the exact-match
whiskers drawn beside them in the same chart.
"""

from __future__ import annotations

import random
from dataclasses import dataclass, field

from runner.config import BOOTSTRAP_CONFIDENCE, BOOTSTRAP_SAMPLES, RANDOM_SEED

SCORED_STATUSES = ("success", "parse_error", "refusal")


def bootstrap_ci(
    correct_array: list[int],
    n_bootstrap: int = BOOTSTRAP_SAMPLES,
    confidence: float = BOOTSTRAP_CONFIDENCE,
    seed: int = RANDOM_SEED,
) -> tuple[float, float]:
    """Compute a bootstrap confidence interval for accuracy.

    Frames are temporally correlated — consecutive frames from one procedure may
    be seconds apart — so an i.i.d. parametric interval would be too narrow.

    Args:
        correct_array: 0/1 values indicating correct predictions.
        n_bootstrap: Number of bootstrap resamples.
        confidence: Confidence level.
        seed: Random seed for reproducibility.

    Returns:
        ``(ci_lower, ci_upper)`` as proportions in [0, 1].
    """
    if len(correct_array) == 0:
        return 0.0, 0.0

    rng = random.Random(seed)
    n = len(correct_array)
    bootstrap_means = []

    for _ in range(n_bootstrap):
        sample = [rng.choice(correct_array) for _ in range(n)]
        bootstrap_means.append(sum(sample) / n)

    bootstrap_means.sort()
    alpha = 1 - confidence
    lower_idx = int(n_bootstrap * (alpha / 2))
    upper_idx = int(n_bootstrap * (1 - alpha / 2))

    return bootstrap_means[lower_idx], bootstrap_means[upper_idx]


@dataclass(frozen=True)
class FrameCounts:
    """Instrument decisions on one frame, pooled over the tool vocabulary.

    The resampling unit for the micro-F1 bootstrap is the frame, so each frame's
    contribution to the pooled confusion matrix is kept as a single record.

    Attributes:
        tp: Tools correctly reported present.
        fp: Tools reported present that were absent.
        fn: Tools present that were not reported.
    """

    tp: int
    fp: int
    fn: int


def bootstrap_micro_f1_ci(
    frame_counts: list[FrameCounts],
    n_bootstrap: int = BOOTSTRAP_SAMPLES,
    confidence: float = BOOTSTRAP_CONFIDENCE,
    seed: int = RANDOM_SEED,
) -> tuple[float, float]:
    """Compute a percentile bootstrap interval for micro-averaged F1.

    Frames are resampled i.i.d. with replacement and micro-F1 is recomputed from
    the pooled TP/FP/FN of each resample. Averaging per-frame F1 values instead
    would estimate a different quantity — the mean of a ratio rather than the
    ratio of sums — and would not match the point estimate.

    The draw pattern mirrors :func:`bootstrap_ci` exactly, one ``choice`` call
    per frame per replicate, so both intervals on the leaderboard come from the
    same RNG stream and the same procedure.

    Args:
        frame_counts: Per-frame confusion counts over the scored frames.
        n_bootstrap: Number of bootstrap resamples.
        confidence: Confidence level.
        seed: Random seed for reproducibility.

    Returns:
        ``(ci_lower, ci_upper)`` as proportions in [0, 1].
    """
    if len(frame_counts) == 0:
        return 0.0, 0.0

    rng = random.Random(seed)
    n = len(frame_counts)
    bootstrap_scores = []

    for _ in range(n_bootstrap):
        total_tp = 0
        total_fp = 0
        total_fn = 0
        for _ in range(n):
            counts = rng.choice(frame_counts)
            total_tp += counts.tp
            total_fp += counts.fp
            total_fn += counts.fn
        denominator = 2 * total_tp + total_fp + total_fn
        bootstrap_scores.append(
            2 * total_tp / denominator if denominator > 0 else 0.0
        )

    bootstrap_scores.sort()
    alpha = 1 - confidence
    lower_idx = int(n_bootstrap * (alpha / 2))
    upper_idx = int(n_bootstrap * (1 - alpha / 2))

    return bootstrap_scores[lower_idx], bootstrap_scores[upper_idx]


@dataclass
class ToolCounters:
    """Confusion-matrix counters for one instrument class."""

    tp: int = 0
    fp: int = 0
    fn: int = 0
    tn: int = 0
    gt: int = 0
    pred: int = 0

    @property
    def precision(self) -> float:
        """Precision, or 0.0 when the model never predicted this tool."""
        denominator = self.tp + self.fp
        return self.tp / denominator if denominator > 0 else 0.0

    @property
    def recall(self) -> float:
        """Recall, or 0.0 when the tool never appears in the ground truth."""
        denominator = self.tp + self.fn
        return self.tp / denominator if denominator > 0 else 0.0

    @property
    def f1(self) -> float:
        """Per-tool F1, or 0.0 when precision and recall are both zero."""
        denominator = self.precision + self.recall
        if denominator == 0:
            return 0.0
        return 2 * self.precision * self.recall / denominator

    @property
    def accuracy(self) -> float:
        """Per-tool accuracy over all scored frames."""
        total = self.tp + self.fp + self.fn + self.tn
        return (self.tp + self.tn) / total if total > 0 else 0.0


@dataclass
class ScoredFrame:
    """One frame after scoring.

    Attributes:
        frame_id: Manifest frame path, used as the stable row key.
        ground_truth_tools: Instruments actually present.
        predicted_tools: Instruments the model reported, after validation.
        status: One of "success", "parse_error", "refusal", "skip".
        exact_match: Whether the predicted set equals the ground-truth set.
        refusal_category: Provider refusal category, when exposed.
        refusal_explanation: Provider refusal explanation, when exposed.
    """

    frame_id: str
    ground_truth_tools: list[str]
    predicted_tools: list[str]
    status: str
    exact_match: bool
    refusal_category: str | None
    refusal_explanation: str | None


@dataclass
class DatasetMetrics:
    """Aggregate metrics for one model on one dataset."""

    dataset: str
    total_sampled: int
    total_scored: int
    skipped_technical: int
    parse_failures: int
    refusals: int
    exact_match_pct: float
    exact_match_ci_low_pct: float
    exact_match_ci_high_pct: float
    exact_match_excl_refusals_pct: float
    refusal_rate_pct: float
    micro_f1_pct: float
    micro_f1_ci_low_pct: float
    micro_f1_ci_high_pct: float
    micro_true_positives: int
    micro_false_positives: int
    micro_false_negatives: int
    total_prompt_tokens: int
    total_completion_tokens: int
    calls_with_usage: int
    scored_frames: list[ScoredFrame] = field(default_factory=list)
    tool_counters: dict[str, ToolCounters] = field(default_factory=dict)


def _usage_tokens(usage: dict[str, int]) -> tuple[int, int]:
    """Normalise a provider usage dict to ``(prompt_tokens, completion_tokens)``.

    Anthropic reports ``input_tokens``/``output_tokens`` while OpenAI-compatible
    endpoints report ``prompt_tokens``/``completion_tokens``.
    """
    prompt = usage.get("prompt_tokens", usage.get("input_tokens", 0)) or 0
    completion = usage.get("completion_tokens", usage.get("output_tokens", 0)) or 0
    return prompt, completion


def score_dataset(
    dataset: str,
    frame_outcomes: dict[str, dict],
    frame_ids: list[str],
    valid_tools: list[str],
) -> DatasetMetrics:
    """Aggregate per-frame outcomes into the leaderboard metrics.

    Args:
        dataset: Dataset key, used for the summary row.
        frame_outcomes: Per-frame records keyed by frame id. Each record carries
            ``ground_truth_tools``, ``predicted_tools``, ``status`` and ``usage``.
        frame_ids: Frames that were sampled, defining the denominator. Lookups go
            through the dict so a missing frame fails loudly instead of shifting
            every subsequent row.
        valid_tools: The dataset's instrument vocabulary.

    Returns:
        The aggregated metrics, including the per-frame rows for results.csv.

    Raises:
        KeyError: If a sampled frame has no recorded outcome.
    """
    tool_counters = {tool: ToolCounters() for tool in valid_tools}
    scored_frames: list[ScoredFrame] = []
    frame_counts: list[FrameCounts] = []

    skipped_technical = 0
    parse_failures = 0
    refusals = 0
    exact_match_flags: list[int] = []
    exact_match_flags_no_refusal: list[int] = []
    total_prompt_tokens = 0
    total_completion_tokens = 0
    calls_with_usage = 0

    for frame_id in frame_ids:
        if frame_id not in frame_outcomes:
            raise KeyError(
                f"{dataset}: no recorded outcome for sampled frame {frame_id!r}"
            )
        record = frame_outcomes[frame_id]

        usage = record.get("usage") or {}
        if usage:
            prompt_tokens, completion_tokens = _usage_tokens(usage)
            total_prompt_tokens += prompt_tokens
            total_completion_tokens += completion_tokens
            calls_with_usage += 1

        status = record["status"]
        if status == "skip":
            skipped_technical += 1
            continue

        ground_truth_tools = record["ground_truth_tools"]
        if status == "parse_error":
            parse_failures += 1
            predicted_tools: list[str] = []
        elif status == "refusal":
            refusals += 1
            predicted_tools = []
        else:
            predicted_tools = record["predicted_tools"]

        exact_match = set(predicted_tools) == set(ground_truth_tools)
        exact_match_flags.append(1 if exact_match else 0)
        if status != "refusal":
            exact_match_flags_no_refusal.append(1 if exact_match else 0)

        ground_truth_set = set(ground_truth_tools)
        predicted_set = set(predicted_tools)
        frame_tp = 0
        frame_fp = 0
        frame_fn = 0
        for tool in valid_tools:
            in_gt = tool in ground_truth_set
            in_pred = tool in predicted_set
            counters = tool_counters[tool]
            if in_gt:
                counters.gt += 1
            if in_pred:
                counters.pred += 1
            if in_gt and in_pred:
                counters.tp += 1
                frame_tp += 1
            elif in_pred and not in_gt:
                counters.fp += 1
                frame_fp += 1
            elif in_gt and not in_pred:
                counters.fn += 1
                frame_fn += 1
            else:
                counters.tn += 1

        frame_counts.append(FrameCounts(tp=frame_tp, fp=frame_fp, fn=frame_fn))

        scored_frames.append(
            ScoredFrame(
                frame_id=frame_id,
                ground_truth_tools=ground_truth_tools,
                predicted_tools=predicted_tools,
                status=status,
                exact_match=exact_match,
                refusal_category=record.get("refusal_category"),
                refusal_explanation=record.get("refusal_explanation"),
            )
        )

    n_scored = len(exact_match_flags)
    n_scored_no_refusal = len(exact_match_flags_no_refusal)

    exact_match_pct = (
        sum(exact_match_flags) / n_scored * 100 if n_scored > 0 else 0.0
    )
    exact_match_excl_refusals_pct = (
        sum(exact_match_flags_no_refusal) / n_scored_no_refusal * 100
        if n_scored_no_refusal > 0
        else 0.0
    )
    ci_low, ci_high = bootstrap_ci(exact_match_flags)

    micro_tp = sum(counters.tp for counters in tool_counters.values())
    micro_fp = sum(counters.fp for counters in tool_counters.values())
    micro_fn = sum(counters.fn for counters in tool_counters.values())
    micro_denominator = 2 * micro_tp + micro_fp + micro_fn
    micro_f1_pct = (
        2 * micro_tp / micro_denominator * 100 if micro_denominator > 0 else 0.0
    )
    micro_ci_low, micro_ci_high = bootstrap_micro_f1_ci(frame_counts)

    return DatasetMetrics(
        dataset=dataset,
        total_sampled=len(frame_ids),
        total_scored=n_scored,
        skipped_technical=skipped_technical,
        parse_failures=parse_failures,
        refusals=refusals,
        exact_match_pct=exact_match_pct,
        exact_match_ci_low_pct=ci_low * 100,
        exact_match_ci_high_pct=ci_high * 100,
        exact_match_excl_refusals_pct=exact_match_excl_refusals_pct,
        refusal_rate_pct=refusals / n_scored * 100 if n_scored > 0 else 0.0,
        micro_f1_pct=micro_f1_pct,
        micro_f1_ci_low_pct=micro_ci_low * 100,
        micro_f1_ci_high_pct=micro_ci_high * 100,
        micro_true_positives=micro_tp,
        micro_false_positives=micro_fp,
        micro_false_negatives=micro_fn,
        total_prompt_tokens=total_prompt_tokens,
        total_completion_tokens=total_completion_tokens,
        calls_with_usage=calls_with_usage,
        scored_frames=scored_frames,
        tool_counters=tool_counters,
    )
