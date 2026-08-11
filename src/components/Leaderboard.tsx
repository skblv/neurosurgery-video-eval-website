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

/** Instrument domain: dataset tabs, the figure, and the full table. */
export function InstrumentLeaderboard() {
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
      <header className="domain-hero">
        <p className="eyebrow">Perception · instruments</p>
        <h2>Which instruments are visible?</h2>
        <p>
          Identifying surgical tools is a prerequisite for understanding what is happening in an
          operation. We compare frontier and specialist models across three frame-level surgical
          benchmarks<sup className="footnote-ref">1</sup>.
        </p>
      </header>

      <section className="section" aria-labelledby="results-heading">
        <h2 id="results-heading" className="visually-hidden">
          Results
        </h2>

        <div className="tabs" role="tablist" aria-label="Dataset">
          {DATASETS.map((dataset, index) => (
            <button
              key={dataset.id}
              role="tab"
              type="button"
              aria-selected={dataset.id === activeId}
              className={dataset.id === activeId ? "tab tab--active" : "tab"}
              onClick={() => setActiveId(dataset.id)}
            >
              {dataset.name}
              <sup className="footnote-ref">{index + 2}</sup>
            </button>
          ))}
        </div>

        <div className="figure-row">
          <ResultsChart
            dataset={active}
            metricId={metricId}
            metric={METRICS[metricId]}
            caption={
              <>
                The plot reports {METRICS[metricId].captionName} on {active.toolClasses}{" "}
                instruments in the{" "}
                <a href={active.sourceUrl} target="_blank" rel="noreferrer">
                  {active.name}
                </a>{" "}
                dataset.
              </>
            }
          />

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

        <ResultsTable
          dataset={active}
          metricId={metricId}
          metricLabel={METRICS[metricId].label}
        />
      </section>
    </>
  );
}
