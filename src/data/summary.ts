/**
 * Live summary rows for the Summary tab. Scoring lives in `summaryScore.ts`.
 */

import { DATASETS } from "./benchmark";
import { DOMAIN_DATASETS, DOMAIN_PAGES } from "./domainBenchmark";
import { GESTURE_BENCHMARK } from "./gestureBenchmark";
import {
  buildSummaryModalities,
  calculateSummary,
} from "./summaryScore";

export {
  formatScore,
  metricLabel,
  relativeScore,
  canonicalModelId,
  calculateSummary,
  type DatasetScore,
  type ModalityScore,
  type SummaryDataset,
  type SummaryModality,
  type SummaryMetricId,
  type SummaryRow,
} from "./summaryScore";

function domainDatasets(route: keyof typeof DOMAIN_PAGES) {
  return DOMAIN_PAGES[route].datasetIds.map((id) => DOMAIN_DATASETS[id]);
}

export const SUMMARY_MODALITIES = buildSummaryModalities({
  instruments: DATASETS,
  gestures: GESTURE_BENCHMARK,
  anatomy: domainDatasets("anatomy"),
  skillAssessment: domainDatasets("skill-assessment"),
  clinicalContext: domainDatasets("clinical-context"),
  recommendations: domainDatasets("recommendations"),
});

export const SUMMARY_DATASET_COUNT = SUMMARY_MODALITIES.reduce(
  (sum, modality) => sum + modality.datasets.length,
  0,
);

export const SUMMARY_ROWS = calculateSummary(SUMMARY_MODALITIES);
