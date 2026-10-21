"use client";

import { useEffect, useMemo, useRef } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function AnalyticsTracker() {
  const pathname = usePathname();
  const lastLoggedPath = useRef("");
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    const path = pathname || "/";
    if (path.startsWith("/admin") || path.startsWith("/auth")) return;
    if (lastLoggedPath.current === path) return;
    lastLoggedPath.current = path;

    let cancelled = false;
    void (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (cancelled || !user) return;
      const events = [{ user_id: user.id, event_name: "page_view", path, metadata: {} }];
      if (path === "/") events.push({ user_id: user.id, event_name: "feed_view", path, metadata: {} });
      const { error } = await supabase.from("analytics_events").insert(events);
      // Analytics must never interrupt or slow down the user's Gista experience.
      if (error && process.env.NODE_ENV === "development") console.debug("Gista analytics event was not recorded.");
    })();

    return () => { cancelled = true; };
  }, [pathname]);

  return null;
}
