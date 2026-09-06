/**
 * Pure summary scoring. No app-data imports, so the build-time Node
 * validator can load this file with type stripping.
 */

export type SummaryMetricId = "exactMatch" | "exactAccuracy";

export interface SummaryResult {
  id: string;
  model: string;
  provider: string;
  metrics: Record<string, { value: number } | null | undefined>;
}

export interface SummaryDataset {
  id: string;
  name: string;
  specialistId: string;
  specialistLabel: string;
  metric: SummaryMetricId;
  majority: number;
  majorityPublished: boolean;
  results: SummaryResult[];
}

export interface SummaryModality {
  id: string;
  label: string;
  axisLabel: string[];
  specialistId: string;
  specialistLabel: string;
  datasets: SummaryDataset[];
}

export interface DatasetScore {
  datasetId: string;
  name: string;
  metric: SummaryMetricId;
  specialist: string;
  majority: number;
  majorityPublished: boolean;
  specialistScore: number;
  modelScore: number | null;
  ratio: number | null;
}

export interface ModalityScore {
  value: number | null;
  observed: number;
  expected: number;
  datasets: DatasetScore[];
}

export interface SummaryRow {
  id: string;
  model: string;
  provider: string;
  modalities: Record<string, ModalityScore>;
  total: number | null;
  coverage: number;
  datasetCoverage: number;
}

export const ACTION_MAJORITY = 0;

/**
 * The Action export uses a hyphenated GPT-5.6 Sol id. Do not merge different
 * model generations, or LEMON video inference with LemonFM linear probes.
 */
export function canonicalModelId(id: string): string {
  return id === "gpt-5-6-sol" ? "gpt-5_6-sol" : id;
}

/**
 * Scale a raw accuracy so majority = 0 and the small specialist = 1.
 *
 * @param modelScore - Model accuracy on the dataset, as a percentage.
 * @param majority - Majority-class baseline, as a percentage.
 * @param specialistScore - Small specialist accuracy, as a percentage.
 * @returns The scaled score. Values above 1 beat the specialist.
 */
export function relativeScore(
  modelScore: number,
  majority: number,
  specialistScore: number,
): number {
  if (!Number.isFinite(modelScore)) {
    throw new Error(`Model score must be finite, got ${modelScore}`);
  }
  if (!Number.isFinite(majority)) {
    throw new Error(`Majority baseline must be finite, got ${majority}`);
  }
  if (!Number.isFinite(specialistScore)) {
    throw new Error(`Specialist score must be finite, got ${specialistScore}`);
  }
  if (specialistScore <= majority) {
    throw new Error(
      `Specialist ${specialistScore} must beat majority ${majority}`,
    );
  }
  return (modelScore - majority) / (specialistScore - majority);
}

export function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function metricValue(result: SummaryResult, metric: SummaryMetricId): number | null {
  const score = result.metrics[metric];
  if (score == null || !Number.isFinite(score.value)) return null;
  return score.value;
}

export function asSummaryDataset(
  dataset: {
    id: string;
    name: string;
    majorityBaseline: Record<string, number | null>;
    results: SummaryResult[];
  },
  specialistId: string,
  specialistLabel: string,
  metric: SummaryMetricId,
): SummaryDataset {
  const published = dataset.majorityBaseline[metric];
  const majorityPublished = published !== null && published !== undefined;
  return {
    id: dataset.id,
    name: dataset.name,
    specialistId,
    specialistLabel,
    metric,
    majority: majorityPublished ? published : ACTION_MAJORITY,
    majorityPublished,
    results: dataset.results,
  };
}

/**
 * Build the six-modality summary from already-joined leaderboard datasets.
 *
 * @param input - Instrument, action, and domain leaderboards.
 * @returns Modalities in nav order, excluding Summary itself.
 */
export function buildSummaryModalities(input: {
  instruments: Parameters<typeof asSummaryDataset>[0][];
  gestures: Parameters<typeof asSummaryDataset>[0];
  anatomy: Parameters<typeof asSummaryDataset>[0][];
  skillAssessment: Parameters<typeof asSummaryDataset>[0][];
  clinicalContext: Parameters<typeof asSummaryDataset>[0][];
  recommendations: Parameters<typeof asSummaryDataset>[0][];
}): SummaryModality[] {
  return [
    {
      id: "instruments",
      label: "Instruments",
      axisLabel: ["Instruments"],
      specialistId: "yolov12m",
      specialistLabel: "YOLOv12-m",
      datasets: input.instruments.map((dataset) =>
        asSummaryDataset(dataset, "yolov12m", "YOLOv12-m", "exactMatch"),
      ),
    },
    {
      id: "gestures",
      label: "Action",
      axisLabel: ["Action"],
      specialistId: "surgmotion",
      specialistLabel: "SurgMotion",
      datasets: [
        asSummaryDataset(input.gestures, "surgmotion", "SurgMotion", "exactAccuracy"),
      ],
    },
    {
      id: "anatomy",
      label: "Anatomy",
      axisLabel: ["Anatomy"],
      specialistId: "resnet50",
      specialistLabel: "ResNet-50",
      datasets: input.anatomy.map((dataset) =>
        asSummaryDataset(dataset, "resnet50", "ResNet-50", "exactMatch"),
      ),
    },
    {
      id: "skill-assessment",
      label: "Skill assessment",
      axisLabel: ["Skill", "assessment"],
      specialistId: "resnet50",
      specialistLabel: "ResNet-50",
      datasets: input.skillAssessment.map((dataset) =>
        asSummaryDataset(dataset, "resnet50", "ResNet-50", "exactMatch"),
      ),
    },
    {
      id: "clinical-context",
      label: "Clinical context / VQA",
      axisLabel: ["Context", "/ VQA"],
      specialistId: "resnet50",
      specialistLabel: "ResNet-50",
      datasets: input.clinicalContext.map((dataset) =>
        asSummaryDataset(dataset, "resnet50", "ResNet-50", "exactMatch"),
      ),
    },
    {
      id: "recommendations",
      label: "Recommendations",
      axisLabel: ["Recommen-", "dations"],
      specialistId: "resnet50",
      specialistLabel: "ResNet-50",
      datasets: input.recommendations.map((dataset) =>
        asSummaryDataset(dataset, "resnet50", "ResNet-50", "exactMatch"),
      ),
    },
  ];
}

