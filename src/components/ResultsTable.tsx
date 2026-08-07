import type { Dataset } from "../data/benchmark";
import { ModelIcon } from "./ModelIcon";

function formatParams(paramsB: number | null): string {
  if (paramsB === null) return "undisclosed";
  if (paramsB < 1) return `${(paramsB * 1000).toFixed(0)}M`;
  return `${paramsB}B`;
}

export function ResultsTable({ dataset }: { dataset: Dataset }) {
  const best = Math.max(...dataset.results.map((result) => result.exactMatch));

  return (
    <table className="table">
      <thead>
        <tr>
          <th scope="col">Model</th>
          <th scope="col" className="table__num">
            Params
          </th>
          <th scope="col" className="table__num">
            Exact match
          </th>
          <th scope="col" className="table__num">
            95% CI
          </th>
        </tr>
      </thead>
      <tbody>
        {dataset.results.map((result) => (
          <tr
            key={result.id}
            className={result.exactMatch === best ? "table__row--best" : undefined}
          >
            <th scope="row">
              <ModelIcon provider={result.provider} />
              {result.model}
            </th>
            <td className="table__num">{formatParams(result.paramsB)}</td>
            <td className="table__num table__num--strong">{result.exactMatch.toFixed(2)}%</td>
            <td className="table__num">
              {result.ciLow === null || result.ciHigh === null
                ? "—"
                : `${result.ciLow.toFixed(2)}–${result.ciHigh.toFixed(2)}`}
            </td>
          </tr>
        ))}
        <tr className="table__row--baseline">
          <th scope="row">Majority-class baseline</th>
          <td className="table__num">—</td>
          <td className="table__num table__num--strong">{dataset.majorityBaseline.toFixed(2)}%</td>
          <td className="table__num">—</td>
        </tr>
      </tbody>
    </table>
  );
}
