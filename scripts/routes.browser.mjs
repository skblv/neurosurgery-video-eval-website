// Run against production HTML: node scripts/routes.browser.mjs http://127.0.0.1:4173/neurosurgery-video-eval-website/
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

const browser = process.env.AGENT_BROWSER_CLI ?? "agent-browser";
const session = `routes-${process.pid}`;
const base = new URL(process.argv[2] ?? "http://127.0.0.1:4173/neurosurgery-video-eval-website/");
const routes = ["", "instruments/", "gestures/", "anatomy/", "skill-assessment/", "clinical-context/", "recommendations/"];
function run(...args) {
  const result = JSON.parse(execFileSync(browser, ["--session", session, "--json", ...args], { encoding: "utf8", timeout: 30_000 }));
  assert(result.success, result.error);
  return result.data;
}
const evaluate = (expression) => run("eval", expression).result;
const check = (expression, message) => assert(evaluate(expression), message);
const open = (path) => run("open", new URL(path, base).href);

try {
  // No JS bundle: the HTTP response and visible page must already contain the data.
  open("");
  run("network", "route", "**/*.js", "--abort");
  for (const route of routes) {
    const response = await fetch(new URL(route, base));
    assert.equal(response.status, 200, `Direct request for ${route}`);
    const html = await response.text();
    assert(html.includes('data-prerendered="true"') && html.includes('<tbody>'), `${route} ships scores in HTML`);
    open(route);
    check("document.querySelectorAll('main tbody tr').length > 0 && document.querySelectorAll('.domain-nav a').length === 7", `${route}: readable content and crawlable navigation without bundle`);
    check(`document.querySelector('.domain-nav a[aria-current=page]').getAttribute('href') === ${JSON.stringify(new URL(route, base).pathname)}`, `${route}: correct active page`);
    check("Array.from(document.querySelectorAll('img')).every(img => img.complete && img.naturalWidth > 0)", `${route}: local images load`);
    if (route) check("!!document.querySelector('.stack__rows') && !document.querySelector('.recharts-responsive-container')", `${route}: static chart works without JS`);
  }

  run("network", "unroute");
  for (const route of routes) {
    open(route);
    check(`window.location.pathname === ${JSON.stringify(new URL(route, base).pathname)} && window.location.hash === ''`, `${route}: real URL`);
    check("document.title.length > 20 && !!document.querySelector('link[rel=canonical]') && !!document.querySelector('meta[property=\"og:url\"]')", `${route}: route metadata`);
    assert.deepEqual(run("errors").errors, [], `${route}: no hydration errors`);
  }

  open("instruments/");
  run("click", '[role="tab"]:nth-child(2)');
  check("document.querySelector('[role=tab][aria-selected=true]').textContent.includes('PitVis')", "Dataset tabs work after hydration");
  run("select", ".metric__select", "exactMatch");
  check("document.querySelector('.table__col--metric').textContent.includes('Exact')", "Metric selection updates scores after hydration");
  run("click", '.domain-nav a:nth-child(4)');
  check("window.location.pathname.endsWith('/anatomy/')", "Native navigation reaches anatomy");
  run("back");
  check("window.location.pathname.endsWith('/instruments/')", "Browser Back returns to instruments");
  run("reload");
  check("document.querySelector('.domain-hero h2').textContent.includes('instruments')", "Direct reload preserves route");

  open("#/anatomy");
  run("wait", "--url", "**/anatomy/");
  check("!window.location.hash && document.querySelector('.domain-hero h2').textContent.includes('anatomical')", "Old hash links redirect to their actual page");
  evaluate("window.location.hash = '#/recommendations'");
  run("wait", "--url", "**/recommendations/");
  open("instruments/index.html");
  run("wait", "--url", "**/instruments/");
  open("summary/");
  run("wait", "--url", base.href);
  check("!!document.querySelector('.summary-table')", "Summary alias resolves to canonical homepage");
  open("404.html");
  check("document.querySelector('main').textContent.includes('Page not found') && document.querySelector('meta[name=robots]').content.includes('noindex')", "Custom 404 is readable and not indexable");
  assert.deepEqual(run("errors").errors, [], "No runtime or hydration errors during navigation");
  console.log("PASS: seven direct routes, content and charts without JS, assets, hydration, controls, history, legacy links, and 404");
} finally {
  run("close");
}
