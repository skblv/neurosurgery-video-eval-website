/** Preserve historical scores while holding models with uncompleted evaluations. */
const HELD_MODEL_IDS = new Set([
  "qwen3-8-max",
]);

// Grok and Qwen Max 0902's requested gap runs are complete and verified/imported.
// The older Max ID remains unavailable/incomplete; do not relabel its historical
// instrument scores as 0902 results. Unmeasured scores keep their normal NA policy.
export function isLeaderboardModelVisible(result: { id: string }): boolean {
  return !HELD_MODEL_IDS.has(result.id);
}
