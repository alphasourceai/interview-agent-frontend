// src/components/InterviewAccessForm.jsx
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
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const fileInputRef = useRef(null);

  const onChange = (e) => {
    const { name, value, files } = e.target;
    setForm((prev) => ({ ...prev, [name]: files ? files[0] : value }));
  };

  const onPickResume = () => fileInputRef.current?.click();

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!roleToken) {
      setError('Missing role link. Please use the correct interview URL.');
      return;
    }
    if (!form.resume) {
      setError('Please attach your resume.');
      return;
    }

    setSubmitting(true);

    try {
      const body = new FormData();
      body.append('first_name', form.first_name.trim());
      body.append('last_name', form.last_name.trim());
      body.append('email', form.email.trim());
      body.append('phone', String(form.phone || '').replace(/\D/g, ''));
      body.append('resume', form.resume);
      body.append('role_token', roleToken);

      const resp = await fetch(joinUrl(BK, '/api/candidate/submit'), { method: 'POST', body });
      const data = await resp.json();

      if (!resp.ok) {
        setError(data?.error || 'Something went wrong.');
        return;
      }

      setSubmitted(true);
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

  if (submitted) {
    return (
      <div className="alpha-col-span-2 text-green-300 text-sm">
        Candidate created. OTP emailed.
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="alpha-form-grid gap-y-4">
      <div>
        <label className="alpha-label">First name</label>
        <input type="text" name="first_name" value={form.first_name} onChange={onChange} required className="alpha-input w-full" />
      </div>
      <div>
        <label className="alpha-label">Last name</label>
        <input type="text" name="last_name" value={form.last_name} onChange={onChange} required className="alpha-input w-full" />
      </div>

      <div>
        <label className="alpha-label">Email</label>
        <input type="email" name="email" value={form.email} onChange={onChange} required className="alpha-input w-full" />
      </div>
      <div>
        <label className="alpha-label">Phone</label>
        <input type="tel" name="phone" value={form.phone} onChange={onChange} placeholder="Digits only" required inputMode="numeric" pattern="[0-9]{7,15}" className="alpha-input w-full" />
      </div>

      <div>
        <button type="button" onClick={onPickResume} className="btn-lg">+ Add Resume</button>
        {form.resume && <div className="mt-1 text-xs opacity-80">{form.resume.name}</div>}
        <input ref={fileInputRef} type="file" name="resume" accept=".pdf,.doc,.docx" onChange={onChange} className="hidden" />
      </div>

      <div className="flex justify-end">
        <button type="submit" disabled={submitting || !form.resume} className="btn-lg">
          {submitting ? 'Submitting…' : 'Submit & Get OTP'}
        </button>
      </div>

      {error && <div className="alpha-col-span-2 text-red-300 text-sm">{error}</div>}
    </form>
  );
}