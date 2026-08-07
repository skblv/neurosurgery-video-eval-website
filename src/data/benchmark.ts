export type DatasetId = "cholect50" | "pitvis" | "surgvu";

export type MetricId = "exactMatch" | "microF1";

/** "internal" marks models we trained ourselves, shown with the joint SDSC/Booth mark. */
export type Provider = "internal" | "openai" | "anthropic" | "gemini" | "google" | "moonshot";

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

export const METRIC_ORDER: MetricId[] = ["exactMatch", "microF1"];

export interface MetricValue {
  value: number;
  ciLow: number | null;
  ciHigh: number | null;
}

export interface ModelResult {
  id: string;
  model: string;
  provider: Provider;
  paramsB: number | null;
  metrics: Record<MetricId, MetricValue | null>;
}

export interface Dataset {
  id: DatasetId;
  name: string;
  procedure: string;
  toolClasses: number;
  majorityBaseline: Record<MetricId, number | null>;
  sourceUrl: string;
  results: ModelResult[];
}

export const BAR_COLOR = "#0F766E";

type ModelSpec = Omit<ModelResult, "metrics">;

const YOLO: ModelSpec = {
  id: "yolov12m",
  model: "YOLOv12-m",
  provider: "internal",
  paramsB: 0.026,
};

const GEMMA_LORA: ModelSpec = {
  id: "gemma3-27b-lora",
  model: "Gemma 3 27B + LoRA cls. head",
  provider: "internal",
  paramsB: 27,
};

const GEMMA_ZEROSHOT: ModelSpec = {
  id: "gemma3-27b-it",
  model: "Gemma 3 27B-it (zero-shot)",
  provider: "google",
  paramsB: 27,
};

const frontier = (id: string, model: string, provider: Provider): ModelSpec => ({
  id,
  model,
  provider,
  paramsB: null,
});

const GEMINI_PRO = frontier("gemini-3_1-pro", "Gemini 3.1 Pro Preview", "gemini");
const GEMINI_FLASH = frontier("gemini-3-flash", "Gemini 3 Flash Preview", "gemini");
const CLAUDE_OPUS = frontier("claude-opus-4_6", "Claude Opus 4.6", "anthropic");
const CLAUDE_SONNET = frontier("claude-sonnet-4_6", "Claude Sonnet 4.6", "anthropic");
const CLAUDE_FABLE = frontier("claude-fable-5", "Claude Fable 5", "anthropic");
const GPT = frontier("gpt-5_4", "GPT-5.4", "openai");
const GPT_SOL = frontier("gpt-5_6-sol", "GPT-5.6 Sol", "openai");
const KIMI_K3 = frontier("kimi-k3", "Kimi K3", "moonshot");

interface ResultInput {
  exactMatch: [value: number, ciLow: number, ciHigh: number];
  /** Micro-F1 is reported as a point estimate; the eval pipeline bootstraps exact match only. */
  microF1: number | null;
}

const result = (spec: ModelSpec, { exactMatch, microF1 }: ResultInput): ModelResult => ({
  ...spec,
  metrics: {
    exactMatch: { value: exactMatch[0], ciLow: exactMatch[1], ciHigh: exactMatch[2] },
    microF1: microF1 === null ? null : { value: microF1, ciLow: null, ciHigh: null },
  },
});

