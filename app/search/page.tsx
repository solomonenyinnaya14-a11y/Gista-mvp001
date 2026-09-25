"use client";

import { useEffect, useMemo, useState } from "react";
import { Search as SearchIcon, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import VoiceNote from "@/components/VoiceNote";

const categories = ["Music", "Movies / Entertainment", "Art", "Banter", "Fun", "Gossip", "Sports", "Relationships", "Business", "Technology", "Education", "Lifestyle", "Society", "News & Current Events", "Opinions", "Stories"];

type Person = { id: string; username: string | null; display_name: string | null; bio: string | null; avatar_url: string | null };
type Gist = { id: string; body: string | null; content_type: string; media_url: string | null; category: string; created_at: string; author_id: string; voice_duration_seconds: number | null; profile: Person | null };

export default function SearchPage() {
  const supabase = useMemo(() => createClient(), []);
  const [q, setQ] = useState("");
  const [tab, setTab] = useState("Gists");
  const [gists, setGists] = useState<Gist[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      const term = q.trim();
      setError("");

      if (!term || tab === "Categories") {
        if (!cancelled) {
          setGists([]);
          setPeople([]);
          setLoading(false);
        }
        return;
      }

      setLoading(true);
      const pattern = `%${term}%`;

      if (tab === "People") {
        const { data, error: peopleError } = await supabase
          .from("profiles")
          .select("id,username,display_name,bio,avatar_url")
          .or(`username.ilike.${pattern},display_name.ilike.${pattern}`)
          .limit(20);

        if (cancelled) return;
        if (peopleError) {
          setError(peopleError.message);
          setPeople([]);
        } else {
          setPeople((data ?? []) as Person[]);
        }
        setLoading(false);
        return;
      }

      // Search posts without embedding profiles. The previous embedded query could
      // fail with PostgREST's ambiguous relationship error after schema changes.
      const { data: postData, error: gistsError } = await supabase
        .from("posts")
        .select("id,body,content_type,media_url,category,created_at,author_id,voice_duration_seconds")
        .or(`body.ilike.${pattern},category.ilike.${pattern}`)
        .order("created_at", { ascending: false })
        .limit(30);

      if (cancelled) return;
      if (gistsError) {
        setError(gistsError.message);
        setGists([]);
        setLoading(false);
        return;
      }

      const posts = postData ?? [];
      const authorIds = [...new Set(posts.map((post) => post.author_id))];
      const { data: profileData, error: profilesError } = authorIds.length
        ? await supabase.from("profiles").select("id,username,display_name,bio,avatar_url").in("id", authorIds)
        : { data: [], error: null };

      if (cancelled) return;
      if (profilesError) {
        setError(profilesError.message);
        setGists([]);
        setLoading(false);
        return;
      }

      const profilesById = new Map((profileData ?? []).map((profile) => [profile.id, profile as Person]));
      setGists(posts.map((post) => ({ ...post, profile: profilesById.get(post.author_id) ?? null })) as Gist[]);
      setLoading(false);
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [q, tab, supabase]);

  function chooseCategory(category: string) {
    setQ(category);
    setTab("Gists");
  }

  const matchingCategories = categories.filter((item) => !q || item.toLowerCase().includes(q.toLowerCase()));

  return (
    <main className="content">
      <header className="simple-header">
        <Link href="/"><ArrowLeft size={18} /></Link>
        <strong>Search</strong>
        <span />
      </header>

      <div className="search-box">
        <SearchIcon size={18} />
        <input autoFocus value={q} onChange={(event) => setQ(event.target.value)} placeholder="Search Gists, people, categories…" />
      </div>

      <div className="feed-tabs search-tabs">
        {["Gists", "People", "Categories"].map((item) => (
          <button type="button" key={item} className={tab === item ? "tab active" : "tab"} onClick={() => setTab(item)}>{item}</button>
        ))}
      </div>

      {error ? (
        <div className="search-empty">
          <p>{error}</p>
          <button className="primary small" type="button" onClick={() => setQ((value) => value + " ")}>Try again</button>
        </div>
      ) : loading ? (
        <p className="search-empty">Searching…</p>
      ) : tab === "People" ? (
        <div className="feed">
          {people.length === 0 ? (
            <div className="search-empty">Search for a person by name or username.</div>
          ) : people.map((person) => (
            <Link className="post" key={person.id} href={`/profile/${person.username}`}>
              <div className="post-head">
                <div className="avatar">
                  {person.avatar_url ? <img src={person.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }} /> : (person.display_name?.[0]?.toUpperCase() ?? "G")}
                </div>
                <div className="identity"><strong>{person.display_name}</strong><span>@{person.username}</span></div>
              </div>
              {person.bio && <p className="bio">{person.bio}</p>}
            </Link>
          ))}
        </div>
      ) : tab === "Categories" ? (
        <div className="category-grid">
          {matchingCategories.map((item) => <button type="button" key={item} onClick={() => chooseCategory(item)}>{item}</button>)}
          {matchingCategories.length === 0 && <div className="search-empty">No matching categories.</div>}
        </div>
      ) : (
        <div className="feed">
          {gists.length === 0 ? (
            <div className="search-empty">{q ? "No Gists found for this search." : "Search for Gists, people or categories above."}</div>
          ) : gists.map((post) => (
            <article className="post" key={post.id}>
              <div className="post-head">
                <Link href={post.profile?.username ? `/profile/${post.profile.username}` : "/profile"} className="avatar" aria-label="Open profile">
                  {post.profile?.avatar_url ? <img src={post.profile.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }} /> : (post.profile?.display_name?.[0]?.toUpperCase() ?? "G")}
                </Link>
                <div className="identity"><Link href={post.profile?.username ? `/profile/${post.profile.username}` : "/profile"}><strong>{post.profile?.display_name ?? "Gista User"}</strong></Link><span>@{post.profile?.username ?? "user"} · {new Date(post.created_at).toLocaleString()}</span></div>
                <span className="category">{post.category}</span>
              </div>
              {post.content_type === "photo" && post.media_url && <Link href={`/gist/${post.id}`}><img src={post.media_url} alt="Gist" loading="lazy" decoding="async" style={{ width: "100%", borderRadius: 16 }} /></Link>}
              {post.content_type === "voice" && post.media_url && <VoiceNote src={post.media_url} durationHint={post.voice_duration_seconds} />}
              {post.body && <Link href={`/gist/${post.id}`} className="post-text" style={{ display: "block", color: "#17151c", textDecoration: "none" }}>{post.body}</Link>}
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
