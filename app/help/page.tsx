"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const items = [
  ["How to use Gista", "/how-to-use", "Learn the basic Post, Comment and Reply flow and what each action means."],
  ["Account & profile", "/profile", "Edit your profile, profile photo and account information."],
  ["Safety", "/settings/blocked", "Block users and learn about reporting content."],
  ["Password & security", "/auth/forgot-password", "Reset your password and manage account access."],
];

type Ticket = { id: string; subject: string; message: string; status: string; created_at: string };

export default function HelpPage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [userId, setUserId] = useState("");
  const [authChecked, setAuthChecked] = useState(false);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!active) return;
      if (user) {
        setUserId(user.id);
        const { data } = await supabase.from("support_tickets").select("id,subject,message,status,created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(10);
        if (active) setTickets((data ?? []) as Ticket[]);
      }
      setAuthChecked(true);
    })();
    return () => { active = false; };
  }, [supabase]);

  async function submitComplaint(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(""); setNotice("");
    if (!userId) { router.push("/auth?returnTo=%2Fhelp"); return; }
    const cleanSubject = subject.trim();
    const cleanMessage = message.trim();
    if (cleanSubject.length < 3 || cleanSubject.length > 120) { setError("Subject must be between 3 and 120 characters."); return; }
    if (cleanMessage.length < 10 || cleanMessage.length > 5000) { setError("Please describe the issue in at least 10 characters (maximum 5,000)."); return; }
    setBusy(true);
    const { data, error: submitError } = await supabase.from("support_tickets").insert({ user_id: userId, subject: cleanSubject, message: cleanMessage }).select("id,subject,message,status,created_at").single();
    if (submitError) setError(submitError.message);
    else {
      setTickets((current) => [data as Ticket, ...current]);
      setSubject(""); setMessage("");
      setNotice("Your complaint has been sent to the Gista support team.");
    }
    setBusy(false);
  }

  return <main className="content">
    <header className="simple-header"><Link href="/settings">‹ Settings</Link><strong>Help Center</strong><span /></header>
    <section className="create-card"><h2>How can we help?</h2><p>Find quick answers or send a private message to the Gista team.</p></section>
    <section className="feed">{items.map(([title, href, description]) => <Link className="post" href={href} key={href}><strong>{title}</strong><p>{description}</p><span>Open →</span></Link>)}</section>
    <section className="create-card" style={{marginTop:18}}>
      <h2>Contact Gista support</h2>
      <p style={{color:"#77727f",fontSize:13,lineHeight:1.5}}>Report an account problem, safety concern, bug, or other complaint. This message is private and visible to authorised Gista administrators only.</p>
      {!authChecked ? <p>Checking your account…</p> : !userId ? <p><Link href="/auth?returnTo=%2Fhelp" style={{color:"#6d28d9",fontWeight:800}}>Log in</Link> to send a support request.</p> : <form onSubmit={submitComplaint} style={{display:"grid",gap:12}}>
        <label style={{display:"grid",gap:7,fontSize:13,fontWeight:750}}>Subject<input value={subject} onChange={(e)=>setSubject(e.target.value)} maxLength={120} minLength={3} required placeholder="What do you need help with?" style={{width:"100%",border:"1px solid #ddd8e6",borderRadius:12,padding:12,font:"inherit"}}/></label>
        <label style={{display:"grid",gap:7,fontSize:13,fontWeight:750}}>Details<textarea value={message} onChange={(e)=>setMessage(e.target.value)} maxLength={5000} minLength={10} required placeholder="Tell us what happened and what you need help with…" style={{width:"100%",minHeight:130,resize:"vertical",border:"1px solid #ddd8e6",borderRadius:12,padding:12,font:"inherit"}}/></label>
        <button className="primary" type="submit" disabled={busy}>{busy?"Sending…":"Send to Gista support"}</button>
      </form>}
      {notice&&<div className="auth-message" role="status">{notice}</div>}{error&&<div className="auth-message" role="alert" style={{background:"#fff0f0",color:"#b42318"}}>{error}</div>}
    </section>
    {tickets.length>0&&<section className="create-card"><h2>Your support requests</h2><div style={{display:"grid",gap:10}}>{tickets.map((t)=><article key={t.id} style={{border:"1px solid #eeeaf4",borderRadius:12,padding:12}}><div style={{display:"flex",justifyContent:"space-between",gap:8,alignItems:"center"}}><strong>{t.subject}</strong><span style={{fontSize:10,fontWeight:800,color:"#6d28d9",textTransform:"capitalize"}}>{t.status.replace("_"," ")}</span></div><p style={{fontSize:13,lineHeight:1.5,whiteSpace:"pre-wrap",overflowWrap:"anywhere"}}>{t.message}</p><small style={{color:"#8b8792"}}>Sent {new Date(t.created_at).toLocaleString()}</small></article>)}</div></section>}
  </main>;
}
