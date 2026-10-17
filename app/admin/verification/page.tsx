"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import "./verification.css";

type Role = "owner" | "admin";
type Candidate = {
  id: string; username: string | null; display_name: string | null; bio: string | null;
  avatar_url: string | null; created_at: string; is_verified: boolean; verification_type: "personal" | "official" | null;
  gist_count: number; response_count: number; reply_count: number; report_count: number; pending_report_count: number;
};
type ReviewItem = { id: string; body?: string | null; content_type?: string; category?: string | null; status?: string; moderation_status?: string | null; created_at: string; media_url?: string | null; reason?: string; details?: string | null; content_type?: string; content_preview?: string | null; };
type ReviewData = {
  profile: { id: string; username: string | null; display_name: string | null; bio: string | null; avatar_url: string | null; cover_url: string | null; created_at: string; is_private: boolean };
  verification: { verification_type: "personal" | "official"; verified_at: string } | null;
  gists: ReviewItem[]; responses: ReviewItem[]; replies: ReviewItem[];
  reports: ReviewItem[]; review_history: { id: number; decision: string; verification_type: string | null; notes: string; created_at: string; reviewed_by: string }[];
};

const actionButton: React.CSSProperties = { border: 0, borderRadius: 10, padding: "11px 14px", background: "#6d28d9", color: "#fff", fontWeight: 800, cursor: "pointer" };

