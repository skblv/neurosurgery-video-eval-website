import { useMemo, useState } from "react";

import { isNewModel } from "../data/leaderboard";
import {
  SUMMARY_LLM_ROWS,
  SUMMARY_MODALITIES,
  formatScore,
  type SummaryRow,
} from "../data/summary";
import { ModelIcon } from "./ModelIcon";
import "../summary.css";

const PLOT_COLORS = ["#0f766e", "#4f46e5", "#b45309", "#be185d", "#0369a1", "#6d28d9"];
const DEFAULT_MODELS = ["gpt-6-astra", "claude-fable-5_1", "gemini-3_8-flash"];
const WEB_CENTER_X = 320;
const WEB_CENTER_Y = 250;
const WEB_RADIUS = 132;
const WEB_LABEL_RADIUS = 178;

function webAngle(index: number): number {
  return (index * 2 * Math.PI) / SUMMARY_MODALITIES.length - Math.PI / 2;
}

function webPoint(index: number, value: number, radius = WEB_RADIUS) {
  const angle = webAngle(index);
  return {
    x: WEB_CENTER_X + Math.cos(angle) * radius * value,
    y: WEB_CENTER_Y + Math.sin(angle) * radius * value,
  };
}

function cornerLabel(index: number) {
  const angle = webAngle(index);
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const point = webPoint(index, 1, WEB_LABEL_RADIUS);
  if (Math.abs(cos) < 0.25) {
    return {
      x: point.x,
      y: sin > 0 ? point.y + 6 : point.y - 4,
      textAnchor: "middle" as const,
    };
  }
  return {
    x: point.x,
    y: point.y + (sin > 0.2 ? 6 : 0),
    textAnchor: (cos > 0 ? "start" : "end") as "start" | "end",
  };
}

function ringPoints(value: number): string {
  return SUMMARY_MODALITIES.map((_, index) => {
    const point = webPoint(index, value);
    return `${point.x},${point.y}`;
  }).join(" ");
}

function SummaryWebPlot({ rows }: { rows: SummaryRow[] }) {
  const peak = Math.max(
    1,
    ...rows.flatMap((row) =>
      SUMMARY_MODALITIES.map((modality) => row.modalities[modality.id].value ?? 0),
    ),
  );
  const maximum = Math.max(1.25, Math.ceil(peak * 4) / 4);
  const ticks = Array.from({ length: Math.round(maximum * 4) }, (_, index) => (index + 1) / 4);

  return (
    <figure className="summary-web">
      <svg
        viewBox="0 0 640 500"
        role="img"
        aria-labelledby="summary-web-title"
      >
        <title id="summary-web-title">
          LLM scores relative to the specialist across six modalities
        </title>
        {ticks.map((tick) => {
          const label = webPoint(0, tick / maximum);
          return (
            <g key={tick}>
              <polygon
                points={ringPoints(tick / maximum)}
                fill="none"
                stroke={tick === 1 ? "#626262" : "#dedede"}
                strokeWidth={tick === 1 ? 1.6 : 1}
                strokeDasharray={tick === 1 ? "5 4" : undefined}
              />
              <text x={WEB_CENTER_X + 10} y={label.y - 4} className="summary-web__tick">
                {tick.toFixed(2)}
              </text>
            </g>
          );
        })}
        {SUMMARY_MODALITIES.map((modality, index) => {
          const end = webPoint(index, 1);
          const label = cornerLabel(index);
          return (
            <g key={modality.id}>
              <line
                x1={WEB_CENTER_X}
                y1={WEB_CENTER_Y}
                x2={end.x}
                y2={end.y}
                stroke="#dedede"
              />
              <text
                x={label.x}
                y={label.y}
                textAnchor={label.textAnchor}
                dominantBaseline="middle"
                className="summary-web__label"
              >
                {modality.axisLabel.join(" ")}
              </text>
            </g>
          );
        })}
        {rows.map((row, rowIndex) => {
          const color = PLOT_COLORS[rowIndex % PLOT_COLORS.length];
          const points = SUMMARY_MODALITIES.map((modality, index) => {
            const value = row.modalities[modality.id].value;
            if (value === null) return null;
            return { ...webPoint(index, value / maximum), value, label: modality.label };
          });
          const closedPoints = points.every((point) => point !== null)
            ? points.filter((point): point is NonNullable<typeof point> => point !== null)
            : [];
          return (
            <g key={row.id}>
              {closedPoints.length === SUMMARY_MODALITIES.length ? (
                <polygon
                  points={closedPoints
                    .map((point) => `${point.x},${point.y}`)
                    .join(" ")}
                  fill={color}
                  fillOpacity={0.045}
                />
              ) : null}
              {points.map((point, index) => {
                const next = points[(index + 1) % points.length];
                if (!point || !next) return null;
                return (
                  <line
                    key={`${row.id}-${index}`}
                    x1={point.x}
                    y1={point.y}
                    x2={next.x}
                    y2={next.y}
                    stroke={color}
                    strokeWidth={2.4}
                  />
                );
              })}
              {points.map((point, index) =>
                point ? (
                  <circle
                    key={`${row.id}-dot-${index}`}
                    cx={point.x}
                    cy={point.y}
                    r={3.8}
                    fill={color}
                    stroke="var(--paper)"
                    strokeWidth={1.2}
                  >
                    <title>
                      {row.model} · {point.label}: {formatScore(point.value)}
                    </title>
                  </circle>
                ) : null,
              )}
            </g>
          );
        })}
      </svg>
      <figcaption>
        <span className="summary-legend__item">
          <span className="summary-legend__reference" />
          0 = majority · 1 = specialist
        </span>
        {rows.map((row, index) => (
          <span className="summary-legend__item" key={row.id}>
            <span
              className="summary-legend__line"
              style={{ backgroundColor: PLOT_COLORS[index % PLOT_COLORS.length] }}
            />
            {row.model}
          </span>
        ))}
      </figcaption>
    </figure>
  );
}

