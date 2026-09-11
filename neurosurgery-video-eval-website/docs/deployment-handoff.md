# Collaborator deployment handoff

Deploy the latest source from [this repository's `main` branch](https://github.com/skblv/neurosurgery-video-eval-website/tree/main)
to `https://eval.surgicalvideo.io/` when the team is ready. This guide does not
change DNS, the existing domain assignment, or the current GitHub Pages site.

**Pulling the source is not sufficient: rebuild for the destination URL and
publish the complete generated `dist/` directory.**

## 1. Sync the source

Pull or merge the latest upstream `main` into your deployment checkout using your
normal review process. Preserve your deployment repository's CI configuration
and hosting settings; do not overwrite unrelated changes. Use Node.js 22 (as in
the included workflow) and install dependencies from the committed lockfile.

The source includes real page URLs, prerendered HTML, a sitemap, robots rules,
canonical URLs, and social metadata. No evaluation credentials or backend jobs
are needed to build this public website.

## 2. Build for the custom domain

Run from the repository root on macOS, Linux, or a GitHub Actions runner:

```sh
npm ci
SITE_URL=https://eval.surgicalvideo.io/ npm run build
SITE_URL=https://eval.surgicalvideo.io/ node --experimental-strip-types --test scripts/*.test.ts
npm run lint
```

`SITE_URL` is a **build-time environment variable**, including `https://` and
the trailing slash. It controls asset paths, canonical URLs, social URLs, the
sitemap, and the sitemap address in robots.txt. Do not change the upstream
default in `site.config.ts`: that default keeps the current GitHub project site
working. Do not rely on a `.env` file for this setting; pass it into the process.

In your deployment pipeline, supply the same variable to the build. If you use
the included `.github/workflows/deploy.yml`, change its build step **in your
deployment copy** to:

```yaml
      - run: npm run build
        env:
          SITE_URL: https://eval.surgicalvideo.io/
```

Preserve this deployment-specific setting when syncing future upstream changes.
Setting a GitHub repository variable alone does not affect the current workflow;
it must be explicitly mapped into the build's environment. The explicit value
above needs no repository variable or secret. If adding a separate regression
test step to CI, give it the same `SITE_URL` as the build.

Optional local preview of that build:

```sh
SITE_URL=https://eval.surgicalvideo.io/ npm run preview
```

Open the localhost address printed by Vite. This does not deploy to the domain.

## 3. Publish the generated files

- Publish the **contents of `dist/` at the domain root**, including `assets/`,
  every route directory, `robots.txt`, `sitemap.xml`, `404.html`, and `.nojekyll`.
- Do not publish the source `index.html`, only the JavaScript bundle, or
  `dist-ssr/`. The source HTML is intentionally an empty template; `dist-ssr/`
  is a build-only renderer. No Node server is required in production.
- For GitHub Actions-based Pages deployment, the included workflow already
  uploads `dist/`. Confirm the destination repository uses GitHub Actions as its
  Pages source, the workflow tracks your deployment branch, and any environment
  approval requirements are satisfied.
- Have the domain owner confirm the existing destination repository's Pages
  settings use `eval.surgicalvideo.io` and HTTPS. Do not move the hostname or
  replace DNS records just to update the website's files. Custom Actions-based
  Pages deployments do not require a committed `CNAME` file. See
  [GitHub's custom-domain instructions](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site).

Wait for the deployment job to succeed before checking the public site. Keep
the previous deployed revision recorded so the team can redeploy it if needed.

## 4. Verify the live deployment

These are acceptance checks for the collaborators to run after deployment, not
a statement that the custom domain has already been updated.

| Check | Expected result |
| --- | --- |
| `/` | HTTP 200; the current summary table and both index plots |
| `/instruments/`, `/gestures/`, `/anatomy/`, `/skill-assessment/`, `/clinical-context/`, `/recommendations/` | Each returns HTTP 200 when opened directly and refreshed |
| View page source | Contains the leaderboard table and `data-prerendered="true"`, not just an empty root element |
| Canonical and social URL metadata | Uses `https://eval.surgicalvideo.io/` plus the correct page path, not the GitHub project address |
| `/robots.txt` | HTTP 200, plain text, with the contents shown below |
| `/sitemap.xml` | HTTP 200, XML, with all seven canonical page URLs on the custom domain |
| A nonexistent path | HTTP 404, not a successful response containing the homepage |
| Browser interactions | Table sorting, dataset selection, model search/add/remove, and copy controls work; assets load on nested pages |

Expected `robots.txt`:

```text
User-agent: *
Allow: /

Sitemap: https://eval.surgicalvideo.io/sitemap.xml
```

On the current GitHub project site, the generated robots.txt sits below a
repository path and is not used as the host's robots file. On a custom domain
deployed at `/`, it is in the correct root location. A missing robots.txt (404)
does not itself block Google from crawling. See
[Google's robots.txt rules](https://developers.google.com/crawling/docs/robots-txt/robots-txt-spec).

If assets or canonical URLs still point to the GitHub project, rebuild with the
correct `SITE_URL`; editing only sitemap.xml will not fix the other generated
URLs. If nested routes return 404 or page source is empty, check that the full
prerendered `dist/` output, rather than the source template or an old artifact,
was deployed.

## 5. Set up Google Search Console

1. Add or select the URL-prefix property `https://eval.surgicalvideo.io/` and
   complete an ownership-verification method offered by Search Console. Coordinate
   DNS verification with the domain owner if needed. If using Google's HTML-file
   verification, put the exact supplied file in `public/`, rebuild and redeploy,
   and keep the verification file in subsequent deployments. See
   [Google's ownership-verification guide](https://support.google.com/webmasters/answer/9008080).
2. In **Sitemaps**, submit `https://eval.surgicalvideo.io/sitemap.xml`.
3. Inspect the homepage and the six modality pages using **URL Inspection**.
   Check live accessibility and rendered content; request indexing after the
   deployment checks pass. Review Google's selected canonical when indexed data
   becomes available.
4. Use **Page indexing** and **Performance** reports to distinguish unindexed
   pages from indexed pages receiving few impressions. A successful sitemap
   submission does not guarantee indexing or rankings. See
   [Google's sitemap guidance](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap)
   and [recrawl guidance](https://developers.google.com/search/docs/crawling-indexing/ask-google-to-recrawl).

When the custom domain is ready to become the primary public address, coordinate
links and canonical/redirect handling for the old GitHub site as a separate
cutover step. Publishing to a different repository does not automatically update
or redirect the upstream GitHub project site. Leave that deployment unchanged
until the team agrees on the migration.
