"use client";

import { useEffect, useState } from "react";
import { ImagePlus } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { signOut } from "@/lib/auth";

export default function ProfilePage() {
  const supabase = createClient();
  const [profile, setProfile] = useState<any>(null);
  const [edit, setEdit] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [stats, setStats] = useState({ gists: 0, followers: 0, following: 0 });
  const [loading, setLoading] = useState(true);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState("");
  const [gists, setGists] = useState<any[]>([]);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("profiles").select("username,display_name,bio,avatar_url").eq("id", user.id).single();
      setProfile(data);
      setDisplayName(data?.display_name ?? "");
      setBio(data?.bio ?? "");
      const [g, followers, following] = await Promise.all([
        supabase.from("posts").select("id", { count: "exact", head: true }).eq("author_id", user.id),
        supabase.from("follows").select("follower_id", { count: "exact", head: true }).eq("following_id", user.id),
        supabase.from("follows").select("following_id", { count: "exact", head: true }).eq("follower_id", user.id),
      ]);
      setStats({ gists: g.count ?? 0, followers: followers.count ?? 0, following: following.count ?? 0 });
      const { data: ownGists } = await supabase.from("posts").select("id,content_type,body,media_url,category,status,created_at").eq("author_id", user.id).order("created_at", { ascending: false }).limit(20);
      setGists(ownGists ?? []);
      setLoading(false);
    }
    load();
  }, [supabase]);

  async function uploadAvatar(file: File) {
    setAvatarError("");
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setAvatarError("Use a JPG, PNG, or WebP image.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setAvatarError("Profile photos must be 5MB or smaller.");
      return;
    }
    setAvatarUploading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setAvatarUploading(false);
      return;
    }
    const extension = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
    const path = user.id + "/" + crypto.randomUUID() + "." + extension;
    const upload = await supabase.storage.from("profile-media").upload(path, file, { contentType: file.type });
    if (upload.error) {
      setAvatarError(upload.error.message);
      setAvatarUploading(false);
      return;
    }
    const publicUrl = supabase.storage.from("profile-media").getPublicUrl(path).data.publicUrl;
    const { error } = await supabase.from("profiles").update({ avatar_url: publicUrl }).eq("id", user.id);
    if (error) setAvatarError(error.message);
    else setProfile((current: any) => ({ ...current, avatar_url: publicUrl }));
    setAvatarUploading(false);
  }

  async function saveProfile() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from("profiles").update({ display_name: displayName.trim(), bio: bio.trim() }).eq("id", user.id);
    if (!error) {
      setProfile({ ...profile, display_name: displayName.trim(), bio: bio.trim() });
      setEdit(false);
    }
  }

  return (
    <main className="profile-page">
      <header className="simple-header">
        <Link href="/">‹ Home</Link>
        <strong>Profile</strong>
        <Link href="/settings">⚙</Link>
      </header>
      <section className="profile-card">
        {loading ? <p>Loading profile…</p> : (
          <>
            <div className="profile-avatar" style={{ position: "relative", overflow: "hidden" }}>
              {profile?.avatar_url ? <img src={profile.avatar_url} alt="Profile" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : (profile?.display_name?.[0]?.toUpperCase() ?? "G")}
              <label style={{ position: "absolute", right: 4, bottom: 4, cursor: "pointer" }} aria-label="Change profile photo">
                <ImagePlus size={18} />
                <input type="file" accept="image/jpeg,image/png,image/webp" hidden disabled={avatarUploading} onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) uploadAvatar(file);
                  event.currentTarget.value = "";
                }} />
              </label>
            </div>
            <h1>{profile?.display_name ?? "Gista User"}</h1>
            <p>@{profile?.username ?? "username"}</p>
            {avatarUploading && <p>Uploading profile photo…</p>}
            {avatarError && <div className="auth-message">{avatarError}</div>}
            <p className="bio">{profile?.bio || "A place to talk, share and connect."}</p>
            <div className="profile-stats">
              <span><b>{stats.gists}</b> Gists</span>
              <span><b>{stats.followers}</b> Followers</span>
              <span><b>{stats.following}</b> Following</span>
            </div>
            <button className="primary small" onClick={() => setEdit((value) => !value)}>Edit profile</button>
            <Link className="primary small" href="/saved">Saved Gists</Link>
            {edit && (
              <div className="create-card">
                <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="Display name" />
                <textarea value={bio} onChange={(event) => setBio(event.target.value)} placeholder="Bio" />
                <button className="primary small" onClick={saveProfile}>Save profile</button>
              </div>
            )}
            <button className="primary small" onClick={signOut}>Log out</button>
            <section className="feed" style={{ width: "100%", marginTop: 18 }}>
              <h2>My Gists</h2>
              {gists.length === 0 ? <p>No Gists yet. Start your first Gist.</p> : gists.map((gist) => (
                <Link className="post" href={`/gist/${gist.id}`} key={gist.id}>
                  <div><strong>{gist.content_type === "voice" ? "🎙️ Voice Gist" : gist.content_type === "photo" ? "📷 Photo Gist" : "Text Gist"}</strong><span> · {gist.category}</span></div>
                  {gist.body && <p>{gist.body}</p>}
                  {gist.content_type === "photo" && gist.media_url && <img src={gist.media_url} alt="" style={{ width: "100%", borderRadius: 12, marginTop: 8 }} />}
                  {gist.content_type === "voice" && gist.media_url && <audio controls src={gist.media_url} style={{ width: "100%", marginTop: 8 }} />}
                  <small>{new Date(gist.created_at).toLocaleString()} · {gist.status}</small>
                </Link>
              ))}
            </section>
          </>
        )}
      </section>
    </main>
  );
}
