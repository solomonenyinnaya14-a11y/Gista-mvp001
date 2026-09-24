"use client";
import Link from "next/link";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function AuthPage(){
  const [mode,setMode]=useState<"login"|"signup">("login");
  const [email,setEmail]=useState("");
  const [password,setPassword]=useState("");
  const [message,setMessage]=useState("");
  const [loading,setLoading]=useState(false);
  async function submit(e:React.FormEvent){
    e.preventDefault(); setLoading(true); setMessage("");
    const supabase=createClient();
    const result=mode==="login"
      ? await supabase.auth.signInWithPassword({email,password})
      : await supabase.auth.signUp({email,password});
    setMessage(result.error?.message ?? (mode==="signup" ? "Check your email to verify your account." : "Signed in."));
    setLoading(false);
  }
  return <main className="auth-page"><div className="auth-card"><div className="brand auth-brand"><div className="brand-icon">G</div><span>Gista</span></div><h1>{mode==="login"?"Welcome back":"Create your account"}</h1><p>Come talk. Express yourself. Join the Gist.</p><form onSubmit={submit}><label>Email<input type="email" required value={email} onChange={e=>setEmail(e.target.value)} /></label><label>Password<input type="password" required minLength={6} value={password} onChange={e=>setPassword(e.target.value)} /></label><button className="primary" disabled={loading}>{loading?"Please wait…":mode==="login"?"Log in":"Sign up"}</button></form>{message&&<div className="auth-message">{message}</div>}<button className="switch" onClick={()=>setMode(mode==="login"?"signup":"login")}>{mode==="login"?"New to Gista? Create an account":"Already have an account? Log in"}</button><Link className="forgot" href="/auth/forgot-password">Forgot password?</Link></div></main>}