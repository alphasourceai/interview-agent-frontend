import { useEffect, useState } from 'react';
import '../styles/clientTheme.css';

const backendBase = (import.meta.env.VITE_BACKEND_URL || '').replace(/\/+$/, '');

export default function PasswordStart() {
  const [email, setEmail] = useState('');
  const [sig, setSig] = useState('');
  const [tsValue, setTs] = useState('');
  const [status, setStatus] = useState('loading'); // loading | ready | invalid | submitting
  const [error, setError] = useState('');

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const e = (params.get('e') || '').trim().toLowerCase();
      const s = (params.get('sig') || '').trim();
      const t = (params.get('ts') || '').trim();
      if (e && s && t) {
        setEmail(e);
        setSig(s);
        setTs(t);
        setStatus('ready');
      } else {
        setEmail('');
        setSig('');
        setStatus('invalid');
        setError('This link is missing the information we need. Request a new password email from your admin.');
      }
    } catch (err) {
      console.error('[PasswordStart] query parse failed:', err);
      setStatus('invalid');
      setError('This link is invalid. Request a new password email from your admin.');
    }
  }, []);

  const containerStyle = { minHeight: '100vh' };
  const disabled = status === 'submitting';

  const requestNewLink = () => {
    window.location.replace('/set-password?mode=recovery');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!email || !sig || !tsValue) return;
    if (!backendBase) {
      setError('Password reset service is unavailable. Please try again later.');
      return;
    }
    try {
      setStatus('submitting');
      const form = document.createElement('form');
      form.method = 'POST';
      form.action = `${backendBase}/auth/password-start?redirect=1`;
      form.style.display = 'none';

      const emailField = document.createElement('input');
      emailField.name = 'email';
      emailField.value = email;
      form.appendChild(emailField);

      const sigField = document.createElement('input');
      sigField.name = 'sig';
      sigField.value = sig;
      form.appendChild(sigField);

      const tsField = document.createElement('input');
      tsField.name = 'ts';
      tsField.value = tsValue;
      form.appendChild(tsField);

      document.body.appendChild(form);
      form.submit();
    } catch (err) {
      console.error('[PasswordStart] submit failed:', err);
      setStatus('ready');
      setError('Could not start the password reset. Please request a new email.');
    }
  };

  if (status === 'loading') {
    return (
      <div className="alpha-theme client-auth" style={containerStyle}>
        <div className="alpha-card auth-wrap client-card">
          <div className="auth-head">
            <h2>Preparing reset…</h2>
          </div>
          <p>Hold tight while we verify this link.</p>
        </div>
      </div>
    );
  }

  const invalid = status === 'invalid';

  return (
    <div className="alpha-theme client-auth" style={containerStyle}>
      <div className="alpha-card auth-wrap client-card">
        <div className="auth-head">
          <h2>Password Reset</h2>
        </div>
        {invalid ? (
          <p style={{ marginBottom: 16 }}>
            {error || 'This password link is no longer valid. Request a new email below.'}
          </p>
        ) : (
          <p style={{ marginBottom: 16 }}>
            Click the button below to start your secure password reset{email ? ` for ${email}` : ''}.
          </p>
        )}
        {error && !invalid && (
          <div style={{ color: '#dc2626', marginBottom: 16 }}>{error}</div>
        )}
        {!invalid && (
          <form onSubmit={handleSubmit}>
            <button type="submit" disabled={disabled} style={{ width: '100%' }}>
              {disabled ? 'Opening…' : 'Reset Password'}
            </button>
          </form>
        )}
        <button
          type="button"
          className="btn-ghost"
          style={{ marginTop: 16 }}
          onClick={requestNewLink}
        >
          Request a new reset email
        </button>
      </div>
    </div>
  );
}
