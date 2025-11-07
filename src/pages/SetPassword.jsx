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

function decodeBase64Url(value) {
  if (typeof window === 'undefined' || typeof value !== 'string' || !value) return '';
  try {
    const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
    return window.atob(normalized);
  } catch {
    return '';
  }
}

function parseEmailFromState(stateParam) {
  const attempts = [];
  const push = (val) => {
    if (typeof val === 'string' && val && !attempts.includes(val)) {
      attempts.push(val);
    }
  };
  push(stateParam?.trim());
  try {
    const decoded = decodeURIComponent(stateParam || '');
    push(decoded);
  } catch {}
  push(decodeBase64Url(stateParam || ''));

  for (const candidate of attempts) {
    if (!candidate) continue;
    try {
      const json = JSON.parse(candidate);
      const emailFromJson =
        json?.email ||
        json?.user?.email ||
        json?.data?.email ||
        json?.user_email;
      if (emailFromJson) {
        return String(emailFromJson).trim().toLowerCase();
      }
    } catch {}

    try {
      const qs = new URLSearchParams(candidate);
      const qsEmail =
        qs.get('email') ||
        qs.get('user_email') ||
        qs.get('email_address');
      if (qsEmail) {
        return String(qsEmail).trim().toLowerCase();
      }
    } catch {}
  }
  return '';
}

function isExpiredLinkError(err) {
  if (!err) return false;
  const code = String(err.code || err.status || err.statusCode || '').toLowerCase();
  const detailCode = String(err.error_code || '').toLowerCase();
  if (detailCode === 'otp_expired') return true;
  if (code === '410' || code === 'expired_token' || code === 'invalid_grant' || code === 'otp_expired') return true;
  const msg = String(
    err.message ||
      err.error_description ||
      err.error ||
      err.toString() ||
      ''
  ).toLowerCase();
  if (!msg) return false;
  if (msg.includes('expired')) return true;
  return msg.includes('invalid or expired');
}

