"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type BlockedRow = {
  blocked_id: string;
  profiles: { display_name: string | null; username: string | null; avatar_url?: string | null } | null;
};

export default function BlockedPage() {
  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState<BlockedRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError("");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setRows([]);
      setLoading(false);
      return;
    }

    const { data, error: queryError } = await supabase
      .from("blocks")
      .select("blocked_id,profiles(display_name,username,avatar_url)")
      .eq("blocker_id", user.id);

    if (queryError) {
      setRows([]);
      setError(queryError.message);
    } else {
      setRows((data ?? []) as BlockedRow[]);
    }
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, [supabase]);

  async function unblock(id: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setBusy(id);
    setError("");

    // Both columns identify the user's block. Filtering by blocker_id is
    // required so an unblock cannot affect another user's block record.
    const { error: deleteError } = await supabase
      .from("blocks")
      .delete()
      .eq("blocker_id", user.id)
      .eq("blocked_id", id);

    if (deleteError) {
      setError(deleteError.message);
    } else {
      setRows((current) => current.filter((row) => row.blocked_id !== id));
    }
    setBusy(null);
  }

  return (
    <main className="content">
      <header className="simple-header">
        <Link href="/settings">‹ Settings</Link>
        <strong>Blocked users</strong>
      </header>

      {loading ? (
        <p>Loading blocked users…</p>
      ) : error ? (
        <div className="empty-state">
          <h3>Couldn&apos;t load blocked users</h3>
          <p>{error}</p>
          <button className="primary small" type="button" onClick={() => void load()}>Try again</button>
        </div>
      ) : rows.length === 0 ? (
        <div className="empty-state">
          <h3>No blocked users</h3>
          <p>People you block will appear here, with an option to unblock them.</p>
        </div>
      ) : (
        <div className="feed">
          {rows.map((row) => {
            const name = row.profiles?.display_name ?? "Gista User";
            const username = row.profiles?.username ?? "user";
            return (
              <div className="post" key={row.blocked_id}>
                <div className="post-head">
                  <div className="avatar" style={{ overflow: "hidden" }}>
                    {row.profiles?.avatar_url ? (
                      <img src={row.profiles.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : name.charAt(0).toUpperCase()}
                  </div>
                  <div className="identity">
                    <strong>{name}</strong>
                    <span>@{username}</span>
                  </div>
                  <button
                    className="primary small"
                    type="button"
                    onClick={() => void unblock(row.blocked_id)}
                    disabled={busy === row.blocked_id}
                  >
                    {busy === row.blocked_id ? "Unblocking…" : "Unblock"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
