"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import VoiceNote from "@/components/VoiceNote";

type PublicPost = {
  id: string;
  body: string | null;
  content_type: string;
  media_url: string | null;
  category: string;
  created_at: string;
  voice_duration_seconds: number | null;
};

export default function PublicProfile() {
  const { username } = useParams<{ username: string }>();
  const router = useRouter();
  const supabase = createClient();
  const [profile, setProfile] = useState<any>(null);
  const [me, setMe] = useState<any>(null);
  const [following, setFollowing] = useState(false);
  const [counts, setCounts] = useState({ gists: 0, followers: 0, following: 0 });
  const [gists, setGists] = useState<PublicPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [privateMessage, setPrivateMessage] = useState("");

  async function load() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    setMe(user);

    const { data } = await supabase
      .from("profiles")
      .select("id,username,display_name,bio,avatar_url,is_private")
      .eq("username", username)
      .single();

    setProfile(data);
    if (!data) {
      setLoading(false);
      return;
    }

    const [followState, gistsResult, followersResult, followingResult, postsResult] = await Promise.all([
      user
        ? supabase.from("follows").select("follower_id").eq("follower_id", user.id).eq("following_id", data.id).maybeSingle()
        : Promise.resolve({ data: null }),
      supabase.from("posts").select("id", { count: "exact", head: true }).eq("author_id", data.id),
      supabase.from("follows").select("follower_id", { count: "exact", head: true }).eq("following_id", data.id),
      supabase.from("follows").select("following_id", { count: "exact", head: true }).eq("follower_id", data.id),
      supabase.from("posts").select("id,body,content_type,media_url,category,created_at,voice_duration_seconds").eq("author_id", data.id).order("created_at", { ascending: false }).limit(30),
    ]);

    setFollowing(!!followState.data);
    setCounts({
      gists: gistsResult.count ?? 0,
      followers: followersResult.count ?? 0,
      following: followingResult.count ?? 0,
    });
    if (data.is_private && user?.id !== data.id && !followState.data) {
      setGists([]);
      setPrivateMessage("This account is private. Follow this account to see its Gists.");
    } else {
      setGists((postsResult.data ?? []) as PublicPost[]);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [username]);

  async function toggle() {
    if (!me) {
      router.push("/auth");
      return;
    }
    if (me.id === profile.id) return;

    if (following) {
      const { error } = await supabase
        .from("follows")
        .delete()
        .eq("follower_id", me.id)
        .eq("following_id", profile.id);
      if (!error) {
        setFollowing(false);
        setCounts((current) => ({ ...current, followers: Math.max(0, current.followers - 1) }));
      }
      return;
    }

    const { error } = await supabase.from("follows").insert({
      follower_id: me.id,
      following_id: profile.id,
    });
    if (!error) {
      setFollowing(true);
      setCounts((current) => ({ ...current, followers: current.followers + 1 }));
    }
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
        <div className="profile-avatar">{profile.avatar_url ? <img src={profile.avatar_url} alt="Profile" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }} /> : (profile.display_name?.[0]?.toUpperCase() ?? "G")}</div>
        <h1>{profile.display_name ?? "Gista User"}</h1>
        <p>@{profile.username}</p>
        {profile.bio && <p className="bio">{profile.bio}</p>}

        <div className="profile-stats">
          <span><b>{counts.gists}</b> Gists</span>
          <span><b>{counts.followers}</b> Followers</span>
          <span><b>{counts.following}</b> Following</span>
        </div>

        {me?.id !== profile.id && (
          <button className="primary small" onClick={toggle}>
            {following ? "Unfollow" : "Follow"}
          </button>
        )}
      </section>

      <section className="feed">
        <h2>{counts.gists} Gists</h2>
        {privateMessage ? (
          <div className="empty-state"><h3>Private account</h3><p>{privateMessage}</p></div>
        ) : gists.length === 0 ? (
          <p>No Gists yet.</p>
        ) : (
          gists.map((post) => (
            <Link className="post" key={post.id} href={"/gist/" + post.id}>
              <div className="post-head">
                <div className="avatar">{profile.avatar_url ? <img src={profile.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }} /> : (profile.display_name?.[0]?.toUpperCase() ?? "G")}</div>
                <div className="identity">
                  <strong>{profile.display_name ?? "Gista User"}</strong>
                  <span>@{profile.username} · {new Date(post.created_at).toLocaleString()}</span>
                </div>
                <span className="category">{post.category}</span>
              </div>
              {post.content_type === "photo" && post.media_url && (
                <img src={post.media_url} alt="Gist" style={{ width: "100%", borderRadius: 16, marginTop: 10 }} />
              )}
              {post.content_type === "voice" && post.media_url && (
                <VoiceNote src={post.media_url} durationHint={post.voice_duration_seconds} />
              )}
              {post.body && <p className="post-text">{post.body}</p>}
            </Link>
          ))
        )}
      </section>
    </main>
  );
}
