import { useMemo, useState, type ChangeEvent } from "react";

import { ResultsChart } from "./components/ResultsChart";
import { ResultsTable } from "./components/ResultsTable";
import { boothLogo, sdscLogo } from "./assets/logos";
import {
  DATASETS,
  METRICS,
  METRIC_ORDER,
  PAPER,
  type DatasetId,
  type MetricId,
} from "./data/benchmark";

export default function App() {
  const [activeId, setActiveId] = useState<DatasetId>("cholect50");
  const [metricId, setMetricId] = useState<MetricId>("microF1");
  const active = useMemo(() => DATASETS.find((d) => d.id === activeId)!, [activeId]);

  const handleMetricChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const selected = METRIC_ORDER.find((id) => id === event.target.value);
    if (!selected) throw new Error(`Unknown metric: ${event.target.value}`);
    setMetricId(selected);
  };

  return (
    <div className="page">
      <header className="masthead">
        <div className="lockup">
          <a href="https://www.surgicalvideo.io/about" target="_blank" rel="noreferrer">
            <img
              className="lockup__sdsc"
              src={sdscLogo}
              alt="Surgical Data Science Collective"
            />
          </a>
          <span className="lockup__rule" aria-hidden="true" />
          <a
            href="https://www.chicagobooth.edu/research/center-for-applied-ai"
            target="_blank"
            rel="noreferrer"
          >
            <img
              className="lockup__booth"
              src={boothLogo}
              alt="The University of Chicago Booth School of Business"
            />
          </a>
        </div>

        <h1>Surgical intelligence leaderboard</h1>
        <p className="masthead__lede">
          How close are today's vision–language models (VLMs) to Surgical AGI? The prerequisite is
          that they should be able to identify instruments in a surgical video frame. We benchmark
          frontier VLMs on 3 surgical benchmarks:
        </p>
      </header>

      <main>
        <section className="section" aria-labelledby="results-heading">
          <h2 id="results-heading" className="visually-hidden">
            Results
          </h2>

          <div className="tabs" role="tablist" aria-label="Dataset">
            {DATASETS.map((dataset) => (
              <button
                key={dataset.id}
                role="tab"
                type="button"
                aria-selected={dataset.id === activeId}
                className={dataset.id === activeId ? "tab tab--active" : "tab"}
                onClick={() => setActiveId(dataset.id)}
              >
                {dataset.name}
              </button>
            ))}
          </div>

          <div className="figure-row">
            <ResultsChart dataset={active} metricId={metricId} />

            <label className="metric">
              <span className="metric__label">Metric</span>
              <select className="metric__select" value={metricId} onChange={handleMetricChange}>
                {METRIC_ORDER.map((id) => (
                  <option key={id} value={id}>
                    {METRICS[id].label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <ResultsTable dataset={active} metricId={metricId} />
        </section>
      </main>

      <footer className="footer">
        <p className="citation">
          {PAPER.authorsShort} <cite>{PAPER.title}</cite>{" "}
          <a href={PAPER.url} target="_blank" rel="noreferrer">
            {PAPER.arxivId}
          </a>{" "}
          ({PAPER.year}).
        </p>
        <div className="footer__logos">
          <img src={sdscLogo} alt="Surgical Data Science Collective" />
          <img
            className="footer__booth"
            src={boothLogo}
            alt="The University of Chicago Booth School of Business"
          />
        </div>
      </footer>
    </div>
  );
}
