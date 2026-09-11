import assert from "node:assert/strict";
import { test } from "node:test";
import { DEFAULT_SUMMARY_SORT, nextSummarySort, sortSummaryRows } from "../src/data/summarySort.ts";

const rows = [
  { model: "Model 10", total: 0.3, scores: [{ value: 0.8 }, { value: null }] },
  { model: "Model 2", total: 0.8, scores: [{ value: -0.2 }, { value: 0.5 }] },
  { model: "Model 1", total: null, scores: [{ value: null }, { value: 0.9 }] },
];

test("summary defaults to highest total, toggles directions, and starts new numeric columns highest first", () => {
  assert.deepEqual(DEFAULT_SUMMARY_SORT, { column: "total", direction: "descending" });
  assert.deepEqual(nextSummarySort(DEFAULT_SUMMARY_SORT, "total"), { column: "total", direction: "ascending" });
  assert.deepEqual(nextSummarySort({ column: "total", direction: "ascending" }, "total"), DEFAULT_SUMMARY_SORT);
  assert.deepEqual(nextSummarySort(DEFAULT_SUMMARY_SORT, 0), { column: 0, direction: "descending" });
  assert.deepEqual(nextSummarySort(DEFAULT_SUMMARY_SORT, "model"), { column: "model", direction: "ascending" });
});

test("all numeric columns sort without changing scores or source order, with NA last in either direction", () => {
  const before = structuredClone(rows);
  for (const column of ["total", 0, 1] as const) {
    for (const direction of ["ascending", "descending"] as const) {
      const result = sortSummaryRows(rows, { column, direction });
      const values = result.map((row) => column === "total" ? row.total : row.scores[column].value);
      assert.equal(values.at(-1), null);
      assert(direction === "ascending" ? values[0]! <= values[1]! : values[0]! >= values[1]!);
      assert(result.every((row) => rows.includes(row)), "Only order changes, not data");
    }
  }
  assert.deepEqual(rows, before);
  assert.deepEqual(sortSummaryRows(rows, { column: "model", direction: "ascending" }).map((row) => row.model), ["Model 1", "Model 2", "Model 10"]);
  assert.deepEqual(sortSummaryRows(rows, { column: "model", direction: "descending" }).map((row) => row.model), ["Model 10", "Model 2", "Model 1"]);
  const tied = [rows[0], { ...rows[0], model: "Another model" }];
  assert.deepEqual(sortSummaryRows(tied, DEFAULT_SUMMARY_SORT), tied, "Equal scores retain existing tie order");
});
