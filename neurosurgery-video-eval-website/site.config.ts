/** One deployment URL controls asset paths, canonical URLs, sitemap, and robots. */
const url = new URL(process.env.SITE_URL ?? "https://skblv.github.io/neurosurgery-video-eval-website/");
if (!['https:', 'http:'].includes(url.protocol) || url.search || url.hash || url.username || url.password) {
  throw new Error("SITE_URL must be an absolute HTTP(S) URL without credentials, query, or fragment");
}
url.pathname = `${url.pathname.replace(/\/+$/, '')}/`;
export const SITE_URL = url.href;
export const SITE_BASE = url.pathname;
