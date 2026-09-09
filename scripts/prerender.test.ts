import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";
import { SITE_BASE, SITE_URL } from "../site.config.ts";
import { ROUTES } from "../src/data/domains.ts";
import { PAGE_SEO, routePath } from "../src/data/routes.ts";
import { MODEL_RELEASES } from "../src/data/modelReleases.ts";

test("every public route ships readable HTML, scores, metadata, real links, and existing assets", () => {
  const titles = new Set();
  for (const route of ROUTES) {
    const html = readFileSync(resolve("dist", route === "summary" ? "" : route, "index.html"), "utf8");
    assert(html.includes('<div id="root" data-prerendered="true">') && html.includes('<div class="page">'), `${route}: prerendered root and page content`);
    assert.match(html, /<main id="main-content">[\s\S]+<table/);
    assert.match(html, /<tbody>[\s\S]*<tr(?:\s|>)/);
    assert(html.includes(PAGE_SEO[route].title));
    assert(html.includes(`rel="canonical" href="${new URL(routePath(route, SITE_BASE), SITE_URL).href}"`));
    assert(html.includes('name="robots" content="index, follow'));
    assert(!html.includes('href="#/'));
    assert(!html.includes('<!--seo-head-->'));
    const showsGrok = route !== "gestures";
    const showsQwen0902 = route !== "gestures";
    assert.equal(html.includes("Grok 4.6"), showsGrok, `${route}: completed Grok follows dataset coverage`);
    assert.equal(html.includes("Qwen3.8 Max 0902"), showsQwen0902, `${route}: completed Qwen 0902 follows dataset coverage`);
    assert(!/Qwen3\.8 Max(?! 0902)/.test(html), `${route}: older unavailable Max remains hidden`);
    for (const target of ROUTES) assert(html.includes(`href="${routePath(target, SITE_BASE)}"`));
    for (const match of html.matchAll(/(?:src|href)="([^"#]+)"/g)) {
      const path = match[1];
      if (path.startsWith(SITE_BASE) && /\.(?:js|css|svg|png|jpg)$/.test(path)) {
        assert(existsSync(resolve("dist", path.slice(SITE_BASE.length))), `Missing asset on ${route}: ${path}`);
      }
    }
    titles.add(PAGE_SEO[route].title);
  }
  assert.equal(titles.size, ROUTES.length, "Route titles must be distinct");
  assert(readFileSync("dist/index.html", "utf8").includes("Qwen3.8 27B"), "Completed Qwen 27B remains visible");
});

test("sitemap lists only canonical pages, robots allow crawling, and unknown pages are not indexable", () => {
  const sitemap = readFileSync("dist/sitemap.xml", "utf8");
  const urls = Array.from(sitemap.matchAll(/<loc>([^<]+)<\/loc>/g), (match) => match[1]);
  assert.deepEqual(urls, ROUTES.map((route) => new URL(routePath(route, SITE_BASE), SITE_URL).href));
  assert.equal(new Set(urls).size, ROUTES.length);
  const robots = readFileSync("dist/robots.txt", "utf8");
  assert.match(robots, /User-agent: \*\nAllow: \//);
  assert(robots.includes(`Sitemap: ${new URL("sitemap.xml", SITE_URL).href}`));
  const notFound = readFileSync("dist/404.html", "utf8");
  assert(notFound.includes("Page not found"));
  assert(notFound.includes('content="noindex, follow"'));
  assert(!notFound.includes('rel="canonical"'));
  assert(readFileSync("dist/summary/index.html", "utf8").includes('http-equiv="refresh"'));
});

test("summary hides only the Action column and prerenders every model on the branded release plot", () => {
  const html = readFileSync("dist/index.html", "utf8");
  const table = html.match(/<table class="summary-table">([\s\S]*?)<\/table>/)![1];
  const columns = Array.from(table.match(/<thead>([\s\S]*?)<\/thead>/)![1].matchAll(/<th[^>]*>([\s\S]*?)<\/th>/g), (match) => match[1].replace(/<[^>]+>/g, ""));
  assert.deepEqual(columns, ["Model", "Total", "Instrument", "Anatomy", "Skill assessment", "Context / VQA", "Recommendations"]);
  const zeroShotRows = [...table.matchAll(/<tr[^>]*data-model-kind="zero-shot"[^>]*>([\s\S]*?)<\/tr>/g)].map((match) => match[1]).join("");
  const totals = Array.from(zeroShotRows.matchAll(/<td class="summary-total">(-?[\d.]+)<\/td>/g), (match) => match[1]).sort();
  const figure = html.match(/<figure class="release-plot"[^>]*>([\s\S]*?)<\/figure>/)![1];
  assert(html.indexOf('<figure class="release-plot"') > html.indexOf(table) + table.length, "Release chart follows the leaderboard");
  assert.match(figure, /<h3 id="release-plot-heading">Surgical Intelligence Index: How well do LLMs perform against specialized models across surgical tasks\?<\/h3>/);
  assert.match(figure, /<button[^>]*class="plot-copy"[^>]*aria-label="Copy plot as PNG"[^>]*><svg class="plot-copy-icon"/);
  assert(!figure.includes("Plot copied as PNG.") && !figure.includes("release-copy-status"));
  assert(!figure.toLowerCase().includes("total index"));
  assert.match(figure, /<p class="release-subtitle">Historical performance<\/p>/);
  const layouts = Array.from(figure.matchAll(/<svg class="release-plot-(?:wide|medium|compact)"[^>]*>([\s\S]*?)<\/svg>/g), (match) => match[1]);
  assert.equal(layouts.length, 3, "Desktop, tablet and phone layouts");
  assert.equal(Array.from(figure.matchAll(/data-axis-max="1"/g)).length, 3);
  assert.match(figure, /<span class="plot-address">eval\.surgicalvideo\.io<\/span>/);
  assert(figure.includes('alt="SDSC"') && figure.includes('alt="Chicago Booth"'), "Branding lives inside the chart figure");
  for (const [index, svg] of layouts.entries()) {
    const compact = index === 2;
    assert.match(svg, /class="release-tick">1\.00<\/text>/);
    const dateTicks = Array.from(svg.matchAll(/<text([^>]*) class="release-tick">((?:[A-Z][a-z]{2} \d{4})|(?:<tspan[^>]*>[A-Z][a-z]{2}<\/tspan><tspan[^>]*>\d{4}<\/tspan>))<\/text>/g));
    assert(dateTicks.length > 0);
    assert.match(dateTicks.at(-1)![1], /text-anchor="end"/, "Final date label extends inward, leaving room at the right border");
    const points = Array.from(svg.matchAll(/data-model="([^"]+)" data-release-date="([^"]+)" data-total="([^"]+)"/g));
    assert.deepEqual(points.map((point) => Number(point[3]).toFixed(3)).sort(), totals, "Identical totals and coverage to the table's zero-shot models");
    assert.equal(new Set(points.map((point) => point[1])).size, 21);
    for (const point of points) assert.equal(point[2], MODEL_RELEASES[point[1]].date);
    assert.match(svg, /class="release-point" role="button" tabindex="0"/);
    const legend = svg.slice(svg.indexOf('<g class="release-family-legend"'), svg.indexOf('<g class="release-point"'));
    const families = Array.from(legend.matchAll(/data-family="([^"]+)"/g), (match) => match[1]);
    assert.deepEqual(families, ["openai", "anthropic", "gemini", "google", "qwen", "moonshot", "zai", "xai"]);
    assert.match(legend, /transform="translate\(76 46\)"/, "Legend is inset in the plot's upper-left corner");
    assert(legend.includes(`<rect class="release-family-legend-box" width="${compact ? 220 : 188}" height="138"`), "Two columns, four family rows and a compact reference swatch, with room for larger phone text");
    const columnWidth = compact ? 100 : 84;
    assert.deepEqual(Array.from(legend.matchAll(/data-family="[^"]+" transform="translate\((\d+) (\d+)\)"/g), (match) => match.slice(1).map(Number)), [[0, 22], [0, 47], [0, 72], [0, 97], [columnWidth, 22], [columnWidth, 47], [columnWidth, 72], [columnWidth, 97]]);
    assert.deepEqual(Array.from(legend.matchAll(/<text[^>]*>([^<]+)<\/text>/g), (match) => match[1]), ["GPT", "Claude", "Gemini", "Gemma", "Qwen", "Kimi", "GLM", "Grok"]);
    assert.equal(Array.from(svg.matchAll(/class="release-model-logo"/g)).length, points.length + families.length, "Every point and legend family uses the same logo");
    for (const logo of svg.matchAll(/<g class="release-model-logo"[^>]*>([\s\S]*?)<\/g>/g)) {
      assert(!logo[1].includes("<rect"), "Logo markers have no background badge");
      assert(logo[1].includes("<path") || /href="[^"]+\.svg"/.test(logo[1]), "Every current model marker is a transparent SVG");
    }
    assert(!svg.includes('class="release-dot"') && !svg.includes('class="release-point-label"') && !svg.includes('class="release-leader"'));
    const visibleText = Array.from(svg.replace(legend, "").matchAll(/<text[^>]*>([\s\S]*?)<\/text>/g), (match) => match[1]).join(" ");
    assert(!/GPT|Claude|Gemini|Gemma|Kimi|Grok|Qwen|GLM/.test(visibleText), "Only the family legend has persistent names; points remain unlabeled");
    for (const match of svg.matchAll(/<image href="([^"]+)"/g)) {
      assert(match[1].startsWith(SITE_BASE));
      assert(existsSync(resolve("dist", match[1].slice(SITE_BASE.length))), `Logo asset exists: ${match[1]}`);
    }
  }
  assert.equal(Array.from(figure.matchAll(/<p(?:\s|>)/g)).length, 2, "Only the subtitle and requested methodology paragraph");
  assert.match(html, /<h3 id="summary-plot-heading">Surgical Intelligence Index: How well do LLMs perform against specialized models across surgical tasks\?<\/h3>/, "Spider plot uses the same index title");
});

test("both plots have icon-only copy controls, black axes, and the requested grey methodology footer", () => {
  const html = readFileSync("dist/index.html", "utf8");
  const figures = Array.from(html.matchAll(/<figure class="(?:release-plot|summary-web)"[^>]*>([\s\S]*?)<\/figure>/g), (match) => match[1]);
  assert.equal(figures.length, 2);
  for (const figure of figures) {
    assert.match(figure, /<h3[^>]*>Surgical Intelligence Index: How well do LLMs perform against specialized models across surgical tasks\?<\/h3>/);
    const subtitle = figure.includes('id="summary-plot-heading"') ? "Performance by modality" : "Historical performance";
    assert(figure.includes(`<p class="release-subtitle">${subtitle}</p>`));
    const button = figure.match(/<button class="plot-copy"[^>]*>([\s\S]*?)<\/button>/)![1];
    assert.match(button, /<svg class="plot-copy-icon"/);
    assert.equal(button.replace(/<[^>]+>/g, ""), "", "No visible Copy PNG words");
    const footer = figure.match(/<p class="plot-methodology">([^<]+)<\/p>/)![1];
    assert.equal(footer, "The plot shows a weighted average zero-shot performance of LLMs on surgical modalities. 1 means as good as a specialized computer-vision model and 0 means as good as chance. Modalities include Instrument (CholecT50, PitVis-2023, SurgVU); Anatomy (DSAD, CaDIS, Endoscapes); Skill assessment (SAR-RARP50); Context / VQA (PitVQA); Recommendations (CholecT50 verbs, PitVis-2023 steps).");
    assert.match(figure, /<span class="plot-address">eval\.surgicalvideo\.io<\/span>/);
  }
  const css = readFileSync("src/index.css", "utf8");
  assert.match(css, /\.release-subtitle\s*\{[^}]*font-size:\s*1\.25rem/);
  for (const selector of ["release-subtitle", "release-tick", "release-axis-label", "release-tooltip", "release-tooltip-name", "summary-axis", "summary-tick", "summary-legend", "release-family-legend"]) {
    assert.match(css, new RegExp(`\\.${selector}\\s*\\{[^}]*(?:color|fill):\\s*#000[; ]`));
  }
  assert.match(css, /\.plot-methodology\s*\{[^}]*color:\s*var\(--annotation\);[^}]*font-size:\s*0\.75rem/);
  assert.match(css, /\.plot-address\s*\{[^}]*background:\s*linear-gradient\(90deg, var\(--sdsc-green\), var\(--uchicago-maroon\)\);[^}]*background-clip:\s*text;[^}]*font-size:\s*1\.375rem;[^}]*font-weight:\s*700;[^}]*text-decoration:\s*none/);
  assert.match(css, /\.release-family-legend-box\s*\{[^}]*stroke:\s*#000;[^}]*stroke-width:\s*1;/);
});

