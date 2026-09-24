"use client";
import {useState} from "react";
import {useRouter} from "next/navigation";
import {Mic,ImagePlus,Type} from "lucide-react";
import Link from "next/link";
import {createClient} from "@/lib/supabase/client";

const categories=["Music","Movies / Entertainment","Art","Banter","Fun","Gossip","Sports","Relationships","Business","Technology","Education","Lifestyle","Society","News & Current Events","Opinions","Stories"];
export default function CreatePage(){
 const [text,setText]=useState(""); const [category,setCategory]=useState(""); const [loading,setLoading]=useState(false); const [error,setError]=useState(""); const router=useRouter();
 async function post(){setError(""); if(!text.trim())return setError("Write something before posting."); if(!category)return setError("Choose a category."); setLoading(true); const supabase=createClient(); const {data:{user}}=await supabase.auth.getUser(); if(!user){router.push("/auth");return} const {error}=await supabase.from("posts").insert({author_id:user.id,content_type:"text",body:text.trim(),category,status:"growing"}); if(error)setError(error.message); else router.push("/"); setLoading(false)}
 return <main className="create-page"><header className="simple-header"><Link href="/">Cancel</Link><strong>Start a Gist</strong><button onClick={post} disabled={loading}>{loading?"Posting…":"Post"}</button></header><section className="create-card"><div className="avatar">G</div><textarea value={text} onChange={e=>setText(e.target.value)} maxLength={5000} placeholder="Say something worth sharing…"/><div className="format-row"><button type="button"><Type/>Text</button><button type="button" disabled><ImagePlus/>Photo</button><button type="button" disabled><Mic/>Voice</button></div><select value={category} onChange={e=>setCategory(e.target.value)}><option value="" disabled>Choose a category</option>{categories.map(x=><option key={x}>{x}</option>)}</select>{error&&<div className="auth-message">{error}</div>}</section></main>}