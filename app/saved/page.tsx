"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Bookmark } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function SavedPage() {
  const supabase = createClient();
  const [posts, setPosts] = useState<any[]>([]);
  const [responses, setResponses] = useState<any[]>([]);
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
      {loading ? <p>Loading saved Gists…</p> : posts.length === 0 && responses.length === 0 ? (
        <div className="empty-state"><Bookmark size={32} /><h2>No saved content yet</h2><p>Save a Gist or response and it will appear here.</p><Link href="/">Discover Gists</Link></div>
      ) : (
        <div className="feed">{posts.map((post) => <Link className="post" key={"post-" + post.id} href={"/gist/" + post.id}><div className="post-head"><div className="avatar">{post.profiles?.display_name?.[0]?.toUpperCase() ?? "G"}</div><div className="identity"><strong>{post.profiles?.display_name ?? "Gista User"}</strong><span>@{post.profiles?.username ?? "user"} · {new Date(post.created_at).toLocaleString()}</span></div><span className="category">{post.category}</span></div>{post.content_type === "photo" && post.media_url && <img src={post.media_url} alt="Saved Gist" style={{ width: "100%", borderRadius: 16 }} />}{post.content_type === "voice" && post.media_url && <audio controls src={post.media_url} style={{ width: "100%", marginTop: 10 }} />}{post.body && <p className="post-text">{post.body}</p>}</Link>)}{responses.map((response) => <Link className="post" key={"response-" + response.id} href={"/gist/" + response.post_id}><div className="post-head"><div className="avatar">{response.profiles?.display_name?.[0]?.toUpperCase() ?? "G"}</div><div className="identity"><strong>{response.profiles?.display_name ?? "Gista User"}</strong><span>@{response.profiles?.username ?? "user"} · Saved response</span></div></div>{response.content_type === "voice" && response.media_url && <audio controls src={response.media_url} style={{ width: "100%", marginTop: 10 }} />}{response.body && <p className="post-text">{response.body}</p>}</Link>)}</div>
      )}
    </main>
  );
}
