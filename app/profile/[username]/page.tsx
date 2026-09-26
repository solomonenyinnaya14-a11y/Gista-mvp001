"use client";

import { useEffect, useMemo, useState } from "react";
import { Bookmark, Heart, MessageCircle, Share2 } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import VoiceNote from "@/components/VoiceNote";

type Profile = {
  id: string;
  username: string;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  is_private: boolean;
};

type PublicPost = {
  id: string;
  body: string | null;
  content_type: string;
  media_url: string | null;
  category: string;
  status: string | null;
  created_at: string;
  voice_duration_seconds: number | null;
  likes: number;
  responses: number;
  saves: number;
  liked: boolean;
  saved: boolean;
};

export default function PublicProfile() {
  const { username } = useParams<{ username: string }>();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [me, setMe] = useState<{ id: string } | null>(null);
  const [following, setFollowing] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [counts, setCounts] = useState({ gists: 0, followers: 0, following: 0 });
  const [gists, setGists] = useState<PublicPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [privateMessage, setPrivateMessage] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    setMe(user ? { id: user.id } : null);

    const { data, error } = await supabase
      .from("profiles")
      .select("id,username,display_name,bio,avatar_url,cover_url,is_private,following_private")
      .eq("username", username)
      .single();

    if (error || !data) {
      setProfile(null);
      setIsVerified(false);
      setLoading(false);
      return;
    }

    // The account owner's profile must always use the dedicated private
    // profile page so they retain owner-only controls such as Edit profile,
    // profile/cover photo editing, Saved, Settings, and Log out. The dynamic
    // /profile/[username] route is for viewing other people's profiles.
    if (user?.id === data.id) {
      router.replace("/profile");
      return;
    }

    const [followState, statsResult, postsResult] = await Promise.all([
      user
        ? supabase.from("follows").select("follower_id").eq("follower_id", user.id).eq("following_id", data.id).maybeSingle()
        : Promise.resolve({ data: null }),
      supabase.rpc("get_profile_stats", { target_profile_id: data.id }),
      supabase.from("posts").select("id,body,content_type,media_url,category,status,created_at,voice_duration_seconds").eq("author_id", data.id).order("created_at", { ascending: false }).limit(30),
    ]);

    const { data: verification } = await supabase
      .from("verified_profiles")
      .select("profile_id")
      .eq("profile_id", data.id)
      .maybeSingle();

    const profileStats = statsResult.data?.[0] as { gists?: number; followers?: number; following?: number } | undefined;
    const isFollowing = !!followState.data;

    setProfile(data as Profile);
    setIsVerified(!!verification);
    setFollowing(isFollowing);
    setCounts({
      gists: Number(profileStats?.gists ?? 0),
      followers: Number(profileStats?.followers ?? 0),
      following: Number(profileStats?.following ?? 0),
    });

    if (data.is_private && user?.id !== data.id && !isFollowing) {
      setGists([]);
      setPrivateMessage("This account is private. Follow this account to see its Gists.");
      setLoading(false);
      return;
    }

    const ownPosts = (postsResult.data ?? []) as Array<Omit<PublicPost, "likes" | "responses" | "liked" | "saved">>;
    const postIds = ownPosts.map((post) => post.id);

    if (!postIds.length) {
      setGists([]);
      setPrivateMessage("");
      setLoading(false);
      return;
    }

    const [likesResult, responsesResult, savesResult] = await Promise.all([
      supabase.from("likes").select("post_id,user_id").in("post_id", postIds),
      supabase.from("responses").select("post_id").in("post_id", postIds),
      supabase.from("saves").select("post_id,user_id").in("post_id", postIds),
    ]);

    const likeCounts = Object.fromEntries(postIds.map((postId) => [postId, 0]));
    const responseCounts = Object.fromEntries(postIds.map((postId) => [postId, 0]));
    (likesResult.data ?? []).forEach((row: { post_id: string }) => { likeCounts[row.post_id] = (likeCounts[row.post_id] ?? 0) + 1; });
    (responsesResult.data ?? []).forEach((row: { post_id: string }) => { responseCounts[row.post_id] = (responseCounts[row.post_id] ?? 0) + 1; });

    const liked = new Set((likesResult.data ?? []).filter((row: { user_id: string }) => row.user_id === user?.id).map((row: { post_id: string }) => row.post_id));
    const saveCounts = Object.fromEntries(postIds.map((postId) => [postId, 0]));
    (savesResult.data ?? []).forEach((row: { post_id: string }) => { saveCounts[row.post_id] = (saveCounts[row.post_id] ?? 0) + 1; });
    const saved = new Set((savesResult.data ?? []).filter((row: { user_id: string }) => row.user_id === user?.id).map((row: { post_id: string }) => row.post_id));

    setPrivateMessage("");
    setGists(ownPosts.map((post) => {
      const likes = likeCounts[post.id] ?? 0;
      const responses = responseCounts[post.id] ?? 0;
      // Keep profile status display consistent with the MVP rule: any real
      // engagement makes a Gist Growing; no engagement means no status.
      const status = post.status ?? (likes > 0 || responses > 0 ? "growing" : null);
      return {
        ...post,
        status,
        likes,
        responses,
        saves: saveCounts[post.id] ?? 0,
        liked: liked.has(post.id),
        saved: saved.has(post.id),
      };
    }));
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, [supabase, username]);

  async function toggleFollow() {
    if (!me) {
      router.push("/auth");
      return;
    }
    if (!profile || me.id === profile.id) return;

    if (following) {
      const { error } = await supabase.from("follows").delete().eq("follower_id", me.id).eq("following_id", profile.id);
      if (!error) {
        setFollowing(false);
        setCounts((current) => ({ ...current, followers: Math.max(0, current.followers - 1) }));
      }
      return;
    }

    const { error } = await supabase.from("follows").insert({ follower_id: me.id, following_id: profile.id });
    if (!error) {
      setFollowing(true);
      setCounts((current) => ({ ...current, followers: current.followers + 1 }));
    }
  }

  async function toggleLike(post: PublicPost) {
    if (!me) {
      router.push("/auth");
      return;
    }

    setBusy(post.id + "l");
    const result = post.liked
      ? await supabase.from("likes").delete().eq("post_id", post.id).eq("user_id", me.id)
      : await supabase.from("likes").insert({ post_id: post.id, user_id: me.id });

    if (!result.error) {
      setGists((current) => current.map((item) => item.id === post.id
        ? { ...item, liked: !item.liked, likes: item.likes + (item.liked ? -1 : 1) }
        : item));
    }
    setBusy(null);
  }

  async function toggleSave(post: PublicPost) {
    if (!me) {
      router.push("/auth");
      return;
    }

    setBusy(post.id + "s");
    const result = post.saved
      ? await supabase.from("saves").delete().eq("post_id", post.id).eq("user_id", me.id)
      : await supabase.from("saves").insert({ post_id: post.id, user_id: me.id });

    if (!result.error) {
      setGists((current) => current.map((item) => item.id === post.id ? { ...item, saved: !item.saved, saves: Math.max(0, item.saves + (item.saved ? -1 : 1)) } : item));
    }
    setBusy(null);
  }

  function share(post: PublicPost) {
    const url = window.location.origin + "/gist/" + post.id;
    if (navigator.share) void navigator.share({ title: "Gista", text: post.body ?? "Join this Gist on Gista", url });
    else void navigator.clipboard.writeText(url);
  }

  if (loading) return <main className="content"><p>Loading profile…</p></main>;
  if (!profile) return <main className="content"><p>Profile not found.</p></main>;

  return (
    <main className="profile-page">
      <header className="simple-header">
        <Link href="/">‹ Home</Link>
        <strong>Profile</strong>
        <span />
      </header>

      <section className="profile-card">
        <div className="profile-cover">
          {profile.cover_url && <img src={profile.cover_url} alt="" />}
        </div>
        <div className="profile-avatar">
          {profile.avatar_url
            ? <img src={profile.avatar_url} alt="Profile" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }} />
            : (profile.display_name?.[0]?.toUpperCase() ?? "G")}
        </div>
        <h1>
          {profile.display_name ?? "Gista User"}
          {isVerified && (
            <span title="Verified account" aria-label="Verified account" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 20, height: 20, marginLeft: 6, borderRadius: "50%", background: "#6D28D9", color: "#fff", fontSize: 12, fontWeight: 800, lineHeight: 1, verticalAlign: "middle" }}>✓</span>
          )}
        </h1>
        <p>@{profile.username}</p>
        {profile.bio && <p className="bio">{profile.bio}</p>}

        <div className="profile-stats">
          <Link href={"/profile/" + profile.username + "#gists"}><b>{counts.gists}</b><span>Gists</span></Link>
          <Link href={"/profile/" + profile.username + "/followers"}><b>{counts.followers}</b><span>Followers</span></Link>
          <Link href={"/profile/" + profile.username + "/following"}><b>{counts.following}</b><span>Following</span></Link>
        </div>

        {me?.id !== profile.id && <button className="primary small" type="button" onClick={() => void toggleFollow()}>{following ? "Unfollow" : "Follow"}</button>}
      </section>

      <section className="feed" id="gists">
        <h2>{counts.gists} Gists</h2>
        {privateMessage ? (
          <div className="empty-state"><h3>Private account</h3><p>{privateMessage}</p></div>
        ) : gists.length === 0 ? (
          <p>No Gists yet.</p>
        ) : (
          gists.map((post) => (
            <article className="post" key={post.id}>
              <div className="post-head">
                <Link href={"/profile/" + profile.username} className="avatar" aria-label="Open profile">
                  {profile.avatar_url
                    ? <img src={profile.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }} />
                    : (profile.display_name?.[0]?.toUpperCase() ?? "G")}
                </Link>
                <div className="identity">
                  <Link href={"/profile/" + profile.username}><strong>{profile.display_name ?? "Gista User"}</strong></Link>
                  <span>@{profile.username} · {new Date(post.created_at).toLocaleString()}</span>
                </div>
                <span className="category">{post.category}</span>
              </div>

              <Link className="profile-gist-content" href={"/gist/" + post.id}>
                {post.content_type === "photo" && post.media_url && <img src={post.media_url} alt="Gist" style={{ width: "100%", borderRadius: 16, marginTop: 10 }} />}
                {post.body && <p className="post-text">{post.body}</p>}
              </Link>

              {post.content_type === "voice" && post.media_url && (
                <div className="profile-gist-voice"><VoiceNote src={post.media_url} durationHint={post.voice_duration_seconds} /></div>
              )}

              {post.status && (
                <div className="gist-status">
                  <span className={post.status === "trending" ? "hot" : "dot"}>{post.status === "trending" ? "🔥" : "●"}</span>
                  {post.status.charAt(0).toUpperCase() + post.status.slice(1)}
                  <Link href={"/gist/" + post.id}>Gist DNA</Link>
                </div>
              )}

              <div className="actions">
                <button type="button" className={post.liked ? "liked" : ""} onClick={() => void toggleLike(post)} disabled={busy === post.id + "l"} aria-label="Like Gist"><Heart size={18} fill={post.liked ? "currentColor" : "none"} /> {post.likes}</button>
                <Link className="feed-action-link" href={"/gist/" + post.id}><MessageCircle size={18} /> {post.responses}</Link>
                <button type="button" onClick={() => share(post)} aria-label="Share Gist"><Share2 size={18} /></button>
                <button type="button" className={post.saved ? "saved-action" : ""} onClick={() => void toggleSave(post)} disabled={busy === post.id + "s"} aria-label="Save Gist"><Bookmark size={18} fill={post.saved ? "currentColor" : "none"} /> {post.saves}</button>
              </div>
            </article>
          ))
        )}
      </section>
    </main>
  );
}
