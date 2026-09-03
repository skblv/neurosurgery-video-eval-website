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

/** How long a freshly published model keeps its "New" badge. */
export const NEW_BADGE_DAYS = 14;

/**
 * Publication date of each recently added model, as `YYYY-MM-DD`.
 *
 * Presentation only: it changes no score. Ids are matched on every board, so a
 * model listed here is badged wherever it appears. The badge expires on its own
 * {@link NEW_BADGE_DAYS} days after the date below, so entries can be added
 * without anyone having to remember to take them out again; the check runs
 * against the visitor's clock at render, so the badge lapses without a rebuild.
 */
export const MODEL_PUBLISHED_ON: Readonly<Record<string, string>> = {
  "claude-fable-5_1": "2026-09-02",
  "gemini-3_8-flash": "2026-09-02",
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Whether a result id should carry the "New" badge.
 *
 * @param modelId - Result id as it appears in the results files.
 * @param now - Current time; injectable so tests need not mock the clock.
 * @returns True while the model is inside its badge window.
 */
export function isNewModel(modelId: string, now: Date = new Date()): boolean {
  const publishedOn = MODEL_PUBLISHED_ON[modelId];
  if (publishedOn === undefined) return false;

  // Parsed as UTC midnight, so the window does not shift with the viewer's zone.
  const published = Date.parse(`${publishedOn}T00:00:00Z`);
  if (Number.isNaN(published)) return false;

  const age = now.getTime() - published;
  return age >= 0 && age < NEW_BADGE_DAYS * MS_PER_DAY;
}
