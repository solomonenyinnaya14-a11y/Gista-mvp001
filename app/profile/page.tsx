"use client";

import { useEffect, useState } from "react";
import { Camera, Check, Settings, UserRound } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { signOut } from "@/lib/auth";
import VoiceNote from "@/components/VoiceNote";

type Profile = { id: string; username: string | null; display_name: string | null; bio: string | null; avatar_url: string | null };
type Gist = { id: string; content_type: string; body: string | null; media_url: string | null; category: string; status: string; created_at: string; voice_duration_seconds?: number | null };

function safeUsername(value: string) {
  const cleaned = value.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 30);
  return cleaned.length >= 3 ? cleaned : "gistauser";
}

export default function ProfilePage() {
  const supabase = createClient();
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

    const [{ count: gistsCount }, { count: followersCount }, { count: followingCount }, ownGists] = await Promise.all([
      supabase.from("posts").select("id", { count: "exact", head: true }).eq("author_id", user.id),
      supabase.from("follows").select("follower_id", { count: "exact", head: true }).eq("following_id", user.id),
      supabase.from("follows").select("following_id", { count: "exact", head: true }).eq("follower_id", user.id),
      supabase.from("posts").select("id,content_type,body,media_url,category,status,created_at,voice_duration_seconds").eq("author_id", user.id).order("created_at", { ascending: false }).limit(30),
    ]);

    setProfile(data as Profile);
    setDisplayName(data.display_name ?? "");
    setUsername(data.username ?? "");
    setBio(data.bio ?? "");
    setStats({ gists: gistsCount ?? 0, followers: followersCount ?? 0, following: followingCount ?? 0 });
    setGists((ownGists.data ?? []) as Gist[]);
    setLoading(false);
  }

  useEffect(() => {
    void loadProfile();
  }, []);

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

    if (!cleanName) {
      setError("Display name is required.");
      return;
    }
    if (!/^[a-z0-9_]{3,30}$/.test(cleanUsername)) {
      setError("Username must be 3–30 characters using letters, numbers, or underscores.");
      return;
    }
    if (cleanBio.length > 160) {
      setError("Bio must be 160 characters or fewer.");
      return;
    }

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

  const initials = profile?.display_name?.trim()?.[0]?.toUpperCase() ?? "G";

  if (loading) {
    return <main className="profile-page"><div className="profile-loading">Loading your profile…</div></main>;
  }

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
            <button className="profile-primary" onClick={() => { setEdit((value) => !value); setError(""); setMessage(""); }}>
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
            <button className="profile-save" onClick={saveProfile} disabled={saving}><Check size={17} /> {saving ? "Saving…" : "Save changes"}</button>
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
                <Link className="profile-gist" href={"/gist/" + gist.id} key={gist.id}>
                  <div className="profile-gist-meta">
                    <span>{gist.content_type === "voice" ? "Voice Gist" : gist.content_type === "photo" ? "Photo Gist" : "Gist"}</span>
                    <span>{gist.category}</span>
                  </div>
                  {gist.body && <p>{gist.body}</p>}
                  {gist.content_type === "photo" && gist.media_url && <img src={gist.media_url} alt="Gist" />}
                  {gist.content_type === "voice" && gist.media_url && <VoiceNote src={gist.media_url} durationHint={gist.voice_duration_seconds} />}
                  <small>{new Date(gist.created_at).toLocaleString()}</small>
                </Link>
              ))}
            </div>
          )}
        </section>

        <button className="profile-logout" onClick={() => void signOut()}>Log out</button>
      </section>
    </main>
  );
}