export function Summary() {
  const [selectedIds, setSelectedIds] = useState(DEFAULT_MODELS);
  const rows = SUMMARY_LLM_ROWS;
  const selectedRows = useMemo(
    () => selectedIds.flatMap((id) => rows.filter((row) => row.id === id)),
    [rows, selectedIds],
  );

  function toggleModel(id: string) {
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
  }

  return (
    <section className="summary" aria-labelledby="summary-heading">
      <header className="summary-heading">
        <h2 id="summary-heading">Summary</h2>
        <span className="summary-reference">0 = majority · 1 = specialist</span>
      </header>

      <SummaryWebPlot rows={selectedRows} />

      <div
        className="summary-table-scroll"
        role="region"
        aria-label="Total and per-modality scores"
        tabIndex={0}
      >
        <table className="summary-table">
          <thead>
            <tr>
              <th scope="col" rowSpan={2} className="summary-table__plot">
                Plot
              </th>
              <th scope="col" rowSpan={2} className="summary-table__model">
                Model
              </th>
              <th scope="col" rowSpan={2} className="summary-table__total">
                Total
              </th>
              {SUMMARY_MODALITIES.map((modality) => (
                <th
                  scope="colgroup"
                  key={modality.id}
                  colSpan={modality.datasets.length}
                  className="summary-table__group-start"
                >
                  <a href={`#/${modality.id}`}>{modality.label}</a>
                </th>
              ))}
            </tr>
            <tr>
              {SUMMARY_MODALITIES.flatMap((modality) =>
                modality.datasets.map((dataset, index) => (
                  <th
                    scope="col"
                    key={dataset.id}
                    className={
                      index === 0
                        ? "summary-table__dataset summary-table__group-start"
                        : "summary-table__dataset"
                    }
                  >
                    {dataset.name}
                  </th>
                )),
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const selectedIndex = selectedIds.indexOf(row.id);
              return (
                <tr
                  key={row.id}
                  className={selectedIndex === -1 ? undefined : "summary-selected"}
                >
                  <td>
                    <input
                      type="checkbox"
                      checked={selectedIndex !== -1}
                      onChange={() => toggleModel(row.id)}
                      aria-label={`Plot ${row.model}`}
                      style={{
                        accentColor:
                          selectedIndex < 0
                            ? undefined
                            : PLOT_COLORS[selectedIndex % PLOT_COLORS.length],
                      }}
                    />
                  </td>
                  <th scope="row">
                    <ModelIcon provider={row.provider} />
                    {row.model}
                    {isNewModel(row.id) ? <span className="badge-new">New</span> : null}
                  </th>
                  <td className="summary-table__total">
                    <strong>{formatScore(row.total)}</strong>
                  </td>
                  {SUMMARY_MODALITIES.flatMap((modality) =>
                    row.modalities[modality.id].datasets.map((dataset, index) => (
                      <td
                        key={dataset.datasetId}
                        className={index === 0 ? "summary-table__group-start" : undefined}
                      >
                        {formatScore(dataset.ratio)}
                      </td>
                    )),
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
