import { BAR_COLOR } from "../data/benchmark";
import type { LeaderboardMetric } from "../data/leaderboard";
import { ModelIcon } from "./ModelIcon";
import type { ChartRow } from "./chartRow";

const AXIS_TICKS = [0, 25, 50, 75, 100];

/** Keeps the end ticks inside the track instead of hanging off both edges. */
function tickTransform(tick: number): string {
  if (tick === 0) return "translateX(0)";
  if (tick === 100) return "translateX(-100%)";
  return "translateX(-50%)";
}

/**
 * Phone-width variant of the results figure: the model name and value sit on a
 * text line above a bar that spans the full content width, so differences in
 * bar length stay readable where a label column would leave no room to plot.
 */
export function StackedBars({
  rows,
  baseline,
  metric,
}: {
  rows: ChartRow[];
  baseline: number | null;
  metric: LeaderboardMetric;
}) {
  return (
    <div className="stack">
      <ol className="stack__rows">
        {rows.map((row) => (
          <li key={row.id} className="stack__row">
            <div className="stack__head">
              <ModelIcon provider={row.provider} size={14} />
              <span className="stack__name">{row.model}</span>
              <span className="stack__value">{row.value.toFixed(2)}</span>
            </div>
            <div className="stack__track">
              <div
                className="stack__bar"
                style={{ width: `${row.value}%`, background: BAR_COLOR }}
              />
              {row.ciLow === null || row.ciHigh === null ? null : (
                <span
                  className="stack__whisker"
                  style={{ left: `${row.ciLow}%`, width: `${row.ciHigh - row.ciLow}%` }}
                />
              )}
              {baseline === null ? null : (
                <span className="stack__baseline" style={{ left: `${baseline}%` }} />
              )}
            </div>
          </li>
        ))}
      </ol>

      <div className="stack__axis" aria-hidden="true">
        {AXIS_TICKS.map((tick) => (
          <span
            key={tick}
            className="stack__tick"
            style={{ left: `${tick}%`, transform: tickTransform(tick) }}
          >
            {tick}
          </span>
        ))}
      </div>

      <p className="stack__axis-label">{metric.axisLabel}</p>

      {baseline === null ? null : (
        <p className="stack__legend">
          dashed line: majority-class baseline {baseline.toFixed(2)}%
        </p>
      )}
    </div>
  );
}
