import rawInstruments from "./results.json" with { type: "json" };
import rawDomains from "./domainResults.json" with { type: "json" };
import rawGestures from "./gestureResults.json" with { type: "json" };
import { parseResultsFile } from "./resultsSchema.ts";
import { parseDomainResultsFile } from "./domainResultsSchema.ts";
import { parseGestureResultsFile } from "./gestureResultsSchema.ts";

export type SummaryMetricMode = "primary" | "accuracy";
type ScoreMetric = "microF1" | "exactMatch" | "exactAccuracy";

interface SummaryResult {
  id: string;
  model: string;
  provider: string;
  metrics: Record<string, { value: number } | null>;
}

export interface SummaryDataset {
  id: string;
  name: string;
  specialistId: string;
  primaryMetric: ScoreMetric;
  results: SummaryResult[];
}

export interface SummaryModality {
  id: string;
  label: string;
  axisLabel: string[];
  datasets: SummaryDataset[];
}

export interface DatasetRatio {
  datasetId: string;
  name: string;
  metric: ScoreMetric;
  specialist: string;
  specialistScore: number;
  modelScore: number | null;
  ratio: number | null;
}

export interface ModalityScore {
  value: number | null;
  observed: number;
  expected: number;
  datasets: DatasetRatio[];
}

export interface SummaryRow {
  id: string;
  model: string;
  provider: string;
  modalities: Record<string, ModalityScore>;
  total: number | null;
  partialTotal: number | null;
  coverage: number;
  datasetCoverage: number;
}

const instruments = parseResultsFile(rawInstruments);
const domains = parseDomainResultsFile(rawDomains);
const gestures = parseGestureResultsFile(rawGestures);

const instrumentNames = { cholect50: "CholecT50", pitvis: "PitVis-2023", surgvu: "SurgVU" };
const domainNames = {
  dsad: "DSAD", cadis: "CaDIS", endoscapes: "Endoscapes", pitvqa: "PitVQA",
  cholect50verbs: "CholecT50 verbs", pitvissteps: "PitVis-2023 steps", sarrarp50: "SAR-RARP50",
};

function domainDataset(id: keyof typeof domainNames): SummaryDataset {
  return {
    id, name: domainNames[id], specialistId: "resnet50",
    primaryMetric: id === "sarrarp50" ? "exactMatch" : "microF1",
    results: domains.datasets[id].results,
  };
}

/** Fixed task specialists, not the best-scoring model chosen after evaluation. */
export const SUMMARY_MODALITIES: SummaryModality[] = [
  {
    id: "instruments", label: "Instruments", axisLabel: ["Instruments"],
    datasets: (Object.keys(instrumentNames) as (keyof typeof instrumentNames)[]).map((id) => ({
      id, name: instrumentNames[id], specialistId: "yolov12m", primaryMetric: "microF1",
      results: instruments.datasets[id].results,
    })),
  },
  {
    id: "gestures", label: "Action", axisLabel: ["Action"],
    datasets: [{
      id: gestures.benchmark.id, name: gestures.benchmark.name,
      specialistId: "surgmotion", primaryMetric: "exactAccuracy", results: gestures.benchmark.results,
    }],
  },
  {
    id: "anatomy", label: "Anatomy", axisLabel: ["Anatomy"],
    datasets: ["dsad", "cadis", "endoscapes"].map((id) => domainDataset(id as keyof typeof domainNames)),
  },
  {
    id: "skill-assessment", label: "Skill assessment", axisLabel: ["Skill", "assessment"],
    datasets: [domainDataset("sarrarp50")],
  },
  {
    id: "clinical-context", label: "Clinical context / VQA", axisLabel: ["Context", "/ VQA"],
    datasets: [domainDataset("pitvqa")],
  },
  {
    id: "recommendations", label: "Recommendations", axisLabel: ["Recommen-", "dations"],
    datasets: [domainDataset("cholect50verbs"), domainDataset("pitvissteps")],
  },
];

