"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bookmark, Heart, MessageCircle, Plus, Settings, Share2 } from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import VoiceNote from "@/components/VoiceNote";
import BottomNav from "@/components/BottomNav";
import LandingPage from "@/components/LandingPage";
import { FEED_CACHE_MAX_AGE_MS, browserStorage, clearFeedCache, readFeedCache, writeFeedCache } from "@/lib/feed-cache";

type Profile={id:string;display_name:string|null;username:string|null;avatar_url:string|null};
type FeedRow={id:string;body:string|null;content_type:string;media_url:string|null;category:string;status:string|null;created_at:string;author_id:string;voice_duration_seconds:number|null;display_name:string|null;username:string|null;avatar_url:string|null;likes:number|string;responses:number|string;shares:number|string;saves:number|string;liked:boolean;saved:boolean};
type Post=FeedRow&{profiles:Profile|null;likes:number;responses:number;shares:number;saves:number};

export default function HomePage(){
  const supabase=useMemo(()=>createClient(),[]),router=useRouter();
  const[tab,setTab]=useState("Discover"),[user,setUser]=useState<{id:string;email?:string|null}|null>(null),[authChecked,setAuthChecked]=useState(false),[profile,setProfile]=useState<Profile|null>(null),[posts,setPosts]=useState<Post[]>([]),[loading,setLoading]=useState(true),[feedError,setFeedError]=useState(""),[busy,setBusy]=useState<string|null>(null);
  const initialLoadDone=useRef(false); const loadedFeedKey=useRef(""); const feedRequestId=useRef(0); const postsRef=useRef<Post[]>([]);
  const feedCacheMaxAge=FEED_CACHE_MAX_AGE_MS;
  const loadProfile=useCallback(async(u:{id:string}|null)=>{if(!u){setProfile(null);return}const{data}=await supabase.from("profiles").select("id,display_name,username,avatar_url").eq("id",u.id).maybeSingle();setProfile(data as Profile|null)},[supabase]);
  const loadPosts=useCallback(async(u:{id:string}|null,force=false)=>{const requestId=++feedRequestId.current;setFeedError("");if(!u){setPosts([]);setLoading(false);initialLoadDone.current=true;return}const cachedPosts=readFeedCache<Post>(browserStorage(),u.id,tab,Date.now(),feedCacheMaxAge);if(cachedPosts&&cachedPosts.length>0){setPosts(cachedPosts);postsRef.current=cachedPosts;setLoading(false);initialLoadDone.current=true;loadedFeedKey.current=`${u.id}:${tab}`;if(!force)return}else{setLoading(true)}const loadFeed=async()=>supabase.rpc("get_fast_home_feed",{p_tab:tab,p_limit:tab==="Following"?20:12,p_offset:0});let{data,error}=await loadFeed();if(error&&/jwt|token|session|issued at future/i.test(error.message)){const refresh=await supabase.auth.refreshSession();if(!refresh.error)({data,error}=await loadFeed())}if(requestId!==feedRequestId.current)return;if(error){setFeedError(/jwt|token|session|issued at future/i.test(error.message)?"Your session needs to be refreshed. Please try again.":error.message);setLoading(false);return}if((data??[]).length===0){const refreshed=await supabase.auth.refreshSession();if(!refreshed.error&&refreshed.data.session?.user?.id===u.id){const recovered=await loadFeed();if(!recovered.error&&(recovered.data??[]).length>0){data=recovered.data;error=null}}for(let attempt=0;attempt<2&&(data??[]).length===0;attempt++){await new Promise(resolve=>window.setTimeout(resolve,350));if(requestId!==feedRequestId.current)return;const retry=await loadFeed();if(!retry.error&&(retry.data??[]).length>0){data=retry.data;error=null;break}if(retry.error){error=retry.error;break}}if(error){setFeedError(error.message);setLoading(false);return}if((data??[]).length===0&&(postsRef.current.length>0||(cachedPosts?.length??0)>0)){setLoading(false);return}}const nextPosts=((data??[])as FeedRow[]).map(r=>({...r,profiles:{id:r.author_id,display_name:r.display_name,username:r.username,avatar_url:r.avatar_url},likes:Number(r.likes)||0,responses:Number(r.responses)||0,shares:Number(r.shares)||0,saves:Number(r.saves)||0}));setPosts(nextPosts);postsRef.current=nextPosts;if(nextPosts.length>0)cacheCurrentPosts(nextPosts,u.id);else if(!readFeedCache<Post>(browserStorage(),u.id,tab,Date.now(),feedCacheMaxAge))cacheCurrentPosts(nextPosts,u.id);setLoading(false);initialLoadDone.current=true;loadedFeedKey.current=`${u.id}:${tab}`},[supabase,tab]);
  useEffect(()=>{postsRef.current=posts},[posts]);
  useEffect(()=>{let active=true;const init=async()=>{const{data}=await supabase.auth.getSession();if(!active)return;const u=data.session?.user?{id:data.session.user.id,email:data.session.user.email}:null;setUser(u);setAuthChecked(true);initialLoadDone.current=false;if(u)loadedFeedKey.current=`${u.id}:${tab}`;const navigationType=performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming|undefined;const legacyNavigationType=(performance as Performance & {navigation?:{type?:number}}).navigation?.type;const isReload=navigationType?.type==="reload"||legacyNavigationType===1;void loadPosts(u,isReload);void loadProfile(u)};void init();const{data:sub}=supabase.auth.onAuthStateChange((event,session)=>{if(event!=="SIGNED_IN"&&event!=="SIGNED_OUT")return;const u=session?.user?{id:session.user.id,email:session.user.email}:null;clearFeedCache(browserStorage(),u?.id);setUser(u);setAuthChecked(true);initialLoadDone.current=false;void Promise.all([loadPosts(u),loadProfile(u)])});return()=>{active=false;sub.subscription.unsubscribe()}},[supabase,loadProfile]);
  useEffect(()=>{if(!user)return;const key=`${user.id}:${tab}`;if(loadedFeedKey.current===key)return;loadedFeedKey.current=key;void loadPosts(user)},[tab,user,loadPosts]);
  // Keep response counts live while the feed is mounted. The cached feed is only a fast
  // first paint; Postgres changes reconcile new/deleted responses without a manual refresh.
  useEffect(()=>{if(!user)return;let refreshTimer:number|undefined;
    const scheduleRefresh=()=>{if(refreshTimer!==undefined)window.clearTimeout(refreshTimer);refreshTimer=window.setTimeout(()=>void loadPosts(user,true),250)};
    const updateResponseCount=(postId:string,delta:number)=>{feedRequestId.current+=1;setPosts(current=>{if(!current.some(post=>post.id===postId))return current;const next=current.map(post=>post.id===postId?{...post,responses:Math.max(0,post.responses+delta)}:post);writeFeedCache(browserStorage(),user.id,tab,next);return next});scheduleRefresh()};
    const channel=supabase.channel("gista-feed-response-counts")
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"responses"},payload=>{const postId=String((payload.new as {post_id?:string}).post_id??"");if(postId)updateResponseCount(postId,1)})
      .on("postgres_changes",{event:"DELETE",schema:"public",table:"responses"},payload=>{const postId=String((payload.old as {post_id?:string}).post_id??"");if(postId)updateResponseCount(postId,-1)})
      .subscribe();
    let wasHidden=document.visibilityState==="hidden";
    let wasFocused=document.hasFocus();
    let lastRefreshAt=0;
    const refresh=()=>{const now=Date.now();if(now-lastRefreshAt<1500)return;lastRefreshAt=now;void loadPosts(user,true)};
    const onBlur=()=>{wasFocused=false};
    const onFocus=()=>{if(!wasFocused){wasFocused=true;refresh()}};
    const onVisibility=()=>{if(document.visibilityState==="visible"&&wasHidden)refresh();wasHidden=document.visibilityState==="hidden"};
    const onPageShow=(event:PageTransitionEvent)=>{if(event.persisted)refresh()};
    window.addEventListener("blur",onBlur);
    window.addEventListener("focus",onFocus);
    window.addEventListener("pageshow",onPageShow);
    document.addEventListener("visibilitychange",onVisibility);
    return()=>{if(refreshTimer!==undefined)window.clearTimeout(refreshTimer);window.removeEventListener("blur",onBlur);window.removeEventListener("focus",onFocus);window.removeEventListener("pageshow",onPageShow);document.removeEventListener("visibilitychange",onVisibility);void supabase.removeChannel(channel)};
  },[user,supabase,tab,loadPosts]);
  useEffect(()=>{if(!user)return;const onProfileMediaUpdated=(event:Event)=>{const detail=(event as CustomEvent<{profile?:{id:string;display_name:string|null;username:string|null;avatar_url:string|null}}>).detail;const next=detail?.profile;if(!next||next.id!==user.id)return;setProfile(next);setPosts(current=>current.map(post=>post.author_id===user.id?{...post,profiles:{id:user.id,avatar_url:next.avatar_url,display_name:next.display_name,username:next.username}}:post));void loadPosts(user,true)};window.addEventListener("gista:profile-media-updated",onProfileMediaUpdated);return()=>window.removeEventListener("gista:profile-media-updated",onProfileMediaUpdated)},[user,loadPosts]);
  function cacheCurrentPosts(next:Post[],userId:string){writeFeedCache(browserStorage(),userId,tab,next)}
  async function toggleLike(p:Post){if(!user){router.push("/auth");return}if(busy===p.id+"l")return;setBusy(p.id+"l");const next=!p.liked;setPosts(x=>{const nextPosts=x.map(i=>i.id===p.id?{...i,liked:next,likes:Math.max(0,i.likes+(next?1:-1))}:i);cacheCurrentPosts(nextPosts,user.id);return nextPosts});const r=next?await supabase.from("likes").insert({post_id:p.id,user_id:user.id}):await supabase.from("likes").delete().eq("post_id",p.id).eq("user_id",user.id);if(r.error)setPosts(x=>{const nextPosts=x.map(i=>i.id===p.id?{...i,liked:p.liked,likes:p.likes}:i);cacheCurrentPosts(nextPosts,user.id);return nextPosts});setBusy(null)}
  async function toggleSave(p:Post){if(!user){router.push("/auth");return}setBusy(p.id+"s");const next=!p.saved;setPosts(x=>{const nextPosts=x.map(i=>i.id===p.id?{...i,saved:next,saves:Math.max(0,i.saves+(next?1:-1))}:i);cacheCurrentPosts(nextPosts,user.id);return nextPosts});const r=next?await supabase.from("saves").insert({post_id:p.id,user_id:user.id}):await supabase.from("saves").delete().eq("post_id",p.id).eq("user_id",user.id);if(r.error)setPosts(x=>{const nextPosts=x.map(i=>i.id===p.id?{...i,saved:!next,saves:Math.max(0,i.saves+(next?-1:1))}:i);cacheCurrentPosts(nextPosts,user.id);return nextPosts});setBusy(null)}
  async function sharePost(p:Post){if(!user){router.push("/auth");return}const url=location.origin+"/post/"+p.id;try{if(navigator.share)await navigator.share({title:"Gista",text:p.body??"Check out this Post on Gista",url});else await navigator.clipboard.writeText(url);const r=await supabase.from("shares").insert({post_id:p.id,user_id:user.id});if(!r.error)setPosts(x=>{const nextPosts=x.map(i=>i.id===p.id?{...i,shares:i.shares+1}:i);cacheCurrentPosts(nextPosts,user.id);return nextPosts})}catch{}}
  const displayName=profile?.display_name??user?.email?.split("@")[0]??"Gista User";
  if (!authChecked) return <main className="app-shell"><section className="content"><div className="feed-skeleton"><div className="skeleton-post"/><div className="skeleton-post"/></div></section></main>;
  if (!user) return <LandingPage />;

  return <main className="app-shell">
    <header className="topbar"><div className="brand"><span className="gista-mark gista-mark-feed" aria-hidden="true"><span>G</span></span><span>Gista</span></div><Link className="icon-btn" aria-label="Settings" href="/settings"><Settings size={20}/></Link></header>
    <section className="content">
      <div className="feed-tabs">{["Discover","Following","Trending"].map(x=><button key={x} className={tab===x?"tab active":"tab"} onClick={()=>setTab(x)}>{x}</button>)}</div>
      <div className="composer"><Link href="/profile" className="avatar">{profile?.avatar_url?<img src={profile.avatar_url} alt="" style={{width:"100%",height:"100%",objectFit:"cover",borderRadius:"50%"}}/>:displayName[0]?.toUpperCase()||"G"}</Link><Link className="composer-input" href="/create">What&apos;s on your mind, {displayName.split(" ")[0]}?</Link><Link className="create-btn" aria-label="Create Post" href="/create"><Plus size={19}/></Link></div>
      <div className="feed">
        {loading&&posts.length===0?<div className="feed-skeleton"><div className="skeleton-post"/><div className="skeleton-post"/></div>:feedError&&posts.length===0?<div className="empty-state"><h3>We couldn&apos;t load the Posts</h3><p>{feedError}</p><button className="primary small" onClick={()=>void loadPosts(user)}>Try again</button></div>:posts.length===0?<div className="empty-state"><h3>{tab==="Trending"?"No Trending Posts yet":"No Posts yet"}</h3><p>{tab==="Following"?"Follow people to see their Posts here.":tab==="Trending"?"When Posts start trending, they will appear here.":"Be the first person to create a Post."}</p></div>:posts.map((p,i)=><article className="profile-gist" key={p.id}>
          <div className="post-head"><Link href={p.profiles?.username?"/profile/"+p.profiles.username:"/profile"} className="avatar">{p.profiles?.avatar_url?<img src={p.profiles.avatar_url} alt="" loading={i<6?"eager":"lazy"} fetchPriority={i<3?"high":"auto"} decoding="async" style={{width:"100%",height:"100%",objectFit:"cover",borderRadius:"50%"}}/>:p.profiles?.display_name?.[0]?.toUpperCase()||"G"}</Link><div className="identity"><Link href={p.profiles?.username?"/profile/"+p.profiles.username:"/profile"}><strong>{p.profiles?.display_name??"Gista User"}</strong></Link><span>@{p.profiles?.username??"user"} · {new Date(p.created_at).toLocaleString()}</span></div><span className="category">{p.category}</span></div>
          <Link className="profile-gist-content" href={"/post/"+p.id}>{p.body&&<p>{p.body}</p>} {p.content_type==="photo"&&p.media_url&&<img src={p.media_url} alt="Post" loading={i===0?"eager":"lazy"}/>}</Link>
          {p.content_type==="voice"&&p.media_url&&<div className="profile-gist-voice"><VoiceNote src={p.media_url} durationHint={p.voice_duration_seconds??0}/></div>}
          <div className="gist-status"><span className="dot">●</span>{p.status?p.status.charAt(0).toUpperCase()+p.status.slice(1):"Growing"}<Link href={"/post/"+p.id+"?dna=1"}>Post DNA</Link></div>
          <div className="actions profile-gist-actions"><button type="button" className={p.liked?"liked":""} onClick={()=>void toggleLike(p)} disabled={busy===p.id+"l"} aria-label="Like Post"><Heart size={18} fill={p.liked?"currentColor":"none"}/> {p.likes}</button><Link className="feed-action-link" href={"/post/"+p.id+"?comments=1"} aria-label="Comments"><MessageCircle size={18}/> {p.responses}</Link><button type="button" onClick={()=>void sharePost(p)} aria-label="Share Post"><Share2 size={18}/> {p.shares}</button><button type="button" className={p.saved?"saved-action":""} onClick={()=>void toggleSave(p)} disabled={busy===p.id+"s"} aria-label={p.saved?"Unsave Post":"Save Post"} title={p.saved?"Unsave post":"Save post"}><Bookmark size={18} fill={p.saved?"currentColor":"none"}/> {p.saves}</button></div>
        </article>)}
      </div>
    </section>
    <BottomNav active="home"/>
  </main>
}
