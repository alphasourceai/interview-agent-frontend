// src/components/InterviewAccessForm.jsx
// Submits candidate info + resume -> returns candidate/role/email to parent (no navigation)

import React, { useState } from 'react';

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

  const onChange = (e) => {
    const { name, value, files } = e.target;
    setForm((prev) => ({ ...prev, [name]: files ? files[0] : value }));
  };

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
    try {
      const body = new FormData();
      body.append('first_name', form.first_name);
      body.append('last_name', form.last_name);
      body.append('email', form.email);
      body.append('phone', form.phone);
      body.append('resume', form.resume);
      body.append('role_token', roleToken);

      const resp = await fetch(joinUrl(BK, '/api/candidate/submit'), {
        method: 'POST',
        body,
      });
      const data = await resp.json();

      if (resp.status === 409) {
        // Duplicate candidate for this role: still let them verify right away
        setMessage('We found an existing start for this role. Check your email for a fresh code.');
      } else if (!resp.ok) {
        setError(data?.error || 'Something went wrong.');
        return;
      } else {
        setMessage(data?.message || 'OTP created. Check your email.');
      }

      // hand key info up so the page can open OTP inline
      const payload = {
        candidate_id: data?.candidate_id || null,
        role_id: data?.role_id || null,
        email: data?.email || form.email,
        resume_url: data?.resume_url || null,
      };
      onSubmitted?.(payload);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-3">
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

      <div>
        <label className="block text-sm mb-1">Email</label>
        <input
          type="email"
          name="email"
          value={form.email}
          onChange={onChange}
          required
          className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2"
        />
      </div>

      <div>
        <label className="block text-sm mb-1">Phone</label>
        <input
          type="tel"
          name="phone"
          value={form.phone}
          onChange={onChange}
          placeholder="Digits only"
          required
          className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2"
        />
      </div>

      <div>
        <label className="block text-sm mb-1">Resume (PDF/Doc)</label>
        <input
          type="file"
          name="resume"
          accept=".pdf,.doc,.docx"
          onChange={onChange}
          required
          className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 file:mr-3 file:px-3 file:py-2 file:rounded-lg"
        />
      </div>

      <button
        type="submit"
        disabled={submitting || !form.resume}
        className="w-full rounded-xl px-4 py-2 font-medium bg-[#c09cff] text-black hover:opacity-90 disabled:opacity-60"
      >
        {submitting ? 'Submitting…' : 'Submit & Get OTP'}
      </button>

      {error && <p className="text-red-300 text-sm">{error}</p>}
      {message && <p className="text-green-300 text-sm">{message}</p>}
    </form>
  );
}
