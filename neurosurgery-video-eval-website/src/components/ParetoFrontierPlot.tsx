import { useRef, useState, type MouseEvent } from "react";
import costs from "../data/paretoCosts.json";
import { singleModelFrontier, staircasePath } from "../data/paretoFrontier";
import { SUMMARY_TABLE_ROWS } from "../data/summary";
import { PlotCopyButton } from "./PlotCopyButton";
import { PlotFooter } from "./PlotFooter";
import { PlotModelLogo } from "./PlotModelLogo";

const TITLE = "Pareto Frontier: What are the best models for a given cost level?";
const METHODOLOGY = "Surgical Intelligence Index plotted against model cost. Cost is total inference spending divided by submitted frames, scaled to one million frames; training costs are excluded. Each frontier shows the best individual model available within a given budget.";
const GROUPS = [
  { id: "llm", label: "LLMs", color: "var(--accent)" },
  { id: "specialised", label: "Specialised models", color: "var(--uchicago-maroon)" },
] as const;
const COSTS_BY_ID = new Map(costs.models.map((row) => [row.id, row]));
const POINTS = SUMMARY_TABLE_ROWS.flatMap((row) => {
  const cost = COSTS_BY_ID.get(row.id);
  if (!cost || row.total === null) return [];
  return [{ ...cost, model: row.model, provider: row.provider, total: row.total, group: row.kind === "zero-shot" ? "llm" : "specialised" }];
});
const FRONTIERS = GROUPS.map((group) => ({ ...group, points: singleModelFrontier(POINTS.filter((point) => point.group === group.id)) }));
const FRONTIER_COLORS = new Map(FRONTIERS.flatMap((group) => group.points.map((point) => [point.id, group.color] as const)));
const MIN_LOG_COST = Math.floor(Math.log10(Math.min(...POINTS.map((point) => point.costPerMillionFrames)))) - 0.06;
const MAX_LOG_COST = Math.log10(Math.max(...POINTS.map((point) => point.costPerMillionFrames))) + 0.22;
const MIN_SCORE = Math.min(-0.1, Math.floor(Math.min(...POINTS.map((point) => point.total)) * 10) / 10);
const MAX_SCORE = Math.max(1.08, Math.ceil(Math.max(...POINTS.map((point) => point.total)) * 10) / 10 + 0.05);
const Y_TICKS = Array.from({ length: Math.floor((MAX_SCORE - Math.ceil(MIN_SCORE * 5) / 5) * 5) + 1 }, (_, index) => Math.ceil(MIN_SCORE * 5) / 5 + index / 5);
const X_TICKS = Array.from({ length: Math.floor(MAX_LOG_COST) - Math.ceil(MIN_LOG_COST) + 1 }, (_, index) => 10 ** (Math.ceil(MIN_LOG_COST) + index));
const LAYOUTS = [
  { width: 920, height: 520, compact: false, className: "release-plot-wide" },
  { width: 680, height: 520, compact: false, className: "release-plot-medium" },
  { width: 360, height: 620, compact: true, className: "release-plot-compact" },
];
const dollars = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
const tickFormat = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 0 });

