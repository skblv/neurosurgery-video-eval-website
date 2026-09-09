import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { isLeaderboardModelVisible } from "../src/data/leaderboardVisibility.ts";

test("releases verified Grok and Qwen 0902 while retaining the unavailable older Max hold", () => {
  assert.equal(isLeaderboardModelVisible({ id: "qwen3-8-max" }), false);
  for (const id of ["qwen3-8-max-0902", "grok-4_6", "qwen3-8-27b", "kimi-k3", "glm-5_3-flash", "yolov12m"]) {
    assert.equal(isLeaderboardModelVisible({ id }), true);
  }
});

test("released models retain complete frozen denominators and source provenance for every imported run", () => {
  const instruments = JSON.parse(readFileSync("src/data/results.json", "utf8"));
  const domains = JSON.parse(readFileSync("src/data/domainResults.json", "utf8"));
  const provenance = JSON.parse(readFileSync("src/data/completedEvalProvenance.json", "utf8"));
  const datasets = { ...instruments.datasets, ...domains.datasets };
  const expectedBoards = {
    "grok-4_6": Object.keys(datasets),
    "qwen3-8-max-0902": Object.keys(domains.datasets),
  };
  for (const [model, boards] of Object.entries(expectedBoards)) {
    const evaluations = provenance.evaluations.filter((row: { model: string }) => row.model === model);
    assert.deepEqual(evaluations.map((row: { dataset: string }) => row.dataset).sort(), [...boards].sort());
    for (const evaluation of evaluations) {
      const expected = ({ cadis: 534, endoscapes: 409, sarrarp50: 636 } as Record<string, number>)[evaluation.dataset] ?? 1000;
      const row = datasets[evaluation.dataset].results.find((result: { id: string }) => result.id === model);
      assert(row);
      assert.equal(evaluation.sampleCount, expected);
      assert.equal(evaluation.result.n, expected);
      assert.equal(row.sourceRunId, evaluation.sourceRunId);
      assert.deepEqual(row.metrics, evaluation.result.website_entry);
      for (const key of ["prompt_sha256", "schema_sha256", "sample_sha256"]) {
        assert.match(evaluation.provenance[key], /^[a-f0-9]{64}$/);
      }
    }
  }
  for (const dataset of Object.values(instruments.datasets) as { results: { id: string }[] }[]) {
    assert(dataset.results.some((row) => row.id === "qwen3-8-max"), "Historical scores are not deleted");
    assert(!dataset.results.some((row) => row.id === "qwen3-8-max-0902"), "Do not relabel an unverified model version");
  }
});