export const DATASETS: Dataset[] = [
  {
    id: "cholect50",
    name: "CholecT50",
    procedure: "Laparoscopic cholecystectomy",
    toolClasses: 6,
    majorityBaseline: { exactMatch: 34.76, microF1: 54.03 },
    sourceUrl: "https://github.com/CAMMA-public/cholect50",
    results: [
      result(GEMMA_LORA, { exactMatch: [83.02, 82.52, 83.56], microF1: 92.83 }),
      result(YOLO, { exactMatch: [81.37, 80.87, 81.92], microF1: 92.37 }),
      result(GEMINI_FLASH, { exactMatch: [69.15, 68.49, 69.73], microF1: 82.88 }),
      result(GEMINI_PRO, { exactMatch: [66.21, 65.58, 66.88], microF1: 80.01 }),
      result(KIMI_K3, { exactMatch: [61.7, 58.9, 64.9], microF1: 78.05 }),
      result(GPT_SOL, { exactMatch: [55.8, 52.9, 58.9], microF1: 72.31 }),
      result(CLAUDE_FABLE, { exactMatch: [54.7, 51.6, 57.7], microF1: 69.87 }),
      result(CLAUDE_OPUS, { exactMatch: [52.37, 51.67, 53.03], microF1: 71.33 }),
      result(GPT, { exactMatch: [32.09, 31.4, 32.72], microF1: 48.61 }),
      result(CLAUDE_SONNET, { exactMatch: [30.73, 30.07, 31.37], microF1: 51.87 }),
      result(GEMMA_ZEROSHOT, { exactMatch: [6.87, 6.55, 7.22], microF1: 33.7 }),
    ],
  },
  {
    id: "pitvis",
    name: "PitVis-2023",
    procedure: "Endoscopic transsphenoidal pituitary surgery",
    toolClasses: 18,
    majorityBaseline: { exactMatch: 39.63, microF1: 43.88 },
    sourceUrl:
      "https://rdr.ucl.ac.uk/articles/dataset/PitVis_Challenge_Endoscopic_Pituitary_Surgery_videos/26531686",
    results: [
      result(GEMMA_LORA, { exactMatch: [84.77, 84.36, 85.16], microF1: 85.65 }),
      result(YOLO, { exactMatch: [82.78, 82.36, 83.2], microF1: 82.75 }),
      result(GEMINI_PRO, { exactMatch: [57.65, 57.11, 58.2], microF1: 50.41 }),
      result(CLAUDE_FABLE, { exactMatch: [57.2, 54.3, 60.5], microF1: 53.08 }),
      result(GEMINI_FLASH, { exactMatch: [52.62, 52.08, 53.18], microF1: 48.91 }),
      result(CLAUDE_OPUS, { exactMatch: [50.74, 50.18, 51.31], microF1: 46.89 }),
      result(CLAUDE_SONNET, { exactMatch: [50.03, 49.49, 50.55], microF1: 46.84 }),
      result(GPT, { exactMatch: [49.35, 48.81, 49.92], microF1: 45.69 }),
      result(KIMI_K3, { exactMatch: [48.8, 45.6, 51.9], microF1: 46.22 }),
      result(GPT_SOL, { exactMatch: [39.4, 36.3, 42.6], microF1: 40.02 }),
      result(GEMMA_ZEROSHOT, { exactMatch: [28.46, 27.97, 28.94], microF1: 35.59 }),
    ],
  },
  {
    id: "surgvu",
    name: "SurgVU",
    procedure: "Robot-assisted surgical training",
    toolClasses: 17,
    majorityBaseline: { exactMatch: 16.94, microF1: 25.93 },
    sourceUrl: "https://arxiv.org/abs/2501.09209",
    results: [
      result(YOLO, { exactMatch: [51.75, 50.97, 52.51], microF1: 75.34 }),
      result(GEMMA_LORA, { exactMatch: [50.61, 49.84, 51.39], microF1: 74.86 }),
      result(CLAUDE_SONNET, { exactMatch: [23.05, 22.46, 23.65], microF1: 31.27 }),
      result(GEMINI_PRO, { exactMatch: [22.46, 21.86, 23.02], microF1: 43.65 }),
      result(CLAUDE_FABLE, { exactMatch: [20.09, 17.75, 22.34], microF1: 30.83 }),
      result(GPT, { exactMatch: [17.64, 17.1, 18.24], microF1: 25.99 }),
      result(GPT_SOL, { exactMatch: [17.4, 15.2, 19.9], microF1: 29.18 }),
      result(CLAUDE_OPUS, { exactMatch: [17.22, 16.73, 17.77], microF1: 27.38 }),
      result(KIMI_K3, { exactMatch: [16.39, 13.68, 19.25], microF1: 16.02 }),
      result(GEMINI_FLASH, { exactMatch: [11.69, 11.23, 12.16], microF1: 36.89 }),
      result(GEMMA_ZEROSHOT, { exactMatch: [2.9, 2.66, 3.16], microF1: 20.69 }),
    ],
  },
];

export const PAPER = {
  title:
    "A Comparative Study in Surgical AI: Potential and Limitations of Data, Compute, and Scaling",
  authorsShort: "Skobelev, K., Fithian, E., Baranovski, Y., et al.",
  arxivId: "arXiv:2603.27341",
  url: "https://arxiv.org/abs/2603.27341",
  year: 2026,
} as const;
