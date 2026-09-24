"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Bookmark } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function SavedPage() {
  const supabase = createClient();
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        window.location.assign("/auth");
        return;
      }
      const { data } = await supabase.from("saves").select("post_id,posts(id,body,content_type,media_url,category,created_at,profiles(display_name,username))").eq("user_id", user.id).order("created_at", { ascending: false });
      setPosts((data ?? []).map((item: any) => item.posts).filter(Boolean));
      setLoading(false);
    }
    load();
  }, [supabase]);

  return (
    <main className="content">
      <header className="simple-header"><Link href="/"><ArrowLeft size={18} /></Link><strong>Saved</strong><Bookmark size={18} /></header>
      {loading ? <p>Loading saved Gists…</p> : posts.length === 0 ? (
        <div className="empty-state"><Bookmark size={32} /><h2>No saved Gists yet</h2><p>Save a Gist and it will appear here.</p><Link href="/">Discover Gists</Link></div>
      ) : (
        <div className="feed">{posts.map((post) => <Link className="post" key={post.id} href={"/gist/" + post.id}><div className="post-head"><div className="avatar">{post.profiles?.display_name?.[0]?.toUpperCase() ?? "G"}</div><div className="identity"><strong>{post.profiles?.display_name ?? "Gista User"}</strong><span>@{post.profiles?.username ?? "user"} · {new Date(post.created_at).toLocaleString()}</span></div><span className="category">{post.category}</span></div>{post.content_type === "photo" && post.media_url && <img src={post.media_url} alt="Saved Gist" style={{ width: "100%", borderRadius: 16 }} />}{post.content_type === "voice" && post.media_url && <audio controls src={post.media_url} style={{ width: "100%", marginTop: 10 }} />}{post.body && <p className="post-text">{post.body}</p>}</Link>)}</div>
      )}
    </main>
  );
}
