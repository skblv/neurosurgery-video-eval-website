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
import { DOMAINS, type DomainRoute } from "./domains";
import type { LeaderboardBenchmark } from "./leaderboard";
import type { MetricId } from "./resultsSchema";

export type { DomainDatasetId };

const RESULTS = parseDomainResultsFile(rawDomainResults);

export const DOMAIN_RESULTS_GENERATED_AT = RESULTS.generatedAt;

export interface DomainPage {
  route: DomainRoute;
  datasetId: DomainDatasetId;
  title: string;
  lead: string;
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

export const DOMAIN_PAGES: Record<
  "anatomy" | "clinical-context" | "recommendations" | "skill-assessment",
  DomainPage
> = {
  anatomy: {
    route: "anatomy",
    datasetId: "dsad",
    title: "Which anatomical structures are visible?",
    lead: "Recognizing organs and vessels in the laparoscopic field is a prerequisite for scene understanding and downstream decision support. We score models on multi-label structure presence in Dresden Surgical Anatomy Dataset frames.",
    classCount: 12,
    classNoun: "anatomical structures",
    sourceUrl: "https://www.nature.com/articles/s41597-022-01719-2",
    metricIds: ["exactMatch", "microF1"],
    notes: [
      "Structure presence is multi-label, so the two metrics differ: exact match requires the predicted structure set to equal the ground-truth set, while micro-averaged F1 credits partial overlap.",
      "Local models are scored on the full 1,978-frame validation split. API models use a seed-42 sample of 1,000 validation frames.",
    ],
  },
  "clinical-context": {
    route: "clinical-context",
    datasetId: "pitvqa",
    title: "What is happening in this operation?",
    lead: "Clinical context is scored as joint surgical-phase and surgical-step recognition on endoscopic pituitary frames from PitVQA.",
    classCount: 17,
    classNoun: "phase and step labels",
    sourceUrl: "https://arxiv.org/abs/2405.13949",
    metricIds: ["exactMatch", "microF1"],
    notes: [
      "Exact match requires both the phase and the step to be correct; micro-averaged F1 credits getting one of the two right. Local models are scored on all 24,767 validation frames. API models use a seed-42 sample of 1,000 frames.",
    ],
  },
  recommendations: {
    route: "recommendations",
    datasetId: "cholect50verbs",
    title: "Which actions are being performed?",
    lead: "Recommendation-style scene understanding is scored as multi-label action recognition on CholecT50 cholecystectomy frames: name every current verb visible in the field.",
    classCount: 10,
    classNoun: "surgical actions",
    sourceUrl: "https://arxiv.org/abs/2109.03223",
    metricIds: ["exactMatch", "microF1"],
    notes: [
      "Action labels are multi-label, so the two metrics differ: exact match requires the predicted action set to equal the ground-truth set, while micro-averaged F1 credits partial overlap. Frames with no active instrument verb are labeled idle.",
      "Local models are scored on the full 19,923-frame validation split, inherited from the CholecT50 instrument split. API models use a seed-42 sample of 1,000 validation frames. Gemma classification-head and generative fine-tunes on this task are still training and are omitted.",
    ],
  },
  "skill-assessment": {
    route: "skill-assessment",
    datasetId: "sarrarp50",
    title: "What suturing action is being performed?",
    lead: "This page is a skill proxy: models must recognize the current suturing gesture during robot-assisted radical prostatectomy on SAR-RARP50. It is not an OSATS or global rating-scale score.",
    classCount: 8,
    classNoun: "suturing actions",
    sourceUrl: "https://arxiv.org/abs/2401.00496",
    metricIds: ["exactMatch"],
    notes: [
      "All models are scored on the full 636-frame validation split, sampled at 1 Hz from held-out operations.",
      "Gesture recognition is single-label (one ground-truth action, one predicted action per frame), so micro-averaged F1 reduces to the same number as exact-match accuracy; a single accuracy metric is reported.",
    ],
  },
};

export interface DomainDataset extends LeaderboardBenchmark<MetricId> {
  id: DomainDatasetId;
  name: string;
  sourceUrl: string;
  classCount: number;
  classNoun: string;
}

const DATASET_NAMES: Record<DomainDatasetId, string> = {
  dsad: "DSAD",
  pitvqa: "PitVQA",
  cholect50verbs: "CholecT50 verbs",
  sarrarp50: "SAR-RARP50",
};

export const DOMAIN_DATASETS: Record<DomainDatasetId, DomainDataset> = Object.fromEntries(
  DOMAIN_DATASET_ORDER.map((datasetId) => {
    const page = Object.values(DOMAIN_PAGES).find((item) => item.datasetId === datasetId);
    if (!page) throw new Error(`No domain page for dataset ${datasetId}`);
    return [
      datasetId,
      {
        id: datasetId,
        name: DATASET_NAMES[datasetId],
        sourceUrl: page.sourceUrl,
        classCount: page.classCount,
        classNoun: page.classNoun,
        majorityBaseline: RESULTS.datasets[datasetId].majorityBaseline,
        results: RESULTS.datasets[datasetId].results,
      },
    ];
  }),
) as Record<DomainDatasetId, DomainDataset>;

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
  cholect50verbs: {
    datasetName: "CholecT50",
    authorsShort: "Nwoye, C. I., Yu, T., Gonzalez, C., et al.",
    title:
      "Rendezvous: Attention Mechanisms for the Recognition of Surgical Action Triplets in Endoscopic Videos",
    venue: "Medical Image Analysis, 78, 102433",
    linkLabel: "arXiv:2109.03223",
    url: "https://arxiv.org/abs/2109.03223",
    year: 2022,
  },
  sarrarp50: {
    datasetName: "SAR-RARP50",
    authorsShort: "Psychogyios, D., Colleoni, E., Van Amsterdam, B., et al.",
    title:
      "SAR-RARP50: Segmentation of surgical instrumentation and Action Recognition on Robot-Assisted Radical Prostatectomy Challenge",
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
  pitvqa: {
    "gemma3-27b-lora": `${HF_NAMESPACE}/gemma-3-27b-it-lora-pitvqa-phase-step`,
    resnet50: `${HF_NAMESPACE}/resnet50-pitvqa-phase-step`,
    "lemonfm-linear-probe": `${HF_NAMESPACE}/lemonfm-linear-probes-surgical-video`,
  },
  cholect50verbs: {
    resnet50: `${HF_NAMESPACE}/resnet50-cholect50-verbs`,
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
 * citations, then Action-page model citations. Domain datasets are numbered
 * after all of those, in the order their pages appear in the navigation.
 */
const FIRST_DOMAIN_DATASET_FOOTNOTE =
  2 + DATASET_CITATIONS.length + MODEL_CITATIONS.length + GESTURE_MODEL_CITATIONS.length;

const FOOTNOTE_DATASET_ORDER: DomainDatasetId[] = DOMAINS.filter(
  (domain): domain is (typeof DOMAINS)[number] & { id: keyof typeof DOMAIN_PAGES } =>
    domain.id in DOMAIN_PAGES,
)
  .map((domain) => DOMAIN_PAGES[domain.id].datasetId)
  .filter((datasetId) => datasetId !== "cholect50verbs");

/** Site-wide footnote number for a new-domain dataset citation. */
export function domainDatasetFootnote(datasetId: DomainDatasetId): number {
  if (datasetId === "cholect50verbs") {
    return 2;
  }
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
