"use client";

import { Bell, Home, Plus, Search, UserRound } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type ActiveTab = "home" | "search" | "notifications" | "profile";

export default function BottomNav({ active }: { active: ActiveTab }) {
  const supabase = useMemo(() => createClient(), []);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    let activeState = true;
    async function loadUnread() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session || !activeState) return;
      const { count } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("recipient_id", session.user.id)
        .is("read_at", null);
      if (activeState) setUnread(count ?? 0);
    }
    void loadUnread();
    return () => { activeState = false; };
  }, [supabase]);

  const itemClass = (tab: ActiveTab) => tab === active ? "bottom-nav-item active" : "bottom-nav-item";

  return (
    <nav className="bottom-nav formal-bottom-nav" aria-label="Primary navigation">
      <Link href="/" className={itemClass("home")} aria-current={active === "home" ? "page" : undefined}>
        <Home size={21} strokeWidth={active === "home" ? 2.5 : 2} />
        <span>Home</span>
      </Link>
      <Link href="/search" className={itemClass("search")} aria-current={active === "search" ? "page" : undefined}>
        <Search size={21} strokeWidth={active === "search" ? 2.5 : 2} />
        <span>Search</span>
      </Link>
      <Link href="/create" className="nav-create" aria-label="Create Post">
        <Plus size={27} strokeWidth={2.4} />
      </Link>
      <Link href="/notifications" className={`${itemClass("notifications")} notification-nav`} aria-current={active === "notifications" ? "page" : undefined}>
        <Bell size={21} strokeWidth={active === "notifications" ? 2.5 : 2} />
        {unread > 0 && <span className="notification-badge">{unread > 99 ? "99+" : unread}</span>}
        <span>Notifications</span>
      </Link>
      <Link href="/profile" className={itemClass("profile")} aria-current={active === "profile" ? "page" : undefined}>
        <UserRound size={21} strokeWidth={active === "profile" ? 2.5 : 2} />
        <span>Profile</span>
      </Link>
    </nav>
  );
}
