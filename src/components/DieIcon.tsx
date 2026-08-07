const VIEW_BOX = "0 0 24 24";

/**
 * Face 5: the four corners plus a centre pip. A single pip would be
 * indistinguishable from a plain rounded square at icon sizes.
 */
const PIPS: [cx: number, cy: number][] = [
  [8, 8],
  [16, 8],
  [12, 12],
  [8, 16],
  [16, 16],
];

/**
 * Outlined body with solid pips. A filled die would sit much heavier than the
 * provider glyphs it lines up with, and a coloured one would read as a vendor.
 */
function DieFace({ ink }: { ink: string }) {
  return (
    <g>
      <rect
        x={3.1}
        y={3.1}
        width={17.8}
        height={17.8}
        rx={4}
        fill="none"
        stroke={ink}
        strokeWidth={1.7}
      />
      {PIPS.map(([cx, cy]) => (
        <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={2} fill={ink} />
      ))}
    </g>
  );
}

export const BASELINE_ICON_LABEL = "Majority-class baseline, not a model";

export function DieIcon({ size = 15, ink = "#111111" }: { size?: number; ink?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox={VIEW_BOX}
      role="img"
      aria-label={BASELINE_ICON_LABEL}
    >
      <title>{BASELINE_ICON_LABEL}</title>
      <DieFace ink={ink} />
    </svg>
  );
}
