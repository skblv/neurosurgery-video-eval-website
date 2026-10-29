import rawGestureResults from "./gestureResults.json";
import type { LeaderboardBenchmark, LeaderboardMetric } from "./leaderboard";
import { isLeaderboardModelVisible } from "./leaderboardVisibility";
import {
  GESTURE_METRIC_ORDER,
  parseGestureResultsFile,
  type GestureMetricId,
} from "./gestureResultsSchema";

export { GESTURE_METRIC_ORDER };
export type { GestureMetricId };

export const GESTURE_METRICS: Record<GestureMetricId, LeaderboardMetric<GestureMetricId>> = {
  exactAccuracy: {
    id: "exactAccuracy",
    label: "Exact frame accuracy",
    axisLabel: "Exact frame accuracy (%)",
    captionName: "exact frame accuracy",
  },
  macroF1: {
    id: "macroF1",
    label: "Macro F1",
    axisLabel: "Macro F1 (%)",
    captionName: "macro F1",
  },
  weightedF1: {
    id: "weightedF1",
    label: "Weighted F1",
    axisLabel: "Weighted F1 (%)",
    captionName: "weighted F1",
  },
};

const parsed = parseGestureResultsFile(rawGestureResults);

// The Actions leaderboard is the high-thinking-effort comparison supplied for
// this release. Specialist references and older low-thinking runs remain in
// the source dataset for summary scoring and provenance, but are not mixed
// into this leaderboard.
const HIGH_THINKING_ACTION_IDS = new Set([
  "claude-fable-5_1",
  "gpt-5_6-terra",
  "gemini-4-argon",
  "gemini-3_7-flash",
  "claude-opus-5",
  "claude-fable-5",
  "gemini-3_8-flash",
  "gpt-5-6-sol",
  "gemini-3-flash-preview",
  "gemini-3_1-pro",
  "gpt-5_4",
  "claude-sonnet-5",
  "claude-opus-4_6",
  "claude-sonnet-4_6",
]);

export const GESTURE_BENCHMARK: LeaderboardBenchmark<GestureMetricId> &
  Omit<typeof parsed.benchmark, "results"> = {
  ...parsed.benchmark,
  majorityBaseline: {
    exactAccuracy: null,
    macroF1: null,
    weightedF1: null,
  },
  results: parsed.benchmark.results.filter(isLeaderboardModelVisible),
};

export const GESTURE_LEADERBOARD: LeaderboardBenchmark<GestureMetricId> &
  Omit<typeof parsed.benchmark, "results"> = {
  ...GESTURE_BENCHMARK,
  results: GESTURE_BENCHMARK.results.filter(({ id }) => HIGH_THINKING_ACTION_IDS.has(id) || id === "mvit-multi-task"),
};

export const GESTURE_RESULTS_GENERATED_AT = parsed.generatedAt;
