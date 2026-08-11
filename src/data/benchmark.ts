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

const KNOWN_PROVIDER_LABELS: Record<string, string> = {
  internal: "Surgical Data Science Collective × Chicago Booth",
  openai: "OpenAI",
  anthropic: "Anthropic",
  gemini: "Google DeepMind",
  google: "Google",
  moonshot: "Moonshot AI",
  surgmotion: "SurgMotion",
  visurg: "Visurg AI",
};

/** Display name for a provider id; unknown slugs are title-cased. */
export function providerLabel(provider: Provider): string {
  return (
    KNOWN_PROVIDER_LABELS[provider] ??
    provider.replace(/(^|-)([a-z])/g, (_, sep: string, ch: string) =>
      `${sep === "-" ? " " : ""}${ch.toUpperCase()}`,
    )
  );
}

/** @deprecated Prefer {@link providerLabel}; kept for call sites that index by known ids. */
export const PROVIDER_LABELS = KNOWN_PROVIDER_LABELS as Record<Provider, string>;

export interface Metric {
  id: MetricId;
  /** Dropdown and table-column wording. */
  label: string;
  axisLabel: string;
  /** Sentence-cased noun phrase used inside the figure caption. */
  captionName: string;
}

export const METRICS: Record<MetricId, Metric> = {
  exactMatch: {
    id: "exactMatch",
    label: "Exact-match accuracy",
    axisLabel: "Exact-match accuracy (%)",
    captionName: "exact-match accuracy",
  },
  microF1: {
    id: "microF1",
    label: "Micro-averaged F1",
    axisLabel: "Micro-averaged F1 (%)",
    captionName: "micro-averaged F1",
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

export interface DatasetCitation {
  datasetName: string;
  authorsShort: string;
  title: string;
  venue: string;
  linkLabel: string;
  url: string;
  year: number;
}

export interface ModelCitation {
  /** Result id in results.json this citation belongs to. */
  modelId: string;
  authorsShort: string;
  title: string;
  venue: string;
  linkLabel: string;
  url: string;
  year: number;
}

export const MODEL_CITATIONS: ModelCitation[] = [
  {
    modelId: "lemonfm-linear-probe",
    authorsShort: "Che, C., Wang, C., Vercauteren, T., et al.",
    title:
      "LEMON: A Large Endoscopic MONocular Dataset and Foundation Model for Perception in Surgical Settings",
    venue: "arXiv preprint",
    linkLabel: "arXiv:2503.19740",
    url: "https://arxiv.org/abs/2503.19740",
    year: 2025,
  },
];

/**
 * Sources cited on the Action (gesture) page, numbered after the instrument
 * footnotes so the numbering runs through the whole site. Model ids here refer
 * to `gestureResults.json` and may repeat instrument ids, which is why each
 * page resolves footnotes through its own lookup.
 */
export const GESTURE_MODEL_CITATIONS: ModelCitation[] = [
  {
    modelId: "surgmotion",
    authorsShort: "Wu, J., Holm, F., Chen, C., et al.",
    title:
      "SurgMotion: A Video-Native Foundation Model for Universal Understanding of Surgical Videos",
    venue: "arXiv preprint",
    linkLabel: "arXiv:2602.05638",
    url: "https://arxiv.org/abs/2602.05638",
    year: 2026,
  },
  {
    modelId: "lemon",
    authorsShort: "Che, C., Wang, C., Vercauteren, T., et al.",
    title:
      "LEMON: A Large Endoscopic MONocular Dataset and Foundation Model for Perception in Surgical Settings",
    venue: "Proceedings of CVPR 2026",
    linkLabel: "CVPR 2026",
    url: "https://openaccess.thecvf.com/content/CVPR2026/html/Che_LEMON_A_Large_Endoscopic_MONocular_Dataset_and_Foundation_Model_for_CVPR_2026_paper.html",
    year: 2026,
  },
  {
    modelId: "gpt-5-6-sol",
    authorsShort: "OpenAI.",
    title: "Previewing GPT-5.6 Sol",
    venue: "OpenAI release notes",
    linkLabel: "openai.com",
    url: "https://openai.com/index/previewing-gpt-5-6-sol/",
    year: 2026,
  },
  {
    modelId: "kimi-k3",
    authorsShort: "Moonshot AI.",
    title: "Kimi K3",
    venue: "GitHub repository",
    linkLabel: "github.com/MoonshotAI/Kimi-K3",
    url: "https://github.com/MoonshotAI/Kimi-K3",
    year: 2026,
  },
  {
    modelId: "claude-opus-5",
    authorsShort: "Anthropic.",
    title: "Claude Opus 5 System Card",
    venue: "Anthropic",
    linkLabel: "anthropic.com/system-cards",
    url: "https://www.anthropic.com/system-cards",
    year: 2026,
  },
];

/**
 * Footnote number for an instrument-page model result, or null when the model
 * has no citation.
 *
 * Footnotes are numbered: 1 the paper, 2… the datasets, then instrument model
 * citations, then Action-page model citations.
 */
export function modelFootnote(modelId: string): number | null {
  const index = MODEL_CITATIONS.findIndex((ref) => ref.modelId === modelId);
  if (index === -1) return null;
  return index + 2 + DATASET_CITATIONS.length;
}

/** Footnote number for an Action-page model result; numbering continues after {@link modelFootnote}. */
export function gestureModelFootnote(modelId: string): number | null {
  const index = GESTURE_MODEL_CITATIONS.findIndex((ref) => ref.modelId === modelId);
  if (index === -1) return null;
  return index + 2 + DATASET_CITATIONS.length + MODEL_CITATIONS.length;
}

export const DATASET_CITATIONS: DatasetCitation[] = [
  {
    datasetName: "CholecT50",
    authorsShort: "Nwoye, C. I., Yu, T., Gonzalez, C., et al.",
    title:
      "Rendezvous: Attention Mechanisms for the Recognition of Surgical Action Triplets in Endoscopic Videos",
    venue: "Medical Image Analysis, 78, 102433",
    linkLabel: "arXiv:2109.03223",
    url: "https://arxiv.org/abs/2109.03223",
    year: 2022,
  },
  {
    datasetName: "PitVis-2023",
    authorsShort: "Das, A., Khan, D. Z., Psychogyios, D., et al.",
    title:
      "PitVis-2023 Challenge: Workflow Recognition in Videos of Endoscopic Pituitary Surgery",
    venue: "Medical Image Analysis, 106, 103716",
    linkLabel: "arXiv:2409.01184",
    url: "https://arxiv.org/abs/2409.01184",
    year: 2025,
  },
  {
    datasetName: "SurgVU",
    authorsShort: "Zia, A., Berniker, M., Nespolo, R., et al.",
    title: "Surgical Visual Understanding (SurgVU) Dataset",
    venue: "arXiv preprint",
    linkLabel: "arXiv:2501.09209",
    url: "https://arxiv.org/abs/2501.09209",
    year: 2025,
  },
];
