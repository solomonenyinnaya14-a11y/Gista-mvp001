"use client";

import { useEffect, useState } from "react";
import { Search as SearchIcon, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

const categories = ["Music","Movies / Entertainment","Art","Banter","Fun","Gossip","Sports","Relationships","Business","Technology","Education","Lifestyle","Society","News & Current Events","Opinions","Stories"];

export default function SearchPage() {
  const supabase = createClient();
  const [q, setQ] = useState("");
  const [tab, setTab] = useState("Gists");
  const [gists, setGists] = useState<any[]>([]);
  const [people, setPeople] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const timer = setTimeout(async () => {
      const term = q.trim();
      if (!term) {
        setGists([]);
        setPeople([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      const pattern = `%${term}%`;

      const [usernameResult, displayNameResult, bodyResult, categoryResult] = await Promise.all([
        supabase.from("profiles").select("id,username,display_name,bio,avatar_url").ilike("username", pattern).limit(20),
        supabase.from("profiles").select("id,username,display_name,bio").ilike("display_name", pattern).limit(20),
        supabase.from("posts").select("id,body,content_type,media_url,category,created_at,profiles(display_name,username,avatar_url)").ilike("body", pattern).order("created_at", { ascending: false }).limit(30),
        supabase.from("posts").select("id,body,content_type,media_url,category,created_at,profiles(display_name,username)").ilike("category", pattern).order("created_at", { ascending: false }).limit(30),
      ]);

      const peopleMap = new Map<string, any>();
      [...(usernameResult.data ?? []), ...(displayNameResult.data ?? [])].forEach((person) => peopleMap.set(person.id, person));

      const gistMap = new Map<string, any>();
      [...(bodyResult.data ?? []), ...(categoryResult.data ?? [])].forEach((post) => gistMap.set(post.id, post));

      setPeople([...peopleMap.values()].slice(0, 20));
      setGists([...gistMap.values()].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 30));
      setLoading(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [q, supabase]);

  return (
    <main className="content">
      <header className="simple-header"><Link href="/"><ArrowLeft size={18} /></Link><strong>Search</strong><span /></header>
      <div className="search-box"><SearchIcon size={18} /><input autoFocus value={q} onChange={(event) => setQ(event.target.value)} placeholder="Search Gists, people, categories…" /></div>
      <div className="feed-tabs">
        {["Gists","People","Categories"].map((item) => <button key={item} className={tab === item ? "tab active" : "tab"} onClick={() => setTab(item)}>{item}</button>)}
      </div>
      {loading ? <p>Searching…</p> : tab === "People" ? (
        <div className="feed">{people.map((person) => <Link className="post" key={person.id} href={"/profile/" + person.username}><div className="post-head"><div className="avatar">{person.avatar_url?<img src={person.avatar_url} alt="" style={{width:"100%",height:"100%",objectFit:"cover",borderRadius:"50%"}}/>:(person.display_name?.[0]?.toUpperCase() ?? "G")}</div><div className="identity"><strong>{person.display_name}</strong><span>@{person.username}</span></div></div><p className="bio">{person.bio}</p></Link>)}</div>
      ) : tab === "Categories" ? (
        <div className="category-grid">{categories.filter((item) => !q || item.toLowerCase().includes(q.toLowerCase())).map((item) => <button key={item} onClick={() => { setQ(item); setTab("Gists"); }}>{item}</button>)}</div>
      ) : (
        <div className="feed">{gists.map((post) => <Link className="post" key={post.id} href={"/gist/" + post.id}><div className="post-head"><div className="avatar">{post.profiles?.avatar_url?<img src={post.profiles.avatar_url} alt="" style={{width:"100%",height:"100%",objectFit:"cover",borderRadius:"50%"}}/>:(post.profiles?.display_name?.[0]?.toUpperCase() ?? "G")}</div><div className="identity"><strong>{post.profiles?.display_name ?? "Gista User"}</strong><span>@{post.profiles?.username ?? "user"} · {new Date(post.created_at).toLocaleString()}</span></div><span className="category">{post.category}</span></div>{post.content_type === "photo" && post.media_url && <img src={post.media_url} alt="Gist" style={{ width: "100%", borderRadius: 16 }} />}{post.content_type === "voice" && post.media_url && <audio controls src={post.media_url} />}{post.body && <p className="post-text">{post.body}</p>}</Link>)}</div>
      )}
    </main>
  );
}
