import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { SITE_BASE, SITE_URL } from "../site.config.ts";
import { ROUTES } from "../src/data/domains.ts";
import { PAGE_SEO, routePath } from "../src/data/routes.ts";

const output = resolve("dist");
const template = await readFile(resolve(output, "index.html"), "utf8");
const { render } = await import(pathToFileURL(resolve("dist-ssr/entry-server.js")).href);
if (!template.includes('<!--seo-head-->') || !template.includes('<div id="root"></div>')) {
  throw new Error("Prerender template markers are missing");
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);
}

function documentHtml(title: string, description: string, canonical: string | null, html: string): string {
  const image = new URL("og.png", SITE_URL).href;
  const head = [
    `<meta name="description" content="${escapeHtml(description)}" />`,
    `<meta name="robots" content="${canonical ? "index, follow, max-image-preview:large" : "noindex, follow"}" />`,
    ...(canonical ? [`<link rel="canonical" href="${escapeHtml(canonical)}" />`, `<meta property="og:url" content="${escapeHtml(canonical)}" />`] : []),
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="Surgical Intelligence Leaderboard" />`,
    `<meta property="og:title" content="${escapeHtml(title)}" />`,
    `<meta property="og:description" content="${escapeHtml(description)}" />`,
    `<meta property="og:image" content="${escapeHtml(image)}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${escapeHtml(title)}" />`,
    `<meta name="twitter:description" content="${escapeHtml(description)}" />`,
    `<meta name="twitter:image" content="${escapeHtml(image)}" />`,
    `<link rel="sitemap" type="application/xml" href="${escapeHtml(new URL("sitemap.xml", SITE_URL).href)}" />`,
  ].join("\n    ");
  return template
    .replace(/<title>.*?<\/title>/, () => `<title>${escapeHtml(title)}</title>`)
    .replace('<!--seo-head-->', () => head)
    .replace('<div id="root"></div>', () => `<div id="root" data-prerendered="true">${html}</div>`);
}

for (const route of ROUTES) {
  const directory = resolve(output, route === "summary" ? "" : route);
  await mkdir(directory, { recursive: true });
  const canonical = new URL(routePath(route, SITE_BASE), SITE_URL).href;
  const { title, description } = PAGE_SEO[route];
  await writeFile(resolve(directory, "index.html"), documentHtml(title, description, canonical, render(route)));
  console.log(`Prerendered ${routePath(route, SITE_BASE)}`);
}

await writeFile(resolve(output, "404.html"), documentHtml("Page not found | Surgical Intelligence Leaderboard", "This page does not exist. Browse the surgical intelligence benchmarks from the summary leaderboard.", null, render(null)));

// Summary lives at the site root. Keep this alias usable without duplicate indexable pages.
await mkdir(resolve(output, "summary"), { recursive: true });
await writeFile(resolve(output, "summary/index.html"), `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Summary | Surgical Intelligence Leaderboard</title>
<meta name="robots" content="noindex, follow"><link rel="canonical" href="${escapeHtml(SITE_URL)}">
<meta http-equiv="refresh" content="0;url=${escapeHtml(SITE_BASE)}"></head>
<body><p><a href="${escapeHtml(SITE_BASE)}">Continue to the summary leaderboard.</a></p></body></html>\n`);

await writeFile(resolve(output, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${ROUTES.map((route) => `  <url><loc>${escapeHtml(new URL(routePath(route, SITE_BASE), SITE_URL).href)}</loc></url>`).join("\n")}
</urlset>\n`);
await writeFile(resolve(output, "robots.txt"), `User-agent: *\nAllow: /\n\nSitemap: ${new URL("sitemap.xml", SITE_URL).href}\n`);
await writeFile(resolve(output, ".nojekyll"), "");
