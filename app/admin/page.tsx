"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import "./admin.css";

type Role = "owner" | "admin";
type Profile = { id: string; username: string | null; display_name: string | null };
type Report = {
  id: string; reporter_id: string; post_id: string | null; response_id: string | null; reply_id: string | null;
  target_user_id: string | null; reason: string; details: string | null; status: string; created_at: string;
  reviewed_by: string | null; reviewed_at: string | null; moderation_notes: string | null;
};
type Ticket = {
  id: string; user_id: string; subject: string; message: string; status: string; admin_notes: string | null;
  created_at: string; updated_at: string; reviewed_by: string | null;
};
type AdminRecord = { user_id: string; role: Role; created_at: string; added_by: string | null };
type Content = { id: string; body: string | null; content_type?: string; author_id: string };

const card: React.CSSProperties = { background: "#fff", border: "1px solid #eeeaf4", borderRadius: 16, padding: 16 };
const button: React.CSSProperties = { border: 0, borderRadius: 10, padding: "10px 13px", background: "#7c3aed", color: "#fff", fontWeight: 750, cursor: "pointer" };

export default function AdminPage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [userId, setUserId] = useState("");
  const [role, setRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"reports" | "complaints" | "access">("reports");
  const [reports, setReports] = useState<Report[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [admins, setAdmins] = useState<AdminRecord[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [content, setContent] = useState<Record<string, Content>>({});
  const [busy, setBusy] = useState("");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [searching, setSearching] = useState(false);
  const searchRequest = useRef(0);
  const [message, setMessage] = useState("");

  const loadDashboard = useCallback(async (uid: string, currentRole: Role) => {
    setError("");
    const [{ data: reportRows, error: reportError }, { data: ticketRows, error: ticketError }] = await Promise.all([
      supabase.from("reports").select("id,reporter_id,post_id,response_id,reply_id,target_user_id,reason,details,status,created_at,reviewed_by,reviewed_at,moderation_notes").order("created_at", { ascending: false }).limit(100),
      supabase.from("support_tickets").select("id,user_id,subject,message,status,admin_notes,created_at,updated_at,reviewed_by").order("created_at", { ascending: false }).limit(100),
    ]);
    if (reportError) setError("Could not load reports: " + reportError.message);
    if (ticketError) setError((prev) => (prev ? prev + " • " : "") + "Could not load complaints: " + ticketError.message);
    const reportList = (reportRows ?? []) as Report[];
    const ticketList = (ticketRows ?? []) as Ticket[];
    setReports(reportList);
    setTickets(ticketList);

    let adminRows: AdminRecord[] = [];
    if (currentRole === "owner") {
      const { data, error: adminsError } = await supabase.from("gista_admins").select("user_id,role,created_at,added_by").order("created_at", { ascending: true });
      if (adminsError) setError((prev) => prev ? prev + " • " + adminsError.message : adminsError.message);
      adminRows = (data ?? []) as AdminRecord[];
      setAdmins(adminRows);
    }

    const profileIds = Array.from(new Set([
      ...reportList.flatMap((r) => [r.reporter_id, r.target_user_id ?? ""]),
      ...ticketList.map((t) => t.user_id),
      ...adminRows.map((a) => a.user_id),
    ].filter(Boolean)));
    const postIds = reportList.map((r) => r.post_id).filter((id): id is string => Boolean(id));
    const responseIds = reportList.map((r) => r.response_id).filter((id): id is string => Boolean(id));
    const replyIds = reportList.map((r) => r.reply_id).filter((id): id is string => Boolean(id));
    const [profileResult, postResult, responseResult, replyResult] = await Promise.all([
      profileIds.length ? supabase.from("profiles").select("id,username,display_name").in("id", profileIds) : Promise.resolve({ data: [] }),
      postIds.length ? supabase.from("posts").select("id,body,content_type,author_id").in("id", postIds) : Promise.resolve({ data: [] }),
      responseIds.length ? supabase.from("responses").select("id,body,content_type,author_id").in("id", responseIds) : Promise.resolve({ data: [] }),
      replyIds.length ? supabase.from("replies").select("id,body,content_type,author_id").in("id", replyIds) : Promise.resolve({ data: [] }),
    ]);
    const profileMap: Record<string, Profile> = {};
    (profileResult.data ?? []).forEach((p: Profile) => { profileMap[p.id] = p; });
    setProfiles(profileMap);
    const contentMap: Record<string, Content> = {};
    [...(postResult.data ?? []), ...(responseResult.data ?? []), ...(replyResult.data ?? [])].forEach((item: Content) => { contentMap[item.id] = item; });
    setContent(contentMap);
  }, [supabase]);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!active) return;
      if (!user) { router.replace("/auth?returnTo=%2Fadmin"); return; }
      setUserId(user.id);
      const { data: admin, error: adminError } = await supabase.from("gista_admins").select("role").eq("user_id", user.id).maybeSingle();
      if (!active) return;
      if (adminError || !admin || (admin.role !== "owner" && admin.role !== "admin")) {
        setLoading(false);
        setRole(null);
        return;
      }
      const currentRole = admin.role as Role;
      setRole(currentRole);
      await loadDashboard(user.id, currentRole);
      if (active) setLoading(false);
    })();
    return () => { active = false; };
  }, [supabase, router, loadDashboard]);

  async function updateReport(report: Report, status: string) {
    setBusy(report.id); setMessage(""); setError("");
    const { error: updateError } = await supabase.from("reports").update({
      status, moderation_notes: notes[report.id] ?? report.moderation_notes ?? "",
      reviewed_by: userId, reviewed_at: new Date().toISOString(),
    }).eq("id", report.id);
    if (updateError) setError(updateError.message);
    else { setMessage("Report updated."); if (role) await loadDashboard(userId, role); }
    setBusy("");
  }

  async function removeReportedPost(report: Report) {
    if (!report.post_id || !role) return;
    if (!confirm("Remove this Post from Gista? It will disappear from feeds and its discussion will be hidden from users. The report record will be kept for review.")) return;
    setBusy(report.id); setMessage(""); setError("");
    const { error: removeError } = await supabase.from("posts").update({ moderation_status: "removed" }).eq("id", report.post_id);
    if (removeError) { setError("Could not remove Post: " + removeError.message); setBusy(""); return; }
    const previousNote = (notes[report.id] ?? report.moderation_notes ?? "").trim();
    const finalNote = [previousNote, "Post removed by an authorised Gista administrator."].filter(Boolean).join("\\n");
    const { error: reportError } = await supabase.from("reports").update({
      status: "action_taken", moderation_notes: finalNote, reviewed_by: userId, reviewed_at: new Date().toISOString(),
    }).eq("id", report.id);
    if (reportError) setError("The Post was removed, but the report status could not be updated: " + reportError.message);
    else setMessage("Post removed from user-facing feeds. The report record has been retained.");
    await loadDashboard(userId, role);
    setBusy("");
  }

  async function updateTicket(ticket: Ticket, status: string) {
    setBusy(ticket.id); setMessage(""); setError("");
    const { error: updateError } = await supabase.from("support_tickets").update({
      status, admin_notes: notes[ticket.id] ?? ticket.admin_notes ?? "",
      reviewed_by: userId, updated_at: new Date().toISOString(),
    }).eq("id", ticket.id);
    if (updateError) setError(updateError.message);
    else { setMessage("Complaint updated."); if (role) await loadDashboard(userId, role); }
    setBusy("");
  }

  const findPeople = useCallback(async (query: string) => {
    const q = query.trim();
    const requestId = ++searchRequest.current;
    if (!q) {
      setSearchResults([]);
      setSearching(false);
      setError("");
      return;
    }
    setSearching(true);
    setMessage("");
    setError("");

    // Search through a narrowly scoped owner-only database function. This avoids
    // profile-visibility/RLS filtering from hiding users from the owner search.
    const { data, error: searchError } = await supabase.rpc("search_gista_admin_users", {
      search_query: q,
    });
    if (requestId !== searchRequest.current) return;

    if (searchError) {
      setSearchResults([]);
      setError("Could not search Gista users: " + searchError.message);
      setSearching(false);
      return;
    }

    const merged = new Map<string, Profile>();
    ((data ?? []) as Profile[]).forEach((p) => merged.set(p.id, p));
    setSearchResults([...merged.values()].filter((p) => !admins.some((a) => a.user_id === p.id)));
    setSearching(false);
  }, [supabase, admins]);
  // Search as the owner types, including after the very first character.
  useEffect(() => {
    if (role !== "owner") return;
    const query = search.trim();
    if (!query) {
      searchRequest.current += 1;
      setSearchResults([]);
      setSearching(false);
      return;
    }
    const timer = window.setTimeout(() => { void findPeople(query); }, 250);
    return () => window.clearTimeout(timer);
  }, [search, role, findPeople]);
  async function addAdmin(person: Profile) {
    if (role !== "owner") return;
    setBusy(person.id); setError(""); setMessage("");
    const { error: insertError } = await supabase.from("gista_admins").insert({ user_id: person.id, role: "admin", added_by: userId });
    if (insertError) setError(insertError.message);
    else { setMessage("Admin access granted to @" + (person.username ?? person.display_name ?? "user") + "."); setSearchResults([]); setSearch(""); await loadDashboard(userId, "owner"); }
    setBusy("");
  }

  async function removeAdmin(admin: AdminRecord) {
    if (role !== "owner" || admin.role !== "admin") return;
    const profile = profiles[admin.user_id];
    if (!confirm("Remove Gista admin access from " + (profile?.username ? "@" + profile.username : profile?.display_name ?? "this account") + "?")) return;
    setBusy(admin.user_id); setError(""); setMessage("");
    const { error: deleteError } = await supabase.from("gista_admins").delete().eq("user_id", admin.user_id).eq("role", "admin");
    if (deleteError) setError(deleteError.message);
    else { setMessage("Admin access removed."); await loadDashboard(userId, "owner"); }
    setBusy("");
  }

  if (loading) return <main className="admin-page"><div className="admin-loading">Loading secure admin dashboard…</div></main>;
  if (!role) return <main className="admin-page"><section className="admin-denied"><div className="admin-lock">🔒</div><h1>Private area</h1><p>This account is not authorised to access Gista administration.</p><Link href="/">Return to Gista</Link></section></main>;

  const pendingReports = reports.filter((r) => r.status === "pending").length;
  const openTickets = tickets.filter((t) => t.status === "open" || t.status === "in_progress").length;
  const personName = (id: string) => profiles[id]?.username ? "@" + profiles[id].username : profiles[id]?.display_name ?? "Unknown user";
  const contentLabel = (r: Report) => r.post_id ? "Post" : r.response_id ? "Response" : r.reply_id ? "Reply" : r.target_user_id ? "User profile" : "Reported item";
  const contentId = (r: Report) => r.post_id ?? r.response_id ?? r.reply_id ?? "";
  const contentText = (r: Report) => content[contentId(r)]?.body ?? (r.target_user_id ? "Profile report" : "Content unavailable or no text attached.");

  return <main className="admin-page">
    <header className="admin-header"><Link className="admin-brand" href="/"><span className="admin-mark">G</span><span>Gista <small>ADMIN</small></span></Link><div className="admin-header-right"><span className={"admin-role "+(role==="owner"?"owner":"")}>{role==="owner"?"Founder / Owner":"Administrator"}</span><Link href="/admin/analytics">Analytics</Link><Link href="/settings">Exit admin</Link></div></header>
    <div className="admin-container">
      <div className="admin-title-row"><div><p className="admin-eyebrow">PRIVATE CONTROL CENTRE</p><h1>Admin dashboard</h1><p className="admin-subtitle">Review reports, respond to complaints, and keep Gista safe.</p></div><button style={button} onClick={() => role && void loadDashboard(userId, role)}>Refresh</button></div>
      <section className="admin-stats">
        <article><span>All reports</span><strong>{reports.length}</strong><small>{pendingReports} awaiting review</small></article>
        <article><span>Complaints</span><strong>{tickets.length}</strong><small>{openTickets} still open</small></article>
        <article><span>Content reviewed</span><strong>{reports.filter((r) => r.status !== "pending").length}</strong><small>Reports actioned or closed</small></article>
      </section>
      <nav className="admin-tabs">
        <button className={tab==="reports"?"active":""} onClick={()=>setTab("reports")}>Reports <b>{pendingReports}</b></button>
        <button className={tab==="complaints"?"active":""} onClick={()=>setTab("complaints")}>Complaints <b>{openTickets}</b></button>
        {role==="owner"&&<button className={tab==="access"?"active":""} onClick={()=>setTab("access")}>Admin access</button>}
      </nav>
      {message&&<div className="admin-message">{message}</div>}{error&&<div className="admin-error">{error}</div>}

      {tab==="reports"&&<section className="admin-list">
        <div className="admin-section-heading"><div><h2>Content reports</h2><p>Review user-submitted reports. Keep notes brief and factual.</p></div><span>{reports.length} total</span></div>
        {reports.length===0?<div className="admin-empty"><strong>No reports yet</strong><p>Reports submitted by users will appear here.</p></div>:reports.map((r)=><article className="admin-item" key={r.id}>
          <div className="admin-item-top"><span className={"admin-status status-"+r.status}>{r.status.replace("_"," ")}</span><time>{new Date(r.created_at).toLocaleString()}</time></div>
          <h3>{contentLabel(r)} reported: {r.reason}</h3>
          <p className="admin-content-preview">{contentText(r)}</p>
          {r.details&&<p className="admin-detail"><strong>Reporter’s details:</strong> {r.details}</p>}
          <div className="admin-meta"><span>Reported by <strong>{personName(r.reporter_id)}</strong></span>{r.target_user_id&&<span>Target <strong>{personName(r.target_user_id)}</strong></span>}{content[r.post_id??r.response_id??r.reply_id??""]?.author_id&&<span>Content author <strong>{personName(content[r.post_id??r.response_id??r.reply_id??""]!.author_id)}</strong></span>}</div>
          <label className="admin-field">Moderator notes<textarea value={notes[r.id]??r.moderation_notes??""} onChange={(e)=>setNotes((prev)=>({...prev,[r.id]:e.target.value}))} placeholder="Optional internal note…" maxLength={2000}/></label>
          <div className="admin-actions"><button disabled={busy===r.id} style={{...button,background:"#f3effb",color:"#5b21b6"}} onClick={()=>void updateReport(r,"reviewed")}>Mark reviewed</button><button disabled={busy===r.id} style={button} onClick={()=>void updateReport(r,"action_taken")}>Action taken</button>{r.post_id&&<button disabled={busy===r.id} style={{...button,background:"#b42318"}} onClick={()=>void removeReportedPost(r)}>Remove Post</button>}<button disabled={busy===r.id} className="admin-secondary" onClick={()=>void updateReport(r,"dismissed")}>Dismiss</button>{r.post_id&&<Link href={"/post/"+r.post_id} target="_blank" className="admin-link">View Post ↗</Link>}</div>
        </article>)}
      </section>}

      {tab==="complaints"&&<section className="admin-list">
        <div className="admin-section-heading"><div><h2>User complaints</h2><p>Track support requests from submission to resolution.</p></div><span>{tickets.length} total</span></div>
        {tickets.length===0?<div className="admin-empty"><strong>No complaints yet</strong><p>User support messages will appear here once submitted.</p></div>:tickets.map((t)=><article className="admin-item" key={t.id}>
          <div className="admin-item-top"><span className={"admin-status status-"+t.status}>{t.status.replace("_"," ")}</span><time>{new Date(t.created_at).toLocaleString()}</time></div>
          <h3>{t.subject}</h3><p className="admin-content-preview admin-ticket-message">{t.message}</p><div className="admin-meta"><span>From <strong>{personName(t.user_id)}</strong></span><span>Ticket <code>{t.id.slice(0,8)}</code></span></div>
          <label className="admin-field">Internal notes<textarea value={notes[t.id]??t.admin_notes??""} onChange={(e)=>setNotes((prev)=>({...prev,[t.id]:e.target.value}))} placeholder="Record what you checked or promised…" maxLength={3000}/></label>
          <div className="admin-actions"><button disabled={busy===t.id} style={{...button,background:"#f3effb",color:"#5b21b6"}} onClick={()=>void updateTicket(t,"in_progress")}>In progress</button><button disabled={busy===t.id} style={button} onClick={()=>void updateTicket(t,"resolved")}>Resolve</button><button disabled={busy===t.id} className="admin-secondary" onClick={()=>void updateTicket(t,"closed")}>Close</button></div>
        </article>)}
      </section>}

      {tab==="access"&&role==="owner"&&<section className="admin-list">
        <div className="admin-section-heading"><div><h2>Admin access</h2><p>You are the only owner. Only your owner account can grant or remove administrator access.</p></div><span>{admins.length} authorised</span></div>
        <div className="admin-owner-notice"><strong>Owner protection is active</strong><p>The founder/owner account cannot be removed or demoted from this screen. Added admins can manage reports and complaints, but cannot add or remove administrators.</p></div>
        <div className="admin-search"><label htmlFor="admin-person-search">Find an existing Gista user</label><div><input id="admin-person-search" value={search} onChange={(e)=>setSearch(e.target.value)} onKeyDown={(e)=>{if(e.key==="Enter")void findPeople(search)}} placeholder="Type a username or display name…"/><button style={button} onClick={()=>void findPeople(search)} disabled={searching}>{searching?"Searching…":"Search"}</button></div></div>
        {searching&&<p className="admin-subtitle">Searching Gista users…</p>}{!searching&&search.trim()&&searchResults.length===0&&!error&&<p className="admin-subtitle">No matching users found. Try another username or display name.</p>}{searchResults.map((p)=><div className="admin-person-result" key={p.id}><div><strong>{p.display_name||"Gista user"}</strong><small>{p.username?"@"+p.username:"No username"} · {p.id.slice(0,8)}</small></div><button style={button} disabled={busy===p.id} onClick={()=>void addAdmin(p)}>Grant admin</button></div>)}
        <h3 className="admin-roster-title">Authorised accounts</h3>
        {admins.map((a)=><div className="admin-person-result" key={a.user_id}><div><strong>{personName(a.user_id)}</strong><small>{a.role==="owner"?"Founder / Owner":"Administrator"} · Added {new Date(a.created_at).toLocaleDateString()}</small></div><span className={"admin-status "+(a.role==="owner"?"status-owner":"status-reviewed")}>{a.role}</span>{a.role==="admin"&&<button className="admin-secondary" disabled={busy===a.user_id} onClick={()=>void removeAdmin(a)}>Remove access</button>}</div>)}
      </section>}
      <p className="admin-footnote">Admin actions are restricted by database row-level security. Do not share this account; grant separate access only to people you trust.</p>
    </div>
  </main>;
}
