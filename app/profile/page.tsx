"use client";

import { useEffect, useMemo, useState } from "react";
import { Camera, Check, Heart, MessageCircle, Settings, Share2, UserRound, Bookmark } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { signOut } from "@/lib/auth";
import VoiceNote from "@/components/VoiceNote";
import BottomNav from "@/components/BottomNav";

type Profile = { id: string; username: string | null; display_name: string | null; bio: string | null; avatar_url: string | null; cover_url: string | null };
type Post = { id: string; content_type: string; body: string | null; media_url: string | null; category: string; status: string | null; created_at: string; voice_duration_seconds: number | null; likes: number; comments: number; saves: number; shares: number; liked: boolean; saved: boolean };
const PROFILE_SELECT = "id,username,display_name,bio,avatar_url,cover_url";

export default function ProfilePage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [edit, setEdit] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [stats, setStats] = useState({ posts: 0, followers: 0, following: 0 });
  const [posts, setPosts] = useState<Post[]>([]);
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
    const fallbackName = user.email?.split("@")[0] ?? "Gista User";
    const [profileResult, statsResult, postsResult] = await Promise.all([
      supabase.from("profiles").select(PROFILE_SELECT).eq("id", user.id).maybeSingle(),
      supabase.rpc("get_profile_stats", { target_profile_id: user.id }),
      supabase.from("posts").select("id,content_type,body,media_url,category,status,created_at,voice_duration_seconds").eq("author_id", user.id).order("created_at", { ascending: false }).limit(30),
    ]);
    let data = profileResult.data as Profile | null;
    if (!data && !profileResult.error) {
      const created = await supabase.from("profiles").insert({ id: user.id, display_name: fallbackName, username: null, bio: "" }).select(PROFILE_SELECT).single();
      data = created.data as Profile | null;
    }
    if (profileResult.error && !data) setError(profileResult.error.message);
    if (data) { setProfile(data); setDisplayName(data.display_name ?? fallbackName); setUsername(data.username ?? ""); setBio(data.bio ?? ""); }
    const rawStats = statsResult.data?.[0] as { gists?: number; followers?: number; following?: number } | undefined;
    setStats({ posts: Number(rawStats?.gists ?? 0), followers: Number(rawStats?.followers ?? 0), following: Number(rawStats?.following ?? 0) });
    const rawPosts = (postsResult.data ?? []) as Array<Omit<Post, "likes" | "comments" | "saves" | "shares" | "liked" | "saved">>;
    const ids = rawPosts.map((post) => post.id);
    if (!ids.length) { setPosts([]); setLoading(false); return; }
    const [likesResult, commentsResult, savesResult, engagementResult] = await Promise.all([
      supabase.from("likes").select("post_id,user_id").in("post_id", ids),
      supabase.from("responses").select("post_id").in("post_id", ids),
      supabase.from("saves").select("post_id,user_id").in("post_id", ids),
      supabase.from("post_engagement_counts").select("post_id,share_count").in("post_id", ids),
    ]);
    const likeCounts = Object.fromEntries(ids.map((id) => [id, 0]));
    const commentCounts = Object.fromEntries(ids.map((id) => [id, 0]));
    const saveCounts = Object.fromEntries(ids.map((id) => [id, 0]));
    const shareCounts = Object.fromEntries(ids.map((id) => [id, 0]));
    (likesResult.data ?? []).forEach((row: { post_id: string }) => { likeCounts[row.post_id] = (likeCounts[row.post_id] ?? 0) + 1; });
    (commentsResult.data ?? []).forEach((row: { post_id: string }) => { commentCounts[row.post_id] = (commentCounts[row.post_id] ?? 0) + 1; });
    (savesResult.data ?? []).forEach((row: { post_id: string }) => { saveCounts[row.post_id] = (saveCounts[row.post_id] ?? 0) + 1; });
    (engagementResult.data ?? []).forEach((row: { post_id: string; share_count: number | string }) => { shareCounts[row.post_id] = Number(row.share_count) || 0; });
    const liked = new Set((likesResult.data ?? []).filter((row: { user_id: string }) => row.user_id === user.id).map((row: { post_id: string }) => row.post_id));
    const saved = new Set((savesResult.data ?? []).filter((row: { user_id: string }) => row.user_id === user.id).map((row: { post_id: string }) => row.post_id));
    setPosts(rawPosts.map((post) => ({ ...post, likes: likeCounts[post.id] ?? 0, comments: commentCounts[post.id] ?? 0, saves: saveCounts[post.id] ?? 0, shares: shareCounts[post.id] ?? 0, liked: liked.has(post.id), saved: saved.has(post.id) })));
    setLoading(false);
  }

  useEffect(() => { void loadProfile(); }, [supabase]);

  async function uploadProfileMedia(file: File, kind: "avatar" | "cover") {
    setError(""); setMessage("");
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) return setError("Use a JPG, PNG, or WebP image.");
    const max = kind === "avatar" ? 5 : 8;
    if (file.size > max * 1024 * 1024) return setError(`${kind === "avatar" ? "Profile photos" : "Cover photos"} must be ${max}MB or smaller.`);
    if (kind === "avatar") setAvatarUploading(true); else setCoverUploading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.replace("/auth"); return; }
    const extension = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
    const prefix = kind === "cover" ? "cover-" : "";
    const path = `${user.id}/${prefix}${crypto.randomUUID()}.${extension}`;
    const upload = await supabase.storage.from("profile-media").upload(path, file, { contentType: file.type, cacheControl: "3600" });
    if (upload.error) { setError(upload.error.message); if (kind === "avatar") setAvatarUploading(false); else setCoverUploading(false); return; }
    const publicUrl = supabase.storage.from("profile-media").getPublicUrl(path).data.publicUrl;
    const column = kind === "avatar" ? "avatar_url" : "cover_url";
    const { data: updated, error: updateError } = await supabase.from("profiles").update({ [column]: publicUrl }).eq("id", user.id).select(PROFILE_SELECT).single();
    if (updateError || !updated) { await supabase.storage.from("profile-media").remove([path]); setError(updateError?.message ?? "Profile could not be updated."); }
    else { setProfile(updated as Profile); setMessage(kind === "avatar" ? "Profile photo updated." : "Cover photo updated."); }
    if (kind === "avatar") setAvatarUploading(false); else setCoverUploading(false);
  }

  async function saveProfile() {
    setError(""); setMessage("");
    const cleanName = displayName.trim();
    const cleanUsername = username.trim().replace(/^@+/, "").toLowerCase();
    const cleanBio = bio.trim();
    if (!cleanName || cleanName.length > 60) return setError("Display name is required and must be 60 characters or fewer.");
    if (cleanUsername && !/^[a-z0-9_]{3,30}$/.test(cleanUsername)) return setError("Username must be 3–30 characters using letters, numbers, or underscores.");
    if (cleanBio.length > 160) return setError("Bio must be 160 characters or fewer.");
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); router.replace("/auth"); return; }
    const { data: updated, error: updateError } = await supabase.from("profiles").update({ display_name: cleanName, username: cleanUsername || null, bio: cleanBio }).eq("id", user.id).select(PROFILE_SELECT).single();
    if (updateError || !updated) { setError(updateError?.code === "23505" ? "That username is already taken." : updateError?.message ?? "Profile could not be saved."); setSaving(false); return; }
    setProfile(updated as Profile); setDisplayName(updated.display_name ?? ""); setUsername(updated.username ?? ""); setBio(updated.bio ?? ""); setEdit(false); setMessage("Profile updated."); setSaving(false);
  }

  async function toggleLike(post: Post) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.replace("/auth"); return; }
    setBusy(post.id + "l");
    const result = post.liked ? await supabase.from("likes").delete().eq("post_id", post.id).eq("user_id", user.id) : await supabase.from("likes").insert({ post_id: post.id, user_id: user.id });
    if (!result.error) setPosts((current) => current.map((item) => item.id === post.id ? { ...item, liked: !item.liked, likes: Math.max(0, item.likes + (item.liked ? -1 : 1)) } : item));
    setBusy(null);
  }

  async function toggleSave(post: Post) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.replace("/auth"); return; }
    setBusy(post.id + "s");
    const result = post.saved ? await supabase.from("saves").delete().eq("post_id", post.id).eq("user_id", user.id) : await supabase.from("saves").insert({ post_id: post.id, user_id: user.id });
    if (!result.error) setPosts((current) => current.map((item) => item.id === post.id ? { ...item, saved: !item.saved, saves: Math.max(0, item.saves + (item.saved ? -1 : 1)) } : item));
    setBusy(null);
  }

  async function sharePost(post: Post) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.replace("/auth"); return; }
    const url = window.location.origin + "/post/" + post.id;
    try { if (navigator.share) await navigator.share({ title: "Gista", text: post.body ?? "Check out this Post on Gista", url }); else await navigator.clipboard.writeText(url); const result = await supabase.from("shares").insert({ post_id: post.id, user_id: user.id }); if (!result.error) setPosts((current) => current.map((item) => item.id === post.id ? { ...item, shares: item.shares + 1 } : item)); } catch { /* cancelled */ }
  }

  const initials = (profile?.display_name ?? displayName).trim()[0]?.toUpperCase() ?? "G";
  const profileUsername = profile?.username ?? username;

  return <main className="profile-page">
    <header className="profile-header"><Link href="/" className="profile-back">‹ Home</Link><strong>Profile</strong><Link href="/settings" className="profile-settings" aria-label="Settings"><Settings size={20}/></Link></header>
    <section className="profile-wrap">
      <section className="profile-hero profile-hero-with-cover">
        <div className="profile-cover">{profile?.cover_url && <img src={profile.cover_url} alt=""/>}<label className="profile-cover-camera" aria-label="Change cover photo"><Camera size={16}/><span>{profile?.cover_url ? "Change cover" : "Add cover"}</span><input type="file" accept="image/jpeg,image/png,image/webp" hidden disabled={coverUploading} onChange={(event)=>{const file=event.target.files?.[0];if(file)void uploadProfileMedia(file,"cover");event.currentTarget.value="";}}/></label></div>
        <div className="profile-photo-wrap"><div className="profile-photo">{profile?.avatar_url?<img src={profile.avatar_url} alt="Profile"/>:<span>{initials}</span>}</div><label className="profile-camera" aria-label="Change profile photo"><Camera size={16}/><input type="file" accept="image/jpeg,image/png,image/webp" hidden disabled={avatarUploading} onChange={(event)=>{const file=event.target.files?.[0];if(file)void uploadProfileMedia(file,"avatar");event.currentTarget.value="";}}/></label></div>
        <h1>{profile?.display_name || displayName || "Gista User"}<span className="verified-badge" aria-label="Verified account">✓</span></h1>
        {profileUsername && <p className="profile-username">@{profileUsername}</p>}
        {profile?.bio && <p className="profile-bio">{profile.bio}</p>}
        <div className="profile-stats"><Link href="#my-posts"><strong>{stats.posts}</strong><span>Posts</span></Link><Link href={profileUsername?`/profile/${profileUsername}/followers`:"#"}><strong>{stats.followers}</strong><span>Followers</span></Link><Link href={profileUsername?`/profile/${profileUsername}/following`:"#"}><strong>{stats.following}</strong><span>Following</span></Link></div>
        <div className="profile-actions"><button className="profile-primary" type="button" onClick={()=>{setEdit((value)=>!value);setError("");setMessage("");}}>{edit?"Close editor":"Edit profile"}</button><Link className="profile-secondary" href="/saved">Saved Posts</Link></div>
        {(loading||avatarUploading||coverUploading||message||error)&&<div className={error?"profile-feedback error":"profile-feedback"}>{loading?"Loading profile details…":avatarUploading?"Uploading profile photo…":coverUploading?"Uploading cover photo…":message||error}</div>}
      </section>
      {edit&&<section className="profile-editor"><div className="editor-heading"><div><h2>Edit profile</h2><p>Update your name, username and bio.</p></div><UserRound size={22}/></div><label>Display name<input value={displayName} maxLength={60} onChange={(e)=>setDisplayName(e.target.value)} placeholder="Your display name" /></label><label>Username<div className="username-input"><span>@</span><input value={username} maxLength={30} onChange={(e)=>setUsername(e.target.value.replace(/\s/g,""))} placeholder="username" /></div></label><label>Bio<textarea value={bio} maxLength={160} onChange={(e)=>setBio(e.target.value)} placeholder="Tell people about yourself…" /><small>{bio.length}/160</small></label><button className="profile-save" type="button" onClick={()=>void saveProfile()} disabled={saving}><Check size={17}/> {saving?"Saving…":"Save changes"}</button></section>}
      <section className="profile-content" id="my-posts"><div className="section-title"><h2>Posts</h2><span>{stats.posts}</span></div>{posts.length===0?<div className="profile-empty"><div className="empty-g">G</div><h3>No Posts yet</h3><p>Share your first thought, story, photo, or voice Post.</p><Link href="/create" className="profile-primary">Create Post</Link></div>:<div className="profile-gists">{posts.map((post)=><article className="profile-gist" key={post.id}>
        <div className="post-head"><div className="avatar" style={{overflow:"hidden"}}>{profile?.avatar_url?<img src={profile.avatar_url} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>:initials}</div><div className="identity"><strong>{profile?.display_name||displayName||"Gista User"}</strong><span>@{profileUsername||"user"} · {new Date(post.created_at).toLocaleString()}</span></div><span className="category">{post.category}</span></div>
        <Link className="profile-gist-content" href={"/post/"+post.id+"?comments=1"}>{post.body&&<p>{post.body}</p>}{post.content_type==="photo"&&post.media_url&&<img src={post.media_url} alt="Post" loading="lazy"/>}</Link>
        {post.content_type==="voice"&&post.media_url&&<div className="profile-gist-voice"><VoiceNote src={post.media_url} durationHint={post.voice_duration_seconds}/></div>}
        <div className="gist-status"><span className="dot">●</span>{post.status?post.status.charAt(0).toUpperCase()+post.status.slice(1):"Growing"}<Link href={"/post/"+post.id+"?dna=1"}>Post DNA</Link></div>
        <div className="actions profile-gist-actions"><button type="button" className={post.liked?"liked":""} onClick={()=>void toggleLike(post)} disabled={busy===post.id+"l"} aria-label="Like Post"><Heart size={18} fill={post.liked?"currentColor":"none"}/> {post.likes}</button><Link className="feed-action-link" href={"/post/"+post.id} aria-label="Comments"><MessageCircle size={18}/> {post.comments}</Link><button type="button" onClick={()=>void sharePost(post)} aria-label="Share Post"><Share2 size={18}/> {post.shares}</button><button type="button" className={post.saved?"saved-action":""} onClick={()=>void toggleSave(post)} disabled={busy===post.id+"s"} aria-label={post.saved?"Unsave Post":"Save Post"}><Bookmark size={18} fill={post.saved?"currentColor":"none"}/> {post.saves}</button></div>
      </article>)}</div>}</section>
      <button className="profile-logout" type="button" onClick={()=>void signOut()}>Log out</button>
    </section>
    <BottomNav active="profile"/>
  </main>;
}
