"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Heart, Mic, Square } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import VoiceNote from "@/components/VoiceNote";

type Profile = { display_name: string | null; username: string | null; avatar_url: string | null };
type RawProfile = Profile | Profile[] | null | undefined;
type Reply = { id: string; body: string | null; content_type: string; media_url: string | null; voice_duration_seconds: number | null; created_at: string; author_id: string; profiles: Profile | null };
type RawReply = Omit<Reply, "profiles"> & { profiles: RawProfile };
type Response = { id: string; body: string | null; content_type: string; media_url: string | null; voice_duration_seconds: number | null; created_at: string; author_id: string; profiles: Profile | null; replies: Reply[] };
type Post = { id: string; author_id: string; body: string | null; content_type: string; media_url: string | null; voice_duration_seconds: number | null; category: string; status: string; created_at: string; profiles: Profile | null };

function ProfileAvatar({ profile, fallbackAvatarUrl }: { profile: Profile | null; fallbackAvatarUrl?: string | null }) {
  const avatarUrl = profile?.avatar_url ?? fallbackAvatarUrl ?? null;
  return (
    <div className="avatar">
      {avatarUrl ? <img src={avatarUrl} alt="" className="avatar-image" /> : profile?.display_name?.[0]?.toUpperCase() ?? "G"}
    </div>
  );
}

