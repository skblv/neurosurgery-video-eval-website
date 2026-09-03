/**
 * Display configuration for the Anatomy, Context/VQA, Recommendations,
 * and Skill-assessment leaderboards.
 */

import rawDomainResults from "./domainResults.json";
import {
  DOMAIN_DATASET_ORDER,
  parseDomainResultsFile,
  type DomainDatasetId,
} from "./domainResultsSchema";
import {
  DATASET_CITATIONS,
  GESTURE_MODEL_CITATIONS,
  MODEL_CITATIONS,
  modelFootnote,
  type DatasetCitation,
} from "./benchmark";
import type { DomainRoute } from "./domains";
import type { LeaderboardBenchmark } from "./leaderboard";
import type { MetricId } from "./resultsSchema";

export type { DomainDatasetId };

const RESULTS = parseDomainResultsFile(rawDomainResults);

export const DOMAIN_RESULTS_GENERATED_AT = RESULTS.generatedAt;

export interface DomainPage {
  route: DomainRoute;
  datasetIds: readonly [DomainDatasetId, ...DomainDatasetId[]];
  title: string;
  lead: string;
}

export interface DomainDataset extends LeaderboardBenchmark<MetricId> {
  id: DomainDatasetId;
  name: string;
  classCount: number;
  classNoun: string;
  sourceUrl: string;
  /**
   * Metrics offered in the dropdown. Single-label tasks (one ground-truth
   * label, one prediction per frame) list only exact match, because pooled
   * micro-F1 is arithmetically the same number there.
   */
  metricIds: MetricId[];
  notes: string[];
}

type DomainDatasetMeta = Omit<DomainDataset, "majorityBaseline" | "results">;

export const DOMAIN_PAGES: Record<
  "anatomy" | "clinical-context" | "recommendations" | "skill-assessment",
  DomainPage
> = {
  anatomy: {
    route: "anatomy",
    datasetIds: ["dsad", "cadis", "endoscapes"],
    title: "Which anatomical structures and operative entities are visible?",
    lead:
      "Recognizing anatomy and other annotated entities in the operative field is a " +
      "prerequisite for scene understanding and downstream decision support.",
  },
  "clinical-context": {
    route: "clinical-context",
    datasetIds: ["pitvqa"],
    title: "What is happening in this operation?",
    lead:
      "Clinical context is scored as joint surgical-phase and surgical-step recognition " +
      "on endoscopic pituitary frames from PitVQA.",
  },
  recommendations: {
    route: "recommendations",
    datasetIds: ["cholect50verbs", "pitvissteps"],
    title: "Which actions are being performed?",
    lead:
      "We compare frame-level recognition of surgical actions and procedural workflow " +
      "across cholecystectomy and pituitary surgery.",
  },
  "skill-assessment": {
    route: "skill-assessment",
    datasetIds: ["sarrarp50"],
    title: "What suturing action is being performed?",
    lead:
      "This page is a skill proxy: models must recognize the current suturing gesture " +
      "during robot-assisted radical prostatectomy on SAR-RARP50. It is not an OSATS " +
      "or global rating-scale score.",
  },
};

