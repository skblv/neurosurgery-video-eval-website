# Surgical intelligence leaderboard

Static SDSC × Chicago Booth benchmark site for the capabilities that make up
surgical intelligence. The published instrument benchmark is joined by a
single-procedure continuous gesture pilot, with domain pages reserved for the
next benchmark families.

## Site structure

- `/` and `#/summary` — specialist-normalized scores, total and per-modality table, and interactive web plot (default page).
- `#/instruments` — the published CholecT50, PitVis-2023, and SurgVU results.
- `#/gestures` — the continuous-operation gesture comparison.
- `#/anatomy`, `#/clinical-context`, `#/recommendations`, and `#/skill-assessment` — domain benchmark results.

## Summary scoring

`src/data/summary.ts` derives all scores from the existing validated result files.
For each dataset, divide the model's metric by the fixed specialist's metric:
YOLOv12-m for Instruments, SurgMotion for the continuous Action pilot, and
ResNet-50 for Anatomy, Skill assessment, Clinical context / VQA, and Recommendations.
Average dataset ratios equally within a modality, then average the six modality
scores equally for the total. Ratios above 1 are preserved; calculations use
full source precision before display rounding.

The default uses each existing tab's default metric: micro-F1 except Action
(exact frame accuracy) and Skill assessment (exact-match accuracy). The Summary
also offers exact accuracy across all datasets. The dataset breakdown shows
every numerator, denominator, ratio, and weight.

A modality requires results on every constituent dataset. Missing data is never
zero-filled or silently reweighted. A full total requires all six modalities;
incomplete models show a separately labeled partial average over their complete
modalities, plus coverage. Missing spokes stay missing in the web plot. Partial
averages are comparable only for matching modality coverage. The GPT-5.6 Sol
ID spelling in the Action export is joined explicitly; different model versions
and LEMON video inference versus LemonFM linear probes remain separate.

The build runs `scripts/validate-summary.ts` to check the weighting, missing-data
handling, aliases, and all specialist denominators against the actual result files.

## How deployment works

**Every push to `main` deploys the site.** A GitHub Actions workflow
(`.github/workflows/deploy.yml`) runs `npm ci && npm run build` and publishes
`dist/` to GitHub Pages. Deploys finish in about a minute; check the Actions
tab if a change does not show up.

There is no other deploy step. If the build fails (including a malformed
`results.json` — see below), the site simply keeps its previous version.

## Where the numbers live

Instrument scores remain in `src/data/results.json`. Gesture scores live in
`src/data/gestureResults.json`. Both files have strict build-time validators:
unknown keys, missing metrics, or a wrong `schemaVersion` fail the build rather
than rendering a broken chart.

Normally you should not edit it by hand: the eval backend runs a model against
the benchmarks and pushes a commit that updates `results.json` (and, for a new
model family, its logo). Hand-editing is for corrections, retractions, or
importing results computed elsewhere.

The gesture pilot is currently imported from the normalized evaluation
artifacts rather than written by the still-frame instrument runner. This keeps
the existing automated instrument publishing contract unchanged.

## Updating the gesture pilot

1. Recompute each model's normalized evaluation artifact against the shared
   continuous-case timeline.
2. Copy the rounded exact frame accuracy, macro F1, and weighted F1 values into
   `src/data/gestureResults.json`, preserving the source run id.
3. Update the benchmark metadata if the procedure set, timeline, class
   vocabulary, or denominator changes.
4. Run `npm run build`; the gesture validator rejects schema drift, duplicate
   model ids, out-of-range values, and accidental inclusion of MViT.

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
