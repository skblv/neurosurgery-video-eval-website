import { DATASETS } from "./benchmark";
import { DOMAIN_DATASETS, DOMAIN_PAGES } from "./domainBenchmark";
import { DOMAINS, type DomainRoute } from "./domains";
import { GESTURE_BENCHMARK } from "./gestureBenchmark";
import type { LeaderboardBenchmark } from "./leaderboard";
import { calculateSummary, calculateSpecialistReference, canonicalModelId, type SummaryDataset, type SummaryModality } from "./summaryScoring";
import chanceBaselines from "./chanceBaselines.json";

const CHANCE_DATASETS: Record<string, { metrics: Record<string, number> }> = chanceBaselines.datasets;

function dataset<M extends string>(benchmark: LeaderboardBenchmark<M>, metric: M, referenceId: string): SummaryDataset {
  return {
    id: benchmark.id, name: benchmark.name, metric, referenceId,
    chance: CHANCE_DATASETS[benchmark.id]?.metrics[metric] ?? null,
    results: benchmark.results.map((result) => ({ id: result.id, model: result.model, value: result.metrics[metric]?.value ?? null })),
  };
}

export const SUMMARY_MODALITIES: (SummaryModality & { id: DomainRoute })[] = DOMAINS.filter((domain) => domain.id !== "summary").map((domain) => {
  const datasets = domain.id === "instruments"
    ? DATASETS.map((item) => dataset(item, "microF1", "yolov12m"))
    : domain.id === "gestures"
      ? [dataset(GESTURE_BENCHMARK, "exactAccuracy", "surgmotion")]
      : DOMAIN_PAGES[domain.id as keyof typeof DOMAIN_PAGES].datasetIds.map((id) => dataset(DOMAIN_DATASETS[id], id === "sarrarp50" ? "exactMatch" : "microF1", "resnet50"));
  return { id: domain.id, label: domain.shortLabel, datasets };
});

const EXCLUDED_SUMMARY_IDS = new Set([
  "yolov12m", "resnet50", "surgmotion", "lemon", "lemonfm-linear-probe",
  "gemma3-27b-lora-json", "gemma3-27b-lora",
]);
const providers = new Map(
  [...DATASETS, GESTURE_BENCHMARK, ...Object.values(DOMAIN_DATASETS)]
    .flatMap((benchmark) => benchmark.results.map((result) => [canonicalModelId(result.id), result.provider] as const)),
);

const modelRows = calculateSummary(SUMMARY_MODALITIES)
  .map((row) => ({ ...row, provider: providers.get(row.id)! }));
// Keep the zero-shot plots and their model selectors unchanged.
export const SUMMARY_ROWS = modelRows.filter((row) => !EXCLUDED_SUMMARY_IDS.has(row.id));
const specialistReference = calculateSpecialistReference(SUMMARY_MODALITIES);
export const SUMMARY_TABLE_ROWS = [
  ...SUMMARY_ROWS.map((row) => ({ ...row, kind: "zero-shot" as const })),
  ...modelRows.filter((row) => row.id === "lemonfm-linear-probe").map((row) => ({ ...row, kind: "linear-probe" as const })),
  ...(specialistReference ? [{ ...specialistReference, provider: "internal", kind: "specialist-reference" as const }] : []),
];
export const SUMMARY_DATASET_COUNT = SUMMARY_MODALITIES.reduce((sum, modality) => sum + modality.datasets.length, 0);
