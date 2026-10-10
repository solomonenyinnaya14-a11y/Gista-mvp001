import { safeInternalPath } from "./safe-redirect";

const PRODUCTION_APP_URL = "https://gista-mvp1.vercel.app";

export const GISTA_APP_URL = process.env.NEXT_PUBLIC_APP_URL || PRODUCTION_APP_URL;

export function authCallbackUrl(next = "/") {
  const safeNext = safeInternalPath(next);
  const origin = typeof window !== "undefined" ? window.location.origin : GISTA_APP_URL;
  return origin + "/auth/callback?next=" + encodeURIComponent(safeNext);
}
