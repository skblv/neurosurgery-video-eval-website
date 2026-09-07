import { useState } from "react";
import { SUMMARY_MODALITIES, SUMMARY_ROWS } from "../data/summary";
import { SummaryModelPicker } from "./SummaryModelPicker";
import { ModelIcon } from "./ModelIcon";

const COLORS = ["#0f766e", "#b45309", "#6d28d9", "#2563eb"];
const plotColor = (index: number) => COLORS[index] ?? `hsl(${(index * 137.5) % 360} 65% 40%)`;
const format = (value: number | null) => value === null ? "NA" : value.toFixed(3);
const metricLabels: Record<string, string> = { microF1: "Micro F1", exactMatch: "Exact match", exactAccuracy: "Exact frame accuracy" };

export function Summary() {
  const [selected, setSelected] = useState<string[]>(["gpt-6-astra", "claude-fable-5_1", "gemini-3_8-flash"]);
  const plotted = selected.map((id) => SUMMARY_ROWS.find((row) => row.id === id));
  const maximum = Math.max(1.25, ...plotted.flatMap((row) => row?.scores.map((score) => score.value ?? 0) ?? []));
  const ceiling = Math.ceil(maximum * 4) / 4;
  const point = (axis: number, value: number) => {
    const angle = axis * Math.PI / 3 - Math.PI / 2;
    const radius = 155 * value / ceiling;
    return { x: 280 + Math.cos(angle) * radius, y: 205 + Math.sin(angle) * radius };
  };
  const polygon = (value: number) => SUMMARY_MODALITIES.map((_, axis) => {
    const p = point(axis, value);
    return `${p.x},${p.y}`;
  }).join(" ");

  return <>
    <header className="domain-hero summary-hero">
      <h2>How close are general models to the specialists?</h2>{" "}
      <p>We measure the performance of Visual Language Models (VLMs) on 6 surgical modalities.</p>
    </header>

    <section className="summary-figure" aria-labelledby="summary-plot-heading">
      <div>
        <h3 id="summary-plot-heading">Performance by modality</h3>
        <p className="summary-muted">Choose models to compare.</p>
        <div className="summary-selectors">
          {selected.map((id, index) => <div className="summary-selection" key={index}>
            <SummaryModelPicker modelId={id} excluded={selected} color={plotColor(index)} onChoose={(nextId) => setSelected((previous) => previous.map((value, i) => i === index ? nextId : value))} />
            <button type="button" className="summary-remove" aria-label={`Remove ${SUMMARY_ROWS.find((row) => row.id === id)?.model}`} onClick={() => setSelected((previous) => previous.filter((_, i) => i !== index))}>×</button>
          </div>)}
          {selected.length < SUMMARY_ROWS.length ? <SummaryModelPicker excluded={selected} onChoose={(id) => setSelected((previous) => [...previous, id])} /> : null}
        </div>
      </div>
      <figure className="summary-web">
        <svg viewBox="0 0 560 420" role="img" aria-labelledby="web-title web-description">
          <title id="web-title">Relative model performance web plot</title>
          <desc id="web-description">Six axes show modality scores. Exact values and missing evaluations are listed in the leaderboard below.</desc>
          {[0.25, 0.5, 0.75, 1].map((fraction) => <g key={fraction}>
            <polygon points={polygon(ceiling * fraction)} fill="none" stroke="#e0e4e3" />
            <text x="286" y={205 - 155 * fraction + 12} className="summary-tick">{(ceiling * fraction).toFixed(2)}</text>
          </g>)}
          {SUMMARY_MODALITIES.map((modality, axis) => {
            const end = point(axis, ceiling);
            const label = point(axis, ceiling * 1.2);
            return <g key={modality.id}>
              <line x1="280" y1="205" x2={end.x} y2={end.y} stroke="#e0e4e3" />
              <text x={label.x} y={label.y} textAnchor="middle" dominantBaseline="middle" className="summary-axis">{modality.label}</text>
            </g>;
          })}
          <polygon points={polygon(1)} fill="none" stroke="#777" strokeDasharray="5 4" />
          {plotted.map((row, index) => row ? <g key={`${row.id}-${index}`}>
            {row.scores.map((score, axis) => {
              const nextAxis = (axis + 1) % row.scores.length;
              const next = row.scores[nextAxis].value;
              if (score.value === null || next === null) return null;
              const start = point(axis, score.value);
              const end = point(nextAxis, next);
              return <line key={axis} x1={start.x} y1={start.y} x2={end.x} y2={end.y} stroke={plotColor(index)} strokeWidth="2" />;
            })}
            {row.scores.every((score) => score.value !== null) ? <polygon points={row.scores.map((score, axis) => {
              const p = point(axis, score.value!);
              return `${p.x},${p.y}`;
            }).join(" ")} fill={plotColor(index)} fillOpacity="0.06" stroke={plotColor(index)} strokeWidth="2" /> : null}
            {row.scores.map((score, axis) => score.value === null ? null : <circle key={axis} {...{ cx: point(axis, score.value).x, cy: point(axis, score.value).y }} r="4" fill={plotColor(index)}>
              <title>{row.model} · {SUMMARY_MODALITIES[axis].label}: {format(score.value)}</title>
            </circle>)}
          </g> : null)}
        </svg>
      </figure>
    </section>

    <section className="section summary-results" aria-label="Model leaderboard">
      <div className="summary-table-scroll" tabIndex={0} role="region" aria-label="Model scores, scroll horizontally for all modalities">
        <table className="summary-table">
          <caption className="visually-hidden">Total and modality scores relative to specialised models</caption>
          <thead><tr><th scope="col">Model</th><th scope="col">Total</th>{SUMMARY_MODALITIES.map((modality) => <th scope="col" key={modality.id}>{modality.label}</th>)}</tr></thead>
          <tbody>{SUMMARY_ROWS.map((row) => <tr key={row.id}>
            <th scope="row"><span className="summary-model-name"><ModelIcon provider={row.provider} />{row.model}</span></th>
            <td className="summary-total">{format(row.total)}</td>
            {row.scores.map((score, index) => <td key={SUMMARY_MODALITIES[index].id}>{format(score.value)}</td>)}
          </tr>)}</tbody>
        </table>
      </div>
      <p className="summary-muted">Equal weight per available dataset within each modality, then equal weight per available modality. Missing results are shown as NA and excluded from averages.</p>
    </section>

    <details className="summary-methods">
      <summary>Scoring method</summary>
      <p>Dataset score = model performance ÷ specialised reference performance. For example, 60 ÷ 80 = 0.750. Datasets contribute equally to their modality score. The total averages modality scores, so dataset-rich modalities do not dominate. When results are missing, weights are redistributed equally among available datasets and modalities.</p>
      <p>Reference models are fixed per dataset, not selected by the highest score. Ratios above 1 are retained. The Action benchmark is a single operation. Scores compare each model’s reported evaluation and may use different sample sizes, as documented on the modality pages.</p>
      {SUMMARY_MODALITIES.map((modality) => <div key={modality.id}>
        <h4><a href={`#/${modality.id}`}>{modality.label}</a></h4>
        <p className="summary-muted">{modality.datasets.map((dataset) => `${dataset.name}: ${metricLabels[dataset.metric]} / ${dataset.results.find((result) => result.id === dataset.referenceId)?.model ?? "NA"}`).join(" · ")}</p>
      </div>)}
    </details>
  </>;
}
