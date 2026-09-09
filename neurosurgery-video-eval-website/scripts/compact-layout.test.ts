import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
test("summary starts with the complete leaderboard, then history, then modality without tabs", () => {
  const html = readFileSync("dist/index.html", "utf8");
  const main = html.match(/<main id="main-content">([\s\S]*?)<\/main>/)![1];
  assert(main.startsWith('<section class="section summary-results"'));
  assert(!main.includes("summary-hero"));
  const table = main.match(/<table class="summary-table">([\s\S]*?)<\/table>/)![1];
  assert.equal([...table.matchAll(/class="summary-sort"/g)].length, 7, "Every column is sortable");
  assert.match(table, /<th scope="col" aria-sort="descending"><button[^>]*aria-label="Sort by Total"/);
  assert.equal([...table.matchAll(/aria-sort=/g)].length, 1);
  assert.equal(Array.from(table.matchAll(/<td class="summary-total">/g)).length, 21);
  assert(main.indexOf('class="index-explorer"') > main.indexOf(table) + table.length);
  const figures = [...main.matchAll(/<figure class="(release-plot|summary-web)"[^>]*>/g)];
  assert.deepEqual(figures.map((figure) => figure[1]), ["release-plot", "summary-web"]);
  assert(figures.every((figure) => !figure[0].includes("hidden=")));
  assert(!/role="(?:tablist|tabpanel)"|index-view-tabs/.test(main));
  assert.equal(Array.from(main.matchAll(/class="plot-copy"/g)).length, 2, "Both independently branded PNG exporters remain available");
  assert(main.indexOf('aria-label="Models to compare"') > main.indexOf('class="summary-web"'));
  const tableFooter = main.match(/<p class="summary-muted">([^<]*)<\/p>/)![1];
  const plotFooter = main.match(/<p class="plot-methodology">([^<]*)<\/p>/)![1];
  assert.equal(tableFooter, plotFooter.replace("The plot", "The table"));
});

test("responsive radar retains every selected profile and legend in both layouts", () => {
  const html = readFileSync("dist/index.html", "utf8");
  const charts = [...html.matchAll(/<svg class="summary-radar(?:-compact)?"[^>]*>[\s\S]*?<\/svg>/g)].map((match) => match[0]);
  assert.equal(charts.length, 2);
  assert(charts[0].includes('viewBox="0 0 560 494"'));
  assert(charts[1].includes('viewBox="0 0 360 428"'));
  const models = (chart: string, attribute: string) => [...chart.matchAll(new RegExp(`${attribute}="([^"]*)"`, "g"))].map((match) => match[1]);
  for (const chart of charts) {
    assert(chart.includes('data-axis-max="1"'));
    assert.equal(models(chart, "data-profile-model").length, 3);
    assert.deepEqual(models(chart, "data-profile-model"), models(chart, "data-legend-model"));
  }
  assert.deepEqual(models(charts[0], "data-profile-model"), models(charts[1], "data-profile-model"));
  const ids = [...html.matchAll(/\sid="([^"]*)"/g)].map((match) => match[1]);
  assert.equal(ids.length, new Set(ids).size, "Responsive charts must not duplicate accessibility IDs");
});

test("compact supporting sections retain all people and an expanded methodology", () => {
  const html = readFileSync("dist/index.html", "utf8");
  const header = html.match(/<header class="masthead">([\s\S]*?)<\/header>/)![1];
  assert(header.indexOf("<h1>") < header.indexOf('class="lockup"'));
  assert(!html.includes('<footer class="footer">'), "No empty sources footer before About");
  const citation = html.match(/<div class="citation">([\s\S]*?)<\/div>/)![1];
  assert(!html.includes('<details class="citation"'));
  assert(citation.includes("If you found this website useful, please cite as:") && citation.includes("Copy citation") && citation.includes("@"));
  const citationButton = citation.match(/<button[^>]*aria-label="Copy citation"[^>]*>([\s\S]*?)<\/button>/)![1];
  const plotButton = html.match(/<button class="plot-copy"[^>]*>([\s\S]*?)<\/button>/)![1];
  assert.equal(citationButton, plotButton, "Citation and plots share the identical copy SVG");
  assert.equal(citationButton.replace(/<[^>]+>/g, ""), "", "Citation copy is icon-only");
  const methodology = html.match(/<section class="methodology"[^>]*>([\s\S]*?)<\/section>/)![1];
  assert(methodology.includes('class="methodology-explanation"') && methodology.includes('class="methodology-references"'));
  assert(!methodology.includes("<details"));
  assert.equal(Array.from(methodology.matchAll(/<h3>/g)).length, 6);
  const css = readFileSync("src/index.css", "utf8");
  const citationCss = css.match(/\.citation\s*\{([^}]*)\}/)![1];
  assert(!citationCss.includes("border"), "No dividing line above the visible citation");
  assert.match(css, /\.summary-selectors\s*\{[^}]*grid-template-columns:\s*repeat\(auto-fit, minmax\(14rem, 1fr\)\);[^}]*grid-auto-rows:\s*1fr/);
  assert.match(css, /\.summary-table\s*\{[^}]*font-size:\s*0\.875rem/);
  assert.match(css, /\.summary-table th, \.summary-table td\s*\{[^}]*padding:\s*0\.45rem/);
  assert.match(css, /\.maintainers\s*\{[^}]*grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\)/);
});
