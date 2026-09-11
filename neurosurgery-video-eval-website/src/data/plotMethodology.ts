import type { SummaryModality } from "./summaryScoring.ts";

export function plotMethodology(modalities: readonly SummaryModality[], subject: "plot" | "table" = "plot", includesTrainedModels = false): string {
  const included = modalities.map((modality) => ({ ...modality, datasets: modality.datasets.filter((dataset) => dataset.chance !== null) })).filter((modality) => modality.datasets.length);
  const list = included.map((modality) => `${modality.label} (${modality.datasets.map((dataset) => dataset.name).join(", ")})`).join("; ");
  const comparison = subject === "table" || includesTrainedModels ? "performance of models" : "zero-shot performance of LLMs";
  return `The ${subject} shows a weighted average ${comparison} on surgical modalities. 1 means as good as a specialized computer-vision model and 0 means as good as chance. Modalities include ${list}.`;
}
