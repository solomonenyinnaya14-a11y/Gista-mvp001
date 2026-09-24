"use client";
import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPassword(){
 const [email,setEmail]=useState(""); const [message,setMessage]=useState(""); const [loading,setLoading]=useState(false);
 async function submit(e:React.FormEvent){e.preventDefault();setLoading(true);const {error}=await createClient().auth.resetPasswordForEmail(email,{redirectTo:typeof window!=="undefined"?window.location.origin+"/auth/reset-password":undefined});setMessage(error?.message??"If an account exists for this email, a reset link has been sent.");setLoading(false);}
 return <main className="auth-page"><div className="auth-card"><div className="brand auth-brand"><div className="brand-icon">G</div><span>Gista</span></div><h1>Reset your password</h1><p>Enter your email and we’ll send a reset link.</p><form onSubmit={submit}><label>Email<input type="email" required value={email} onChange={e=>setEmail(e.target.value)}/></label><button className="primary" disabled={loading}>{loading?"Sending…":"Send reset link"}</button></form>{message&&<div className="auth-message">{message}</div>}<Link className="forgot" href="/auth">Back to login</Link></div></main>}