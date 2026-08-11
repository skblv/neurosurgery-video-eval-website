import { useState, type ChangeEvent } from "react";

import {
  GESTURE_BENCHMARK,
  GESTURE_METRICS,
  GESTURE_METRIC_ORDER,
  type GestureMetricId,
} from "../data/gestureBenchmark";
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
        <p className="eyebrow">Temporal understanding · action / gesture</p>
        <h2>Can a model follow what is happening?</h2>
        <p>
          Instruments are the nouns of surgical video; gestures are the verbs. Five systems follow
          the same uninterrupted operation and are compared against the same expert-annotated
          timeline.
        </p>
      </header>

      <section className="method-strip" aria-label="Gesture benchmark protocol">
        <div><strong>{GESTURE_BENCHMARK.procedureCount}</strong><span>continuous procedure</span></div>
        <div><strong>{formatDuration(GESTURE_BENCHMARK.durationSeconds)}</strong><span>video duration</span></div>
        <div><strong>{GESTURE_BENCHMARK.gestureClasses.length}</strong><span>gesture classes</span></div>
        <div><strong>{GESTURE_BENCHMARK.unambiguousFrameCount.toLocaleString()}</strong><span>scored frames</span></div>
      </section>

      <aside className="pilot-note">
        <span className="status status--pilot">Single-procedure pilot</span>
        <p>
          This comparison describes performance on one laparoscopic case; it is not evidence of
          universal model superiority. The next release will expand the same protocol across more
          procedures and report procedure-level variation.
        </p>
      </aside>

      <section className="section" aria-labelledby="gesture-results-heading">
        <div className="section__head">
          <h3 id="gesture-results-heading">Continuous-operation results</h3>
          <p>
            Scores use unambiguous expert-annotated frames at {GESTURE_BENCHMARK.fps} FPS. Human
            intervals cover {annotatedCoverage.toFixed(1)}% of the full video; overlapping labels
            and unannotated frames are excluded from these three headline metrics.
          </p>
        </div>

        <div className="figure-row figure-row--gesture">
          <ResultsChart
            dataset={GESTURE_BENCHMARK}
            metricId={metricId}
            metric={metric}
            caption={
              <>
                The plot reports {metric.captionName} across {GESTURE_BENCHMARK.unambiguousFrameCount.toLocaleString()}{" "}
                unambiguous annotated frames from one {formatDuration(GESTURE_BENCHMARK.durationSeconds)} continuous case.
              </>
            }
          />

          <label className="metric">
            <span className="metric__label">Metric</span>
            <select className="metric__select" value={metricId} onChange={handleMetricChange}>
              {GESTURE_METRIC_ORDER.map((id) => (
                <option key={id} value={id}>{GESTURE_METRICS[id].label}</option>
              ))}
            </select>
          </label>
        </div>

        <ResultsTable
          dataset={GESTURE_BENCHMARK}
          metricId={metricId}
          metricLabel={metric.label}
          showConfidenceInterval={false}
        />

        <p className="correction-note">
          <strong>Result note:</strong> Kimi K3 uses the documented normalization that maps its
          clip label to the benchmark's cut label. No confidence intervals are reported for this
          single-case comparison.
        </p>
      </section>
    </>
  );
}
