import { METRICS, type Dataset, type MetricId } from "../data/benchmark";
import { ModelIcon } from "./ModelIcon";

function formatParams(paramsB: number | null): string {
  if (paramsB === null) return "undisclosed";
  if (paramsB < 1) return `${(paramsB * 1000).toFixed(0)}M`;
  return `${paramsB}B`;
}

export function ResultsTable({ dataset, metricId }: { dataset: Dataset; metricId: MetricId }) {
  const metric = METRICS[metricId];
  const baseline = dataset.majorityBaseline[metricId];

  const rows = [...dataset.results].sort((a, b) => {
    const left = a.metrics[metricId];
    const right = b.metrics[metricId];
    if (left === null) return 1;
    if (right === null) return -1;
    return right.value - left.value;
  });

  const scores = rows.map((row) => row.metrics[metricId]?.value).filter((v) => v !== undefined);
  const best = scores.length > 0 ? Math.max(...scores) : null;

  return (
    <table className="table">
      <thead>
        <tr>
          <th scope="col">Model</th>
          <th scope="col" className="table__num">
            Params
          </th>
          <th scope="col" className="table__num">
            {metric.label}
          </th>
          <th scope="col" className="table__num">
            95% CI
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((result) => {
          const score = result.metrics[metricId];
          return (
            <tr
              key={result.id}
              className={score !== null && score.value === best ? "table__row--best" : undefined}
            >
              <th scope="row">
                <ModelIcon provider={result.provider} />
                {result.model}
              </th>
              <td className="table__num">{formatParams(result.paramsB)}</td>
              <td className="table__num table__num--strong">
                {score === null ? "not evaluated" : `${score.value.toFixed(2)}%`}
              </td>
              <td className="table__num">
                {score === null || score.ciLow === null || score.ciHigh === null
                  ? "—"
                  : `${score.ciLow.toFixed(2)}–${score.ciHigh.toFixed(2)}`}
              </td>
            </tr>
          );
        })}
        <tr className="table__row--baseline">
          <th scope="row">Majority-class baseline</th>
          <td className="table__num">—</td>
          <td className="table__num table__num--strong">
            {baseline === null ? "not available" : `${baseline.toFixed(2)}%`}
          </td>
          <td className="table__num">—</td>
        </tr>
      </tbody>
    </table>
  );
}
