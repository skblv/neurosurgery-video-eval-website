import { useRef, useState } from "react";
import { SUMMARY_MODALITIES, SUMMARY_ROWS, SUMMARY_TABLE_ROWS } from "../data/summary";
import { SummaryModelPicker } from "./SummaryModelPicker";
import { ModelIcon } from "./ModelIcon";
import { ReleaseDatePlot } from "./ReleaseDatePlot";
import { radarColor, radarProfiles, radarScale } from "../data/radarScale";
import { plotMethodology } from "../data/plotMethodology";
import { PlotCopyButton } from "./PlotCopyButton";
import { PlotFooter } from "./PlotFooter";
import { DEFAULT_SUMMARY_SORT, nextSummarySort, sortSummaryRows, type SummaryColumn } from "../data/summarySort";
import { isNewModel } from "../data/leaderboard";
import { useBadgeDate } from "../hooks/useBadgeDate";

const METHODOLOGY = plotMethodology(SUMMARY_MODALITIES);
const TITLE = "Surgical Intelligence Index: How well do LLMs perform against specialized models across surgical tasks?";
const SUBTITLE = "Performance by modality";
const RADAR_LAYOUTS = [
  { width: 560, centerY: 205, radius: 155, chartHeight: 420, columns: 2, rowHeight: 28 },
  { width: 360, centerY: 160, radius: 95, chartHeight: 320, columns: 1, rowHeight: 30 },
] as const;
const format = (value: number | null) => value === null ? "NA" : value.toFixed(3);
// Action remains hidden in the table; its adjusted score is NA until a baseline is verified.
const TABLE_MODALITIES = SUMMARY_MODALITIES.flatMap((modality, index) => modality.id === "gestures" ? [] : [{ ...modality, index }]);

