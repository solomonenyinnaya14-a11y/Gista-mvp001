"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const PRIMARY_ROUTES = ["/", "/profile", "/search", "/notifications", "/create"];

export default function NavigationPrefetch() {
  const router = useRouter();

  useEffect(() => {
    const warm = () => PRIMARY_ROUTES.forEach((route) => router.prefetch(route));
    const idle = "requestIdleCallback" in window
      ? window.requestIdleCallback(warm, { timeout: 1200 })
      : window.setTimeout(warm, 250);

    return () => {
      if (typeof idle === "number") window.clearTimeout(idle);
      else window.cancelIdleCallback?.(idle);
    };
  }, [router]);

  return null;
}