const DOMAIN_DATASET_META: Record<DomainDatasetId, DomainDatasetMeta> = {
  dsad: {
    id: "dsad",
    name: "DSAD",
    classCount: 12,
    classNoun: "anatomical structures",
    sourceUrl: "https://www.nature.com/articles/s41597-022-01719-2",
    metricIds: ["exactMatch", "microF1"],
    notes: [
      "Structure presence is multi-label, so exact match requires the predicted structure " +
        "set to equal the ground-truth set, while micro-averaged F1 credits partial overlap.",
      "Local models are scored on all 1,978 validation frames. API models use a seed-42 " +
        "sample of 1,000 validation frames.",
    ],
  },
  cadis: {
    id: "cadis",
    name: "CaDIS",
    classCount: 17,
    classNoun: "Task II semantic classes",
    sourceUrl: "https://doi.org/10.1016/j.media.2021.102053",
    metricIds: ["exactMatch", "microF1"],
    notes: [
      "Presence labels are derived from Task II segmentation masks. All models are scored " +
        "on all 534 validation frames.",
    ],
  },
  endoscapes: {
    id: "endoscapes",
    name: "Endoscapes",
    classCount: 6,
    classNoun: "annotated structures and tools",
    sourceUrl: "https://github.com/CAMMA-public/Endoscapes",
    metricIds: ["exactMatch", "microF1"],
    notes: [
      "Presence labels are derived from BBox annotations. All models are scored on all 409 validation frames.",
    ],
  },
  pitvqa: {
    id: "pitvqa",
    name: "PitVQA",
    classCount: 17,
    classNoun: "phase and step labels",
    sourceUrl: "https://arxiv.org/abs/2405.13949",
    metricIds: ["exactMatch", "microF1"],
    notes: [
      "Exact match requires both the phase and step to be correct; micro-averaged F1 " +
        "credits getting one of the two right. Local models are scored on all 24,767 " +
        "validation frames. API models use a seed-42 sample of 1,000 frames.",
    ],
  },
  cholect50verbs: {
    id: "cholect50verbs",
    name: "CholecT50 verbs",
    classCount: 10,
    classNoun: "surgical actions",
    sourceUrl: "https://arxiv.org/abs/2109.03223",
    metricIds: ["exactMatch", "microF1"],
    notes: [
      "Action labels are multi-label, so exact match requires the predicted action set to " +
        "equal the ground-truth set, while micro-averaged F1 credits partial overlap. " +
        "Frames with no active instrument verb are labeled idle.",
      "Local models are scored on all 19,923 validation frames, inherited from the " +
        "CholecT50 instrument split. API models use a seed-42 sample of 1,000 validation frames.",
    ],
  },
  pitvissteps: {
    id: "pitvissteps",
    name: "PitVis-2023 steps",
    classCount: 12,
    classNoun: "surgical steps",
    sourceUrl:
      "https://rdr.ucl.ac.uk/articles/dataset/PitVis_Challenge_Endoscopic_Pituitary_Surgery_videos/26531686",
    metricIds: ["exactMatch", "microF1"],
    notes: [
      "All models are scored on 27,925 validation frames from five videos. Frame metrics " +
        "are not the official challenge score. Strict valid task scores: LEMON 24.95%, " +
        "Gemma 3 27B fine-tuned 23.21%, ResNet-50 20.39%; zero-shot outputs are invalid " +
        "under the strict scorer.",
    ],
  },
  sarrarp50: {
    id: "sarrarp50",
    name: "SAR-RARP50",
    classCount: 8,
    classNoun: "suturing actions",
    sourceUrl: "https://arxiv.org/abs/2401.00496",
    metricIds: ["exactMatch"],
    notes: [
      "All models are scored on all 636 validation frames, sampled at 1 Hz from held-out operations.",
      "Gesture recognition is single-label, so micro-averaged F1 reduces to exact-match " +
        "accuracy; a single accuracy metric is reported.",
    ],
  },
};

function buildDomainDatasets(): Record<DomainDatasetId, DomainDataset> {
  const datasets = {} as Record<DomainDatasetId, DomainDataset>;
  for (const datasetId of DOMAIN_DATASET_ORDER) {
    datasets[datasetId] = {
      ...DOMAIN_DATASET_META[datasetId],
      majorityBaseline: RESULTS.datasets[datasetId].majorityBaseline,
      results: RESULTS.datasets[datasetId].results,
    };
  }
  return datasets;
}

export const DOMAIN_DATASETS = buildDomainDatasets();

