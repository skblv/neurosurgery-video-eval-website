const SVG_NS = "http://www.w3.org/2000/svg";
const PNG_SCALE = 2;
export interface PlotBranding {
  url: string;
  label: string;
  logos: readonly { src: string; label: string; width: number; height: number }[];
}
const STYLE_PROPERTIES = [
  "fill", "fill-opacity", "fill-rule", "stroke", "stroke-width", "stroke-opacity",
  "stroke-dasharray", "stroke-linecap", "stroke-linejoin", "opacity", "color",
  "font-family", "font-size", "font-weight", "font-style", "font-variant-numeric",
  "letter-spacing", "text-anchor", "dominant-baseline", "text-decoration",
];

export async function imageDataUrl(href: string): Promise<string> {
  if (href.startsWith("data:")) return href;
  const response = await fetch(href);
  if (!response.ok) throw new Error("Could not load a chart logo.");
  const type = response.headers.get("content-type")?.split(";")[0];
  if (!type?.startsWith("image/")) throw new Error("Invalid chart logo.");
  const bytes = new Uint8Array(await response.arrayBuffer());
  const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join("");
  return `data:${type};base64,${btoa(binary)}`;
}

/** Embed styles and logo assets so the SVG remains complete when loaded as an image. */
export async function standalonePlotSvg(plot: SVGSVGElement, title: string, subtitle = "", methodology = "", branding?: PlotBranding) {
  const clone = plot.cloneNode(true) as SVGSVGElement;
  const sourceNodes = [plot, ...plot.querySelectorAll<SVGElement>("*")];
  const cloneNodes = [clone, ...clone.querySelectorAll<SVGElement>("*")];
  sourceNodes.forEach((node, index) => {
    const computed = getComputedStyle(node);
    for (const property of STYLE_PROPERTIES) {
      cloneNodes[index].style.setProperty(property, computed.getPropertyValue(property));
    }
  });
  clone.querySelectorAll(".release-tooltip, .release-focus-ring").forEach((node) => node.remove());
  const logos = new Map<string, Promise<string>>();
  await Promise.all(Array.from(clone.querySelectorAll("image"), async (image) => {
    const href = image.getAttribute("href");
    if (!href) throw new Error("Missing chart logo.");
    if (!logos.has(href)) logos.set(href, imageDataUrl(href));
    image.setAttribute("href", await logos.get(href)!);
  }));

  const { width, height } = plot.viewBox.baseVal;
  const figureStyle = getComputedStyle(plot.closest("figure") ?? plot);
  const measure = document.createElement("canvas").getContext("2d");
  if (!measure) throw new Error("Image export is unavailable.");
  measure.font = `20px ${figureStyle.fontFamily}`;
  const subtitleLines = wrapPlotSubtitle(subtitle, width - 52, (text) => measure.measureText(text).width);
  const headerHeight = 64 + subtitleLines.length * 28;
  measure.font = `12px ${figureStyle.fontFamily}`;
  const footerLines = wrapPlotSubtitle(methodology, width - 52, (text) => measure.measureText(text).width);
  const footerHeight = footerLines.length ? footerLines.length * 18 + 20 : 0;
  const brandingHeight = branding ? 58 : 0;
  const totalHeight = height + headerHeight + footerHeight + brandingHeight;
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("width", String(width));
  svg.setAttribute("height", String(totalHeight));
  svg.setAttribute("viewBox", `0 0 ${width} ${totalHeight}`);
  const background = document.createElementNS(SVG_NS, "rect");
  background.setAttribute("width", "100%");
  background.setAttribute("height", "100%");
  background.setAttribute("fill", figureStyle.getPropertyValue("--paper").trim() || "#fdfdfc");
  const heading = document.createElementNS(SVG_NS, "text");
  heading.setAttribute("x", "26");
  heading.setAttribute("y", "42");
  heading.setAttribute("fill", "#000");
  heading.setAttribute("font-family", figureStyle.fontFamily);
  heading.setAttribute("font-size", "24");
  heading.setAttribute("font-weight", "560");
  heading.textContent = title;
  const description = document.createElementNS(SVG_NS, "text");
  description.setAttribute("fill", "#000");
  description.setAttribute("font-family", figureStyle.fontFamily);
  description.setAttribute("font-size", "20");
  subtitleLines.forEach((line, index) => {
    const span = document.createElementNS(SVG_NS, "tspan");
    span.setAttribute("x", "26");
    span.setAttribute("y", String(70 + index * 28));
    span.textContent = line;
    description.append(span);
  });
  clone.removeAttribute("class");
  clone.setAttribute("width", String(width));
  clone.setAttribute("height", String(height));
  clone.setAttribute("x", "0");
  clone.setAttribute("y", String(headerHeight));
  svg.append(background, heading, description, clone);
  const footer = document.createElementNS(SVG_NS, "text");
  footer.setAttribute("fill", figureStyle.getPropertyValue("--annotation").trim() || "#6f6f6f");
  footer.setAttribute("font-family", figureStyle.fontFamily);
  footer.setAttribute("font-size", "12");
  footerLines.forEach((line, index) => {
    const span = document.createElementNS(SVG_NS, "tspan");
    span.setAttribute("x", "26");
    span.setAttribute("y", String(headerHeight + height + 20 + index * 18));
    span.textContent = line;
    footer.append(span);
  });
  svg.append(footer);
  if (branding) {
    const definitions = document.createElementNS(SVG_NS, "defs");
    const gradient = document.createElementNS(SVG_NS, "linearGradient");
    gradient.setAttribute("id", "plot-address-gradient");
    gradient.setAttribute("x1", "0%");
    gradient.setAttribute("y1", "0%");
    gradient.setAttribute("x2", "100%");
    gradient.setAttribute("y2", "0%");
    const brandColors = [
      figureStyle.getPropertyValue("--sdsc-green").trim() || "#2ebdb5",
      figureStyle.getPropertyValue("--uchicago-maroon").trim() || "#800000",
    ];
    brandColors.forEach((color, index) => {
      const stop = document.createElementNS(SVG_NS, "stop");
      stop.setAttribute("offset", `${index * 100}%`);
      stop.setAttribute("stop-color", color);
      gradient.append(stop);
    });
    definitions.append(gradient);
    svg.append(definitions);
    const address = document.createElementNS(SVG_NS, "text");
    address.setAttribute("x", "26");
    address.setAttribute("y", String(totalHeight - 23));
    address.setAttribute("fill", "url(#plot-address-gradient)");
    address.setAttribute("font-family", figureStyle.fontFamily);
    address.setAttribute("font-size", "22");
    address.setAttribute("font-weight", "700");
    address.setAttribute("text-decoration", "none");
    address.textContent = branding.label;
    svg.append(address);
    const sources = await Promise.all(branding.logos.map((logo) => imageDataUrl(logo.src)));
    let x = width - 26 - branding.logos.reduce((sum, logo) => sum + logo.width, 0) - Math.max(0, branding.logos.length - 1) * 18;
    branding.logos.forEach((logo, index) => {
      const image = document.createElementNS(SVG_NS, "image");
      image.setAttribute("href", sources[index]);
      image.setAttribute("x", String(x));
      image.setAttribute("y", String(totalHeight - 43));
      image.setAttribute("width", String(logo.width));
      image.setAttribute("height", String(logo.height));
      image.setAttribute("aria-label", logo.label);
      svg.append(image);
      x += logo.width + 18;
    });
  }
  return { source: new XMLSerializer().serializeToString(svg), width, height: totalHeight };
}

