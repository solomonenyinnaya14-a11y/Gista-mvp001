"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function BlockedPage() {
  const supabase = createClient();
  const [rows, setRows] = useState<any[]>([]);
  const [error, setError] = useState("");

  async function load() {
    setError("");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data, error: queryError } = await supabase
      .from("blocks")
      .select("blocked_id,profiles(display_name,username,avatar_url)")
      .eq("blocker_id", user.id);
    if (queryError) {
      setRows([]);
      setError(queryError.message);
      return;
    }
    setRows(data ?? []);
  }

  useEffect(() => { void load(); }, [supabase]);

  async function unblock(id: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error: deleteError } = await supabase
      .from("blocks")
      .delete()
      .eq("blocker_id", user.id)
      .eq("blocked_id", id);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }
    setRows((current) => current.filter((row) => row.blocked_id !== id));
  }

  return (
    <main className="content">
      <header className="simple-header"><Link href="/settings">‹ Settings</Link><strong>Blocked users</strong></header>
      {error ? <div className="empty-state"><h3>Couldn&apos;t load blocked users</h3><p>{error}</p><button className="primary small" type="button" onClick={() => void load()}>Try again</button></div> : rows.length === 0 ? <p>No blocked users.</p> : <div className="feed">{rows.map((row) => <div className="post" key={row.blocked_id}><div className="post-head"><div className="avatar" style={{ overflow: "hidden" }}>{row.profiles?.avatar_url ? <img src={row.profiles.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : (row.profiles?.display_name?.[0]?.toUpperCase() ?? "G")}</div><div className="identity"><strong>{row.profiles?.display_name ?? "Gista User"}</strong><span>@{row.profiles?.username ?? "user"}</span></div><button className="primary small" type="button" onClick={() => void unblock(row.blocked_id)}>Unblock</button></div></div>)}</div>}
    </main>
  );
}
