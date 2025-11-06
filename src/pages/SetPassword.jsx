import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import '../styles/clientTheme.css';

const EMBEDDED = typeof window !== 'undefined' && window !== window.parent;

function normalizeMode(value) {
  const v = (value || '').toLowerCase();
  return v === 'signup' ? 'signup' : 'recovery';
}

function postEmbedSize() {
  if (typeof window === 'undefined') return;
  try {
    const doc = document;
    const h = Math.max(
      doc.body?.scrollHeight || 0,
      doc.documentElement?.scrollHeight || 0,
      doc.body?.offsetHeight || 0,
      doc.documentElement?.offsetHeight || 0
    );
    window.parent?.postMessage({ type: 'EMBED_SIZE', height: h }, '*');
  } catch {}
}

function postEmbedSizeBurst() {
  postEmbedSize();
  setTimeout(postEmbedSize, 60);
  setTimeout(postEmbedSize, 180);
}

export default function SetPassword() {
  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [mode, setMode] = useState('recovery');
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [password1, setPassword1] = useState('');
  const [password2, setPassword2] = useState('');
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (typeof document !== 'undefined' && EMBEDDED) {
      try {
        document.documentElement.classList.add('embedded');
        const style = document.createElement('style');
        style.setAttribute('data-embed-overflow', '1');
        style.textContent = `
          .embedded, .embedded body {
            overflow: hidden !important;
            height: auto !important;
          }
        `;
        if (!document.querySelector('style[data-embed-overflow=\"1\"]')) {
          document.head.appendChild(style);
        }
      } catch {}
    }
  }, []);

  useEffect(() => {
    const sanitizeUrl = (keepMode, keepNext) => {
      try {
        const url = new URL(window.location.href);
        url.hash = '';
        url.searchParams.delete('code');
        url.searchParams.delete('token_hash');
        if (keepMode) {
          url.searchParams.set('mode', keepMode);
        } else {
          url.searchParams.delete('mode');
        }
        if (keepNext) {
          url.searchParams.set('next', keepNext);
        } else {
          url.searchParams.delete('next');
        }
        window.history.replaceState({}, '', url.toString());
      } catch {}
    };

    async function init() {
      try {
        if (typeof window === 'undefined') {
          setStatus('error');
          setError('This page must run in a browser.');
          return;
        }

        const url = new URL(window.location.href);
        const modeParam = normalizeMode(url.searchParams.get('mode'));
        const nextParam = url.searchParams.get('next') || '';
        setMode(modeParam);

        const hashString = window.location.hash.startsWith('#')
          ? window.location.hash.slice(1)
          : window.location.hash;
        const hashParams = new URLSearchParams(hashString);
        let accessToken = hashParams.get('access_token');
        let refreshToken = hashParams.get('refresh_token');

        const code = url.searchParams.get('code');
        if (code && !accessToken) {
          const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) {
            throw exchangeError;
          }
          if (!data?.session?.access_token) {
            throw new Error('Unable to establish a session from this link. Request a fresh email.');
          }
          sanitizeUrl(modeParam, nextParam);
          setStatus('ready');
          postEmbedSizeBurst();
          return;
        }

        if (!accessToken) {
          throw new Error('This link is missing a token. Request a new email.');
        }

        if (!refreshToken) {
          refreshToken = hashParams.get('refresh_token');
        }

        const { error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken || undefined
        });
        if (sessionError) {
          throw sessionError;
        }

        sanitizeUrl(modeParam, nextParam);
        setStatus('ready');
        postEmbedSizeBurst();
      } catch (err) {
        console.error('[SetPassword] init failed:', err);
        setError(err?.message || 'Unable to validate this password link. Request a new email from the team.');
        setStatus('error');
        postEmbedSizeBurst();
      }
    }

    init();
  }, []);

  useEffect(() => {
    postEmbedSizeBurst();
  }, [status, success, formError, password1, password2]);

  const heading = mode === 'signup' ? 'Set Your Password' : 'Reset Your Password';

  async function handleSubmit(e) {
    e.preventDefault();
    if (busy) return;
    setFormError('');

    if (!password1 || password1.length < 6) {
      setFormError('Choose a password that is at least 6 characters long.');
      return;
    }
    if (password1 !== password2) {
      setFormError('Passwords do not match.');
      return;
    }

    setBusy(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password: password1 });
      if (updateError) {
        throw updateError;
      }
      setSuccess(true);
      postEmbedSizeBurst();
    } catch (err) {
      console.error('[SetPassword] update failed:', err);
      setFormError(err?.message || 'Could not update password. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  const containerStyle = EMBEDDED ? { overflow: 'hidden' } : { minHeight: '100vh' };

  if (status === 'loading') {
    return (
      <div className="alpha-theme client-auth" style={containerStyle}>
        <div className="alpha-card auth-wrap client-card">
          <div className="auth-head">
            <h2>{heading}</h2>
          </div>
          <p>Preparing your password form…</p>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="alpha-theme client-auth" style={containerStyle}>
        <div className="alpha-card auth-wrap client-card">
          <div className="auth-head">
            <h2>Link expired</h2>
          </div>
          <p style={{ marginBottom: 16 }}>
            {error || 'This password link is no longer valid. Request a new email from the alphaSource team.'}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button onClick={() => window.location.replace('/signin')}>Client Sign In</button>
            <button onClick={() => window.location.replace('/admin')}>Admin Sign In</button>
          </div>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="alpha-theme client-auth" style={containerStyle}>
        <div className="alpha-card auth-wrap client-card">
          <div className="auth-head">
            <h2>Password updated</h2>
          </div>
          <p style={{ marginBottom: 16 }}>
            Your password is set. You can continue to the app using the links below.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button onClick={() => window.location.replace('/signin')}>Client Sign In</button>
            <button onClick={() => window.location.replace('/admin')}>Admin Sign In</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="alpha-theme client-auth" style={containerStyle}>
      <div className="alpha-card auth-wrap client-card">
        <div className="auth-head">
          <h2>{heading}</h2>
          <p style={{ color: '#6b7280', fontSize: 14 }}>
            Enter and confirm your new password to continue.
          </p>
        </div>
        <form onSubmit={handleSubmit}>
          <label htmlFor="password-1">New password</label>
          <input
            id="password-1"
            className="alpha-input"
            type="password"
            value={password1}
            onChange={(e) => setPassword1(e.target.value)}
            required
            autoComplete="new-password"
          />

          <label htmlFor="password-2">Confirm password</label>
          <input
            id="password-2"
            className="alpha-input"
            type="password"
            value={password2}
            onChange={(e) => setPassword2(e.target.value)}
            required
            autoComplete="new-password"
          />

          {formError && <div style={{ color: '#dc2626', marginTop: 8 }}>{formError}</div>}

          <button type="submit" disabled={busy} style={{ marginTop: 16 }}>
            {busy ? 'Saving…' : 'Update Password'}
          </button>
        </form>
      </div>
    </div>
  );
}
