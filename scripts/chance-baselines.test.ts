import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { chanceAdjustedScore } from "../src/data/summaryScoring.ts";
import { radarColor, radarProfiles, radarScale } from "../src/data/radarScale.ts";
import { plotMethodology } from "../src/data/plotMethodology.ts";
import type { SummaryDataset } from "../src/data/summaryScoring.ts";

test("published chance baselines reproduce from aggregate counts and match frozen evaluation hashes", () => {
  const baselines = JSON.parse(readFileSync("src/data/chanceBaselines.json", "utf8"));
  const provenance = JSON.parse(readFileSync("src/data/completedEvalProvenance.json", "utf8"));
  const datasets = { ...JSON.parse(readFileSync("src/data/results.json", "utf8")).datasets, ...JSON.parse(readFileSync("src/data/domainResults.json", "utf8")).datasets };
  assert.deepEqual(Object.keys(baselines.datasets).sort(), Object.keys(datasets).sort());
  for (const [id, raw] of Object.entries(baselines.datasets)) {
    const row = raw as { sampleCount: number; positiveLabelCount: number; labelCounts: Record<string, number>; labelSetCounts: { labels: string[]; count: number }[]; metrics: Record<string, number>; sample_sha256: string; source_sha256: string; label_sha256: string };
    const sample = provenance.evaluations.find((item: { model: string; dataset: string }) => item.model === "grok-4_6" && item.dataset === id);
    assert.equal(row.sampleCount, sample.sampleCount);
    assert.equal(row.sample_sha256, sample.provenance.sample_sha256);
    assert.match(row.source_sha256, /^[a-f0-9]{64}$/);
    assert.match(row.label_sha256, /^[a-f0-9]{64}$/);
    const counts = Object.values(row.labelCounts);
    assert.equal(row.positiveLabelCount, counts.reduce((a, b) => a + b, 0));
    assert.equal(row.sampleCount, row.labelSetCounts.reduce((sum, item) => sum + item.count, 0));
    assert.equal(row.metrics.microF1, 100 * counts.reduce((sum, n) => sum + n * n, 0) / (row.sampleCount * row.positiveLabelCount));
    assert.equal(row.metrics.exactMatch, 100 * row.labelSetCounts.reduce((sum, item) => sum + item.count * item.count, 0) / (row.sampleCount * row.sampleCount));
    const metric = id === "sarrarp50" ? "exactMatch" : "microF1";
    const specialist = datasets[id].results.find((result: { id: string }) => result.id === "yolov12m" || result.id === "resnet50").metrics[metric].value;
    assert(specialist > row.metrics[metric], `${id}: specialist exceeds chance; scale is non-degenerate`);
    assert.equal(chanceAdjustedScore(specialist, specialist, row.metrics[metric]), 1);
    assert.equal(chanceAdjustedScore(row.metrics[metric], specialist, row.metrics[metric]), 0);
  }
  assert(!baselines.datasets["continuous-obgyn-case-001"], "Do not invent an Action baseline from class count alone");
});

test("negative radar scores retain their axis and numeric ordering without clipping", () => {
  for (const values of [[-0.8, -0.1, 0, 0.5, 1, 1.3], [0.1, 0.2], [null]]) {
    const scale = radarScale(values);
    for (const value of values) {
      if (value === null) continue;
      assert(scale.fraction(value) >= 0);
      if (value <= 1) assert(scale.fraction(value) <= 1);
      assert(Math.abs(scale.valueAt(scale.fraction(value)) - value) < 1e-12);
    }
    assert(scale.fraction(0) < scale.fraction(1));
    assert.equal(scale.ceiling, 1, "Fixed outer axis maximum, even if future scores exceed the reference");
  }
});

test("legend profiles update on selection, addition, removal, and reordering", () => {
  const rows = ["a", "b", "c", "d", "e"].map((id) => ({ id, model: `Model ${id}`, scores: [id] }));
  for (const selection of [["a", "b"], ["c", "b"], ["c", "b", "d"], ["d"], ["e", "d", "c", "b", "a"], []]) {
    const profiles = radarProfiles(selection, rows);
    assert.deepEqual(profiles.map((row) => row.id), selection);
    profiles.forEach((row, index) => {
      assert.equal(row.color, radarColor(index));
      assert.equal(row.model, `Model ${selection[index]}`);
      assert.deepEqual(row.scores, [row.id]);
    });
  }
});

test("methodology uses the requested wording and lists only included datasets", () => {
  const dataset: SummaryDataset = { id: "d1", name: "Dataset one", metric: "microF1", referenceId: "s", chance: 20, results: [] };
  const modalities = [{ id: "m1", label: "Modality one", datasets: [dataset] }, { id: "action", label: "Action", datasets: [{ ...dataset, chance: null }] }];
  const footer = plotMethodology(modalities);
  assert.equal(footer, "The plot shows a weighted average zero-shot performance of LLMs on surgical modalities. 1 means as good as a specialized computer-vision model and 0 means as good as chance. Modalities include Modality one (Dataset one).");
  assert(!footer.includes("Action"));
});
