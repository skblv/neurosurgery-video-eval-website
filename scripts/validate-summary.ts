/**
 * Build-time checks for the cross-modality summary: the 0–1 scale, equal
 * dataset weights, NA gaps, and the live specialist references.
 */

import assert from "node:assert/strict";

import rawResults from "../src/data/results.json" with { type: "json" };
import rawGestureResults from "../src/data/gestureResults.json" with { type: "json" };
import rawDomainResults from "../src/data/domainResults.json" with { type: "json" };
import { parseResultsFile } from "../src/data/resultsSchema.ts";
import { parseGestureResultsFile } from "../src/data/gestureResultsSchema.ts";
import { parseDomainResultsFile } from "../src/data/domainResultsSchema.ts";
import {
  buildSummaryModalities,
  calculateSummary,
  canonicalModelId,
  relativeScore,
  type SummaryDataset,
  type SummaryModality,
} from "../src/data/summaryScore.ts";

const LLM_PROVIDERS = new Set([
  "openai",
  "anthropic",
  "gemini",
  "google",
  "moonshot",
  "qwen",
]);

function fixture(
  id: string,
  majority: number,
  specialistScore: number,
  modelScore: number | null,
): SummaryDataset {
  return {
    id,
    name: id,
    specialistId: "specialist",
    specialistLabel: "Specialist",
    metric: "exactMatch",
    majority,
    majorityPublished: true,
    results: [
      {
        id: "specialist",
        model: "Specialist",
        provider: "internal",
        metrics: { exactMatch: { value: specialistScore } },
      },
      {
        id: "model",
        model: "Model",
        provider: "test",
        metrics: {
          exactMatch: modelScore === null ? null : { value: modelScore },
        },
      },
    ],
  };
}

function modality(id: string, datasets: SummaryDataset[]): SummaryModality {
  return {
    id,
    label: id,
    axisLabel: [id],
    specialistId: "specialist",
    specialistLabel: "Specialist",
    datasets,
  };
}

function scoredModel(modalities: SummaryModality[]) {
  const row = calculateSummary(modalities).find((item) => item.id === "model");
  if (!row) throw new Error("Expected the fixture model row");
  return row;
}

function close(actual: number | null, expected: number) {
  assert.ok(
    actual !== null && Math.abs(actual - expected) < 1e-12,
    `${actual} != ${expected}`,
  );
}

close(relativeScore(60, 20, 80), (60 - 20) / (80 - 20));
close(relativeScore(80, 20, 80), 1);
close(relativeScore(20, 20, 80), 0);
close(relativeScore(100, 20, 80), (100 - 20) / (80 - 20));
assert.throws(() => relativeScore(60, 80, 80), /must beat majority/);

const input = [
  modality("a", [
    fixture("a1", 20, 80, 60),
    fixture("a2", 10, 20, 15),
    fixture("a3", 0, 40, 40),
  ]),
  modality("b", [fixture("b1", 20, 80, 20)]),
];

const complete = scoredModel(input);
close(complete.modalities.a.datasets[0].ratio, (60 - 20) / (80 - 20));
close(complete.modalities.a.value, (((60 - 20) / (80 - 20)) + 0.5 + 1) / 3);
close(complete.modalities.b.value, 0);
close(complete.total, (complete.modalities.a.value! + 0) / 2);

const missingDataset = structuredClone(input);
missingDataset[0].datasets[1].results[1].metrics.exactMatch = null;
const partialDatasets = scoredModel(missingDataset);
assert.equal(partialDatasets.modalities.a.observed, 2);
close(
  partialDatasets.modalities.a.value,
  (((60 - 20) / (80 - 20)) + 1) / 2,
);
close(
  partialDatasets.total,
  (partialDatasets.modalities.a.value! + 0) / 2,
);

const missingModality = structuredClone(input);
missingModality[1].datasets[0].results.pop();
const partialModalities = scoredModel(missingModality);
assert.equal(partialModalities.modalities.b.value, null);
assert.equal(partialModalities.coverage, 1);
close(partialModalities.total, partialModalities.modalities.a.value!);

assert.equal(canonicalModelId("gpt-5-6-sol"), "gpt-5_6-sol");
assert.notEqual(canonicalModelId("lemon"), canonicalModelId("lemonfm-linear-probe"));
assert.notEqual(canonicalModelId("claude-opus-5"), canonicalModelId("claude-opus-4_6"));

const instruments = parseResultsFile(rawResults);
const gestures = parseGestureResultsFile(rawGestureResults);
const domains = parseDomainResultsFile(rawDomainResults);

function named(
  id: string,
  name: string,
  data: {
    majorityBaseline: Record<string, number | null>;
    results: { id: string; model: string; provider: string; metrics: Record<string, { value: number } | null> }[];
  },
) {
  return { id, name, majorityBaseline: data.majorityBaseline, results: data.results };
}

