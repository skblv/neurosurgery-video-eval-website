import { DATASETS } from './benchmark';
import { DOMAIN_DATASETS, DOMAIN_PAGES } from './domainBenchmark';
import { GESTURE_BENCHMARK } from './gestureBenchmark';
import type { LeaderboardBenchmark } from './leaderboard';

export function mean(values: number[]): number | null {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}
export function relativeScore(value: number | null | undefined, baseline: number | null | undefined): number | null {
  return value != null && baseline != null && Number.isFinite(value) && Number.isFinite(baseline) && baseline > 0 ? value / baseline : null;
}
const domain = (key: keyof typeof DOMAIN_PAGES) => DOMAIN_PAGES[key].datasetIds.map(id => DOMAIN_DATASETS[id]);
export const MODALITIES = [
  { id: 'instruments', label: 'Instruments', baseline: 'yolov12m', baselineLabel: 'YOLOv12-m', metric: 'exactMatch', datasets: DATASETS },
  { id: 'gestures', label: 'Action', baseline: 'surgmotion', baselineLabel: 'SurgMotion', metric: 'exactAccuracy', datasets: [GESTURE_BENCHMARK] },
  { id: 'anatomy', label: 'Anatomy', baseline: 'resnet50', baselineLabel: 'ResNet-50', metric: 'exactMatch', datasets: domain('anatomy') },
  { id: 'skill-assessment', label: 'Skill assessment', baseline: 'resnet50', baselineLabel: 'ResNet-50', metric: 'exactMatch', datasets: domain('skill-assessment') },
  { id: 'clinical-context', label: 'Context / VQA', baseline: 'resnet50', baselineLabel: 'ResNet-50', metric: 'exactMatch', datasets: domain('clinical-context') },
  { id: 'recommendations', label: 'Recommendations', baseline: 'resnet50', baselineLabel: 'ResNet-50', metric: 'exactMatch', datasets: domain('recommendations') },
] satisfies { id: string; label: string; baseline: string; baselineLabel: string; metric: string; datasets: LeaderboardBenchmark<string>[] }[];
// The gesture export uses a different slug for the same GPT-5.6 Sol model.
const canonicalId = (id: string) => id === 'gpt-5-6-sol' ? 'gpt-5_6-sol' : id;
const models = new Map<string, string>();
for (const modality of MODALITIES) for (const dataset of modality.datasets) for (const result of dataset.results) models.set(canonicalId(result.id), result.model);
export const SUMMARY_ROWS = [...models].map(([id, model]) => {
  const scores = MODALITIES.map(modality => {
    const details = (modality.datasets as LeaderboardBenchmark<string>[]).map(dataset => {
      const value = dataset.results.find(result => canonicalId(result.id) === id)?.metrics[modality.metric]?.value;
      const baseline = dataset.results.find(result => result.id === modality.baseline)?.metrics[modality.metric]?.value;
      return { dataset: dataset.name, value: value ?? null, baseline: baseline ?? null, ratio: relativeScore(value, baseline) };
    });
    const ratios = details.flatMap(item => item.ratio === null ? [] : [item.ratio]);
    return { value: mean(ratios), count: ratios.length, total: details.length, details };
  });
  const available = scores.flatMap(score => score.value === null ? [] : [score.value]);
  return { id, model, scores, total: mean(available), coverage: available.length };
}).sort((a, b) => (b.total ?? -1) - (a.total ?? -1));
