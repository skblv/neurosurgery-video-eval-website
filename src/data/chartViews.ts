export const CHART_VIEWS = [
  { id: "history", label: "Historical performance" },
  { id: "modality", label: "Performance by modality" },
] as const;

export type ChartView = typeof CHART_VIEWS[number]["id"];

export function chartViewForKey(current: ChartView, key: string): ChartView | null {
  if (key === "Home") return CHART_VIEWS[0].id;
  if (key === "End") return CHART_VIEWS.at(-1)!.id;
  if (key !== "ArrowLeft" && key !== "ArrowRight") return null;
  const index = CHART_VIEWS.findIndex((view) => view.id === current);
  const direction = key === "ArrowRight" ? 1 : -1;
  return CHART_VIEWS[(index + direction + CHART_VIEWS.length) % CHART_VIEWS.length].id;
}
