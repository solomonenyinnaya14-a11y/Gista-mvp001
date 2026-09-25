"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function AuthPage(){
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode,setMode]=useState<"login"|"signup">("login");
  const [email,setEmail]=useState("");
  const [password,setPassword]=useState("");
  const [message,setMessage]=useState(() => {
    const error = searchParams.get("error");
    if (error === "verification_failed") return "Email verification failed or the link has expired. Please request a new verification email.";
    if (error === "missing_verification_token") return "This verification link is incomplete. Please request a new verification email.";
    return "";
  });
  const [loading,setLoading]=useState(false);

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
        router.replace("/");
        router.refresh();
      }
    } else {
      // The production Site URL is used by Supabase for the confirmation email.
      // The email template sends a token_hash to /auth/confirm, so verification
      // works even when signup starts on localhost and the email is opened on
      // another device.
      const result=await supabase.auth.signUp({email,password});

      if(result.error){
        setMessage(result.error.message);
      } else if(result.data.session){
        setMessage("Account created.");
        router.replace("/");
        router.refresh();
      } else {
        setMessage("Check your email to verify your account.");
      }
    }

    setLoading(false);
  }

  return <main className="auth-page"><div className="auth-card"><div className="brand auth-brand"><div className="brand-icon">G</div><span>Gista</span></div><h1>{mode==="login"?"Welcome back":"Create your account"}</h1><p>Come talk. Express yourself. Join the Gist.</p><form onSubmit={submit}><label>Email<input type="email" required value={email} onChange={e=>setEmail(e.target.value)} /></label><label>Password<input type="password" required minLength={6} value={password} onChange={e=>setPassword(e.target.value)} /></label><button className="primary" disabled={loading}>{loading?"Please wait…":mode==="login"?"Log in":"Sign up"}</button></form>{message&&<div className="auth-message">{message}</div>}<button className="switch" onClick={()=>setMode(mode==="login"?"signup":"login")}>{mode==="login"?"New to Gista? Create an account":"Already have an account? Log in"}</button><Link className="forgot" href="/auth/forgot-password">Forgot password?</Link></div></main>
}
