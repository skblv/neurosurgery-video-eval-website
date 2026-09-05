import { useState, type ChangeEvent } from "react";

import {
  DOMAIN_DATASETS,
  domainDatasetFootnote,
  domainModelFootnote,
  domainWeightsUrl,
  type DomainDatasetId,
  type DomainPage,
} from "../data/domainBenchmark";
import { DOMAIN_EXAMPLES } from "../data/benchExample";
import { METRICS, type MetricId } from "../data/benchmark";
import { BenchExample } from "./BenchExample";
import { ResultsChart } from "./ResultsChart";
import { ResultsTable } from "./ResultsTable";

function defaultMetric(metricIds: MetricId[]): MetricId {
  return metricIds.includes("microF1") ? "microF1" : metricIds[0];
}

export function DomainLeaderboard({ page }: { page: DomainPage }) {
  const [activeId, setActiveId] = useState<DomainDatasetId>(page.datasetIds[0]);
  const dataset = DOMAIN_DATASETS[activeId];
  const [metricId, setMetricId] = useState<MetricId>(() =>
    defaultMetric(dataset.metricIds),
  );
  const datasetFootnote = domainDatasetFootnote(activeId);

  const handleDatasetChange = (datasetId: DomainDatasetId) => {
    setActiveId(datasetId);
    setMetricId(defaultMetric(DOMAIN_DATASETS[datasetId].metricIds));
  };

  const handleMetricChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const selected = dataset.metricIds.find((id) => id === event.target.value);
    if (!selected) throw new Error(`Unknown metric: ${event.target.value}`);
    setMetricId(selected);
  };

  return (
    <>
      <header className="domain-hero">
        <h2>{page.title}</h2>{" "}
        <p>
          {page.lead}
          {page.datasetIds.length === 1 ? (
            <sup className="footnote-ref">{datasetFootnote}</sup>
          ) : null}
        </p>
      </header>

      {page.datasetIds.length > 1 ? (
        <div className="tabs" role="tablist" aria-label="Dataset">
          {page.datasetIds.map((datasetId) => {
            const item = DOMAIN_DATASETS[datasetId];
            return (
              <button
                key={datasetId}
                role="tab"
                type="button"
                aria-selected={datasetId === activeId}
                className={datasetId === activeId ? "tab tab--active" : "tab"}
                onClick={() => handleDatasetChange(datasetId)}
              >
                {item.name}
                <sup className="footnote-ref">
                  {domainDatasetFootnote(datasetId)}
                </sup>
              </button>
            );
          })}
        </div>
      ) : null}

      <BenchExample key={activeId} example={DOMAIN_EXAMPLES[activeId]} />

      <section className="section" aria-labelledby={`${page.route}-results-heading`}>
        <h2 id={`${page.route}-results-heading`} className="visually-hidden">
          Results
        </h2>

        <div className="figure-row">
          <ResultsChart
            key={`${activeId}-${metricId}`}
            dataset={dataset}
            metricId={metricId}
            metric={METRICS[metricId]}
            footnoteFor={domainModelFootnote}
            caption={
              <>
                The plot reports {METRICS[metricId].captionName} on{" "}
                {dataset.classCount} {dataset.classNoun} in the{" "}
                <a href={dataset.sourceUrl} target="_blank" rel="noreferrer">
                  {dataset.name}
                </a>{" "}
                dataset.
              </>
            }
          />

          {dataset.metricIds.length > 1 ? (
            <label className="metric">
              <span className="metric__label">Metric</span>
              <select
                className="metric__select"
                value={metricId}
                onChange={handleMetricChange}
              >
                {dataset.metricIds.map((id) => (
                  <option key={id} value={id}>
                    {METRICS[id].label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>

        <ResultsTable
          dataset={dataset}
          metricId={metricId}
          metricLabel={METRICS[metricId].label}
          footnoteFor={domainModelFootnote}
          weightsFor={(modelId) => domainWeightsUrl(activeId, modelId)}
        />

        <div className="result-notes">
          {dataset.notes.map((note) => (
            <p key={note}>{note}</p>
          ))}
        </div>
      </section>
    </>
  );
}
