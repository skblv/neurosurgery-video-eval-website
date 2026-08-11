import type { LeaderboardResult, MetricValue } from "./leaderboard";

export type GestureMetricId = "exactAccuracy" | "macroF1" | "weightedF1";

export const GESTURE_METRIC_ORDER: GestureMetricId[] = [
  "exactAccuracy",
  "macroF1",
  "weightedF1",
];

export const GESTURE_SCHEMA_VERSION = 1;

export interface GestureBenchmarkResults {
  id: string;
  name: string;
  procedureCount: number;
  procedureId: string;
  durationSeconds: number;
  fps: number;
  evaluatedFrameCount: number;
  annotatedFrameCount: number;
  unambiguousFrameCount: number;
  gestureClasses: string[];
  results: LeaderboardResult<GestureMetricId>[];
}

export interface GestureResultsFile {
  schemaVersion: number;
  generatedAt: string;
  benchmark: GestureBenchmarkResults;
}

const ROOT_KEYS = ["schemaVersion", "generatedAt", "benchmark"];
const BENCHMARK_KEYS = [
  "id",
  "name",
  "procedureCount",
  "procedureId",
  "durationSeconds",
  "fps",
  "evaluatedFrameCount",
  "annotatedFrameCount",
  "unambiguousFrameCount",
  "gestureClasses",
  "results",
];
const RESULT_KEYS = ["id", "model", "provider", "sourceRunId", "metrics"];
const METRIC_VALUE_KEYS = ["value", "ciLow", "ciHigh"];

function fail(where: string, detail: string): never {
  throw new Error(`gestureResults.json: ${where}: ${detail}`);
}

function asRecord(value: unknown, where: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    fail(where, `expected an object, got ${JSON.stringify(value)}`);
  }
  return value as Record<string, unknown>;
}

function requireExactKeys(record: Record<string, unknown>, expected: string[], where: string) {
  const actual = Object.keys(record).sort().join(", ");
  const wanted = [...expected].sort().join(", ");
  if (actual !== wanted) fail(where, `expected keys [${wanted}], got [${actual}]`);
}

function asString(value: unknown, where: string): string {
  if (typeof value !== "string" || value.length === 0) fail(where, "expected a non-empty string");
  return value;
}

function asNumber(value: unknown, where: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) fail(where, "expected a finite number");
  return value;
}

function asPositiveNumber(value: unknown, where: string): number {
  const parsed = asNumber(value, where);
  if (parsed <= 0) fail(where, "expected a positive number");
  return parsed;
}

function parseMetric(value: unknown, where: string): MetricValue {
  const record = asRecord(value, where);
  requireExactKeys(record, METRIC_VALUE_KEYS, where);
  const parsed = {
    value: asNumber(record.value, `${where}.value`),
    ciLow: record.ciLow === null ? null : asNumber(record.ciLow, `${where}.ciLow`),
    ciHigh: record.ciHigh === null ? null : asNumber(record.ciHigh, `${where}.ciHigh`),
  };
  if (parsed.value < 0 || parsed.value > 100) fail(where, "value must be between 0 and 100");
  if ((parsed.ciLow === null) !== (parsed.ciHigh === null)) {
    fail(where, "ciLow and ciHigh must both be numbers or both be null");
  }
  return parsed;
}

function parseResult(value: unknown, where: string): LeaderboardResult<GestureMetricId> {
  const record = asRecord(value, where);
  requireExactKeys(record, RESULT_KEYS, where);
  asString(record.sourceRunId, `${where}.sourceRunId`);
  const metricsRecord = asRecord(record.metrics, `${where}.metrics`);
  requireExactKeys(metricsRecord, GESTURE_METRIC_ORDER, `${where}.metrics`);
  const metrics = {} as Record<GestureMetricId, MetricValue>;
  for (const metricId of GESTURE_METRIC_ORDER) {
    metrics[metricId] = parseMetric(metricsRecord[metricId], `${where}.metrics.${metricId}`);
  }
  return {
    id: asString(record.id, `${where}.id`),
    model: asString(record.model, `${where}.model`),
    provider: asString(record.provider, `${where}.provider`),
    metrics,
  };
}

export function parseGestureResultsFile(raw: unknown): GestureResultsFile {
  const record = asRecord(raw, "root");
  requireExactKeys(record, ROOT_KEYS, "root");
  if (record.schemaVersion !== GESTURE_SCHEMA_VERSION) {
    fail("root.schemaVersion", `expected ${GESTURE_SCHEMA_VERSION}`);
  }

  const benchmarkRecord = asRecord(record.benchmark, "root.benchmark");
  requireExactKeys(benchmarkRecord, BENCHMARK_KEYS, "root.benchmark");
  if (!Array.isArray(benchmarkRecord.gestureClasses) || benchmarkRecord.gestureClasses.length === 0) {
    fail("root.benchmark.gestureClasses", "expected a non-empty array");
  }
  if (!Array.isArray(benchmarkRecord.results)) fail("root.benchmark.results", "expected an array");

  const results = benchmarkRecord.results.map((value, index) =>
    parseResult(value, `root.benchmark.results[${index}]`),
  );
  const ids = results.map((result) => result.id);
  if (new Set(ids).size !== ids.length) fail("root.benchmark.results", "model ids must be unique");
  if (ids.includes("mvit-multi-task")) fail("root.benchmark.results", "MViT is excluded from this release");

  const procedureCount = asPositiveNumber(
    benchmarkRecord.procedureCount,
    "root.benchmark.procedureCount",
  );
  if (!Number.isInteger(procedureCount)) fail("root.benchmark.procedureCount", "expected an integer");

  return {
    schemaVersion: GESTURE_SCHEMA_VERSION,
    generatedAt: asString(record.generatedAt, "root.generatedAt"),
    benchmark: {
      id: asString(benchmarkRecord.id, "root.benchmark.id"),
      name: asString(benchmarkRecord.name, "root.benchmark.name"),
      procedureCount,
      procedureId: asString(benchmarkRecord.procedureId, "root.benchmark.procedureId"),
      durationSeconds: asPositiveNumber(benchmarkRecord.durationSeconds, "root.benchmark.durationSeconds"),
      fps: asPositiveNumber(benchmarkRecord.fps, "root.benchmark.fps"),
      evaluatedFrameCount: asPositiveNumber(
        benchmarkRecord.evaluatedFrameCount,
        "root.benchmark.evaluatedFrameCount",
      ),
      annotatedFrameCount: asPositiveNumber(
        benchmarkRecord.annotatedFrameCount,
        "root.benchmark.annotatedFrameCount",
      ),
      unambiguousFrameCount: asPositiveNumber(
        benchmarkRecord.unambiguousFrameCount,
        "root.benchmark.unambiguousFrameCount",
      ),
      gestureClasses: benchmarkRecord.gestureClasses.map((value, index) =>
        asString(value, `root.benchmark.gestureClasses[${index}]`),
      ),
      results,
    },
  };
}
