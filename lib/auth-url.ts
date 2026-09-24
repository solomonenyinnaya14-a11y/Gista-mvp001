export const GISTA_APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://gista-mvp001.vercel.app";

export function authCallbackUrl(next = "/") {
  return GISTA_APP_URL + "/auth/callback?next=" + encodeURIComponent(next);
}
