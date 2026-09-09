import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { isNewModel, MODEL_PUBLISHED_ON, NEW_BADGE_DAYS } from "../src/data/leaderboard.ts";
import { MODEL_RELEASES } from "../src/data/modelReleases.ts";

test("New badges use the historical plot's release dates, not leaderboard addition dates", () => {
  assert.equal(NEW_BADGE_DAYS, 14);
  assert.deepEqual(MODEL_PUBLISHED_ON, Object.fromEntries(Object.entries(MODEL_RELEASES).map(([id, release]) => [id, release.date])));
  assert.equal(MODEL_PUBLISHED_ON["claude-fable-5_1"], "2026-09-01");
  assert.equal(MODEL_PUBLISHED_ON["gpt-6-astra"], "2026-09-03");
  assert.equal(MODEL_PUBLISHED_ON["qwen3-8-max-0902"], "2026-09-02");
});

test("every model's badge lasts exactly fourteen days from release, measured in UTC", () => {
  for (const [id, release] of Object.entries(MODEL_RELEASES)) {
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
    "claude-fable-5_1", "gemini-3_8-flash", "qwen3-8-max-0902", "gpt-6-astra",
  ]);
  for (const id of ["qwen3-8-27b", "qwen3-8-max", "sdsc-uchicago-reference", "lemonfm-linear-probe", "unknown"]) {
    assert.equal(isNewModel(id, now), false, id);
  }
  assert.equal(isNewModel("qwen3-8-max-0902", new Date("2026-09-15T18:59:59-05:00")), true);
  assert.equal(isNewModel("qwen3-8-max-0902", new Date("2026-09-15T19:00:00-05:00")), false);
  assert.equal(isNewModel("qwen3-8-max-0902", new Date(NaN)), false);
});

test("prerendered tables never bake in New badges that could outlive their release window", () => {
  for (const route of ["", "instruments/", "anatomy/"]) {
    const html = readFileSync(`dist/${route}index.html`, "utf8");
    assert(!html.includes('class="badge-new"'), route || "summary");
  }
});
