"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Mic, Square } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Profile = { display_name: string | null; username: string | null };
type Reply = { id: string; body: string | null; content_type: string; media_url: string | null; created_at: string; author_id: string; profiles: Profile | null };
type Response = { id: string; body: string | null; content_type: string; media_url: string | null; created_at: string; author_id: string; profiles: Profile | null; replies: Reply[] };
type Post = { id: string; author_id: string; body: string | null; category: string; status: string; created_at: string; profiles: Profile | null };

export default function GistPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const supabase = createClient();

  const [post, setPost] = useState<Post | null>(null);
  const [responses, setResponses] = useState<Response[]>([]);
  const [text, setText] = useState("");
  const [voice, setVoice] = useState<Blob | null>(null);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);
  const [likeCount, setLikeCount] = useState(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [now] = useState(() => Date.now());
  const [showDna, setShowDna] = useState(false);
  const [menu, setMenu] = useState(false);
  const [openReply, setOpenReply] = useState<string | null>(null);
  const [replyText, setReplyText] = useState<Record<string, string>>({});
  const [replyVoice, setReplyVoice] = useState<Record<string, Blob | null>>({});
  const [replyRecording, setReplyRecording] = useState<string | null>(null);

  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const replyRecorder = useRef<MediaRecorder | null>(null);
  const replyChunks = useRef<Blob[]>([]);
  const replyTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  async function load() {
    const [postResult, responseResult, likeResult] = await Promise.all([
      supabase.from("posts").select("id,author_id,body,category,status,created_at,profiles(display_name,username)").eq("id", id).single(),
      supabase.from("responses").select("id,body,content_type,media_url,created_at,author_id,profiles(display_name,username),replies(id,body,content_type,media_url,created_at,author_id,profiles(display_name,username))").eq("post_id", id).order("created_at", { ascending: true }),
      supabase.from("likes").select("post_id", { count: "exact", head: true }).eq("post_id", id),
    ]);

    if (postResult.error) setError(postResult.error.message);
    setPost(postResult.data as Post | null);
    setLikeCount(likeResult.count ?? 0);
    setResponses(((responseResult.data ?? []) as Response[]).map((item) => ({ ...item, replies: item.replies ?? [] })));
    setLoading(false);
  }

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
    load();
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
      timer.current = setInterval(() => {
        elapsed += 1;
        setSeconds(elapsed);
        if (elapsed >= 60) stopVoice();
      }, 1000);
    } catch {
      setError("Microphone access is required.");
    }
  }

  async function respond() {
    setError("");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/auth"); return; }
    if (!text.trim() && !voice) return;

    let media_url: string | null = null;
    if (voice) {
      const path = user.id + "/" + crypto.randomUUID() + ".webm";
      const upload = await supabase.storage.from("gist-audio").upload(path, voice, { contentType: voice.type || "audio/webm" });
      if (upload.error) { setError(upload.error.message); return; }
      media_url = supabase.storage.from("gist-audio").getPublicUrl(path).data.publicUrl;
    }

    const { error: insertError } = await supabase.from("responses").insert({
      post_id: id,
      author_id: user.id,
      content_type: voice ? "voice" : "text",
      body: voice ? null : text.trim(),
      media_url,
      voice_duration_seconds: voice ? seconds : null,
    });

    if (insertError) setError(insertError.message);
    else { setText(""); setVoice(null); setSeconds(0); await load(); }
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
      mediaRecorder.ondataavailable = (event) => { if (event.data.size) replyChunks.current.push(event.data); };
      mediaRecorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        setReplyVoice((current) => ({ ...current, [responseId]: new Blob(replyChunks.current, { type: mediaRecorder.mimeType || "audio/webm" }) }));
      };
      mediaRecorder.start();
      setReplyRecording(responseId);
      replyTimer.current = setInterval(() => { elapsed += 1; if (elapsed >= 60) stopReplyVoice(); }, 1000);
    } catch {
      setError("Microphone access is required.");
    }
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

    const { error: insertError } = await supabase.from("replies").insert({
      response_id: response.id,
      author_id: user.id,
      content_type: voiceReply ? "voice" : "text",
      body: voiceReply ? null : body,
      media_url,
    });

    if (insertError) setError(insertError.message);
    else {
      setReplyText((current) => ({ ...current, [response.id]: "" }));
      setReplyVoice((current) => ({ ...current, [response.id]: null }));
      setOpenReply(null);
      await load();
    }
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
      <article className="post">
        <div className="post-head">
          <button type="button" onClick={() => setMenu((value) => !value)} aria-label="More options">⋯</button>
          <div className="avatar">{post.profiles?.display_name?.[0]?.toUpperCase() ?? "G"}</div>
          <div className="identity"><strong>{post.profiles?.display_name ?? "Gista User"}</strong><span>@{post.profiles?.username ?? "user"} · {new Date(post.created_at).toLocaleString()}</span></div>
          <span className="category">{post.category}</span>
        </div>
        {post.body && <p className="post-text">{post.body}</p>}
        <div className="gist-meta"><span>❤️ {likeCount} Likes</span><span>💬 {responses.length} Responses</span><button type="button" onClick={() => setShowDna(true)}>Gist DNA</button>{userId === post.author_id && <button type="button" onClick={async () => { if (!confirm("Delete this Gist?")) return; const result = await supabase.from("posts").delete().eq("id", id).eq("author_id", userId); if (result.error) setError(result.error.message); else router.push("/"); }}>Delete Gist</button>}</div>
      </article>

      {showDna && (
        <div className="modal-backdrop" onClick={() => setShowDna(false)}>
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
        </div>
      )}

      {menu && (
        <div className="action-menu">
          <button onClick={async () => { const reason = prompt("Why are you reporting this Gist?"); if (!reason || !userId) return; await supabase.from("reports").insert({ reporter_id: userId, post_id: id, reason }); setMenu(false); setError("Report submitted."); }}>Report Gist</button>
          <button onClick={async () => { if (!userId) return; const result = await supabase.from("blocks").insert({ blocker_id: userId, blocked_id: post.author_id }); if (!result.error) router.push("/"); }}>Block author</button>
          <button onClick={() => setMenu(false)}>Not Interested</button>
        </div>
      )}

      <section className="create-card">
        <h3>Join the Gist</h3>
        <textarea value={text} onChange={(event) => setText(event.target.value)} placeholder="Write a response…" />
        {recording ? <button type="button" className="primary" onClick={stopVoice}><Square /> Stop {seconds}s / 60s</button> : <button type="button" onClick={startVoice}><Mic /> {voice ? "Record again" : "Voice response"}</button>}
        {voice && <audio controls src={URL.createObjectURL(voice)} />}
        <button className="primary" onClick={respond}>Post response</button>
        {error && <div className="auth-message">{error}</div>}
      </section>

      <section className="feed">
        <h3>{responses.length} {responses.length === 1 ? "Response" : "Responses"}</h3>
        {responses.length === 0 ? <p>No responses yet. Start the Gist.</p> : responses.map((response) => (
          <article className="post" key={response.id}>
            <div className="post-head"><div className="avatar">{response.profiles?.display_name?.[0]?.toUpperCase() ?? "G"}</div><div className="identity"><strong>{response.profiles?.display_name ?? "Gista User"}</strong><span>@{response.profiles?.username ?? "user"} · {new Date(response.created_at).toLocaleString()}</span></div></div>
            {response.body && <p className="post-text">{response.body}</p>}
            {response.content_type === "voice" && response.media_url && <audio controls src={response.media_url} />}
            <button className="response-reply" onClick={() => setOpenReply(openReply === response.id ? null : response.id)}>Reply</button>
            {userId === response.author_id && <button className="response-reply" onClick={async () => { if (!confirm("Delete this response?")) return; await supabase.from("responses").delete().eq("id", response.id).eq("author_id", userId); await load(); }}>Delete</button>}
            {openReply === response.id && (
              <div className="reply-box">
                <textarea value={replyText[response.id] ?? ""} onChange={(event) => setReplyText((current) => ({ ...current, [response.id]: event.target.value }))} placeholder="Write a reply…" />
                {replyRecording === response.id ? <button type="button" onClick={stopReplyVoice}>Stop voice</button> : <button type="button" onClick={() => startReplyVoice(response.id)}>Voice reply</button>}
                <button className="primary small" onClick={() => postReply(response)}>Post reply</button>
              </div>
            )}
            {response.replies.length > 0 && <div className="replies">{response.replies.map((reply) => <div className="reply" key={reply.id}><strong>{reply.profiles?.display_name ?? "Gista User"}</strong><span> @{reply.profiles?.username ?? "user"}</span>{reply.body && <p>{reply.body}</p>}{reply.content_type === "voice" && reply.media_url && <audio controls src={reply.media_url} />}{userId === reply.author_id && <button className="response-reply" onClick={async () => { if (!confirm("Delete this reply?")) return; await supabase.from("replies").delete().eq("id", reply.id).eq("author_id", userId); await load(); }}>Delete</button>}</div>)}</div>}
          </article>
        ))}
      </section>
    </main>
  );
}
