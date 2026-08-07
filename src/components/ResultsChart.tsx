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
  METRICS,
  PROVIDER_LABELS,
  type Dataset,
  type Metric,
  type MetricId,
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
  value: number;
  ciLow: number | null;
  ciHigh: number | null;
  errorOffsets: [number, number] | null;
}

function toRow(result: ModelResult, metricId: MetricId): ChartRow | null {
  const metric = result.metrics[metricId];
  if (metric === null) return null;

  const { value, ciLow, ciHigh } = metric;
  return {
    id: result.id,
    model: result.model,
    provider: result.provider,
    value,
    ciLow,
    ciHigh,
    errorOffsets:
      ciLow === null || ciHigh === null ? null : [value - ciLow, ciHigh - value],
  };
}

function buildRows(dataset: Dataset, metricId: MetricId): ChartRow[] {
  return dataset.results
    .map((result) => toRow(result, metricId))
    .filter((row): row is ChartRow => row !== null)
    .sort((a, b) => b.value - a.value);
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

    const pxPerUnit = row.value > 0 ? width / row.value : 0;
    const whiskerPx = row.ciHigh === null ? 0 : (row.ciHigh - row.value) * pxPerUnit;

    return (
      <text
        x={x + width + Math.max(whiskerPx, 0) + 11}
        y={y + height / 2}
        dominantBaseline="central"
        fill="#27272a"
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
  dataset,
  metric,
}: {
  active?: boolean;
  payload?: { payload: ChartRow }[];
  dataset: Dataset;
  metric: Metric;
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
      <p className="tip__row">{PROVIDER_LABELS[row.provider]}</p>
      <p className="tip__row tip__row--faint">{dataset.name}</p>
    </div>
  );
}

export function ResultsChart({ dataset, metricId }: { dataset: Dataset; metricId: MetricId }) {
  const metric = METRICS[metricId];
  const rows = buildRows(dataset, metricId);
  const baseline = dataset.majorityBaseline[metricId];
  const hasIntervals = rows.some((row) => row.errorOffsets !== null);
  const missing = dataset.results.filter((r) => r.metrics[metricId] === null).map((r) => r.model);

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
              value: metric.axisLabel,
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
            content={<ChartTooltip dataset={dataset} metric={metric} />}
          />
          {baseline === null ? null : (
            <ReferenceLine
              x={baseline}
              stroke="#a1a1aa"
              strokeDasharray="4 4"
              strokeWidth={1.5}
              label={{
                value: `baseline ${baseline.toFixed(2)}%`,
                position: "top",
                fill: "#a1a1aa",
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
                stroke="#3f3f46"
                direction="x"
              />
            ) : null}
            <LabelList dataKey="value" content={renderValueLabel(rows)} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      <figcaption className="chart__caption">
        The plot reports {metric.captionName} on {dataset.toolClasses} instruments (
        {metric.definition}) in the{" "}
        <a href={dataset.sourceUrl} target="_blank" rel="noreferrer">
          {dataset.name}
        </a>{" "}
        dataset{hasIntervals ? " with 95% bootstrap confidence intervals" : ""}.
        {baseline === null ? "" : " The dashed line shows the majority-class baseline."}
        {missing.length > 0 ? ` Not evaluated on this metric: ${missing.join(", ")}.` : ""}
      </figcaption>
    </figure>
  );
}
