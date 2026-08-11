/**
 * Build-time gate for hand-edited results: parses `src/data/results.json`
 * with the same validator the app uses, so a bad edit fails the deploy
 * instead of breaking the published page. Run via `npm run build`.
 */

import rawResults from "../src/data/results.json" with { type: "json" };
import rawGestureResults from "../src/data/gestureResults.json" with { type: "json" };
import { DATASET_ORDER, parseResultsFile } from "../src/data/resultsSchema.ts";
import { parseGestureResultsFile } from "../src/data/gestureResultsSchema.ts";

const parsed = parseResultsFile(rawResults);

const counts = DATASET_ORDER.map(
  (dataset) => `${dataset}: ${parsed.datasets[dataset].results.length} models`,
).join(", ");
console.log(`results.json valid (generated ${parsed.generatedAt}; ${counts})`);

const gesture = parseGestureResultsFile(rawGestureResults);
console.log(
  `gestureResults.json valid (generated ${gesture.generatedAt}; ` +
    `${gesture.benchmark.results.length} models; ${gesture.benchmark.procedureCount} procedure)`,
);
