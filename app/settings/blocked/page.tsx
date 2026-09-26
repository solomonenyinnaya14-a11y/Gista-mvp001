"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type BlockedProfile = {
  id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
};

type BlockRow = {
  blocked_id: string;
  profiles: BlockedProfile | null;
};

export default function BlockedPage() {
  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState<BlockRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [unblocking, setUnblocking] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setRows([]);
      setLoading(false);
      return;
    }

    const { data, error: queryError } = await supabase
      .from("blocks")
      .select("blocked_id,profiles!blocks_blocked_profile_fkey(id,display_name,username,avatar_url)")
      .eq("blocker_id", user.id)
      .order("created_at", { ascending: false });

    if (queryError) {
      setRows([]);
      setError(queryError.message);
      setLoading(false);
      return;
    }

    const normalized = ((data ?? []) as any[]).map((row) => ({
      blocked_id: row.blocked_id,
      profiles: Array.isArray(row.profiles) ? row.profiles[0] ?? null : row.profiles ?? null,
    })) as BlockRow[];

    setRows(normalized);
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, [supabase]);

  async function unblock(id: string) {
    if (unblocking) return;
    setUnblocking(id);
    setError("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setUnblocking(null);
      return;
    }

    const { error: deleteError } = await supabase
      .from("blocks")
      .delete()
      .eq("blocker_id", user.id)
      .eq("blocked_id", id);

    if (deleteError) {
      setError(deleteError.message);
      setUnblocking(null);
      return;
    }

    setRows((current) => current.filter((row) => row.blocked_id !== id));
    setUnblocking(null);
  }

  return (
    <main className="content">
      <header className="simple-header">
        <Link href="/settings" aria-label="Back to settings">
          <ArrowLeft size={18} />
        </Link>
        <strong>Blocked users</strong>
      </header>

      {loading ? (
        <div className="empty-state">
          <p>Loading blocked users…</p>
        </div>
      ) : error ? (
        <div className="empty-state">
          <h3>Couldn&apos;t load blocked users</h3>
          <p>{error}</p>
          <button className="primary small" type="button" onClick={() => void load()}>
            Try again
          </button>
        </div>
      ) : rows.length === 0 ? (
        <div className="empty-state">
          <h3>No blocked users</h3>
          <p>Users you block will appear here. You can unblock them at any time.</p>
        </div>
      ) : (
        <section className="feed">
          {rows.map((row) => {
            const profile = row.profiles;
            const name = profile?.display_name || profile?.username || "Gista User";
            const initial = name.trim().charAt(0).toUpperCase() || "G";

            return (
              <article className="post" key={row.blocked_id}>
                <div className="post-head">
                  <div className="avatar" style={{ overflow: "hidden" }}>
                    {profile?.avatar_url ? (
                      <img
                        src={profile.avatar_url}
                        alt=""
                        loading="lazy"
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                    ) : (
                      initial
                    )}
                  </div>
                  <div className="identity" style={{ flex: 1 }}>
                    <strong>{name}</strong>
                    <span>@{profile?.username ?? "user"}</span>
                  </div>
                  <button
                    className="primary small"
                    type="button"
                    disabled={unblocking === row.blocked_id}
                    onClick={() => void unblock(row.blocked_id)}
                  >
                    {unblocking === row.blocked_id ? "Unblocking…" : "Unblock"}
                  </button>
                </div>
              </article>
            );
          })}
        </section>
      )}
    </main>
  );
}
