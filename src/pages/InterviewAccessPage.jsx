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

// Step 2: OTP — email display removed; code field sits in column 1 width,
// Verify button left-aligned with the code field; larger text via .btn-lg.
function OtpInline({ email, candidateId, roleId, onVerified, onError }) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    setMsg('');
    if (!email || !/^\d{6}$/.test(code)) {
      setErr('Enter your email and a 6-digit code.');
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
      setMsg('Verified! You can start your interview.');
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
    <form onSubmit={submit} className="alpha-form-grid gap-y-3">
      {/* 6-digit code — left column width */}
      <div>
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

      {/* messages under the code field */}
      <div className="alpha-col-span-2">
        {err && <p className="text-red-300 text-sm">{err}</p>}
        {msg && <p className="text-green-300 text-sm">{msg}</p>}
      </div>

      {/* Verify button — left aligned with the code field */}
      <div>
        <button type="submit" disabled={busy} className="btn-lg">
          {busy ? 'Verifying…' : 'Verify'}
        </button>
      </div>
    </form>
  );
}

export default function InterviewAccessPage() {
  const { role_token } = useParams();
  const roomRef = useRef(null);
  const joinTimeoutRef = useRef(null);

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
        if (joinTimeoutRef.current) { clearTimeout(joinTimeoutRef.current); joinTimeoutRef.current = null; }
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
        if (joinTimeoutRef.current) clearTimeout(joinTimeoutRef.current);
        joinTimeoutRef.current = setTimeout(() => setPrejoin(false), 4000);
      } else {
        setError('Interview room is initializing—try again in a moment.');
        if (joinTimeoutRef.current) { clearTimeout(joinTimeoutRef.current); joinTimeoutRef.current = null; }
      }
    } catch {
      setError('Network error starting interview.');
    } finally {
      setStarting(false);
    }
  }, [canStart, submitted]);

  React.useEffect(() => {
    function onMessage(ev) {
      const d = ev?.data;
      const tagRaw = typeof d === 'string' ? d : (d?.action || d?.event || d?.name || '');
      const tag = String(tagRaw).toLowerCase();

      const joinEvents = new Set(['joined-meeting','participant-joined','call-joined','meeting-joined','room-joined']);
      const leaveEvents = new Set(['left-meeting','call-left','meeting-ended','meeting-left','room-left','room-deleted']);
      const prejoinEvents = new Set(['prejoin','prejoin-screen','waiting-room','lobby-shown']);

      if (joinEvents.has(tag)) {
        if (joinTimeoutRef.current) { clearTimeout(joinTimeoutRef.current); joinTimeoutRef.current = null; }
        setPrejoin(false);
        return;
      }
      if (leaveEvents.has(tag)) { setPrejoin(true); return; }
      if (prejoinEvents.has(tag)) { setPrejoin(true); return; }
    }
    window.addEventListener('message', onMessage);
    return () => {
      window.removeEventListener('message', onMessage);
      if (joinTimeoutRef.current) { clearTimeout(joinTimeoutRef.current); joinTimeoutRef.current = null; }
    };
  }, []);

  // keep top spacing, but no text
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

        {/* Full-bleed, opaque hallway hero (no translucency, full width) */}
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
                  onLoad={() => {
                    if (joinTimeoutRef.current) { clearTimeout(joinTimeoutRef.current); }
                    joinTimeoutRef.current = setTimeout(() => setPrejoin((p) => p || true), 300);
                  }}
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

        {/* Step 1 + Step 2, on the same 2-col grid system */}
        <div className="alpha-form">
          <div className="grid grid-cols-1 gap-6 max-w-[1200px] mx-auto">
            <div className="space-y-8">
              {/* STEP 1 */}
              <div className="alpha-form-grid">
                <InterviewAccessForm
                  roleToken={role_token}
                  onSubmitted={(payload) => {
                    setSubmitted(payload);
                    setVerified(false);
                    setRoomUrl('');
                  }}
                />
              </div>

              {/* STEP 2 */}
              <div className="space-y-3">
                <h3 className="text-base font-semibold">Step 2 — Verify & Start</h3>
                {!submitted ? (
                  <p className="text-sm opacity-80">
                    Submit the form first to receive your 6-digit code by email.
                  </p>
                ) : (
                  <>
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

                    {/* Start Interview appears ONLY after verified; centered, white/lilac */}
                    {verified && (
                      <div className="mt-2 start-block">
                        <button
                          type="button"
                          disabled={!canStart || starting}
                          onClick={startInterview}
                          className="btn-xl btn-outline-lilac"
                        >
                          {starting ? 'Starting…' : 'Start Interview'}
                        </button>
                      </div>
                    )}
                    {error && <p className="text-red-300 text-sm mt-2">{error}</p>}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* local CSS specific to this page (keeps Tavus sizing unchanged) */}
        <style>{`
          /* --- Tavus/Daily container --- */
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

          /* joined/in-call */
          @media (min-width: 768px) {
            .tavus-stage .tavus-slot { height: 520px; }
            .tavus-stage.prejoin .tavus-slot { height: 650px; }
          }
          @media (max-width: 767px) {
            .tavus-slot { aspect-ratio: 16 / 9; }
          }

          /* placeholder = fixed 1200×690 until roomUrl exists (do NOT change Tavus sizing) */
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