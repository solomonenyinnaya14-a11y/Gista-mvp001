"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

function safeReturnPath(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\\\")) return "/";
  return value;
}

export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [returnTo, setReturnTo] = useState("/");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requestedMode = params.get("mode");
    if (requestedMode === "signup" || requestedMode === "login") setMode(requestedMode);
    setReturnTo(safeReturnPath(params.get("returnTo")));
    const error = params.get("error");
    if (error === "verification_failed") setMessage("Email verification failed or the link has expired. Please request a new verification email.");
    else if (error === "missing_verification_token") setMessage("This verification link is incomplete. Please request a new verification email.");
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    const supabase = createClient();

    if (mode === "login") {
      const result = await supabase.auth.signInWithPassword({ email, password });
      if (result.error) {
        setMessage(result.error.message);
        setLoading(false);
        return;
      }
      router.replace(returnTo);
      router.refresh();
      return;
    }

    const emailRedirectTo = `${window.location.origin}/auth/confirm?next=${encodeURIComponent(returnTo)}`;
    const result = await supabase.auth.signUp({ email, password, options: { emailRedirectTo } });
    if (result.error) setMessage(result.error.message);
    else if (result.data.session) {
      router.replace(returnTo);
      router.refresh();
      return;
    } else {
      setMessage("Check your email to verify your account. You’ll return to Gista after verification.");
    }
    setLoading(false);
  }

  return (
    <main className="auth-page">
      <div className="auth-card">
        <div className="brand auth-brand"><div className="brand-icon">G</div><span>Gista</span></div>
        <h1>{mode === "login" ? "Welcome back" : "Create your account"}</h1>
        <p>Come talk. Express yourself. Join the conversation.</p>
        <form onSubmit={submit}>
          <label>Email<input type="email" required autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} /></label>
          <label>Password
            <div style={{ position: "relative" }}>
              <input type={showPassword ? "text" : "password"} required minLength={6} autoComplete={mode === "login" ? "current-password" : "new-password"} value={password} onChange={e => setPassword(e.target.value)} style={{ paddingRight: 48, width: "100%" }} />
              <button type="button" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? "Hide password" : "Show password"} title={showPassword ? "Hide password" : "Show password"} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", width: 36, height: 36, display: "grid", placeItems: "center", border: 0, background: "transparent", color: "#77727f", cursor: "pointer" }}>
                {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
              </button>
            </div>
          </label>
          <button className="primary" disabled={loading}>{loading ? "Please wait…" : mode === "login" ? "Log in" : "Sign up"}</button>
        </form>
        {message && <div className="auth-message" role="status">{message}</div>}
        <button className="switch" type="button" onClick={() => { setMode(mode === "login" ? "signup" : "login"); setMessage(""); }}>
          {mode === "login" ? "New to Gista? Create an account" : "Already have an account? Log in"}
        </button>
        <Link className="forgot" href="/auth/forgot-password">Forgot password?</Link>
      </div>
    </main>
  );
}