export default function AdminVerificationPage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [role, setRole] = useState<Role | null>(null);
  const [userId, setUserId] = useState("");
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selected, setSelected] = useState<Candidate | null>(null);
  const [review, setReview] = useState<ReviewData | null>(null);
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [kind, setKind] = useState<"personal" | "official">("personal");
  const [notes, setNotes] = useState("");
  const [checks, setChecks] = useState({ authentic: false, genuine: false, standards: false, reportsReviewed: false });

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!alive) return;
      if (!user) { router.replace("/auth?returnTo=%2Fadmin%2Fverification"); return; }
      setUserId(user.id);
      const { data: admin, error: adminError } = await supabase.from("gista_admins").select("role").eq("user_id", user.id).maybeSingle();
      if (!alive) return;
      if (adminError || !admin || (admin.role !== "owner" && admin.role !== "admin")) { setRole(null); setLoading(false); return; }
      setRole(admin.role as Role);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [supabase, router]);

  const searchUsers = useCallback(async (value: string) => {
    if (!role) return;
    if (!value.trim()) { setCandidates([]); setSelected(null); setReview(null); return; }
    setSearching(true); setError(""); setMessage("");
    const { data, error: searchError } = await supabase.rpc("admin_search_verification_users", { search_query: value.trim() });
    if (searchError) setError("Could not search users: " + searchError.message);
    else {
      const rows = (data ?? []) as Candidate[];
      setCandidates(rows);
      if (selected && !rows.some((p) => p.id === selected.id)) { setSelected(null); setReview(null); }
    }
    setSearching(false);
  }, [supabase, role, selected]);

  async function openReview(person: Candidate) {
    setSelected(person); setReview(null); setError(""); setMessage(""); setNotes("");
    setChecks({ authentic: false, genuine: false, standards: false, reportsReviewed: false });
    setKind(person.verification_type ?? "personal");
    setBusy(true);
    const { data, error: reviewError } = await supabase.rpc("admin_get_verification_review", { target_profile_id: person.id });
    if (reviewError) setError("Could not load the user's review history: " + reviewError.message);
    else setReview(data as ReviewData);
    setBusy(false);
  }

  async function submitDecision(decision: "approved" | "not_approved" | "revoked") {
    if (!selected || !role) return;
    if (decision === "approved" && !Object.values(checks).every(Boolean)) {
      setError("Complete every review checklist item before approving verification.");
      return;
    }
    const action = decision === "approved" ? "verify" : decision === "revoked" ? "remove verification from" : "mark as not approved";
    if (!confirm("Are you sure you want to " + action + " @" + (selected.username ?? selected.display_name ?? "this user") + "?")) return;
    setBusy(true); setError(""); setMessage("");
    const { data, error: actionError } = await supabase.rpc("admin_review_gista_verification", {
      target_profile_id: selected.id, decision, verification_type: decision === "approved" ? kind : null, review_notes: notes.trim(),
    });
    if (actionError) setError("Could not save verification decision: " + actionError.message);
    else {
      const result = data as { is_verified?: boolean; verification_type?: string | null };
      const updated: Candidate = { ...selected, is_verified: Boolean(result?.is_verified), verification_type: result?.verification_type === "official" ? "official" : result?.is_verified ? "personal" : null };
      setSelected(updated);
      setCandidates((prev) => prev.map((p) => p.id === updated.id ? updated : p));
      const { data: fresh, error: freshError } = await supabase.rpc("admin_get_verification_review", { target_profile_id: selected.id });
      if (!freshError) setReview(fresh as ReviewData);
      setMessage(decision === "approved" ? "User verified. The purple badge is now active across Gista." : decision === "revoked" ? "Verification removed. The badge will no longer appear." : "Review recorded. No verification badge was granted.");
    }
    setBusy(false);
  }

  if (loading) return <main className="verification-page"><div className="verification-loading">Loading secure verification review…</div></main>;
  if (!role) return <main className="verification-page"><section className="verification-denied"><h1>Private area</h1><p>This account is not authorised to review verification requests.</p><Link href="/">Return to Gista</Link></section></main>;

  const profile = review?.profile;
  const checkedCount = Object.values(checks).filter(Boolean).length;
  return <main className="verification-page">
    <header className="verification-header">
      <Link href="/admin" className="verification-brand"><span className="verification-mark">G</span><span>Gista <small>ADMIN</small></span></Link>
      <div><span className="verification-role">{role === "owner" ? "Founder / Owner" : "Administrator"}</span><Link href="/admin">Dashboard</Link><Link href="/admin/analytics">Analytics</Link></div>
    </header>
    <div className="verification-container">
      <p className="verification-eyebrow">TRUST & AUTHENTICITY</p><h1>User verification</h1>
      <p className="verification-intro">Search for a user, review their profile, activity and reports, then make a human decision. A report is a signal to review—not proof that someone broke a rule.</p>
      {message && <div className="verification-message">{message}</div>}{error && <div className="verification-error">{error}</div>}
      <form className="verification-search" onSubmit={(e) => { e.preventDefault(); void searchUsers(query); }}>
        <label htmlFor="verification-search-input">Find a Gista user</label><div><input id="verification-search-input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search username or display name (e.g. @gista_official)" /><button style={actionButton} disabled={searching}>{searching ? "Searching…" : "Search users"}</button></div>
      </form>
      {candidates.length > 0 && <section className="verification-candidates"><h2>Search results <small>{candidates.length} shown</small></h2>{candidates.map((p) => <button className={"verification-candidate " + (selected?.id === p.id ? "selected" : "")} key={p.id} onClick={() => void openReview(p)}>
        {p.avatar_url ? <img src={p.avatar_url} alt="" /> : <span className="verification-avatar">{(p.display_name || p.username || "G").slice(0,1).toUpperCase()}</span>}
        <span className="verification-candidate-main"><strong>{p.display_name || "Gista user"} {p.is_verified && <span className="verification-badge">✓</span>}</strong><small>@{p.username || "no-username"} · Joined {new Date(p.created_at).toLocaleDateString()}</small></span>
        <span className="verification-candidate-count">{p.report_count} reports<br /><small>{p.pending_report_count} pending</small></span>
      </button>)}</section>}
      {!searching && query.trim() && candidates.length === 0 && !error && <div className="verification-empty">No users found. Try another username or display name.</div>}

      {busy && selected && !review && <div className="verification-empty">Loading profile and moderation history…</div>}
      {selected && review && profile && <section className="verification-review">
        <div className="verification-profile-card">
          <div className="verification-cover">{profile.cover_url && <img src={profile.cover_url} alt="" />}</div>
          <div className="verification-profile-main">
            {profile.avatar_url ? <img className="verification-profile-avatar" src={profile.avatar_url} alt="" /> : <span className="verification-profile-avatar verification-avatar">{(profile.display_name || profile.username || "G").slice(0,1).toUpperCase()}</span>}
            <div className="verification-profile-copy"><h2>{profile.display_name || "Gista user"} {selected.is_verified && <span className="verification-badge">✓</span>}</h2><p>@{profile.username || "no-username"} · {profile.is_private ? "Private profile" : "Public profile"}</p><small>Joined {new Date(profile.created_at).toLocaleDateString()} · {selected.id.slice(0,8)}</small></div>
            <a className="verification-profile-link" href={"/profile/" + encodeURIComponent(profile.username || selected.id)} target="_blank" rel="noreferrer">Open profile ↗</a>
          </div>
          {profile.bio && <p className="verification-bio">{profile.bio}</p>}
          <div className="verification-stats"><span><strong>{selected.gist_count}</strong> Gists</span><span><strong>{selected.response_count}</strong> Responses</span><span><strong>{selected.reply_count}</strong> Replies</span><span><strong>{selected.report_count}</strong> Reports</span></div>
          <div className={"verification-current " + (selected.is_verified ? "is-verified" : "")}>{selected.is_verified ? "✓ Currently verified · " + (selected.verification_type === "official" ? "Official profile" : "Personal verification") : "Not currently verified"}</div>
        </div>

        <div className="verification-section"><h2>1. Profile & authenticity review</h2><p>Check that the account appears genuine and the profile identity is consistent. For official verification, check that the person or organisation really controls the name/profile they represent.</p>
          <label className="verification-check"><input type="checkbox" checked={checks.authentic} onChange={(e) => setChecks((v) => ({...v, authentic:e.target.checked}))} /><span><strong>Identity/profile reviewed</strong><small>Profile details and available authenticity evidence are consistent.</small></span></label>
          <label className="verification-check"><input type="checkbox" checked={checks.genuine} onChange={(e) => setChecks((v) => ({...v, genuine:e.target.checked}))} /><span><strong>Genuine activity reviewed</strong><small>Activity looks authentic; no clear impersonation, bot or spam pattern.</small></span></label>
        </div>
        <div className="verification-section"><h2>2. Gists and responses</h2><p>Recent public activity is shown below. Media previews open only when the URL is available; text content is displayed as recorded.</p>
          <div className="verification-content-list"><h3>Recent Gists</h3>{review.gists.length ? review.gists.map((item) => <article key={item.id}><div><strong>{item.content_type || "Post"}{item.category ? " · " + item.category : ""}</strong><time>{new Date(item.created_at).toLocaleString()}</time></div><p>{item.body || (item.media_url ? "Media/voice post (open the user profile to review the media)." : "No text content.")}</p>{item.moderation_status && item.moderation_status !== "active" && <small className="verification-flag">Moderation: {item.moderation_status}</small>}</article>) : <p className="verification-muted">No Gists yet.</p>}</div>
          <div className="verification-content-list"><h3>Recent responses & replies</h3>{[...review.responses, ...review.replies].sort((a,b)=>new Date(b.created_at).getTime()-new Date(a.created_at).getTime()).slice(0,16).length ? [...review.responses.map((x)=>({...x, content_type:"Response"})), ...review.replies.map((x)=>({...x, content_type:"Reply"}))].sort((a,b)=>new Date(b.created_at).getTime()-new Date(a.created_at).getTime()).slice(0,16).map((item) => <article key={item.id}><div><strong>{item.content_type}</strong><time>{new Date(item.created_at).toLocaleString()}</time></div><p>{item.body || (item.media_url ? "Media/voice contribution." : "No text content.")}</p></article>) : <p className="verification-muted">No responses or replies yet.</p>}</div>
        </div>

        <div className="verification-section"><h2>3. Community standards & reports</h2><p>Review each report and the surrounding context. Pending reports need a closer look; report counts alone should not automatically disqualify a user.</p>
          <label className="verification-check"><input type="checkbox" checked={checks.reportsReviewed} onChange={(e) => setChecks((v) => ({...v, reportsReviewed:e.target.checked}))} /><span><strong>Reports and moderation history reviewed</strong><small>I reviewed available reports and considered whether any indicate a substantiated standards violation.</small></span></label>
          <label className="verification-check"><input type="checkbox" checked={checks.standards} onChange={(e) => setChecks((v) => ({...v, standards:e.target.checked}))} /><span><strong>Community standards check completed</strong><small>Based on available evidence, the account meets Gista’s current community standards for verification.</small></span></label>
          <div className="verification-content-list"><h3>Reports involving this user ({review.reports.length} recent)</h3>{review.reports.length ? review.reports.map((r) => <article key={r.id}><div><strong>{r.content_type || "Reported item"} · {r.reason || "Report"}</strong><time>{new Date(r.created_at).toLocaleString()}</time></div><p>{r.content_preview || r.details || "No additional details supplied."}</p>{r.details && r.content_preview && <small>{r.details}</small>}<span className={"verification-report-status status-" + (r.status || "pending")}>{(r.status || "pending").replace("_"," ")}</span></article>) : <p className="verification-muted">No reports found for this account or its content.</p>}</div>
        </div>

        <div className="verification-section"><h2>4. Record your decision</h2><p>Choose the badge type only when the user meets the verification criteria. Notes are internal and retained in the review history.</p>
          <label className="verification-field">Verification type<select value={kind} onChange={(e) => setKind(e.target.value as "personal" | "official")}><option value="personal">Personal verification — authentic individual account</option><option value="official">Official verification — public figure, organisation or official profile</option></select></label>
          <label className="verification-field">Internal review notes<textarea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={3000} placeholder="Summarise evidence checked, reports considered, and why the decision meets policy. Avoid unnecessary sensitive information." /></label>
          <p className="verification-check-count">{checkedCount}/4 review checks complete. All four are required to approve.</p>
          <div className="verification-decision-actions">
            <button style={actionButton} disabled={busy || !Object.values(checks).every(Boolean)} onClick={() => void submitDecision("approved")}>{busy ? "Saving…" : selected.is_verified ? "Save verification" : "Approve & verify user"}</button>
            <button className="verification-secondary" disabled={busy} onClick={() => void submitDecision("not_approved")}>Record not approved</button>
            {selected.is_verified && <button className="verification-danger" disabled={busy} onClick={() => void submitDecision("revoked")}>Revoke verification</button>}
          </div>
          {review.review_history.length > 0 && <div className="verification-content-list"><h3>Previous verification decisions</h3>{review.review_history.map((h) => <article key={h.id}><div><strong>{h.decision.replace("_"," ")}{h.verification_type ? " · " + h.verification_type : ""}</strong><time>{new Date(h.created_at).toLocaleString()}</time></div><p>{h.notes || "No notes recorded."}</p></article>)}</div>}
        </div>
      </section>}
      <p className="verification-footnote">Verification is a trust signal, not a popularity reward. Make decisions from available evidence, record the reason, and review verified accounts again if credible concerns arise.</p>
    </div>
  </main>;
}
