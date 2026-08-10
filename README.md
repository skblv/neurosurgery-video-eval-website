# Surgical intelligence leaderboard

Static leaderboard site for the SDSC × Chicago Booth surgical VLM benchmark,
published at the paper "A Comparative Study in Surgical AI: Potential and
Limitations of Data, Compute, and Scaling" (arXiv:2603.27341).

## How deployment works

**Every push to `main` deploys the site.** A GitHub Actions workflow
(`.github/workflows/deploy.yml`) runs `npm ci && npm run build` and publishes
`dist/` to GitHub Pages. Deploys finish in about a minute; check the Actions
tab if a change does not show up.

There is no other deploy step. If the build fails (including a malformed
`results.json` — see below), the site simply keeps its previous version.

## Where the numbers live

All scores are in `src/data/results.json`. It is validated at build time by
`src/data/resultsSchema.ts`: unknown keys, missing metrics, or a wrong
`schemaVersion` fail the build with a precise error message rather than
rendering a broken chart. That means you can edit `results.json` directly on
GitHub and trust the Action to catch mistakes.

Normally you should not edit it by hand: the eval backend runs a model against
the benchmarks and pushes a commit that updates `results.json` (and, for a new
model family, its logo). Hand-editing is for corrections, retractions, or
importing results computed elsewhere.

## Adding a model result (via GitHub)

1. Edit `src/data/results.json`. For each dataset the model was evaluated on,
   append an entry to `datasets.<dataset>.results`:

   ```json
   {
     "id": "my-model-7b",
     "model": "My Model 7B",
     "provider": "myfamily",
     "sourceRunId": null,
     "metrics": {
       "exactMatch": { "value": 61.2, "ciLow": 59.8, "ciHigh": 62.7 },
       "microF1": { "value": 74.5, "ciLow": 73.1, "ciHigh": 75.9 }
     }
   }
   ```

   - `id` must be unique within each dataset (lowercase slug of the model name).
   - `provider` is a lowercase slug and controls the icon shown next to the
     model. Existing providers: `internal`, `openai`, `anthropic`, `gemini`,
     `google`, `moonshot`, plus any slug with a logo file (see next step).
   - Values are percentages (0–100). `ciLow`/`ciHigh` are the 95% bootstrap
     confidence interval; set both to `null` if you do not have one. A metric
     can be `null` if it was not computed.

2. If the model belongs to a family the site has never shown, add its icon at
   `public/provider-logos/<provider-slug>.png` (or `.svg`/`.jpg`/`.webp`) and
   optionally a display name in `KNOWN_PROVIDER_LABELS` in
   `src/data/benchmark.ts` (otherwise the slug is title-cased).

3. Open a pull request, or push to `main` directly if you have write access.
   The Action builds (catching any schema errors) and deploys.

## Adding a benchmark (dataset)

A new dataset needs small code changes in three files plus data:

1. `src/data/resultsSchema.ts` — add the id to the `DatasetId` union and to
   `DATASET_ORDER` (which also sets tab order).
2. `src/data/benchmark.ts` — add an entry to `DATASET_META` (display name,
   number of tool classes, source URL) and a reference to `DATASET_CITATIONS`
   (it becomes the next numbered footnote automatically).
3. `src/data/results.json` — add the dataset key under `datasets` with a
   `majorityBaseline` and a `results` array (may be empty of models but the
   key must exist, since the schema requires exactly the datasets in
   `DATASET_ORDER`).

To have the eval backend score models on the new dataset automatically, the
dataset also has to be added to the runner (frames in S3 plus an entry in its
dataset config) — contact the maintainers.

## Local development

```bash
npm ci
npm run dev        # dev server with hot reload
npm run build      # what CI runs; validates results.json
```
