import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { calculateSpecialistReference, SPECIALIST_REFERENCE_ID, type SummaryDataset } from "../src/data/summaryScoring.ts";
import { radarProfiles, radarScale } from "../src/data/radarScale.ts";
import { matchesModelSearch } from "../src/data/modelSearch.ts";

function dataset(id: string, referenceId: string, reference: number | null, chance: number | null): SummaryDataset {
  return { id, name: id, metric: "microF1", referenceId, chance, results: [
    { id: referenceId, model: referenceId, value: reference },
    { id: "better-than-reference", model: "Another model", value: 99 },
  ] };
}

test("composite uses the fixed reference for each dataset, not the best model", () => {
  const modalities = [
    { id: "instrument", label: "Instrument", datasets: [dataset("a", "yolo", 80, 20), dataset("b", "yolo", 60, 10)] },
    { id: "anatomy", label: "Anatomy", datasets: [dataset("c", "resnet", 75, 30)] },
    { id: "action", label: "Action", datasets: [dataset("d", "surgmotion", 70, null)] },
  ];
  const before = structuredClone(modalities);
  const row = calculateSpecialistReference(modalities)!;
  assert.equal(row.id, SPECIALIST_REFERENCE_ID);
  assert.equal(row.model, "SDSC/UChicago");
  assert.equal(row.total, 1);
  assert.deepEqual(row.scores.map((score) => score.datasets), [[1, 1], [1], [null]]);
  assert.deepEqual(row.scores.map((score) => score.value), [1, 1, null]);
  assert.equal(row.covered, 3);
  assert.deepEqual(modalities, before, "The reference row must not change real evaluations");
});

test("composite never invents a score when references or valid chance baselines are missing", () => {
  for (const item of [dataset("missing", "s", null, 20), dataset("unknown-chance", "s", 80, null), dataset("degenerate", "s", 20, 20), dataset("below-chance", "s", 10, 20), { ...dataset("absent", "s", 80, 20), results: [] }]) {
    const row = calculateSpecialistReference([{ id: "m", label: "M", datasets: [item] }])!;
    assert.equal(row.total, null);
    assert.equal(row.covered, 0);
    assert.equal(row.scores[0].value, null);
  }
  assert.equal(calculateSpecialistReference([]), undefined);
});

test("summary shows only the requested extra rows, using measured LemonFM scores and existing logos", () => {
  const html = readFileSync("dist/index.html", "utf8");
  const table = html.match(/<table class="summary-table">([\s\S]*?)<\/table>/)![1];
  const rows = [...table.matchAll(/<tr data-model-id="([^"]+)" data-model-kind="([^"]+)">([\s\S]*?)<\/tr>/g)];
  assert.equal(rows.length, 23);
  assert.equal(rows.filter((row) => row[2] === "zero-shot").length, 21);
  assert.deepEqual(rows.filter((row) => row[2] !== "zero-shot").map((row) => row[1]), [SPECIALIST_REFERENCE_ID, "lemonfm-linear-probe"]);
  const reference = rows.find((row) => row[1] === SPECIALIST_REFERENCE_ID)![3];
  const cells = (row: string) => [...row.matchAll(/<td[^>]*>([^<]*)<\/td>/g)].map((match) => match[1]);
  assert.deepEqual(cells(reference), Array(6).fill("1.000"));
  assert(reference.includes("<small>SDSC/UChicago specialist model</small>") && reference.includes('class="joint-mark"'));

  type Results = { datasets: Record<string, { results: { id: string; metrics: Record<string, { value: number | null }> }[] }> };
  const instrument: Results = JSON.parse(readFileSync("src/data/results.json", "utf8"));
  const domain: Results = JSON.parse(readFileSync("src/data/domainResults.json", "utf8"));
  const chance: { datasets: Record<string, { metrics: Record<string, number> }> } = JSON.parse(readFileSync("src/data/chanceBaselines.json", "utf8"));
  const all = { ...instrument.datasets, ...domain.datasets };
  const groups = [["cholect50", "pitvis", "surgvu"], ["dsad", "cadis", "endoscapes"], ["sarrarp50"], ["pitvqa"], ["cholect50verbs", "pitvissteps"]];
  const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
  const scores = groups.map((ids, index) => mean(ids.map((id) => {
    const metric = id === "sarrarp50" ? "exactMatch" : "microF1";
    const observed = all[id].results.find((row) => row.id === "lemonfm-linear-probe")!.metrics[metric].value!;
    const specialist = all[id].results.find((row) => row.id === (index === 0 ? "yolov12m" : "resnet50"))!.metrics[metric].value!;
    const baseline = chance.datasets[id].metrics[metric];
    return (observed - baseline) / (specialist - baseline);
  })));
  const lemon = rows.find((row) => row[1] === "lemonfm-linear-probe")![3];
  assert.deepEqual(cells(lemon), [mean(scores), ...scores].map((value) => value.toFixed(3)));
  assert(lemon.includes("LemonFM (linear probe)") && lemon.includes("provider-logos/visurg.png"));
  assert(html.includes("LemonFM uses task-trained linear probes.") && html.includes("it is not one model."));
  assert(!html.includes(`data-model="${SPECIALIST_REFERENCE_ID}"`) && !html.includes('data-model="lemonfm-linear-probe"'), "No invented release dates or changes to the zero-shot historical plot");
  assert(!html.includes("Change LemonFM") && !html.includes("Change SDSC/UChicago"), "Default spider selections stay unchanged");
});

