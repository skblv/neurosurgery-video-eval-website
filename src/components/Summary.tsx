import { useMemo, useState } from "react";
import {
  SUMMARY_DATASET_COUNT, SUMMARY_MODALITIES, calculateSummary, formatRatio, metricLabel,
  type SummaryMetricMode, type SummaryRow,
} from "../data/summary";
import { ModelIcon } from "./ModelIcon";
import "../summary.css";

const COLORS = ["#0f766e", "#4f46e5", "#b45309", "#be185d", "#0369a1", "#6d28d9"];
const DEFAULT_MODELS = ["gpt-6-astra", "gpt-5_6-sol", "gemma3-27b-lora"];

function SummaryWebPlot({ rows }: { rows: SummaryRow[] }) {
  const maximum = Math.max(1.25, Math.ceil(Math.max(0, ...rows.flatMap((row) =>
    SUMMARY_MODALITIES.map((modality) => row.modalities[modality.id].value ?? 0),
  )) * 4) / 4);
  const point = (index: number, value: number, radius = 140) => {
    const angle = (index * 2 * Math.PI) / SUMMARY_MODALITIES.length - Math.PI / 2;
    return { x: 270 + Math.cos(angle) * radius * value / maximum, y: 210 + Math.sin(angle) * radius * value / maximum };
  };
  const polygon = (value: number) => SUMMARY_MODALITIES.map((_, index) => {
    const p = point(index, value);
    return `${p.x},${p.y}`;
  }).join(" ");

  return (
    <figure className="summary-web">
      <svg viewBox="0 0 540 430" role="img" aria-labelledby="summary-web-title summary-web-description">
        <title id="summary-web-title">Performance relative to the specialist across six modalities</title>
        <desc id="summary-web-description">
          The dashed reference is 1.000 times specialist performance. Missing modality scores
          leave gaps, rather than being plotted as zero. Exact values are in the table below.
          {rows.length ? ` Selected models: ${rows.map((row) => row.model).join(", ")}.` : " Select models in the table to plot."}
        </desc>
        {Array.from({ length: Math.round(maximum * 4) }, (_, index) => (index + 1) / 4).map((tick) => (
          <g key={tick}>
            <polygon points={polygon(tick)} fill="none" stroke={tick === 1 ? "#626262" : "#dedede"}
              strokeWidth={tick === 1 ? 1.6 : 1} strokeDasharray={tick === 1 ? "5 4" : undefined} />
            <text x={277} y={point(0, tick).y - 4} className="summary-web__tick">{tick.toFixed(2)}×</text>
          </g>
        ))}
        {SUMMARY_MODALITIES.map((modality, index) => {
          const end = point(index, maximum);
          const label = point(index, maximum, 188);
          return (
            <g key={modality.id}>
              <line x1={270} y1={210} x2={end.x} y2={end.y} stroke="#dedede" />
              <text x={label.x} y={label.y - (modality.axisLabel.length - 1) * 8} textAnchor="middle" className="summary-web__label">
                {modality.axisLabel.map((line, lineIndex) => <tspan key={line} x={label.x} dy={lineIndex ? 17 : 0}>{line}</tspan>)}
              </text>
            </g>
          );
        })}
        {rows.map((row, rowIndex) => {
          const color = COLORS[rowIndex % COLORS.length];
          const points = SUMMARY_MODALITIES.map((modality, index) => {
            const value = row.modalities[modality.id].value;
            return value === null ? null : { ...point(index, value), value, label: modality.label };
          });
          return (
            <g key={row.id}>
              {points.every((p) => p !== null) ? (
                <polygon points={points.map((p) => `${p.x},${p.y}`).join(" ")} fill={color} fillOpacity={0.045} />
              ) : null}
              {points.map((p, index) => {
                const next = points[(index + 1) % points.length];
                return p && next ? <line key={index} x1={p.x} y1={p.y} x2={next.x} y2={next.y} stroke={color} strokeWidth={2.4} /> : null;
              })}
              {points.map((p, index) => p ? (
                <circle key={index} cx={p.x} cy={p.y} r={3.8} fill={color} stroke="var(--paper)" strokeWidth={1.2}>
                  <title>{row.model} · {p.label}: {formatRatio(p.value)}</title>
                </circle>
              ) : null)}
            </g>
          );
        })}
      </svg>
      <figcaption>
        <span className="summary-legend__item"><span className="summary-legend__reference" />Specialist reference · 1.000×</span>
        {rows.map((row, index) => (
          <span className="summary-legend__item" key={row.id}>
            <span className="summary-legend__line" style={{ backgroundColor: COLORS[index % COLORS.length] }} />{row.model}
          </span>
        ))}
      </figcaption>
    </figure>
  );
}

