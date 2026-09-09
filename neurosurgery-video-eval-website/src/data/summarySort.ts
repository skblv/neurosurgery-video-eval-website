export type SummaryColumn = "model" | "total" | number;
export interface SummarySort { column: SummaryColumn; direction: "ascending" | "descending" }
export const DEFAULT_SUMMARY_SORT: SummarySort = { column: "total", direction: "descending" };

interface SortableSummaryRow {
  model: string;
  total: number | null;
  scores: readonly { value: number | null }[];
}

export function nextSummarySort(current: SummarySort, column: SummaryColumn): SummarySort {
  return { column, direction: current.column === column
    ? (current.direction === "descending" ? "ascending" : "descending")
    : (column === "model" ? "ascending" : "descending") };
}

/** Never mutate the shared leaderboard: chart points and selectors keep their order. */
export function sortSummaryRows<T extends SortableSummaryRow>(rows: readonly T[], sort: SummarySort): T[] {
  const direction = sort.direction === "ascending" ? 1 : -1;
  return [...rows].sort((a, b) => {
    if (sort.column === "model") return direction * a.model.localeCompare(b.model, "en", { numeric: true });
    const left = sort.column === "total" ? a.total : a.scores[sort.column]?.value ?? null;
    const right = sort.column === "total" ? b.total : b.scores[sort.column]?.value ?? null;
    // Missing scores stay last in either direction, never becoming zero.
    if (left === null || right === null) return left === right ? 0 : left === null ? 1 : -1;
    return direction * (left - right);
  });
}
