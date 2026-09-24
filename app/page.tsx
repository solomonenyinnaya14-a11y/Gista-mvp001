"use client";
import { Bell, Bookmark, Heart, Home, MessageCircle, Plus, Search, Settings, Share2, User } from "lucide-react";
import { useState } from "react";

const posts=[
 {name:"Amaka",handle:"@amaka",time:"12m",category:"Lifestyle",text:"Adulthood is expensive abeg 😭",likes:342,responses:86,status:"Growing"},
 {name:"David",handle:"@david",time:"28m",category:"Music",text:"This new album is crazy. Which track are you playing on repeat?",likes:218,responses:54,status:"Active"},
 {name:"Chisom",handle:"@chisom",time:"1h",category:"Stories",text:"Today was one of the hardest days I've had. But we move.",likes:491,responses:128,status:"Trending"}
];

export default function HomePage(){
 const [tab,setTab]=useState("Discover");
 return <main className="app-shell">
  <header className="topbar"><div className="brand"><div className="brand-icon">G</div><span>Gista</span></div><button className="icon-btn" aria-label="Settings"><Settings size={20}/></button></header>
  <section className="content">
   <div className="feed-tabs">{["Discover","Following","Trending"].map(x=><button key={x} className={tab===x?"tab active":"tab"} onClick={()=>setTab(x)}>{x}</button>)}</div>
   <div className="composer"><div className="avatar">S</div><button className="composer-input">What’s on your mind?</button><button className="create-btn"><Plus size={19}/></button></div>
   <div className="feed">{posts.map(p=><article className="post" key={p.handle}>
    <div className="post-head"><div className="avatar">{p.name[0]}</div><div className="identity"><strong>{p.name}</strong><span>{p.handle} · {p.time}</span></div><span className="category">{p.category}</span></div>
    <p className="post-text">{p.text}</p>
    <div className="gist-status"><span className={p.status==="Trending"?"hot":"dot"}>{p.status==="Trending"?"🔥":"●"}</span>{p.status}<button>Gist DNA</button></div>
    <div className="actions"><button><Heart size={18}/> {p.likes}</button><button><MessageCircle size={18}/> {p.responses}</button><button><Share2 size={18}/></button><button><Bookmark size={18}/></button></div>
   </article>)}</div>
  </section>
  <nav className="bottom-nav"><button className="nav-active"><Home/><span>Home</span></button><button><Search/><span>Search</span></button><button className="nav-create"><Plus/></button><button><Bell/><span>Notifications</span></button><button><User/><span>Profile</span></button></nav>
 </main>
}