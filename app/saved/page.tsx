"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Bookmark, Heart, MessageCircle, Share2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import VoiceNote from "@/components/VoiceNote";

type Profile = {
  id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
};

type SavedPost = {
  id: string;
  body: string | null;
  content_type: string;
  media_url: string | null;
  category: string;
  created_at: string;
  author_id: string;
  voice_duration_seconds: number | null;
  profiles: Profile | null;
  likes: number;
  responses: number;
  shares: number;
  saves: number;
  liked: boolean;
  saved: boolean;
};

type SavedResponse = {
  id: string;
  post_id: string;
  body: string | null;
  content_type: string;
  media_url: string | null;
  created_at: string;
  author_id: string;
  profiles: Profile | null;
};

type EngagementCount = { post_id: string; share_count: number | string; save_count: number | string };

export default function SavedPage() {
  const supabase = useMemo(() => createClient(), []);
  const [posts, setPosts] = useState<SavedPost[]>([]);
  const [responses, setResponses] = useState<SavedResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError("");

      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user ?? null;
      if (!user) { window.location.assign("/auth"); return; }

      const [postSaveResult, responseSaveResult] = await Promise.all([
        supabase.from("saves").select("post_id,created_at").eq("user_id", user.id).order("created_at", { ascending: false }),
        supabase.from("response_saves").select("response_id,created_at").eq("user_id", user.id).order("created_at", { ascending: false }),
      ]);
      if (cancelled) return;

      if (postSaveResult.error || responseSaveResult.error) {
        setError(postSaveResult.error?.message ?? responseSaveResult.error?.message ?? "Saved content could not be loaded.");
        setLoading(false);
        return;
      }

      const postIds = (postSaveResult.data ?? []).map((item) => item.post_id);
      const responseIds = (responseSaveResult.data ?? []).map((item) => item.response_id);

      const [{ data: postRows, error: postError }, { data: responseRows, error: responseError }] = await Promise.all([
        postIds.length
          ? supabase.from("posts").select("id,body,content_type,media_url,category,created_at,author_id,voice_duration_seconds").in("id", postIds)
          : Promise.resolve({ data: [] as never[], error: null }),
        responseIds.length
          ? supabase.from("responses").select("id,post_id,body,content_type,media_url,created_at,author_id").in("id", responseIds)
          : Promise.resolve({ data: [] as never[], error: null }),
      ]);
      if (postError || responseError) {
        setError(postError?.message ?? responseError?.message ?? "Saved content could not be loaded.");
        setLoading(false);
        return;
      }

      const authorIds = [...new Set([
        ...(postRows ?? []).map((item) => item.author_id),
        ...(responseRows ?? []).map((item) => item.author_id),
      ])];

      const [profileResult, likesResult, responseCountsResult, engagementResult] = await Promise.all([
        authorIds.length
          ? supabase.from("profiles").select("id,display_name,username,avatar_url").in("id", authorIds)
          : Promise.resolve({ data: [], error: null }),
        postIds.length
          ? supabase.from("likes").select("post_id,user_id").in("post_id", postIds)
          : Promise.resolve({ data: [], error: null }),
        postIds.length
          ? supabase.from("responses").select("post_id").in("post_id", postIds)
          : Promise.resolve({ data: [], error: null }),
        postIds.length
          ? supabase.rpc("get_post_engagement_counts", { post_ids: postIds })
          : Promise.resolve({ data: [] as EngagementCount[], error: null }),
      ]);

      if (profileResult.error || engagementResult.error) {
        setError(profileResult.error?.message ?? engagementResult.error?.message ?? "Saved content could not be loaded.");
        setLoading(false);
        return;
      }

      const profilesById = new Map((profileResult.data ?? []).map((item) => [item.id, item as Profile]));
      const likeCounts = Object.fromEntries(postIds.map((postId) => [postId, 0]));
      const responseCounts = Object.fromEntries(postIds.map((postId) => [postId, 0]));
      const shareCounts = Object.fromEntries(postIds.map((postId) => [postId, 0]));
      const saveCounts = Object.fromEntries(postIds.map((postId) => [postId, 0]));

      (likesResult.data ?? []).forEach((item: { post_id: string }) => { likeCounts[item.post_id] = (likeCounts[item.post_id] ?? 0) + 1; });
      (responseCountsResult.data ?? []).forEach((item: { post_id: string }) => { responseCounts[item.post_id] = (responseCounts[item.post_id] ?? 0) + 1; });
      (engagementResult.data ?? []).forEach((item: EngagementCount) => {
        shareCounts[item.post_id] = Number(item.share_count) || 0;
        saveCounts[item.post_id] = Number(item.save_count) || 0;
      });

      const liked = new Set(
        (likesResult.data ?? [])
          .filter((item: { user_id: string }) => item.user_id === user.id)
          .map((item: { post_id: string }) => item.post_id),
      );

      const postById = new Map((postRows ?? []).map((item) => [item.id, item]));
      const orderedPosts = postIds
        .map((postId) => postById.get(postId))
        .filter((post): post is NonNullable<typeof post> => Boolean(post))
        .map((post) => ({
          ...post,
          profiles: profilesById.get(post.author_id) ?? null,
          likes: likeCounts[post.id] ?? 0,
          responses: responseCounts[post.id] ?? 0,
          shares: shareCounts[post.id] ?? 0,
          saves: saveCounts[post.id] ?? 0,
          liked: liked.has(post.id),
          saved: true,
        })) as SavedPost[];

      const responseById = new Map((responseRows ?? []).map((item) => [item.id, item]));
      const orderedResponses = responseIds
        .map((responseId) => responseById.get(responseId))
        .filter((response): response is NonNullable<typeof response> => Boolean(response))
        .map((response) => ({ ...response, profiles: profilesById.get(response.author_id) ?? null })) as SavedResponse[];

      if (cancelled) return;
      setPosts(orderedPosts);
      setResponses(orderedResponses);
      setLoading(false);
    }

    void load();
    return () => { cancelled = true; };
  }, [supabase]);

  async function toggleSave(post: SavedPost) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { window.location.assign("/auth"); return; }

    setBusy(post.id);
    const result = await supabase.from("saves").delete().eq("post_id", post.id).eq("user_id", user.id);
    if (result.error) {
      setError(result.error.message);
      setBusy(null);
      return;
    }

    setPosts((current) => current.filter((item) => item.id !== post.id));
    setBusy(null);
  }

  async function sharePost(post: SavedPost) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { window.location.assign("/auth"); return; }

    const url = window.location.origin + "/gist/" + post.id;
    try {
      if (navigator.share) {
        await navigator.share({ title: "Gista", text: post.body ?? "Join this Gist on Gista", url });
      } else {
        await navigator.clipboard.writeText(url);
      }

      const result = await supabase.from("shares").insert({ post_id: post.id, user_id: user.id });
      if (!result.error) {
        setPosts((current) => current.map((item) => item.id === post.id ? { ...item, shares: item.shares + 1 } : item));
      }
    } catch {
      // A cancelled share sheet should not create a share event.
    }
  }

  return (
    <main className="content">
      <header className="simple-header"><Link href="/"><ArrowLeft size={18} /></Link><strong>Saved</strong><Bookmark size={18} /></header>
      {loading ? <p>Loading saved Gists…</p> : error ? (
        <div className="empty-state"><Bookmark size={32} /><h2>We couldn&apos;t load your saved content</h2><p>{error}</p><button className="primary small" onClick={() => window.location.reload()}>Try again</button></div>
      ) : posts.length === 0 && responses.length === 0 ? (
        <div className="empty-state"><Bookmark size={32} /><h2>No saved content yet</h2><p>Save a Gist or response and it will appear here.</p><Link href="/">Discover Gists</Link></div>
      ) : (
        <div className="feed">
          {posts.map((post) => {
            const displayName = post.profiles?.display_name ?? "Gista User";
            const profileHref = post.profiles?.username ? "/profile/" + post.profiles.username : "/profile";
            return (
              <article className="post" key={"post-" + post.id}>
                <div className="post-head">
                  <Link href={profileHref} className="avatar" aria-label={"Open " + displayName + " profile"}>
                    {post.profiles?.avatar_url
                      ? <img src={post.profiles.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }} />
                      : displayName.charAt(0).toUpperCase()}
                  </Link>
                  <div className="identity">
                    <Link href={profileHref}><strong>{displayName}</strong></Link>
                    <span>@{post.profiles?.username ?? "user"} · {new Date(post.created_at).toLocaleString()}</span>
                  </div>
                  <span className="category">{post.category}</span>
                </div>

                {post.content_type === "photo" && post.media_url && <img src={post.media_url} alt="Saved Gist" loading="lazy" decoding="async" style={{ width: "100%", borderRadius: 16, marginTop: 10 }} />}
                {post.content_type === "voice" && post.media_url && <VoiceNote src={post.media_url} durationHint={post.voice_duration_seconds} />}
                {post.body && <p className="post-text">{post.body}</p>}

                <div className="gist-status"><span className="dot">●</span>Growing <Link href={"/gist/" + post.id}>Gist DNA</Link></div>

                <div className="actions">
                  <Link className="feed-action-link" href={"/gist/" + post.id}><Heart size={18} fill={post.liked ? "currentColor" : "none"} /> {post.likes}</Link>
                  <Link className="feed-action-link" href={"/gist/" + post.id}><MessageCircle size={18} /> {post.responses}</Link>
                  <button type="button" onClick={() => void sharePost(post)} aria-label="Share Gist"><Share2 size={18} /> {post.shares}</button>
                  <button type="button" className="saved-action" onClick={() => void toggleSave(post)} disabled={busy === post.id} aria-label="Unsave Gist"><Bookmark size={18} fill="currentColor" /> {post.saves}</button>
                </div>
              </article>
            );
          })}

          {responses.map((response) => {
            const displayName = response.profiles?.display_name ?? "Gista User";
            return (
              <Link className="post" key={"response-" + response.id} href={"/gist/" + response.post_id}>
                <div className="post-head">
                  <div className="avatar">
                    {response.profiles?.avatar_url
                      ? <img src={response.profiles.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }} />
                      : displayName.charAt(0).toUpperCase()}
                  </div>
                  <div className="identity"><strong>{displayName}</strong><span>@{response.profiles?.username ?? "user"} · Saved response</span></div>
                </div>
                {response.content_type === "voice" && response.media_url && <VoiceNote src={response.media_url} />}
                {response.body && <p className="post-text">{response.body}</p>}
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}
