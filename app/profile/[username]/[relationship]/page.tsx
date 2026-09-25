"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import styles from "./relationship.module.css";

type Person = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
};

type Profile = {
  id: string;
  username: string;
  display_name: string | null;
  is_private: boolean;
  following_private: boolean;
};

export default function RelationshipPage() {
  const { username, relationship } = useParams<{ username: string; relationship: string }>();
  const supabase = useMemo(() => createClient(), []);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [people, setPeople] = useState<Person[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [privateList, setPrivateList] = useState(false);

  const kind = relationship === "following" ? "following" : "followers";
  const title = kind === "following" ? "Following" : "Followers";

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const { data: userData } = await supabase.auth.getUser();
      const { data: target, error: profileError } = await supabase
        .from("profiles")
        .select("id,username,display_name,is_private,following_private")
        .eq("username", username)
        .single();

      if (cancelled) return;
      if (profileError || !target) {
        setProfile(null);
        setLoading(false);
        return;
      }

      const { data: statsData } = await supabase.rpc("get_profile_stats", { target_profile_id: target.id });
      const stats = statsData?.[0] as { followers?: number; following?: number } | undefined;
      const targetCount = kind === "following" ? Number(stats?.following ?? 0) : Number(stats?.followers ?? 0);
      setProfile(target as Profile);
      setCount(targetCount);

      const isOwner = userData.user?.id === target.id;
      if (kind === "following" && target.following_private && !isOwner) {
        setPeople([]);
        setPrivateList(true);
        setLoading(false);
        return;
      }

      const rpcName = kind === "following" ? "get_profile_following" : "get_profile_followers";
      const { data, error } = await supabase.rpc(rpcName, { target_profile_id: target.id });
      if (cancelled) return;
      setPeople((data ?? []) as Person[]);
      setPrivateList(Boolean(error) || (target.is_private && !isOwner && !(data ?? []).length && targetCount > 0));
      setLoading(false);
    }
    void load();
    return () => { cancelled = true; };
  }, [supabase, username, kind]);

  if (loading) return <main className="content"><p>Loading {title.toLowerCase()}…</p></main>;
  if (!profile) return <main className="content"><p>Profile not found.</p></main>;

  return (
    <main className="profile-page">
      <header className="simple-header">
        <Link href={"/profile/" + profile.username}>‹ Profile</Link>
        <strong>{title}</strong>
        <span />
      </header>

      <section className={styles.page}>
        <div className={styles.heading}>
          <h1>{title}</h1>
          <span>{count}</span>
        </div>

        {privateList ? (
          <div className={styles.empty}>
            <h3>{kind === "following" ? "Following is private" : "This list is private"}</h3>
            <p>{kind === "following" ? "This user has chosen to keep the people they follow private." : "Follow this account to see its followers."}</p>
          </div>
        ) : people.length === 0 ? (
          <div className={styles.empty}>
            <h3>No {title.toLowerCase()} yet</h3>
            <p>There is nobody to show here yet.</p>
          </div>
        ) : (
          <div className={styles.list}>
            {people.map((person) => (
              <Link className={styles.person} href={"/profile/" + (person.username ?? "")} key={person.id}>
                <div className={styles.avatar}>
                  {person.avatar_url ? <img src={person.avatar_url} alt="" /> : (person.display_name?.[0]?.toUpperCase() ?? "G")}
                </div>
                <div>
                  <strong>{person.display_name ?? "Gista User"}</strong>
                  <span>@{person.username ?? "username"}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
