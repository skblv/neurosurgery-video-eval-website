import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";
import { SITE_BASE, SITE_URL } from "../site.config.ts";
import { ROUTES } from "../src/data/domains.ts";
import { PAGE_SEO, routePath } from "../src/data/routes.ts";

test("every public route ships readable HTML, scores, metadata, real links, and existing assets", () => {
  const titles = new Set();
  for (const route of ROUTES) {
    const html = readFileSync(resolve("dist", route === "summary" ? "" : route, "index.html"), "utf8");
    assert(html.includes('<div id="root" data-prerendered="true">') && html.includes('<div class="page">'), `${route}: prerendered root and page content`);
    assert.match(html, /<main id="main-content">[\s\S]+<table/);
    assert.match(html, /<tbody>[\s\S]+<tr>/);
    assert(html.includes(PAGE_SEO[route].title));
    assert(html.includes(`rel="canonical" href="${new URL(routePath(route, SITE_BASE), SITE_URL).href}"`));
    assert(html.includes('name="robots" content="index, follow'));
    assert(!html.includes('href="#/'));
    assert(!html.includes('<!--seo-head-->'));
    assert(!html.includes("Qwen3.8 Max"), `${route}: unfinished Qwen Max is hidden`);
    assert(!html.includes("Grok 4.6"), `${route}: unfinished Grok is hidden`);
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
