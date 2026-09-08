import assert from "node:assert/strict";
import { test } from "node:test";
import { matchesModelSearch } from "../src/data/modelSearch.ts";

test("model search matches case-insensitive substrings and multiple terms", () => {
  for (const name of ["Claude Fable 5.1", "Claude Fable 5", "Claude Fable 5.0"]) {
    for (const query of ["cla", "F", "5", "cla f 5", "cla...", "f..", ""]) {
      assert(matchesModelSearch(name, query), `${name}: ${query}`);
    }
  }
  assert(!matchesModelSearch("Gemini 3 Flash", "cla f 5"));
  assert(!matchesModelSearch("Claude Fable 5", "5.1"));
});
