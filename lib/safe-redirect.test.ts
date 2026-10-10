import assert from "node:assert/strict";
import { test } from "node:test";
import { safeInternalPath } from "./safe-redirect.ts";

test("rejects a backslash after the first slash (/\\evil.example)", () => {
  assert.equal(safeInternalPath("/\\evil.example"), "/");
  assert.equal(safeInternalPath("/\\\\evil.example"), "/");
});

test("rejects protocol-relative and absolute external URLs", () => {
  assert.equal(safeInternalPath("//evil.example"), "/");
  assert.equal(safeInternalPath("https://evil.example"), "/");
  assert.equal(safeInternalPath("http://evil.example/post/1"), "/");
  assert.equal(safeInternalPath("javascript:alert(1)"), "/");
  assert.equal(safeInternalPath("evil.example"), "/");
});

test("rejects tab/newline tricks that browsers strip out of URLs", () => {
  assert.equal(safeInternalPath("/\t/evil.example"), "/");
  assert.equal(safeInternalPath("/\n/evil.example"), "/");
  assert.equal(safeInternalPath("/\r/evil.example"), "/");
});

test("rejects dot-segments that collapse into //host", () => {
  assert.equal(safeInternalPath("/.//evil.example"), "/");
  assert.equal(safeInternalPath("/..//evil.example"), "/");
});

test("rejects destinations that name the validator's own dummy hosts (edge case)", () => {
  // Earlier versions resolved against one dummy host, so naming that host turned
  // "//gista.internal/evil" into the on-site path "/evil". Any host-bearing value must be rejected.
  for (const host of ["gista-a.invalid", "gista-b.invalid", "gista.internal", "evil.example"]) {
    assert.equal(safeInternalPath(`//${host}/evil`), "/", `//${host}/evil`);
    assert.equal(safeInternalPath(`/\\${host}/evil`), "/", `/\\${host}/evil`);
    assert.equal(safeInternalPath(`/\t/${host}/evil`), "/", `/<TAB>/${host}/evil`);
    assert.equal(safeInternalPath(`/.//${host}/evil`), "/", `/.//${host}/evil`);
    assert.equal(safeInternalPath(`//${host}`), "/", `//${host}`);
  }
});

test("rejects missing, empty and non-string values", () => {
  assert.equal(safeInternalPath(null), "/");
  assert.equal(safeInternalPath(undefined), "/");
  assert.equal(safeInternalPath(""), "/");
  assert.equal(safeInternalPath(42 as unknown as string), "/");
});

test("uses the supplied fallback when a value is rejected", () => {
  assert.equal(safeInternalPath("/\\evil.example", "/auth"), "/auth");
});

test("keeps valid internal destinations unchanged", () => {
  assert.equal(safeInternalPath("/"), "/");
  assert.equal(safeInternalPath("/post/abc-123"), "/post/abc-123");
  assert.equal(safeInternalPath("/post/abc-123?comments=1"), "/post/abc-123?comments=1");
  assert.equal(safeInternalPath("/post/abc-123?dna=1#top"), "/post/abc-123?dna=1#top");
  assert.equal(safeInternalPath("/profile/some.user"), "/profile/some.user");
});

test("keeps encoded characters inside an internal path (stays on-site)", () => {
  assert.equal(safeInternalPath("/%5Cevil.example"), "/%5Cevil.example");
});
