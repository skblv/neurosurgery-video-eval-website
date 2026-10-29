export interface CostPerformancePoint {
  id: string;
  costPerMillionFrames: number;
  total: number;
}

/** Nondominated individual models, ordered by increasing inference cost. */
export function singleModelFrontier<T extends CostPerformancePoint>(points: readonly T[]): T[] {
  const ordered = points
    .filter((point) => Number.isFinite(point.costPerMillionFrames)
      && point.costPerMillionFrames >= 0
      && Number.isFinite(point.total))
    .sort((a, b) => a.costPerMillionFrames - b.costPerMillionFrames
      || b.total - a.total
      || a.id.localeCompare(b.id));
  const frontier: T[] = [];
  let best = -Infinity;
  for (const point of ordered) {
    if (point.total <= best) continue;
    frontier.push(point);
    best = point.total;
  }
  return frontier;
}

export interface PlotPoint {
  x: number;
  y: number;
}

/**
 * Best single-model score at each budget: horizontal until the next model's
 * cost, then vertical to its score. Coordinates are already scaled for SVG.
 */
export function staircasePath(points: readonly PlotPoint[], right?: number): string {
  if (!points.length) return "";
  const first = points[0];
  let path = `M ${first.x} ${first.y}`;
  for (const point of points.slice(1)) path += ` H ${point.x} V ${point.y}`;
  const last = points[points.length - 1];
  if (right !== undefined && Number.isFinite(right) && right > last.x) path += ` H ${right}`;
  return path;
}
