// src/pages/InterviewAccessPage.jsx
// One-page intake → OTP → Start Interview (embedded)
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

function OtpInline({ email, candidateId, roleId, onVerified }) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const inputRef = useRef(null);

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
        setErr(data?.error || 'Verification failed.');
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
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
      <h3 className="text-base font-semibold mb-3">Enter the code we emailed you</h3>
      <form onSubmit={submit} className="space-y-3">
        <div>
          <label className="block text-sm mb-1">Email</label>
          <input
            type="email"
            value={email}
            readOnly
            className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm mb-1">6-digit code</label>
          <input
            ref={inputRef}
            type="text"
            inputMode="numeric"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 tracking-widest"
            placeholder="••••••"
            required
          />
        </div>
        {err && <p className="text-red-300 text-sm">{err}</p>}
        {msg && <p className="text-green-300 text-sm">{msg}</p>}
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-xl px-4 py-2 font-medium bg-[#c09cff] text-black hover:opacity-90 disabled:opacity-60"
        >
          {busy ? 'Verifying…' : 'Verify'}
        </button>
      </form>
    </div>
  );
}

export default function InterviewAccessPage() {
  const { role_token } = useParams();

  // intake result
  const [submitted, setSubmitted] = useState(null); // { candidate_id, role_id, email, resume_url }
  const [verified, setVerified] = useState(false);

  // interview room
  const [roomUrl, setRoomUrl] = useState('');
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');

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
      if (url) setRoomUrl(url);
      else setError('Interview room is initializing—try again in a moment.');
    } catch {
      setError('Network error starting interview.');
    } finally {
      setStarting(false);
    }
  }, [canStart, submitted]);

  const header = useMemo(
    () => (
      <div className="max-w-6xl mx-auto w-full">
        <h1 className="text-2xl font-bold mb-2">Start Your Interview</h1>
        <p className="opacity-80 mb-4">
          Enter your details, verify the code we send, then click <em>Start Interview</em>.
        </p>
      </div>
    ),
    []
  );

  return (
    <div className="p-4 max-w-6xl mx-auto space-y-6">
      {header}

      {/* Top media/room area */}
      <div className="w-full aspect-video bg-black/30 rounded-2xl border border-white/10 overflow-hidden flex items-center justify-center">
        {roomUrl ? (
          <iframe
            title="Interview"
            src={roomUrl}
            className="w-full h-full"
            allow="camera; microphone; autoplay; fullscreen"
          />
        ) : (
          <div className="text-center p-6 opacity-80">
            <div className="text-sm">Your interview room will appear here after verification.</div>
          </div>
        )}
      </div>

      {/* Two-column: left = form, right = OTP + Start */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Intake form */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
          <InterviewAccessForm
            roleToken={role_token}
            onSubmitted={(payload) => {
              setSubmitted(payload);
              setVerified(false); // reset if user re-submits with a different email
              setRoomUrl('');
            }}
          />
        </div>

        {/* OTP + Start */}
        <div className="space-y-4">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
            <h3 className="text-base font-semibold mb-3">Step 2 — Verify & Start</h3>
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
                    // keep latest ids in case BE returned different values
                    setSubmitted((s) => ({ ...(s || {}), ...info }));
                  }}
                />

                <div className="mt-4">
                  <button
                    type="button"
                    disabled={!canStart || starting}
                    onClick={startInterview}
                    className="w-full rounded-xl px-4 py-2 font-medium bg-[#c09cff] text-black hover:opacity-90 disabled:opacity-60"
                  >
                    {starting ? 'Starting…' : 'Start Interview'}
                  </button>
                  {error && <p className="text-red-300 text-sm mt-2">{error}</p>}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
