"use client";

import Link from "next/link";
import {
  ArrowRight,
  Bookmark,
  Heart,
  Image as ImageIcon,
  MessageCircle,
  Mic,
  Play,
  Share2,
} from "lucide-react";

function GistaMark({ small = false }: { small?: boolean }) {
  return (
    <span className={small ? "gista-mark gista-mark-small" : "gista-mark"} aria-hidden="true">
      <span>G</span>
    </span>
  );
}

function MockConversation() {
  return (
    <div className="landing-device-wrap" aria-hidden="true">
      <div className="landing-float landing-float-top">
        <span className="landing-mini-avatar">A</span>
        <span>Real talk! 💯</span>
      </div>

      <div className="landing-device">
        <div className="landing-device-notch" />
        <div className="landing-device-screen">
          <div className="landing-appbar">
            <div className="landing-app-brand">
              <GistaMark small />
              <strong>Gista</strong>
            </div>
            <span className="landing-search-dot" />
          </div>

          <div className="landing-feed-tabs">
            <span className="active">Discover</span>
            <span>Following</span>
            <span>Trending</span>
          </div>

          <div className="landing-post">
            <div className="landing-post-head">
              <span className="landing-avatar landing-avatar-one">T</span>
              <div>
                <strong>Tife</strong>
                <small>@tife · Lifestyle</small>
              </div>
              <span className="landing-more">•••</span>
            </div>

            <p className="landing-post-text">
              What&apos;s one thing that instantly makes your day better?
            </p>

            <div className="landing-post-actions">
              <span className="is-liked"><Heart size={16} fill="currentColor" /> 342</span>
              <span><MessageCircle size={16} /> 128</span>
              <span><Share2 size={16} /> 31</span>
              <span><Bookmark size={16} /></span>
            </div>

            <div className="landing-status">
              <span className="landing-status-dot" />
              Growing
              <span>Post DNA</span>
            </div>
          </div>

          <div className="landing-response">
            <div className="landing-response-head">
              <span className="landing-avatar landing-avatar-two">D</span>
              <strong>David</strong>
              <small>1h ago</small>
            </div>
            <p>Good music and a walk outside always does it for me.</p>
            <div className="landing-response-actions">
              <span className="is-liked"><Heart size={14} fill="currentColor" /> 24</span>
              <span><MessageCircle size={14} /> Reply</span>
            </div>
          </div>

          <div className="landing-voice">
            <button type="button"><Play size={15} fill="currentColor" /></button>
            <div className="landing-wave">
              {Array.from({ length: 26 }).map((_, i) => (
                <i key={i} style={{ height: (9 + ((i * 7) % 16)) + "px" }} />
              ))}
            </div>
            <small>0:38</small>
          </div>

          <div className="landing-post landing-post-last">
            <div className="landing-post-head">
              <span className="landing-avatar landing-avatar-three">K</span>
              <div>
                <strong>Kene</strong>
                <small>@kene · Technology</small>
              </div>
            </div>
            <p className="landing-post-text">What do you think about the future of AI in Africa?</p>
            <div className="landing-photo">
              <div className="landing-city" />
            </div>
          </div>

          <div className="landing-bottom-nav">
            <span className="active">Home</span>
            <span>Search</span>
            <b>+</b>
            <span>Notifications</span>
            <span>Profile</span>
          </div>
        </div>
      </div>

      <div className="landing-float landing-float-right">
        <span className="landing-mini-avatar landing-mini-purple">M</span>
        <span>Love this! 🔥</span>
      </div>

      <div className="landing-float landing-float-bottom">
        <span className="landing-mini-avatar">S</span>
        <span>So true! 👏</span>
      </div>
    </div>
  );
}

export default function LandingPage() {
  return (
    <main className="landing-page">
      <header className="landing-header">
        <Link href="/" className="landing-brand" aria-label="Gista home">
          <GistaMark />
          <span>Gista</span>
        </Link>

        <nav className="landing-header-actions">
          <Link href="/auth?mode=login" className="landing-login">Log In</Link>
          <Link href="/auth?mode=signup" className="landing-signup">Create Account</Link>
        </nav>
      </header>

      <section className="landing-hero">
        <div className="landing-copy">
          <div className="landing-eyebrow">
            <span className="landing-eyebrow-dot" />
            A place for real conversations
          </div>

          <h1>
            Where people <em>talk,</em> <em>share,</em> <em>connect,</em> and <strong>belong.</strong>
          </h1>

          <p className="landing-description">
            Share your thoughts, moments, questions, stories, opinions, photos, and voice.
            Discover what people are talking about and join conversations that interest you.
          </p>

          <p className="landing-tagline">Every Post Starts a Conversation.</p>

          <div className="landing-cta-row">
            <Link href="/auth?mode=signup" className="landing-primary-cta">
              Create Account <ArrowRight size={18} />
            </Link>
            <Link href="/auth?mode=login" className="landing-secondary-cta">Log In</Link>
          </div>

          <div className="landing-formats">
            <div>
              <span><MessageCircle size={20} /></span>
              <strong>Text Posts</strong>
              <small>Share your thoughts</small>
            </div>
            <div>
              <span><ImageIcon size={20} /></span>
              <strong>Photo Posts</strong>
              <small>Show your moments</small>
            </div>
            <div>
              <span><Mic size={20} /></span>
              <strong>Voice Posts</strong>
              <small>Speak your mind</small>
            </div>
          </div>
        </div>

        <MockConversation />
      </section>

      <section className="landing-explainer">
        <div className="landing-explainer-card">
          <GistaMark small />
          <div>
            <strong>Gista is built around conversation.</strong>
            <p>
              Not just posting for attention. Share something, find people who have something
              to say, and join the conversation.
            </p>
          </div>
        </div>
      </section>

      <footer className="landing-footer">
        <span>© 2026 Gista</span>
        <span>Every Post Starts a Conversation.</span>
      </footer>
    </main>
  );
}
