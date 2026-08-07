import type { Dataset, MetricId, ModelResult, Provider } from "../data/benchmark";

export interface ChartRow {
  id: string;
  model: string;
  provider: Provider;
  value: number;
  ciLow: number | null;
  ciHigh: number | null;
  errorOffsets: [number, number] | null;
}

function toRow(result: ModelResult, metricId: MetricId): ChartRow | null {
  const metric = result.metrics[metricId];
  if (metric === null) return null;

  const { value, ciLow, ciHigh } = metric;
  return {
    id: result.id,
    model: result.model,
    provider: result.provider,
    value,
    ciLow,
    ciHigh,
    errorOffsets: ciLow === null || ciHigh === null ? null : [value - ciLow, ciHigh - value],
  };
}

export function buildRows(dataset: Dataset, metricId: MetricId): ChartRow[] {
  return dataset.results
    .map((result) => toRow(result, metricId))
    .filter((row): row is ChartRow => row !== null)
    .sort((a, b) => b.value - a.value);
}
