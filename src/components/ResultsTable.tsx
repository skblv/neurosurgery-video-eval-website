import type { FootnoteLookup, LeaderboardBenchmark } from "../data/leaderboard";
import { BASELINE_ICON_LABEL, DieIcon } from "./DieIcon";
import { ModelIcon } from "./ModelIcon";

/** The majority-class baseline ranks alongside the models, so rows are provider-optional. */
interface TableRow {
  key: string;
  label: string;
  provider: string | null;
  value: number | null;
  ciLow: number | null;
  ciHigh: number | null;
}

function buildRows<MetricId extends string>(
  dataset: LeaderboardBenchmark<MetricId>,
  metricId: MetricId,
): TableRow[] {
  const rows: TableRow[] = dataset.results.map((result) => {
    const score = result.metrics[metricId];
    return {
      key: result.id,
      label: result.model,
      provider: result.provider,
      value: score === null ? null : score.value,
      ciLow: score === null ? null : score.ciLow,
      ciHigh: score === null ? null : score.ciHigh,
    };
  });

  const baseline = dataset.majorityBaseline[metricId];
  if (baseline !== null) {
    rows.push({
      key: "majority-class-baseline",
      label: "Majority-class baseline",
      provider: null,
      value: baseline,
      ciLow: null,
      ciHigh: null,
    });
  }

  return rows.sort((a, b) => {
    if (a.value === null) return b.value === null ? 0 : 1;
    if (b.value === null) return -1;
    return b.value - a.value;
  });
}

export function ResultsTable<MetricId extends string>({
  dataset,
  metricId,
  metricLabel,
  footnoteFor,
  showConfidenceInterval = true,
}: {
  dataset: LeaderboardBenchmark<MetricId>;
  metricId: MetricId;
  metricLabel: string;
  footnoteFor: FootnoteLookup;
  showConfidenceInterval?: boolean;
}) {
  const rows = buildRows(dataset, metricId);

  return (
    <table className="table">
      <thead>
        <tr>
          <th scope="col">Model</th>
          <th scope="col" className="table__num table__col--metric">
            {metricLabel}
          </th>
          {showConfidenceInterval ? (
            <th scope="col" className="table__num table__col--ci">95% CI</th>
          ) : null}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.key}>
            <th scope="row">
              {row.provider === null ? (
                <span className="model-icon" title={BASELINE_ICON_LABEL}>
                  <DieIcon />
                </span>
              ) : (
                <ModelIcon provider={row.provider} />
              )}
              {row.label}
              {footnoteFor(row.key) === null ? null : (
                <sup className="footnote-ref">{footnoteFor(row.key)}</sup>
              )}
            </th>
            <td className="table__num table__num--strong">
              {row.value === null ? "not evaluated" : `${row.value.toFixed(2)}%`}
            </td>
            {showConfidenceInterval ? (
              <td className="table__num">
                {row.ciLow === null || row.ciHigh === null
                  ? "—"
                  : `${row.ciLow.toFixed(2)}–${row.ciHigh.toFixed(2)}`}
              </td>
            ) : null}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
