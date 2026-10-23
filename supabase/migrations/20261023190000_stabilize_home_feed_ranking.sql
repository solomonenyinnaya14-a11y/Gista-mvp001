-- Keep feed ranking deterministic between requests.
-- The previous live function added random() to every post score, which meant
-- any refetch could reshuffle the Home feed even when the underlying posts had
-- not changed. A deliberate refresh can still reflect changed engagement,
-- but repeated requests no longer inject random ordering.
CREATE OR REPLACE FUNCTION public.get_fast_home_feed(p_tab text DEFAULT 'Discover'::text, p_limit integer DEFAULT 12, p_offset integer DEFAULT 0)
RETURNS TABLE(id uuid, body text, content_type text, media_url text, category text, status text, created_at timestamptz, author_id uuid, voice_duration_seconds integer, display_name text, username text, avatar_url text, likes bigint, responses bigint, shares bigint, saves bigint, liked boolean, saved boolean)
LANGUAGE sql
SET search_path TO 'public'
AS $function$
WITH me AS (SELECT (SELECT auth.uid()) AS user_id),
candidate_posts AS (
 SELECT p.* FROM public.posts p CROSS JOIN me
 WHERE me.user_id IS NOT NULL
 AND NOT EXISTS (SELECT 1 FROM public.blocks b WHERE b.blocker_id=me.user_id AND b.blocked_id=p.author_id)
 AND NOT EXISTS (SELECT 1 FROM public.not_interested ni WHERE ni.user_id=me.user_id AND ni.post_id=p.id)
 AND (p_tab <> 'Following' OR EXISTS (SELECT 1 FROM public.follows f WHERE f.follower_id=me.user_id AND f.following_id=p.author_id))
 AND (p_tab <> 'Trending' OR p.status='trending')
),
engagement AS (
 SELECT cp.*, COALESCE(lc.count,0)::bigint AS likes, COALESCE(rc.count,0)::bigint AS responses,
 COALESCE(pec.share_count,0)::bigint AS shares, COALESCE(pec.save_count,0)::bigint AS saves
 FROM candidate_posts cp
 LEFT JOIN (SELECT l.post_id,count(*)::bigint AS count FROM public.likes l JOIN candidate_posts c ON c.id=l.post_id GROUP BY l.post_id) lc ON lc.post_id=cp.id
 LEFT JOIN (SELECT r.post_id,count(*)::bigint AS count FROM public.responses r JOIN candidate_posts c ON c.id=r.post_id GROUP BY r.post_id) rc ON rc.post_id=cp.id
 LEFT JOIN public.post_engagement_counts pec ON pec.post_id=cp.id
),
personalized AS (
 SELECT e.*,
 CASE WHEN p_tab='Trending' THEN 0.0 ELSE
 (CASE WHEN EXISTS (SELECT 1 FROM public.follows f WHERE f.follower_id=(SELECT user_id FROM me) AND f.following_id=e.author_id) THEN CASE WHEN p_tab='Following' THEN 18.0 ELSE 22.0 END ELSE 0.0 END)
 +(SELECT least(18.0,coalesce(sum(2.5),0.0)) FROM public.likes l JOIN public.posts lp ON lp.id=l.post_id WHERE l.user_id=(SELECT user_id FROM me) AND e.category IS NOT NULL AND lp.category=e.category)
 +(SELECT least(12.0,coalesce(sum(2.0),0.0)) FROM public.saves s JOIN public.posts sp ON sp.id=s.post_id WHERE s.user_id=(SELECT user_id FROM me) AND e.category IS NOT NULL AND sp.category=e.category)
 +(SELECT least(10.0,coalesce(sum(2.0),0.0)) FROM public.responses r JOIN public.posts rp ON rp.id=r.post_id WHERE r.author_id=(SELECT user_id FROM me) AND e.category IS NOT NULL AND rp.category=e.category)
 END AS personalization_score FROM engagement e
),
ranked AS (
 SELECT p.*,
 (70.0/(1.0+greatest(extract(epoch FROM (now()-p.created_at))/3600.0,0.0)/12.0)
 +8.0*ln(1.0+p.likes)+14.0*ln(1.0+p.responses)+10.0*ln(1.0+p.shares)+12.0*ln(1.0+p.saves)
 +CASE WHEN p.status='trending' THEN 18.0 WHEN p.status='active' THEN 8.0 WHEN p.status='growing' THEN 4.0 ELSE 0.0 END
 +CASE WHEN p_tab='Trending' THEN 0.0 ELSE p.personalization_score END) AS feed_score
 FROM personalized p
)
SELECT r.id,r.body,r.content_type,r.media_url,r.category,r.status,r.created_at,r.author_id,r.voice_duration_seconds,
 pr.display_name,pr.username,pr.avatar_url,r.likes,r.responses,r.shares,r.saves,
 EXISTS(SELECT 1 FROM public.likes ul WHERE ul.post_id=r.id AND ul.user_id=(SELECT user_id FROM me)) AS liked,
 EXISTS(SELECT 1 FROM public.saves us WHERE us.post_id=r.id AND us.user_id=(SELECT user_id FROM me)) AS saved
FROM ranked r LEFT JOIN public.profiles pr ON pr.id=r.author_id
ORDER BY r.feed_score DESC,r.created_at DESC,r.id DESC
LIMIT greatest(1,least(coalesce(p_limit,12),50))
OFFSET greatest(coalesce(p_offset,0),0);
$function$;
