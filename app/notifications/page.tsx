"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, CheckCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Notification = {
  id: string;
  type: string;
  post_id: string | null;
  response_id: string | null;
  read_at: string | null;
  created_at: string;
  actor: { id: string; display_name: string | null; username: string | null; avatar_url: string | null } | null;
  actorVerified?: boolean;
};

function message(n: Notification) {
  const name = n.actor?.display_name ?? n.actor?.username ?? "Someone";
  if (n.type === "follow") return `${name} followed you.`;
  if (n.type === "like") return `${name} liked your Gist.`;
  if (n.type === "response") return `${name} joined your Gist with a response.`;
  if (n.type === "reply") return `${name} replied to your response.`;
  if (n.type === "mention") return `${name} mentioned you.`;
  if (n.type === "gist_active") return `Your Gist is now active.`;
  if (n.type === "gist_trending") return `Your Gist is now trending.`;
  return `${name} interacted with you.`;
}

export default function NotificationsPage() {
  const supabase = createClient();
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  async function load(userIdOverride?: string) {
    const currentId = userIdOverride ?? userId;
    if (!currentId) {
      setItems([]);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("notifications")
      .select("id,type,post_id,response_id,read_at,created_at,actor:profiles!notifications_actor_id_fkey(id,display_name,username,avatar_url)")
      .eq("recipient_id", currentId)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      setItems([]);
      setLoading(false);
      return;
    }

    const normalized = ((data ?? []) as any[]).map((item) => ({
      ...item,
      actor: Array.isArray(item.actor) ? item.actor[0] ?? null : item.actor ?? null,
    }));

    const actorIds = [...new Set(normalized.map((item) => item.actor?.id).filter(Boolean))];
    const { data: verifiedRows } = actorIds.length
      ? await supabase.from("verified_profiles").select("profile_id").in("profile_id", actorIds)
      : { data: [] as any[] };
    const verifiedIds = new Set((verifiedRows ?? []).map((row: any) => row.profile_id));

    setItems(normalized.map((item) => ({ ...item, actorVerified: !!item.actor?.id && verifiedIds.has(item.actor.id) })) as Notification[]);
    setLoading(false);
  }

  useEffect(() => {
    let active = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    supabase.auth.getUser().then(({ data }) => {
      if (!active) return;
      const id = data.user?.id ?? null;
      setUserId(id);
      load(id ?? undefined);

      if (id) {
        channel = supabase
          .channel("notifications-" + id)
          .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: "recipient_id=eq." + id }, () => load(id))
          .on("postgres_changes", { event: "UPDATE", schema: "public", table: "notifications", filter: "recipient_id=eq." + id }, () => load(id))
          .subscribe();
      }
    });

    return () => {
      active = false;
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  async function markAllRead() {
    if (!userId) return;
    const { error } = await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("recipient_id", userId)
      .is("read_at", null);
    if (!error) setItems((current) => current.map((item) => ({ ...item, read_at: item.read_at ?? new Date().toISOString() })));
  }

  async function openNotification(item: Notification) {
    if (userId && !item.read_at) {
      const now = new Date().toISOString();
      const { error } = await supabase.from("notifications").update({ read_at: now }).eq("id", item.id).eq("recipient_id", userId);
      if (!error) setItems((current) => current.map((n) => n.id === item.id ? { ...n, read_at: now } : n));
    }
  }

  const unread = items.filter((item) => !item.read_at).length;

  return (
    <main className="content">
      <header className="simple-header">
        <Link href="/"><ArrowLeft size={18} /></Link>
        <strong>Notifications</strong>
        <button onClick={markAllRead} disabled={!unread} aria-label="Mark all notifications as read"><CheckCheck size={18} /></button>
      </header>

      {loading ? <p>Loading notifications…</p> : !userId ? (
        <div className="empty-state"><h3>Sign in to see notifications</h3><Link className="primary small" href="/auth">Sign in</Link></div>
      ) : items.length === 0 ? (
        <div className="empty-state"><h3>No notifications yet</h3><p>Likes, follows, responses and replies will appear here.</p></div>
      ) : (
        <section className="feed">
          {items.map((item) => {
            const href = item.post_id ? "/gist/" + item.post_id : item.actor?.username ? "/profile/" + item.actor.username : null;
            const content = (
              <div className={item.read_at ? "post notification-item" : "post notification-item unread"}>
                <div className="post-head">
                  <div className="avatar notification-avatar">
                    {item.actor?.avatar_url ? <img src={item.actor.avatar_url} alt="" loading="lazy" onError={(event) => { event.currentTarget.style.display = "none"; }} /> : item.actor?.display_name?.[0]?.toUpperCase() ?? "G"}
                  </div>
                  <div className="identity">
                    <strong>
                      {message(item)}
                      {item.actorVerified && <span title="Verified account" aria-label="Verified account" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 18, height: 18, marginLeft: 6, borderRadius: "50%", background: "#6D28D9", color: "#fff", verticalAlign: "-2px" }}><Check size={11} strokeWidth={3} /></span>}
                    </strong>
                    <span>{new Date(item.created_at).toLocaleString()}</span>
                  </div>
                </div>
              </div>
            );
            return href ? <Link className="notification-link" key={item.id} href={href} onClick={() => openNotification(item)}>{content}</Link> : <button className="notification-link notification-button" key={item.id} onClick={() => openNotification(item)}>{content}</button>;
          })}
        </section>
      )}
    </main>
  );
}
