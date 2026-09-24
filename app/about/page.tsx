import Link from "next/link";

export default function AboutPage() {
  return <main className="content">
    <header className="simple-header"><Link href="/settings">‹ Settings</Link><strong>About Gista</strong><span /></header>
    <section className="create-card">
      <div className="brand"><div className="brand-icon">G</div><span>Gista</span></div>
      <h1>A place where people come to talk.</h1>
      <p>Gista is a social platform for sharing thoughts, stories, experiences, opinions, emotions, jokes, banter and ideas — then joining the Gist around them.</p>
      <p><strong>Express → Discover → Join the Gist → Talk → Return</strong></p>
      <p>Gista supports text, photo and voice Posts. Video and other advanced features may come later.</p>
      <p>Gista is built around conversation, not popularity.</p>
      <small>Gista MVP</small>
    </section>
  </main>;
}