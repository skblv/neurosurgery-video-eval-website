import {
  Bar,
  BarChart,
  ErrorBar,
  LabelList,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ReactNode } from "react";

import { boothShield, sdscMark } from "../assets/logos";
import {
  BAR_COLOR,
  modelFootnote,
  providerLabel,
} from "../data/benchmark";
import type { LeaderboardBenchmark, LeaderboardMetric } from "../data/leaderboard";
import { PROVIDER_ICONS } from "../data/providerIcons";
import { useMediaQuery } from "../hooks/useMediaQuery";
import { StackedBars } from "./StackedBars";
import { buildRows, type ChartRow } from "./chartRow";

const ICON_SIZE = 14;
const ROW_HEIGHT = 46;
const INK = "#111111";
/** Whitespace between the provider mark column and the longest model name. */
const NAME_GAP = 64;
const NAME_FONT =
  '13px "Inter", ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif';
const FOOTNOTE_FONT =
  '9px "Inter", ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif';
/** The baseline annotation stays grey so it reads as an annotation, not as data. */
const ANNOTATION_INK = "#6f6f6f";
/** Below this the label column leaves too little room to plot, so rows stack. */
const NARROW_QUERY = "(max-width: 700px)";

/**
 * Width of the y-axis label column: the provider mark, a fixed gap, the longest
 * model name, and the 20px inset between the names and the bars. Sizing the
 * column to the content keeps the mark-to-name whitespace identical across
 * benchmarks with long and short model names.
 */
function labelColumnWidth(rows: ChartRow[]): number {
  const context = document.createElement("canvas").getContext("2d");
  if (!context) throw new Error("Canvas 2D context unavailable");

  const widths = rows.map((row) => {
    context.font = NAME_FONT;
    let width = context.measureText(row.model).width;
    const footnote = modelFootnote(row.id);
    if (footnote !== null) {
      context.font = FOOTNOTE_FONT;
      width += context.measureText(String(footnote)).width;
    }
    return width;
  });

  return Math.ceil(ICON_SIZE + NAME_GAP + Math.max(...widths) + 20);
}

/** Provider mark drawn inside the SVG axis gutter, left-aligned in its own column. */
function AxisIcon({ provider, x, y }: { provider: string; x: number; y: number }) {
  if (provider === "internal") {
    return (
      <g>
        <image href={sdscMark} x={x} y={y} height={ICON_SIZE} width={ICON_SIZE * 1.03} />
        <image
          href={boothShield}
          x={x + ICON_SIZE * 1.03 + 4}
          y={y}
          height={ICON_SIZE}
          width={ICON_SIZE * 0.79}
        />
      </g>
    );
  }

  const icon = PROVIDER_ICONS[provider];
  if (!icon) {
    return (
      <image
        href={`./provider-logos/${provider}.png`}
        x={x}
        y={y}
        height={ICON_SIZE}
        width={ICON_SIZE}
      />
    );
  }

  return (
    <svg x={x} y={y} width={ICON_SIZE} height={ICON_SIZE} viewBox={icon.viewBox}>
      <path d={icon.path} fill={icon.hex} />
    </svg>
  );
}

function renderAxisTick(rows: ChartRow[], axisWidth: number) {
  return function AxisTick(props: unknown) {
    const { x, y, index } = props as { x: number; y: number; index: number };
    const row = rows[index];
    if (!row) return <g />;

    return (
      <g transform={`translate(${x},${y})`}>
        <title>{providerLabel(row.provider)}</title>
        <AxisIcon provider={row.provider} x={-axisWidth} y={-ICON_SIZE / 2} />
        <text x={-20} y={0} textAnchor="end" dominantBaseline="central" fill={INK} fontSize={13}>
          {row.model}
          {modelFootnote(row.id) === null ? null : (
            <tspan baselineShift="super" fontSize={9}>
              {modelFootnote(row.id)}
            </tspan>
          )}
        </text>
      </g>
    );
  };
}

/**
 * Value labels sit clear of the upper confidence whisker rather than at a fixed
 * offset from the bar end, which would otherwise collide on wide intervals.
 */
function renderValueLabel(rows: ChartRow[]) {
  return function ValueLabel(props: unknown) {
    const { x, y, width, height, index } = props as {
      x: number;
      y: number;
      width: number;
      height: number;
      index: number;
    };
    const row = rows[index];
    if (!row) return null;

    const pxPerUnit = row.value > 0 ? width / row.value : 0;
    const whiskerPx = row.ciHigh === null ? 0 : (row.ciHigh - row.value) * pxPerUnit;

    return (
      <text
        x={x + width + Math.max(whiskerPx, 0) + 11}
        y={y + height / 2}
        dominantBaseline="central"
        fill={INK}
        fontSize={12}
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        {row.value.toFixed(2)}
      </text>
    );
  };
}

