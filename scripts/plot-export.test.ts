import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test, type TestContext } from "node:test";
import { copyPngToClipboard, imageDataUrl, wrapPlotSubtitle } from "../src/data/plotExport.ts";

function replaceGlobal(t: TestContext, key: string, value: unknown) {
  const original = Object.getOwnPropertyDescriptor(globalThis, key);
  Object.defineProperty(globalThis, key, { configurable: true, value });
  t.after(() => {
    if (original) Object.defineProperty(globalThis, key, original);
    else Reflect.deleteProperty(globalThis, key);
  });
}

test("export subtitle wraps without dropping words and leaves no lines for empty copy", () => {
  const subtitle = "How well do LLMs perform against specialized models across surgical tasks?";
  for (const width of [50, 120]) {
    const lines = wrapPlotSubtitle(subtitle, width, (text) => text.length);
    assert.equal(lines.join(" "), subtitle);
    assert(lines.every((line) => line.length <= width));
  }
  assert.deepEqual(wrapPlotSubtitle("", 100, (text) => text.length), []);
  const component = readFileSync("src/components/PlotCopyButton.tsx", "utf8");
  assert.match(component, /plotPng\(plot, title, subtitle, methodology, PLOT_BRANDING\)/, "PNG uses the chart's current subtitle, methodology, and branding");
  assert(!component.includes("Plot copied as PNG."), "No success sentence is rendered after copying");
});

test("PNG footer uses smaller grey type and bold SDSC-to-UChicago gradient branding without an underline", () => {
  const source = readFileSync("src/data/plotExport.ts", "utf8");
  assert(source.includes('footer.setAttribute("font-size", "12")'));
  assert(source.includes('footer.setAttribute("fill", figureStyle.getPropertyValue("--annotation").trim() || "#6f6f6f")'));
  assert(source.includes('address.setAttribute("font-size", "22")'));
  assert(source.includes('address.setAttribute("font-weight", "700")'));
  assert(source.includes('address.setAttribute("fill", "url(#plot-address-gradient)")'));
  assert(source.includes('figureStyle.getPropertyValue("--sdsc-green").trim() || "#2ebdb5"'));
  assert(source.includes('figureStyle.getPropertyValue("--uchicago-maroon").trim() || "#800000"'));
  assert(source.includes('address.setAttribute("text-decoration", "none")'));
});

test("copy requests image/png within the user gesture, before asynchronous PNG generation", async (t) => {
  const events: string[] = [];
  const blob = new Blob(["png fixture"], { type: "image/png" });
  let clipboardData: Record<string, Promise<Blob>> | undefined;
  replaceGlobal(t, "isSecureContext", true);
  replaceGlobal(t, "ClipboardItem", class {
    constructor(data: Record<string, Promise<Blob>>) { clipboardData = data; }
  });
  replaceGlobal(t, "navigator", { clipboard: { write: async (items: unknown[]) => {
    events.push("write");
    assert.equal(items.length, 1);
    assert.deepEqual(Object.keys(clipboardData!), ["image/png"]);
    assert.equal(await clipboardData!["image/png"], blob);
    events.push("copied");
  } } });
  const copy = copyPngToClipboard(async () => { events.push("render"); return blob; });
  assert.deepEqual(events, ["write"], "No await before requesting clipboard access (including Safari)");
  await copy;
  assert.deepEqual(events, ["write", "render", "copied"]);
});

test("unsupported/insecure clipboard access fails without generating an image", async (t) => {
  let rendered = false;
  const render = async () => { rendered = true; return new Blob(); };
  replaceGlobal(t, "isSecureContext", false);
  await assert.rejects(copyPngToClipboard(render), /unavailable/);
  replaceGlobal(t, "isSecureContext", true);
  replaceGlobal(t, "navigator", {});
  await assert.rejects(copyPngToClipboard(render), /unavailable/);
  assert.equal(rendered, false);
});

test("permission and rendering errors reject rather than reporting a successful copy", async (t) => {
  replaceGlobal(t, "isSecureContext", true);
  replaceGlobal(t, "ClipboardItem", class {
    data: Record<string, Promise<Blob>>;
    constructor(data: Record<string, Promise<Blob>>) { this.data = data; }
  });
  replaceGlobal(t, "navigator", { clipboard: { write: () => Promise.reject(new Error("Permission denied")) } });
  await assert.rejects(copyPngToClipboard(async () => new Blob()), /Permission denied/);
  replaceGlobal(t, "navigator", { clipboard: { write: (items: { data: Record<string, Promise<Blob>> }[]) => items[0].data["image/png"] } });
  await assert.rejects(copyPngToClipboard(async () => { throw new Error("Logo missing"); }), /Logo missing/);
});

test("logo assets become self-contained image data URLs and failed assets stop the export", async (t) => {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg"><text>SDSC · Booth</text></svg>';
  replaceGlobal(t, "fetch", async () => new Response(svg, { headers: { "content-type": "image/svg+xml;charset=utf-8" } }));
  const embedded = await imageDataUrl("/site/assets/logo.svg");
  assert.equal(embedded, `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`);
  assert.equal(await imageDataUrl(embedded), embedded);
  replaceGlobal(t, "fetch", async () => new Response("Not found", { status: 404 }));
  await assert.rejects(imageDataUrl("/missing.svg"), /Could not load/);
  replaceGlobal(t, "fetch", async () => new Response("<html>Not an image</html>", { headers: { "content-type": "text/html" } }));
  await assert.rejects(imageDataUrl("/missing.svg"), /Invalid chart logo/);
});
