import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { isNewModel, MODEL_PUBLISHED_ON, NEW_BADGE_DAYS, MANUALLY_BADGED_MODEL_IDS } from "../src/data/leaderboard.ts";
import { MODEL_RELEASES } from "../src/data/modelReleases.ts";
import rawGestureResults from "../src/data/gestureResults.json" with { type: "json" };
import { parseGestureResultsFile } from "../src/data/gestureResultsSchema.ts";

test("New badges use the historical plot's release dates, not leaderboard addition dates", () => {
  assert.equal(NEW_BADGE_DAYS, 14);
  assert.deepEqual(MODEL_PUBLISHED_ON, Object.fromEntries(Object.entries(MODEL_RELEASES).map(([id, release]) => [id, release.date])));
  assert.equal(MODEL_PUBLISHED_ON["claude-fable-5_1"], "2026-09-01");
  assert.equal(MODEL_PUBLISHED_ON["gpt-6-astra"], "2026-09-03");
  assert.equal(MODEL_PUBLISHED_ON["qwen3-8-max-0902"], "2026-09-02");
});

test("release-based badges last exactly fourteen days from release, measured in UTC", () => {
  for (const [id, release] of Object.entries(MODEL_RELEASES)) {
    if (id === "gemini-4-argon") continue;
    const start = Date.parse(`${release.date}T00:00:00Z`);
    const end = start + 14 * 24 * 60 * 60 * 1000;
    assert.equal(isNewModel(id, new Date(start - 1)), false, `${id}: not before release`);
    assert.equal(isNewModel(id, new Date(start)), true, `${id}: on release`);
    assert.equal(isNewModel(id, new Date(end - 1)), true, `${id}: last millisecond`);
    assert.equal(isNewModel(id, new Date(end)), false, `${id}: expires at fourteen days`);
    assert.equal(isNewModel(id, new Date(end + 1)), false, `${id}: after expiration`);
  }
});

test("Qwen Max 0902 is new, while older Qwen and unknown or composite releases are not", () => {
  const now = new Date("2026-09-09T03:00:00Z");
  assert.deepEqual(Object.keys(MODEL_RELEASES).filter((id) => isNewModel(id, now)), [
    "claude-fable-5_1", "gemini-3_8-flash", "qwen3-8-max-0902", "gpt-6-astra", "gemini-4-argon",
  ]);
  for (const id of ["qwen3-8-27b", "qwen3-8-max", "sdsc-uchicago-reference", "lemonfm-linear-probe", "unknown"]) {
    assert.equal(isNewModel(id, now), false, id);
  }
  assert.equal(isNewModel("qwen3-8-max-0902", new Date("2026-09-15T18:59:59-05:00")), true);
  assert.equal(isNewModel("qwen3-8-max-0902", new Date("2026-09-15T19:00:00-05:00")), false);
  assert.equal(isNewModel("qwen3-8-max-0902", new Date(NaN)), false);
});

test("Gemini 4 Argon is the only model pinned as New", () => {
  assert.deepEqual([...MANUALLY_BADGED_MODEL_IDS], ["gemini-4-argon"]);
  assert.equal(MODEL_PUBLISHED_ON["gemini-4-argon"], "2026-09-30");
  const afterReleaseWindows = new Date("2026-12-31T12:00:00Z");
  assert.deepEqual(Object.keys(MODEL_RELEASES).filter((id) => isNewModel(id, afterReleaseWindows)), ["gemini-4-argon"]);
  assert.equal(isNewModel("claude-fable-5_1", afterReleaseWindows), false);
  assert.equal(isNewModel("claude-opus-5", afterReleaseWindows), false);
});

test("the two new Actions results use release-aware badge ids", () => {
  const actions = parseGestureResultsFile(rawGestureResults).benchmark.results;
  const added = actions.filter(({ id }) => id === "claude-fable-5_1" || id === "gpt-6-astra");

  assert.deepEqual(added.map(({ id }) => id).sort(), ["claude-fable-5_1", "gpt-6-astra"]);
  for (const result of added) {
    assert.equal(isNewModel(result.id, new Date("2026-09-11T18:41:02Z")), true, result.model);
  }
});

test("the Actions data uses the matched Opus 5 primary-gesture evaluation", () => {
  const opus = parseGestureResultsFile(rawGestureResults).benchmark.results.find(
    ({ id }) => id === "claude-opus-5",
  );

  assert(opus);
  assert.deepEqual(
    Object.fromEntries(Object.entries(opus.metrics).map(([metric, result]) => [metric, result.value])),
    { exactAccuracy: 61.64, macroF1: 46.08, weightedF1: 60.60 },
  );
});

test("the Actions data publishes MViT as the specialist reference result", () => {
  const mvit = parseGestureResultsFile(rawGestureResults).benchmark.results.find(
    ({ id }) => id === "mvit-multi-task",
  );

  assert(mvit);
  assert.equal(mvit.model, "SDSC MViT Multi-Task");
  assert.equal(mvit.provider, "internal");
  assert.deepEqual(
    Object.fromEntries(Object.entries(mvit.metrics).map(([metric, result]) => [metric, result.value])),
    { exactAccuracy: 85.50, macroF1: 82.10, weightedF1: 83.50 },
  );
});

test("the Actions data publishes Gemini 3.8 Flash", () => {
  const gemini = parseGestureResultsFile(rawGestureResults).benchmark.results.find(
    ({ id }) => id === "gemini-3_8-flash",
  );

  assert(gemini);
  assert.equal(gemini.model, "Gemini 3.8 Flash");
  assert.equal(gemini.provider, "gemini");
  assert.deepEqual(
    Object.fromEntries(Object.entries(gemini.metrics).map(([metric, result]) => [metric, result.value])),
    { exactAccuracy: 66.40, macroF1: 44.60, weightedF1: 62.80 },
  );
});

test("the Actions data no longer publishes Claude Opus 4.8", () => {
  const actions = parseGestureResultsFile(rawGestureResults).benchmark.results;

  assert(!actions.some(({ id, model }) => id === "claude-opus-4_8" || model === "Claude Opus 4.8"));
});

test("prerendered tables never bake in New badges that could outlive their release window", () => {
  for (const route of ["", "instruments/", "anatomy/"]) {
    const html = readFileSync(`dist/${route}index.html`, "utf8");
    assert(!html.includes('class="badge-new"'), route || "summary");
  }
});

test("summary model titles reserve an inline badge slot without creating a separate badge line", () => {
  const html = readFileSync("dist/index.html", "utf8");
  assert.equal([...html.matchAll(/class="summary-model-title"><span>/g)].length, 24);
  const css = readFileSync("src/index.css", "utf8");
  assert.match(css, /\.summary-model-title\s*\{[^}]*display: inline-flex;[^}]*flex-wrap: nowrap;[^}]*white-space: nowrap;/);
  assert.match(css, /\.summary-model-title > \.badge-new\s*\{[^}]*flex: none;[^}]*margin-left: 0;/);
  assert.match(css, /@media \(max-width: 650px\)\s*\{[\s\S]*?\.summary-model-title\s*\{\s*white-space: normal;/, "Phone names can still wrap beside the badge within the sticky column");
});

test("phone-width charts retain New badges beside model names", () => {
  const source = readFileSync("src/components/StackedBars.tsx", "utf8");
  assert.match(source, /badgeDate && isNewModel\(row\.id, badgeDate\) \? <span className="badge-new">New<\/span>/);
});
