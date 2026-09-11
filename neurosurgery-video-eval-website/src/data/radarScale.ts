/** Negative adjusted scores stay on their modality axis, inside the zero ring. */
export function radarScale(values: readonly (number | null)[]) {
  const measured = values.filter((value): value is number => value !== null && Number.isFinite(value));
  const floor = Math.floor(Math.min(0, ...measured) * 4) / 4;
  const ceiling = 1;
  const span = ceiling - floor;
  return { floor, ceiling, valueAt: (fraction: number) => floor + fraction * span, fraction: (value: number) => (value - floor) / span };
}

const COLORS = ["#0f766e", "#b45309", "#6d28d9", "#2563eb"];
export const radarColor = (index: number) => COLORS[index] ?? `hsl(${(index * 137.5) % 360} 65% 40%)`;

export function radarProfiles<T extends { id: string; model: string }>(selected: readonly string[], rows: readonly T[]) {
  return selected.flatMap((id, index) => {
    const row = rows.find((candidate) => candidate.id === id);
    return row ? [{ ...row, color: radarColor(index) }] : [];
  });
}
