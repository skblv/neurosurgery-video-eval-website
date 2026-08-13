# sdsc-benchmark

Combined repository for the neurosurgery video evaluation website.

- [`neurosurgery-video-eval-website`](neurosurgery-video-eval-website/) — frontend
- [`neurosurgery-video-eval-website-backend`](neurosurgery-video-eval-website-backend/) — backend

Both projects were imported with `git subtree` from their upstream repos
(https://github.com/skblv/neurosurgery-video-eval-website and
https://github.com/skblv/neurosurgery-video-eval-website-backend), preserving full history.

To pull in upstream changes:

```bash
git subtree pull --prefix=neurosurgery-video-eval-website https://github.com/skblv/neurosurgery-video-eval-website.git main
git subtree pull --prefix=neurosurgery-video-eval-website-backend https://github.com/skblv/neurosurgery-video-eval-website-backend.git main
```
