"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Bookmark } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import VoiceNote from "@/components/VoiceNote";

type Profile = { display_name: string | null; username: string | null };
type SavedPost = {
  id: string; body: string | null; content_type: string; media_url: string | null;
  category: string; created_at: string; author_id: string; profiles: Profile | null;
};
type SavedResponse = {
  id: string; post_id: string; body: string | null; content_type: string;
  media_url: string | null; created_at: string; author_id: string; profiles: Profile | null;
};

function profile(value: Profile | null): Profile | null {
  return value;
}

export default function SavedPage() {
  const supabase = useMemo(() => createClient(), []);
  const [posts, setPosts] = useState<SavedPost[]>([]);
  const [responses, setResponses] = useState<SavedResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user ?? null;
      if (!user) { window.location.assign("/auth"); return; }

      const [postSaveResult, responseSaveResult] = await Promise.all([
        supabase.from("saves").select("post_id,created_at").eq("user_id", user.id).order("created_at", { ascending: false }),
        supabase.from("response_saves").select("response_id,created_at").eq("user_id", user.id).order("created_at", { ascending: false }),
      ]);
      if (cancelled) return;

      const postIds = (postSaveResult.data ?? []).map((item) => item.post_id);
      const responseIds = (responseSaveResult.data ?? []).map((item) => item.response_id);

      const [{ data: postRows, error: postError }, { data: responseRows, error: responseError }] = await Promise.all([
        postIds.length ? supabase.from("posts").select("id,body,content_type,media_url,category,created_at,author_id").in("id", postIds) : Promise.resolve({ data: [], error: null }),
        responseIds.length ? supabase.from("responses").select("id,post_id,body,content_type,media_url,created_at,author_id").in("id", responseIds) : Promise.resolve({ data: [], error: null }),
      ]);
      if (postError || responseError || postSaveResult.error || responseSaveResult.error) {
        setError(
          postError?.message ??
          responseError?.message ??
          postSaveResult.error?.message ??
          responseSaveResult.error?.message ??
          "Saved content could not be loaded."
        );
        setLoading(false);
        return;
      }

      const authorIds = [...new Set([
        ...(postRows ?? []).map((item) => item.author_id),
        ...(responseRows ?? []).map((item) => item.author_id),
      ])];
      const { data: profileRows, error: profileError } = authorIds.length
        ? await supabase.from("profiles").select("id,display_name,username,avatar_url").in("id", authorIds)
        : { data: [], error: null };
      if (profileError) {
        setError(profileError.message);
        setLoading(false);
        return;
      }
      const profilesById = new Map((profileRows ?? []).map((item) => [item.id, item as Profile]));

      setPosts((postRows ?? []).map((item) => ({ ...item, profiles: profilesById.get(item.author_id) ?? null })) as SavedPost[]);
      setResponses((responseRows ?? []).map((item) => ({ ...item, profiles: profilesById.get(item.author_id) ?? null })) as SavedResponse[]);
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [supabase]);

  return (
    <main className="content">
      <header className="simple-header"><Link href="/"><ArrowLeft size={18} /></Link><strong>Saved</strong><Bookmark size={18} /></header>
      {loading ? <p>Loading saved Gists…</p> : error ? (
        <div className="empty-state"><Bookmark size={32} /><h2>We couldn&apos;t load your saved content</h2><p>{error}</p><button className="primary small" onClick={() => window.location.reload()}>Try again</button></div>
      ) : posts.length === 0 && responses.length === 0 ? (
        <div className="empty-state"><Bookmark size={32} /><h2>No saved content yet</h2><p>Save a Gist or response and it will appear here.</p><Link href="/">Discover Gists</Link></div>
      ) : (
        <div className="feed">
          {posts.map((post) => { const p = profile(post.profiles); return (
            <Link className="post" key={"post-" + post.id} href={"/gist/" + post.id}>
              <div className="post-head"><div className="avatar">{p?.display_name?.[0]?.toUpperCase() ?? "G"}</div><div className="identity"><strong>{p?.display_name ?? "Gista User"}</strong><span>@{p?.username ?? "user"} · {new Date(post.created_at).toLocaleString()}</span></div><span className="category">{post.category}</span></div>
              {post.content_type === "photo" && post.media_url && <img src={post.media_url} alt="Saved Gist" style={{ width: "100%", borderRadius: 16 }} />}
              {post.content_type === "voice" && post.media_url && <VoiceNote src={post.media_url} />}
              {post.body && <p className="post-text">{post.body}</p>}
            </Link>
          ); })}
          {responses.map((response) => { const p = profile(response.profiles); return (
            <Link className="post" key={"response-" + response.id} href={"/gist/" + response.post_id}>
              <div className="post-head"><div className="avatar">{p?.display_name?.[0]?.toUpperCase() ?? "G"}</div><div className="identity"><strong>{p?.display_name ?? "Gista User"}</strong><span>@{p?.username ?? "user"} · Saved response</span></div></div>
              {response.content_type === "voice" && response.media_url && <VoiceNote src={response.media_url} />}
              {response.body && <p className="post-text">{response.body}</p>}
            </Link>
          ); })}
        </div>
      )}
    </main>
  );
}
