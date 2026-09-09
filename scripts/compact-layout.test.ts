import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { CHART_VIEWS, chartViewForKey } from "../src/data/chartViews.ts";

test("chart tabs support arrow navigation, wrapping, Home and End", () => {
  for (const { id } of CHART_VIEWS) {
    const other = id === "history" ? "modality" : "history";
    assert.equal(chartViewForKey(id, "ArrowRight"), other);
    assert.equal(chartViewForKey(id, "ArrowLeft"), other);
    assert.equal(chartViewForKey(other, "ArrowRight"), id);
    assert.equal(chartViewForKey(id, "Home"), "history");
    assert.equal(chartViewForKey(id, "End"), "modality");
    for (const key of ["Tab", "Enter", " ", "Escape", "a"]) assert.equal(chartViewForKey(id, key), null);
  }
});

test("summary starts with the complete leaderboard and uses one visible chart panel", () => {
  const html = readFileSync("dist/index.html", "utf8");
  const main = html.match(/<main id="main-content">([\s\S]*?)<\/main>/)![1];
  assert(main.startsWith('<section class="section summary-results"'));
  assert(!main.includes("summary-hero"));
  const table = main.match(/<table class="summary-table">([\s\S]*?)<\/table>/)![1];
  assert.equal(Array.from(table.matchAll(/<td class="summary-total">/g)).length, 21);
  assert(main.indexOf('class="index-explorer"') > main.indexOf(table) + table.length);
  for (const { id, label } of CHART_VIEWS) {
    const tab = main.match(new RegExp(`<button[^>]*id="index-tab-${id}"[^>]*>${label}<\\/button>`))![0];
    assert(tab.includes('role="tab"'));
    assert(tab.includes(`aria-controls="index-panel-${id}"`));
    assert(tab.includes(`aria-selected="${id === "history"}"`));
    assert(tab.includes(`tabindex="${id === "history" ? "0" : "-1"}"`));
    const panel = main.match(new RegExp(`<div id="index-panel-${id}"[^>]*>`))![0];
    assert(panel.includes('role="tabpanel"'));
    assert(panel.includes(`aria-labelledby="index-tab-${id}"`));
    assert.equal(panel.includes("hidden="), id !== "history");
  }
  assert.equal(Array.from(main.matchAll(/class="plot-copy"/g)).length, 2, "Both independently branded PNG exporters remain available");
  assert(main.includes('class="summary-radar"') && main.includes('class="release-plot-wide"'), "Keep both charts mounted so selections survive view changes");
  assert(main.indexOf('aria-label="Models to compare"') > main.indexOf('id="index-panel-modality"'));
});

test("compact supporting sections retain all people and an expanded methodology", () => {
  const html = readFileSync("dist/index.html", "utf8");
  const header = html.match(/<header class="masthead">([\s\S]*?)<\/header>/)![1];
  assert(header.indexOf("<h1>") < header.indexOf('class="lockup"'));
  assert(!html.includes('<footer class="footer">'), "No empty sources footer before About");
  const citation = html.match(/<div class="citation">([\s\S]*?)<\/div>/)![1];
  assert(!html.includes('<details class="citation"'));
  assert(citation.includes("If you found this website useful, please cite as:") && citation.includes("Copy citation") && citation.includes("@"));
  const methodology = html.match(/<section class="methodology"[^>]*>([\s\S]*?)<\/section>/)![1];
  assert(methodology.includes('class="methodology-explanation"') && methodology.includes('class="methodology-references"'));
  assert(!methodology.includes("<details"));
  assert.equal(Array.from(methodology.matchAll(/<h3>/g)).length, 6);
  const css = readFileSync("src/index.css", "utf8");
  const citationCss = css.match(/\.citation\s*\{([^}]*)\}/)![1];
  assert(!citationCss.includes("border"), "No dividing line above the visible citation");
  assert.match(css, /\.index-panel\[hidden\]\s*\{\s*display:\s*none;/);
  assert.match(css, /\.summary-table\s*\{[^}]*font-size:\s*0\.875rem/);
  assert.match(css, /\.summary-table th, \.summary-table td\s*\{[^}]*padding:\s*0\.45rem/);
  assert.match(css, /\.maintainers\s*\{[^}]*grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\)/);
});