function instrumentDatasetCitation(datasetName: string): DatasetCitation {
  const citation = DATASET_CITATIONS.find((item) => item.datasetName === datasetName);
  if (!citation) throw new Error(`No instrument citation for dataset ${datasetName}`);
  return citation;
}

export const DOMAIN_DATASET_CITATIONS: Record<DomainDatasetId, DatasetCitation> = {
  dsad: {
    datasetName: "DSAD",
    authorsShort: "Carstens, M., Rinner, F. M., Bodenstedt, S., et al.",
    title:
      "The Dresden Surgical Anatomy Dataset for Abdominal Organ Segmentation in Surgical Data Science",
    venue: "Scientific Data, 10, 3",
    linkLabel: "doi:10.1038/s41597-022-01719-2",
    url: "https://www.nature.com/articles/s41597-022-01719-2",
    year: 2023,
  },
  cadis: {
    datasetName: "CaDIS",
    authorsShort: "Grammatikopoulou, M., et al.",
    title: "CaDIS: Cataract dataset for surgical RGB-image segmentation",
    venue: "Medical Image Analysis, 71, 102053",
    linkLabel: "doi:10.1016/j.media.2021.102053",
    url: "https://doi.org/10.1016/j.media.2021.102053",
    year: 2021,
  },
  endoscapes: {
    datasetName: "Endoscapes",
    authorsShort: "Murali, A., Alapatt, D., Mascagni, P., et al.",
    title:
      "The Endoscapes Dataset for Surgical Scene Segmentation, Object Detection, and " +
      "Critical View of Safety Assessment: Official Splits and Benchmark",
    venue: "arXiv preprint",
    linkLabel: "arXiv:2312.12429",
    url: "https://arxiv.org/abs/2312.12429",
    year: 2023,
  },
  pitvqa: {
    datasetName: "PitVQA",
    authorsShort: "He, R., Xu, M., Das, A., et al.",
    title:
      "PitVQA: Image-grounded Text Embedding LLM for Visual Question Answering in Pituitary Surgery",
    venue: "MICCAI 2024",
    linkLabel: "arXiv:2405.13949",
    url: "https://arxiv.org/abs/2405.13949",
    year: 2024,
  },
  cholect50verbs: instrumentDatasetCitation("CholecT50"),
  pitvissteps: instrumentDatasetCitation("PitVis-2023"),
  sarrarp50: {
    datasetName: "SAR-RARP50",
    authorsShort: "Psychogyios, D., Colleoni, E., Van Amsterdam, B., et al.",
    title:
      "SAR-RARP50: Segmentation of surgical instrumentation and Action Recognition on " +
      "Robot-Assisted Radical Prostatectomy Challenge",
    venue: "arXiv preprint",
    linkLabel: "arXiv:2401.00496",
    url: "https://arxiv.org/abs/2401.00496",
    year: 2024,
  },
};

const HF_NAMESPACE = "https://huggingface.co/skblv";

/**
 * Hugging Face weight repositories for models trained by us. The LemonFM
 * probes share one bundled repo.
 */
