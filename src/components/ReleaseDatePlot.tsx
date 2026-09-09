import { useRef, useState, type MouseEvent } from "react";
import qwenLogo from "../assets/logos/qwen.svg?no-inline";
import { SUMMARY_MODALITIES, SUMMARY_ROWS } from "../data/summary";
import { releasePoints, releasePlotLayout, releaseFamilies } from "../data/releasePlot";
import { PROVIDER_ICONS } from "../data/providerIcons";
import { plotMethodology } from "../data/plotMethodology";
import { PlotCopyButton } from "./PlotCopyButton";
import { PlotFooter } from "./PlotFooter";

const POINTS = releasePoints(SUMMARY_ROWS);
const FAMILIES = releaseFamilies(POINTS);
const TITLE = "Surgical Intelligence Index: How well do LLMs perform against specialized models across surgical tasks?";
const SUBTITLE = "Historical performance";
const METHODOLOGY = plotMethodology(SUMMARY_MODALITIES);
const HEIGHT = 480;
const LAYOUTS = [
  { width: 920, className: "release-plot-wide", layout: releasePlotLayout(POINTS, 920, HEIGHT) },
  { width: 480, className: "release-plot-compact", layout: releasePlotLayout(POINTS, 480, HEIGHT) },
];
const dateFormat = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
const tickFormat = new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric", timeZone: "UTC" });

function ReleaseModelLogo({ provider, x, y }: { provider: string; x: number; y: number }) {
  const icon = PROVIDER_ICONS[provider];
  const size = 18;
  const [minX, minY, width, height] = icon?.viewBox.split(" ").map(Number) ?? [0, 0, size, size];
  const scale = size / Math.max(width, height);
  return <g className="release-model-logo" data-provider={provider} aria-hidden="true">
    {icon ? <path d={icon.path} fill={icon.hex}
      transform={`translate(${x - (minX + width / 2) * scale} ${y - (minY + height / 2) * scale}) scale(${scale})`} />
      : <image href={provider === "qwen" ? qwenLogo : `${import.meta.env.BASE_URL}provider-logos/${provider}.png`} x={x - size / 2} y={y - size / 2} width={size} height={size} />}
  </g>;
}

export function ReleaseDatePlot() {
  const [activeId, setActiveId] = useState<string | null>(null);
  const plotRef = useRef<SVGSVGElement>(null);
  return <figure className="release-plot" aria-labelledby="release-plot-heading"
    onPointerLeave={() => setActiveId(null)}
    onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setActiveId(null); }}
    onKeyDown={(event) => { if (event.key === "Escape") setActiveId(null); }}>
    <figcaption>
      <h3 id="release-plot-heading">{TITLE}</h3>
      <PlotCopyButton plotRef={plotRef} title={TITLE} subtitle={SUBTITLE} methodology={METHODOLOGY} />
      <p className="release-subtitle">{SUBTITLE}</p>
    </figcaption>
    {LAYOUTS.map(({ width, className, layout }) => {
      const active = layout.points.find((point) => point.id === activeId);
      const tooltipWidth = 238;
      const tooltipX = active ? Math.max(12, Math.min(width - tooltipWidth - 12, active.x - tooltipWidth / 2)) : 0;
      const tooltipY = active ? (active.y > 140 ? active.y - 97 : active.y + 20) : 0;
      const selectNearest = (event: MouseEvent<SVGSVGElement>) => {
        const rect = event.currentTarget.getBoundingClientRect();
        const x = (event.clientX - rect.left) * width / rect.width;
        const y = (event.clientY - rect.top) * HEIGHT / rect.height;
        let distance = 18 ** 2;
        let id: string | null = null;
        for (const point of layout.points) {
          const next = (point.x - x) ** 2 + (point.y - y) ** 2;
          if (next < distance) { distance = next; id = point.id; }
        }
        setActiveId(id);
      };
      return <svg key={width} ref={width === 920 ? plotRef : undefined} className={className} viewBox={`0 0 ${width} ${HEIGHT}`} role="group" aria-label="Surgical Intelligence Index by model release date" data-axis-max="1"
        onMouseMove={selectNearest} onClick={(event) => { if (event.detail > 0) selectNearest(event); }}>
        {layout.yTicks.map((tick) => <g key={tick}>
          <line x1={layout.bounds.left} x2={layout.bounds.right} y1={layout.y(tick)} y2={layout.y(tick)} className="release-grid" />
          <text x={layout.bounds.left - 12} y={layout.y(tick)} dy="0.35em" textAnchor="end" className="release-tick">{tick.toFixed(2)}</text>
        </g>)}
        {layout.xTicks.map((tick, index) => <g key={tick}>
          <line x1={layout.x(tick)} x2={layout.x(tick)} y1={layout.bounds.top} y2={layout.bounds.bottom} className="release-grid release-grid-vertical" />
          <text x={layout.x(tick)} y={layout.bounds.bottom + 25} textAnchor={index === layout.xTicks.length - 1 ? "end" : "middle"} className="release-tick">{tickFormat.format(tick)}</text>
        </g>)}
        <text x={(layout.bounds.left + layout.bounds.right) / 2} y={layout.bounds.bottom + 54} textAnchor="middle" className="release-axis-label">Release date</text>
        <g className="release-family-legend" role="group" aria-label="Model families" transform={`translate(${layout.bounds.left + 12} ${layout.bounds.top + 12})`}>
          <rect className="release-family-legend-box" width={Math.ceil(FAMILIES.length / 4) * 84 + 20} height={Math.min(FAMILIES.length, 4) * 25 + 18} />
          {FAMILIES.map((family, index) => <g key={family.provider} data-family={family.provider} transform={`translate(${Math.floor(index / 4) * 84} ${22 + index % 4 * 25})`}>
            <ReleaseModelLogo provider={family.provider} x={22} y={0} />
            <text x="37" y="0" dy="0.35em">{family.label}</text>
          </g>)}
        </g>
        {layout.points.map((point) => <g key={point.id} className="release-point" role="button" tabIndex={0}
          aria-label={`${point.model}, released ${dateFormat.format(point.releasedAt)}, index ${point.total.toFixed(3)}`}
          aria-pressed={activeId === point.id} data-model={point.id} data-release-date={point.release.date} data-total={point.total}
          onFocus={() => setActiveId(point.id)}
          onClick={() => setActiveId(point.id)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setActiveId(point.id); }
          }}>
          <title>{`${point.model}\n${dateFormat.format(point.releasedAt)}\nIndex: ${point.total.toFixed(3)}`}</title>
          <circle cx={point.x} cy={point.y} r="13" fill="transparent" />
          <ReleaseModelLogo provider={point.provider} x={point.x} y={point.y} />
          <circle className="release-focus-ring" cx={point.x} cy={point.y} r="14" />
        </g>)}
        {active ? <g className="release-tooltip" transform={`translate(${tooltipX} ${tooltipY})`} aria-hidden="true">
          <rect width={tooltipWidth} height="80" rx="4" />
          <text x="14" y="23" className="release-tooltip-name">{active.model}</text>
          <text x="14" y="45">{dateFormat.format(active.releasedAt)}</text>
          <text x="14" y="65">Index <tspan fontWeight="650">{active.total.toFixed(3)}</tspan></text>
        </g> : null}
      </svg>;
    })}
    <PlotFooter methodology={METHODOLOGY} />
  </figure>;
}
