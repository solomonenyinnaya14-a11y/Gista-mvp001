"use client";

import { useEffect, useState } from "react";
import { Camera, Check, Settings, UserRound } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { signOut } from "@/lib/auth";

type Profile = { id: string; username: string | null; display_name: string | null; bio: string | null; avatar_url: string | null };
type Gist = { id: string; content_type: string; body: string | null; media_url: string | null; category: string; status: string; created_at: string };

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
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { window.location.href = "/auth"; return; }
    const [{ data, error: profileError }, g, followers, following, ownGists] = await Promise.all([
      supabase.from("profiles").select("id,username,display_name,bio,avatar_url").eq("id", user.id).single(),
      supabase.from("posts").select("id", { count: "exact", head: true }).eq("author_id", user.id),
      supabase.from("follows").select("follower_id", { count: "exact", head: true }).eq("following_id", user.id),
      supabase.from("follows").select("following_id", { count: "exact", head: true }).eq("follower_id", user.id),
      supabase.from("posts").select("id,content_type,body,media_url,category,status,created_at").eq("author_id", user.id).order("created_at", { ascending: false }).limit(20),
    ]);
    if (profileError || !data) { setError(profileError?.message ?? "We couldn't load your profile."); setLoading(false); return; }
    setProfile(data as Profile);
    setDisplayName(data.display_name ?? "");
    setUsername(data.username ?? "");
    setBio(data.bio ?? "");
    setStats({ gists: g.count ?? 0, followers: followers.count ?? 0, following: following.count ?? 0 });
    setGists((ownGists.data ?? []) as Gist[]);
    setLoading(false);
  }

  useEffect(() => { loadProfile(); }, []);

  async function uploadAvatar(file: File) {
    setError(""); setMessage("");
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) { setError("Use a JPG, PNG, or WebP image."); return; }
    if (file.size > 5 * 1024 * 1024) { setError("Profile photos must be 5MB or smaller."); return; }
    setAvatarUploading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setAvatarUploading(false); return; }
    const extension = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
    const path = user.id + "/" + crypto.randomUUID() + "." + extension;
    const upload = await supabase.storage.from("profile-media").upload(path, file, { contentType: file.type });
    if (upload.error) { setError(upload.error.message); setAvatarUploading(false); return; }
    const publicUrl = supabase.storage.from("profile-media").getPublicUrl(path).data.publicUrl;
    const { error: updateError } = await supabase.from("profiles").update({ avatar_url: publicUrl }).eq("id", user.id);
    if (updateError) setError(updateError.message);
    else { setProfile((current) => current ? { ...current, avatar_url: publicUrl } : current); setMessage("Profile photo updated."); }
    setAvatarUploading(false);
  }

  async function saveProfile() {
    setError(""); setMessage("");
    const cleanName = displayName.trim();
    const cleanUsername = username.trim().replace(/^@+/, "").toLowerCase();
    const cleanBio = bio.trim();
    if (!cleanName) { setError("Display name is required."); return; }
    if (!/^[a-z0-9_]{3,30}$/.test(cleanUsername)) { setError("Username must be 3–30 characters using letters, numbers, or underscores."); return; }
    if (cleanBio.length > 160) { setError("Bio must be 160 characters or fewer."); return; }
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); window.location.href = "/auth"; return; }
    const { error: updateError } = await supabase.from("profiles").update({ display_name: cleanName, username: cleanUsername, bio: cleanBio || null }).eq("id", user.id);
    if (updateError) { setError(updateError.code === "23505" ? "That username is already taken." : updateError.message); setSaving(false); return; }
    setProfile((current) => current ? { ...current, display_name: cleanName, username: cleanUsername, bio: cleanBio || null } : current);
    setEdit(false); setMessage("Profile updated."); setSaving(false);
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
            <div className="profile-photo">{profile?.avatar_url ? <img src={profile.avatar_url} alt="Profile" /> : <span>{initials}</span>}</div>
            <label className="profile-camera" aria-label="Change profile photo">
              <Camera size={16} />
              <input type="file" accept="image/jpeg,image/png,image/webp" hidden disabled={avatarUploading} onChange={(event) => { const file = event.target.files?.[0]; if (file) uploadAvatar(file); event.currentTarget.value = ""; }} />
            </label>
          </div>
          <h1>{profile?.display_name || "Gista User"}</h1>
          <p className="profile-username">@{profile?.username || "username"}</p>
          <p className="profile-bio">{profile?.bio || "A place to talk, share and connect."}</p>
          <div className="profile-stats">
            <a href="#my-gists"><strong>{stats.gists}</strong><span>Gists</span></a>
            <span><strong>{stats.followers}</strong><span>Followers</span></span>
            <span><strong>{stats.following}</strong><span>Following</span></span>
          </div>
          <div className="profile-actions">
            <button className="profile-primary" onClick={() => { setEdit((value) => !value); setError(""); setMessage(""); }}>{edit ? "Close editor" : "Edit profile"}</button>
            <Link className="profile-secondary" href="/saved">Saved Gists</Link>
          </div>
          {(avatarUploading || message || error) && <div className={error ? "profile-feedback error" : "profile-feedback"}>{avatarUploading ? "Uploading profile photo…" : message || error}</div>}
        </section>

        {edit && <section className="profile-editor">
          <div className="editor-heading"><div><h2>Edit profile</h2><p>Update how people see you on Gista.</p></div><UserRound size={22} /></div>
          <label>Display name<input value={displayName} maxLength={60} onChange={(event) => setDisplayName(event.target.value)} placeholder="Your display name" /></label>
          <label>Username<div className="username-input"><span>@</span><input value={username} maxLength={30} onChange={(event) => setUsername(event.target.value.replace(/\s/g, ""))} placeholder="username" /></div><small>3–30 characters: letters, numbers, underscores.</small></label>
          <label>Bio<textarea value={bio} maxLength={160} onChange={(event) => setBio(event.target.value)} placeholder="Tell people a little about yourself…" /><small>{bio.length}/160</small></label>
          <button className="profile-save" onClick={saveProfile} disabled={saving}><Check size={17} /> {saving ? "Saving…" : "Save changes"}</button>
        </section>}

        <section className="profile-content" id="my-gists">
          <div className="section-title"><h2>My Gists</h2><span>{stats.gists}</span></div>
          {gists.length === 0 ? <div className="profile-empty"><div className="empty-g">G</div><h3>No Gists yet</h3><p>Share your first thought, story, photo, or voice Gist.</p><Link href="/create" className="profile-primary">Start a Gist</Link></div> :
          <div className="profile-gists">{gists.map((gist) => <Link className="profile-gist" href={"/gist/" + gist.id} key={gist.id}>
            <div className="profile-gist-meta"><span>{gist.content_type === "voice" ? "🎙️ Voice Gist" : gist.content_type === "photo" ? "📷 Photo Gist" : "Text Gist"}</span><span>{gist.category}</span></div>
            {gist.body && <p>{gist.body}</p>}
            {gist.content_type === "photo" && gist.media_url && <img src={gist.media_url} alt="" />}
            {gist.content_type === "voice" && gist.media_url && <audio controls src={gist.media_url} />}
            <small>{new Date(gist.created_at).toLocaleString()} · {gist.status}</small>
          </Link>)}</div>}
        </section>

        <button className="profile-logout" onClick={signOut}>Log out</button>
      </section>
    </main>
  );
}
