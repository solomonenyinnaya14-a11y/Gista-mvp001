"use client";

import { useEffect, useMemo, useState } from "react";
import { Search as SearchIcon, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

const categories = ["Music", "Movies / Entertainment", "Art", "Banter", "Fun", "Gossip", "Sports", "Relationships", "Business", "Technology", "Education", "Lifestyle", "Society", "News & Current Events", "Opinions", "Stories"];

type Person = { id: string; username: string | null; display_name: string | null; bio: string | null; avatar_url: string | null };
type Gist = { id: string; body: string | null; content_type: string; media_url: string | null; category: string; created_at: string; profiles: Person | null };

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

      // Explicitly name the posts -> profiles foreign key. This avoids PostgREST
      // relationship ambiguity when the schema cache contains multiple paths.
      const { data, error: gistsError } = await supabase
        .from("posts")
        .select("id,body,content_type,media_url,category,created_at,profiles!posts_author_id_fkey(display_name,username,avatar_url,bio,id)")
        .or(`body.ilike.${pattern},category.ilike.${pattern}`)
        .order("created_at", { ascending: false })
        .limit(30);

      if (cancelled) return;
      if (gistsError) {
        setError(gistsError.message);
        setGists([]);
      } else {
        setGists((data ?? []) as Gist[]);
      }
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

      <div className="feed-tabs">
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
            <Link className="post" key={post.id} href={`/gist/${post.id}`}>
              <div className="post-head">
                <div className="avatar">
                  {post.profiles?.avatar_url ? <img src={post.profiles.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }} /> : (post.profiles?.display_name?.[0]?.toUpperCase() ?? "G")}
                </div>
                <div className="identity"><strong>{post.profiles?.display_name ?? "Gista User"}</strong><span>@{post.profiles?.username ?? "user"} · {new Date(post.created_at).toLocaleString()}</span></div>
                <span className="category">{post.category}</span>
              </div>
              {post.content_type === "photo" && post.media_url && <img src={post.media_url} alt="Gist" loading="lazy" decoding="async" style={{ width: "100%", borderRadius: 16 }} />}
              {post.content_type === "voice" && post.media_url && <audio controls src={post.media_url} />}
              {post.body && <p className="post-text">{post.body}</p>}
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