const SUMMARY_MODALITIES = buildSummaryModalities({
  instruments: [
    named("cholect50", "CholecT50", instruments.datasets.cholect50),
    named("pitvis", "PitVis-2023", instruments.datasets.pitvis),
    named("surgvu", "SurgVU", instruments.datasets.surgvu),
  ],
  gestures: named(
    gestures.benchmark.id,
    gestures.benchmark.name,
    { majorityBaseline: { exactAccuracy: null }, results: gestures.benchmark.results },
  ),
  anatomy: [
    named("dsad", "DSAD", domains.datasets.dsad),
    named("cadis", "CaDIS", domains.datasets.cadis),
    named("endoscapes", "Endoscapes", domains.datasets.endoscapes),
  ],
  skillAssessment: [named("sarrarp50", "SAR-RARP50", domains.datasets.sarrarp50)],
  clinicalContext: [named("pitvqa", "PitVQA", domains.datasets.pitvqa)],
  recommendations: [
    named("cholect50verbs", "CholecT50 verbs", domains.datasets.cholect50verbs),
    named("pitvissteps", "PitVis-2023 steps", domains.datasets.pitvissteps),
  ],
});

assert.deepEqual(
  SUMMARY_MODALITIES.map((item) => item.datasets.length),
  [3, 1, 3, 1, 1, 2],
);

const rows = calculateSummary(SUMMARY_MODALITIES);
assert.equal(rows.filter((row) => row.id === "gpt-5_6-sol").length, 1);

const yolo = rows.find((row) => row.id === "yolov12m");
if (!yolo) throw new Error("YOLOv12-m must appear in the summary");
close(yolo.modalities.instruments.value, 1);
assert.equal(yolo.modalities.gestures.value, null);
assert.equal(yolo.modalities.anatomy.value, null);
close(yolo.total, 1);

const resnet = rows.find((row) => row.id === "resnet50");
if (!resnet) throw new Error("ResNet-50 must appear in the summary");
close(resnet.modalities.anatomy.value, 1);
close(resnet.modalities["skill-assessment"].value, 1);
close(resnet.modalities["clinical-context"].value, 1);
close(resnet.modalities.recommendations.value, 1);
assert.equal(resnet.modalities.instruments.value, null);
close(resnet.total, 1);

const surgmotion = rows.find((row) => row.id === "surgmotion");
if (!surgmotion) throw new Error("SurgMotion must appear in the summary");
close(surgmotion.modalities.gestures.value, 1);
close(surgmotion.total, 1);

const sol = rows.find((row) => row.id === "gpt-5_6-sol");
if (!sol) throw new Error("GPT-5.6 Sol must appear in the summary");
assert.equal(sol.coverage, 6);
close(sol.modalities.gestures.value, 57.99 / 75.26);
close(
  sol.total,
  SUMMARY_MODALITIES.reduce((sum, item) => sum + sol.modalities[item.id].value!, 0) / 6,
);

const astra = rows.find((row) => row.id === "gpt-6-astra");
if (!astra) throw new Error("GPT-6 Astra must appear in the summary");
assert.equal(astra.modalities.gestures.value, null);
assert.equal(astra.coverage, 5);
assert.ok(astra.total !== null);

for (const item of SUMMARY_MODALITIES) {
  for (const dataset of item.datasets) {
    const specialist = rows.find((row) => row.id === dataset.specialistId);
    if (!specialist) {
      throw new Error(`Missing specialist row ${dataset.specialistId}`);
    }
    const ratio = specialist.modalities[item.id].datasets.find(
      (entry) => entry.datasetId === dataset.id,
    );
    if (!ratio) {
      throw new Error(`Missing specialist ratio for ${dataset.id}`);
    }
    close(ratio.ratio, 1);
  }
}

for (const row of rows) {
  assert.ok(row.total === null || Number.isFinite(row.total), `${row.id} total`);
  for (const item of SUMMARY_MODALITIES) {
    const score = row.modalities[item.id];
    assert.ok(
      score.value === null || Number.isFinite(score.value),
      `${row.id} ${item.id}`,
    );
  }
}

const llmRows = rows.filter((row) => LLM_PROVIDERS.has(row.provider));
assert.ok(llmRows.every((row) => LLM_PROVIDERS.has(row.provider)));
assert.equal(llmRows.some((row) => row.id === "yolov12m"), false);
assert.equal(llmRows.some((row) => row.id === "resnet50"), false);
assert.equal(llmRows.some((row) => row.id === "surgmotion"), false);
assert.equal(llmRows.some((row) => row.id === "gemma3-27b-lora"), false);
assert.ok(llmRows.some((row) => row.id === "gpt-6-astra"));

console.log(
  "Summary valid: majority=0, specialist=1, equal dataset weights, NA gaps, " +
    "and all specialist references.",
);
