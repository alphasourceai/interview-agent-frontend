// src/pages/SignIn.jsx
import { useState, useMemo } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function SignIn() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  // Preserve any ?next=/path on the current URL, and prefer an explicit redirect URL if provided.
  const { redirectTo } = useMemo(() => {
    const url = new URL(window.location.href);
    const next = url.searchParams.get('next') || '';
    const base =
      import.meta.env.VITE_AUTH_REDIRECT_URL ||
      `${window.location.origin}/auth/callback`;

    const finalRedirect = next
      ? `${base}?next=${encodeURIComponent(next)}`
      : base;

    return { redirectTo: finalRedirect };
  }, []);

  async function onSubmit(e) {
    e.preventDefault();
    if (!email || loading) return;
    setErr('');
    setLoading(true);

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo },
    });

    setLoading(false);
    if (error) setErr(error.message || 'Could not send magic link.');
    else setSent(true);
  }

  if (sent) {
    return (
      <div className="alpha-theme" style={{ minHeight: '100vh' }}>
        <div
          className="card"
          style={{
            maxWidth: 420,
            margin: '80px auto',
            padding: 24,
          }}
        >
          <h1 className="title" style={{ marginBottom: 8 }}>
            Check your email
          </h1>
          <p className="muted">
            We sent a magic link to <strong>{email}</strong>. Click it to sign
            in.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="alpha-theme" style={{ minHeight: '100vh' }}>
      <div
        className="card"
        style={{
          maxWidth: 420,
          margin: '80px auto',
          padding: 24,
        }}
      >
        <h1 className="title" style={{ marginBottom: 8 }}>
          Sign in
        </h1>
        <p className="muted" style={{ marginBottom: 16 }}>
          We’ll email you a magic link to sign in.
        </p>

        <form onSubmit={onSubmit}>
          <label htmlFor="email" className="label">
            Email
          </label>
          <input
            id="email"
            className="input"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            style={{ width: '100%', marginBottom: 12 }}
          />

          <button
            type="submit"
            className="btn"
            disabled={!email || loading}
            style={{ width: '100%' }}
          >
            {loading ? 'Sending…' : 'Send magic link'}
          </button>
        </form>

        {err && (
          <div
            role="alert"
            style={{ color: '#ffb4b4', marginTop: 12, fontSize: 14 }}
          >
            {err}
          </div>
        )}
      </div>
    </div>
  );
}