export function ParetoFrontierPlot() {
  const [activeId, setActiveId] = useState<string | null>(null);
  const plotRef = useRef<SVGSVGElement>(null);

  return <figure className="release-plot pareto-plot" aria-labelledby="pareto-plot-heading"
    onPointerLeave={() => setActiveId(null)}
    onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setActiveId(null); }}
    onKeyDown={(event) => { if (event.key === "Escape") setActiveId(null); }}>
    <figcaption>
      <h3 id="pareto-plot-heading">{TITLE}</h3>
      <PlotCopyButton plotRef={plotRef} title={TITLE} methodology={METHODOLOGY} />
    </figcaption>
    {LAYOUTS.map(({ width, height, compact, className }) => {
      const bounds = { left: compact ? 43 : 64, top: 28, right: width - (compact ? 19 : 30), bottom: compact ? 420 : 430 };
      const x = (cost: number) => bounds.left + (Math.log10(cost) - MIN_LOG_COST) / (MAX_LOG_COST - MIN_LOG_COST) * (bounds.right - bounds.left);
      const y = (score: number) => bounds.bottom - (score - MIN_SCORE) / (MAX_SCORE - MIN_SCORE) * (bounds.bottom - bounds.top);
      const points = POINTS.map((point) => ({ ...point, x: x(point.costPerMillionFrames), y: y(point.total) }));
      const active = points.find((point) => point.id === activeId);
      const tooltipWidth = compact ? 270 : 286;
      const tooltipX = active ? Math.max(8, Math.min(width - tooltipWidth - 8, active.x - tooltipWidth / 2)) : 0;
      const tooltipY = active ? Math.max(8, active.y > 135 ? active.y - 112 : active.y + 18) : 0;
      const selectNearest = (event: MouseEvent<SVGSVGElement>) => {
        const rect = event.currentTarget.getBoundingClientRect();
        const mouseX = (event.clientX - rect.left) * width / rect.width;
        const mouseY = (event.clientY - rect.top) * height / rect.height;
        let distance = (24 * width / rect.width) ** 2;
        let id: string | null = null;
        for (const point of points) {
          const next = (point.x - mouseX) ** 2 + (point.y - mouseY) ** 2;
          if (next < distance) { distance = next; id = point.id; }
        }
        setActiveId(id);
      };

      return <svg key={width} ref={width === 920 ? plotRef : undefined} className={className}
        viewBox={`0 0 ${width} ${height}`} role="group" aria-label="Inference cost and Surgical Intelligence Index for all benchmark models"
        data-cost-unit="USD per 1 million submitted frames" data-cost-scale="log" data-frontier-mode="single-model"
        onMouseMove={selectNearest} onClick={(event) => { if (event.detail > 0) selectNearest(event); }}>
        {Y_TICKS.map((tick) => <g key={tick}>
          <line x1={bounds.left} x2={bounds.right} y1={y(tick)} y2={y(tick)} className="release-grid" />
          <text x={bounds.left - 12} y={y(tick)} dy="0.35em" textAnchor="end" className="pareto-tick">{tick.toFixed(1)}</text>
        </g>)}
        {X_TICKS.map((tick) => <g key={tick}>
          <line x1={x(tick)} x2={x(tick)} y1={bounds.top} y2={bounds.bottom} className="release-grid release-grid-vertical" />
          <text x={x(tick)} y={bounds.bottom + 25} textAnchor="middle" className="pareto-tick">{tickFormat.format(tick)}</text>
        </g>)}
        <text x={(bounds.left + bounds.right) / 2} y={bounds.bottom + 54} textAnchor="middle" className="pareto-axis-label">
          {compact ? <><tspan x={(bounds.left + bounds.right) / 2}>Inference cost (USD per 1 million frames,</tspan><tspan x={(bounds.left + bounds.right) / 2} dy="18">log scale)</tspan></> : "Inference cost (USD per 1 million frames, log scale)"}
        </text>
        {FRONTIERS.map((group) => <path key={group.id} className="pareto-frontier" fill="none" stroke={group.color}
          data-frontier-group={group.id} data-frontier-models={group.points.map((point) => point.id).join(",")}
          d={staircasePath(group.points.map((point) => ({ x: x(point.costPerMillionFrames), y: y(point.total) })))} />)}
        <g className="pareto-legend" role="group" aria-label="Legend" transform={`translate(${compact ? bounds.left : bounds.left + 14} ${compact ? 518 : 157})`}>
          {GROUPS.map((group, index) => <g key={group.id} transform={`translate(0 ${index * 24})`}>
            <circle cx="10" cy="0" r="4.5" fill={group.color} />
            <text x="31" y="0" dy="0.35em">{group.label}</text>
          </g>)}
          {GROUPS.map((group, index) => <g key={group.id} transform={`translate(0 ${(index + 2) * 24})`}>
            <line x1="0" x2="21" y1="0" y2="0" stroke={group.color} strokeWidth="2.5" />
            <text x="31" y="0" dy="0.35em">{`${group.label} Pareto frontier`}</text>
          </g>)}
        </g>
        {points.map((point) => <g key={point.id} className="release-point pareto-point" role="button" tabIndex={0}
          aria-label={`${point.model}, ${dollars.format(point.costPerMillionFrames)} per million frames, index ${point.total.toFixed(3)}`}
          aria-pressed={activeId === point.id} data-model={point.id} data-total={point.total} data-cost={point.costPerMillionFrames} data-model-group={point.group}
          onFocus={() => setActiveId(point.id)} onClick={() => setActiveId(point.id)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setActiveId(point.id); }
          }}>
          <title>{`${point.model}\n${dollars.format(point.costPerMillionFrames)} per million frames\nIndex: ${point.total.toFixed(3)}`}</title>
          <circle cx={point.x} cy={point.y} r="12" fill="transparent" />
          {FRONTIER_COLORS.has(point.id) ? <circle className="pareto-frontier-marker" cx={point.x} cy={point.y}
            r="14" fill="#fff" stroke={FRONTIER_COLORS.get(point.id)} strokeWidth="2" /> : null}
          <PlotModelLogo provider={point.provider} x={point.x} y={point.y} />
          <circle className="release-focus-ring" cx={point.x} cy={point.y} r="17" />
          {point.group === "specialised" ? <text x={point.x + (point.provider === "internal" ? 22 : 10)} y={point.y + (point.total < 0.95 ? 22 : -13)} className="pareto-model-label" aria-hidden="true">{point.model}</text> : null}
        </g>)}
        {active ? <g className="release-tooltip pareto-tooltip" transform={`translate(${tooltipX} ${tooltipY})`} aria-hidden="true">
          <rect width={tooltipWidth} height="96" rx="4" />
          <text x="14" y="23" className="release-tooltip-name">{active.model}</text>
          <text x="14" y="46">Index <tspan fontWeight="650">{active.total.toFixed(3)}</tspan></text>
          <text x="14" y="68"><tspan fontWeight="650">{dollars.format(active.costPerMillionFrames)}</tspan> per million frames</text>
          <text x="14" y="85">{GROUPS.find((group) => group.id === active.group)!.label}</text>
        </g> : null}
      </svg>;
    })}
    <PlotFooter methodology={METHODOLOGY} />
  </figure>;
}
