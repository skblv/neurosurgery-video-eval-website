import assert from "node:assert/strict";
import { test } from "node:test";
import { calculateSummary, chanceAdjustedScore, type SummaryDataset } from "../src/data/summaryScoring.ts";

function dataset(id: string, value: number | null, reference = 80, chance: number | null = 0): SummaryDataset {
  return { id, name: id, metric: "accuracy", referenceId: "specialist", chance, results: [
    { id: "specialist", model: "Specialist", value: reference },
    { id: "llm", model: "LLM", value },
  ] };
}

test("chance adjustment anchors chance at zero and specialist at one, retaining negative and above-one scores", () => {
  assert.equal(chanceAdjustedScore(20, 80, 20), 0);
  assert.equal(chanceAdjustedScore(80, 80, 20), 1);
  assert.equal(chanceAdjustedScore(50, 80, 20), 0.5);
  assert.equal(chanceAdjustedScore(5, 80, 20), -0.25);
  assert.equal(chanceAdjustedScore(95, 80, 20), 1.25);
  for (const [value, reference, chance] of [[null, 80, 20], [50, null, 20], [50, 80, null], [50, 20, 20], [50, 10, 20], [NaN, 80, 20], [50, Infinity, 20], [50, 80, NaN]]) {
    assert.equal(chanceAdjustedScore(value, reference, chance), null);
  }
});

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

test("uses each dataset's verified chance before averaging, without treating missing baselines as zero", () => {
  const rows = calculateSummary([
    { id: "a", label: "A", datasets: [dataset("a1", 50, 80, 20), dataset("a2", 20, 80, 20), dataset("a3", 95, 80, 20)] },
    { id: "b", label: "B", datasets: [dataset("b1", 10, 60, 20)] },
    { id: "missing", label: "Missing chance", datasets: [dataset("old-action", 60, 80, null)] },
  ]);
  const row = rows.find((item) => item.id === "llm")!;
  assert.deepEqual(row.scores[0].datasets, [0.5, 0, 1.25]);
  assert.equal(row.scores[1].value, -0.25);
  assert.equal(row.scores[2].value, null);
  assert.equal(row.total, ((0.5 + 0 + 1.25) / 3 - 0.25) / 2);
  assert.equal(row.covered, 4);
  const specialist = rows.find((item) => item.id === "specialist")!;
  assert.equal(specialist.total, 1);
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