test("spider legend matches the plotted models and colors and its scale tops out at one", () => {
  const html = readFileSync("dist/index.html", "utf8");
  const svg = html.match(/<svg class="summary-radar"[^>]*>([\s\S]*?)<\/svg>/)![1];
  const profiles = Array.from(svg.matchAll(/data-profile-model="([^"]+)" data-profile-color="([^"]+)"/g), (match) => match.slice(1));
  const legend = Array.from(svg.matchAll(/data-legend-model="([^"]+)" data-legend-color="([^"]+)"/g), (match) => match.slice(1));
  assert.deepEqual(legend, profiles);
  assert.deepEqual(profiles.map(([id]) => id), ["gpt-6-astra", "claude-fable-5_1", "gemini-3_8-flash"]);
  const ticks = Array.from(svg.matchAll(/class="summary-tick">([^<]+)<\/text>/g), (match) => Number(match[1]));
  assert.equal(Math.max(...ticks), 1);
  assert(html.includes('class="summary-radar" viewBox="0 0 560 494"'), "Legend fits inside the copied SVG viewport");
});

test("Eric follows NaNa in the maintainers with a local portrait and verified links", () => {
  const css = readFileSync("src/index.css", "utf8");
  assert.match(css, /\.maintainers\s*\{[^}]*grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(css, /\.maintainer__body\s*\{[^}]*flex:\s*1;/);
  assert(!/\.maintainers\s*\{[^}]*repeat\(2,/.test(css), "Keep all three cards in one equally shared row before stacking on mobile");
  for (const route of ROUTES) {
    const html = readFileSync(resolve("dist", route === "summary" ? "" : route, "index.html"), "utf8");
    const maintainers = html.match(/<ul class="maintainers">([\s\S]*?)<\/ul>/)![1];
    const names = Array.from(maintainers.matchAll(/<p class="maintainer__name">([^<]+)<\/p>/g), (match) => match[1]);
    assert.deepEqual(names, ["Kirill Skobelev", "Zhuang-Fang (NaNa) Yi, PhD", "Eric Fithian"]);
    assert.match(maintainers, /src="[^"]*eric-fithian[^"]*\.jpg"/);
    assert(maintainers.includes('href="https://ericfithian.com/"'));
    assert(maintainers.includes('href="https://www.linkedin.com/in/ericbfithian"'));
  }
});

test("Methodology is expanded below About on the summary page", () => {
  const html = readFileSync("dist/index.html", "utf8");
  const about = html.match(/<section class="about"[^>]*>[\s\S]*?<\/section>/)![0];
  const method = html.match(/<section class="methodology"[^>]*>[\s\S]*?<\/section>/)![0];
  assert(html.indexOf(method) >= html.indexOf(about) + about.length);
  assert.match(method, /<h2 id="methodology-heading">Methodology<\/h2>/);
  assert(!method.includes("<details") && !method.includes("<summary"));
  assert(!html.includes("Scoring method") && !html.includes("summary-methods"));
  assert(method.includes("Dataset score = (model performance − chance performance) ÷ (specialised reference performance − chance performance)."));
  assert(method.includes("randomly shuffling the observed label sets across frames"));
  assert(method.includes("Action pilot has no verified chance baseline yet"));
  assert(method.includes("When results are missing, weights are redistributed equally among available datasets and modalities."));
  assert.equal(Array.from(method.matchAll(/<h3>/g)).length, 6, "Preserve all modality reference descriptions");
});
