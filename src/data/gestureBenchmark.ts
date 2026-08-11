import rawGestureResults from "./gestureResults.json";
import type { LeaderboardBenchmark, LeaderboardMetric } from "./leaderboard";
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

export const GESTURE_BENCHMARK: LeaderboardBenchmark<GestureMetricId> &
  Omit<typeof parsed.benchmark, "results"> = {
  ...parsed.benchmark,
  majorityBaseline: {
    exactAccuracy: null,
    macroF1: null,
    weightedF1: null,
  },
  results: parsed.benchmark.results,
};

export const GESTURE_RESULTS_GENERATED_AT = parsed.generatedAt;

export const GESTURE_SOURCES = [
  {
    label: "SurgMotion",
    url: "https://arxiv.org/abs/2602.05638",
  },
  {
    label: "LEMON",
    url: "https://openaccess.thecvf.com/content/CVPR2026/html/Che_LEMON_A_Large_Endoscopic_MONocular_Dataset_and_Foundation_Model_for_CVPR_2026_paper.html",
  },
  {
    label: "GPT-5.6 Sol",
    url: "https://openai.com/index/previewing-gpt-5-6-sol/",
  },
  {
    label: "Kimi K3",
    url: "https://github.com/MoonshotAI/Kimi-K3",
  },
  {
    label: "Claude Opus 5",
    url: "https://www.anthropic.com/system-cards",
  },
] as const;