function ModalityPlot() {
  const [selected, setSelected] = useState<string[]>(["gpt-6-astra", "claude-fable-5_1", "gemini-3_8-flash"]);
  const plotted = radarProfiles(selected, SUMMARY_ROWS);
  const scale = radarScale(plotted.flatMap((row) => row.scores.map((score) => score.value)));
  const plotRef = useRef<SVGSVGElement>(null);

  return <figure className="summary-web" aria-labelledby="summary-plot-heading">
        <figcaption className="summary-web-heading">
          <h3 id="summary-plot-heading">{TITLE}</h3>
          <PlotCopyButton plotRef={plotRef} title={TITLE} subtitle={SUBTITLE} methodology={METHODOLOGY} />
          <p className="release-subtitle">{SUBTITLE}</p>
        </figcaption>
        <div className="summary-selectors" role="group" aria-label="Models to compare">
          {selected.map((id, index) => <div className="summary-selection" key={index}>
            <SummaryModelPicker modelId={id} excluded={selected} color={radarColor(index)} onChoose={(nextId) => setSelected((previous) => previous.map((value, i) => i === index ? nextId : value))} />
            <button type="button" className="summary-remove" aria-label={`Remove ${SUMMARY_ROWS.find((row) => row.id === id)?.model}`} onClick={() => setSelected((previous) => previous.filter((_, i) => i !== index))}>×</button>
          </div>)}
          {selected.length < SUMMARY_ROWS.length ? <SummaryModelPicker excluded={selected} onChoose={(id) => setSelected((previous) => [...previous, id])} /> : null}
        </div>
        {RADAR_LAYOUTS.map(({ width, centerY, radius, chartHeight, columns, rowHeight }) => {
          const centerX = width / 2;
          const legendHeight = Math.ceil(plotted.length / columns) * rowHeight + 18;
          const point = (axis: number, value: number) => {
            const angle = axis * Math.PI / 3 - Math.PI / 2;
            const distance = radius * scale.fraction(value);
            return { x: centerX + Math.cos(angle) * distance, y: centerY + Math.sin(angle) * distance };
          };
          const polygon = (value: number) => SUMMARY_MODALITIES.map((_, axis) => {
            const p = point(axis, value);
            return `${p.x},${p.y}`;
          }).join(" ");
          return <svg key={width} ref={width === 560 ? plotRef : undefined} className={width === 560 ? "summary-radar" : "summary-radar-compact"} viewBox={`0 0 ${width} ${chartHeight + legendHeight}`} role="img" aria-labelledby={`web-title-${width} web-description-${width}`} data-axis-max="1">
          <title id={`web-title-${width}`}>Surgical Intelligence Index by modality</title>
          <desc id={`web-description-${width}`}>Six axes show modality scores. Exact values and missing evaluations are listed in the leaderboard above.</desc>
          {[0.25, 0.5, 0.75, 1].map((fraction) => <g key={fraction}>
            <polygon points={polygon(scale.valueAt(fraction))} fill="none" stroke="#e0e4e3" />
            <text x={centerX + 6} y={centerY - radius * fraction + 12} className="summary-tick">{scale.valueAt(fraction).toFixed(2)}</text>
          </g>)}
          {SUMMARY_MODALITIES.map((modality, axis) => {
            const end = point(axis, scale.ceiling);
            const label = point(axis, scale.valueAt(1.2));
            return <g key={modality.id}>
              <line x1={centerX} y1={centerY} x2={end.x} y2={end.y} stroke="#e0e4e3" />
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
            {plotted.map((row, index) => <g key={row.id} data-legend-model={row.id} data-legend-color={row.color} transform={`translate(${26 + index % columns * 260} ${chartHeight + 14 + Math.floor(index / columns) * rowHeight})`}>
              <line x1="0" x2="18" y1="-4" y2="-4" stroke={row.color} strokeWidth="3" />
              <text x="27" y="0">{row.model}</text>
            </g>)}
          </g>
        </svg>;
        })}
        <PlotFooter methodology={METHODOLOGY} />
      </figure>;
}

export function Summary() {
  const [sort, setSort] = useState(DEFAULT_SUMMARY_SORT);
  const badgeDate = useBadgeDate();
  const rows = sortSummaryRows(SUMMARY_TABLE_ROWS, sort);
  const columns: { key: SummaryColumn; label: string }[] = [
    { key: "model", label: "Model" }, { key: "total", label: "Total" },
    ...TABLE_MODALITIES.map((modality) => ({ key: modality.index, label: modality.label })),
  ];
  return <>
    <section className="section summary-results" aria-label="Model leaderboard">
      <div className="summary-table-scroll" tabIndex={0} role="region" aria-label="Model scores, scroll horizontally for all modalities">
        <table className="summary-table">
          <caption className="visually-hidden">Total and modality scores relative to specialised models</caption>
          <thead><tr>{columns.map(({ key, label }) => <th scope="col" key={key} aria-sort={sort.column === key ? sort.direction : undefined}>
            <button type="button" className="summary-sort" aria-label={`Sort by ${label}`} onClick={() => setSort((current) => nextSummarySort(current, key))}>
              <span>{label}</span>
              <svg width="12" height="16" viewBox="0 0 12 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                {sort.column !== key || sort.direction === "ascending" ? <path d="m3 6 3-3 3 3" /> : null}
                {sort.column !== key || sort.direction === "descending" ? <path d="m3 10 3 3 3-3" /> : null}
              </svg>
            </button>
          </th>)}</tr></thead>
          <tbody>{rows.map((row) => <tr key={row.id} data-model-id={row.id} data-model-kind={row.kind}>
            <th scope="row"><span className="summary-model-name"><ModelIcon provider={row.provider} /><span className="summary-model-label">
              {row.model}{badgeDate && isNewModel(row.id, badgeDate) ? <span className="badge-new">New</span> : null}
              {row.kind === "specialist-reference" ? <small>Composite specialist reference</small> : null}
            </span></span></th>
            <td className="summary-total">{format(row.total)}</td>
            {TABLE_MODALITIES.map((modality) => <td key={modality.id}>{format(row.scores[modality.index].value)}</td>)}
          </tr>)}</tbody>
        </table>
      </div>
      <p className="summary-muted">{plotMethodology(SUMMARY_MODALITIES, "table")}</p>
    </section>

    <section className="index-explorer" aria-label="Explore the Surgical Intelligence Index">
      <ReleaseDatePlot />
      <ModalityPlot />
    </section>
  </>;
}
