import { useMemo, useState, type ChangeEvent } from "react";

import { ResultsChart } from "./ResultsChart";
import { ResultsTable } from "./ResultsTable";
import {
  DATASETS,
  METRICS,
  METRIC_ORDER,
  type DatasetId,
  type MetricId,
} from "../data/benchmark";

/** The leaderboard itself: dataset tabs, the figure, and the full table. */
export function Leaderboard() {
  const [activeId, setActiveId] = useState<DatasetId>("cholect50");
  const [metricId, setMetricId] = useState<MetricId>("microF1");
  const active = useMemo(() => DATASETS.find((d) => d.id === activeId)!, [activeId]);

  const handleMetricChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const selected = METRIC_ORDER.find((id) => id === event.target.value);
    if (!selected) throw new Error(`Unknown metric: ${event.target.value}`);
    setMetricId(selected);
  };

  return (
    <>
      <p className="masthead__lede">
        How close are today's vision–language models (VLMs) to Surgical AGI? The prerequisite is
        that they should be able to identify instruments in a surgical video frame. We benchmark
        frontier VLMs on 3 surgical benchmarks:
      </p>

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
    </>
  );
}
