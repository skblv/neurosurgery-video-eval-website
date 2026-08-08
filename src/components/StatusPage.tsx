import { useEffect, useState } from "react";

import {
  fetchRunStatus,
  type RunStatus,
  type SubmissionStatus,
} from "../api/submissions";

const POLL_INTERVAL_MS = 10_000;

const TERMINAL_STATUSES: readonly SubmissionStatus[] = [
  "completed",
  "failed",
  "rejected",
];

const STATUS_HEADINGS: Record<SubmissionStatus, string> = {
  queued: "Queued",
  running: "Running",
  completed: "Finished",
  failed: "Failed",
  rejected: "Waiting on a maintainer",
};

/**
 * Live view of one submission, addressed by the token in the URL.
 *
 * The token is the only credential: whoever has the link can read this run, so
 * the service returns nothing that identifies the submitter. A run that has not
 * reached a terminal state is polled until it does.
 *
 * @param statusToken - Token from `#/status/<token>`.
 */
export function StatusPage({ statusToken }: { statusToken: string }) {
  const [run, setRun] = useState<RunStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;

    const poll = async () => {
      try {
        const next = await fetchRunStatus(statusToken);
        if (cancelled) return;
        setRun(next);
        setError(null);
        if (!TERMINAL_STATUSES.includes(next.status)) {
          timer = window.setTimeout(poll, POLL_INTERVAL_MS);
        }
      } catch (cause) {
        if (cancelled) return;
        setError(cause instanceof Error ? cause.message : String(cause));
        timer = window.setTimeout(poll, POLL_INTERVAL_MS);
      }
    };

    void poll();
    return () => {
      cancelled = true;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [statusToken]);

  if (error && run === null) {
    return (
      <p className="status__error" role="alert">
        {error}
      </p>
    );
  }

  if (run === null) return <p className="status__loading">Loading…</p>;

  const isRunning = !TERMINAL_STATUSES.includes(run.status);

  return (
    <div className="status">
      <p className="status__line">
        <strong>{run.model_name}</strong> on {run.datasets.join(", ")}
      </p>

      <p className={`status__badge status__badge--${run.status}`}>
        {STATUS_HEADINGS[run.status]}
      </p>

      {isRunning && (
        <div
          className="status__bar"
          role="progressbar"
          aria-valuenow={run.progress_pct}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <span className="status__track">
            <span
              className="status__fill"
              style={{ width: `${run.progress_pct}%` }}
            />
          </span>
          <em>{run.progress_pct}%</em>
        </div>
      )}

      <p className="status__detail">{run.detail}</p>

      {run.metrics.length > 0 && (
        <table className="table status__table">
          <thead>
            <tr>
              <th scope="col">Dataset</th>
              <th scope="col">Micro-averaged F1</th>
              <th scope="col">Exact-match accuracy</th>
              <th scope="col">Frames scored</th>
            </tr>
          </thead>
          <tbody>
            {run.metrics.map((score) => (
              <tr key={score.dataset}>
                <th scope="row">{score.dataset}</th>
                <td>{score.microF1Pct.toFixed(2)}%</td>
                <td>{score.exactMatchPct.toFixed(2)}%</td>
                <td>{score.framesScored.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <p className="status__foot">
        Keep this link to come back to it. Last updated {run.updated_at}.
        {isRunning && " This page refreshes itself every 10 seconds."}
      </p>

      {error && (
        <p className="status__error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
