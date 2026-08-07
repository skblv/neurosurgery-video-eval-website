/**
 * Display configuration for the leaderboard, joined to the generated results.
 *
 * Everything here is hand-maintained: labels, metric wording, dataset prose and
 * citation. The numbers themselves live in `results.json`, which the eval runner
 * overwrites; see `resultsSchema.ts` for the contract it must satisfy.
 */

import rawResults from "./results.json";
import { DATASET_ORDER, METRIC_ORDER, parseResultsFile } from "./resultsSchema";
import type { DatasetId, MetricId, MetricValue, ModelResult, Provider } from "./resultsSchema";

export { DATASET_ORDER, METRIC_ORDER };
export type { DatasetId, MetricId, MetricValue, ModelResult, Provider };

export const PROVIDER_LABELS: Record<Provider, string> = {
  internal: "Surgical Data Science Collective × Chicago Booth",
  openai: "OpenAI",
  anthropic: "Anthropic",
  gemini: "Google DeepMind",
  google: "Google",
  moonshot: "Moonshot AI",
};

export interface Metric {
  id: MetricId;
  /** Dropdown and table-column wording. */
  label: string;
  axisLabel: string;
  /** Sentence-cased noun phrase used inside the figure caption. */
  captionName: string;
  /** One-line gloss shown parenthetically in the caption. */
  definition: string;
}

export const METRICS: Record<MetricId, Metric> = {
  exactMatch: {
    id: "exactMatch",
    label: "Exact-match accuracy",
    axisLabel: "Exact-match accuracy (%)",
    captionName: "exact-match accuracy",
    definition: "share of frames where the predicted instrument set exactly matches the ground truth",
  },
  microF1: {
    id: "microF1",
    label: "Micro-averaged F1",
    axisLabel: "Micro-averaged F1 (%)",
    captionName: "micro-averaged F1",
    definition: "harmonic mean of precision and recall pooled over every instrument decision",
  },
};

export interface Dataset {
  id: DatasetId;
  name: string;
  toolClasses: number;
  majorityBaseline: Record<MetricId, number | null>;
  sourceUrl: string;
  results: ModelResult[];
}

type DatasetMeta = Omit<Dataset, "majorityBaseline" | "results">;

const DATASET_META: Record<DatasetId, DatasetMeta> = {
  cholect50: {
    id: "cholect50",
    name: "CholecT50",
    toolClasses: 6,
    sourceUrl: "https://github.com/CAMMA-public/cholect50",
  },
  pitvis: {
    id: "pitvis",
    name: "PitVis-2023",
    toolClasses: 18,
    sourceUrl:
      "https://rdr.ucl.ac.uk/articles/dataset/PitVis_Challenge_Endoscopic_Pituitary_Surgery_videos/26531686",
  },
  surgvu: {
    id: "surgvu",
    name: "SurgVU",
    toolClasses: 17,
    sourceUrl: "https://arxiv.org/abs/2501.09209",
  },
};

export const BAR_COLOR = "#0F766E";

const RESULTS = parseResultsFile(rawResults);

export const RESULTS_GENERATED_AT = RESULTS.generatedAt;

export const DATASETS: Dataset[] = DATASET_ORDER.map((datasetId) => ({
  ...DATASET_META[datasetId],
  majorityBaseline: RESULTS.datasets[datasetId].majorityBaseline,
  results: RESULTS.datasets[datasetId].results,
}));

export const PAPER = {
  title:
    "A Comparative Study in Surgical AI: Potential and Limitations of Data, Compute, and Scaling",
  authorsShort: "Skobelev, K., Fithian, E., Baranovski, Y., et al.",
  arxivId: "arXiv:2603.27341",
  url: "https://arxiv.org/abs/2603.27341",
  year: 2026,
} as const;
