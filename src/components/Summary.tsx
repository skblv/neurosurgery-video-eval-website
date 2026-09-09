import { useRef, useState } from "react";
import { SUMMARY_MODALITIES, SUMMARY_ROWS } from "../data/summary";
import { SummaryModelPicker } from "./SummaryModelPicker";
import { ModelIcon } from "./ModelIcon";
import { ReleaseDatePlot } from "./ReleaseDatePlot";
import { radarColor, radarProfiles, radarScale } from "../data/radarScale";
import { plotMethodology } from "../data/plotMethodology";
import { PlotCopyButton } from "./PlotCopyButton";
import { PlotFooter } from "./PlotFooter";

const METHODOLOGY = plotMethodology(SUMMARY_MODALITIES);
const TITLE = "Surgical Intelligence Index: How well do LLMs perform against specialized models across surgical tasks?";
const SUBTITLE = "Performance by modality";
const format = (value: number | null) => value === null ? "NA" : value.toFixed(3);
// Action remains hidden in the table; its adjusted score is NA until a baseline is verified.
const TABLE_MODALITIES = SUMMARY_MODALITIES.flatMap((modality, index) => modality.id === "gestures" ? [] : [{ ...modality, index }]);

export function Summary() {
  const [selected, setSelected] = useState<string[]>(["gpt-6-astra", "claude-fable-5_1", "gemini-3_8-flash"]);
  const plotted = radarProfiles(selected, SUMMARY_ROWS);
  const scale = radarScale(plotted.flatMap((row) => row.scores.map((score) => score.value)));
  const plotRef = useRef<SVGSVGElement>(null);
  const legendHeight = Math.ceil(plotted.length / 2) * 28 + 18;
  const point = (axis: number, value: number) => {
    const angle = axis * Math.PI / 3 - Math.PI / 2;
    const radius = 155 * scale.fraction(value);
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
        <p className="summary-muted">Choose models to compare.</p>
        <div className="summary-selectors">
          {selected.map((id, index) => <div className="summary-selection" key={index}>
            <SummaryModelPicker modelId={id} excluded={selected} color={radarColor(index)} onChoose={(nextId) => setSelected((previous) => previous.map((value, i) => i === index ? nextId : value))} />
            <button type="button" className="summary-remove" aria-label={`Remove ${SUMMARY_ROWS.find((row) => row.id === id)?.model}`} onClick={() => setSelected((previous) => previous.filter((_, i) => i !== index))}>×</button>
          </div>)}
          {selected.length < SUMMARY_ROWS.length ? <SummaryModelPicker excluded={selected} onChoose={(id) => setSelected((previous) => [...previous, id])} /> : null}
        </div>
      </div>
      <figure className="summary-web" aria-labelledby="summary-plot-heading">
        <figcaption className="summary-web-heading">
          <h3 id="summary-plot-heading">{TITLE}</h3>
          <PlotCopyButton plotRef={plotRef} title={TITLE} subtitle={SUBTITLE} methodology={METHODOLOGY} />
          <p className="release-subtitle">{SUBTITLE}</p>
        </figcaption>
        <svg ref={plotRef} className="summary-radar" viewBox={`0 0 560 ${420 + legendHeight}`} role="img" aria-labelledby="web-title web-description" data-axis-max="1">
          <title id="web-title">Surgical Intelligence Index by modality</title>
          <desc id="web-description">Six axes show modality scores. Exact values and missing evaluations are listed in the leaderboard below.</desc>
          {[0.25, 0.5, 0.75, 1].map((fraction) => <g key={fraction}>
            <polygon points={polygon(scale.valueAt(fraction))} fill="none" stroke="#e0e4e3" />
            <text x="286" y={205 - 155 * fraction + 12} className="summary-tick">{scale.valueAt(fraction).toFixed(2)}</text>
          </g>)}
          {SUMMARY_MODALITIES.map((modality, axis) => {
            const end = point(axis, scale.ceiling);
            const label = point(axis, scale.valueAt(1.2));
            return <g key={modality.id}>
              <line x1="280" y1="205" x2={end.x} y2={end.y} stroke="#e0e4e3" />
              <text x={label.x} y={label.y} textAnchor="middle" dominantBaseline="middle" className="summary-axis">{modality.label}</text>
            </g>;
          })}
          <polygon points={polygon(1)} fill="none" stroke="#777" strokeDasharray="5 4" />
          {scale.floor < 0 ? <polygon points={polygon(0)} fill="none" stroke="#aaa" strokeDasharray="2 3" /> : null}
          {plotted.map((row) => <g key={row.id} data-profile-model={row.id} data-profile-color={row.color}>
            {row.scores.map((score, axis) => {
              const nextAxis = (axis + 1) % row.scores.length;
              const next = row.scores[nextAxis].value;
              if (score.value === null || next === null) return null;
              const start = point(axis, score.value);
              const end = point(nextAxis, next);
              return <line key={axis} x1={start.x} y1={start.y} x2={end.x} y2={end.y} stroke={row.color} strokeWidth="2" />;
            })}
            {row.scores.every((score) => score.value !== null) ? <polygon points={row.scores.map((score, axis) => {
              const p = point(axis, score.value!);
              return `${p.x},${p.y}`;
            }).join(" ")} fill={row.color} fillOpacity="0.06" stroke={row.color} strokeWidth="2" /> : null}
            {row.scores.map((score, axis) => score.value === null ? null : <circle key={axis} {...{ cx: point(axis, score.value).x, cy: point(axis, score.value).y }} r="4" fill={row.color}>
              <title>{`${row.model} · ${SUMMARY_MODALITIES[axis].label}: ${format(score.value)}`}</title>
            </circle>)}
          </g>)}
          <g className="summary-legend" aria-label="Selected model legend">
            {plotted.map((row, index) => <g key={row.id} data-legend-model={row.id} data-legend-color={row.color} transform={`translate(${26 + index % 2 * 260} ${434 + Math.floor(index / 2) * 28})`}>
              <line x1="0" x2="18" y1="-4" y2="-4" stroke={row.color} strokeWidth="3" />
              <text x="27" y="0">{row.model}</text>
            </g>)}
          </g>
        </svg>
        <PlotFooter methodology={METHODOLOGY} />
      </figure>
    </section>

    <section className="section summary-results" aria-label="Model leaderboard">
      <div className="summary-table-scroll" tabIndex={0} role="region" aria-label="Model scores, scroll horizontally for all modalities">
        <table className="summary-table">
          <caption className="visually-hidden">Total and modality scores relative to specialised models</caption>
          <thead><tr><th scope="col">Model</th><th scope="col">Total</th>{TABLE_MODALITIES.map((modality) => <th scope="col" key={modality.id}>{modality.label}</th>)}</tr></thead>
          <tbody>{SUMMARY_ROWS.map((row) => <tr key={row.id}>
            <th scope="row"><span className="summary-model-name"><ModelIcon provider={row.provider} />{row.model}</span></th>
            <td className="summary-total">{format(row.total)}</td>
            {TABLE_MODALITIES.map((modality) => <td key={modality.id}>{format(row.scores[modality.index].value)}</td>)}
          </tr>)}</tbody>
        </table>
      </div>
      <p className="summary-muted">Equal weight per available dataset within each modality, then equal weight per available modality. Missing results are shown as NA and excluded from averages.</p>
    </section>

    <ReleaseDatePlot />

  </>;
}
