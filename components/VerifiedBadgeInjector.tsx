"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

function addBadge(target: Element, color: string) {
  if (target.querySelector(":scope > [data-gista-verified-badge]")) return;

  const badge = document.createElement("span");
  badge.dataset.gistaVerifiedBadge = "true";
  badge.setAttribute("title", "Verified account");
  badge.setAttribute("aria-label", "Verified account");
  badge.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M12 3.5l1.55 1.12 1.91-.06.73 1.77 1.65.96-.52 1.84.52 1.84-1.65.96-.73 1.77-1.91-.06L12 20.5l-1.55-1.12-1.91.06-.73-1.77-1.65-.96.52-1.84-.52-1.84 1.65-.96.73-1.77 1.91.06L12 3.5Z" fill="currentColor"/><path d="m8.8 12.1 2.05 2.05 4.35-4.35" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  badge.style.cssText = [
    "display:inline-flex",
    "align-items:center",
    "justify-content:center",
    "width:14px",
    "height:14px",
    "margin-left:4px",
    "border-radius:50%",
    `background:${color}`,
    "color:#fff",
    "font-size:0",
    "font-weight:800",
    "line-height:1",
    "vertical-align:middle",
  ].join(";");

  target.appendChild(badge);
}

export default function VerifiedBadgeInjector() {
  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();

    async function loadVerifiedAccounts() {
      const { data: verified } = await supabase
        .from("verified_profiles")
        .select("profile_id,badge_color");

      if (cancelled || !verified?.length) return;

      const ids = verified.map((item) => item.profile_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id,username")
        .in("id", ids);

      if (cancelled) return;

      const verifiedByUsername = new Map<string, string>();
      const colorsById = new Map(verified.map((item) => [item.profile_id, item.badge_color || "#6D28D9"]));
      (profiles ?? []).forEach((profile) => {
        if (profile.username) verifiedByUsername.set(profile.username, colorsById.get(profile.id) ?? "#6D28D9");
      });

      const apply = () => {
        verifiedByUsername.forEach((color, username) => {
          const profileLinks = document.querySelectorAll(`a[href="/profile/${CSS.escape(username)}"] strong`);
          profileLinks.forEach((target) => addBadge(target, color));

          document.querySelectorAll(".identity:not(.notification-identity)").forEach((identity) => {
            const usernameLine = identity.querySelector(":scope > span");
            const name = identity.querySelector(":scope > strong");
            if (usernameLine?.textContent?.includes(`@${username}`) && name) addBadge(name, color);
          });

          document.querySelectorAll(".reply-content").forEach((reply) => {
            const usernameLine = reply.querySelector(":scope > span");
            const name = reply.querySelector(":scope > strong");
            if (usernameLine?.textContent?.includes(`@${username}`) && name) addBadge(name, color);
          });

          const ownProfileUsername = document.querySelector(".profile-username");
          if (ownProfileUsername?.textContent?.trim() === `@${username}`) {
            const name = ownProfileUsername.previousElementSibling;
            if (name) addBadge(name, color);
          }
        });
      };

      apply();
      const observer = new MutationObserver(() => apply());
      observer.observe(document.body, { childList: true, subtree: true });
      return () => observer.disconnect();
    }

    let cleanup: (() => void) | undefined;
    void loadVerifiedAccounts().then((fn) => { cleanup = fn; });
    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, []);

  return null;
}
