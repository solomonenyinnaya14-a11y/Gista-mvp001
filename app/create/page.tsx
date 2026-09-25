"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Mic, ImagePlus, Type, Square } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import VoiceNote from "@/components/VoiceNote";

const categories = ["Music","Movies / Entertainment","Art","Banter","Fun","Gossip","Sports","Relationships","Business","Technology","Education","Lifestyle","Society","News & Current Events","Opinions","Stories"];

type Profile = { display_name: string | null; username: string | null; avatar_url: string | null };

export default function CreatePage() {
  const [mode, setMode] = useState<"text" | "photo" | "voice">("text");
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState("");
  const [text, setText] = useState("");
  const [category, setCategory] = useState("");
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [audio, setAudio] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    let active = true;
    const loadProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !active) return;
      const { data } = await supabase.from("profiles").select("display_name,username,avatar_url").eq("id", user.id).maybeSingle();
      if (active) setProfile((data as Profile | null) ?? null);
    };
    void loadProfile();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    return () => { if (photoPreview) URL.revokeObjectURL(photoPreview); };
  }, [photoPreview]);

  useEffect(() => {
    if (!audio) { setAudioUrl(""); return; }
    const url = URL.createObjectURL(audio);
    setAudioUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [audio]);

  function stop() {
    if (recorder.current?.state === "recording") recorder.current.stop();
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    setRecording(false);
  }

  async function start() {
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
        setAudio(new Blob(chunks.current, { type: mediaRecorder.mimeType || "audio/webm" }));
      };
      mediaRecorder.start();
      setRecording(true);
      timer.current = setInterval(() => {
        elapsed += 1;
        setSeconds(elapsed);
        if (elapsed >= 120) stop();
      }, 1000);
    } catch {
      setError("Microphone access is required for voice Gists.");
    }
  }

  async function post() {
    setError("");
    if (!category) return setError("Choose a category.");
    if (mode === "text" && !text.trim()) return setError("Write something before posting.");
    if (mode === "photo" && !photo) return setError("Choose a photo first.");
    if (mode === "voice" && !audio) return setError("Record a voice Gist first.");

    setLoading(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push("/auth");
      setLoading(false);
      return;
    }

    let media_url: string | null = null;
    if (mode === "photo" && photo) {
      const extension = photo.name.split(".").pop() || "jpg";
      const path = user.id + "/" + crypto.randomUUID() + "." + extension;
      const upload = await supabase.storage.from("gist-media").upload(path, photo, { contentType: photo.type });
      if (upload.error) { setError(upload.error.message); setLoading(false); return; }
      media_url = supabase.storage.from("gist-media").getPublicUrl(path).data.publicUrl;
    }

    if (mode === "voice" && audio) {
      const path = user.id + "/" + crypto.randomUUID() + ".webm";
      const upload = await supabase.storage.from("gist-audio").upload(path, audio, { contentType: audio.type || "audio/webm" });
      if (upload.error) { setError(upload.error.message); setLoading(false); return; }
      media_url = supabase.storage.from("gist-audio").getPublicUrl(path).data.publicUrl;
    }

    const { error: insertError } = await supabase.from("posts").insert({
      author_id: user.id,
      content_type: mode,
      body: text.trim() || null,
      media_url,
      category,
      status: "growing",
      voice_duration_seconds: mode === "voice" ? seconds : null,
    });

    if (insertError) {
      if (media_url) {
        const storagePath = media_url.split("/storage/v1/object/public/")[1];
        if (storagePath) {
          const [bucket, ...parts] = storagePath.split("/");
          await supabase.storage.from(bucket).remove([parts.join("/")]);
        }
      }
      setError(insertError.message);
    } else router.push("/");
    setLoading(false);
  }

  const initials = profile?.display_name?.trim().charAt(0).toUpperCase() || "G";

  return (
    <main className="create-page">
      <header className="simple-header">
        <Link href="/">Cancel</Link>
        <strong>Start a Gist</strong>
        <button onClick={post} disabled={loading}>{loading ? "Posting…" : "Post"}</button>
      </header>
      <section className="create-card">
        <Link href="/profile" className="avatar" aria-label="Open your profile">
          {profile?.avatar_url ? <img src={profile.avatar_url} alt="Your profile" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }} /> : initials}
        </Link>
        <div className="format-row">
          <button type="button" className={mode === "text" ? "active" : ""} onClick={() => setMode("text")}><Type />Text</button>
          <button type="button" className={mode === "photo" ? "active" : ""} onClick={() => setMode("photo")}><ImagePlus />Photo</button>
          <button type="button" className={mode === "voice" ? "active" : ""} onClick={() => { setMode("voice"); setAudio(null); setAudioUrl(""); }}><Mic />Voice</button>
        </div>

        {mode !== "text" && <textarea value={text} onChange={(event) => setText(event.target.value)} maxLength={5000} placeholder="Add a caption or say something about your Gist (optional)…" aria-label="Optional text for this Gist" />}

        {mode === "text" && <textarea value={text} onChange={(event) => setText(event.target.value)} maxLength={5000} placeholder="Say something worth sharing…" />}

        {mode === "photo" && (
          <div className="photo-composer">
            <label className="photo-picker" htmlFor="gist-photo">
              {photoPreview ? <img src={photoPreview} alt="Selected Gist" className="photo-preview" /> : <div className="photo-empty"><ImagePlus size={32} /><span>Choose a photo</span></div>}
            </label>
            <input id="gist-photo" type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(event) => {
              const file = event.target.files?.[0] ?? null;
              if (file && !["image/jpeg", "image/png", "image/webp"].includes(file.type)) { setError("Use a JPG, PNG, or WebP image."); return; }
              if (file && file.size > 10 * 1024 * 1024) { setError("Gist photos must be 10MB or smaller."); return; }
              if (photoPreview) URL.revokeObjectURL(photoPreview);
              setPhoto(file);
              setPhotoPreview(file ? URL.createObjectURL(file) : "");
            }} />
          </div>
        )}

        {mode === "voice" && (
          <div>
            <p>{recording ? "Recording" : "Voice Gist"} · {seconds}s / 120s</p>
            {recording ? <button type="button" className="primary" onClick={stop}><Square /> Stop recording</button> : <button type="button" className="primary" onClick={start}><Mic /> {audio ? "Record again" : "Start recording"}</button>}
            {audio && audioUrl && <VoiceNote src={audioUrl} durationHint={seconds} />}
          </div>
        )}

        <select value={category} onChange={(event) => setCategory(event.target.value)}>
          <option value="" disabled>Choose a category</option>
          {categories.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        {error && <div className="auth-message">{error}</div>}
      </section>
    </main>
  );
}