test("historical plots show a dashed SDSC-green reference at one without inventing a release", () => {
  const html = readFileSync("dist/index.html", "utf8");
  const charts = [...html.matchAll(/<svg class="release-plot-(wide|medium|compact)"[^>]*>([\s\S]*?)<\/svg>/g)];
  assert.equal(charts.length, 3);
  for (const chart of charts) {
    const reference = chart[2].match(/<g class="release-reference"[^>]*>([\s\S]*?)<\/g>/)![0];
    assert(reference.includes(`data-reference-model="${SPECIALIST_REFERENCE_ID}" data-reference-score="1"`));
    assert.match(reference, /<line x1="64" x2="(?:892|652|332)" y1="34" y2="34" class="release-reference-line"/);
    assert(reference.includes("not a dated model release"));
    assert(!reference.includes("data-release-date"));
    assert(!reference.includes("<text"), "No visible text annotation on the reference line");
    const legend = chart[2].slice(chart[2].indexOf('<g class="release-family-legend"'), chart[2].indexOf('<g class="release-point"'));
    const key = legend.match(/<g class="release-reference-key"[^>]*>([\s\S]*?)<\/g>/)![0];
    assert(key.includes('class="release-reference-line"') && key.includes('aria-label="SDSC/UChicago specialist model"'));
    assert(!/<image|<path/.test(key), "Reference legend uses a dash, not a logo");
    const label = key.match(/<text[^>]*>([\s\S]*?)<\/text>/)![1];
    assert.equal(label.replace(/<[^>]+>/g, ""), "SDSC/UChicago specialist model");
    assert(label.includes('<tspan x="37" dy="18">'), "Wrap the label inside the compact legend instead of expanding its width");
  }
  const css = readFileSync("src/index.css", "utf8");
  assert.match(css, /\.release-reference-line\s*\{[^}]*stroke: var\(--sdsc-green\);[^}]*stroke-dasharray: 7 5;/);
});

test("spider options and profiles share the table's specialist and LemonFM rows", () => {
  const picker = readFileSync("src/components/SummaryModelPicker.tsx", "utf8");
  const plot = readFileSync("src/components/Summary.tsx", "utf8");
  assert(picker.includes("SUMMARY_TABLE_ROWS.find") && picker.includes("SUMMARY_TABLE_ROWS.filter"));
  assert.match(readFileSync("src/index.css", "utf8"), /\.summary-picker \.model-icon\s*\{[^}]*width: auto;/, "The joint SDSC/Booth logo must not overlap the option label");
  assert(plot.includes("radarProfiles(selected, SUMMARY_TABLE_ROWS)") && plot.includes("selected.length < SUMMARY_TABLE_ROWS.length"));
  const html = readFileSync("dist/index.html", "utf8");
  const rows = [...html.matchAll(/<tr data-model-id="([^"]+)" data-model-kind="([^"]+)">([\s\S]*?)<\/tr>/g)].map((match) => {
    const model = match[3].match(/class="summary-model-title"><span>([^<]+)<\/span>/)![1];
    const cells = [...match[3].matchAll(/<td[^>]*>([^<]*)<\/td>/g)].map((cell) => cell[1] === "NA" ? null : Number(cell[1]));
    return { id: match[1], model, total: cells[0], scores: [cells[1], null, ...cells.slice(2)] };
  });
  assert.deepEqual(rows.filter((row) => matchesModelSearch(row.model, "sdsc")).map((row) => row.id), [SPECIALIST_REFERENCE_ID]);
  assert.deepEqual(rows.filter((row) => matchesModelSearch(row.model, "LEMON")).map((row) => row.id), ["lemonfm-linear-probe"]);
  const selection = ["gpt-6-astra", SPECIALIST_REFERENCE_ID, "lemonfm-linear-probe"];
  const profiles = radarProfiles(selection, rows);
  assert.deepEqual(profiles.map((row) => row.id), selection);
  assert.deepEqual(profiles[1].scores, [1, null, 1, 1, 1, 1]);
  assert.deepEqual(profiles[2].scores, [0.813, null, 0.752, 0.691, 0.980, 1.079]);
  assert.equal(radarScale(profiles.flatMap((row) => row.scores)).ceiling, 1);
  assert.equal(radarProfiles(selection.slice(1), rows).length, 2);
});