export function wrapPlotSubtitle(text: string, maxWidth: number, measureWidth: (text: string) => number): string[] {
  const lines: string[] = [];
  for (const word of text.trim().split(/\s+/).filter(Boolean)) {
    const previous = lines.at(-1);
    if (previous && measureWidth(`${previous} ${word}`) <= maxWidth) lines[lines.length - 1] = `${previous} ${word}`;
    else lines.push(word);
  }
  return lines;
}

export async function plotPng(plot: SVGSVGElement, title: string, subtitle = "", methodology = "", branding?: PlotBranding): Promise<Blob> {
  const { source, width, height } = await standalonePlotSvg(plot, title, subtitle, methodology, branding);
  const url = URL.createObjectURL(new Blob([source], { type: "image/svg+xml;charset=utf-8" }));
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Could not render the chart image."));
      image.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = width * PNG_SCALE;
    canvas.height = height * PNG_SCALE;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Image export is unavailable.");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Could not create the PNG.")), "image/png");
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Call synchronously from the click handler: Safari requires the original user gesture. */
export function copyPngToClipboard(createPng: () => Promise<Blob>): Promise<void> {
  if (!globalThis.isSecureContext || !navigator.clipboard?.write || typeof ClipboardItem === "undefined") {
    return Promise.reject(new Error("Image copying is unavailable. Open this page in a browser over HTTPS or localhost."));
  }
  // Defer rendering, but request clipboard access before yielding the user gesture.
  const png = Promise.resolve().then(createPng);
  void png.catch(() => {}); // A denied permission must not leave a render rejection unhandled.
  try {
    return navigator.clipboard.write([new ClipboardItem({ "image/png": png })]);
  } catch (error) {
    return Promise.reject(error);
  }
}
