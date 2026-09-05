# sdsc-benchmark

Combined repository for the neurosurgery video evaluation website.

- [`neurosurgery-video-eval-website`](neurosurgery-video-eval-website/) — frontend
- [`neurosurgery-video-eval-website-backend`](neurosurgery-video-eval-website-backend/) — backend

Both projects were imported with `git subtree` from their upstream repos
(https://github.com/skblv/neurosurgery-video-eval-website and
https://github.com/skblv/neurosurgery-video-eval-website-backend), preserving full history.

The frontend deploys to GitHub Pages at https://eval.surgicalvideo.io via
`.github/workflows/deploy-pages.yml`: any merge to `main` touching
`neurosurgery-video-eval-website/**` rebuilds and redeploys automatically.
There is no manual deploy step.

## Pulling in upstream changes

`main` is protected: changes go through a pull request with an approving
review from a code owner (see `.github/CODEOWNERS`). Requirements: write
access to this repo, `node`, and the [`gh` CLI](https://cli.github.com)
(authenticated via `gh auth login`). Run from the repo root:

```bash
git checkout main && git pull origin main
git checkout -b subtree-sync-$(date +%Y-%m-%d)
git subtree pull --prefix=neurosurgery-video-eval-website https://github.com/skblv/neurosurgery-video-eval-website.git main
git subtree pull --prefix=neurosurgery-video-eval-website-backend https://github.com/skblv/neurosurgery-video-eval-website-backend.git main
cd neurosurgery-video-eval-website && npm ci && npm run build && cd ..
git push -u origin HEAD
gh pr create --base main --title "Sync subtrees with upstream" --body "Pulls latest upstream commits via git subtree pull. Build verified locally."
```

Notes:

- If a subtree pull says "Already up to date", proceed with whatever the
  other one pulled; if both are up to date, stop — there is nothing to PR.
- Do not skip `npm run build`: it runs the results-data validators, catching
  a malformed upstream `results.json` before the PR instead of in CI.
- Merge conflicts only occur if files inside a subtree folder were edited
  directly in this repo; resolve like any merge, `git commit`, and continue.
- After the PR is approved and merged, the Pages deploy runs on its own.
