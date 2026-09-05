import { useState, type ChangeEvent } from "react";

import { GESTURE_EXAMPLE } from "../data/benchExample";
import { gestureModelFootnote } from "../data/benchmark";
import {
  GESTURE_BENCHMARK,
  GESTURE_METRICS,
  GESTURE_METRIC_ORDER,
  type GestureMetricId,
} from "../data/gestureBenchmark";
import { BenchExample } from "./BenchExample";
import { ResultsChart } from "./ResultsChart";
import { ResultsTable } from "./ResultsTable";

function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${Math.round(seconds % 60).toString().padStart(2, "0")}`;
}

export function GestureLeaderboard() {
  const [metricId, setMetricId] = useState<GestureMetricId>("exactAccuracy");

  const handleMetricChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const selected = GESTURE_METRIC_ORDER.find((id) => id === event.target.value);
    if (!selected) throw new Error(`Unknown gesture metric: ${event.target.value}`);
    setMetricId(selected);
  };

  const metric = GESTURE_METRICS[metricId];
  const annotatedCoverage =
    (GESTURE_BENCHMARK.annotatedFrameCount / GESTURE_BENCHMARK.evaluatedFrameCount) * 100;

  return (
    <>
      <header className="domain-hero">
        <h2>Can a model understand surgical video?</h2>{" "}
        <p>
          Instruments are the nouns of surgical video; gestures are the verbs. We benchmark models
          on whether they can recognise the actions a surgeon performs.
        </p>
      </header>

      <BenchExample example={GESTURE_EXAMPLE} />

      <section className="section" aria-labelledby="gesture-results-heading">
        <h3 id="gesture-results-heading" className="visually-hidden">
          Continuous-operation results
        </h3>

        <div className="figure-row">
          <ResultsChart
            key={metricId}
            dataset={GESTURE_BENCHMARK}
            metricId={metricId}
            metric={metric}
            footnoteFor={gestureModelFootnote}
          />

          <label className="metric">
            <span className="metric__label">Metric</span>
            <select
              className="metric__select"
              value={metricId}
              onChange={handleMetricChange}
            >
              {GESTURE_METRIC_ORDER.map((id) => (
                <option key={id} value={id}>
                  {GESTURE_METRICS[id].label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <ResultsTable
          dataset={GESTURE_BENCHMARK}
          metricId={metricId}
          metricLabel={metric.label}
          footnoteFor={gestureModelFootnote}
          showConfidenceInterval={false}
        />

        <div className="result-notes">
          <p>
            One laparoscopic procedure ({formatDuration(GESTURE_BENCHMARK.durationSeconds)} of
            video, {GESTURE_BENCHMARK.gestureClasses.length} gesture classes), annotated by expert
            surgeons at {GESTURE_BENCHMARK.fps} FPS. The annotations cover{" "}
            {annotatedCoverage.toFixed(1)}% of the video; frames with overlapping or missing labels
            are not scored, leaving {GESTURE_BENCHMARK.unambiguousFrameCount.toLocaleString()}{" "}
            frames.
          </p>
          <p>
            Kimi K3 uses the documented normalization that maps its clip label to the benchmark's
            cut label. No confidence intervals are reported for this single-case comparison.
          </p>
        </div>
      </section>
    </>
  );
}
