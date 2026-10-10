// Per-user feed cache stored in sessionStorage.
// Every entry is keyed by the signed-in user's id, so one account can never read
// another account's cached feed (which includes that account's liked/saved flags
// and any private-account posts it was allowed to see).
export const FEED_CACHE_PREFIX = "gista:feed:";
export const FEED_CACHE_MAX_AGE_MS = 10 * 60 * 1000;

export type FeedCacheStorage = Pick<Storage, "getItem" | "setItem" | "removeItem" | "key" | "length">;

export function feedCacheKey(userId: string, tab: string) {
  return `${FEED_CACHE_PREFIX}${userId}:${tab}`;
}

export function browserStorage(): FeedCacheStorage | null {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

export function readFeedCache<T>(
  storage: FeedCacheStorage | null,
  userId: string,
  tab: string,
  now = Date.now(),
  maxAgeMs = FEED_CACHE_MAX_AGE_MS,
): T[] | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(feedCacheKey(userId, tab));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { savedAt?: unknown; posts?: unknown };
    if (typeof parsed.savedAt !== "number" || !Array.isArray(parsed.posts)) return null;
    if (now - parsed.savedAt >= maxAgeMs) return null;
    return parsed.posts as T[];
  } catch {
    return null;
  }
}

export function writeFeedCache<T>(
  storage: FeedCacheStorage | null,
  userId: string,
  tab: string,
  posts: T[],
  now = Date.now(),
) {
  if (!storage) return;
  try {
    storage.setItem(feedCacheKey(userId, tab), JSON.stringify({ savedAt: now, posts }));
  } catch {
    // Storage can be full or blocked; the feed simply loads fresh next time.
  }
}

// Removes cached feeds. With no keepUserId (logout) everything is removed; with a
// keepUserId (login / account switch) only that user's own entries survive. This also
// removes old-format keys ("gista:feed:Discover") written before entries were per-user.
export function clearFeedCache(storage: FeedCacheStorage | null, keepUserId?: string | null) {
  if (!storage) return;
  try {
    const keepPrefix = keepUserId ? `${FEED_CACHE_PREFIX}${keepUserId}:` : null;
    const doomed: string[] = [];
    for (let i = 0; i < storage.length; i += 1) {
      const key = storage.key(i);
      if (key && key.startsWith(FEED_CACHE_PREFIX) && !(keepPrefix && key.startsWith(keepPrefix))) doomed.push(key);
    }
    doomed.forEach((key) => storage.removeItem(key));
  } catch {
    // Nothing else to do if storage is unavailable.
  }
}
