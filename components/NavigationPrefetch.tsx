"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const PRIMARY_ROUTES = ["/", "/profile", "/search", "/notifications", "/create"];

export default function NavigationPrefetch() {
  const router = useRouter();

  useEffect(() => {
    const timer = window.setTimeout(() => {
      PRIMARY_ROUTES.forEach((route) => router.prefetch(route));
    }, 250);

    return () => window.clearTimeout(timer);
  }, [router]);

  return null;
}
