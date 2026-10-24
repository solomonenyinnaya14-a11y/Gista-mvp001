"use client";

import { useEffect } from "react";
import { LONG_AWAY_REFRESH_EVENT, LONG_AWAY_REFRESH_PENDING_KEY, LONG_AWAY_REFRESH_THRESHOLD_MS, LAST_HIDDEN_AT_KEY } from "@/lib/feed-session";

// This component lives in the root layout so the timer survives navigation
// between Home, Profile, Settings, Notifications, and post pages.
export default function FeedSessionTracker() {
  useEffect(() => {
    const storage = () => {
      try { return window.sessionStorage; } catch { return null; }
    };
    const onVisibilityChange = () => {
      const session = storage();
      if (!session) return;
      if (document.visibilityState === "hidden") {
        try { session.setItem(LAST_HIDDEN_AT_KEY, String(Date.now())); } catch {}
        return;
      }
      if (document.visibilityState !== "visible") return;
      try {
        const hiddenAt = Number(session.getItem(LAST_HIDDEN_AT_KEY));
        session.removeItem(LAST_HIDDEN_AT_KEY);
        if (Number.isFinite(hiddenAt) && hiddenAt > 0 && Date.now() - hiddenAt >= LONG_AWAY_REFRESH_THRESHOLD_MS) {
          session.setItem(LONG_AWAY_REFRESH_PENDING_KEY, "1");
          window.dispatchEvent(new Event(LONG_AWAY_REFRESH_EVENT));
        }
      } catch {}
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, []);
  return null;
}
