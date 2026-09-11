import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";
import { importCompleted } from "./import-completed.ts";

function fixture() {
  const documents = ["results.json", "domainResults.json", "completedEvalProvenance.json"].map((file) =>
    JSON.parse(fs.readFileSync(new URL(`../src/data/${file}`, import.meta.url), "utf8")));
  const evaluation = documents[2].evaluations.find((row: { sourceRunId?: string }) =>
    row.sourceRunId === "summary_gaps_delm_20260907/glm-5_3-flash/cadis");
  assert.ok(evaluation);
  return { documents, bundle: { schemaVersion: 1, run: "summary_gaps_delm_20260907", generatedAt: documents[1].generatedAt, evaluations: [structuredClone(evaluation)] } };
}

test("completed import is idempotent and preserves unrelated results", () => {
  const { documents, bundle } = fixture();
  const before = structuredClone(documents);
  for (let i = 0; i < 2; i++) assert.deepEqual(importCompleted(bundle, documents[0], documents[1], documents[2]), ["glm-5_3-flash/cadis"]);
  assert.deepEqual(documents, before);
});

test("verified legacy exports keep their original source-run prefix", () => {
  const { documents, bundle } = fixture();
  bundle.run = "summary_gaps_20260907";
  bundle.evaluations[0].sourceRunId = "summary_gaps_20260907/glm-5_3-flash/cadis";
  importCompleted(bundle, documents[0], documents[1], documents[2]);
  assert.equal(documents[1].datasets.cadis.results.find((row: { id: string }) => row.id === "glm-5_3-flash").sourceRunId,
    "summary_gaps_20260907/glm-5_3-flash/cadis");
  assert.deepEqual(documents[2].runs, ["summary_gaps_20260907", "summary_gaps_delm_20260907"]);
});

test("rejects incomplete denominators, excluded datasets, duplicate pairs, and bad provenance", () => {
  for (const mutate of [
    (b: ReturnType<typeof fixture>["bundle"]) => { b.evaluations[0].sampleCount = 10; },
    (b: ReturnType<typeof fixture>["bundle"]) => { b.evaluations[0].result.n = 10; },
    (b: ReturnType<typeof fixture>["bundle"]) => { b.evaluations[0].dataset = "sdsc-eea"; },
    (b: ReturnType<typeof fixture>["bundle"]) => { b.evaluations.push(structuredClone(b.evaluations[0])); },
    (b: ReturnType<typeof fixture>["bundle"]) => { b.evaluations[0].sourceRunId = "wrong"; },
    (b: ReturnType<typeof fixture>["bundle"]) => { b.evaluations[0].result.website_entry.microF1.value = 101; },
  ]) {
    const { documents, bundle } = fixture();
    mutate(bundle);
    assert.throws(() => importCompleted(bundle, documents[0], documents[1], documents[2]));
  }
});
