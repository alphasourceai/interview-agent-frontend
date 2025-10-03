// src/pages/SignIn.jsx
import { useState, useMemo, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import '../styles/clientTheme.css';

export default function SignIn() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [newPass1, setNewPass1] = useState('');
  const [newPass2, setNewPass2] = useState('');

  // Preserve any ?next=/path on the current URL
  const { nextPath } = useMemo(() => {
    const url = new URL(window.location.href);
    const next = url.searchParams.get('next') || '';
    return { nextPath: next };
  }, []);

  // Detect Supabase recovery redirect (?pwreset=1 or hash with recovery)
  useEffect(() => {
    const url = new URL(window.location.href);
    const needsReset =
      url.searchParams.get('pwreset') === '1' ||
      window.location.hash.includes('type=recovery') ||
      window.location.hash.includes('recovery');
    if (needsReset) setShowReset(true);
  }, []);

  async function handleSignIn(e) {
    e.preventDefault();
    if (!email || !password || loading) return;
    setErr('');
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setErr(error.message || 'Could not sign in.');
      return;
    }
    const url = new URL(window.location.href);
    const next = url.searchParams.get('next');
    window.location.href = next || '/dashboard';
  }

  async function startReset() {
    if (!email) {
      alert('Enter your email first.');
      return;
    }
    const origin = window.location.origin;
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${origin}/signin?pwreset=1`
    });
    if (error) alert('Could not start reset: ' + error.message);
    else alert('Check your email for a password reset link.');
  }

  async function submitReset(e) {
    e.preventDefault();
    if (!newPass1 || newPass1 !== newPass2) {
      alert('Passwords do not match.');
      return;
    }
    const { error } = await supabase.auth.updateUser({ password: newPass1 });
    if (error) return alert('Could not update password: ' + error.message);
    alert('Password updated. You can sign in now.');
    setShowReset(false);
    setNewPass1(''); setNewPass2('');
    const url = new URL(window.location.href);
    url.searchParams.delete('pwreset');
    window.history.replaceState({}, '', url.toString());
    await supabase.auth.signOut();
    window.location.href = '/signin';
  }

  if (showReset) {
    return (
      <div className="alpha-theme client-auth" style={{ minHeight: '100vh' }}>
        <div className="alpha-card auth-wrap client-card">
          <div className="auth-head">
            <img src="/alpha-symbol.png" alt="AlphaSourceAI" style={{ width: 36, height: 36, objectFit: 'contain' }} />
            <h2>Reset Password</h2>
          </div>
          <form onSubmit={submitReset}>
            <label>New password</label>
            <input className="alpha-input" type="password" value={newPass1} onChange={(e) => setNewPass1(e.target.value)} required />
            <label>Confirm new password</label>
            <input className="alpha-input" type="password" value={newPass2} onChange={(e) => setNewPass2(e.target.value)} required />
            <button type="submit">Update Password</button>
            <div style={{ marginTop: 8 }}>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => { setShowReset(false); window.location.href = '/signin'; }}
                style={{ background: 'none', border: 'none', padding: 0, textDecoration: 'underline', cursor: 'pointer', font: 'inherit' }}
              >
                Back to sign in
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="alpha-theme client-auth" style={{ minHeight: '100vh' }}>
      <div className="alpha-card auth-wrap client-card">
        <div className="auth-head">
          <img src="/alpha-symbol.png" alt="AlphaSourceAI" style={{ width: 36, height: 36, objectFit: 'contain' }} />
          <h2>Client Sign In</h2>
        </div>

        <form onSubmit={handleSignIn}>
          <label htmlFor="email">Email</label>
          <input
            id="email"
            className="alpha-input"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />

          <label htmlFor="password">Password</label>
          <input
            id="password"
            className="alpha-input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />

          <button type="submit" disabled={!email || !password || loading}>
            {loading ? 'Signing in…' : 'Sign In'}
          </button>

          <div style={{ marginTop: 10 }}>
            <button
              type="button"
              onClick={startReset}
              className="btn-ghost"
              style={{ background: 'none', border: 'none', padding: 0, textDecoration: 'underline', cursor: 'pointer', font: 'inherit' }}
            >
              Forgot password?
            </button>
          </div>
        </form>

        {err && (
          <div role="alert" style={{ color: '#ffb4b4', marginTop: 12, fontSize: 14 }}>
            {err}
          </div>
        )}
      </div>
    </div>
  );
}
