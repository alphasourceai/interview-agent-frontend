// src/pages/InterviewAccessPage.jsx
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import InterviewAccessForm from '../components/InterviewAccessForm';

function joinUrl(base, path) {
  if (!base) return path;
  if (base.endsWith('/') && path.startsWith('/')) return base.slice(0, -1) + path;
  if (!base.endsWith('/') && !path.startsWith('/')) return base + '/' + path;
  return base + path;
}

const BK = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_BACKEND_URL)
  ? String(import.meta.env.VITE_BACKEND_URL).replace(/\/+$/, '')
  : '';

function OtpInline({ email, candidateId, roleId, onVerified, onError }) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [verified, setVerified] = useState(false);
  const [err, setErr] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    if (!/^\d{6}$/.test(code)) {
      setErr('Enter the 6-digit code.');
      return;
    }
    setBusy(true);
    try {
      const body = { email: String(email).trim().toLowerCase(), code: code.trim() };
      if (candidateId) body.candidate_id = candidateId;
      if (roleId) body.role_id = roleId;

      const resp = await fetch(joinUrl(BK, '/api/candidate/verify-otp'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await resp.json();
      if (!resp.ok) {
        const m = data?.error || 'Verification failed.';
        setErr(m);
        onError?.(m);
        return;
      }
      setVerified(true);
      onVerified?.({
        candidate_id: data?.candidate_id || candidateId,
        role_id: data?.role_id || roleId,
        email: data?.email || email,
      });
    } catch {
      setErr('Network error verifying code.');
      onError?.('Network error verifying code.');
    } finally {
      setBusy(false);
    }
  };

  if (verified) {
    return (
      <div className="alpha-step2">
        <span className="verified-inline">Verified! You can start your interview.</span>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="alpha-step2">
      <h3 className="text-base font-semibold mb-3">Step 2 — Verify & Start</h3>
      <div className="mb-3">
        <label className="alpha-label">6-digit code</label>
        <input
          type="text"
          inputMode="numeric"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
          className="alpha-input w-full tracking-widest"
          placeholder="••••••"
          required
        />
      </div>
      {err && <p className="text-red-300 text-sm mb-2">{err}</p>}
      <button type="submit" disabled={busy} className="btn-lg">
        {busy ? 'Verifying…' : 'Verify'}
      </button>
    </form>
  );
}

export default function InterviewAccessPage() {
  const { role_token } = useParams();
  const roomRef = useRef(null);
  const joinTimeoutRef = useRef(null);

  const [submitted, setSubmitted] = useState(null);
  const [verified, setVerified] = useState(false);
  const [roomUrl, setRoomUrl] = useState('');
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');
  const [prejoin, setPrejoin] = useState(false);

  const canStart = Boolean(verified && submitted?.candidate_id);

  const startInterview = useCallback(async () => {
    if (!canStart) return;
    setStarting(true);
    setError('');
    try {
      const resp = await fetch(joinUrl(BK, '/create-tavus-interview'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidate_id: submitted.candidate_id,
          role_id: submitted.role_id,
          email: submitted.email,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        setError(data?.error || 'Could not start interview.');
        return;
      }
      const url =
        data?.conversation_url ||
        data?.video_url ||
        data?.redirect_url ||
        data?.url ||
        '';
      if (url) {
        setRoomUrl(url);
        setPrejoin(true);
        setTimeout(() => {
          try { roomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch {}
        }, 50);
      } else {
        setError('Interview room is initializing—try again in a moment.');
      }
    } catch {
      setError('Network error starting interview.');
    } finally {
      setStarting(false);
    }
  }, [canStart, submitted]);

  // header spacing
  const header = useMemo(
    () => (
      <div className="max-w-6xl mx-auto w-full" aria-hidden="true">
        <div style={{ height: 56 }} />
      </div>
    ),
    []
  );

  return (
    <div className="alpha-theme">
      <div className="space-y-6">
        {header}

        {/* Full-bleed, opaque hallway hero */}
        <div className="alpha-hero fullbleed">
          <div className={`tavus-stage${prejoin ? ' prejoin' : ''}`} ref={roomRef}>
            <div
              id="tavus-slot"
              className={`tavus-slot${!roomUrl ? ' no-room' : ''}`}
              aria-label="Interview video area"
            >
              {roomUrl ? (
                <iframe
                  title="Interview"
                  src={roomUrl}
                  loading="lazy"
                  allow="camera; microphone; autoplay; fullscreen; display-capture; clipboard-write"
                  allowFullScreen
                />
              ) : (
                <div className="placeholder">
                  <div className="center-msg">
                    Your interview room will appear here after verification.
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Unified 3-column grid */}
        <div className="alpha-form">
          <div className="alpha-form-grid-3">
            <div className="alpha-span-2">
              <InterviewAccessForm
                roleToken={role_token}
                onSubmitted={(payload) => {
                  setSubmitted(payload);
                  setVerified(false);
                  setRoomUrl('');
                }}
              />
            </div>

            {submitted && (
              <OtpInline
                email={submitted.email}
                candidateId={submitted.candidate_id}
                roleId={submitted.role_id}
                onVerified={(info) => {
                  setVerified(true);
                  setSubmitted((s) => ({ ...(s || {}), ...info }));
                }}
                onError={() => setVerified(false)}
              />
            )}
          </div>

          {verified && (
            <div className="start-block">
              <button
                type="button"
                disabled={!canStart || starting}
                onClick={startInterview}
                className="btn-xl btn-outline-lilac btn-wide"
              >
                {starting ? 'Starting…' : 'Start Interview'}
              </button>
            </div>
          )}
          {error && <p className="text-red-300 text-sm mt-2 center">{error}</p>}
        </div>
      </div>
    </div>
  );
}