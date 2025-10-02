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

  const resumeLabel = form.resume ? form.resume.name : '';

  return (
    <form onSubmit={onSubmit} className="alpha-form-grid gap-y-4">
      {/* Row 1: First / Last */}
      <div>
        <label className="alpha-label">First name</label>
        <input
          type="text"
          name="first_name"
          value={form.first_name}
          onChange={onChange}
          required
          className="alpha-input w-full"
        />
      </div>
      <div>
        <label className="alpha-label">Last name</label>
        <input
          type="text"
          name="last_name"
          value={form.last_name}
          onChange={onChange}
          required
          className="alpha-input w-full"
        />
      </div>

      {/* Row 2: Email (right column, 1.5fr) / Phone (right column) */}
      <div className="col-span-2 sm:col-start-2">
        <label className="alpha-label">Email</label>
        <input
          type="email"
          name="email"
          value={form.email}
          onChange={onChange}
          required
          className="alpha-input w-full"
        />
      </div>
      <div className="col-span-2 sm:col-start-2">
        <label className="alpha-label">Phone</label>
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
          className="alpha-input w-full"
        />
      </div>

      {/* Row 3: Upload Resume (left column), no label text above */}
      <div>
        <button
          type="button"
          onClick={onPickResume}
          className="btn-lg"
        >
          + Add Resume
        </button>
        {resumeLabel && (
          <div className="mt-1 text-xs opacity-80">{resumeLabel}</div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          name="resume"
          accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          onChange={onChange}
          className="hidden"
        />
      </div>

      {/* Row 3: Submit (right aligned with Verify in Step 2) */}
      <div className="col-span-2 sm:col-start-2 flex justify-end">
        <button
          type="submit"
          disabled={submitting || !form.resume}
          className="btn-lg"
        >
          {submitting ? 'Submitting…' : 'Submit & Get OTP'}
        </button>
      </div>

      {/* Messages under grid */}
      <div className="alpha-col-span-2">
        {error && <p className="text-red-300 text-sm" role="alert">{error}</p>}
        {message && <p className="text-green-300 text-sm" role="status">{message}</p>}
      </div>
    </form>
  );
}