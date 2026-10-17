"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import "./users.css";

type Role = "owner" | "admin";
type UserRow = {
  profile_id: string; username: string | null; display_name: string; avatar_url: string | null; bio: string | null;
  created_at: string; identity_status: "pending" | "confirmed" | "not_confirmed" | "needs_info";
  identity_notes: string; account_status: "active" | "suspended" | "banned"; account_reason: string;
  report_count: number; pending_report_count: number; latest_report_reason: string | null; total_count: number;
};

const PAGE_SIZE = 50;
const label = (p: UserRow) => p.username ? "@" + p.username : p.display_name || "this account";

export default function AdminUsersPage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [role, setRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<UserRow[]>([]);
  const [selected, setSelected] = useState<UserRow | null>(null);
  const [query, setQuery] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const [notes, setNotes] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [filter, setFilter] = useState<"all" | "identity" | "reported" | "restricted">("all");

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!alive) return;
      if (!user) { router.replace("/auth?returnTo=%2Fadmin%2Fusers"); return; }
      const { data: admin, error: adminError } = await supabase.from("gista_admins").select("role").eq("user_id", user.id).maybeSingle();
      if (!alive) return;
      if (adminError || !admin || (admin.role !== "owner" && admin.role !== "admin")) { setLoading(false); return; }
      setRole(admin.role as Role);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [supabase, router]);

  const loadUsers = useCallback(async (q: string, nextOffset: number) => {
    setBusy(true); setError("");
    const { data, error: loadError } = await supabase.rpc("admin_list_user_management", {
      search_query: q || null, result_limit: PAGE_SIZE, result_offset: nextOffset,
    });
    if (loadError) {
      setRows([]); setTotal(0);
      setError("Could not load Gista accounts: " + loadError.message);
    } else {
      const result = (data ?? []) as UserRow[];
      setRows(result);
      setTotal(Number(result[0]?.total_count ?? 0));
      setSelected((current) => current ? result.find((row) => row.profile_id === current.profile_id) ?? null : null);
    }
    setBusy(false);
  }, [supabase]);

  useEffect(() => {
    if (!role) return;
    void loadUsers(activeQuery, offset);
  }, [role, activeQuery, offset, loadUsers]);

  function searchUsers(e: React.FormEvent) {
    e.preventDefault();
    setSelected(null);
    setOffset(0);
    setActiveQuery(query.trim().replace(/^@/, ""));
  }

  async function recordIdentity(decision: "confirmed" | "not_confirmed" | "needs_info") {
    if (!selected) return;
    if (decision === "not_confirmed" && !notes.trim()) {
      setError("Add a short internal note explaining why the identity could not be confirmed.");
      return;
    }
    const text = decision === "confirmed" ? "confirm this user's identity internally" : decision === "needs_info" ? "mark this account as needing more identity review" : "record that this identity could not be confirmed";
    if (!confirm("Are you sure you want to " + text + " for " + label(selected) + "? This does not create a public badge.")) return;
    setBusy(true); setError(""); setMessage("");
    const { error: saveError } = await supabase.rpc("admin_record_personal_identity_review", {
      target_profile_id: selected.profile_id, review_decision: decision, review_notes: notes.trim(),
    });
    if (saveError) setError("Could not save the identity review: " + saveError.message);
    else {
      setMessage(decision === "confirmed" ? "Identity confirmed internally. No public badge was added." : decision === "needs_info" ? "Account marked for further review. The user can continue using Gista." : "Identity review recorded. No public badge was added.");
      setNotes("");
      await loadUsers(activeQuery, offset);
    }
    setBusy(false);
  }

  async function accountAction(action: "suspend" | "ban" | "restore") {
    if (!selected) return;
    if (action !== "restore" && !reason.trim()) {
      setError("Enter the evidence-based reason for this account action.");
      return;
    }
    if (action === "ban" && !confirm("LONG-TERM BAN: block " + label(selected) + " from signing in to Gista? Only proceed when the impersonation or serious violation is substantiated.")) return;
    if (action === "suspend" && !confirm("Suspend " + label(selected) + " from signing in for 30 days?")) return;
    if (action === "restore" && !confirm("Restore sign-in access for " + label(selected) + "?")) return;
    setBusy(true); setError(""); setMessage("");
    const { data, error: actionError } = await supabase.functions.invoke("admin-account-action", {
      body: { target_profile_id: selected.profile_id, action, reason: action === "restore" ? (reason.trim() || "Account access restored after admin review.") : reason.trim() },
    });
    if (actionError || data?.error) {
      setError("Could not update account access: " + (data?.error || actionError?.message || "Unknown error"));
    } else {
      setMessage(action === "ban" ? "Account banned. The action and reason were recorded." : action === "suspend" ? "Account suspended for 30 days. The action and reason were recorded." : "Account access restored.");
      setReason("");
      await loadUsers(activeQuery, offset);
    }
    setBusy(false);
  }

  if (loading) return <main className="users-page"><div className="users-loading">Loading secure user management…</div></main>;
  if (!role) return <main className="users-page"><section className="users-denied"><h1>Private area</h1><p>This account is not authorised to manage Gista users.</p><Link href="/">Return to Gista</Link></section></main>;

  const visible = rows.filter((row) =>
    filter === "all" ||
    (filter === "identity" && row.identity_status !== "confirmed") ||
    (filter === "reported" && row.pending_report_count > 0) ||
    (filter === "restricted" && row.account_status !== "active")
  );

  return <main className="users-page">
    <header className="users-header">
      <Link href="/admin" className="users-brand"><span className="users-mark">G</span><span>Gista <small>ADMIN</small></span></Link>
      <div><span className="users-role">{role === "owner" ? "Founder / Owner" : "Administrator"}</span><Link href="/admin">Dashboard</Link><Link href="/admin/verification">Public figure verification</Link></div>
    </header>
    <div className="users-container">
      <p className="users-eyebrow">TRUST, IDENTITY & SAFETY</p>
      <h1>User management</h1>
      <p className="users-intro">Every registered profile is listed here. Internal identity review is optional and never blocks normal Gista use. Personal identity confirmation never displays a badge; only approved public-figure verification does.</p>
      {message && <div className="users-message">{message}</div>}{error && <div className="users-error">{error}</div>}
      <section className="users-stats">
        <article><span>Accounts in results</span><strong>{total}</strong><small>Matching registered profiles</small></article>
        <article><span>Awaiting identity review</span><strong>{rows.filter((r) => r.identity_status === "pending" || r.identity_status === "needs_info").length}</strong><small>On this page</small></article>
        <article><span>Pending reports</span><strong>{rows.reduce((sum, r) => sum + Number(r.pending_report_count), 0)}</strong><small>On this page</small></article>
      </section>
      <form className="users-search" onSubmit={searchUsers}>
        <label htmlFor="users-query">Find any registered account</label>
        <div><input id="users-query" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search username or display name…" /><button disabled={busy}>{busy ? "Loading…" : "Search"}</button><button type="button" className="users-secondary" onClick={() => { setQuery(""); setSelected(null); setOffset(0); setActiveQuery(""); }}>Clear</button></div>
      </form>
      <nav className="users-filters">
        {([["all","All accounts"],["identity","Needs identity review"],["reported","Pending reports"],["restricted","Suspended / banned"]] as const).map(([key, text]) => <button key={key} className={filter === key ? "active" : ""} onClick={() => setFilter(key)}>{text}</button>)}
      </nav>
      <div className="users-layout">
        <section className="users-list">
          <div className="users-list-heading"><h2>Registered accounts</h2><span>{rows.length ? offset + 1 : 0}–{Math.min(offset + rows.length, total)} of {total}</span></div>
          {busy && rows.length === 0 ? <div className="users-empty">Loading accounts…</div> : visible.length === 0 ? <div className="users-empty">No accounts match this filter.</div> : visible.map((row) => <button key={row.profile_id} className={"users-person " + (selected?.profile_id === row.profile_id ? "selected" : "")} onClick={() => { setSelected(row); setNotes(row.identity_notes || ""); setReason(row.account_reason || ""); setError(""); setMessage(""); }}>
            {row.avatar_url ? <img src={row.avatar_url} alt="" /> : <span className="users-avatar">{(row.display_name || row.username || "G").slice(0,1).toUpperCase()}</span>}
            <span className="users-person-main"><strong>{row.display_name || "Gista user"}</strong><small>@{row.username || "no-username"} · Joined {new Date(row.created_at).toLocaleDateString()}</small><span className="users-pill-row"><i className={"users-pill identity-" + row.identity_status}>{row.identity_status.replace("_"," ")}</i><i className={"users-pill account-" + row.account_status}>{row.account_status}</i></span></span>
            <span className="users-reports">{row.pending_report_count}<small>pending reports</small></span>
          </button>)}
          <div className="users-pagination"><button disabled={offset === 0 || busy} onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}>Previous</button><span>Page {Math.floor(offset / PAGE_SIZE) + 1} of {Math.max(1, Math.ceil(total / PAGE_SIZE))}</span><button disabled={offset + PAGE_SIZE >= total || busy} onClick={() => setOffset(offset + PAGE_SIZE)}>Next</button></div>
        </section>
        <section className="users-detail">
          {!selected ? <div className="users-empty"><strong>Select an account</strong><p>Review the account's identity status and reports, then record an internal decision or take moderation action when evidence supports it.</p></div> : <>
            <div className="users-detail-profile">
              {selected.avatar_url ? <img src={selected.avatar_url} alt="" /> : <span className="users-avatar users-large-avatar">{(selected.display_name || selected.username || "G").slice(0,1).toUpperCase()}</span>}
              <div><h2>{selected.display_name || "Gista user"}</h2><p>@{selected.username || "no-username"}</p><small>Joined {new Date(selected.created_at).toLocaleDateString()} · ID {selected.profile_id.slice(0,8)}</small></div>
            </div>
            {selected.bio && <p className="users-bio">{selected.bio}</p>}
            <div className="users-detail-status"><span>Internal identity review</span><strong>{selected.identity_status.replace("_"," ")}</strong><small>Never shown as a public badge.</small></div>
            <div className="users-detail-status"><span>Account access</span><strong>{selected.account_status}</strong>{selected.account_reason && <small>Reason: {selected.account_reason}</small>}</div>
            <div className="users-detail-status"><span>Reports</span><strong>{selected.report_count} total · {selected.pending_report_count} pending</strong>{selected.latest_report_reason && <small>Latest profile report: {selected.latest_report_reason}</small>}</div>
            <label className="users-field">Internal identity-review notes<textarea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={3000} placeholder="Record what was checked and why. Avoid storing unnecessary sensitive documents or data." /></label>
            <div className="users-actions">
              <button disabled={busy} onClick={() => void recordIdentity("confirmed")}>Confirm identity</button>
              <button disabled={busy} className="users-secondary" onClick={() => void recordIdentity("needs_info")}>Needs more review</button>
              <button disabled={busy} className="users-danger-outline" onClick={() => void recordIdentity("not_confirmed")}>Could not confirm</button>
            </div>
            <div className="users-divider" />
            <h3>Impersonation & account enforcement</h3>
            <p className="users-small">Only take action after reviewing credible evidence. A report by itself is not proof. Suspensions last 30 days; bans block sign-in for a long duration. Admins cannot act on the owner account.</p>
            <label className="users-field">Reason for account action<textarea value={reason} onChange={(e) => setReason(e.target.value)} maxLength={3000} placeholder="Describe the substantiated impersonation or policy violation…" /></label>
            <div className="users-actions">
              <button disabled={busy || selected.account_status === "suspended"} className="users-warning" onClick={() => void accountAction("suspend")}>Suspend 30 days</button>
              <button disabled={busy || selected.account_status === "banned"} className="users-danger" onClick={() => void accountAction("ban")}>Ban account</button>
              <button disabled={busy || selected.account_status === "active"} className="users-secondary" onClick={() => void accountAction("restore")}>Restore access</button>
            </div>
            <p className="users-small">The action is audited. A banned or suspended user can contact Gista support to appeal an incorrect decision.</p>
          </>}
        </section>
      </div>
      <p className="users-footnote">Identity review is internal. Users may continue using Gista unless an authorised moderator separately restricts their account. Public badges are reserved for approved public-figure verification.</p>
    </div>
  </main>;
}
