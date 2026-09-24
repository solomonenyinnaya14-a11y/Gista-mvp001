"use client";

import {useCallback,useEffect,useState} from "react";
import {Bell,Bookmark,Heart,Home,MessageCircle,Plus,Search,Settings,Share2,User} from "lucide-react";
import {createClient} from "@/lib/supabase/client";

type Post={id:string;body:string|null;content_type:string;media_url:string|null;category:string;status:string;created_at:string;author_id:string;profiles:{display_name:string|null;username:string|null;avatar_url:string|null}|null;likes:number;responses:number;liked:boolean;saved:boolean};

export default function HomePage(){
 const [tab,setTab]=useState("Discover");
 const [user,setUser]=useState<any>(null);
 const [posts,setPosts]=useState<Post[]>([]);
 const [loading,setLoading]=useState(true);
 const [busy,setBusy]=useState<string|null>(null);
 const supabase=createClient();

 const loadPosts=useCallback(async(currentUser:any)=>{
  setLoading(true);
  let query=supabase.from("posts").select("id,body,content_type,media_url,category,status,created_at,author_id,profiles(display_name,username,avatar_url)");
  if(currentUser){
   const [{data:blocked},{data:notInterested}]=await Promise.all([
    supabase.from("blocks").select("blocked_id").eq("blocker_id",currentUser.id),
    supabase.from("not_interested").select("post_id").eq("user_id",currentUser.id)
   ]);
   const blockedIds=(blocked??[]).map((x:any)=>x.blocked_id);
   const hiddenPostIds=(notInterested??[]).map((x:any)=>x.post_id);
   if(blockedIds.length) query=query.not("author_id","in",`(${blockedIds.join(",")})`);
   if(hiddenPostIds.length) query=query.not("id","in",`(${hiddenPostIds.join(",")})`);
  }
  if(tab==="Trending") query=query.eq("status","trending");
  if(tab==="Following"){
   if(!currentUser){setPosts([]);setLoading(false);return;}
   const {data:f,error:followsError}=await supabase.from("follows").select("following_id").eq("follower_id",currentUser.id);
   if(followsError){setPosts([]);setLoading(false);return;}
   const ids=(f??[]).map((x:any)=>x.following_id);
   if(ids.length===0){setPosts([]);setLoading(false);return;}
   query=query.in("author_id",ids);
  }
  const {data,error}=await query.order("created_at",{ascending:false}).limit(50);
  if(error||!data){setPosts([]);setLoading(false);return;}
  const postIds=data.map((p:any)=>p.id);
  if(postIds.length===0){setPosts([]);setLoading(false);return;}
  const [likes,responses,saves]=await Promise.all([
   supabase.from("likes").select("post_id,user_id").in("post_id",postIds),
   supabase.from("responses").select("post_id").in("post_id",postIds),
   currentUser?supabase.from("saves").select("post_id,user_id").eq("user_id",currentUser.id).in("post_id",postIds):Promise.resolve({data:[]})
  ]);
  const lc=Object.fromEntries(postIds.map(id=>[id,0]));
  const rc=Object.fromEntries(postIds.map(id=>[id,0]));
  (likes.data??[]).forEach((x:any)=>{lc[x.post_id]++;});
  (responses.data??[]).forEach((x:any)=>{rc[x.post_id]++;});
  const liked=new Set((likes.data??[]).filter((x:any)=>x.user_id===currentUser?.id).map((x:any)=>x.post_id));
  const saved=new Set((saves.data??[]).map((x:any)=>x.post_id));
  setPosts((data as any[]).map(p=>({...p,likes:lc[p.id],responses:rc[p.id],liked:liked.has(p.id),saved:saved.has(p.id)})));
  setLoading(false);
 },[supabase,tab]);

 useEffect(()=>{
  let active=true;
  supabase.auth.getUser().then(({data})=>{if(active)setUser(data.user); return data.user;}).then(currentUser=>{if(active)loadPosts(currentUser);});
  const {data}=supabase.auth.onAuthStateChange((_e,s)=>{setUser(s?.user??null);loadPosts(s?.user??null);});
  return()=>{active=false;data.subscription.unsubscribe();};
 },[loadPosts,supabase]);

 async function toggleLike(p:Post){
  if(!user){location.href="/auth";return;}
  setBusy(p.id+"l");
  const result=p.liked?await supabase.from("likes").delete().eq("post_id",p.id).eq("user_id",user.id):await supabase.from("likes").insert({post_id:p.id,user_id:user.id});
  if(!result.error)setPosts(x=>x.map(q=>q.id===p.id?{...q,liked:!q.liked,likes:q.likes+(q.liked?-1:1)}:q));
  setBusy(null);
 }
 async function toggleSave(p:Post){
  if(!user){location.href="/auth";return;}
  setBusy(p.id+"s");
  const result=p.saved?await supabase.from("saves").delete().eq("post_id",p.id).eq("user_id",user.id):await supabase.from("saves").insert({post_id:p.id,user_id:user.id});
  if(!result.error)setPosts(x=>x.map(q=>q.id===p.id?{...q,saved:!q.saved}:q));
  setBusy(null);
 }
 return <main className="app-shell"><header className="topbar"><div className="brand"><div className="brand-icon">G</div><span>Gista</span></div><button className="icon-btn" aria-label="Settings" onClick={()=>location.href="/settings"}><Settings size={20}/></button></header>
 <section className="content"><div className="feed-tabs">{["Discover","Following","Trending"].map(x=><button key={x} className={tab===x?"tab active":"tab"} onClick={()=>setTab(x)}>{x}</button>)}</div>
 <div className="composer"><div className="avatar">{user?.email?.[0]?.toUpperCase()??"G"}</div><button className="composer-input" onClick={()=>location.href="/create"}>What’s on your mind?</button><button className="create-btn" onClick={()=>location.href="/create"}><Plus size={19}/></button></div>
 <div className="feed">{loading?<p>Loading Gists…</p>:posts.length===0?<div className="empty-state"><h3>No Gists yet</h3><p>{tab==="Following"?"Follow people to see their Gists here.":"Be the first person to start a Gist."}</p></div>:posts.map(p=><article className="post" key={p.id}><div className="post-head"><div className="avatar">{p.profiles?.display_name?.[0]?.toUpperCase()??"G"}</div><div className="identity"><strong>{p.profiles?.display_name??"Gista User"}</strong><span>@{p.profiles?.username??"user"} · {new Date(p.created_at).toLocaleString()}</span></div><span className="category">{p.category}</span></div>{p.content_type==="photo"&&p.media_url&&<img src={p.media_url} alt="Gist photo" style={{width:"100%",borderRadius:16,marginTop:10}}/>}{p.content_type==="voice"&&p.media_url&&<audio controls src={p.media_url} style={{width:"100%",marginTop:10}} />}{p.body&&<p className="post-text">{p.body}</p>}<div className="gist-status"><span className={p.status==="trending"?"hot":"dot"}>{p.status==="trending"?"🔥":"●"}</span>{p.status.charAt(0).toUpperCase()+p.status.slice(1)}<button onClick={()=>location.href="/gist/"+p.id}>Gist DNA</button></div><div className="actions"><button onClick={()=>toggleLike(p)} disabled={busy===p.id+"l"}><Heart size={18} fill={p.liked?"currentColor":"none"}/> {p.likes}</button><button onClick={()=>location.href="/gist/"+p.id}><MessageCircle size={18}/> {p.responses}</button><button onClick={()=>{const url=location.origin+"/gist/"+p.id;if(navigator.share)navigator.share({title:"Gista",text:p.body??"Join this Gist on Gista",url});else navigator.clipboard.writeText(url)}}><Share2 size={18}/></button><button onClick={()=>toggleSave(p)} disabled={busy===p.id+"s"}><Bookmark size={18} fill={p.saved?"currentColor":"none"}/></button></div></article>)}</div>
 </section><nav className="bottom-nav"><button className="nav-active"><Home/><span>Home</span></button><button onClick={()=>location.href="/search"}><Search/><span>Search</span></button><button className="nav-create" onClick={()=>location.href="/create"}><Plus/></button><button onClick={()=>location.href="/notifications"}><Bell/><span>Notifications</span></button><button onClick={()=>location.href="/profile"}><User/><span>Profile</span></button></nav></main>;
}
