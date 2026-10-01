"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

type VerifiedAccount = { profile_id: string; badge_color: string; username: string };
let verifiedPromise: Promise<VerifiedAccount[]> | null = null;

function loadVerifiedAccounts(supabase: ReturnType<typeof createClient>) {
  if (!verifiedPromise) {
    verifiedPromise = supabase
      .from("verified_profiles")
      .select("profile_id,badge_color,profiles!verified_profiles_profile_id_fkey(username)")
      .then(({ data, error }) => {
        if (error || !data) return [];
        return (data as any[])
          .map((row) => ({
            profile_id: row.profile_id,
            badge_color: row.badge_color || "#6D28D9",
            username: Array.isArray(row.profiles) ? row.profiles[0]?.username : row.profiles?.username,
          }))
          .filter((row): row is VerifiedAccount => Boolean(row.username));
      });
  }
  return verifiedPromise;
}

function addBadge(target: Element, color: string) {
  if (target.querySelector(":scope > [data-gista-verified-badge]")) return;

  const badge = document.createElement("span");
  badge.dataset.gistaVerifiedBadge = "true";
  badge.setAttribute("title", "Verified account");
  badge.setAttribute("aria-label", "Verified account");
  badge.textContent = "✓";
  badge.style.cssText = [
    "display:inline-flex",
    "align-items:center",
    "justify-content:center",
    "width:13px",
    "height:13px",
    "margin-left:3px",
    "border-radius:50%",
    `background:${color}`,
    "color:#fff",
    "font-size:8px",
    "font-weight:800",
    "line-height:1",
    "vertical-align:middle",
    "flex:0 0 auto",
  ].join(";");

  target.appendChild(badge);
}

export default function VerifiedBadgeInjector() {
  useEffect(() => {
    let cancelled = false;
    let observer: MutationObserver | undefined;
    const supabase = createClient();

    const apply = (verifiedAccounts: VerifiedAccount[]) => {
      if (cancelled) return;

      const byUsername = new Map(verifiedAccounts.map((account) => [account.username, account.badge_color]));

      document.querySelectorAll("strong").forEach((name) => {
        if (name.querySelector(":scope > [data-gista-verified-badge]")) return;
        const parent = name.parentElement;
        if (!parent || parent.classList.contains("notification-identity")) return;

        const href = parent.closest("a")?.getAttribute("href") ?? "";
        const usernameLine = Array.from(parent.children).find(
          (child) => child !== name && child.tagName === "SPAN"
        )?.textContent ?? "";

        const linkedUsername = href.startsWith("/profile/") ? decodeURIComponent(href.slice(9)) : "";
        const username =
          linkedUsername ||
          (usernameLine.match(/@([A-Za-z0-9_]+)/)?.[1] ?? "");

        const color = byUsername.get(username);
        if (color) addBadge(name, color);
      });

      const ownProfileUsername = document.querySelector(".profile-username")?.textContent?.trim().replace(/^@/, "");
      if (ownProfileUsername) {
        const color = byUsername.get(ownProfileUsername);
        if (color) {
          const name = document.querySelector(".profile-username")?.previousElementSibling;
          if (name) addBadge(name, color);
        }
      }
    };

    loadVerifiedAccounts(supabase).then((accounts) => {
      if (cancelled) return;
      apply(accounts);
      observer = new MutationObserver(() => apply(accounts));
      observer.observe(document.body, { childList: true, subtree: true });
    });

    return () => {
      cancelled = true;
      observer?.disconnect();
    };
  }, []);

  return null;
}
