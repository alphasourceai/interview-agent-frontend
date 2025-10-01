// src/components/InterviewAccessForm.jsx
// Submits candidate info + resume -> returns candidate/role/email to parent (no navigation)

import React, { useRef, useState } from 'react';

function joinUrl(base, path) {
  if (!base) return path;
  if (base.endsWith('/') && path.startsWith('/')) return base.slice(0, -1) + path;
  if (!base.endsWith('/') && !path.startsWith('/')) return base + '/' + path;
  return base + path;
}

const BK = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_BACKEND_URL)
  ? String(import.meta.env.VITE_BACKEND_URL).replace(/\/+$/, '')
  : '';

export default function InterviewAccessForm({ roleToken, onSubmitted }) {
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    resume: null,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const fileInputRef = useRef(null);

  const onChange = (e) => {
    const { name, value, files } = e.target;
    setForm((prev) => ({ ...prev, [name]: files ? files[0] : value }));
  };

  const onPickResume = () => fileInputRef.current?.click();

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');

    if (!roleToken) {
      setError('Missing role link. Please use the correct interview URL.');
      return;
    }
    if (!form.resume) {
      setError('Please attach your resume.');
      return;
    }

    setSubmitting(true);

    // normalize inputs
    const first = (form.first_name || '').trim();
    const last = (form.last_name || '').trim();
    const email = (form.email || '').trim();
    const phoneDigits = String(form.phone || '').replace(/\D/g, '');

    if (!phoneDigits || phoneDigits.length < 7 || phoneDigits.length > 15) {
      setSubmitting(false);
      setError('Please enter a valid phone number (7–15 digits).');
      return;
    }

    try {
      const body = new FormData();
      body.append('first_name', first);
      body.append('last_name', last);
      body.append('email', email);
      body.append('phone', phoneDigits);
      body.append('resume', form.resume);
      body.append('role_token', roleToken);

      const resp = await fetch(joinUrl(BK, '/api/candidate/submit'), {
        method: 'POST',
        body,
      });
      const data = await resp.json();

      if (resp.status === 409) {
        setMessage(
          "You’ve already interviewed for this role with this information. If you believe this is an error, contact support at info@alphasourceai.com"
        );
        setSubmitting(false);
        return;
      }
      if (!resp.ok) {
        setError(data?.error || 'Something went wrong.');
        return;
      }

      setMessage(data?.message || 'OTP created. Check your email.');

      onSubmitted?.({
        candidate_id: data?.candidate_id || null,
        role_id: data?.role_id || null,
        email: data?.email || form.email,
        resume_url: data?.resume_url || null,
      });
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const resumeLabel = form.resume ? form.resume.name : 'Upload Resume (PDF/DOC)';

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {/* Names row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-sm mb-1">First name</label>
          <input
            type="text"
            name="first_name"
            value={form.first_name}
            onChange={onChange}
            required
            className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm mb-1">Last name</label>
          <input
            type="text"
            name="last_name"
            value={form.last_name}
            onChange={onChange}
            required
            className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2"
          />
        </div>
      </div>

      {/* Email (wider / spans two) */}
      <div className="sm:col-span-2">
        <label className="block text-sm mb-1">Email</label>
        <input
          type="email"
          name="email"
          value={form.email}
          onChange={onChange}
          required
          className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 sm:[grid-column:span_2]"
        />
      </div>

      {/* Phone */}
      <div>
        <label className="block text-sm mb-1">Phone</label>
        <input
          type="tel"
          name="phone"
          value={form.phone}
          onChange={onChange}
          placeholder="Digits only"
          required
          inputMode="numeric"
          pattern="[0-9]{7,15}"
          title="Enter 7–15 digits"
          autoComplete="tel"
          className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2"
        />
      </div>

      {/* Resume: lilac button + filename under it */}
      <div>
        <label className="block text-sm mb-1">Resume</label>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onPickResume}
            className="rounded-full px-4 py-2 font-semibold bg-[#AD8BF7] text-white hover:bg-[#854DFF]"
          >
            Upload Resume
          </button>
          <input
            ref={fileInputRef}
            type="file"
            name="resume"
            accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            onChange={onChange}
            className="hidden"
          />
        </div>
        {form.resume && (
          <div className="mt-1 text-xs opacity-80">{resumeLabel}</div>
        )}
      </div>

      {/* Submit button: right-aligned, slightly larger text */}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={submitting || !form.resume}
          className="rounded-full px-6 py-3 font-semibold text-base bg-[#AD8BF7] text-white hover:bg-[#854DFF] disabled:opacity-60"
        >
          {submitting ? 'Submitting…' : 'Submit & Get OTP'}
        </button>
      </div>

      {error && (
        <p className="text-red-300 text-sm" role="alert" aria-live="polite">
          {error}
        </p>
      )}
      {message && (
        <p className="text-green-300 text-sm" role="status" aria-live="polite">
          {message}
        </p>
      )}
    </form>
  );
}