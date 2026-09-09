import assert from "node:assert/strict";
import { test } from "node:test";
import { ROUTES } from "../src/data/domains.ts";
import { legacyRouteFromHash, PAGE_SEO, routeFromPath, routePath } from "../src/data/routes.ts";

test("real URLs round-trip at a custom-domain root and a GitHub Pages project path", () => {
  for (const base of ["/", "/neurosurgery-video-eval-website/"]) {
    for (const route of ROUTES) {
      const path = routePath(route, base);
      assert.equal(routeFromPath(path, base), route);
      assert.equal(routeFromPath(path.slice(0, -1), base), route);
      assert.equal(routeFromPath(`${path}index.html`, base), route);
      assert(!path.includes("#"));
      assert(PAGE_SEO[route].title && PAGE_SEO[route].description);
    }
    assert.equal(routeFromPath(`${base}not-a-page/`, base), null);
    assert.equal(routeFromPath(`${base}anatomy/extra/`, base), null);
  }
  assert.equal(routeFromPath("/anatomy/", "/project/"), null);
});

test("legacy hash routes map to their replacement, without hijacking document anchors", () => {
  for (const route of ROUTES) {
    assert.equal(legacyRouteFromHash(`#/${route}`), route);
    assert.equal(legacyRouteFromHash(`#/${route}/`), route);
  }
  assert.equal(legacyRouteFromHash("#/overview"), "summary");
  for (const anchor of ["", "#about-heading", "#main-content", "#/missing", "#//evil.example"]) {
    assert.equal(legacyRouteFromHash(anchor), null);
  }
});
