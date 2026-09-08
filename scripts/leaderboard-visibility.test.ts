import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { isLeaderboardModelVisible } from "../src/data/leaderboardVisibility.ts";

test("holds unfinished Qwen Max aliases and Grok, without hiding completed Qwen 27B", () => {
  for (const id of ["qwen3-8-max", "qwen3-8-max-0902", "grok-4_6"]) {
    assert.equal(isLeaderboardModelVisible({ id }), false);
  }
  for (const id of ["qwen3-8-27b", "kimi-k3", "glm-5_3-flash", "yolov12m"]) {
    assert.equal(isLeaderboardModelVisible({ id }), true);
  }
});

test("publication holds do not delete the saved scores or completion provenance", () => {
  const domains = JSON.parse(readFileSync("src/data/domainResults.json", "utf8"));
  const provenance = JSON.parse(readFileSync("src/data/completedEvalProvenance.json", "utf8"));
  for (const id of ["qwen3-8-max-0902", "grok-4_6"]) {
    assert(domains.datasets.endoscapes.results.some((row: { id: string }) => row.id === id));
    assert(provenance.evaluations.some((row: { model: string; dataset: string }) => row.model === id && row.dataset === "endoscapes"));
  }
});
