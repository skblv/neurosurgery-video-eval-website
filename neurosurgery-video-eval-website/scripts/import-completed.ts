/** Import the backend's verified, completed-only export without touching other rows. */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { parseResultsFile } from "../src/data/resultsSchema.ts";
import { parseDomainResultsFile } from "../src/data/domainResultsSchema.ts";

const MODELS: Record<string, [string, string]> = {
  "glm-5_3-flash": ["GLM-5.3-Flash", "zai"],
  "grok-4_6": ["Grok 4.6", "xai"],
  "qwen3-8-27b": ["Qwen3.8 27B", "qwen"],
  "qwen3-8-max-0902": ["Qwen3.8 Max 0902", "qwen"],
  "kimi-k3": ["Kimi K3", "moonshot"],
  "gemini-3_7-flash": ["Gemini 3.7 Flash", "gemini"],
};

type Metric = { value: number; ciLow: number | null; ciHigh: number | null };
type Evaluation = {
  model: string; dataset: string; sampleCount: number; sourceRunId: string;
  result: { n: number; website_entry: { exactMatch: Metric; microF1: Metric }; parse_failures: number; refusals: number };
  provenance: Record<string, unknown>;
};
type Document = { generatedAt: string; datasets: Record<string, { results: Record<string, unknown>[] }> };
type Provenance = { evaluations: (Evaluation | Record<string, unknown>)[]; [key: string]: unknown };

export function importCompleted(bundle: { schemaVersion: number; run: string; generatedAt: string; evaluations: Evaluation[] },
  instruments: Document, domains: Document, provenance: Provenance) {
  assert.equal(bundle.schemaVersion, 1);
  assert.ok(["summary_gaps_20260907", "summary_gaps_delm_20260907"].includes(bundle.run), "Unknown source run");
  assert.ok(Number.isFinite(Date.parse(bundle.generatedAt)));
  const seen = new Set<string>();
  const changes: string[] = [];
  for (const evaluation of bundle.evaluations) {
    const { model, dataset, result } = evaluation;
    const pair = `${model}/${dataset}`;
    assert.ok(!seen.has(pair), `Duplicate evaluation: ${pair}`);
    seen.add(pair);
    assert.ok(MODELS[model], `Unknown model: ${model}`);
    const document = Object.hasOwn(instruments.datasets, dataset) ? instruments : domains;
    assert.ok(Object.hasOwn(document.datasets, dataset), `Dataset outside website scope: ${dataset}`);
    const expected = ({ cadis: 534, endoscapes: 409, sarrarp50: 636 } as Record<string, number>)[dataset] ?? 1000;
    assert.equal(evaluation.sampleCount, expected, `Incomplete sample: ${pair}`);
    assert.equal(result.n, expected, `Incomplete denominator: ${pair}`);
    assert.equal(evaluation.sourceRunId, `${bundle.run}/${pair}`);
    for (const count of [result.parse_failures, result.refusals]) assert.ok(Number.isInteger(count) && count >= 0 && count <= expected);
    assert.ok(evaluation.provenance.prompt_sha256 && evaluation.provenance.schema_sha256 && evaluation.provenance.sample_sha256);
    const [name, provider] = MODELS[model];
    const entry = { id: model, model: name, provider, sourceRunId: evaluation.sourceRunId, metrics: result.website_entry };
    const rows = document.datasets[dataset].results;
    const existing = rows.findIndex((row) => row.id === model);
    if (existing < 0) rows.push(entry);
    else rows[existing] = entry;
    const provenanceIndex = provenance.evaluations.findIndex((row) => row.model === model && row.dataset === dataset);
    if (provenanceIndex < 0) provenance.evaluations.push(evaluation);
    else provenance.evaluations[provenanceIndex] = evaluation;
    document.generatedAt = bundle.generatedAt;
    changes.push(pair);
  }
  provenance.runs = ["summary_gaps_20260907", "summary_gaps_delm_20260907"];
  provenance.note = "Completed runs only. Original prompts/schemas; parse failures and refusals retained in scoring. Action and SDSC-EEA excluded. Maximum 1000 fixed seed-42 validation samples per dataset; all validation examples when fewer exist.";
  parseResultsFile(instruments);
  parseDomainResultsFile(domains);
  return changes;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const input = process.argv[2];
  assert.ok(input, "Usage: node --experimental-strip-types scripts/import-completed.ts EXPORT.json [--apply]");
  const files = ["results.json", "domainResults.json", "completedEvalProvenance.json"].map((name) => path.resolve("src/data", name));
  const documents = files.map((file) => JSON.parse(fs.readFileSync(file, "utf8")));
  const bundle = JSON.parse(fs.readFileSync(input, "utf8"));
  const changes = importCompleted(bundle, documents[0], documents[1], documents[2]);
  if (process.argv.includes("--apply")) {
    for (let i = 0; i < files.length; i++) fs.writeFileSync(files[i], JSON.stringify(documents[i], null, 2) + "\n");
  }
  console.log(JSON.stringify({ applied: process.argv.includes("--apply"), count: changes.length, changes }, null, 2));
}
