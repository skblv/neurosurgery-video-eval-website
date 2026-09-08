/** Temporary publication holds; keep scores/provenance intact while runs finish. */
const HELD_MODEL_IDS = new Set([
  "qwen3-8-max",
  "qwen3-8-max-0902",
  "grok-4_6",
]);

// Release each model's hold after all its remaining evaluations are verified
// complete and imported. Qwen3.8 27B is already complete and remains visible.
export function isLeaderboardModelVisible(result: { id: string }): boolean {
  return !HELD_MODEL_IDS.has(result.id);
}
