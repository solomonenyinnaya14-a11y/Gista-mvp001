import assert from "node:assert/strict";
import { test } from "node:test";
import {
  FEED_CACHE_MAX_AGE_MS,
  clearFeedCache,
  feedCacheKey,
  readFeedCache,
  writeFeedCache,
  type FeedCacheStorage,
} from "./feed-cache.ts";

// Minimal in-memory stand-in for sessionStorage.
function fakeStorage(): FeedCacheStorage & { keys(): string[] } {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    key: (index: number) => Array.from(map.keys())[index] ?? null,
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    removeItem: (key: string) => void map.delete(key),
    keys: () => Array.from(map.keys()),
  };
}

const postA = { id: "post-a", liked: true };
const postB = { id: "post-b", liked: false };

test("an account never reads another account's cached feed", () => {
  const storage = fakeStorage();
  writeFeedCache(storage, "user-a", "Discover", [postA]);
  assert.equal(readFeedCache(storage, "user-b", "Discover"), null);
  assert.deepEqual(readFeedCache(storage, "user-a", "Discover"), [postA]);
});

test("the cache is separate per tab", () => {
  const storage = fakeStorage();
  writeFeedCache(storage, "user-a", "Discover", [postA]);
  assert.equal(readFeedCache(storage, "user-a", "Following"), null);
});

test("entries expire after the max age (refresh behaviour preserved)", () => {
  const storage = fakeStorage();
  writeFeedCache(storage, "user-a", "Discover", [postA], 1_000);
  assert.deepEqual(readFeedCache(storage, "user-a", "Discover", 1_000 + FEED_CACHE_MAX_AGE_MS - 1), [postA]);
  assert.equal(readFeedCache(storage, "user-a", "Discover", 1_000 + FEED_CACHE_MAX_AGE_MS), null);
});

test("logout clears every cached feed", () => {
  const storage = fakeStorage();
  writeFeedCache(storage, "user-a", "Discover", [postA]);
  writeFeedCache(storage, "user-b", "Trending", [postB]);
  storage.setItem("unrelated:key", "keep me");
  clearFeedCache(storage);
  assert.deepEqual(storage.keys(), ["unrelated:key"]);
});

test("account switch clears other users' entries but keeps the current user's", () => {
  const storage = fakeStorage();
  writeFeedCache(storage, "user-a", "Discover", [postA]);
  writeFeedCache(storage, "user-b", "Discover", [postB]);
  clearFeedCache(storage, "user-b");
  assert.equal(readFeedCache(storage, "user-a", "Discover"), null);
  assert.deepEqual(readFeedCache(storage, "user-b", "Discover"), [postB]);
});

test("old-format keys without a user id are never read and are removed on clear", () => {
  const storage = fakeStorage();
  storage.setItem("gista:feed:Discover", JSON.stringify({ savedAt: Date.now(), posts: [postA] }));
  assert.equal(readFeedCache(storage, "user-b", "Discover"), null);
  clearFeedCache(storage, "user-b");
  assert.equal(storage.getItem("gista:feed:Discover"), null);
});

test("a user id that is a prefix of another does not keep the other's entries", () => {
  const storage = fakeStorage();
  writeFeedCache(storage, "abc", "Discover", [postA]);
  writeFeedCache(storage, "abcd", "Discover", [postB]);
  clearFeedCache(storage, "abc");
  assert.deepEqual(storage.keys(), [feedCacheKey("abc", "Discover")]);
});

test("corrupt or missing storage never throws", () => {
  const storage = fakeStorage();
  storage.setItem(feedCacheKey("user-a", "Discover"), "{not json");
  assert.equal(readFeedCache(storage, "user-a", "Discover"), null);
  assert.equal(readFeedCache(null, "user-a", "Discover"), null);
  assert.doesNotThrow(() => writeFeedCache(null, "user-a", "Discover", [postA]));
  assert.doesNotThrow(() => clearFeedCache(null));
});