function ChartTooltip({
  active,
  payload,
  benchmark,
  metric,
}: {
  active?: boolean;
  payload?: { payload: ChartRow }[];
  benchmark: LeaderboardBenchmark<string>;
  metric: LeaderboardMetric;
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;

  return (
    <div className="tip">
      <p className="tip__model">{row.model}</p>
      <p className="tip__value">
        {row.value.toFixed(2)}% {metric.captionName}
      </p>
      {row.ciLow !== null && row.ciHigh !== null ? (
        <p className="tip__row">
          95% CI {row.ciLow.toFixed(2)}–{row.ciHigh.toFixed(2)}
        </p>
      ) : null}
      <p className="tip__row">{providerLabel(row.provider)}</p>
      <p className="tip__row tip__row--faint">{benchmark.name}</p>
    </div>
  );
}

export function ResultsChart<MetricId extends string>({
  dataset,
  metricId,
  metric,
  caption,
}: {
  dataset: LeaderboardBenchmark<MetricId>;
  metricId: MetricId;
  metric: LeaderboardMetric<MetricId>;
  caption?: ReactNode;
}) {
  const rows = buildRows(dataset, metricId);
  const axisWidth = labelColumnWidth(rows);
  const baseline = dataset.majorityBaseline[metricId];
  const hasIntervals = rows.some((row) => row.errorOffsets !== null);
  const missing = dataset.results.filter((r) => r.metrics[metricId] === null).map((r) => r.model);
  const isNarrow = useMediaQuery(NARROW_QUERY);

  if (isNarrow) {
    return (
      <figure className="chart">
        <StackedBars rows={rows} baseline={baseline} metric={metric} />
        <Caption
          caption={caption}
          baseline={baseline}
          hasIntervals={hasIntervals}
          missing={missing}
        />
      </figure>
    );
  }

  return (
    <figure className="chart">
      <ResponsiveContainer width="100%" height={rows.length * ROW_HEIGHT + 70}>
        <BarChart
          layout="vertical"
          data={rows}
          margin={{ top: 30, right: 60, bottom: 24, left: 0 }}
          barCategoryGap="24%"
        >
          <XAxis
            type="number"
            domain={[0, 100]}
            ticks={[0, 20, 40, 60, 80, 100]}
            tickLine={false}
            axisLine={{ stroke: "#a3a3a3" }}
            tick={{ fill: INK, fontSize: 12 }}
            label={{
              value: metric.axisLabel,
              position: "insideBottom",
              offset: -14,
              fill: INK,
              fontSize: 12,
            }}
          />
          <YAxis
            type="category"
            dataKey="model"
            width={axisWidth}
            tickLine={false}
            axisLine={false}
            tick={renderAxisTick(rows, axisWidth)}
            interval={0}
            tickSize={0}
            tickMargin={0}
          />
          <Tooltip
            cursor={{ fill: "rgba(15, 118, 110, 0.06)" }}
            content={
              <ChartTooltip
                benchmark={dataset as LeaderboardBenchmark<string>}
                metric={metric}
              />
            }
          />
          {baseline === null ? null : (
            <ReferenceLine
              x={baseline}
              stroke={ANNOTATION_INK}
              strokeDasharray="4 4"
              strokeWidth={1.5}
              label={{
                value: `baseline ${baseline.toFixed(2)}%`,
                position: "top",
                fill: ANNOTATION_INK,
                fontSize: 11,
              }}
            />
          )}
          <Bar
            dataKey="value"
            fill={BAR_COLOR}
            isAnimationActive={false}
            activeBar={{ fill: "#0B5D57" }}
          >
            {hasIntervals ? (
              <ErrorBar
                dataKey="errorOffsets"
                width={5}
                strokeWidth={1.4}
                stroke={INK}
                direction="x"
              />
            ) : null}
            <LabelList dataKey="value" content={renderValueLabel(rows)} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      <Caption
        caption={caption}
        baseline={baseline}
        hasIntervals={hasIntervals}
        missing={missing}
      />
    </figure>
  );
}

function Caption({
  caption,
  baseline,
  hasIntervals,
  missing,
}: {
  caption?: ReactNode;
  baseline: number | null;
  hasIntervals: boolean;
  missing: string[];
}) {
  const notes = [
    hasIntervals ? "Error bars show 95% bootstrap confidence intervals." : null,
    baseline === null ? null : "The dashed line shows the majority-class baseline.",
    missing.length > 0 ? `Not evaluated on this metric: ${missing.join(", ")}.` : null,
  ].filter((note): note is string => note !== null);

  if (caption === undefined && notes.length === 0) return null;

  return (
    <figcaption className="chart__caption">
      {caption}
      {notes.map((note) => ` ${note}`).join("")}
    </figcaption>
  );
}
