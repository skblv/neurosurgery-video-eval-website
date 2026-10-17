import { MODEL_RELEASES, type ModelRelease } from "./modelReleases.ts";

interface ScoreRow {
  id: string;
  model: string;
  total: number | null;
  provider: string;
}

export interface ReleasePoint extends ScoreRow {
  total: number;
  releasedAt: number;
  release: ModelRelease;
}

export function releaseTimestamp(date: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const timestamp = Date.parse(`${date}T00:00:00Z`);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === date ? timestamp : null;
}

export function releasePoints(rows: readonly ScoreRow[], releases = MODEL_RELEASES): ReleasePoint[] {
  return rows.flatMap((row) => {
    const release = releases[row.id];
    const releasedAt = release ? releaseTimestamp(release.date) : null;
    if (releasedAt === null || row.total === null || !Number.isFinite(row.total)) return [];
    return [{ ...row, total: row.total, release, releasedAt }];
  }).sort((a, b) => a.releasedAt - b.releasedAt || b.total - a.total || a.id.localeCompare(b.id));
}

export interface PositionedPoint extends ReleasePoint { x: number; y: number }

const FAMILY_LABELS: Readonly<Record<string, string>> = {
  openai: "GPT", anthropic: "Claude", gemini: "Gemini", google: "Gemma",
  qwen: "Qwen", moonshot: "Kimi", zai: "GLM", xai: "Grok",
};

export function releaseFamilies(points: readonly ReleasePoint[]) {
  const providers = new Set(points.map((point) => point.provider));
  return [...new Set([...Object.keys(FAMILY_LABELS), ...providers])]
    .filter((provider) => providers.has(provider))
    .map((provider) => ({ provider, label: FAMILY_LABELS[provider] ?? provider }));
}

/** Pure, deterministic layout also used by the server-rendered page. Points never jitter. */
export function releasePlotLayout(points: readonly ReleasePoint[], width: number, height: number) {
  const bounds = { left: 64, right: width - 28, top: 34, bottom: height - 72 };
  const first = new Date(Math.min(...points.map((point) => point.releasedAt)));
  const last = new Date(Math.max(...points.map((point) => point.releasedAt)));
  const start = points.length ? Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), 1) : Date.UTC(2025, 0, 1);
  // Preserve the chart's calendar extent across both viewport sizes.
  const end = points.length ? Date.UTC(last.getUTCFullYear(), last.getUTCMonth() + 3, 1) : Date.UTC(2026, 0, 1);
  const low = points.length ? Math.min(0, Math.floor((Math.min(...points.map((point) => point.total)) - 0.03) * 10) / 10) : 0;
  const high = 1;
  const x = (value: number) => bounds.left + (value - start) / (end - start) * (bounds.right - bounds.left);
  const y = (value: number) => bounds.bottom - (value - low) / (high - low) * (bounds.bottom - bounds.top);
  const positioned: PositionedPoint[] = points.map((point) => ({ ...point, x: x(point.releasedAt), y: y(point.total) }));
  const xTicks: number[] = [];
  const monthSpan = (last.getUTCFullYear() - first.getUTCFullYear()) * 12 + last.getUTCMonth() - first.getUTCMonth();
  const step = monthSpan > 12 ? (width < 600 ? 6 : 3) : (width < 600 ? 3 : 2);
  const tick = new Date(start);
  while (tick.getTime() <= end) {
    xTicks.push(tick.getTime());
    tick.setUTCMonth(tick.getUTCMonth() + step);
  }
  const yTicks = low * 4 % 1 ? [low] : [];
  for (let quarter = Math.ceil(low * 4); quarter <= 4; quarter++) yTicks.push(quarter / 4);
  return { points: positioned, bounds, x, y, xTicks, yTicks };
}
