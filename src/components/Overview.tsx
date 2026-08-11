import {
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

import { DOMAINS } from "../data/domains";

const STATUS_LABEL = {
  published: "Published",
  pilot: "Single-procedure pilot",
  planned: "Planned",
} as const;

const STATUS_LEVEL = {
  published: 2,
  pilot: 1,
  planned: 0,
} as const;

const RADAR_DATA = DOMAINS.map((domain) => ({
  domain: domain.shortLabel,
  level: STATUS_LEVEL[domain.status],
  status: STATUS_LABEL[domain.status],
}));

function CoverageTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: (typeof RADAR_DATA)[number] }>;
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  return (
    <div className="tip">
      <p className="tip__model">{point.domain}</p>
      <p className="tip__value">{point.status}</p>
    </div>
  );
}

export function Overview() {
  return (
    <>
      <header className="overview-hero">
        <p className="eyebrow">Surgical AGI benchmark program</p>
        <h2>Measure the whole surgical intelligence stack.</h2>
        <p>
          Surgical intelligence is not one task. This program evaluates the capabilities needed to
          see, follow, reason about, and assess an operation—one reproducible benchmark at a time.
        </p>
      </header>

      <section className="coverage" aria-labelledby="coverage-title">
        <div className="coverage__copy">
          <p className="eyebrow">Program coverage</p>
          <h3 id="coverage-title">A six-domain view of progress</h3>
          <p>
            This radar reports benchmark maturity, not model performance. Instruments have three
            published datasets; action and gesture currently has one continuous-procedure pilot.
            Empty axes are planned domains—not zero model scores.
          </p>
          <div className="coverage__legend" aria-label="Benchmark maturity levels">
            <span><i className="legend-dot legend-dot--published" />Published</span>
            <span><i className="legend-dot legend-dot--pilot" />Pilot</span>
            <span><i className="legend-dot legend-dot--planned" />Planned</span>
          </div>
        </div>

        <figure className="coverage__figure" aria-label="Radar chart of benchmark maturity across six surgical intelligence domains">
          <ResponsiveContainer width="100%" height={360}>
            <RadarChart data={RADAR_DATA} outerRadius="64%">
              <PolarGrid stroke="#d6d6d6" />
              <PolarAngleAxis dataKey="domain" tick={{ fill: "#222222", fontSize: 11 }} />
              <Tooltip content={<CoverageTooltip />} />
              <Radar
                dataKey="level"
                stroke="#0f766e"
                fill="#0f766e"
                fillOpacity={0.22}
                strokeWidth={2}
                dot={{ r: 4, fill: "#0f766e", strokeWidth: 0 }}
                isAnimationActive={false}
              />
            </RadarChart>
          </ResponsiveContainer>
          <figcaption>Scale: planned, pilot, published. No cross-domain model score is implied.</figcaption>
        </figure>
      </section>

      <section className="domain-grid" aria-label="Benchmark domains">
        {DOMAINS.map((domain) => (
          <a key={domain.id} href={`#/${domain.id}`} className="domain-card">
            <span className={`status status--${domain.status}`}>{STATUS_LABEL[domain.status]}</span>
            <h3>{domain.label}</h3>
            <p>{domain.description}</p>
            <span className="domain-card__action">
              {domain.status === "planned" ? "View roadmap" : "View benchmark"} <span aria-hidden="true">→</span>
            </span>
          </a>
        ))}
      </section>
    </>
  );
}