export default function SetPassword() {
  const [status, setStatus] = useState('loading'); // loading | ready | error | expired
  const [mode, setMode] = useState('recovery');
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [password1, setPassword1] = useState('');
  const [password2, setPassword2] = useState('');
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(false);
  const [resendEmail, setResendEmail] = useState('');
  const [resendError, setResendError] = useState('');
  const [resendBusy, setResendBusy] = useState(false);
  const [resendSent, setResendSent] = useState(false);

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
        url.searchParams.delete('token');
        url.searchParams.delete('token_hash');
        url.searchParams.delete('type');
        url.searchParams.delete('state');
        url.searchParams.delete('access_token');
        url.searchParams.delete('refresh_token');
        url.searchParams.delete('password_reset');
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
        const hashString = window.location.hash.startsWith('#')
          ? window.location.hash.slice(1)
          : window.location.hash;
        const hashParams = new URLSearchParams(hashString);
        const modeParam = normalizeMode(url.searchParams.get('mode') || hashParams.get('mode'));
        const nextParam = url.searchParams.get('next') || hashParams.get('next') || '';
        const typeParam = (url.searchParams.get('type') || hashParams.get('type') || '').toLowerCase();
        const stateParam = url.searchParams.get('state') || hashParams.get('state') || '';
        const emailParam =
          url.searchParams.get('email') ||
          url.searchParams.get('user_email') ||
          url.searchParams.get('email_address') ||
          hashParams.get('email') ||
          hashParams.get('user_email') ||
          hashParams.get('email_address') ||
          '';
        const emailFromState = parseEmailFromState(stateParam);
        const emailHint = (emailFromState || emailParam || '').trim().toLowerCase();
        if (emailHint) setResendEmail(emailHint);
        setMode(modeParam);
        let accessToken = url.searchParams.get('access_token') || hashParams.get('access_token');
        let refreshToken = url.searchParams.get('refresh_token') || hashParams.get('refresh_token');
        const code = url.searchParams.get('code') || hashParams.get('code');
        const legacyToken =
          url.searchParams.get('token') ||
          hashParams.get('token') ||
          url.searchParams.get('token_hash') ||
          hashParams.get('token_hash');

        const exchangeableTypes = new Set(['invite', 'recovery', 'signup']);

        if (code && !accessToken && (exchangeableTypes.has(typeParam) || !typeParam)) {
          const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession({ code });
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

        if (accessToken) {
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
          return;
        }

        if (legacyToken && (typeParam === 'recovery' || modeParam === 'recovery')) {
          let emailForOtp = emailHint;
          if (!emailForOtp && typeof window !== 'undefined') {
            const prompted = window.prompt('Enter the email address that received this link so we can verify it:') || '';
            emailForOtp = prompted.trim().toLowerCase();
          }
          if (!emailForOtp) {
            throw new Error('Email is required to finish verifying this link.');
          }
          const { error: otpError } = await supabase.auth.verifyOtp({
            type: 'recovery',
            token: legacyToken,
            email: emailForOtp
          });
          if (otpError) {
            throw otpError;
          }
          setResendEmail(emailForOtp);
          sanitizeUrl(modeParam, nextParam);
          setStatus('ready');
          postEmbedSizeBurst();
          return;
        }

        throw new Error('This link is missing the information we need. Request a new email from the team.');
      } catch (err) {
        console.error('[SetPassword] init failed:', err);
        setError(err?.message || 'Unable to validate this password link. Request a new email from the team.');
        if (isExpiredLinkError(err)) {
          setStatus('expired');
        } else {
          setStatus('error');
        }
        postEmbedSizeBurst();
      }
    }

    init();
  }, []);

  useEffect(() => {
    postEmbedSizeBurst();
  }, [status, success, formError, password1, password2, resendError, resendSent, resendEmail]);

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
      setTimeout(() => {
        if (typeof window !== 'undefined') {
          try {
            window.location.replace('/');
          } catch {}
        }
      }, 400);
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

  async function handleResend(e) {
    e.preventDefault();
    if (resendSent) return;
    setResendError('');
    const emailNorm = resendEmail.trim().toLowerCase();
    if (!emailNorm) {
      setResendError('Enter your email to receive a new reset link.');
      return;
    }
    setResendBusy(true);
    try {
      const origin = window.location.origin;
      const redirect = `${origin}/set-password?mode=recovery&password_reset=1`;
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(emailNorm, {
        redirectTo: redirect
      });
      if (resetError) {
        throw resetError;
      }
      setResendSent(true);
      postEmbedSizeBurst();
    } catch (err) {
      console.error('[SetPassword] resend reset link failed:', err);
      setResendError(err?.message || 'Could not send a new reset link. Please try again.');
    } finally {
      setResendBusy(false);
    }
  }

  if (status === 'error' || status === 'expired') {
    const isExpired = status === 'expired';
    const headingText = isExpired ? 'Link expired' : 'Link issue';
    const copy = resendSent
      ? `A new reset link is on its way to ${resendEmail || 'your inbox'}. Check spam if you don't see it.`
      : isExpired
        ? "This password link is no longer valid. Enter your email below and we'll send you a fresh one."
        : (error || "We could not validate this password link. Enter your email below and we'll send a new reset email.");
    return (
      <div className="alpha-theme client-auth" style={containerStyle}>
        <div className="alpha-card auth-wrap client-card">
          <div className="auth-head">
            <h2>{headingText}</h2>
          </div>
          <p style={{ marginBottom: 16 }}>
            {resendSent
              ? (
                <>A new reset link is on its way to <strong>{resendEmail || 'your inbox'}</strong>. Check your email (and spam folder).</>
              ) : copy}
          </p>
          {!resendSent && (
            <form onSubmit={handleResend} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <label htmlFor="reset-email" style={{ fontWeight: 600 }}>Email</label>
              <input
                id="reset-email"
                className="alpha-input"
                type="email"
                placeholder="you@example.com"
                value={resendEmail}
                onChange={(e) => {
                  setResendEmail(e.target.value);
                  if (resendError) setResendError('');
                }}
                required
              />
              {resendError && <div style={{ color: '#dc2626', fontSize: 13 }}>{resendError}</div>}
              <button type="submit" disabled={resendBusy} style={{ marginTop: 8 }}>
                {resendBusy ? 'Sending…' : 'Send me a new reset link'}
              </button>
            </form>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16 }}>
            <button type="button" onClick={() => window.location.replace('/signin')}>
              Client Sign In
            </button>
            <button type="button" onClick={() => window.location.replace('/admin')}>
              Admin Sign In
            </button>
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
