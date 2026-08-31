import { useState, type ChangeEvent } from "react";

import {
  DOMAIN_DATASETS,
  domainDatasetFootnote,
  domainModelFootnote,
  domainWeightsUrl,
  type DomainPage,
} from "../data/domainBenchmark";
import { DOMAIN_EXAMPLES } from "../data/benchExample";
import { METRICS, type MetricId } from "../data/benchmark";
import { BenchExample } from "./BenchExample";
import { ResultsChart } from "./ResultsChart";
import { ResultsTable } from "./ResultsTable";

export function DomainLeaderboard({ page }: { page: DomainPage }) {
  const defaultMetricId = page.metricIds.includes("microF1")
    ? "microF1"
    : page.metricIds[0];
  const [metricId, setMetricId] = useState<MetricId>(defaultMetricId);
  const dataset = DOMAIN_DATASETS[page.datasetId];
  const datasetFootnote = domainDatasetFootnote(page.datasetId);

  const handleMetricChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const selected = page.metricIds.find((id) => id === event.target.value);
    if (!selected) throw new Error(`Unknown metric: ${event.target.value}`);
    setMetricId(selected);
  };

  return (
    <>
      <header className="domain-hero">
        <h2>{page.title}</h2>
        <p>
          {page.lead}
          <sup className="footnote-ref">{datasetFootnote}</sup>
        </p>
      </header>

      <BenchExample example={DOMAIN_EXAMPLES[page.datasetId]} />

      <section className="section" aria-labelledby={`${page.route}-results-heading`}>
        <h2 id={`${page.route}-results-heading`} className="visually-hidden">
          Results
        </h2>

        <div className="figure-row">
          <ResultsChart
            dataset={dataset}
            metricId={metricId}
            metric={METRICS[metricId]}
            footnoteFor={domainModelFootnote}
            caption={
              <>
                The plot reports {METRICS[metricId].captionName} on{" "}
                {page.classCount} {page.classNoun} in the{" "}
                <a href={page.sourceUrl} target="_blank" rel="noreferrer">
                  {dataset.name}
                </a>{" "}
                dataset.
              </>
            }
          />

          {page.metricIds.length > 1 ? (
            <label className="metric">
              <span className="metric__label">Metric</span>
              <select
                className="metric__select"
                value={metricId}
                onChange={handleMetricChange}
              >
                {page.metricIds.map((id) => (
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
          weightsFor={(modelId) => domainWeightsUrl(page.datasetId, modelId)}
        />

        <div className="result-notes">
          {page.notes.map((note) => (
            <p key={note}>{note}</p>
          ))}
        </div>
      </section>
    </>
  );
}
