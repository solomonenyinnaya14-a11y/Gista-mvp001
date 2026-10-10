// Validates a user-supplied "where to go next" value (e.g. ?next= or ?returnTo=).
// Only same-site paths are allowed; anything external or malformed falls back.
//
// Why a string check is not enough: browsers treat "/\evil.example" and
// "/<TAB>/evil.example" as "//evil.example" (a different website), and
// "/.//evil.example" collapses to "//evil.example". So we let the URL parser
// resolve the value and check that it never leaves the origin it was resolved against.
//
// We resolve against TWO different dummy origins. A genuinely relative path stays on
// whichever origin it is resolved against and yields the same result both times. A value
// that names another host (even one of our own dummy hosts) ends up on a host that
// matches at most one of the two bases, so it is rejected.
const BASE_A = "http://gista-a.invalid";
const BASE_B = "http://gista-b.invalid";

function resolveOnBase(value: string, base: string): string | null {
  const resolved = new URL(value, base);
  if (resolved.origin !== base) return null;
  return resolved.pathname + resolved.search + resolved.hash;
}

export function safeInternalPath(value: string | null | undefined, fallback = "/"): string {
  if (typeof value !== "string" || !value.startsWith("/")) return fallback;
  try {
    const pathA = resolveOnBase(value, BASE_A);
    const pathB = resolveOnBase(value, BASE_B);
    if (pathA === null || pathB === null || pathA !== pathB) return fallback;
    // A path starting with "//" would be read as another website when used in a redirect.
    if (pathA.startsWith("//")) return fallback;
    return pathA;
  } catch {
    return fallback;
  }
}
