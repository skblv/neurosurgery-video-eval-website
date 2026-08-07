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

import { boothShield, sdscMark } from "../assets/logos";
import {
  BAR_COLOR,
  PROVIDER_LABELS,
  type Dataset,
  type ModelResult,
  type Provider,
} from "../data/benchmark";
import { PROVIDER_ICONS } from "../data/providerIcons";

const AXIS_WIDTH = 252;
const ICON_SIZE = 14;
const ROW_HEIGHT = 46;

interface ChartRow {
  id: string;
  model: string;
  provider: Provider;
  exactMatch: number;
  ciLow: number | null;
  ciHigh: number | null;
  errorOffsets: [number, number] | null;
}

function buildRows(dataset: Dataset): ChartRow[] {
  return dataset.results.map((result: ModelResult) => ({
    id: result.id,
    model: result.model,
    provider: result.provider,
    exactMatch: result.exactMatch,
    ciLow: result.ciLow,
    ciHigh: result.ciHigh,
    errorOffsets:
      result.ciLow === null || result.ciHigh === null
        ? null
        : [result.exactMatch - result.ciLow, result.ciHigh - result.exactMatch],
  }));
}

/** Provider mark drawn inside the SVG axis gutter, left-aligned in its own column. */
function AxisIcon({ provider, x, y }: { provider: Provider; x: number; y: number }) {
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
  return (
    <svg x={x} y={y} width={ICON_SIZE} height={ICON_SIZE} viewBox={icon.viewBox}>
      <path d={icon.path} fill={icon.hex} />
    </svg>
  );
}

function renderAxisTick(rows: ChartRow[]) {
  return function AxisTick(props: unknown) {
    const { x, y, index } = props as { x: number; y: number; index: number };
    const row = rows[index];
    if (!row) return <g />;

    return (
      <g transform={`translate(${x},${y})`}>
        <title>{PROVIDER_LABELS[row.provider]}</title>
        <AxisIcon provider={row.provider} x={-AXIS_WIDTH + 2} y={-ICON_SIZE / 2} />
        <text x={-12} y={0} textAnchor="end" dominantBaseline="central" fill="#27272a" fontSize={13}>
          {row.model}
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

    const pxPerUnit = row.exactMatch > 0 ? width / row.exactMatch : 0;
    const whiskerPx = row.ciHigh === null ? 0 : (row.ciHigh - row.exactMatch) * pxPerUnit;

    return (
      <text
        x={x + width + Math.max(whiskerPx, 0) + 11}
        y={y + height / 2}
        dominantBaseline="central"
        fill="#27272a"
        fontSize={12}
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        {row.exactMatch.toFixed(2)}
      </text>
    );
  };
}

function ChartTooltip({
  active,
  payload,
  dataset,
}: {
  active?: boolean;
  payload?: { payload: ChartRow }[];
  dataset: Dataset;
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;

  return (
    <div className="tip">
      <p className="tip__model">{row.model}</p>
      <p className="tip__value">{row.exactMatch.toFixed(2)}% exact match</p>
      {row.ciLow !== null && row.ciHigh !== null ? (
        <p className="tip__row">
          95% CI {row.ciLow.toFixed(2)}–{row.ciHigh.toFixed(2)}
        </p>
      ) : null}
      <p className="tip__row">{PROVIDER_LABELS[row.provider]}</p>
      <p className="tip__row tip__row--faint">{dataset.name}</p>
    </div>
  );
}

export function ResultsChart({ dataset }: { dataset: Dataset }) {
  const rows = buildRows(dataset);

  return (
    <figure className="chart">
      <ResponsiveContainer width="100%" height={rows.length * ROW_HEIGHT + 70}>
        <BarChart
          layout="vertical"
          data={rows}
          margin={{ top: 30, right: 60, bottom: 24, left: 8 }}
          barCategoryGap="24%"
        >
          <XAxis
            type="number"
            domain={[0, 100]}
            ticks={[0, 20, 40, 60, 80, 100]}
            tickLine={false}
            axisLine={{ stroke: "#d4d4d8" }}
            tick={{ fill: "#71717a", fontSize: 12 }}
            label={{
              value: "Exact-match accuracy (%)",
              position: "insideBottom",
              offset: -14,
              fill: "#52525b",
              fontSize: 12,
            }}
          />
          <YAxis
            type="category"
            dataKey="model"
            width={AXIS_WIDTH}
            tickLine={false}
            axisLine={false}
            tick={renderAxisTick(rows)}
            interval={0}
          />
          <Tooltip
            cursor={{ fill: "rgba(15, 118, 110, 0.06)" }}
            content={<ChartTooltip dataset={dataset} />}
          />
          <ReferenceLine
            x={dataset.majorityBaseline}
            stroke="#a1a1aa"
            strokeDasharray="4 4"
            strokeWidth={1.5}
            label={{
              value: `baseline ${dataset.majorityBaseline.toFixed(2)}%`,
              position: "top",
              fill: "#a1a1aa",
              fontSize: 11,
            }}
          />
          <Bar
            dataKey="exactMatch"
            fill={BAR_COLOR}
            radius={[0, 3, 3, 0]}
            isAnimationActive={false}
            activeBar={{ fill: "#0B5D57" }}
          >
            <ErrorBar
              dataKey="errorOffsets"
              width={5}
              strokeWidth={1.4}
              stroke="#3f3f46"
              direction="x"
            />
            <LabelList dataKey="exactMatch" content={renderValueLabel(rows)} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      <figcaption className="chart__caption">
        {dataset.valFrames.toLocaleString()} held-out frames · {dataset.toolClasses} instrument
        classes · whiskers are 95% bootstrap confidence intervals · dashed line is the
        majority-class baseline ·{" "}
        <a href={dataset.sourceUrl} target="_blank" rel="noreferrer">
          dataset source
        </a>
      </figcaption>
    </figure>
  );
}
