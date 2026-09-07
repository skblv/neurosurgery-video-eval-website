import assert from "node:assert/strict";
import { test } from "node:test";
import { calculateSummary, type SummaryDataset } from "../src/data/summaryScoring.ts";

function dataset(id: string, value: number | null, reference = 80): SummaryDataset {
  return { id, name: id, metric: "accuracy", referenceId: "specialist", results: [
    { id: "specialist", model: "Specialist", value: reference },
    { id: "llm", model: "LLM", value },
  ] };
}

test("normalizes datasets before averaging, with equal modality weights", () => {
  const rows = calculateSummary([
    { id: "a", label: "A", datasets: [dataset("a1", 60), dataset("a2", 40), dataset("a3", 80)] },
    { id: "b", label: "B", datasets: [dataset("b1", 20, 40)] },
  ]);
  const row = rows.find((item) => item.id === "llm")!;
  assert.deepEqual(row.scores[0].datasets, [0.75, 0.5, 1]);
  assert.equal(row.scores[0].value, 0.75);
  assert.equal(row.total, 0.625);
});

test("retains incomplete models, excludes NA, and preserves above-reference scores", () => {
  const rows = calculateSummary([
    { id: "a", label: "A", datasets: [dataset("a1", 100), dataset("a2", null)] },
    { id: "b", label: "B", datasets: [dataset("b1", 60, 0)] },
  ]);
  const row = rows.find((item) => item.id === "llm")!;
  assert.equal(row.total, 1.25);
  assert.equal(row.covered, 1);
  assert.deepEqual(row.scores[0].datasets, [1.25, null]);
  assert.equal(row.scores[1].value, null);
});

test("merges the known Sol alias, retains models even with no valid scores", () => {
  const first = dataset("a", null);
  first.results.push({ id: "gpt-5-6-sol", model: "GPT-5.6 Sol", value: 40 });
  const second = dataset("b", null);
  second.results.push({ id: "gpt-5_6-sol", model: "GPT-5.6 Sol", value: 80 });
  const rows = calculateSummary([{ id: "a", label: "A", datasets: [first, second] }]);
  assert.equal(rows.filter((row) => row.id === "gpt-5_6-sol").length, 1);
  assert.equal(rows.find((row) => row.id === "gpt-5_6-sol")!.total, 0.75);
  assert.equal(rows.find((row) => row.id === "llm")!.total, null);
});
