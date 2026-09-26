"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

function safeNextPath(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
}

export default function AuthPage(){
  const router = useRouter();
  const [mode,setMode]=useState<"login"|"signup">("login");
  const [email,setEmail]=useState("");
  const [password,setPassword]=useState("");
  const [message,setMessage]=useState("");
  const [loading,setLoading]=useState(false);
  const [returnTo,setReturnTo]=useState("/");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const queryReturnTo = params.get("returnTo");
    if (queryReturnTo) {
      setReturnTo(safeNextPath(queryReturnTo));
    } else if (document.referrer) {
      try {
        const referrer = new URL(document.referrer);
        if (referrer.origin === window.location.origin && referrer.pathname.startsWith("/gist/")) {
          setReturnTo(referrer.pathname + referrer.search + referrer.hash);
        }
      } catch {
        // Ignore malformed referrers and keep the safe default.
      }
    }

    const error = params.get("error");
    if (error === "verification_failed") {
      setMessage("Email verification failed or the link has expired. Please request a new verification email.");
    } else if (error === "missing_verification_token") {
      setMessage("This verification link is incomplete. Please request a new verification email.");
    }
  }, []);

  function goBackToDestination() {
    router.replace(safeNextPath(returnTo));
    router.refresh();
  }

  async function submit(e:React.FormEvent){
    e.preventDefault();
    setLoading(true);
    setMessage("");

    const supabase=createClient();

    if(mode==="login"){
      const result=await supabase.auth.signInWithPassword({email,password});
      if(result.error){
        setMessage(result.error.message);
      } else {
        setMessage("Signed in.");
        goBackToDestination();
      }
    } else {
      // Keep the shared Gist as the destination after email verification.
      const emailRedirectTo = `${window.location.origin}/auth/confirm?next=${encodeURIComponent(safeNextPath(returnTo))}`;
      const result=await supabase.auth.signUp({email,password,options:{emailRedirectTo}});

      if(result.error){
        setMessage(result.error.message);
      } else if(result.data.session){
        setMessage("Account created.");
        goBackToDestination();
      } else {
        setMessage("Check your email to verify your account. You’ll return to the Gist after verification.");
      }
    }

    setLoading(false);
  }

  return <main className="auth-page"><div className="auth-card"><div className="brand auth-brand"><div className="brand-icon">G</div><span>Gista</span></div><h1>{mode==="login"?"Welcome back":"Create your account"}</h1><p>Come talk. Express yourself. Join the Gist.</p><form onSubmit={submit}><label>Email<input type="email" required value={email} onChange={e=>setEmail(e.target.value)} /></label><label>Password<input type="password" required minLength={6} value={password} onChange={e=>setPassword(e.target.value)} /></label><button className="primary" disabled={loading}>{loading?"Please wait…":mode==="login"?"Log in":"Sign up"}</button></form>{message&&<div className="auth-message">{message}</div>}<button className="switch" onClick={()=>setMode(mode==="login"?"signup":"login")}>{mode==="login"?"New to Gista? Create an account":"Already have an account? Log in"}</button><Link className="forgot" href="/auth/forgot-password">Forgot password?</Link></div></main>
}
