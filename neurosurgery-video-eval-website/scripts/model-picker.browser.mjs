// Run against a dev/preview server: node scripts/model-picker.browser.mjs http://127.0.0.1:5173
// Requires agent-browser on PATH, or AGENT_BROWSER_CLI pointing to its executable.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

const browser = process.env.AGENT_BROWSER_CLI ?? "agent-browser";
const session = `model-picker-${process.pid}`;
function run(...args) {
  const result = JSON.parse(execFileSync(browser, ["--session", session, "--json", ...args], { encoding: "utf8", timeout: 30_000 }));
  assert(result.success, result.error);
  return result.data;
}
const evaluate = (expression) => run("eval", expression).result;
const check = (expression, message) => assert(evaluate(expression), message);
const button = (name) => run("find", "role", "button", "click", "--name", name, "--exact");
const search = (query) => run("find", "label", "Search models", "fill", query);
const active = (name) => check(`document.getElementById(document.querySelector('[role=combobox]').getAttribute('aria-activedescendant'))?.textContent.replace('✓', '') === ${JSON.stringify(name)} && document.activeElement?.getAttribute('role') === 'combobox'`, `Keyboard highlight: ${name}, with focus kept in search`);
const plotted = (name) => check(`Array.from(document.querySelectorAll('.summary-web circle title')).some(el => el.textContent.startsWith(${JSON.stringify(`${name} ·`)}))`, `${name} is actually drawn in the plot`);

try {
  run("open", process.argv[2] ?? "http://127.0.0.1:5173");
  button("Change Claude Fable 5.1");
  search("cla... f.. 5");
  check("document.querySelectorAll('[role=option]').length === 2 && document.querySelectorAll('[role=option] .model-icon').length === 2", "Multi-term search retains matching models and logos");
  run("click", '[role="option"]:last-child');
  check("document.activeElement?.getAttribute('aria-label') === 'Change Claude Fable 5' && !document.querySelector('[role=combobox]')", "Mouse selection updates chip, closes menu, restores focus");
  plotted("Claude Fable 5");
  check("!Array.from(document.querySelectorAll('.summary-web circle title')).some(el => el.textContent.startsWith('Claude Fable 5.1 ·'))", "Replaced model leaves plot");

  // Open from the focused trigger, keep focus in the search field, and wrap both ways.
  run("press", "ArrowDown");
  search("cla f 5");
  for (const [key, name] of [["ArrowDown", "Claude Fable 5.1"], ["ArrowDown", "Claude Fable 5"], ["ArrowDown", "Claude Fable 5.1"], ["ArrowUp", "Claude Fable 5"], ["ArrowUp", "Claude Fable 5.1"]]) {
    run("press", key);
    active(name);
  }
  run("press", "Enter");
  plotted("Claude Fable 5.1");

  button("Add model to plot");
  search("kimi");
  const added = evaluate("document.querySelector('[role=option]').textContent");
  run("click", '[role="option"]:first-child');
  check("document.querySelectorAll('.summary-picker-trigger').length === 4", "Mouse selection adds a fourth model");
  plotted(added);
  button(`Remove ${added}`);
  check("document.querySelectorAll('.summary-picker-trigger').length === 3", "Removing the added model works");

  button("Add model to plot");
  search("fable");
  check("document.querySelectorAll('[role=option]').length === 1 && document.querySelector('[role=option]').textContent === 'Claude Fable 5'", "Add picker excludes models already selected");
  run("press", "ArrowUp");
  active("Claude Fable 5");
  run("press", "Enter");
  check("document.querySelectorAll('.summary-picker-trigger').length === 4", "Keyboard selection adds a fourth model");
  plotted("Claude Fable 5");

  button("Add model to plot");
  search("no-model-matches-this");
  for (const key of ["ArrowDown", "ArrowUp", "Enter"]) run("press", key);
  check("!!document.querySelector('[role=combobox]') && document.querySelectorAll('[role=option]').length === 0 && document.querySelectorAll('.summary-picker-trigger').length === 4", "Empty results are safe for arrow and Enter keys");
  run("press", "Escape");
  check("!document.querySelector('[role=combobox]') && document.activeElement?.getAttribute('aria-label') === 'Add model to plot'", "Escape closes and restores focus");
  button("Change GPT-6 Astra");
  run("press", "Tab");
  check("!document.querySelector('[role=combobox]') && document.activeElement?.getAttribute('aria-label') === 'Remove GPT-6 Astra'", "Tab exits without trapping focus");
  button("Add model to plot");
  run("click", "#summary-plot-heading");
  check("!document.querySelector('[role=combobox]')", "Outside click closes menu");
  assert.deepEqual(run("errors").errors, [], "No browser runtime errors");
  console.log("PASS: search, logos, mouse/keyboard replacement and adding, plot updates, focus, empty results, and dismissal");
} finally {
  run("close");
}
