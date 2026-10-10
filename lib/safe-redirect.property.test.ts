import assert from "node:assert/strict";
import { test } from "node:test";
import { safeInternalPath } from "./safe-redirect.ts";

// Randomized (property-style) tests with no extra dependencies. The generator is seeded,
// so every run produces the same inputs and any failure is reproducible.
const SITE = "https://gista-mvp1.vercel.app";
const RUNS = 20_000;

function makeRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

const HOSTILE_TOKENS = [
  "/", "/", "/", "\\", ".", "..", "%", "%5C", "%2F", "%09", "\t", "\n", "\r", " ", "?", "#", "@", ":",
  "a", "post", "evil.example", "gista-a.invalid", "gista-b.invalid", "gista.internal",
  "http:", "https:", "javascript:", "\u0000", "∕", "／", "é",
];

function randomHostileString(random: () => number) {
  let value = random() < 0.8 ? "/" : "";
  const parts = 1 + Math.floor(random() * 7);
  for (let i = 0; i < parts; i += 1) value += HOSTILE_TOKENS[Math.floor(random() * HOSTILE_TOKENS.length)];
  return value;
}

test("property: for any input the result is a safe on-site path", () => {
  const random = makeRandom(20261010);
  for (let i = 0; i < RUNS; i += 1) {
    const input = randomHostileString(random);
    const result = safeInternalPath(input);
    const context = `input=${JSON.stringify(input)} result=${JSON.stringify(result)}`;

    assert.ok(result.startsWith("/"), `must start with "/": ${context}`);
    assert.ok(!result.startsWith("//"), `must not start with "//": ${context}`);
    assert.equal(new URL(result, SITE).origin, SITE, `must stay on the site: ${context}`);
    const pathPart = result.split(/[?#]/)[0];
    assert.ok(!/[\\\u0000-\u001f]/.test(pathPart), `no backslash/control character in the path: ${context}`);
    assert.equal(safeInternalPath(result), result, `must be idempotent: ${context}`);
  }
});

test("property: host-bearing destinations are always rejected", () => {
  const random = makeRandom(77);
  const separators = ["//", "/\\", "/\t/", "/\n/", "/\r/", "/.//", "/..//", "/\\/", "///"];
  const hosts = ["evil.example", "gista-a.invalid", "gista-b.invalid", "gista.internal", "gista-mvp1.vercel.app"];
  const tails = ["", "/", "/evil", "/post/1?x=1#y", "?next=/", "#frag"];
  for (let i = 0; i < RUNS / 4; i += 1) {
    const separator = separators[Math.floor(random() * separators.length)];
    const host = hosts[Math.floor(random() * hosts.length)];
    const tail = tails[Math.floor(random() * tails.length)];
    const input = separator + host + tail;
    assert.equal(safeInternalPath(input), "/", `input=${JSON.stringify(input)}`);
  }
});

test("property: ordinary internal paths come back unchanged", () => {
  const random = makeRandom(4242);
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789-_~";
  const word = () => {
    const length = 1 + Math.floor(random() * 10);
    let out = "";
    for (let i = 0; i < length; i += 1) out += alphabet[Math.floor(random() * alphabet.length)];
    return out;
  };
  for (let i = 0; i < RUNS / 4; i += 1) {
    const segments = Array.from({ length: Math.floor(random() * 4) }, word);
    let input = "/" + segments.join("/");
    if (random() < 0.4) input += `?${word()}=${word()}`;
    if (random() < 0.3) input += `#${word()}`;
    assert.equal(safeInternalPath(input), input, `input=${JSON.stringify(input)}`);
  }
});
