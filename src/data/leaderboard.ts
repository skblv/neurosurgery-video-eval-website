/** Shared presentation types for domain-specific leaderboards. */

export interface MetricValue {
  value: number;
  ciLow: number | null;
  ciHigh: number | null;
}

export interface LeaderboardResult<MetricId extends string> {
  id: string;
  model: string;
  provider: string;
  metrics: Record<MetricId, MetricValue | null>;
}

export interface LeaderboardBenchmark<MetricId extends string> {
  id: string;
  name: string;
  majorityBaseline: Record<MetricId, number | null>;
  results: LeaderboardResult<MetricId>[];
}

export interface LeaderboardMetric<MetricId extends string = string> {
  id: MetricId;
  label: string;
  axisLabel: string;
  captionName: string;
}

/**
 * Resolves a result id to its footnote number, or null when the result has no
 * citation. Each page supplies its own lookup because result ids can repeat
 * across benchmarks while footnote numbering runs through the whole site.
 */
export type FootnoteLookup = (modelId: string) => number | null;