/**
 * Build one summary row per model.
 *
 * @param modalities - Modality definitions.
 * @returns Rows sorted by total, then coverage, then name.
 */
export function calculateSummary(modalities: SummaryModality[]): SummaryRow[] {
  const models = new Map<string, { id: string; model: string; provider: string }>();

  for (const modality of modalities) {
    if (modality.datasets.length === 0) {
      throw new Error(`No datasets in modality ${modality.id}`);
    }
    for (const dataset of modality.datasets) {
      const specialist = dataset.results.find(
        (result) => result.id === dataset.specialistId,
      );
      const specialistScore = specialist
        ? metricValue(specialist, dataset.metric)
        : null;
      if (specialistScore === null) {
        throw new Error(
          `Missing specialist ${dataset.specialistId} / ${dataset.metric} in ${dataset.id}`,
        );
      }
      relativeScore(specialistScore, dataset.majority, specialistScore);

      const seen = new Set<string>();
      for (const result of dataset.results) {
        const id = canonicalModelId(result.id);
        if (seen.has(id)) {
          throw new Error(`Duplicate model ${id} in ${dataset.id}`);
        }
        seen.add(id);
        if (!models.has(id)) {
          models.set(id, { id, model: result.model, provider: result.provider });
        }
      }
    }
  }

  return [...models.values()]
    .map((model): SummaryRow => {
      const scores: Record<string, ModalityScore> = {};
      let datasetCoverage = 0;

      for (const modality of modalities) {
        const datasets = modality.datasets.map((dataset): DatasetScore => {
          const specialist = dataset.results.find(
            (result) => result.id === dataset.specialistId,
          );
          if (!specialist) {
            throw new Error(
              `Missing specialist ${dataset.specialistId} in ${dataset.id}`,
            );
          }
          const specialistScore = metricValue(specialist, dataset.metric);
          if (specialistScore === null) {
            throw new Error(
              `Missing specialist metric ${dataset.metric} in ${dataset.id}`,
            );
          }
          const result = dataset.results.find(
            (entry) => canonicalModelId(entry.id) === model.id,
          );
          const modelScore = result ? metricValue(result, dataset.metric) : null;
          return {
            datasetId: dataset.id,
            name: dataset.name,
            metric: dataset.metric,
            specialist: specialist.model,
            majority: dataset.majority,
            majorityPublished: dataset.majorityPublished,
            specialistScore,
            modelScore,
            ratio:
              modelScore === null
                ? null
                : relativeScore(modelScore, dataset.majority, specialistScore),
          };
        });

        const observed = datasets.filter((item) => item.ratio !== null);
        datasetCoverage += observed.length;
        scores[modality.id] = {
          value: mean(observed.map((item) => item.ratio as number)),
          observed: observed.length,
          expected: datasets.length,
          datasets,
        };
      }

      const available = Object.values(scores).flatMap((score) =>
        score.value === null ? [] : [score.value],
      );

      return {
        ...model,
        modalities: scores,
        datasetCoverage,
        coverage: available.length,
        total: mean(available),
      };
    })
    .sort((left, right) => {
      if ((right.total ?? -Infinity) !== (left.total ?? -Infinity)) {
        return (right.total ?? -Infinity) - (left.total ?? -Infinity);
      }
      if (right.coverage !== left.coverage) return right.coverage - left.coverage;
      return left.model.localeCompare(right.model);
    });
}

export function formatScore(value: number | null): string {
  return value === null ? "NA" : value.toFixed(3);
}

export function metricLabel(metric: SummaryMetricId): string {
  switch (metric) {
    case "exactMatch":
      return "Exact-match accuracy";
    case "exactAccuracy":
      return "Exact frame accuracy";
    default: {
      const exhaustive: never = metric;
      throw new Error(`Unhandled summary metric: ${exhaustive}`);
    }
  }
}
