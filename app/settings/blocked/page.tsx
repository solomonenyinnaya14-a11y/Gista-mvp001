"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function BlockedPage() {
  const supabase = createClient();
  const [rows, setRows] = useState<any[]>([]);

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from("blocks").select("blocked_id,profiles(display_name,username)").eq("blocker_id", user.id);
    setRows(data ?? []);
  }

  useEffect(() => { load(); }, [supabase]);

  async function unblock(id: string) {
    await supabase.from("blocks").delete().eq("blocked_id", id);
    await load();
  }

  return (
    <main className="content">
      <header className="simple-header"><Link href="/settings">‹ Settings</Link><strong>Blocked users</strong></header>
      {rows.length === 0 ? <p>No blocked users.</p> : <div className="feed">{rows.map((row) => <div className="post" key={row.blocked_id}><strong>{row.profiles?.display_name ?? "Gista User"}</strong><span>@{row.profiles?.username ?? "user"}</span><button className="primary small" onClick={() => unblock(row.blocked_id)}>Unblock</button></div>)}</div>}
    </main>
  );
}
