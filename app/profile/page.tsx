"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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
  cover_url: string | null;
};

type Gist = {
  id: string;
  content_type: string;
  body: string | null;
  media_url: string | null;
  category: string;
  status: string | null;
  created_at: string;
  voice_duration_seconds: number | null;
  likes: number;
  responses: number;
  liked: boolean;
  saved: boolean;
};

const PROFILE_SELECT = "id,username,display_name,bio,avatar_url,cover_url";

export default function ProfilePage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
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
  const [coverUploading, setCoverUploading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadProfile() {
  setError("");
  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user ?? null;
  if (!user) { router.replace("/auth"); return; }
  const profilePromise = supabase.from("profiles").select(PROFILE_SELECT).eq("id", user.id).maybeSingle();
  const statsPromise = supabase.rpc("get_profile_stats", { target_profile_id: user.id });
  const gistsPromise = supabase.from("posts").select("id,content_type,body,media_url,category,status,created_at,voice_duration_seconds").eq("author_id", user.id).order("created_at", { ascending: false }).limit(12);
  let { data, error: profileError } = await profilePromise;
  if (!data && !profileError) { const { data: created, error: createError } = await supabase.from("profiles").insert({ id: user.id, display_name: "", username: null, bio: "" }).select(PROFILE_SELECT).single(); data = created; profileError = createError; }
  if (profileError || !data) { setError(profileError?.message ?? "We couldn't load your profile."); setLoading(false); return; }
  setProfile(data as Profile);setDisplayName(data.display_name ?? "");setUsername(data.username ?? "");setBio(data.bio ?? "");setLoading(false);
  const [{ data: statsData }, { data: ownGistsData }] = await Promise.all([statsPromise, gistsPromise]);
  const profileStats = statsData?.[0] as { gists?: number; followers?: number; following?: number } | undefined;
  const ownGists = (ownGistsData ?? []) as Array<Omit<Gist, "likes" | "responses" | "liked" | "saved">>;
  const postIds = ownGists.map((gist) => gist.id);
  let likeRows: Array<{ post_id: string; user_id: string }> = [];let responseRows: Array<{ post_id: string }> = [];let saveRows: Array<{ post_id: string }> = [];
  if (postIds.length) { const [likesResult, responsesResult, savesResult] = await Promise.all([supabase.from("likes").select("post_id,user_id").in("post_id", postIds),supabase.from("responses").select("post_id").in("post_id", postIds),supabase.from("saves").select("post_id").eq("user_id", user.id).in("post_id", postIds)]);likeRows=(likesResult.data??[]) as Array<{post_id:string;user_id:string}>;responseRows=(responsesResult.data??[]) as Array<{post_id:string}>;saveRows=(savesResult.data??[]) as Array<{post_id:string}>;}
  const likeCounts=Object.fromEntries(postIds.map((id)=>[id,0]));const responseCounts=Object.fromEntries(postIds.map((id)=>[id,0]));likeRows.forEach((row)=>{likeCounts[row.post_id]=(likeCounts[row.post_id]??0)+1});responseRows.forEach((row)=>{responseCounts[row.post_id]=(responseCounts[row.post_id]??0)+1});
  const liked=new Set(likeRows.filter((row)=>row.user_id===user.id).map((row)=>row.post_id));const saved=new Set(saveRows.map((row)=>row.post_id));
  setStats({gists:Number(profileStats?.gists??0),followers:Number(profileStats?.followers??0),following:Number(profileStats?.following??0)});
  setGists(ownGists.map((gist)=>{const likes=likeCounts[gist.id]??0;const responses=responseCounts[gist.id]??0;const status=likes>0||responses>0?(gist.status??"growing"):null;return {...gist,status,likes,responses,liked:liked.has(gist.id),saved:saved.has(gist.id)}}));
}
  useEffect(() => { void loadProfile(); }, [supabase]);

  async function uploadProfileMedia(file: File, kind: "avatar" | "cover") {
    setError("");
    setMessage("");

    const allowed = ["image/jpeg", "image/png", "image/webp"];
    const maxSize = kind === "avatar" ? 5 : 8;
    if (!allowed.includes(file.type)) {
      setError("Use a JPG, PNG, or WebP image.");
      return;
    }
    if (file.size > maxSize * 1024 * 1024) {
      setError(`${kind === "avatar" ? "Profile photos" : "Cover photos"} must be ${maxSize}MB or smaller.`);
      return;
    }

    if (kind === "avatar") setAvatarUploading(true); else setCoverUploading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      if (kind === "avatar") setAvatarUploading(false); else setCoverUploading(false);
      router.replace("/auth");
      return;
    }

    const extension = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
    const prefix = kind === "cover" ? "cover-" : "";
    const path = `${user.id}/${prefix}${crypto.randomUUID()}.${extension}`;
    const upload = await supabase.storage.from("profile-media").upload(path, file, {
      contentType: file.type,
      cacheControl: "3600",
      upsert: false,
    });

    if (upload.error) {
      setError(upload.error.message);
      if (kind === "avatar") setAvatarUploading(false); else setCoverUploading(false);
      return;
    }

    const publicUrl = supabase.storage.from("profile-media").getPublicUrl(path).data.publicUrl;
    const column = kind === "avatar" ? "avatar_url" : "cover_url";
    const { data: updated, error: updateError } = await supabase
      .from("profiles")
      .update({ [column]: publicUrl })
      .eq("id", user.id)
      .select(PROFILE_SELECT)
      .single();

    if (updateError || !updated) {
      await supabase.storage.from("profile-media").remove([path]);
      setError(updateError?.message ?? "Profile could not be updated.");
    } else {
      setProfile(updated as Profile);
      setMessage(kind === "avatar" ? "Profile photo updated." : "Cover photo updated.");
    }

    if (kind === "avatar") setAvatarUploading(false); else setCoverUploading(false);
  }

  async function saveProfile() {
    setError("");
    setMessage("");

    const cleanName = displayName.trim();
    const cleanUsername = username.trim().replace(/^@+/, "").toLowerCase();
    const cleanBio = bio.trim();

    if (cleanName.length > 60) return setError("Display name must be 60 characters or fewer.");
    if (cleanUsername && !/^[a-z0-9_]{3,30}$/.test(cleanUsername)) {
      return setError("Username must be 3–30 characters using letters, numbers, or underscores.");
    }
    if (cleanBio.length > 160) return setError("Bio must be 160 characters or fewer.");

    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setSaving(false);
      router.replace("/auth");
      return;
    }

    const { data: updated, error: updateError } = await supabase
      .from("profiles")
      .update({
        display_name: cleanName,
        username: cleanUsername || null,
        bio: cleanBio,
      })
      .eq("id", user.id)
      .select(PROFILE_SELECT)
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
    if (!user) return router.replace("/auth");
    setBusy(gist.id + "l");
    const result = gist.liked
      ? await supabase.from("likes").delete().eq("post_id", gist.id).eq("user_id", user.id)
      : await supabase.from("likes").insert({ post_id: gist.id, user_id: user.id });
    if (!result.error) {
      setGists((current) => current.map((item) => item.id === gist.id
        ? {
            ...item,
            liked: !item.liked,
            likes: item.likes + (item.liked ? -1 : 1),
            status: item.liked && item.likes <= 1 && item.responses === 0 ? null : item.status ?? "growing",
          }
        : item));
    }
    setBusy(null);
  }

  async function toggleSave(gist: Gist) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return router.replace("/auth");
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
    if (navigator.share) void navigator.share({ title: "Gista", text: gist.body ?? "Join this Gist on Gista", url });
    else void navigator.clipboard.writeText(url);
  }

  if (loading) return <main className="profile-page"><div className="profile-loading">Loading your profile…</div></main>;

  const initials = profile?.display_name?.trim()?.[0]?.toUpperCase() ?? "G";
  const profileUsername = profile?.username ?? "";
  const publicProfileHref = profileUsername ? "/profile/" + profileUsername : "/profile";

  return (
    <main className="profile-page">
      <header className="profile-header">
        <Link href="/" className="profile-back">‹ Home</Link>
        <strong>Profile</strong>
        <Link href="/settings" className="profile-settings" aria-label="Settings"><Settings size={20} /></Link>
      </header>

      <section className="profile-wrap">
        <section className="profile-hero profile-hero-with-cover">
          <div className="profile-cover">
            {profile?.cover_url && <img src={profile.cover_url} alt="" />}
            <label className="profile-cover-camera" aria-label="Change cover photo">
              <Camera size={16} /><span>{profile?.cover_url ? "Change cover" : "Add cover"}</span>
              <input type="file" accept="image/jpeg,image/png,image/webp" hidden disabled={coverUploading}
                onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadProfileMedia(file, "cover"); event.currentTarget.value = ""; }} />
            </label>
          </div>

          <div className="profile-photo-wrap">
            <div className="profile-photo">{profile?.avatar_url ? <img src={profile.avatar_url} alt="Profile" /> : <span>{initials}</span>}</div>
            <label className="profile-camera" aria-label="Change profile photo">
              <Camera size={16} />
              <input type="file" accept="image/jpeg,image/png,image/webp" hidden disabled={avatarUploading}
                onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadProfileMedia(file, "avatar"); event.currentTarget.value = ""; }} />
            </label>
          </div>

          {profile?.display_name && <h1>{profile.display_name}</h1>}
          {profileUsername && <p className="profile-username">@{profileUsername}</p>}
          {profile?.bio && <p className="profile-bio">{profile.bio}</p>}

          <div className="profile-stats">
            <Link href={profileUsername ? publicProfileHref + "#my-gists" : "#my-gists"}><strong>{stats.gists}</strong><span>Gists</span></Link>
            <Link href={profileUsername ? publicProfileHref + "/followers" : "#"}><strong>{stats.followers}</strong><span>Followers</span></Link>
            <Link href={profileUsername ? publicProfileHref + "/following" : "#"}><strong>{stats.following}</strong><span>Following</span></Link>
          </div>

          <div className="profile-actions">
            <button className="profile-primary" type="button" onClick={() => { setEdit((value) => !value); setError(""); setMessage(""); }}>
              {edit ? "Close editor" : "Edit profile"}
            </button>
            <Link className="profile-secondary" href="/saved">Saved</Link>
          </div>

          {(avatarUploading || coverUploading || message || error) && (
            <div className={error ? "profile-feedback error" : "profile-feedback"}>
              {avatarUploading ? "Uploading profile photo…" : coverUploading ? "Uploading cover photo…" : message || error}
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
              <small>3–30 characters: letters, numbers, underscores. You can leave it blank for now.</small>
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
              <div className="empty-g">G</div><h3>No Gists yet</h3><p>Share your first thought, story, photo, or voice Gist.</p>
              <Link href="/create" className="profile-primary">Start a Gist</Link>
            </div>
          ) : (
            <div className="profile-gists">
              {gists.map((gist) => (
                <article className="profile-gist" key={gist.id}>
                  <div className="post-head" style={{ marginBottom: 12 }}>
                    <div className="avatar" style={{ overflow: "hidden" }}>
                      {profile?.avatar_url ? <img src={profile.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : initials}
                    </div>
                    <div className="identity">
                      <strong>{profile?.display_name || "Gista User"}</strong>
                      <span>@{profileUsername || "user"} · {new Date(gist.created_at).toLocaleString()}</span>
                    </div>
                    <span className="category">{gist.category}</span>
                  </div>

                  <Link className="profile-gist-content" href={"/gist/" + gist.id}>{gist.body && <p>{gist.body}</p>}{gist.content_type === "photo" && gist.media_url && <img src={gist.media_url} alt="Gist" />}</Link>
                  {gist.content_type === "voice" && gist.media_url && <div className="profile-gist-voice"><VoiceNote src={gist.media_url} durationHint={gist.voice_duration_seconds} /></div>}

                  {gist.status && (
                    <div className="gist-status">
                      <span className={gist.status === "trending" ? "hot" : "dot"}>{gist.status === "trending" ? "🔥" : "●"}</span>
                      {gist.status.charAt(0).toUpperCase() + gist.status.slice(1)}
                      <Link href={"/gist/" + gist.id}>Gist DNA</Link>
                    </div>
                  )}

                  <div className="actions profile-gist-actions">
                    <button type="button" className={gist.liked ? "liked" : ""} onClick={() => void toggleLike(gist)} disabled={busy === gist.id + "l"} aria-label="Like Gist"><Heart size={18} fill={gist.liked ? "currentColor" : "none"} /> {gist.likes}</button>
                    <Link className="feed-action-link" href={"/gist/" + gist.id}><MessageCircle size={18} /> {gist.responses}</Link>
                    <button type="button" onClick={() => shareGist(gist)} aria-label="Share Gist"><Share2 size={18} /></button>
                    <button type="button" onClick={() => void toggleSave(gist)} disabled={busy === gist.id + "s"} aria-label="Save Gist"><Bookmark size={18} fill={gist.saved ? "currentColor" : "none"} /></button>
                  </div>
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
