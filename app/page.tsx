"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, Bookmark, Heart, Home, MessageCircle, Plus, Search, Settings, Share2, User } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import VoiceNote from "@/components/VoiceNote";

type Profile = {
  id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
};

type Post = {
  id: string;
  body: string | null;
  content_type: string;
  media_url: string | null;
  category: string;
  status: string;
  created_at: string;
  author_id: string;
  voice_duration_seconds: number | null;
  profiles: Profile | null;
  likes: number;
  responses: number;
  liked: boolean;
  saved: boolean;
};

export default function HomePage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [tab, setTab] = useState("Discover");
  const [user, setUser] = useState<{ id: string; email?: string | null } | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [authReady, setAuthReady] = useState(false);
  const [feedError, setFeedError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  const loadNotifications = useCallback(async (currentUser: { id: string } | null) => {
    if (!currentUser) {
      setUnreadNotifications(0);
      return;
    }

    const { count } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("recipient_id", currentUser.id)
      .is("read_at", null);

    setUnreadNotifications(count ?? 0);
  }, [supabase]);

  const loadProfile = useCallback(async (currentUser: { id: string } | null) => {
    if (!currentUser) {
      setProfile(null);
      return;
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("id,display_name,username,avatar_url")
      .eq("id", currentUser.id)
      .maybeSingle();

    if (error) {
      setProfile(null);
      return;
    }

    setProfile(data as Profile | null);
  }, [supabase]);

  const loadPosts = useCallback(async (currentUser: { id: string } | null) => {
    setLoading(true);
    setFeedError("");

    const query = supabase
      .from("posts")
      .select("id,body,content_type,media_url,category,status,created_at,author_id,voice_duration_seconds")
      .order("created_at", { ascending: false })
      .limit(tab === "Following" ? 50 : 30);

    // Start the first feed query and all user filters together. The previous
    // implementation waited for the filters before requesting posts, creating
    // an avoidable network waterfall on every home load.
    const [postsResult, blockedResult, hiddenResult, followsResult] = await Promise.all([
      query,
      currentUser
        ? supabase.from("blocks").select("blocked_id").eq("blocker_id", currentUser.id)
        : Promise.resolve({ data: [] as { blocked_id: string }[], error: null }),
      currentUser
        ? supabase.from("not_interested").select("post_id").eq("user_id", currentUser.id)
        : Promise.resolve({ data: [] as { post_id: string }[], error: null }),
      currentUser && tab === "Following"
        ? supabase.from("follows").select("following_id").eq("follower_id", currentUser.id)
        : Promise.resolve({ data: [] as { following_id: string }[], error: null }),
    ]);

    if (postsResult.error) {
      setFeedError(postsResult.error.message);
      setPosts([]);
      setLoading(false);
      return;
    }
    if (followsResult.error) {
      setFeedError(followsResult.error.message);
      setPosts([]);
      setLoading(false);
      return;
    }

    const blockedIds = new Set((blockedResult.data ?? []).map((item: { blocked_id: string }) => item.blocked_id));
    const hiddenPostIds = new Set((hiddenResult.data ?? []).map((item: { post_id: string }) => item.post_id));
    const followingIds = new Set((followsResult.data ?? []).map((item: { following_id: string }) => item.following_id));

    let data = (postsResult.data ?? []).filter((post) => {
      if (blockedIds.has(post.author_id) || hiddenPostIds.has(post.id)) return false;
      if (tab === "Following" && !followingIds.has(post.author_id)) return false;
      return true;
    });

    if (tab === "Trending") {
      data = data.filter((post) => post.status === "trending");
    }

    if (!data.length) {
      setPosts([]);
      setLoading(false);
      return;
    }

    const postIds = data.map((post) => post.id);
    const authorIds = [...new Set(data.map((post) => post.author_id))];

    // Counts, user state, and author profiles are independent reads. Fetch
    // them in one parallel batch instead of serial requests.
    const [likesResult, responsesResult, savesResult, profileResult] = await Promise.all([
      supabase.from("likes").select("post_id,user_id").in("post_id", postIds),
      supabase.from("responses").select("post_id").in("post_id", postIds),
      currentUser
        ? supabase.from("saves").select("post_id").eq("user_id", currentUser.id).in("post_id", postIds)
        : Promise.resolve({ data: [] as { post_id: string }[], error: null }),
      supabase.from("profiles").select("id,display_name,username,avatar_url").in("id", authorIds),
    ]);

    if (profileResult.error) {
      setFeedError(profileResult.error.message);
      setPosts([]);
      setLoading(false);
      return;
    }

    const likeCounts = Object.fromEntries(postIds.map((postId) => [postId, 0]));
    const responseCounts = Object.fromEntries(postIds.map((postId) => [postId, 0]));

    (likesResult.data ?? []).forEach((item: { post_id: string }) => {
      likeCounts[item.post_id] = (likeCounts[item.post_id] ?? 0) + 1;
    });
    (responsesResult.data ?? []).forEach((item: { post_id: string }) => {
      responseCounts[item.post_id] = (responseCounts[item.post_id] ?? 0) + 1;
    });

    const liked = new Set(
      (likesResult.data ?? [])
        .filter((item: { user_id: string }) => item.user_id === currentUser?.id)
        .map((item: { post_id: string }) => item.post_id),
    );
    const saved = new Set((savesResult.data ?? []).map((item: { post_id: string }) => item.post_id));
    const profilesById = new Map((profileResult.data ?? []).map((item) => [item.id, item as Profile]));

    setPosts(data.map((post) => ({
      ...post,
      profiles: profilesById.get(post.author_id) ?? null,
      likes: likeCounts[post.id] ?? 0,
      responses: responseCounts[post.id] ?? 0,
      liked: liked.has(post.id),
      saved: saved.has(post.id),
    })));
    setLoading(false);
  }, [supabase, tab]);

  useEffect(() => {
    let active = true;
    let notificationChannel: ReturnType<typeof supabase.channel> | null = null;

    const initialize = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!active) return;

      const currentUser = sessionData.session?.user
        ? { id: sessionData.session.user.id, email: sessionData.session.user.email }
        : null;
      setUser(currentUser);
      setAuthReady(true);
      void loadProfile(currentUser);
      void loadNotifications(currentUser);

      if (currentUser) {
        notificationChannel = supabase
          .channel("home-notifications-" + currentUser.id)
          .on(
            "postgres_changes",
            { event: "INSERT", schema: "public", table: "notifications", filter: "recipient_id=eq." + currentUser.id },
            () => void loadNotifications(currentUser),
          )
          .on(
            "postgres_changes",
            { event: "UPDATE", schema: "public", table: "notifications", filter: "recipient_id=eq." + currentUser.id },
            () => void loadNotifications(currentUser),
          )
          .subscribe();
      }
    };

    void initialize();

    const { data: authSubscription } = supabase.auth.onAuthStateChange((_event, session) => {
      const currentUser = session?.user ? { id: session.user.id, email: session.user.email } : null;
      setUser(currentUser);
      setAuthReady(true);
      void loadProfile(currentUser);
      void loadNotifications(currentUser);
    });

    return () => {
      active = false;
      authSubscription.subscription.unsubscribe();
      if (notificationChannel) void supabase.removeChannel(notificationChannel);
    };
  }, [loadNotifications, loadProfile, supabase]);

  useEffect(() => {
    if (!authReady) return;
    void loadPosts(user);
  }, [authReady, loadPosts, user]);

  async function toggleLike(post: Post) {
    if (!user) {
      router.push("/auth");
      return;
    }

    setBusy(post.id + "l");
    const result = post.liked
      ? await supabase.from("likes").delete().eq("post_id", post.id).eq("user_id", user.id)
      : await supabase.from("likes").insert({ post_id: post.id, user_id: user.id });

    if (!result.error) {
      setPosts((current) => current.map((item) => item.id === post.id
        ? { ...item, liked: !item.liked, likes: item.likes + (item.liked ? -1 : 1) }
        : item));
    }

    setBusy(null);
  }

  async function toggleSave(post: Post) {
    if (!user) {
      router.push("/auth");
      return;
    }

    setBusy(post.id + "s");
    const result = post.saved
      ? await supabase.from("saves").delete().eq("post_id", post.id).eq("user_id", user.id)
      : await supabase.from("saves").insert({ post_id: post.id, user_id: user.id });

    if (!result.error) {
      setPosts((current) => current.map((item) => item.id === post.id ? { ...item, saved: !item.saved } : item));
    }

    setBusy(null);
  }

  const displayName = profile?.display_name ?? user?.email?.split("@")[0] ?? "Gista User";
  const initials = displayName.trim().charAt(0).toUpperCase() || "G";

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand"><div className="brand-icon">G</div><span>Gista</span></div>
        <Link className="icon-btn" aria-label="Settings" href="/settings"><Settings size={20} /></Link>
      </header>

      <section className="content">
        <div className="feed-tabs">
          {["Discover", "Following", "Trending"].map((item) => (
            <button key={item} className={tab === item ? "tab active" : "tab"} onClick={() => setTab(item)}>{item}</button>
          ))}
        </div>

        <div className="composer">
          <Link href="/profile" className="avatar" aria-label="Open your profile">
            {profile?.avatar_url ? <img src={profile.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }} /> : initials}
          </Link>
          <Link className="composer-input" href="/create">What&apos;s on your mind, {displayName.split(" ")[0]}?</Link>
          <Link className="create-btn" aria-label="Start a Gist" href="/create"><Plus size={19} /></Link>
        </div>

        <div className="feed">
          {loading ? (
            <div className="feed-skeleton" aria-label="Loading Gists">
              <div className="skeleton-post" />
              <div className="skeleton-post" />
            </div>
          ) : feedError ? (
            <div className="empty-state"><h3>We couldn&apos;t load the Gists</h3><p>{feedError}</p><button className="primary small" onClick={() => void loadPosts(user)}>Try again</button></div>
          ) : posts.length === 0 ? (
            <div className="empty-state"><h3>No Gists yet</h3><p>{tab === "Following" ? "Follow people to see their Gists here." : "Be the first person to start a Gist."}</p></div>
          ) : posts.map((post, index) => (
            <article className="post" key={post.id}>
              <div className="post-head">
                <Link href={post.profiles?.username ? "/profile/" + post.profiles.username : "/profile"} className="avatar" aria-label={"Open " + (post.profiles?.display_name ?? "Gista User") + " profile"}>
                  {post.profiles?.avatar_url
                    ? <img src={post.profiles.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }} />
                    : (post.profiles?.display_name?.charAt(0).toUpperCase() ?? "G")}
                </Link>
                <div className="identity">
                  <Link href={post.profiles?.username ? "/profile/" + post.profiles.username : "/profile"}><strong>{post.profiles?.display_name ?? "Gista User"}</strong></Link>
                  <span>@{post.profiles?.username ?? "user"} · {new Date(post.created_at).toLocaleString()}</span>
                </div>
                <span className="category">{post.category}</span>
              </div>

              {post.content_type === "photo" && post.media_url && (
                <img
                  src={post.media_url}
                  alt="Gist photo"
                  loading={index === 0 ? "eager" : "lazy"}
                  decoding="async"
                  fetchPriority={index === 0 ? "high" : "auto"}
                  style={{ width: "100%", borderRadius: 16, marginTop: 10 }}
                />
              )}
              {post.content_type === "voice" && post.media_url && <VoiceNote src={post.media_url} durationHint={post.voice_duration_seconds} />}
              {post.body && <p className="post-text">{post.body}</p>}

              <div className="gist-status">
                <span className={post.status === "trending" ? "hot" : "dot"}>{post.status === "trending" ? "🔥" : "●"}</span>
                {post.status.charAt(0).toUpperCase() + post.status.slice(1)}
                <Link href={"/gist/" + post.id}>Gist DNA</Link>
              </div>

              <div className="actions">
                <button type="button" className={post.liked ? "liked" : ""} onClick={() => void toggleLike(post)} disabled={busy === post.id + "l"} aria-label="Like Gist">
                  <Heart size={18} fill={post.liked ? "currentColor" : "none"} /> {post.likes}
                </button>
                <Link className="feed-action-link" href={"/gist/" + post.id}><MessageCircle size={18} /> {post.responses}</Link>
                <button type="button" onClick={() => {
                  const url = window.location.origin + "/gist/" + post.id;
                  if (navigator.share) void navigator.share({ title: "Gista", text: post.body ?? "Join this Gist on Gista", url });
                  else void navigator.clipboard.writeText(url);
                }} aria-label="Share Gist"><Share2 size={18} /></button>
                <button type="button" onClick={() => void toggleSave(post)} disabled={busy === post.id + "s"} aria-label="Save Gist">
                  <Bookmark size={18} fill={post.saved ? "currentColor" : "none"} />
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <nav className="bottom-nav">
        <Link className="nav-active" href="/"><Home /><span>Home</span></Link>
        <Link href="/search"><Search /><span>Search</span></Link>
        <Link className="nav-create" href="/create" aria-label="Start a Gist"><Plus /></Link>
        <Link className="notification-nav" href="/notifications"><Bell /><span>Notifications</span>{unreadNotifications > 0 && <span className="notification-badge">{unreadNotifications > 99 ? "99+" : unreadNotifications}</span>}</Link>
        <Link href="/profile"><User /><span>Profile</span></Link>
      </nav>
    </main>
  );
}
