/**
 * Schema for the four new-domain leaderboards in `domainResults.json`.
 *
 * Numbers follow the same exact-match / micro-F1 contract as `results.json`.
 */

import type { LeaderboardResult, MetricValue } from "./leaderboard";
import type { MetricId } from "./resultsSchema";

export const DOMAIN_METRIC_ORDER: MetricId[] = ["exactMatch", "microF1"];

export type DomainDatasetId =
  | "dsad"
  | "cadis"
  | "endoscapes"
  | "pitvqa"
  | "cholect50verbs"
  | "pitvissteps"
  | "sarrarp50";

export const DOMAIN_DATASET_ORDER: DomainDatasetId[] = [
  "dsad",
  "cadis",
  "endoscapes",
  "pitvqa",
  "cholect50verbs",
  "pitvissteps",
  "sarrarp50",
];

export const DOMAIN_SCHEMA_VERSION = 2;

export interface DomainDatasetResults {
  majorityBaseline: Record<MetricId, number | null>;
  results: DomainModelResult[];
}

export interface DomainModelResult extends LeaderboardResult<MetricId> {
  sourceRunId: string | null;
}

export interface DomainResultsFile {
  schemaVersion: number;
  generatedAt: string;
  datasets: Record<DomainDatasetId, DomainDatasetResults>;
}

const RESULT_KEYS = ["id", "model", "provider", "sourceRunId", "metrics"];
const METRIC_VALUE_KEYS = ["value", "ciLow", "ciHigh"];
const DATASET_RESULTS_KEYS = ["majorityBaseline", "results"];
const ROOT_KEYS = ["schemaVersion", "generatedAt", "datasets"];

function fail(where: string, detail: string): never {
  throw new Error(`domainResults.json: ${where}: ${detail}`);
}

function asRecord(value: unknown, where: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    fail(where, `expected an object, got ${JSON.stringify(value)}`);
  }
  return value as Record<string, unknown>;
}

function requireExactKeys(
  record: Record<string, unknown>,
  expected: string[],
  where: string,
): void {
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

function asPercentageOrNull(value: unknown, where: string): number | null {
  const parsed = asFiniteOrNull(value, where);
  if (parsed !== null && (parsed < 0 || parsed > 100)) {
    fail(where, `expected a percentage in [0, 100], got ${parsed}`);
  }
  return parsed;
}

function asNonEmptyString(value: unknown, where: string): string {
  if (typeof value !== "string" || value.length === 0) {
    fail(where, `expected a non-empty string, got ${JSON.stringify(value)}`);
  }
  return value;
}

function parseProvider(value: unknown, where: string): string {
  const candidate = asNonEmptyString(value, where);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(candidate)) {
    fail(where, `provider must be a lowercase slug; got ${JSON.stringify(candidate)}`);
  }
  return candidate;
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

  if ((parsed.ciLow === null) !== (parsed.ciHigh === null)) {
    fail(where, "ciLow and ciHigh must both be numbers or both be null");
  }
  if (parsed.value < 0 || parsed.value > 100) {
    fail(where, `value must be in [0, 100], got ${parsed.value}`);
  }
  if (
    parsed.ciLow !== null &&
    parsed.ciHigh !== null &&
    (parsed.ciLow < 0 ||
      parsed.ciHigh > 100 ||
      parsed.ciLow > parsed.value ||
      parsed.value > parsed.ciHigh)
  ) {
    fail(where, "confidence interval must satisfy 0 <= ciLow <= value <= ciHigh <= 100");
  }
  return parsed;
}

function parseModelResult(value: unknown, where: string): DomainModelResult {
  const record = asRecord(value, where);
  requireExactKeys(record, RESULT_KEYS, where);

  const sourceRunId =
    record.sourceRunId === null
      ? null
      : asNonEmptyString(record.sourceRunId, `${where}.sourceRunId`);

  const metricsRecord = asRecord(record.metrics, `${where}.metrics`);
  requireExactKeys(metricsRecord, DOMAIN_METRIC_ORDER, `${where}.metrics`);

  const metrics = {} as Record<MetricId, MetricValue | null>;
  for (const metricId of DOMAIN_METRIC_ORDER) {
    metrics[metricId] = parseMetricValue(
      metricsRecord[metricId],
      `${where}.metrics.${metricId}`,
    );
  }

  return {
    id: asNonEmptyString(record.id, `${where}.id`),
    model: asNonEmptyString(record.model, `${where}.model`),
    provider: parseProvider(record.provider, `${where}.provider`),
    sourceRunId,
    metrics,
  };
}

function parseDatasetResults(value: unknown, where: string): DomainDatasetResults {
  const record = asRecord(value, where);
  requireExactKeys(record, DATASET_RESULTS_KEYS, where);

  const baselineRecord = asRecord(record.majorityBaseline, `${where}.majorityBaseline`);
  requireExactKeys(baselineRecord, DOMAIN_METRIC_ORDER, `${where}.majorityBaseline`);

  const majorityBaseline = {} as Record<MetricId, number | null>;
  for (const metricId of DOMAIN_METRIC_ORDER) {
    majorityBaseline[metricId] = asPercentageOrNull(
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
 * Validate a parsed `domainResults.json` payload.
 *
 * @param raw - The value produced by importing or parsing `domainResults.json`.
 * @returns The validated results file.
 */
export function parseDomainResultsFile(raw: unknown): DomainResultsFile {
  const record = asRecord(raw, "root");
  requireExactKeys(record, ROOT_KEYS, "root");

  if (record.schemaVersion !== DOMAIN_SCHEMA_VERSION) {
    fail(
      "root.schemaVersion",
      `expected ${DOMAIN_SCHEMA_VERSION}, got ${JSON.stringify(record.schemaVersion)}`,
    );
  }

  const datasetsRecord = asRecord(record.datasets, "root.datasets");
  requireExactKeys(datasetsRecord, DOMAIN_DATASET_ORDER, "root.datasets");

  const datasets = {} as Record<DomainDatasetId, DomainDatasetResults>;
  for (const datasetId of DOMAIN_DATASET_ORDER) {
    datasets[datasetId] = parseDatasetResults(
      datasetsRecord[datasetId],
      `root.datasets.${datasetId}`,
    );
  }

  return {
    schemaVersion: DOMAIN_SCHEMA_VERSION,
    generatedAt: asNonEmptyString(record.generatedAt, "root.generatedAt"),
    datasets,
  };
}
