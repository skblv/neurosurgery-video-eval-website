import assert from "node:assert/strict";
import { test } from "node:test";
import { singleModelFrontier, staircasePath } from "../src/data/paretoFrontier.ts";

test("single-model frontier removes dominated points and sorts by cost without mutating input", () => {
  const points = [
    { id: "expensive-worse", costPerMillionFrames: 100, total: 0.3 },
    { id: "best", costPerMillionFrames: 60, total: 0.8 },
    { id: "cheap", costPerMillionFrames: 10, total: 0.2 },
    { id: "middle", costPerMillionFrames: 30, total: 0.5 },
  ];
  const originalOrder = points.map((point) => point.id);
  assert.deepEqual(singleModelFrontier(points).map((point) => point.id), ["cheap", "middle", "best"]);
  assert.deepEqual(points.map((point) => point.id), originalOrder);
});

test("same cost keeps the highest score, and a later equal score is dominated", () => {
  const points = [
    { id: "lower", costPerMillionFrames: 10, total: 0.1 },
    { id: "higher", costPerMillionFrames: 10, total: 0.4 },
    { id: "equal-later", costPerMillionFrames: 20, total: 0.4 },
    { id: "next", costPerMillionFrames: 30, total: 0.6 },
  ];
  assert.deepEqual(singleModelFrontier(points).map((point) => point.id), ["higher", "next"]);
});

test("individual-model frontier retains inward points instead of convexifying them", () => {
  const points = [
    { id: "a", costPerMillionFrames: 1, total: 0.1 },
    { id: "b", costPerMillionFrames: 2, total: 0.15 },
    { id: "c", costPerMillionFrames: 3, total: 0.5 },
  ];
  assert.deepEqual(singleModelFrontier(points).map((point) => point.id), ["a", "b", "c"]);
});

test("each model group has its own frontier and generic model fields are preserved", () => {
  const points = [
    { id: "llm-cheap", group: "llm", costPerMillionFrames: 10, total: 0.2 },
    { id: "llm-best", group: "llm", costPerMillionFrames: 30, total: 0.6 },
    { id: "specialist", group: "specialised", costPerMillionFrames: 1, total: 1 },
  ];
  const llms = singleModelFrontier(points.filter((point) => point.group === "llm"));
  const specialised = singleModelFrontier(points.filter((point) => point.group === "specialised"));
  assert.deepEqual(llms.map((point) => [point.id, point.group]), [["llm-cheap", "llm"], ["llm-best", "llm"]]);
  assert.deepEqual(specialised.map((point) => point.id), ["specialist"]);
});

test("invalid nonfinite and negative records are omitted while zero cost remains valid geometry", () => {
  const points = [
    { id: "free", costPerMillionFrames: 0, total: 0.1 },
    { id: "negative", costPerMillionFrames: -1, total: 0.9 },
    { id: "nan", costPerMillionFrames: NaN, total: 0.9 },
    { id: "infinite", costPerMillionFrames: 1, total: Infinity },
    { id: "valid", costPerMillionFrames: 10, total: 0.2 },
  ];
  assert.deepEqual(singleModelFrontier(points).map((point) => point.id), ["free", "valid"]);
});

test("staircase stays at the old score until the next model cost, then jumps vertically", () => {
  // In SVG, higher performance is represented by a lower y coordinate.
  const path = staircasePath([{ x: 10, y: 80 }, { x: 30, y: 50 }, { x: 90, y: 20 }]);
  assert.equal(path, "M 10 80 H 30 V 50 H 90 V 20");
  assert(!path.includes(" L "), "No diagonal interpolation between individual model choices");
});

test("staircase extends the final score only when an explicit later right edge is supplied", () => {
  const points = [{ x: 10, y: 80 }, { x: 30, y: 50 }];
  assert.equal(staircasePath(points, 100), "M 10 80 H 30 V 50 H 100");
  assert.equal(staircasePath(points), "M 10 80 H 30 V 50");
  assert.equal(staircasePath(points, 20), "M 10 80 H 30 V 50");
  assert.equal(staircasePath(points, Infinity), "M 10 80 H 30 V 50");
});

test("empty and single-model staircase paths are well-defined", () => {
  assert.equal(staircasePath([]), "");
  assert.equal(staircasePath([{ x: 10, y: 20 }]), "M 10 20");
  assert.equal(staircasePath([{ x: 10, y: 20 }], 50), "M 10 20 H 50");
  assert.deepEqual(singleModelFrontier([]), []);
});
