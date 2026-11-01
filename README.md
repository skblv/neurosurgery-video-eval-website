# sdsc-benchmark

Combined repository for the neurosurgery video evaluation website.

- [`neurosurgery-video-eval-website`](neurosurgery-video-eval-website/) — frontend
- [`neurosurgery-video-eval-website-backend`](neurosurgery-video-eval-website-backend/) — backend

Both projects were imported with `git subtree` from their upstream repos
(https://github.com/skblv/neurosurgery-video-eval-website and
https://github.com/skblv/neurosurgery-video-eval-website-backend), preserving full history.

The frontend deploys to GitHub Pages at https://eval.surgicalvideo.io via
`.github/workflows/deploy-pages.yml`: any push to `main` touching
`neurosurgery-video-eval-website/**` rebuilds and redeploys automatically.
There is no manual deploy step.

## Git workflow: main only

Use `main` for all work in this repository. Do not create feature branches,
temporary branches, pull-request branches, or branch-based worktrees. Make and
verify changes on `main`, then commit and push directly to `origin/main` when
authorized. The repository instructions are in [AGENTS.md](AGENTS.md).

If GitHub rejects a direct push, report the rejection; do not create a branch
as a workaround or bypass repository protections.

## Pulling in upstream changes

Requirements: write access to this repo and `node`. Run from the repo root on
`main`:

```bash
git switch main
git pull --ff-only origin main
git subtree pull --prefix=neurosurgery-video-eval-website https://github.com/skblv/neurosurgery-video-eval-website.git main
git subtree pull --prefix=neurosurgery-video-eval-website-backend https://github.com/skblv/neurosurgery-video-eval-website-backend.git main
cd neurosurgery-video-eval-website && npm ci && npm run build && cd ..
git push origin main
```

Notes:

- If a subtree pull says "Already up to date", proceed with whatever the
  other one pulled; if both are up to date, stop — there is nothing to push.
- Do not skip `npm run build`: it runs the results-data validators, catching
  a malformed upstream `results.json` before pushing instead of in CI.
- Merge conflicts only occur if files inside a subtree folder were edited
  directly in this repo; resolve like any merge, `git commit`, and continue.
- After the push to `main`, the Pages deploy runs on its own.
