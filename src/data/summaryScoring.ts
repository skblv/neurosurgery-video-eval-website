export interface SummaryDataset {
  id: string;
  name: string;
  metric: string;
  referenceId: string;
  chance: number | null;
  results: { id: string; model: string; value: number | null }[];
}

export interface SummaryModality {
  id: string;
  label: string;
  datasets: SummaryDataset[];
}

export function canonicalModelId(id: string): string {
  return id === "gpt-5-6-sol" ? "gpt-5_6-sol" : id;
}

export function meanAvailable(values: (number | null)[]): number | null {
  const available = values.filter((value): value is number => value !== null);
  return available.length ? available.reduce((sum, value) => sum + value, 0) / available.length : null;
}

/** One fixed no-image baseline per dataset; undefined or degenerate scales remain NA. */
export function chanceAdjustedScore(value: number | null | undefined, reference: number | null | undefined, chance: number | null | undefined): number | null {
  if (value == null || reference == null || chance == null || !Number.isFinite(value) || !Number.isFinite(reference) || !Number.isFinite(chance) || reference <= chance) return null;
  return (value - chance) / (reference - chance);
}

export function calculateSummary(modalities: SummaryModality[]) {
  const models = new Map<string, string>();
  for (const modality of modalities) {
    for (const dataset of modality.datasets) {
      for (const result of dataset.results) models.set(canonicalModelId(result.id), result.model);
    }
  }
  return [...models].map(([id, model]) => {
    const scores = modalities.map((modality) => {
      const datasets = modality.datasets.map((dataset) => {
        const reference = dataset.results.find((result) => result.id === dataset.referenceId)?.value;
        const value = dataset.results.find((result) => canonicalModelId(result.id) === id)?.value;
        return chanceAdjustedScore(value, reference, dataset.chance);
      });
      return { value: meanAvailable(datasets), datasets, covered: datasets.filter((value) => value !== null).length };
    });
    return { id, model, scores, total: meanAvailable(scores.map((score) => score.value)), covered: scores.reduce((sum, score) => sum + score.covered, 0) };
  }).sort((a, b) => (b.total ?? -Infinity) - (a.total ?? -Infinity) || b.covered - a.covered || a.model.localeCompare(b.model));
}

export const SPECIALIST_REFERENCE_ID = "sdsc-uchicago-reference";

/** A composite of each dataset's fixed specialist, not an independently evaluated model. */
export function calculateSpecialistReference(modalities: SummaryModality[]) {
  return calculateSummary(modalities.map((modality) => ({
    ...modality,
    datasets: modality.datasets.map((dataset) => ({
      ...dataset,
      results: [
        ...dataset.results.filter((result) => result.id === dataset.referenceId),
        { id: SPECIALIST_REFERENCE_ID, model: "SDSC/UChicago", value: dataset.results.find((result) => result.id === dataset.referenceId)?.value ?? null },
      ],
    })),
  }))).find((row) => row.id === SPECIALIST_REFERENCE_ID);
}
