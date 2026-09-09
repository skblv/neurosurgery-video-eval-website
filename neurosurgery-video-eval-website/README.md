# Surgical intelligence leaderboard

Static SDSC × Chicago Booth benchmark site for the capabilities that make up
surgical intelligence. The published instrument benchmark is joined by a
single-procedure continuous gesture pilot, with domain pages reserved for the
next benchmark families.

## Site structure

- `/` — summary leaderboard and modality-balanced model comparison.
- `/instruments/` — CholecT50, PitVis-2023, and SurgVU results.
- `/gestures/` — the continuous-operation gesture comparison.
- `/anatomy/`, `/clinical-context/`, `/recommendations/`, and `/skill-assessment/`
  — the corresponding domain benchmarks.

Paths are relative to the deployment root (currently
`https://skblv.github.io/neurosurgery-video-eval-website/`). Navigation uses
ordinary links, so direct visits, refresh, and browser history work without a
client-side router. Old `#/instruments`-style links redirect to their real URLs;
`/summary/` redirects to the homepage.

## Prerendering and search indexing

`npm run build` builds the browser bundle and a build-only React renderer, then
generates actual HTML for every route. The initial response includes the page
copy, default-dataset scores, tables, and static charts; React hydrates it to
enable dataset/metric controls and the model picker. No server runtime is needed.
Only `dist/` is deployed; `dist-ssr/` is a local build artifact.

The same route definitions generate unique titles/descriptions, canonical and
social URLs, `sitemap.xml`, an allow-all `robots.txt`, and a noindex `404.html`.
The build tests each route for readable content, correct links, and existing
assets. Run `node --experimental-strip-types --test scripts/routes.test.ts`
for URL/legacy-link tests. Browser regression scripts accept a local base URL.
For example, after `npm run preview`, run
`node scripts/routes.browser.mjs http://localhost:4173/neurosurgery-video-eval-website/`
and `node scripts/model-picker.browser.mjs http://localhost:4173/neurosurgery-video-eval-website/`.
Both use `agent-browser` on PATH (or the executable in `AGENT_BROWSER_CLI`).

`site.config.ts` is the single deployment URL source. For a custom domain, build
with `SITE_URL=https://your-domain.example/ npm run build`; for a project site,
include its trailing-slash path. `npm run dev` uses `/` locally; `npm run preview`
serves the production path.

**GitHub Pages indexing caveat:** Google reads `robots.txt` only at the domain
root, not inside a project path. This build supplies the file for root/custom
domain hosting too, but cannot change `https://skblv.github.io/robots.txt` from
this project. That root currently returns 404 (no crawling restrictions). Submit
the project's absolute sitemap URL in Google Search Console to help discovery;
there is no guarantee of indexing or a particular ranking.

## How deployment works

For the collaborators' later custom-domain deployment, follow the
[deployment handoff](docs/deployment-handoff.md). It covers the required
build-time URL setting, publishing the complete generated site, live checks,
and Google Search Console setup without changing the current deployment.

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

## Importing completed gap evaluations

The summary index uses `(model − chance) / (specialist − chance)` per dataset,
then equal weights over available datasets within each modality and available
modalities overall. Chance is the exact expected metric under uniformly random
permutations of the frozen validation ground-truth label sets (including fixed
points), preserving the observed class frequencies and label-set cardinalities.
For micro-F1 it is `100 × Σ label_count² / (N × total_positive_labels)`; for
exact match it is `100 × Σ label_set_count² / N²`. Baselines are percentages,
like the stored raw metrics. No Monte Carlo draws or additional model calls are
needed. Negative scores and values above one are retained.

`scripts/export-chance-baselines.py` exports aggregate counts and source/sample
hashes from existing contracts into `src/data/chanceBaselines.json`. It must run
on a CPU compute allocation, not a Pythia login node. Baseline tests compare the
analytic formula with every permutation of small examples and verify the real
sample hashes. The old continuous-operation Action pilot lacks verified label
counts, so it is NA/excluded from this adjusted index; its raw Action-page
metrics remain unchanged. Missing baselines are never silently treated as zero.

Completed fixed-contract gap runs can be imported with
`node --experimental-strip-types scripts/import-completed.ts EXPORT.json --apply`.
The backend exporter first recomputes metrics from the frozen cached sample;
the importer rejects incomplete denominators and updates only matching
model/dataset rows, retaining source-run IDs and reproducibility hashes in
`completedEvalProvenance.json`. Omit `--apply` for a validation-only preview.

Grok 4.6 and Qwen3.8 Max 0902 each have ten verified, imported datasets,
including all three instrument datasets. Their holds have been released for tables, charts,
summary scores, and model pickers. Action was not evaluated and remains NA.
The historical `qwen3-8-max` instrument rows retain their original identity and
source IDs; they are not relabelled as 0902 evaluations. That older model's
remaining runs were blocked by API availability, so only its publication hold
remains in `src/data/leaderboardVisibility.ts`. The normal NA policy remains
unchanged for missing scores. Tests verify imported denominators, metrics,
provenance, and visibility in prerendered pages.

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
