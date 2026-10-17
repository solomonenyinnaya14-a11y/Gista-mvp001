"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import "./analytics.css";

type Role = "owner" | "admin";
type Trend = { day: string; active_users: number; registrations: number; gists: number; responses: number };
type CountRow = { path?: string; views?: number; unique_users?: number; event_name?: string; total?: number; format?: string };
type Analytics = {
  period_days: number;
  timezone: string;
  summary: {
    total_users: number; dau: number; mau: number; yau: number; registrations_period: number;
    gists_period: number; responses_period: number; replies_period: number; likes_period: number;
    follows_period: number; saves_period: number; shares_period: number;
  };
  trend: Trend[];
  top_pages: CountRow[];
  event_breakdown: CountRow[];
  post_formats: CountRow[];
};

const number = (value: number | null | undefined) => new Intl.NumberFormat("en-NG").format(Number(value ?? 0));
const dateLabel = (value: string) => new Date(value + "T12:00:00").toLocaleDateString("en-NG", { day: "numeric", month: "short" });

export default function AdminAnalyticsPage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [role, setRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [days, setDays] = useState(30);
  const [data, setData] = useState<Analytics | null>(null);

  const load = useCallback(async (period: number) => {
    setLoading(true);
    setError("");
    const { data: result, error: queryError } = await supabase.rpc("get_gista_admin_analytics", { days: period });
    if (queryError) setError("Could not load analytics: " + queryError.message);
    else setData(result as Analytics);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    let active = true;
    void (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!active) return;
      if (!user) { router.replace("/auth?returnTo=%2Fadmin%2Fanalytics"); return; }
      const { data: admin, error: adminError } = await supabase.from("gista_admins").select("role").eq("user_id", user.id).maybeSingle();
      if (!active) return;
      if (adminError || !admin || !["owner", "admin"].includes(admin.role)) {
        setLoading(false);
        setRole(null);
        return;
      }
      setRole(admin.role as Role);
      await load(days);
    })();
    return () => { active = false; };
  }, [supabase, router, load, days]);

  if (loading) return <main className="admin-page"><div className="admin-loading">Loading secure analytics…</div></main>;
  if (!role) return <main className="admin-page"><section className="admin-denied"><div className="admin-lock">🔒</div><h1>Private area</h1><p>This account is not authorised to access Gista analytics.</p><Link href="/">Return to Gista</Link></section></main>;

  const summary = data?.summary;
  const trend = data?.trend ?? [];
  const maxActive = Math.max(1, ...trend.map((row) => Number(row.active_users || 0)));
  const actions = [
    ["Gists created", summary?.gists_period], ["Responses", summary?.responses_period],
    ["Replies", summary?.replies_period], ["Likes", summary?.likes_period],
    ["New follows", summary?.follows_period], ["Saves", summary?.saves_period],
    ["Shares", summary?.shares_period],
  ] as const;

  return <main className="admin-page analytics-page">
    <header className="admin-header"><Link className="admin-brand" href="/admin"><span className="admin-mark">G</span><span>Gista <small>ANALYTICS</small></span></Link><div className="admin-header-right"><span className={"admin-role " + (role === "owner" ? "owner" : "")}>{role === "owner" ? "Founder / Owner" : "Administrator"}</span><Link href="/admin">Back to admin</Link></div></header>
    <div className="admin-container">
      <div className="admin-title-row analytics-title"><div><p className="admin-eyebrow">PRIVATE PRODUCT INSIGHTS</p><h1>User analytics</h1><p className="admin-subtitle">Understand active users, returning activity and how people use Gista.</p></div><label className="analytics-period">Period<select value={days} onChange={(event) => setDays(Number(event.target.value))}><option value={7}>7 days</option><option value={30}>30 days</option><option value={90}>90 days</option><option value={365}>12 months</option></select></label></div>
      {error && <div className="admin-error">{error}</div>}
      {data && <><section className="analytics-kpis">
        <article><span>Registered users</span><strong>{number(summary?.total_users)}</strong><small>All accounts</small></article>
        <article><span>Daily active users</span><strong>{number(summary?.dau)}</strong><small>Active today</small></article>
        <article><span>Monthly active users</span><strong>{number(summary?.mau)}</strong><small>Last 30 days</small></article>
        <article><span>Yearly active users</span><strong>{number(summary?.yau)}</strong><small>Last 365 days</small></article>
      </section>
      <section className="analytics-kpis analytics-kpis-secondary">
        <article><span>New registrations</span><strong>{number(summary?.registrations_period)}</strong><small>Selected period</small></article>
        <article><span>Gists created</span><strong>{number(summary?.gists_period)}</strong><small>Selected period</small></article>
        <article><span>Responses</span><strong>{number(summary?.responses_period)}</strong><small>Selected period</small></article>
        <article><span>Page views tracked</span><strong>{number(data.event_breakdown?.find((row) => row.event_name === "page_view")?.total)}</strong><small>Since tracking began</small></article>
      </section>
      <section className="analytics-panel">
        <div className="analytics-panel-heading"><div><h2>Daily activity</h2><p>Unique active users, new registrations, Gists and responses per day. Time zone: Africa/Lagos.</p></div></div>
        <div className="analytics-legend"><span><i className="legend-active" />Active users</span><span><i className="legend-reg" />Registrations</span><span><i className="legend-gists" />Gists</span><span><i className="legend-responses" />Responses</span></div>
        <div className="analytics-chart-scroll"><div className="analytics-bars">{trend.map((row) => {
          const values = [Number(row.active_users || 0), Number(row.registrations || 0), Number(row.gists || 0), Number(row.responses || 0)];
          const scale = Math.max(maxActive, ...values, 1);
          return <div className="analytics-day" key={row.day} title={dateLabel(row.day) + ": " + values.join(" / ")}><div className="analytics-bar-group">{values.map((value, index) => <span key={index} className={["bar-active", "bar-reg", "bar-gists", "bar-responses"][index]} style={{ height: Math.max(value ? 3 : 0, value / scale * 110) }} />)}</div><small>{new Date(row.day + "T12:00:00").getDate() === 1 || trend.length <= 14 ? dateLabel(row.day) : ""}</small></div>;
        })}</div></div>
      </section>
      <section className="analytics-grid">
        <div className="analytics-panel"><div className="analytics-panel-heading"><div><h2>Engagement actions</h2><p>Actions recorded during the selected period.</p></div></div><div className="analytics-action-list">{actions.map(([label, value]) => <div key={label}><span>{label}</span><strong>{number(value)}</strong></div>)}</div></div>
        <div className="analytics-panel"><div className="analytics-panel-heading"><div><h2>Post formats</h2><p>Published Gists by format.</p></div></div>{data.post_formats.length ? <div className="analytics-action-list">{data.post_formats.map((row) => <div key={row.format}><span>{row.format || "Unspecified"}</span><strong>{number(row.total)}</strong></div>)}</div> : <p className="analytics-empty">No Gists recorded in this period.</p>}</div>
        <div className="analytics-panel"><div className="analytics-panel-heading"><div><h2>Most visited pages</h2><p>Page views recorded since tracking began, for the selected period.</p></div></div>{data.top_pages.length ? <div className="analytics-action-list">{data.top_pages.map((row) => <div key={row.path}><span className="analytics-path">{row.path}</span><strong>{number(row.views)} <small>views</small></strong></div>)}</div> : <p className="analytics-empty">Page-view tracking starts when signed-in users visit after this release.</p>}</div>
        <div className="analytics-panel"><div className="analytics-panel-heading"><div><h2>Tracked events</h2><p>Instrumented events recorded during the selected period.</p></div></div>{data.event_breakdown.length ? <div className="analytics-action-list">{data.event_breakdown.map((row) => <div key={row.event_name}><span>{row.event_name?.replaceAll("_", " ")}</span><strong>{number(row.total)}</strong></div>)}</div> : <p className="analytics-empty">No tracked events yet.</p>}</div>
      </section>
      <p className="analytics-note">Active users include signed-in users who viewed a page or performed a recorded action. Page-view tracking begins after deployment; older activity is counted only where existing Gist, response, reply, like, follow, save or share records provide evidence. These metrics are first-party and visible only to authorised Gista administrators.</p>
      </>}
      <div className="analytics-footer"><Link href="/admin">← Return to admin dashboard</Link><button onClick={() => void load(days)}>Refresh analytics</button></div>
    </div>
  </main>;
}
