import Link from "next/link";

const items=[
["How to use Gista","/how-to-use","Learn the basic Gista flow and what each action means."],
["Account & profile","/profile","Edit your profile, profile photo and account information."],
["Safety","/settings/blocked","Block users, report Gists and use Not Interested."],
["Password & security","/auth/forgot-password","Reset your password and manage account access."],
];

export default function HelpPage() {
  return <main className="content">
    <header className="simple-header"><Link href="/settings">‹ Settings</Link><strong>Help Center</strong><span /></header>
    <section className="create-card"><h2>How can we help?</h2><p>Find quick answers for using Gista.</p></section>
    <section className="feed">{items.map(([title,href,description])=><Link className="post" href={href} key={href}><strong>{title}</strong><p>{description}</p><span>Open →</span></Link>)}</section>
  </main>;
}