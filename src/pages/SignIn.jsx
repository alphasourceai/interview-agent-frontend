import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";

export default function SignIn() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setHasSession(!!data.session);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setHasSession(!!session);
    });
    return () => sub?.subscription?.unsubscribe();
  }, []);

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    try {
      const redirectTo =
        import.meta.env.VITE_AUTH_REDIRECT_URL ||
        `${window.location.origin}/auth/callback`;
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: redirectTo },
      });
      if (error) throw error;
      setSent(true);
    } catch (err) {
      setError(err.message || "Unable to send magic link");
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    setHasSession(false);
  }

  if (hasSession) {
    return (
      <div style={{ maxWidth: 520 }}>
        <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 12 }}>You’re signed in</h1>
        <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: 16, marginBottom: 12 }}>
          You already have an active session. You can continue to the app or sign out.
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <a href="/roles" style={{ border: "1px solid #ccc", borderRadius: 6, padding: "8px 12px", textDecoration: "none" }}>Continue</a>
          <button onClick={signOut} style={{ border: "1px solid #ccc", borderRadius: 6, padding: "8px 12px", background: "#fff" }}>
            Sign out
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 520 }}>
      <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 12 }}>Sign in</h1>
      {sent ? (
        <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: 16 }}>
          <div style={{ marginBottom: 6 }}>Check your email for a magic link.</div>
          <div style={{ color: "#6b7280", fontSize: 14 }}>{email}</div>
        </div>
      ) : (
        <form onSubmit={onSubmit} style={{ display: "grid", gap: 12 }}>
          <div>
            <label style={{ display: "block", fontSize: 14, marginBottom: 6 }}>Work email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              style={{ width: "100%", border: "1px solid #d1d5db", borderRadius: 6, padding: 10 }}
            />
          </div>
          {error && <div style={{ color: "#dc2626", fontSize: 14 }}>{error}</div>}
          <button type="submit" style={{ border: "1px solid #ccc", borderRadius: 6, padding: "8px 12px", background: "#fff" }}>
            Send magic link
          </button>
        </form>
      )}
    </div>
  );
}
