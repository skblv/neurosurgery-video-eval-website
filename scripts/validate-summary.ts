import assert from "node:assert/strict";
import { calculateSummary, canonicalModelId, SUMMARY_MODALITIES, type SummaryModality } from "../src/data/summary.ts";

function fixture(id: string, baseline: number, score: number | null) {
  return {
    id, name: id, specialistId: "specialist", primaryMetric: "microF1" as const,
    results: [
      { id: "specialist", model: "Specialist", provider: "internal", metrics: { microF1: { value: baseline } } },
      { id: "model", model: "Model", provider: "test", metrics: { microF1: score === null ? null : { value: score } } },
    ],
  };
}

function model(modalities: SummaryModality[]) {
  return calculateSummary("primary", modalities).find((row) => row.id === "model")!;
}

function close(actual: number | null, expected: number) {
  assert.ok(actual !== null && Math.abs(actual - expected) < 1e-12, `${actual} != ${expected}`);
}

const input: SummaryModality[] = [
  { id: "a", label: "A", axisLabel: ["A"], datasets: [fixture("a1", 80, 60), fixture("a2", 20, 10), fixture("a3", 40, 40)] },
  { id: "b", label: "B", axisLabel: ["B"], datasets: [fixture("b1", 80, 20)] },
];
const result = model(input);
close(result.modalities.a.datasets[0].ratio, 60 / 80);
close(result.modalities.a.value, (0.75 + 0.5 + 1) / 3);
close(result.total, 0.5); // Equal modalities, not a pooled four-dataset mean (0.625).

const missing = structuredClone(input);
missing[0].datasets[1].results[1].metrics.microF1 = null;
const incomplete = model(missing);
assert.equal(incomplete.modalities.a.value, null);
assert.equal(incomplete.modalities.a.observed, 2);
assert.equal(incomplete.total, null);
close(incomplete.partialTotal, 0.25);
assert.equal(incomplete.datasetCoverage, 3);
missing[1].datasets[0].results.pop();
assert.equal(model(missing).partialTotal, null);

close(model([{ ...input[0], datasets: [fixture("zero", 80, 0)] }]).total, 0);
close(model([{ ...input[0], datasets: [fixture("above", 80, 100)] }]).total, 1.25);
assert.throws(() => model([{ ...input[0], datasets: [fixture("invalid", 0, 60)] }]), /specialist/);
assert.equal(canonicalModelId("gpt-5-6-sol"), "gpt-5_6-sol");
assert.notEqual(canonicalModelId("lemon"), canonicalModelId("lemonfm-linear-probe"));
assert.notEqual(canonicalModelId("claude-opus-5"), canonicalModelId("claude-opus-4_6"));

// Real-data checks exercise the same normalization and joins used by the page.
assert.deepEqual(SUMMARY_MODALITIES.map((item) => item.datasets.length), [3, 1, 3, 1, 1, 2]);
for (const mode of ["primary", "accuracy"] as const) {
  const rows = calculateSummary(mode);
  assert.equal(rows.filter((row) => row.id === "gpt-5_6-sol").length, 1);
  const sol = rows.find((row) => row.id === "gpt-5_6-sol")!;
  assert.equal(sol.coverage, 6);
  assert.equal(sol.datasetCoverage, 11);
  close(sol.modalities.gestures.value, 57.99 / 75.26);
  close(sol.total, SUMMARY_MODALITIES.reduce((sum, item) => sum + sol.modalities[item.id].value!, 0) / 6);
  const astra = rows.find((row) => row.id === "gpt-6-astra")!;
  assert.equal(astra.total, null);
  assert.equal(astra.coverage, 5);
  for (const modality of SUMMARY_MODALITIES) {
    for (const dataset of modality.datasets) {
      const specialist = rows.find((row) => row.id === dataset.specialistId)!;
      const ratio = specialist.modalities[modality.id].datasets.find((item) => item.datasetId === dataset.id)!;
      close(ratio.ratio, 1);
    }
  }
}
console.log("Summary valid: hierarchical weights, missing data, zero scores, uncapped ratios, model identities, and all 11 specialist references (both metric modes).");
