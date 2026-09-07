export interface SummaryDataset {
  id: string;
  name: string;
  metric: string;
  referenceId: string;
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
        return value != null && reference != null && reference > 0 ? value / reference : null;
      });
      return { value: meanAvailable(datasets), datasets, covered: datasets.filter((value) => value !== null).length };
    });
    return { id, model, scores, total: meanAvailable(scores.map((score) => score.value)), covered: scores.reduce((sum, score) => sum + score.covered, 0) };
  }).sort((a, b) => (b.total ?? -Infinity) - (a.total ?? -Infinity) || b.covered - a.covered || a.model.localeCompare(b.model));
}