export const SUMMARY_DATASET_COUNT = SUMMARY_MODALITIES.reduce((sum, item) => sum + item.datasets.length, 0);

// The Action export uses a different spelling for the same model. Do not merge
// different generations, or LEMON video inference with LemonFM linear probes.
export function canonicalModelId(id: string): string {
  return id === "gpt-5-6-sol" ? "gpt-5_6-sol" : id;
}

export function selectedMetric(dataset: SummaryDataset, mode: SummaryMetricMode): ScoreMetric {
  return mode === "accuracy" && dataset.primaryMetric !== "exactAccuracy"
    ? "exactMatch" : dataset.primaryMetric;
}

export function metricLabel(metric: ScoreMetric): string {
  return metric === "microF1" ? "Micro-F1" : metric === "exactAccuracy" ? "Frame accuracy" : "Exact-match accuracy";
}

/** All arithmetic uses source precision; rounding happens only for display. */
export function calculateSummary(
  mode: SummaryMetricMode = "primary",
  modalities: SummaryModality[] = SUMMARY_MODALITIES,
): SummaryRow[] {
  const models = new Map<string, { id: string; model: string; provider: string }>();
  for (const modality of modalities) {
    if (!modality.datasets.length) throw new Error(`No datasets in ${modality.id}`);
    for (const dataset of modality.datasets) {
      const seen = new Set<string>();
      for (const result of dataset.results) {
        const id = canonicalModelId(result.id);
        if (seen.has(id)) throw new Error(`Duplicate model ${id} in ${dataset.id}`);
        seen.add(id);
        if (!models.has(id)) models.set(id, { id, model: result.model, provider: result.provider });
      }
      const metric = selectedMetric(dataset, mode);
      const specialist = dataset.results.find((result) => result.id === dataset.specialistId);
      const baseline = specialist?.metrics[metric]?.value;
      if (baseline === undefined || !Number.isFinite(baseline) || baseline <= 0) {
        throw new Error(`Missing or non-positive specialist ${dataset.specialistId} / ${metric} in ${dataset.id}`);
      }
    }
  }

  return [...models.values()].map((model): SummaryRow => {
    const scores: Record<string, ModalityScore> = {};
    let datasetCoverage = 0;
    for (const modality of modalities) {
      const datasets = modality.datasets.map((dataset): DatasetRatio => {
        const metric = selectedMetric(dataset, mode);
        const specialist = dataset.results.find((result) => result.id === dataset.specialistId)!;
        const specialistScore = specialist.metrics[metric]!.value;
        const result = dataset.results.find((result) => canonicalModelId(result.id) === model.id);
        const value = result?.metrics[metric]?.value;
        const modelScore = value !== undefined && Number.isFinite(value) && value >= 0 ? value : null;
        return {
          datasetId: dataset.id, name: dataset.name, metric, specialist: specialist.model,
          specialistScore, modelScore, ratio: modelScore === null ? null : modelScore / specialistScore,
        };
      });
      const observed = datasets.filter((dataset) => dataset.ratio !== null).length;
      datasetCoverage += observed;
      scores[modality.id] = {
        // Fixed 1/N weights: an incomplete modality is unscored, not reweighted.
        value: observed === datasets.length
          ? datasets.reduce((sum, dataset) => sum + dataset.ratio!, 0) / datasets.length : null,
        observed, expected: datasets.length, datasets,
      };
    }
    const complete = Object.values(scores).filter((score) => score.value !== null);
    const partialTotal = complete.length
      ? complete.reduce((sum, score) => sum + score.value!, 0) / complete.length : null;
    return {
      ...model, modalities: scores, datasetCoverage, coverage: complete.length, partialTotal,
      total: complete.length === modalities.length ? partialTotal : null,
    };
  }).sort((a, b) => b.coverage - a.coverage || (b.partialTotal ?? -1) - (a.partialTotal ?? -1) || a.model.localeCompare(b.model));
}

export function formatRatio(value: number | null): string {
  return value === null ? "—" : `${value.toFixed(3)}×`;
}
