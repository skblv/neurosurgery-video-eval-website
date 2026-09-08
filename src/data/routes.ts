import { ROUTES, type DomainRoute } from "./domains.ts";

export const PAGE_SEO: Record<DomainRoute, { title: string; description: string }> = {
  summary: {
    title: "Surgical Intelligence Leaderboard | SDSC × UChicago",
    description: "Compare visual language models with specialised surgical models across six modalities. Explore modality-balanced scores, dataset results, and reproducible benchmarks.",
  },
  instruments: {
    title: "Surgical Instrument Recognition Benchmarks | SDSC × UChicago",
    description: "Compare vision-language and specialist models for surgical instrument recognition on CholecT50, PitVis-2023, and SurgVU, with F1 scores and confidence intervals.",
  },
  gestures: {
    title: "Surgical Action and Gesture Benchmark | SDSC × UChicago",
    description: "Explore the continuous-operation surgical gesture pilot: compare models on frame-level action recognition, exact accuracy, and F1 scores.",
  },
  anatomy: {
    title: "Surgical Anatomy Recognition Benchmarks | SDSC × UChicago",
    description: "Compare surgical anatomy and entity recognition across DSAD, CaDIS, and Endoscapes, with results for visual language models and specialist references.",
  },
  "clinical-context": {
    title: "Surgical Context and Visual Question Answering | SDSC × UChicago",
    description: "Compare visual language models on surgical phase and step recognition using PitVQA, the surgical context and visual question answering benchmark.",
  },
  recommendations: {
    title: "Surgical Recommendations and Action Recognition | SDSC × UChicago",
    description: "Explore surgical action and step recognition on CholecT50 verbs and PitVis, proxy benchmarks toward surgical recommendations, with model performance comparisons.",
  },
  "skill-assessment": {
    title: "Surgical Skill Assessment Benchmarks | SDSC × UChicago",
    description: "Compare models on SARRARP50 suturing action recognition, a proxy benchmark toward surgical skill assessment, with reproducible performance scores.",
  },
};

export function routePath(route: DomainRoute, base = import.meta.env?.BASE_URL ?? "/"): string {
  return `${base.replace(/\/?$/, "/")}${route === "summary" ? "" : `${route}/`}`;
}

/** Unknown paths remain unknown, so a missing page cannot become a soft 404. */
export function routeFromPath(pathname: string, base = import.meta.env?.BASE_URL ?? "/"): DomainRoute | null {
  const prefix = base.replace(/\/?$/, "/");
  if (pathname === prefix.slice(0, -1)) return "summary";
  if (!pathname.startsWith(prefix)) return null;
  const candidate = pathname.slice(prefix.length).replace(/(^|\/)index\.html$/, "").replace(/\/$/, "");
  if (candidate === "") return "summary";
  return ROUTES.includes(candidate as DomainRoute) ? candidate as DomainRoute : null;
}

export function legacyRouteFromHash(hash: string): DomainRoute | null {
  const candidate = /^#\/?([a-z-]+)\/?$/.exec(hash)?.[1];
  if (candidate === "overview") return "summary";
  return ROUTES.includes(candidate as DomainRoute) ? candidate as DomainRoute : null;
}
