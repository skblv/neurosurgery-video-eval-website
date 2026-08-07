export type DatasetId = "cholect50" | "pitvis" | "surgvu";

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

export interface ModelResult {
  id: string;
  model: string;
  provider: Provider;
  paramsB: number | null;
  exactMatch: number;
  ciLow: number | null;
  ciHigh: number | null;
}

export interface Dataset {
  id: DatasetId;
  name: string;
  procedure: string;
  valFrames: number;
  toolClasses: number;
  majorityBaseline: number;
  sourceUrl: string;
  results: ModelResult[];
}

export const BAR_COLOR = "#0F766E";

type ModelSpec = Omit<ModelResult, "exactMatch" | "ciLow" | "ciHigh">;

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

export const DATASETS: Dataset[] = [
  {
    id: "cholect50",
    name: "CholecT50",
    procedure: "Laparoscopic cholecystectomy",
    valFrames: 19923,
    toolClasses: 6,
    majorityBaseline: 34.76,
    sourceUrl: "https://github.com/CAMMA-public/cholect50",
    results: [
      { ...GEMMA_LORA, exactMatch: 83.02, ciLow: 82.52, ciHigh: 83.56 },
      { ...YOLO, exactMatch: 81.37, ciLow: 80.87, ciHigh: 81.92 },
      { ...GEMINI_FLASH, exactMatch: 69.15, ciLow: 68.49, ciHigh: 69.73 },
      { ...GEMINI_PRO, exactMatch: 66.21, ciLow: 65.58, ciHigh: 66.88 },
      { ...KIMI_K3, exactMatch: 61.7, ciLow: 58.9, ciHigh: 64.9 },
      { ...GPT_SOL, exactMatch: 55.8, ciLow: 52.9, ciHigh: 58.9 },
      { ...CLAUDE_FABLE, exactMatch: 54.7, ciLow: 51.6, ciHigh: 57.7 },
      { ...CLAUDE_OPUS, exactMatch: 52.37, ciLow: 51.67, ciHigh: 53.03 },
      { ...GPT, exactMatch: 32.09, ciLow: 31.4, ciHigh: 32.72 },
      { ...CLAUDE_SONNET, exactMatch: 30.73, ciLow: 30.07, ciHigh: 31.37 },
      { ...GEMMA_ZEROSHOT, exactMatch: 6.87, ciLow: 6.55, ciHigh: 7.22 },
    ],
  },
  {
    id: "pitvis",
    name: "PitVis-2023",
    procedure: "Endoscopic transsphenoidal pituitary surgery",
    valFrames: 30896,
    toolClasses: 18,
    majorityBaseline: 39.63,
    sourceUrl:
      "https://rdr.ucl.ac.uk/articles/dataset/PitVis_Challenge_Endoscopic_Pituitary_Surgery_videos/26531686",
    results: [
      { ...GEMMA_LORA, exactMatch: 84.77, ciLow: 84.36, ciHigh: 85.16 },
      { ...YOLO, exactMatch: 82.78, ciLow: 82.36, ciHigh: 83.2 },
      { ...GEMINI_PRO, exactMatch: 57.65, ciLow: 57.11, ciHigh: 58.2 },
      { ...CLAUDE_FABLE, exactMatch: 57.2, ciLow: 54.3, ciHigh: 60.5 },
      { ...GEMINI_FLASH, exactMatch: 52.62, ciLow: 52.08, ciHigh: 53.18 },
      { ...CLAUDE_OPUS, exactMatch: 50.74, ciLow: 50.18, ciHigh: 51.31 },
      { ...CLAUDE_SONNET, exactMatch: 50.03, ciLow: 49.49, ciHigh: 50.55 },
      { ...GPT, exactMatch: 49.35, ciLow: 48.81, ciHigh: 49.92 },
      { ...KIMI_K3, exactMatch: 48.8, ciLow: 45.6, ciHigh: 51.9 },
      { ...GPT_SOL, exactMatch: 39.4, ciLow: 36.3, ciHigh: 42.6 },
      { ...GEMMA_ZEROSHOT, exactMatch: 28.46, ciLow: 27.97, ciHigh: 28.94 },
    ],
  },
  {
    id: "surgvu",
    name: "SurgVU",
    procedure: "Robot-assisted surgical training",
    valFrames: 18919,
    toolClasses: 17,
    majorityBaseline: 16.94,
    sourceUrl: "https://arxiv.org/abs/2501.09209",
    results: [
      { ...YOLO, exactMatch: 51.75, ciLow: 50.97, ciHigh: 52.51 },
      { ...GEMMA_LORA, exactMatch: 50.61, ciLow: 49.84, ciHigh: 51.39 },
      { ...CLAUDE_SONNET, exactMatch: 23.05, ciLow: 22.46, ciHigh: 23.65 },
      { ...GEMINI_PRO, exactMatch: 22.46, ciLow: 21.86, ciHigh: 23.02 },
      { ...CLAUDE_FABLE, exactMatch: 20.09, ciLow: 17.75, ciHigh: 22.34 },
      { ...GPT, exactMatch: 17.64, ciLow: 17.1, ciHigh: 18.24 },
      { ...GPT_SOL, exactMatch: 17.4, ciLow: 15.2, ciHigh: 19.9 },
      { ...CLAUDE_OPUS, exactMatch: 17.22, ciLow: 16.73, ciHigh: 17.77 },
      { ...KIMI_K3, exactMatch: 16.39, ciLow: 13.68, ciHigh: 19.25 },
      { ...GEMINI_FLASH, exactMatch: 11.69, ciLow: 11.23, ciHigh: 12.16 },
      { ...GEMMA_ZEROSHOT, exactMatch: 2.9, ciLow: 2.66, ciHigh: 3.16 },
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
