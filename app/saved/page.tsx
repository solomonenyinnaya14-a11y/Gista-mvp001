"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Bookmark } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Profile = { display_name: string | null; username: string | null };
type SavedPost = {
  id: string; body: string | null; content_type: string; media_url: string | null;
  category: string; created_at: string; profiles: Profile | Profile[] | null;
};
type SavedResponse = {
  id: string; post_id: string; body: string | null; content_type: string;
  media_url: string | null; created_at: string; profiles: Profile | Profile[] | null;
};

function profile(value: Profile | Profile[] | null): Profile | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}

export default function SavedPage() {
  const supabase = createClient();
  const [posts, setPosts] = useState<SavedPost[]>([]);
  const [responses, setResponses] = useState<SavedResponse[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { window.location.assign("/auth"); return; }

      const [postResult, responseResult] = await Promise.all([
        supabase.from("saves").select("post_id,posts(id,body,content_type,media_url,category,created_at,profiles(display_name,username))").eq("user_id", user.id).order("created_at", { ascending: false }),
        supabase.from("response_saves").select("response_id,responses(id,post_id,body,content_type,media_url,created_at,profiles(display_name,username))").eq("user_id", user.id).order("created_at", { ascending: false }),
      ]);
      if (cancelled) return;

      setPosts((postResult.data ?? []).map((item: { posts: SavedPost | SavedPost[] | null }) => Array.isArray(item.posts) ? item.posts[0] : item.posts).filter((item): item is SavedPost => Boolean(item)));
      setResponses((responseResult.data ?? []).map((item: { responses: SavedResponse | SavedResponse[] | null }) => Array.isArray(item.responses) ? item.responses[0] : item.responses).filter((item): item is SavedResponse => Boolean(item)));
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [supabase]);

  return (
    <main className="content">
      <header className="simple-header"><Link href="/"><ArrowLeft size={18} /></Link><strong>Saved</strong><Bookmark size={18} /></header>
      {loading ? <p>Loading saved Gists…</p> : posts.length === 0 && responses.length === 0 ? (
        <div className="empty-state"><Bookmark size={32} /><h2>No saved content yet</h2><p>Save a Gist or response and it will appear here.</p><Link href="/">Discover Gists</Link></div>
      ) : (
        <div className="feed">
          {posts.map((post) => { const p = profile(post.profiles); return (
            <Link className="post" key={"post-" + post.id} href={"/gist/" + post.id}>
              <div className="post-head"><div className="avatar">{p?.display_name?.[0]?.toUpperCase() ?? "G"}</div><div className="identity"><strong>{p?.display_name ?? "Gista User"}</strong><span>@{p?.username ?? "user"} · {new Date(post.created_at).toLocaleString()}</span></div><span className="category">{post.category}</span></div>
              {post.content_type === "photo" && post.media_url && <img src={post.media_url} alt="Saved Gist" style={{ width: "100%", borderRadius: 16 }} />}
              {post.content_type === "voice" && post.media_url && <audio controls src={post.media_url} style={{ width: "100%", marginTop: 10 }} />}
              {post.body && <p className="post-text">{post.body}</p>}
            </Link>
          ); })}
          {responses.map((response) => { const p = profile(response.profiles); return (
            <Link className="post" key={"response-" + response.id} href={"/gist/" + response.post_id}>
              <div className="post-head"><div className="avatar">{p?.display_name?.[0]?.toUpperCase() ?? "G"}</div><div className="identity"><strong>{p?.display_name ?? "Gista User"}</strong><span>@{p?.username ?? "user"} · Saved response</span></div></div>
              {response.content_type === "voice" && response.media_url && <audio controls src={response.media_url} style={{ width: "100%", marginTop: 10 }} />}
              {response.body && <p className="post-text">{response.body}</p>}
            </Link>
          ); })}
        </div>
      )}
    </main>
  );
}