export function Summary() {
  const [mode, setMode] = useState<SummaryMetricMode>("primary");
  const [selectedIds, setSelectedIds] = useState(DEFAULT_MODELS);
  const [detailId, setDetailId] = useState("gpt-6-astra");
  const rows = useMemo(() => calculateSummary(mode), [mode]);
  const selectedRows = selectedIds.flatMap((id) => rows.filter((row) => row.id === id));
  const detail = rows.find((row) => row.id === detailId) ?? rows[0];
  const completeCount = rows.filter((row) => row.coverage === SUMMARY_MODALITIES.length).length;

  function toggleModel(id: string) {
    setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  return (
    <section className="summary" aria-labelledby="summary-heading">
      <header className="summary-heading">
        <div>
          <h2 id="summary-heading">Performance relative to the specialist</h2>
          <p>Equal-weight datasets within each modality. Equal-weight modalities in the total.</p>
        </div>
        <label className="metric summary-metric">
          <span className="metric__label">Score metric</span>
          <select className="metric__select" value={mode} onChange={(event) => setMode(event.target.value as SummaryMetricMode)}>
            <option value="primary">Each tab’s default metric</option>
            <option value="accuracy">Exact accuracy on every dataset</option>
          </select>
        </label>
      </header>

      <div className="summary-figure-row">
        <SummaryWebPlot rows={selectedRows} />
        <aside className="summary-method" aria-label="Scoring method">
          <p className="summary-counts">{rows.length} models · {SUMMARY_MODALITIES.length} modalities · {SUMMARY_DATASET_COUNT} dataset evaluations</p>
          <div className="summary-formula">
            <span>Dataset ratio</span>
            <strong>model score / specialist score</strong>
            <span>60 / 80 = <b>0.750×</b></span>
          </div>
          <p><b>1.000× matches the specialist.</b> Values above 1.000× outperform it and are not capped.</p>
          <p>Available datasets split their modality weight equally. Available modalities split the total weight equally; missing results stay NA.</p>
          <p>References: <b>YOLOv12-m</b> for Instruments, <b>SurgMotion</b> for Action, and <b>ResNet-50</b> for the remaining modalities.</p>
          <p>{mode === "primary"
            ? "Default metrics: micro-F1, except exact frame accuracy for Action and exact-match accuracy for Skill assessment."
            : "Exact-match accuracy for frame benchmarks; exact frame accuracy for the continuous Action pilot."}</p>
          <p className="summary-coverage-note"><b>{completeCount} of {rows.length} models {completeCount === 1 ? "has" : "have"} all six modalities.</b> Every model remains on the leaderboard. Scores average the results available for that model, with coverage shown beside them.</p>
        </aside>
      </div>

      <div className="summary-table-heading">
        <h3>Model scores</h3>
        <p>Select models to compare in the web plot. NA means no result is available.</p>
      </div>
      <div className="summary-table-scroll" role="region" aria-label="Total and per-modality scores" tabIndex={0}>
        <table className="summary-table" aria-describedby="summary-table-note">
          <caption className="visually-hidden">Specialist-normalized model scores, averaged over each model's available results.</caption>
          <thead><tr>
            <th scope="col" className="summary-table__plot">Plot</th>
            <th scope="col" className="summary-table__model">Model</th>
            <th scope="col" className="summary-table__total">Total</th>
            {SUMMARY_MODALITIES.map((modality) => <th scope="col" key={modality.id}>
              <a href={`#/${modality.id}`}>{modality.label}</a>
              <small>{modality.datasets.length} {modality.datasets.length === 1 ? "dataset" : "datasets"}</small>
            </th>)}
          </tr></thead>
          <tbody>
            <tr className="summary-table__reference">
              <td aria-label="Always plotted">—</td>
              <th scope="row">Dataset specialists<small>Reference across all datasets</small></th>
              <td className="summary-table__total">1.000×</td>
              {SUMMARY_MODALITIES.map((modality) => <td key={modality.id}>1.000×</td>)}
            </tr>
            {rows.map((row) => {
              const selectedIndex = selectedIds.indexOf(row.id);
              return <tr key={row.id}>
                <td><input type="checkbox" checked={selectedIndex !== -1} onChange={() => toggleModel(row.id)}
                  aria-label={`Plot ${row.model}`} style={{ accentColor: selectedIndex < 0 ? undefined : COLORS[selectedIndex % COLORS.length] }} /></td>
                <th scope="row"><ModelIcon provider={row.provider} />{row.model}
                  <small>{row.datasetCoverage} / {SUMMARY_DATASET_COUNT} dataset evaluations</small>
                </th>
                <td className="summary-table__total">
                  <strong>{formatRatio(row.total)}</strong>
                  <small>{row.coverage}/6 modalities · {row.datasetCoverage}/{SUMMARY_DATASET_COUNT} datasets</small>
                </td>
                {SUMMARY_MODALITIES.map((modality) => {
                  const score = row.modalities[modality.id];
                  return <td key={modality.id} title={score.datasets.map((dataset) => `${dataset.name}: ${formatRatio(dataset.ratio)}`).join("\n")}>
                    {formatRatio(score.value)}
                    <small>{score.observed}/{score.expected} datasets</small>
                  </td>;
                })}
              </tr>;
            })}
          </tbody>
        </table>
      </div>
      <p id="summary-table-note" className="summary-note">
        Scores are ratios, not percentages. NA means no result is available, not zero.
        Models are ordered by their total over available modalities; coverage should be considered when comparing models.
        The reference row combines different dataset specialists; it is not one model.
      </p>

      <details className="summary-details">
        <summary>Dataset ratios and weights</summary>
        <label className="summary-detail-picker">Model
          <select className="metric__select" value={detail.id} onChange={(event) => setDetailId(event.target.value)}>
            {rows.map((row) => <option key={row.id} value={row.id}>{row.model}</option>)}
          </select>
        </label>
        <div className="summary-table-scroll" role="region" aria-label="Dataset normalization details" tabIndex={0}>
          <table className="summary-table summary-detail-table">
            <thead><tr>
              <th scope="col">Modality / dataset</th><th scope="col">Metric</th><th scope="col">Specialist</th>
              <th scope="col">Model score</th><th scope="col">Specialist score</th><th scope="col">Ratio</th>
              <th scope="col">Within modality</th><th scope="col">In total</th>
            </tr></thead>
            <tbody>{SUMMARY_MODALITIES.flatMap((modality) => detail.modalities[modality.id].datasets.map((dataset) => <tr key={dataset.datasetId}>
              <th scope="row">{dataset.name}<small>{modality.label}</small></th>
              <td>{metricLabel(dataset.metric)}</td><td>{dataset.specialist}</td>
              <td>{dataset.modelScore === null ? "NA" : `${dataset.modelScore.toFixed(2)}%`}</td>
              <td>{dataset.specialistScore.toFixed(2)}%</td><td>{formatRatio(dataset.ratio)}</td>
              <td>{dataset.ratio === null ? "NA" : `1/${detail.modalities[modality.id].observed}`}</td>
              <td>{dataset.ratio === null ? "NA" : `1/${detail.modalities[modality.id].observed * detail.coverage}`}</td>
            </tr>))}</tbody>
          </table>
        </div>
        <p className="summary-note">Within each modality, available datasets receive equal weight. Available modalities receive equal weight in the total. Calculations use full source precision before display rounding.</p>
      </details>
      <p className="summary-note summary-limitations">
        This summary uses the existing evaluation protocols: some API results use subsamples,
        Action is a single-procedure pilot, and Skill assessment measures gesture recognition as a proxy.
        Ratios are descriptive point estimates; see each modality tab for protocol details and available confidence intervals.
      </p>
    </section>
  );
}
