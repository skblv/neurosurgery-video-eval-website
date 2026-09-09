import assert from "node:assert/strict";
import { test } from "node:test";
import { MODEL_RELEASES } from "../src/data/modelReleases.ts";
import { releasePoints, releaseTimestamp, releasePlotLayout, releaseFamilies } from "../src/data/releasePlot.ts";

test("release dates are strict UTC dates backed by original developer sources", () => {
  const hosts = new Set(["developers.googleblog.com", "blog.google", "www.anthropic.com", "platform.claude.com", "openai.com", "www.kimi.com", "docs.x.ai", "github.com", "z.ai", "www.alibabacloud.com"]);
  assert.equal(Object.keys(MODEL_RELEASES).length, 21);
  for (const [id, release] of Object.entries(MODEL_RELEASES)) {
    assert.notEqual(releaseTimestamp(release.date), null, id);
    const url = new URL(release.source);
    assert.equal(url.protocol, "https:");
    assert(hosts.has(url.hostname), `${id}: original developer source`);
    if (url.hostname === "github.com") assert(url.pathname.startsWith("/QwenLM/"));
  }
  assert.equal(MODEL_RELEASES["qwen3-8-max-0902"].date, "2026-09-02");
  assert(!MODEL_RELEASES["qwen3-8-max"], "Do not merge different Max versions");
  assert.equal(MODEL_RELEASES["gpt-5_6-sol"].date, "2026-06-26", "Count the released limited preview, not its later GA");
  assert.equal(MODEL_RELEASES["kimi-k3"].date, "2026-07-16", "Hosted launch precedes the weight release");
  for (const date of ["", "unknown", "2026-02-30", "2026-13-01", "2026-9-1", "2026-09-01T00:00:00Z"]) assert.equal(releaseTimestamp(date), null);
});

test("points preserve exact table totals, keep incomplete models, and never invent missing dates or scores", () => {
  const model = { id: "gpt-6-astra", model: "GPT-6 Astra", provider: "openai", total: 0.733417472 };
  const rows = [model,
    { ...model, id: "qwen3-8-max-0902", total: 0.702 },
    { ...model, id: "unknown-model" },
    { ...model, id: "kimi-k3", total: null },
    { ...model, id: "gpt-5_4", total: Number.NaN },
  ];
  const before = structuredClone(rows);
  const points = releasePoints(rows);
  assert.deepEqual(points.map((point) => point.id), ["qwen3-8-max-0902", "gpt-6-astra"]);
  assert.equal(points[1].total, model.total);
  assert.equal(points[1].releasedAt, Date.UTC(2026, 8, 3));
  assert.deepEqual(rows, before);
});

test("responsive layout preserves dates and scores without jitter or clipping", () => {
  const rows = Object.keys(MODEL_RELEASES).map((id, index) => ({ id, model: id, total: 0.48 + index / 100, provider: id.split("-")[0] }));
  const points = releasePoints(rows);
  for (const width of [480, 920]) {
    const layout = releasePlotLayout(points, width, 480);
    assert.equal(Math.max(...layout.yTicks), 1);
    assert.equal(layout.y(1), layout.bounds.top);
    for (const point of layout.points) {
      assert.equal(point.x, layout.x(point.releasedAt));
      assert.equal(point.y, layout.y(point.total));
      assert(point.x >= layout.bounds.left && point.x <= layout.bounds.right);
      assert(point.y >= layout.bounds.top && point.y <= layout.bounds.bottom);
      assert(!("label" in point), "Logo markers have no persistent model-name labels");
    }
    const repeated = releasePlotLayout(points, width, 480);
    assert.deepEqual(repeated.points, layout.points, "Deterministic SSR/client geometry");
    assert.deepEqual(repeated.xTicks, layout.xTicks);
    assert.deepEqual(repeated.yTicks, layout.yTicks);
  }
  const empty = releasePlotLayout([], 480, 480);
  assert.equal(empty.points.length, 0);
  assert(empty.yTicks.every(Number.isFinite));
});

test("release-date maximum stays at one while preserving below-chance totals", () => {
  const points = releasePoints([{ id: "gpt-6-astra", model: "GPT-6 Astra", provider: "openai", total: -0.2 }]);
  const layout = releasePlotLayout(points, 920, 480);
  assert.equal(layout.yTicks.at(-1), 1);
  assert(layout.points[0].y > layout.y(0));
  assert(layout.points[0].y < layout.bounds.bottom);
});

test("family legend follows plotted provider coverage without duplicates", () => {
  const rows = ["openai", "gemini", "anthropic", "openai", "google", "qwen", "moonshot", "zai", "xai"].map((provider) => ({ id: "gpt-6-astra", model: "Fixture", provider, total: 0.5 }));
  const points = releasePoints(rows);
  assert.deepEqual(releaseFamilies(points), [
    { provider: "openai", label: "GPT" }, { provider: "anthropic", label: "Claude" },
    { provider: "gemini", label: "Gemini" }, { provider: "google", label: "Gemma" },
    { provider: "qwen", label: "Qwen" }, { provider: "moonshot", label: "Kimi" },
    { provider: "zai", label: "GLM" }, { provider: "xai", label: "Grok" },
  ]);
  assert.deepEqual(releaseFamilies(points.filter((point) => point.provider === "openai")), [{ provider: "openai", label: "GPT" }]);
  assert.deepEqual(releaseFamilies([]), []);
});
