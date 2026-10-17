"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Theme = "light" | "dark" | "system";

type ThemeContextValue = {
  theme: Theme;
  resolvedTheme: "light" | "dark";
  setTheme: (theme: Theme) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);
const LEGACY_STORAGE_KEY = "gista-theme";
const ANONYMOUS_STORAGE_KEY = "gista-theme:anonymous";

function isTheme(value: unknown): value is Theme {
  return value === "light" || value === "dark" || value === "system";
}

function storageKey(userId: string | null) {
  return userId ? `gista-theme:${userId}` : ANONYMOUS_STORAGE_KEY;
}

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Gista's default/system appearance is intentionally Light.
  const [theme, setThemeState] = useState<Theme>("light");
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">("light");
  const [userId, setUserId] = useState<string | null>(null);
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    let active = true;

    async function loadUserTheme(nextUserId: string | null) {
      if (!active) return;
      setUserId(nextUserId);

      if (!nextUserId) {
        let anonymousTheme: Theme = "light";
        try {
          const saved = window.localStorage.getItem(ANONYMOUS_STORAGE_KEY);
          if (isTheme(saved)) anonymousTheme = saved;
          else {
            // Migrate the old device-only preference for signed-out visitors.
            const legacy = window.localStorage.getItem(LEGACY_STORAGE_KEY);
            if (isTheme(legacy)) anonymousTheme = legacy;
          }
        } catch {}
        if (active) setThemeState(anonymousTheme);
        return;
      }

      // A per-account local cache makes the chosen theme available immediately.
      let cachedTheme: Theme | null = null;
      try {
        const cached = window.localStorage.getItem(storageKey(nextUserId));
        if (isTheme(cached)) cachedTheme = cached;
      } catch {}
      if (cachedTheme && active) setThemeState(cachedTheme);

      // The account's database preference is canonical and follows them to other devices.
      const { data, error } = await supabase
        .from("profiles")
        .select("theme_preference")
        .eq("id", nextUserId)
        .maybeSingle();

      if (!active) return;
      const storedTheme = !error && isTheme(data?.theme_preference) ? data.theme_preference : null;
      const finalTheme = storedTheme ?? cachedTheme ?? "light";
      setThemeState(finalTheme);
      try {
        window.localStorage.setItem(storageKey(nextUserId), finalTheme);
      } catch {}
    }

    void supabase.auth.getSession().then(({ data: { session } }) => {
      void loadUserTheme(session?.user.id ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      // Defer database access until Supabase has released its auth-state lock.
      window.setTimeout(() => void loadUserTheme(session?.user.id ?? null), 0);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    // System Default is intentionally Light for Gista, regardless of device appearance.
    const next = theme === "dark" ? "dark" : "light";
    document.documentElement.dataset.theme = next;
    document.documentElement.style.colorScheme = next;
    setResolvedTheme(next);
  }, [theme]);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    try {
      window.localStorage.setItem(storageKey(userId), next);
    } catch {}

    if (userId) {
      void supabase
        .from("profiles")
        .update({ theme_preference: next })
        .eq("id", userId);
    }
  }, [supabase, userId]);

  const value = useMemo(() => ({ theme, resolvedTheme, setTheme }), [theme, resolvedTheme, setTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used inside ThemeProvider");
  return context;
}
