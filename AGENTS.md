# Repository rules

## Use only main

- Work exclusively on `main` in this repository, including its frontend and backend directories.
- Do not create feature branches, temporary branches, pull-request branches, or branch-based worktrees.
- Before editing, check the working tree, switch to `main`, fetch `origin`, and fast-forward to `origin/main`. Preserve unrelated local changes.
- Make and verify changes on `main`, commit them there, and push directly to `origin/main` when the user authorizes a push.
- Do not open a pull request as an alternative workflow. If GitHub rejects a direct push, report the rejection instead of creating another branch or bypassing repository protections.
- Keep `main` as the only local and remote branch. Do not recreate deleted branches.
- Do not force-push or discard uncommitted work unless the user explicitly requests it.

## Website changes

- The tracked frontend is in `neurosurgery-video-eval-website/`; run its npm commands from that directory.
- Pushes to `main` that change the frontend trigger the existing GitHub Pages deployment.
- Run the appropriate existing checks before pushing code changes. Documentation-only changes need a diff check, not a frontend rebuild.