export default function GistPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [post, setPost] = useState<Post | null>(null);
  const [responses, setResponses] = useState<Response[]>([]);
  const [text, setText] = useState("");
  const [voice, setVoice] = useState<Blob | null>(null);
  const [voicePreviewUrl, setVoicePreviewUrl] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);
  const [likeCount, setLikeCount] = useState(0);
  const [savedResponses, setSavedResponses] = useState<Set<string>>(new Set());
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [now] = useState(() => Date.now());
  const [showDna, setShowDna] = useState(false);
  const [menu, setMenu] = useState(false);
  const [openReply, setOpenReply] = useState<string | null>(null);
  const [replyText, setReplyText] = useState<Record<string, string>>({});
  const [replyVoice, setReplyVoice] = useState<Record<string, Blob | null>>({});
  const [replyRecording, setReplyRecording] = useState<string | null>(null);
  const [replySeconds, setReplySeconds] = useState<Record<string, number>>({});

  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const replyRecorder = useRef<MediaRecorder | null>(null);
  const replyChunks = useRef<Blob[]>([]);
  const replyTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!voice) { setVoicePreviewUrl(null); return; }
    const url = URL.createObjectURL(voice);
    setVoicePreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [voice]);

  function storagePath(url: string | null, bucket: string) {
    if (!url) return null;
    const marker = `/storage/v1/object/public/${bucket}/`;
    const index = url.indexOf(marker);
    return index === -1 ? null : decodeURIComponent(url.slice(index + marker.length));
  }

  async function load(currentUserId: string | null = userId) {
    const [postResult, responseResult, likeResult, responseSaveResult] = await Promise.all([
      supabase.from("posts").select("id,author_id,body,content_type,media_url,voice_duration_seconds,category,status,created_at").eq("id", id).single(),
      supabase.from("responses").select("id,body,content_type,media_url,voice_duration_seconds,created_at,author_id,replies(id,body,content_type,media_url,voice_duration_seconds,created_at,author_id)").eq("post_id", id).order("created_at", { ascending: true }),
      supabase.from("likes").select("post_id", { count: "exact", head: true }).eq("post_id", id),
      currentUserId ? supabase.from("response_saves").select("response_id").eq("user_id", currentUserId) : Promise.resolve({ data: [] as { response_id: string }[] }),
    ]);

    if (postResult.error) setError(postResult.error.message);
    const rawPost = postResult.data as Omit<Post, "profiles"> | null;
    const rawResponses = (responseResult.data ?? []) as Array<Omit<Response, "profiles" | "replies"> & { replies: Omit<Reply, "profiles">[] }>;
    const authorIds = [
      ...(rawPost?.author_id ? [rawPost.author_id] : []),
      ...rawResponses.map((item) => item.author_id),
      ...rawResponses.flatMap((item) => (item.replies ?? []).map((reply) => reply.author_id)),
    ];
    const uniqueAuthorIds = [...new Set(authorIds)];
    const { data: profileRows, error: profileError } = uniqueAuthorIds.length
      ? await supabase.from("profiles").select("id,display_name,username,avatar_url").in("id", uniqueAuthorIds)
      : { data: [], error: null };
    if (profileError) { setError(profileError.message); setLoading(false); return; }
    const profilesById = new Map((profileRows ?? []).map((item) => [item.id, item as Profile]));
    setPost(rawPost ? { ...rawPost, profiles: profilesById.get(rawPost.author_id) ?? null } : null);
    setLikeCount(likeResult.count ?? 0);
    setSavedResponses(new Set((responseSaveResult.data ?? []).map((item: { response_id: string }) => item.response_id)));
    setResponses(rawResponses.map((item) => ({
      ...item,
      profiles: profilesById.get(item.author_id) ?? null,
      replies: (item.replies ?? []).map((reply) => ({ ...reply, profiles: profilesById.get(reply.author_id) ?? null })),
    })));
    setLoading(false);
  }

  useEffect(() => {
    let cancelled = false;
    async function initialize() {
      const { data: sessionData } = await supabase.auth.getSession();
      const currentUserId = sessionData.session?.user?.id ?? null;
      if (cancelled) return;
      setUserId(currentUserId);
      await load(currentUserId);
    }
    initialize();
    return () => { cancelled = true; };
  }, [id]);

  function stopVoice() {
    if (recorder.current?.state === "recording") recorder.current.stop();
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    setRecording(false);
  }

  async function startVoice() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      chunks.current = [];
      const mediaRecorder = new MediaRecorder(stream);
      recorder.current = mediaRecorder;
      let elapsed = 0;
      setSeconds(0);
      mediaRecorder.ondataavailable = (event) => { if (event.data.size) chunks.current.push(event.data); };
      mediaRecorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        setVoice(new Blob(chunks.current, { type: mediaRecorder.mimeType || "audio/webm" }));
      };
      mediaRecorder.start();
      setRecording(true);
      timer.current = setInterval(() => { elapsed += 1; setSeconds(elapsed); if (elapsed >= 60) stopVoice(); }, 1000);
    } catch { setError("Microphone access is required."); }
  }

  async function respond() {
    setError("");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/auth"); return; }
    if (!text.trim() && !voice) return;
    if (voice && seconds < 1) { setError("Record at least 1 second of voice."); return; }

    let media_url: string | null = null;
    if (voice) {
      const path = user.id + "/" + crypto.randomUUID() + ".webm";
      const upload = await supabase.storage.from("gist-audio").upload(path, voice, { contentType: voice.type || "audio/webm" });
      if (upload.error) { setError(upload.error.message); return; }
      media_url = supabase.storage.from("gist-audio").getPublicUrl(path).data.publicUrl;
    }

    const { error: insertError } = await supabase.from("responses").insert({ post_id: id, author_id: user.id, content_type: voice ? "voice" : "text", body: voice ? null : text.trim(), media_url, voice_duration_seconds: voice ? seconds : null });
    if (insertError) {
      if (media_url) { const path = storagePath(media_url, "gist-audio"); if (path) await supabase.storage.from("gist-audio").remove([path]); }
      setError(insertError.message);
    } else {
      setText(""); setVoice(null); setSeconds(0); await load();
    }
  }

  function stopReplyVoice() {
    if (replyRecorder.current?.state === "recording") replyRecorder.current.stop();
    if (replyTimer.current) clearInterval(replyTimer.current);
    replyTimer.current = null;
    setReplyRecording(null);
  }

  async function startReplyVoice(responseId: string) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      replyChunks.current = [];
      const mediaRecorder = new MediaRecorder(stream);
      replyRecorder.current = mediaRecorder;
      let elapsed = 0;
      setReplySeconds((current) => ({ ...current, [responseId]: 0 }));
      mediaRecorder.ondataavailable = (event) => { if (event.data.size) replyChunks.current.push(event.data); };
      mediaRecorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        setReplyVoice((current) => ({ ...current, [responseId]: new Blob(replyChunks.current, { type: mediaRecorder.mimeType || "audio/webm" }) }));
      };
      mediaRecorder.start();
      setReplyRecording(responseId);
      replyTimer.current = setInterval(() => { elapsed += 1; setReplySeconds((current) => ({ ...current, [responseId]: elapsed })); if (elapsed >= 60) stopReplyVoice(); }, 1000);
    } catch { setError("Microphone access is required."); }
  }

  async function postReply(response: Response) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/auth"); return; }
    const body = (replyText[response.id] ?? "").trim();
    const voiceReply = replyVoice[response.id] ?? null;
    if (!body && !voiceReply) return;

    let media_url: string | null = null;
    if (voiceReply) {
      const path = user.id + "/" + crypto.randomUUID() + ".webm";
      const upload = await supabase.storage.from("gist-audio").upload(path, voiceReply, { contentType: voiceReply.type || "audio/webm" });
      if (upload.error) { setError(upload.error.message); return; }
      media_url = supabase.storage.from("gist-audio").getPublicUrl(path).data.publicUrl;
    }

    const { error: insertError } = await supabase.from("replies").insert({ response_id: response.id, author_id: user.id, content_type: voiceReply ? "voice" : "text", body: voiceReply ? null : body, media_url, voice_duration_seconds: voiceReply ? (replySeconds[response.id] ?? 0) : null });
    if (insertError) setError(insertError.message);
    else { setReplyText((current) => ({ ...current, [response.id]: "" })); setReplyVoice((current) => ({ ...current, [response.id]: null })); setOpenReply(null); await load(); }
  }

  async function deleteGist() {
    if (!userId || !post || userId !== post.author_id) return;
    if (!confirm("Delete this Gist? This cannot be undone.")) return;
    setError("");
    const result = await supabase.from("posts").delete().eq("id", id).eq("author_id", userId);
    if (result.error) { setError(result.error.message); return; }
    const bucket = post.content_type === "photo" ? "gist-media" : post.content_type === "voice" ? "gist-audio" : null;
    const path = bucket ? storagePath(post.media_url, bucket) : null;
    if (bucket && path) await supabase.storage.from(bucket).remove([path]);
    setMenu(false); router.push("/");
  }

  if (loading) return <main className="content"><p>Loading Gist…</p></main>;
  if (!post) return <main className="content"><p>Gist not found.</p></main>;

  const voiceResponses = responses.filter((item) => item.content_type === "voice").length;
  const textResponses = responses.length - voiceResponses;
  const participants = new Set([post.author_id, ...responses.map((item) => item.author_id)]).size;
  const ageHours = Math.max(1, (now - new Date(post.created_at).getTime()) / 3600000);
  const growth = (responses.length / ageHours).toFixed(1);

  return (
    <main className="content">
      <button onClick={() => router.back()}>← Back</button>
      <article className="post gist-detail-post">
        <div className="post-head">
          <button type="button" onClick={() => setMenu((value) => !value)} aria-label="More options">⋯</button>
          <ProfileAvatar profile={post.profiles} />
          <div className="identity"><strong>{post.profiles?.display_name ?? "Gista User"}</strong><span>@{post.profiles?.username ?? "user"} · {new Date(post.created_at).toLocaleString()}</span></div>
          <span className="category">{post.category}</span>
        </div>
        {menu && <div className="action-menu">
          {userId === post.author_id ? <button className="danger" onClick={deleteGist}>Delete Gist</button> : <>
            <button onClick={async () => { const reason = prompt("Why are you reporting this Gist?"); if (!reason || !userId) return; const result = await supabase.from("reports").insert({ reporter_id: userId, post_id: id, reason }); if (result.error) setError(result.error.message); else { setMenu(false); setError("Report submitted."); } }}>Report Gist</button>
            <button onClick={async () => { if (!userId) { router.push("/auth"); return; } const result = await supabase.from("blocks").insert({ blocker_id: userId, blocked_id: post.author_id }); if (result.error) setError(result.error.message); else { setMenu(false); router.push("/"); } }}>Block author</button>
            <button onClick={async () => { if (!userId) { router.push("/auth"); return; } const result = await supabase.from("not_interested").insert({ user_id: userId, post_id: id }); if (result.error && result.error.code !== "23505") setError(result.error.message); else { setMenu(false); router.push("/"); } }}>Not Interested</button>
          </>}
        </div>}
        {post.content_type === "photo" && post.media_url && <img src={post.media_url} alt="Gist" className="gist-media" />}
        {post.content_type === "voice" && post.media_url && <VoiceNote src={post.media_url} durationHint={post.voice_duration_seconds} />}
        {post.body && <p className="post-text">{post.body}</p>}
        <div className="gist-meta">
          <span className="gist-like-meta"><Heart size={18} fill="currentColor" aria-hidden="true" /> {likeCount} Likes</span>
          <span>💬 {responses.length} Responses</span>
          <button type="button" onClick={() => setShowDna(true)}>Gist DNA</button>
        </div>
      </article>

      {showDna && <div className="modal-backdrop" onClick={() => setShowDna(false)}>
        <div className="modal-card" onClick={(event) => event.stopPropagation()}>
          <div className="modal-header"><div><h2>Gist DNA</h2><p>Activity and participation in this Gist.</p></div><button onClick={() => setShowDna(false)}>×</button></div>
          <div className="dna-grid">
            <div><strong>{post.status === "trending" ? "🔥 Trending" : post.status === "active" ? "🔵 Active" : "🟢 Growing"}</strong><span>Status</span></div>
            <div><strong>{participants}</strong><span>Participants</span></div>
            <div><strong>{responses.length}</strong><span>Responses</span></div>
            <div><strong>{growth}/hr</strong><span>Response growth</span></div>
            <div><strong>{voiceResponses}</strong><span>Voice responses</span></div>
            <div><strong>{textResponses}</strong><span>Text responses</span></div>
            <div><strong>{Math.round((voiceResponses / Math.max(1, responses.length)) * 100)}%</strong><span>Voice mix</span></div>
            <div><strong>{Math.round((textResponses / Math.max(1, responses.length)) * 100)}%</strong><span>Text mix</span></div>
          </div>
        </div>
      </div>}

      <section className="create-card">
        <h3>Join the Gist</h3>
        <textarea value={text} onChange={(event) => setText(event.target.value)} placeholder="Write a response…" />
        {recording ? <button type="button" className="primary" onClick={stopVoice}><Square /> Stop {seconds}s / 60s</button> : <button type="button" onClick={startVoice}><Mic /> {voice ? "Record again" : "Voice response"}</button>}
        {voicePreviewUrl && <VoiceNote src={voicePreviewUrl} durationHint={seconds || null} />}
        <button className="primary" onClick={respond}>Post response</button>
        {error && <div className="auth-message">{error}</div>}
      </section>

      <section className="feed">
        <h3>{responses.length} {responses.length === 1 ? "Response" : "Responses"}</h3>
        {responses.length === 0 ? <p>No responses yet. Start the Gist.</p> : responses.map((response) => (
          <article className="post" key={response.id}>
            <div className="post-head"><ProfileAvatar profile={response.profiles} fallbackAvatarUrl={response.author_id === post.author_id ? post.profiles?.avatar_url : null} /><div className="identity"><strong>{response.profiles?.display_name ?? "Gista User"}</strong><span>@{response.profiles?.username ?? "user"} · {new Date(response.created_at).toLocaleString()}</span></div></div>
            {response.content_type === "photo" && response.media_url && <img src={response.media_url} alt="Response" className="response-media" />}
            {response.body && <p className="post-text">{response.body}</p>}
            {response.content_type === "voice" && response.media_url && <VoiceNote src={response.media_url} durationHint={response.voice_duration_seconds} />}
            <button className="response-reply" onClick={() => setOpenReply(openReply === response.id ? null : response.id)}>Reply</button>
            {userId && <button className="response-reply" onClick={async () => { const reason = prompt("Why are you reporting this response?"); if (!reason) return; const result = await supabase.from("reports").insert({ reporter_id: userId, response_id: response.id, reason }); if (result.error) setError(result.error.message); else setError("Response report submitted."); }}>Report</button>}
            {userId && <button className="response-reply" onClick={async () => { const saved = savedResponses.has(response.id); const result = saved ? await supabase.from("response_saves").delete().eq("user_id", userId).eq("response_id", response.id) : await supabase.from("response_saves").insert({ user_id: userId, response_id: response.id }); if (result.error) setError(result.error.message); else setSavedResponses((current) => { const next = new Set(current); if (saved) next.delete(response.id); else next.add(response.id); return next; }); }}>{savedResponses.has(response.id) ? "Unsave" : "Save"}</button>}
            {userId === response.author_id && <button className="response-reply" onClick={async () => { if (!confirm("Delete this response?")) return; const result = await supabase.from("responses").delete().eq("id", response.id).eq("author_id", userId); if (result.error) setError(result.error.message); else { const bucket = response.content_type === "photo" ? "gist-media" : response.content_type === "voice" ? "gist-audio" : null; const path = bucket ? storagePath(response.media_url, bucket) : null; if (bucket && path) await supabase.storage.from(bucket).remove([path]); await load(); } }}>Delete</button>}
            {openReply === response.id && <div className="reply-box">
              <textarea value={replyText[response.id] ?? ""} onChange={(event) => setReplyText((current) => ({ ...current, [response.id]: event.target.value }))} placeholder="Write a reply…" />
              {replyRecording === response.id ? <button type="button" onClick={stopReplyVoice}>Stop voice ({replySeconds[response.id] ?? 0}s / 60s)</button> : <button type="button" onClick={() => startReplyVoice(response.id)}>Voice reply</button>}
              <button className="primary small" onClick={() => postReply(response)}>Post reply</button>
            </div>}
            {response.replies.length > 0 && <div className="replies">{response.replies.map((reply) => <div className="reply" key={reply.id}>
              <ProfileAvatar profile={reply.profiles} fallbackAvatarUrl={reply.author_id === post.author_id ? post.profiles?.avatar_url : null} />
              <div className="reply-content">
                <strong>{reply.profiles?.display_name ?? "Gista User"}</strong><span> @{reply.profiles?.username ?? "user"}</span>
                {reply.content_type === "photo" && reply.media_url && <img src={reply.media_url} alt="Reply" className="response-media" />}
                {reply.body && <p>{reply.body}</p>}
                {reply.content_type === "voice" && reply.media_url && <VoiceNote src={reply.media_url} durationHint={reply.voice_duration_seconds} />}
                {userId && <button className="response-reply" onClick={async () => { const reason = prompt("Why are you reporting this reply?"); if (!reason) return; const result = await supabase.from("reports").insert({ reporter_id: userId, reply_id: reply.id, reason }); if (result.error) setError(result.error.message); else setError("Reply report submitted."); }}>Report</button>}
              </div>
            </div>)}</div>}
          </article>
        ))}
      </section>
    </main>
  );
}
