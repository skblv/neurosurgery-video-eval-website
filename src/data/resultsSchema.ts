/**
 * Schema and runtime validation for the machine-generated `src/data/results.json`.
 *
 * `results.json` is overwritten by the offline eval runner, so it is treated as
 * untrusted input: every field is checked and any deviation throws immediately
 * rather than rendering a half-broken chart. This module owns the identifiers
 * the JSON is allowed to use; `benchmark.ts` layers display config on top.
 */

export type DatasetId = "cholect50" | "pitvis" | "surgvu";

export type MetricId = "exactMatch" | "microF1";

/** "internal" marks models we trained ourselves, shown with the joint SDSC/Booth mark. */
export type Provider = "internal" | "openai" | "anthropic" | "gemini" | "google" | "moonshot";

/** Tab order on the site. Also the exact set of keys `results.json` must carry. */
export const DATASET_ORDER: DatasetId[] = ["cholect50", "pitvis", "surgvu"];

/** Metric dropdown order. Also the exact set of metric keys every result must carry. */
export const METRIC_ORDER: MetricId[] = ["exactMatch", "microF1"];

export const PROVIDERS: Provider[] = [
  "internal",
  "openai",
  "anthropic",
  "gemini",
  "google",
  "moonshot",
];

export const SCHEMA_VERSION = 1;

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

export interface DatasetResults {
  majorityBaseline: Record<MetricId, number | null>;
  results: ModelResult[];
}

export interface ResultsFile {
  schemaVersion: number;
  generatedAt: string;
  datasets: Record<DatasetId, DatasetResults>;
}

const RESULT_KEYS = ["id", "model", "provider", "paramsB", "sourceRunId", "metrics"];
const METRIC_VALUE_KEYS = ["value", "ciLow", "ciHigh"];
const DATASET_RESULTS_KEYS = ["majorityBaseline", "results"];
const ROOT_KEYS = ["schemaVersion", "generatedAt", "datasets"];

function fail(where: string, detail: string): never {
  throw new Error(`results.json: ${where}: ${detail}`);
}

function asRecord(value: unknown, where: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    fail(where, `expected an object, got ${JSON.stringify(value)}`);
  }
  return value as Record<string, unknown>;
}

function requireExactKeys(record: Record<string, unknown>, expected: string[], where: string): void {
  const actual = Object.keys(record).sort().join(", ");
  const wanted = [...expected].sort().join(", ");
  if (actual !== wanted) {
    fail(where, `expected keys [${wanted}], got [${actual}]`);
  }
}

function asFinite(value: unknown, where: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    fail(where, `expected a finite number, got ${JSON.stringify(value)}`);
  }
  return value;
}

function asFiniteOrNull(value: unknown, where: string): number | null {
  return value === null ? null : asFinite(value, where);
}

function asNonEmptyString(value: unknown, where: string): string {
  if (typeof value !== "string" || value.length === 0) {
    fail(where, `expected a non-empty string, got ${JSON.stringify(value)}`);
  }
  return value;
}

function parseProvider(value: unknown, where: string): Provider {
  const candidate = asNonEmptyString(value, where);
  const match = PROVIDERS.find((provider) => provider === candidate);
  if (match === undefined) {
    fail(where, `unknown provider "${candidate}"; expected one of [${PROVIDERS.join(", ")}]`);
  }
  return match;
}

function parseMetricValue(value: unknown, where: string): MetricValue | null {
  if (value === null) return null;

  const record = asRecord(value, where);
  requireExactKeys(record, METRIC_VALUE_KEYS, where);

  const parsed: MetricValue = {
    value: asFinite(record.value, `${where}.value`),
    ciLow: asFiniteOrNull(record.ciLow, `${where}.ciLow`),
    ciHigh: asFiniteOrNull(record.ciHigh, `${where}.ciHigh`),
  };

  // The chart derives whisker offsets from both bounds, so a one-sided interval
  // would render as a zero-length whisker on the missing side instead of erroring.
  if ((parsed.ciLow === null) !== (parsed.ciHigh === null)) {
    fail(where, "ciLow and ciHigh must both be numbers or both be null");
  }
  return parsed;
}

function parseModelResult(value: unknown, where: string): ModelResult {
  const record = asRecord(value, where);
  requireExactKeys(record, RESULT_KEYS, where);

  if (record.sourceRunId !== null) {
    asNonEmptyString(record.sourceRunId, `${where}.sourceRunId`);
  }

  const metricsRecord = asRecord(record.metrics, `${where}.metrics`);
  requireExactKeys(metricsRecord, METRIC_ORDER, `${where}.metrics`);

  const metrics = {} as Record<MetricId, MetricValue | null>;
  for (const metricId of METRIC_ORDER) {
    metrics[metricId] = parseMetricValue(metricsRecord[metricId], `${where}.metrics.${metricId}`);
  }

  return {
    id: asNonEmptyString(record.id, `${where}.id`),
    model: asNonEmptyString(record.model, `${where}.model`),
    provider: parseProvider(record.provider, `${where}.provider`),
    paramsB: asFiniteOrNull(record.paramsB, `${where}.paramsB`),
    metrics,
  };
}

function parseDatasetResults(value: unknown, where: string): DatasetResults {
  const record = asRecord(value, where);
  requireExactKeys(record, DATASET_RESULTS_KEYS, where);

  const baselineRecord = asRecord(record.majorityBaseline, `${where}.majorityBaseline`);
  requireExactKeys(baselineRecord, METRIC_ORDER, `${where}.majorityBaseline`);

  const majorityBaseline = {} as Record<MetricId, number | null>;
  for (const metricId of METRIC_ORDER) {
    majorityBaseline[metricId] = asFiniteOrNull(
      baselineRecord[metricId],
      `${where}.majorityBaseline.${metricId}`,
    );
  }

  if (!Array.isArray(record.results)) {
    fail(`${where}.results`, "expected an array");
  }

  const seenIds = new Set<string>();
  const results = record.results.map((entry, index) => {
    const parsed = parseModelResult(entry, `${where}.results[${index}]`);
    if (seenIds.has(parsed.id)) {
      fail(`${where}.results[${index}]`, `duplicate model id "${parsed.id}"`);
    }
    seenIds.add(parsed.id);
    return parsed;
  });

  return { majorityBaseline, results };
}

/**
 * Validate a parsed `results.json` payload and return it in typed form.
 *
 * @param raw - The value produced by importing or parsing `results.json`.
 * @returns The validated results file.
 * @throws Error If any field is missing, mistyped, or names an unknown dataset,
 *   provider, or metric.
 */
export function parseResultsFile(raw: unknown): ResultsFile {
  const record = asRecord(raw, "root");
  requireExactKeys(record, ROOT_KEYS, "root");

  if (record.schemaVersion !== SCHEMA_VERSION) {
    fail(
      "root.schemaVersion",
      `expected ${SCHEMA_VERSION}, got ${JSON.stringify(record.schemaVersion)}`,
    );
  }

  const datasetsRecord = asRecord(record.datasets, "root.datasets");
  requireExactKeys(datasetsRecord, DATASET_ORDER, "root.datasets");

  const datasets = {} as Record<DatasetId, DatasetResults>;
  for (const datasetId of DATASET_ORDER) {
    datasets[datasetId] = parseDatasetResults(
      datasetsRecord[datasetId],
      `root.datasets.${datasetId}`,
    );
  }

  return {
    schemaVersion: SCHEMA_VERSION,
    generatedAt: asNonEmptyString(record.generatedAt, "root.generatedAt"),
    datasets,
  };
}