const DOMAIN_WEIGHTS_URLS: Record<DomainDatasetId, Record<string, string>> = {
  dsad: {
    "gemma3-27b-lora": `${HF_NAMESPACE}/gemma-3-27b-it-lora-dsad-anatomy`,
    resnet50: `${HF_NAMESPACE}/resnet50-dsad-anatomy`,
    "lemonfm-linear-probe": `${HF_NAMESPACE}/lemonfm-linear-probes-surgical-video`,
  },
  cadis: {
    "gemma3-27b-lora": `${HF_NAMESPACE}/gemma-3-27b-it-lora-cadis-task2`,
    resnet50: `${HF_NAMESPACE}/resnet50-cadis-task2`,
    "lemonfm-linear-probe": `${HF_NAMESPACE}/lemonfm-linear-probes-surgical-video`,
  },
  endoscapes: {
    "gemma3-27b-lora": `${HF_NAMESPACE}/gemma-3-27b-it-lora-endoscapes-bbox201`,
    resnet50: `${HF_NAMESPACE}/resnet50-endoscapes-bbox201`,
    "lemonfm-linear-probe": `${HF_NAMESPACE}/lemonfm-linear-probes-surgical-video`,
  },
  pitvqa: {
    "gemma3-27b-lora": `${HF_NAMESPACE}/gemma-3-27b-it-lora-pitvqa-phase-step`,
    resnet50: `${HF_NAMESPACE}/resnet50-pitvqa-phase-step`,
    "lemonfm-linear-probe": `${HF_NAMESPACE}/lemonfm-linear-probes-surgical-video`,
  },
  cholect50verbs: {
    "gemma3-27b-lora": `${HF_NAMESPACE}/gemma-3-27b-it-lora-cholect50-verbs`,
    "gemma3-27b-lora-json": `${HF_NAMESPACE}/gemma-3-27b-it-lora-json-cholect50-verbs`,
    resnet50: `${HF_NAMESPACE}/resnet50-cholect50-verbs`,
    "lemonfm-linear-probe": `${HF_NAMESPACE}/lemonfm-linear-probes-surgical-video`,
  },
  pitvissteps: {
    "gemma3-27b-lora": `${HF_NAMESPACE}/gemma-3-27b-it-lora-pitvis-steps`,
    resnet50: `${HF_NAMESPACE}/resnet50-pitvis-steps`,
    "lemonfm-linear-probe": `${HF_NAMESPACE}/lemonfm-linear-probes-surgical-video`,
  },
  sarrarp50: {
    "gemma3-27b-lora": `${HF_NAMESPACE}/gemma-3-27b-it-lora-sarrarp50-gesture`,
    resnet50: `${HF_NAMESPACE}/resnet50-sarrarp50-gesture`,
    "lemonfm-linear-probe": `${HF_NAMESPACE}/lemonfm-linear-probes-surgical-video`,
  },
};

/** Weight-repo URL for a model on a domain leaderboard, if we trained it. */
export function domainWeightsUrl(
  datasetId: DomainDatasetId,
  modelId: string,
): string | null {
  return DOMAIN_WEIGHTS_URLS[datasetId][modelId] ?? null;
}

/**
 * New-domain dataset citations continue the site-wide footnote sequence:
 * 1 is the paper, 2… the instrument datasets, then instrument model
 * citations, then Action-page model citations. Existing domain citations keep
 * their numbers, and new unique citations are appended after them.
 */
const FIRST_DOMAIN_DATASET_FOOTNOTE =
  2 + DATASET_CITATIONS.length + MODEL_CITATIONS.length + GESTURE_MODEL_CITATIONS.length;

const REUSED_DATASET_FOOTNOTES: Partial<Record<DomainDatasetId, number>> = {
  cholect50verbs: 2,
  pitvissteps: 3,
};

const FOOTNOTE_DATASET_ORDER: DomainDatasetId[] = [
  "dsad",
  "sarrarp50",
  "pitvqa",
  "cadis",
  "endoscapes",
];

/** Site-wide footnote number for a new-domain dataset citation. */
export function domainDatasetFootnote(datasetId: DomainDatasetId): number {
  const reusedFootnote = REUSED_DATASET_FOOTNOTES[datasetId];
  if (reusedFootnote !== undefined) return reusedFootnote;

  const index = FOOTNOTE_DATASET_ORDER.indexOf(datasetId);
  if (index === -1) throw new Error(`No footnote order for dataset ${datasetId}`);
  return FIRST_DOMAIN_DATASET_FOOTNOTE + index;
}

/**
 * Footnote number for a new-domain model result.
 *
 * Model citations reuse their site-wide numbers, so the LemonFM linear probe
 * carries the same footnote here as on the Instruments page.
 */
export function domainModelFootnote(modelId: string): number | null {
  return modelFootnote(modelId);
}
