"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Bookmark, Heart, Mic, MoreHorizontal, Share2, Square } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import VoiceNote from "@/components/VoiceNote";

type Profile = { id: string; display_name: string | null; username: string | null; avatar_url: string | null };
type Reply = { id: string; body: string | null; content_type: string; media_url: string | null; voice_duration_seconds: number | null; created_at: string; author_id: string; profiles: Profile | null; likes: number; liked: boolean };
type Comment = { id: string; body: string | null; content_type: string; media_url: string | null; voice_duration_seconds: number | null; created_at: string; author_id: string; profiles: Profile | null; replies: Reply[]; likes: number; liked: boolean };
type Post = { id: string; author_id: string; body: string | null; content_type: string; media_url: string | null; voice_duration_seconds: number | null; category: string; status: string | null; created_at: string; profiles: Profile | null };

function Avatar({ profile }: { profile: Profile | null }) {
  return <div className="avatar">{profile?.avatar_url ? <img src={profile.avatar_url} alt="" className="avatar-image" /> : profile?.display_name?.[0]?.toUpperCase() ?? "G"}</div>;
}

export default function PostPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [voice, setVoice] = useState<Blob | null>(null);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [likeCount, setLikeCount] = useState(0);
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showDna, setShowDna] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async (currentUserId: string | null) => {
    setError("");
    const [postResult, commentResult, likeResult, savedResult] = await Promise.all([
      supabase.from("posts").select("id,author_id,body,content_type,media_url,voice_duration_seconds,category,status,created_at").eq("id", id).single(),
      supabase.from("responses").select("id,body,content_type,media_url,voice_duration_seconds,created_at,author_id,replies(id,body,content_type,media_url,voice_duration_seconds,created_at,author_id)").eq("post_id", id).order("created_at", { ascending: true }),
      supabase.from("likes").select("post_id,user_id", { count: "exact" }).eq("post_id", id),
      currentUserId ? supabase.from("saves").select("post_id").eq("post_id", id).eq("user_id", currentUserId).maybeSingle() : Promise.resolve({ data: null, error: null }),
    ]);

    if (postResult.error) { setError(postResult.error.message); setLoading(false); return; }
    const rawPost = postResult.data as Omit<Post, "profiles">;
    const rawComments = (commentResult.data ?? []) as Array<Omit<Comment, "profiles" | "replies" | "likes" | "liked"> & { replies: Array<Omit<Reply, "profiles" | "likes" | "liked">> }>;
    if (commentResult.error) setError(commentResult.error.message);

    const commentIds = rawComments.map((item) => item.id);
    const replyIds = rawComments.flatMap((item) => (item.replies ?? []).map((reply) => reply.id));
    const authorIds = [rawPost.author_id, ...rawComments.map((item) => item.author_id), ...rawComments.flatMap((item) => (item.replies ?? []).map((reply) => reply.author_id))];
    const uniqueAuthorIds = [...new Set(authorIds)];

    const [profilesResult, commentLikesResult, replyLikesResult, myLikeResult] = await Promise.all([
      supabase.from("profiles").select("id,display_name,username,avatar_url").in("id", uniqueAuthorIds),
      commentIds.length ? supabase.from("response_likes").select("response_id,user_id").in("response_id", commentIds) : Promise.resolve({ data: [] as { response_id: string; user_id: string }[] }),
      replyIds.length ? supabase.from("reply_likes").select("reply_id,user_id").in("reply_id", replyIds) : Promise.resolve({ data: [] as { reply_id: string; user_id: string }[] }),
      currentUserId ? supabase.from("likes").select("post_id").eq("post_id", id).eq("user_id", currentUserId).maybeSingle() : Promise.resolve({ data: null, error: null }),
    ]);

    const profiles = new Map((profilesResult.data ?? []).map((profile) => [profile.id, profile as Profile]));
    const commentLikes: Record<string, number> = {};
    const replyLikes: Record<string, number> = {};
    const likedComments = new Set<string>();
    const likedReplies = new Set<string>();
    (commentLikesResult.data ?? []).forEach((item) => { commentLikes[item.response_id] = (commentLikes[item.response_id] ?? 0) + 1; if (item.user_id === currentUserId) likedComments.add(item.response_id); });
    (replyLikesResult.data ?? []).forEach((item) => { replyLikes[item.reply_id] = (replyLikes[item.reply_id] ?? 0) + 1; if (item.user_id === currentUserId) likedReplies.add(item.reply_id); });

    setPost({ ...rawPost, profiles: profiles.get(rawPost.author_id) ?? null });
    setLikeCount(likeResult.count ?? 0);
    setLiked(Boolean(myLikeResult.data));
    setSaved(Boolean(savedResult.data));
    setComments(rawComments.map((item) => ({
      ...item,
      profiles: profiles.get(item.author_id) ?? null,
      likes: commentLikes[item.id] ?? 0,
      liked: likedComments.has(item.id),
      replies: (item.replies ?? []).map((reply) => ({ ...reply, profiles: profiles.get(reply.author_id) ?? null, likes: replyLikes[reply.id] ?? 0, liked: likedReplies.has(reply.id) })),
    })));
    setLoading(false);
  }, [id, supabase]);

  useEffect(() => {
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      const uid = data.session?.user?.id ?? null;
      setUserId(uid);
      void load(uid);
    });
    return () => { active = false; };
  }, [load, supabase]);

  function authRequired() {
    if (userId) return true;
    router.push(`/auth?returnTo=${encodeURIComponent(`/post/${id}`)}`);
    return false;
  }

  async function togglePostLike() {
    if (!authRequired()) return;
    const next = !liked;
    setLiked(next); setLikeCount((count) => Math.max(0, count + (next ? 1 : -1)));
    const result = next ? await supabase.from("likes").insert({ post_id: id, user_id: userId }) : await supabase.from("likes").delete().eq("post_id", id).eq("user_id", userId);
    if (result.error) { setLiked(!next); setLikeCount((count) => Math.max(0, count + (next ? -1 : 1))); setError(result.error.message); }
  }

  async function toggleSave() {
    if (!authRequired()) return;
    const next = !saved;
    const result = next ? await supabase.from("saves").insert({ post_id: id, user_id: userId }) : await supabase.from("saves").delete().eq("post_id", id).eq("user_id", userId);
    if (result.error) setError(result.error.message); else setSaved(next);
  }

  async function sharePost() {
    if (!authRequired()) return;
    const url = `${window.location.origin}/post/${id}`;
    try {
      if (navigator.share) await navigator.share({ title: "Gista", text: post?.body ?? "Check out this post on Gista", url });
      else await navigator.clipboard.writeText(url);
      await supabase.from("shares").insert({ post_id: id, user_id: userId });
    } catch { /* user cancelled native share */ }
  }

  function stopRecording() {
    if (recorder.current?.state === "recording") recorder.current.stop();
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    setRecording(false);
  }

  async function startRecording() {
    if (!authRequired()) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      chunks.current = [];
      const mediaRecorder = new MediaRecorder(stream);
      recorder.current = mediaRecorder;
      let elapsed = 0;
      setSeconds(0);
      mediaRecorder.ondataavailable = (event) => { if (event.data.size) chunks.current.push(event.data); };
      mediaRecorder.onstop = () => { stream.getTracks().forEach((track) => track.stop()); setVoice(new Blob(chunks.current, { type: mediaRecorder.mimeType || "audio/webm" })); };
      mediaRecorder.start(); setRecording(true);
      timer.current = setInterval(() => { elapsed += 1; setSeconds(elapsed); if (elapsed >= 60) stopRecording(); }, 1000);
    } catch { setError("Microphone access is required for a voice comment."); }
  }

  async function postComment() {
    if (!authRequired()) return;
    if (!text.trim() && !voice) return;
    setError("");
    let mediaUrl: string | null = null;
    if (voice) {
      const path = `${userId}/${crypto.randomUUID()}.webm`;
      const upload = await supabase.storage.from("gist-audio").upload(path, voice, { contentType: voice.type || "audio/webm" });
      if (upload.error) { setError(upload.error.message); return; }
      mediaUrl = supabase.storage.from("gist-audio").getPublicUrl(path).data.publicUrl;
    }
    const result = await supabase.from("responses").insert({ post_id: id, author_id: userId, content_type: voice ? "voice" : "text", body: voice ? null : text.trim(), media_url: mediaUrl, voice_duration_seconds: voice ? seconds : null });
    if (result.error) { setError(result.error.message); return; }
    setText(""); setVoice(null); setSeconds(0); await load(userId);
  }

  async function toggleCommentLike(comment: Comment) {
    if (!authRequired()) return;
    const next = !comment.liked;
    const result = next ? await supabase.from("response_likes").insert({ response_id: comment.id, user_id: userId }) : await supabase.from("response_likes").delete().eq("response_id", comment.id).eq("user_id", userId);
    if (!result.error) setComments((items) => items.map((item) => item.id === comment.id ? { ...item, liked: next, likes: Math.max(0, item.likes + (next ? 1 : -1)) } : item));
    else setError(result.error.message);
  }

  if (loading) return <main className="content"><div className="feed-skeleton"><div className="skeleton-post" /><div className="skeleton-post" /></div></main>;
  if (!post) return <main className="content"><Link href="/">← Back Home</Link><div className="empty-state"><h3>Post not found</h3><p>{error || "This Post may have been removed."}</p></div></main>;

  return <main className="app-shell">
    <header className="simple-header"><button className="back-link" onClick={() => router.back()}><ArrowLeft size={18}/> <span>Back</span></button><strong>Post</strong><Link className="icon-btn" href="/settings" aria-label="Settings"><MoreHorizontal size={20}/></Link></header>
    <section className="content post-detail-content">
      <article className="post post-detail">
        <div className="post-head"><Link href={post.profiles?.username ? `/profile/${post.profiles.username}` : "/profile"}><Avatar profile={post.profiles}/></Link><div className="identity"><Link href={post.profiles?.username ? `/profile/${post.profiles.username}` : "/profile"}><strong>{post.profiles?.display_name ?? "Gista User"}</strong></Link><span>@{post.profiles?.username ?? "user"} · {new Date(post.created_at).toLocaleString()}</span></div><span className="category">{post.category}</span></div>
        {post.content_type === "photo" && post.media_url && <div className="post-media"><img src={post.media_url} alt="Post" /></div>}
        {post.content_type === "voice" && post.media_url && <VoiceNote src={post.media_url} durationHint={post.voice_duration_seconds ?? 0} />}
        {post.body && <p className="post-text">{post.body}</p>}
        <div className="post-meta"><button className="post-dna" type="button" onClick={() => setShowDna((value) => !value)}>Post DNA</button>{post.status && <span className="gist-status">{post.status}</span>}</div>
        {showDna && <div className="post-dna-panel"><strong>Post DNA</strong><div><span>Category</span><b>{post.category}</b></div><div><span>Comments</span><b>{comments.length}</b></div><div><span>Likes</span><b>{likeCount}</b></div><div><span>Format</span><b>{post.content_type}</b></div></div>}
        <div className="post-actions"><button type="button" onClick={() => void togglePostLike()}><Heart size={18} fill={liked ? "currentColor" : "none"}/><span>{likeCount}</span></button><button type="button" onClick={() => document.getElementById("comment-box")?.focus()}><span>💬</span><span>{comments.length}</span></button><button type="button" onClick={() => void sharePost()}><Share2 size={18}/></button><button type="button" onClick={() => void toggleSave()}><Bookmark size={18} fill={saved ? "currentColor" : "none"}/></button></div>
      </article>

      <section className="comments-section">
        <h2>Comments</h2>
        <div className="comment-composer"><textarea id="comment-box" value={text} onChange={(event) => setText(event.target.value)} placeholder="Write a comment..." rows={4}/><div className="comment-composer-actions"><button type="button" className={recording ? "voice-record recording" : "voice-record"} onClick={() => recording ? stopRecording() : void startRecording()}>{recording ? <><Square size={16} fill="currentColor"/> Stop {seconds}s</> : <><Mic size={17}/> Voice comment</>}</button><button type="button" className="primary" onClick={() => void postComment()} disabled={!text.trim() && !voice}>Post comment</button></div>{voice && <small>Voice comment ready ({seconds}s)</small>}</div>
        {error && <p className="auth-message">{error}</p>}
        <div className="comments-list">{comments.length === 0 ? <p className="profile-empty">No comments yet. Start the conversation.</p> : comments.map((comment) => <article className="comment" key={comment.id}><div className="comment-head"><Avatar profile={comment.profiles}/><div><strong>{comment.profiles?.display_name ?? "Gista User"}</strong><span>@{comment.profiles?.username ?? "user"} · {new Date(comment.created_at).toLocaleString()}</span></div></div>{comment.body && <p>{comment.body}</p>}{comment.content_type === "voice" && comment.media_url && <VoiceNote src={comment.media_url} durationHint={comment.voice_duration_seconds ?? 0}/>}<div className="comment-actions"><button type="button" onClick={() => void toggleCommentLike(comment)}><Heart size={16} fill={comment.liked ? "currentColor" : "none"}/> {comment.likes}</button><button type="button">Reply</button></div></article>)}</div>
      </section>
    </section>
  </main>;
}
