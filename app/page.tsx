"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  Bookmark,
  Heart,
  Home,
  MessageCircle,
  Plus,
  Search,
  Settings,
  Share2,
  User,
} from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import VoiceNote from "@/components/VoiceNote";

type Profile = {
  id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
};

type FeedRow = {
  id: string;
  body: string | null;
  content_type: string;
  media_url: string | null;
  category: string;
  status: string | null;
  created_at: string;
  author_id: string;
  voice_duration_seconds: number | null;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  likes: number | string;
  responses: number | string;
  shares: number | string;
  saves: number | string;
  liked: boolean;
  saved: boolean;
};

type Post = {
  id: string;
  body: string | null;
  content_type: string;
  media_url: string | null;
  category: string;
  status: string | null;
  created_at: string;
  author_id: string;
  voice_duration_seconds: number | null;
  profiles: Profile | null;
  likes: number;
  responses: number;
  shares: number;
  saves: number;
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
  const [feedError, setFeedError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const initialLoadDone = useRef(false);

  const loadNotifications = useCallback(
    async (currentUser: { id: string } | null) => {
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
    },
    [supabase]
  );

  const loadProfile = useCallback(
    async (currentUser: { id: string } | null) => {
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
    },
    [supabase]
  );

  const loadPosts = useCallback(
    async (currentUser: { id: string } | null) => {
      setLoading(!initialLoadDone.current);
      setFeedError("");

      if (!currentUser) {
        setPosts([]);
        setLoading(false);
        initialLoadDone.current = true;
        return;
      }

      const { data, error } = await supabase.rpc("get_fast_home_feed", {
        p_tab: tab,
        p_limit: tab === "Following" ? 20 : 12,
        p_offset: 0,
      });

      if (error) {
        setFeedError(error.message);
        setLoading(false);
        return;
      }

      const rows = (data ?? []) as FeedRow[];
      const mapped: Post[] = rows.map((row) => {
        const likes = Number(row.likes) || 0;
        const responses = Number(row.responses) || 0;
        const shares = Number(row.shares) || 0;
        const saves = Number(row.saves) || 0;
        const engaged = likes > 0 || responses > 0 || shares > 0 || saves > 0;

        return {
          id: row.id,
          body: row.body,
          content_type: row.content_type,
          media_url: row.media_url,
          category: row.category,
          status: engaged ? row.status ?? "growing" : null,
          created_at: row.created_at,
          author_id: row.author_id,
          voice_duration_seconds: row.voice_duration_seconds,
          profiles: {
            id: row.author_id,
            display_name: row.display_name,
            username: row.username,
            avatar_url: row.avatar_url,
          },
          likes,
          responses,
          shares,
          saves,
          liked: Boolean(row.liked),
          saved: Boolean(row.saved),
        };
      });

      setPosts(mapped);
      setLoading(false);
      setFeedError("");
      initialLoadDone.current = true;
    },
    [supabase, tab]
  );

  useEffect(() => {
    let active = true;
    let notificationChannel: ReturnType<typeof supabase.channel> | null = null;

    const initialize = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!active) return;

      const currentUser = sessionData.session?.user
        ? {
            id: sessionData.session.user.id,
            email: sessionData.session.user.email,
          }
        : null;

      setUser(currentUser);
      void Promise.all([
        loadPosts(currentUser),
        loadProfile(currentUser),
        loadNotifications(currentUser),
      ]);

      if (currentUser) {
        notificationChannel = supabase
          .channel("home-notifications-" + currentUser.id)
          .on(
            "postgres_changes",
            {
              event: "INSERT",
              schema: "public",
              table: "notifications",
              filter: "recipient_id=eq." + currentUser.id,
            },
            () => void loadNotifications(currentUser)
          )
          .on(
            "postgres_changes",
            {
              event: "UPDATE",
              schema: "public",
              table: "notifications",
              filter: "recipient_id=eq." + currentUser.id,
            },
            () => void loadNotifications(currentUser)
          )
          .subscribe();
      }
    };

    void initialize();

    const { data: authSubscription } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event !== "SIGNED_IN" && event !== "SIGNED_OUT") return;

        const currentUser = session?.user
          ? { id: session.user.id, email: session.user.email }
          : null;

        setUser(currentUser);
        initialLoadDone.current = false;
        void Promise.all([
          loadPosts(currentUser),
          loadProfile(currentUser),
          loadNotifications(currentUser),
        ]);
      }
    );

    return () => {
      active = false;
      authSubscription.subscription.unsubscribe();
      if (notificationChannel) void supabase.removeChannel(notificationChannel);
    };
  }, [loadNotifications, loadPosts, loadProfile, supabase]);

  async function toggleLike(post: Post) {
    if (!user) {
      router.push("/auth");
      return;
    }
    if (busy === post.id + "l") return;

    setBusy(post.id + "l");
    const wasLiked = post.liked;
    const nextLiked = !wasLiked;

    setPosts((current) =>
      current.map((item) =>
        item.id === post.id
          ? {
              ...item,
              liked: nextLiked,
              likes: Math.max(0, item.likes + (nextLiked ? 1 : -1)),
              status:
                nextLiked ||
                item.responses > 0 ||
                item.shares > 0 ||
                item.saves > 0
                  ? item.status ?? "growing"
                  : null,
            }
          : item
      )
    );

    try {
      const result = wasLiked
        ? await supabase
            .from("likes")
            .delete()
            .eq("post_id", post.id)
            .eq("user_id", user.id)
        : await supabase.from("likes").insert({ post_id: post.id, user_id: user.id });

      if (result.error && result.error.code !== "23505") throw result.error;
    } catch {
      setPosts((current) =>
        current.map((item) =>
          item.id === post.id
            ? { ...item, liked: wasLiked, likes: post.likes, status: post.status }
            : item
        )
      );
    } finally {
      setBusy(null);
    }
  }

  async function toggleSave(post: Post) {
    if (!user) {
      router.push("/auth");
      return;
    }

    setBusy(post.id + "s");
    const result = post.saved
      ? await supabase
          .from("saves")
          .delete()
          .eq("post_id", post.id)
          .eq("user_id", user.id)
      : await supabase.from("saves").insert({ post_id: post.id, user_id: user.id });

    if (!result.error) {
      setPosts((current) =>
        current.map((item) =>
          item.id === post.id
            ? {
                ...item,
                saved: !item.saved,
                saves: Math.max(0, item.saves + (item.saved ? -1 : 1)),
                status:
                  item.saved &&
                  item.likes === 0 &&
                  item.responses === 0 &&
                  item.shares === 0 &&
                  item.saves <= 1
                    ? null
                    : item.status ?? "growing",
              }
            : item
        )
      );
    }

    setBusy(null);
  }

  async function sharePost(post: Post) {
    if (!user) {
      router.push("/auth");
      return;
    }

    const url = window.location.origin + "/gist/" + post.id;
    try {
      if (navigator.share) {
        await navigator.share({
          title: "Gista",
          text: post.body ?? "Join this Gist on Gista",
          url,
        });
      } else {
        await navigator.clipboard.writeText(url);
      }

      const result = await supabase
        .from("shares")
        .insert({ post_id: post.id, user_id: user.id });

      if (!result.error) {
        setPosts((current) =>
          current.map((item) =>
            item.id === post.id
              ? { ...item, shares: item.shares + 1, status: item.status ?? "growing" }
              : item
          )
        );
      }
    } catch {
      // User cancelled the native share sheet.
    }
  }

  const displayName =
    profile?.display_name ?? user?.email?.split("@")[0] ?? "Gista User";
  const initials = displayName.trim().charAt(0).toUpperCase() || "G";

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-icon">G</div>
          <span>Gista</span>
        </div>
        <Link className="icon-btn" aria-label="Settings" href="/settings">
          <Settings size={20} />
        </Link>
      </header>

      <section className="content">
        <div className="feed-tabs">
          {["Discover", "Following", "Trending"].map((item) => (
            <button
              key={item}
              className={tab === item ? "tab active" : "tab"}
              onClick={() => setTab(item)}
            >
              {item}
            </button>
          ))}
        </div>

        <div className="composer">
          <Link href="/profile" className="avatar" aria-label="Open your profile">
            {profile?.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt=""
                style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }}
              />
            ) : (
              initials
            )}
          </Link>
          <Link className="composer-input" href="/create">
            What&apos;s on your mind, {displayName.split(" ")[0]}?
          </Link>
          <Link className="create-btn" aria-label="Start a Gist" href="/create">
            <Plus size={19} />
          </Link>
        </div>

        <div className="feed">
          {loading ? (
            <div className="feed-skeleton" aria-label="Loading Gists">
              <div className="skeleton-post" />
              <div className="skeleton-post" />
            </div>
          ) : feedError && posts.length === 0 ? (
            <div className="empty-state">
              <h3>We couldn&apos;t load the Gists</h3>
              <p>{feedError}</p>
              <button className="primary small" onClick={() => void loadPosts(user)}>
                Try again
              </button>
            </div>
          ) : posts.length === 0 ? (
            <div className="empty-state">
              <h3>No Gists yet</h3>
              <p>
                {tab === "Following"
                  ? "Follow people to see their Gists here."
                  : "Be the first person to start a Gist."}
              </p>
            </div>
          ) : (
            posts.map((post, index) => (
              <article className="post" key={post.id}>
                <div className="post-head">
                  <Link
                    href={post.profiles?.username ? "/profile/" + post.profiles.username : "/profile"}
                    className="avatar"
                    aria-label={"Open " + (post.profiles?.display_name ?? "Gista User") + " profile"}
                  >
                    {post.profiles?.avatar_url ? (
                      <img
                        src={post.profiles.avatar_url}
                        alt=""
                        loading="lazy"
                        style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }}
                      />
                    ) : (
                      post.profiles?.display_name?.charAt(0).toUpperCase() ?? "G"
                    )}
                  </Link>

                  <div className="identity">
                    <Link
                      href={
                        post.profiles?.username
                          ? "/profile/" + post.profiles.username
                          : "/profile"
                      }
                    >
                      <strong>{post.profiles?.display_name ?? "Gista User"}</strong>
                    </Link>
                    <span>
                      @{post.profiles?.username ?? "user"} · {new Date(post.created_at).toLocaleString()}
                    </span>
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

                {post.content_type === "voice" && post.media_url && (
                  <VoiceNote src={post.media_url} durationHint={post.voice_duration_seconds} />
                )}

                {post.body && <p className="post-text">{post.body}</p>}

                {post.status && (
                  <div className="gist-status">
                    <span className={post.status === "trending" ? "hot" : "dot"}>
                      {post.status === "trending" ? "🔥" : "●"}
                    </span>
                    {post.status.charAt(0).toUpperCase() + post.status.slice(1)}
                    <Link href={"/gist/" + post.id}>Gist DNA</Link>
                  </div>
                )}

                <div className="actions">
                  <button
                    type="button"
                    className={post.liked ? "liked" : ""}
                    onClick={() => void toggleLike(post)}
                    disabled={busy === post.id + "l"}
                    aria-label="Like Gist"
                  >
                    <Heart className="action-icon" size={18} fill={post.liked ? "currentColor" : "none"} />
                    <span className="action-count">{post.likes}</span>
                  </button>
                  <Link className="feed-action-link" href={"/gist/" + post.id}>
                    <MessageCircle className="action-icon" size={18} />
                    <span className="action-count">{post.responses}</span>
                  </Link>
                  <button
                    type="button"
                    className="share-action"
                    onClick={() => void sharePost(post)}
                    aria-label="Share Gist"
                  >
                    <Share2 className="action-icon" size={18} />
                    <span className="action-count">{post.shares}</span>
                  </button>
                  <button
                    type="button"
                    className={post.saved ? "saved-action" : ""}
                    onClick={() => void toggleSave(post)}
                    disabled={busy === post.id + "s"}
                    aria-label="Save Gist"
                  >
                    <Bookmark className="action-icon" size={18} fill={post.saved ? "currentColor" : "none"} />
                    <span className="action-count">{post.saves}</span>
                  </button>
                </div>
              </article>
            ))
          )}
        </div>
      </section>

      <nav className="bottom-nav">
        <Link className="nav-active" href="/">
          <Home />
          <span>Home</span>
        </Link>
        <Link href="/search">
          <Search />
          <span>Search</span>
        </Link>
        <Link className="nav-create" href="/create" aria-label="Start a Gist">
          <Plus />
        </Link>
        <Link className="notification-nav" href="/notifications">
          <Bell />
          <span>Notifications</span>
          {unreadNotifications > 0 && (
            <span className="notification-badge">
              {unreadNotifications > 99 ? "99+" : unreadNotifications}
            </span>
          )}
        </Link>
        <Link href="/profile">
          <User />
          <span>Profile</span>
        </Link>
      </nav>
    </main>
  );
}
