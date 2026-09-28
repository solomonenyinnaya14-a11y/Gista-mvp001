"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const PRIMARY_ROUTES = ["/", "/profile", "/search", "/notifications", "/create"];

export default function NavigationPrefetch() {
  const router = useRouter();

  useEffect(() => {
    // Warm the primary social-navigation routes immediately after hydration.
    // Waiting here made a fast tap on iPhone race the prefetch timer.
    PRIMARY_ROUTES.forEach((route) => router.prefetch(route));
  }, [router]);

  return null;
}
