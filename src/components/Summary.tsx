import { useMemo, useState } from "react";

import { isNewModel } from "../data/leaderboard";
import {
  SUMMARY_DATASET_COUNT,
  SUMMARY_MODALITIES,
  SUMMARY_ROWS,
  formatScore,
  metricLabel,
  type SummaryRow,
} from "../data/summary";
import { ModelIcon } from "./ModelIcon";
import "../summary.css";

const PLOT_COLORS = ["#0f766e", "#4f46e5", "#b45309", "#be185d", "#0369a1", "#6d28d9"];
const DEFAULT_MODELS = ["gpt-6-astra", "gpt-5_6-sol", "gemma3-27b-lora"];
const WEB_CENTER_X = 270;
const WEB_CENTER_Y = 210;
const WEB_RADIUS = 140;
const WEB_LABEL_RADIUS = 188;

function webPoint(index: number, value: number, radius = WEB_RADIUS) {
  const angle = (index * 2 * Math.PI) / SUMMARY_MODALITIES.length - Math.PI / 2;
  return {
    x: WEB_CENTER_X + Math.cos(angle) * radius * value,
    y: WEB_CENTER_Y + Math.sin(angle) * radius * value,
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
        viewBox="0 0 540 430"
        role="img"
        aria-labelledby="summary-web-title summary-web-description"
      >
        <title id="summary-web-title">
          Performance relative to the specialist across six modalities
        </title>
        <desc id="summary-web-description">
          The dashed reference is the small specialist at 1. The center is the
          majority-class baseline at 0. Missing modality scores leave gaps
          rather than being plotted as zero. Exact values are in the table.
          {rows.length
            ? ` Selected models: ${rows.map((row) => row.model).join(", ")}.`
            : " Select models in the table to plot."}
        </desc>
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
              <text x={277} y={label.y - 4} className="summary-web__tick">
                {tick.toFixed(2)}
              </text>
            </g>
          );
        })}
        {SUMMARY_MODALITIES.map((modality, index) => {
          const end = webPoint(index, 1);
          const label = webPoint(index, 1, WEB_LABEL_RADIUS / WEB_RADIUS);
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
                y={label.y - (modality.axisLabel.length - 1) * 8}
                textAnchor="middle"
                className="summary-web__label"
              >
                {modality.axisLabel.map((line, lineIndex) => (
                  <tspan key={line} x={label.x} dy={lineIndex ? 17 : 0}>
                    {line}
                  </tspan>
                ))}
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
          Specialist = 1 · majority = 0
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
  const [detailId, setDetailId] = useState("gpt-6-astra");
  const rows = SUMMARY_ROWS;
  const selectedRows = useMemo(
    () => selectedIds.flatMap((id) => rows.filter((row) => row.id === id)),
    [rows, selectedIds],
  );
  const detail = rows.find((row) => row.id === detailId) ?? rows[0];
  const completeCount = rows.filter((row) => row.coverage === SUMMARY_MODALITIES.length).length;

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
        <div>
          <h2 id="summary-heading">How do models compare across surgical intelligence?</h2>
          <p>
            Each dataset is scaled so the majority-class baseline is 0 and the
            small specialist is 1. Datasets share equal weight inside a
            modality. The total is the mean of the modalities a model has been
            scored on; missing modalities are NA, not zero.
          </p>
        </div>
        <span className="summary-reference">0 = majority · 1 = specialist</span>
      </header>

      <div className="summary-figure-row">
        <SummaryWebPlot rows={selectedRows} />
        <aside className="summary-method" aria-label="Scoring method">
          <p className="summary-counts">
            {rows.length} models · {SUMMARY_MODALITIES.length} modalities ·{" "}
            {SUMMARY_DATASET_COUNT} dataset evaluations
          </p>
          <div className="summary-formula">
            <span>Dataset score</span>
            <strong>(model − majority) / (specialist − majority)</strong>
            <span>
              60 vs YOLO 80, majority 20 → (60 − 20) / (80 − 20) = <b>0.667</b>
            </span>
          </div>
          <p>
            <b>1 matches the small specialist.</b> Values above 1 outperform it
            and are not capped. Values below 0 are worse than the majority class.
          </p>
          <p>
            Three datasets contribute ⅓ each. A model scored on only two of
            those three uses the mean of the two available ratios. A modality
            with no scores is NA.
          </p>
          <p>
            Specialists: <b>YOLOv12-m</b> for Instruments, <b>SurgMotion</b> for
            Action, and <b>ResNet-50</b> for Anatomy, Skill assessment, Context
            / VQA, and Recommendations.
          </p>
          <p>
            The Action pilot has no published majority-class rate, so its zero
            point is 0% exact frame accuracy.
          </p>
          <p className="summary-coverage-note">
            <b>
              {completeCount} of {rows.length} models have all six modalities.
            </b>{" "}
            Totals still average the modalities that exist. Compare totals only
            when coverage is the same.
          </p>
        </aside>
      </div>

      <div className="summary-table-heading">
        <h3>Model scores</h3>
        <p>Select models to compare on the web plot. NA is excluded from averages.</p>
      </div>
      <div
        className="summary-table-scroll"
        role="region"
        aria-label="Total and per-modality scores"
        tabIndex={0}
      >
        <table className="summary-table" aria-describedby="summary-table-note">
          <caption className="visually-hidden">
            Majority-to-specialist scaled scores. Total is the mean of scored
            modalities.
          </caption>
          <thead>
            <tr>
              <th scope="col" className="summary-table__plot">
                Plot
              </th>
              <th scope="col" className="summary-table__model">
                Model
              </th>
              <th scope="col" className="summary-table__total">
                Total
              </th>
              {SUMMARY_MODALITIES.map((modality) => (
                <th scope="col" key={modality.id}>
                  <a href={`#/${modality.id}`}>{modality.label}</a>
                  <small>
                    {modality.datasets.length}{" "}
                    {modality.datasets.length === 1 ? "dataset" : "datasets"}
                  </small>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="summary-table__reference">
              <td aria-label="Always plotted">—</td>
              <th scope="row">
                Majority-class baseline
                <small>Zero point on each dataset</small>
              </th>
              <td className="summary-table__total">0.000</td>
              {SUMMARY_MODALITIES.map((modality) => (
                <td key={modality.id}>
                  {modality.datasets.every((dataset) => dataset.majorityPublished)
                    ? "0.000"
                    : "NA"}
                </td>
              ))}
            </tr>
            <tr className="summary-table__reference">
              <td aria-label="Always plotted">—</td>
              <th scope="row">
                Small specialists
                <small>YOLO / SurgMotion / ResNet-50</small>
              </th>
              <td className="summary-table__total">1.000</td>
              {SUMMARY_MODALITIES.map((modality) => (
                <td key={modality.id}>1.000</td>
              ))}
            </tr>
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
                    <button
                      type="button"
                      onClick={() => setDetailId(row.id)}
                      aria-pressed={detail.id === row.id}
                    >
                      <ModelIcon provider={row.provider} />
                      {row.model}
                      {isNewModel(row.id) ? <span className="badge-new">New</span> : null}
                    </button>
                    <small>
                      {row.datasetCoverage} / {SUMMARY_DATASET_COUNT} datasets ·{" "}
                      {row.coverage}/{SUMMARY_MODALITIES.length} modalities
                    </small>
                  </th>
                  <td className="summary-table__total">
                    <strong>{formatScore(row.total)}</strong>
                    <small>
                      {row.coverage === SUMMARY_MODALITIES.length
                        ? "Complete · 6/6"
                        : `${row.coverage}/6 scored`}
                    </small>
                  </td>
                  {SUMMARY_MODALITIES.map((modality) => {
                    const score = row.modalities[modality.id];
                    const title = score.datasets
                      .map((dataset) => {
                        const modelText =
                          dataset.modelScore === null
                            ? "NA"
                            : `${dataset.modelScore.toFixed(2)}%`;
                        return `${dataset.name}: model ${modelText}, majority ${dataset.majority.toFixed(2)}%, specialist ${dataset.specialistScore.toFixed(2)}% → ${formatScore(dataset.ratio)}`;
                      })
                      .join("\n");
                    return (
                      <td key={modality.id} title={title}>
                        {formatScore(score.value)}
                        {score.value !== null && score.observed !== score.expected ? (
                          <small>
                            {score.observed}/{score.expected}
                          </small>
                        ) : null}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p id="summary-table-note" className="summary-note">
        Scores are scaled accuracies, not raw percentages. NA means the model
        was not scored on that modality. Hover a cell for the per-dataset
        breakdown. Models are ordered by total, then coverage.
      </p>

      <details className="summary-details">
        <summary>Dataset scores and weights</summary>
        <label className="summary-detail-picker">
          Model
          <select
            className="metric__select"
            value={detail.id}
            onChange={(event) => setDetailId(event.target.value)}
          >
            {rows.map((row) => (
              <option key={row.id} value={row.id}>
                {row.model}
              </option>
            ))}
          </select>
        </label>
        <div
          className="summary-table-scroll"
          role="region"
          aria-label="Dataset normalization details"
          tabIndex={0}
        >
          <table className="summary-table summary-detail-table">
            <thead>
              <tr>
                <th scope="col">Modality / dataset</th>
                <th scope="col">Metric</th>
                <th scope="col">Specialist</th>
                <th scope="col">Model</th>
                <th scope="col">Majority</th>
                <th scope="col">Specialist</th>
                <th scope="col">Score</th>
                <th scope="col">Within modality</th>
              </tr>
            </thead>
            <tbody>
              {SUMMARY_MODALITIES.flatMap((modality) =>
                detail.modalities[modality.id].datasets.map((dataset) => (
                  <tr key={dataset.datasetId}>
                    <th scope="row">
                      {dataset.name}
                      <small>{modality.label}</small>
                    </th>
                    <td>{metricLabel(dataset.metric)}</td>
                    <td>{dataset.specialist}</td>
                    <td>
                      {dataset.modelScore === null
                        ? "NA"
                        : `${dataset.modelScore.toFixed(2)}%`}
                    </td>
                    <td>
                      {dataset.majorityPublished
                        ? `${dataset.majority.toFixed(2)}%`
                        : "0% (unpublished)"}
                    </td>
                    <td>{dataset.specialistScore.toFixed(2)}%</td>
                    <td>{formatScore(dataset.ratio)}</td>
                    <td>1/{modality.datasets.length}</td>
                  </tr>
                )),
              )}
            </tbody>
          </table>
        </div>
        <p className="summary-note">
          Arithmetic uses source values at full precision. Display rounding is
          three decimals. Action uses 0% as the zero point because no
          majority-class baseline is published for that pilot.
        </p>
      </details>
      <p className="summary-note summary-limitations">
        Some API results use frame subsamples, Action is a single-procedure
        pilot, and Skill assessment measures suturing-gesture recognition as a
        proxy. See each modality tab for protocol details.
      </p>
    </section>
  );
}
