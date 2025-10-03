// src/pages/InterviewAccessPage.jsx
// One-page intake → OTP → Start Interview (embedded tall)
// Uses VITE_BACKEND_URL for API calls

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
  const [err, setErr] = useState('');
  const [isVerified, setIsVerified] = useState(false);

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
      setIsVerified(true);
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

  return (
    <form onSubmit={submit} className="alpha-step2">
      {/* Show heading ONLY after Step 1 is submitted (parent controls rendering of OtpInline) */}
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
          disabled={isVerified}
        />
      </div>

      {err && <p className="text-red-300 text-sm mb-2">{err}</p>}

      {/* Replace button with inline confirmation when verified */}
      {isVerified ? (
        <span className="verified-inline">Verified! You can start your interview.</span>
      ) : (
        <button type="submit" disabled={busy} className="btn-lg">
          {busy ? 'Verifying…' : 'Verify'}
        </button>
      )}
    </form>
  );
}

export default function InterviewAccessPage() {
  const { role_token } = useParams();
  const roomRef = useRef(null);

  const [submitted, setSubmitted] = useState(null); // { candidate_id, role_id, email, resume_url }
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
        setRoomUrl(url);          // triggers “hide everything” below
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

  // top spacing only
  const header = useMemo(
    () => (
      <div className="max-w-6xl mx-auto w-full" aria-hidden="true">
        <div style={{ height: 56 }} />
      </div>
    ),
    []
  );

  const noRoom = !roomUrl;

  return (
    <div className="alpha-theme">
      <div className="space-y-6">
        {header}

        {/* Full-bleed, opaque hallway hero */}
        <div className="alpha-hero fullbleed">
          <div className={`tavus-stage${prejoin ? ' prejoin' : ''}`} ref={roomRef}>
            <div
              id="tavus-slot"
              className={`tavus-slot${noRoom ? ' no-room' : ''}`}
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
                    {!role_token
                      ? "You’re almost there—this page needs a role link. Open the invite link you were sent, or contact your recruiter to resend it."
                      : "Your interview room will appear here after verification."}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Forms + actions are shown until the room URL actually exists */}
        {!roomUrl && (
          <div className="alpha-form">
            <div className="alpha-form-grid-3">
              {/* Step 1 spans columns 1–2 */}
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

              {/* Step 2 only renders once Step 1 is submitted */}
              {submitted ? (
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
              ) : (
                <div className="alpha-step2">
                  {/* Hidden until submitted; left here for layout stability if needed */}
                </div>
              )}
            </div>

            {/* Start Interview appears ONLY after verified; centered below the grid */}
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
        )}

        {/* Page-scoped CSS for the Tavus slot */}
        <style>{`
          .tavus-stage { width: 100%; }
          .tavus-slot {
            position: relative;
            width: 100%;
            border-radius: 16px;
            border: 1px solid rgba(255,255,255,0.1);
            background: rgba(0,0,0,0.85);
            overflow: hidden;
            margin: 0 auto;
            max-width: 1200px;
          }
          @media (min-width: 768px) {
            .tavus-stage .tavus-slot { height: 520px; }
            .tavus-stage.prejoin .tavus-slot { height: 650px; }
          }
          @media (max-width: 767px) {
            .tavus-slot { aspect-ratio: 16 / 9; }
          }
          .tavus-slot.no-room { height: 690px !important; }

          .tavus-slot > iframe,
          .tavus-slot video,
          .tavus-slot [data-daily-video],
          .tavus-slot .daily-video {
            position: absolute !important;
            inset: 0 !important;
            width: 100% !important;
            height: 100% !important;
            border: 0 !important;
            display: block;
            object-fit: contain;
            background: #000;
          }
          .tavus-slot .placeholder {
            position: absolute; inset: 0;
            display:flex; align-items:center; justify-content:center;
            color: rgba(255,255,255,0.85); padding:24px; text-align:center;
          }
          .tavus-slot .center-msg { max-width: 520px; }
        `}</style>
      </div>
    </div>
  );
}