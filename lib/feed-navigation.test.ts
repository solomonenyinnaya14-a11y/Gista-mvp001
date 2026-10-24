import assert from "node:assert/strict";
import { test } from "node:test";
import { isExplicitBrowserReload } from "./feed-navigation.ts";

test("a real browser reload is recognized", () => {
  assert.equal(isExplicitBrowserReload({ type: "reload" }, 1), true);
});

test("Back/Forward navigation never becomes a reload because of stale legacy data", () => {
  assert.equal(isExplicitBrowserReload({ type: "back_forward" }, 1), false);
});

test("ordinary navigation never becomes a reload because of legacy data", () => {
  assert.equal(isExplicitBrowserReload({ type: "navigate" }, 1), false);
});

test("legacy navigation type is used only when modern timing data is unavailable", () => {
  assert.equal(isExplicitBrowserReload(undefined, 1), true);
  assert.equal(isExplicitBrowserReload(null, 0), false);
});

test("an unknown modern navigation type is not treated as a reload", () => {
  assert.equal(isExplicitBrowserReload({ type: "unknown" }, 1), false);
});
