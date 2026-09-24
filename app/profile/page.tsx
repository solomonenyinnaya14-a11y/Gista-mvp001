"use client";

import { useEffect, useMemo, useState } from "react";
import { Bookmark, Camera, Check, Heart, MessageCircle, Settings, Share2, UserRound } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { signOut } from "@/lib/auth";
import VoiceNote from "@/components/VoiceNote";

type Profile = {
  id: string;
  username: string | null;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
};

type Gist = {
  id: string;
  content_type: string;
  body: string | null;
  media_url: string | null;
  category: string;
  status: string;
  created_at: string;
  voice_duration_seconds: number | null;
  likes: number;
  responses: number;
  liked: boolean;
  saved: boolean;
};

function safeUsername(value: string) {
  const cleaned = value.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 30);
  return cleaned.length >= 3 ? cleaned : "gistauser";
}

export default function ProfilePage() {
  const supabase = useMemo(() => createClient(), []);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [edit, setEdit] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [stats, setStats] = useState({ gists: 0, followers: 0, following: 0 });
  const [gists, setGists] = useState<Gist[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadProfile() {
    setLoading(true);
    setError("");

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      window.location.href = "/auth";
      return;
    }

    let { data, error: profileError } = await supabase
      .from("profiles")
      .select("id,username,display_name,bio,avatar_url")
      .eq("id", user.id)
      .maybeSingle();

    if (!data && !profileError) {
      const preferred = safeUsername(String(user.user_metadata?.username ?? user.email?.split("@")[0] ?? ""));
      const { data: created, error: createError } = await supabase
        .from("profiles")
        .insert({
          id: user.id,
          display_name: String(user.user_metadata?.display_name ?? "Gista User"),
          username: preferred,
        })
        .select("id,username,display_name,bio,avatar_url")
        .single();
      data = created;
      profileError = createError;
    }

    if (profileError || !data) {
      setError(profileError?.message ?? "We couldn't load your profile.");
      setLoading(false);
      return;
    }

    const [gistsResult, followersResult, followingResult, ownGistsResult] = await Promise.all([
      supabase.from("posts").select("id", { count: "exact", head: true }).eq("author_id", user.id),
      supabase.from("follows").select("follower_id", { count: "exact", head: true }).eq("following_id", user.id),
      supabase.from("follows").select("following_id", { count: "exact", head: true }).eq("follower_id", user.id),
      supabase.from("posts").select("id,content_type,body,media_url,category,status,created_at,voice_duration_seconds").eq("author_id", user.id).order("created_at", { ascending: false }).limit(30),
    ]);

    const ownGists = (ownGistsResult.data ?? []) as Array<Omit<Gist, "likes" | "responses" | "liked" | "saved">>;
    const postIds = ownGists.map((gist) => gist.id);

    let likeRows: Array<{ post_id: string; user_id: string }> = [];
    let responseRows: Array<{ post_id: string }> = [];
    let saveRows: Array<{ post_id: string }> = [];

    if (postIds.length) {
      const [likesResult, responsesResult, savesResult] = await Promise.all([
        supabase.from("likes").select("post_id,user_id").in("post_id", postIds),
        supabase.from("responses").select("post_id").in("post_id", postIds),
        supabase.from("saves").select("post_id").eq("user_id", user.id).in("post_id", postIds),
      ]);
      likeRows = (likesResult.data ?? []) as Array<{ post_id: string; user_id: string }>;
      responseRows = (responsesResult.data ?? []) as Array<{ post_id: string }>;
      saveRows = (savesResult.data ?? []) as Array<{ post_id: string }>;
    }

    const likeCounts = Object.fromEntries(postIds.map((postId) => [postId, 0]));
    const responseCounts = Object.fromEntries(postIds.map((postId) => [postId, 0]));
    likeRows.forEach((row) => { likeCounts[row.post_id] = (likeCounts[row.post_id] ?? 0) + 1; });
    responseRows.forEach((row) => { responseCounts[row.post_id] = (responseCounts[row.post_id] ?? 0) + 1; });

    const liked = new Set(likeRows.filter((row) => row.user_id === user.id).map((row) => row.post_id));
    const saved = new Set(saveRows.map((row) => row.post_id));

    setProfile(data as Profile);
    setDisplayName(data.display_name ?? "");
    setUsername(data.username ?? "");
    setBio(data.bio ?? "");
    setStats({
      gists: gistsResult.count ?? 0,
      followers: followersResult.count ?? 0,
      following: followingResult.count ?? 0,
    });
    setGists(ownGists.map((gist) => ({
      ...gist,
      likes: likeCounts[gist.id] ?? 0,
      responses: responseCounts[gist.id] ?? 0,
      liked: liked.has(gist.id),
      saved: saved.has(gist.id),
    })));
    setLoading(false);
  }

  useEffect(() => {
    void loadProfile();
  }, [supabase]);

  async function uploadAvatar(file: File) {
    setError("");
    setMessage("");

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Use a JPG, PNG, or WebP image.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Profile photos must be 5MB or smaller.");
      return;
    }

    setAvatarUploading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setAvatarUploading(false);
      window.location.href = "/auth";
      return;
    }

    const extension = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
    const path = user.id + "/" + crypto.randomUUID() + "." + extension;
    const upload = await supabase.storage.from("profile-media").upload(path, file, {
      contentType: file.type,
      cacheControl: "3600",
      upsert: false,
    });

    if (upload.error) {
      setError(upload.error.message);
      setAvatarUploading(false);
      return;
    }

    const publicUrl = supabase.storage.from("profile-media").getPublicUrl(path).data.publicUrl;
    const { data: updated, error: updateError } = await supabase
      .from("profiles")
      .update({ avatar_url: publicUrl })
      .eq("id", user.id)
      .select("id,username,display_name,bio,avatar_url")
      .single();

    if (updateError || !updated) {
      await supabase.storage.from("profile-media").remove([path]);
      setError(updateError?.message ?? "Profile photo could not be saved.");
    } else {
      setProfile(updated as Profile);
      setMessage("Profile photo updated.");
    }

    setAvatarUploading(false);
  }

  async function saveProfile() {
    setError("");
    setMessage("");

    const cleanName = displayName.trim();
    const cleanUsername = username.trim().replace(/^@+/, "").toLowerCase();
    const cleanBio = bio.trim();

    if (!cleanName) return setError("Display name is required.");
    if (!/^[a-z0-9_]{3,30}$/.test(cleanUsername)) {
      return setError("Username must be 3–30 characters using letters, numbers, or underscores.");
    }
    if (cleanBio.length > 160) return setError("Bio must be 160 characters or fewer.");

    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setSaving(false);
      window.location.href = "/auth";
      return;
    }

    const { data: updated, error: updateError } = await supabase
      .from("profiles")
      .update({ display_name: cleanName, username: cleanUsername, bio: cleanBio || null })
      .eq("id", user.id)
      .select("id,username,display_name,bio,avatar_url")
      .single();

    if (updateError || !updated) {
      setError(updateError?.code === "23505" ? "That username is already taken." : updateError?.message ?? "Profile could not be saved.");
      setSaving(false);
      return;
    }

    setProfile(updated as Profile);
    setDisplayName(updated.display_name ?? "");
    setUsername(updated.username ?? "");
    setBio(updated.bio ?? "");
    setEdit(false);
    setMessage("Profile updated.");
    setSaving(false);
  }

  async function toggleLike(gist: Gist) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      window.location.href = "/auth";
      return;
    }

    setBusy(gist.id + "l");
    const result = gist.liked
      ? await supabase.from("likes").delete().eq("post_id", gist.id).eq("user_id", user.id)
      : await supabase.from("likes").insert({ post_id: gist.id, user_id: user.id });

    if (!result.error) {
      setGists((current) => current.map((item) => item.id === gist.id
        ? { ...item, liked: !item.liked, likes: item.likes + (item.liked ? -1 : 1) }
        : item));
    }
    setBusy(null);
  }

  async function toggleSave(gist: Gist) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      window.location.href = "/auth";
      return;
    }

    setBusy(gist.id + "s");
    const result = gist.saved
      ? await supabase.from("saves").delete().eq("post_id", gist.id).eq("user_id", user.id)
      : await supabase.from("saves").insert({ post_id: gist.id, user_id: user.id });

    if (!result.error) {
      setGists((current) => current.map((item) => item.id === gist.id ? { ...item, saved: !item.saved } : item));
    }
    setBusy(null);
  }

  function shareGist(gist: Gist) {
    const url = window.location.origin + "/gist/" + gist.id;
    if (navigator.share) {
      void navigator.share({ title: "Gista", text: gist.body ?? "Join this Gist on Gista", url });
    } else {
      void navigator.clipboard.writeText(url);
    }
  }

  const initials = profile?.display_name?.trim()?.[0]?.toUpperCase() ?? "G";

  if (loading) return <main className="profile-page"><div className="profile-loading">Loading your profile…</div></main>;

  return (
    <main className="profile-page">
      <header className="profile-header">
        <Link href="/" className="profile-back">‹ Home</Link>
        <strong>Profile</strong>
        <Link href="/settings" className="profile-settings" aria-label="Settings"><Settings size={20} /></Link>
      </header>

      <section className="profile-wrap">
        <section className="profile-hero">
          <div className="profile-photo-wrap">
            <div className="profile-photo">
              {profile?.avatar_url ? <img src={profile.avatar_url} alt="Profile" /> : <span>{initials}</span>}
            </div>
            <label className="profile-camera" aria-label="Change profile photo">
              <Camera size={16} />
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                hidden
                disabled={avatarUploading}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void uploadAvatar(file);
                  event.currentTarget.value = "";
                }}
              />
            </label>
          </div>

          <h1>{profile?.display_name || "Gista User"}</h1>
          <p className="profile-username">@{profile?.username || "username"}</p>
          {profile?.bio && <p className="profile-bio">{profile.bio}</p>}

          <div className="profile-stats">
            <a href="#my-gists"><strong>{stats.gists}</strong><span>Gists</span></a>
            <span><strong>{stats.followers}</strong><span>Followers</span></span>
            <span><strong>{stats.following}</strong><span>Following</span></span>
          </div>

          <div className="profile-actions">
            <button className="profile-primary" type="button" onClick={() => { setEdit((value) => !value); setError(""); setMessage(""); }}>
              {edit ? "Close editor" : "Edit profile"}
            </button>
            <Link className="profile-secondary" href="/saved">Saved</Link>
          </div>

          {(avatarUploading || message || error) && (
            <div className={error ? "profile-feedback error" : "profile-feedback"}>
              {avatarUploading ? "Uploading profile photo…" : message || error}
            </div>
          )}
        </section>

        {edit && (
          <section className="profile-editor">
            <div className="editor-heading">
              <div><h2>Edit profile</h2><p>Update your name, username and bio.</p></div>
              <UserRound size={22} />
            </div>
            <label>Display name
              <input value={displayName} maxLength={60} onChange={(event) => setDisplayName(event.target.value)} placeholder="Your display name" />
            </label>
            <label>Username
              <div className="username-input"><span>@</span><input value={username} maxLength={30} onChange={(event) => setUsername(event.target.value.replace(/\s/g, ""))} placeholder="username" /></div>
              <small>3–30 characters: letters, numbers, underscores.</small>
            </label>
            <label>Bio
              <textarea value={bio} maxLength={160} onChange={(event) => setBio(event.target.value)} placeholder="Tell people about yourself…" />
              <small>{bio.length}/160</small>
            </label>
            <button className="profile-save" type="button" onClick={() => void saveProfile()} disabled={saving}><Check size={17} /> {saving ? "Saving…" : "Save changes"}</button>
          </section>
        )}

        <section className="profile-content" id="my-gists">
          <div className="section-title"><h2>Gists</h2><span>{stats.gists}</span></div>
          {gists.length === 0 ? (
            <div className="profile-empty">
              <div className="empty-g">G</div>
              <h3>No Gists yet</h3>
              <p>Share your first thought, story, photo, or voice Gist.</p>
              <Link href="/create" className="profile-primary">Start a Gist</Link>
            </div>
          ) : (
            <div className="profile-gists">
              {gists.map((gist) => (
                <article className="profile-gist" key={gist.id}>
                  <div className="profile-gist-meta">
                    <Link href={"/gist/" + gist.id}>{gist.content_type === "voice" ? "Voice Gist" : gist.content_type === "photo" ? "Photo Gist" : "Gist"}</Link>
                    <span>{gist.category}</span>
                  </div>

                  <Link className="profile-gist-content" href={"/gist/" + gist.id}>
                    {gist.body && <p>{gist.body}</p>}
                    {gist.content_type === "photo" && gist.media_url && <img src={gist.media_url} alt="Gist" />}
                  </Link>

                  {gist.content_type === "voice" && gist.media_url && (
                    <div className="profile-gist-voice">
                      <VoiceNote src={gist.media_url} durationHint={gist.voice_duration_seconds} />
                    </div>
                  )}

                  <div className="actions profile-gist-actions">
                    <button type="button" onClick={() => void toggleLike(gist)} disabled={busy === gist.id + "l"} aria-label="Like Gist">
                      <Heart size={18} fill={gist.liked ? "currentColor" : "none"} /> {gist.likes}
                    </button>
                    <Link className="feed-action-link" href={"/gist/" + gist.id}><MessageCircle size={18} /> {gist.responses}</Link>
                    <button type="button" onClick={() => shareGist(gist)} aria-label="Share Gist"><Share2 size={18} /></button>
                    <button type="button" onClick={() => void toggleSave(gist)} disabled={busy === gist.id + "s"} aria-label="Save Gist">
                      <Bookmark size={18} fill={gist.saved ? "currentColor" : "none"} />
                    </button>
                  </div>

                  <small>{new Date(gist.created_at).toLocaleString()}</small>
                </article>
              ))}
            </div>
          )}
        </section>

        <button className="profile-logout" type="button" onClick={() => void signOut()}>Log out</button>
      </section>
    </main>
  );
}
