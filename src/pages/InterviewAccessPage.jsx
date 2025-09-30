// src/components/InterviewAccessForm.jsx
import React, { useState } from 'react';

export default function InterviewAccessForm({ roleToken, onSubmitted }) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);

  const unifiedMessage =
    "You’ve already interviewed for this role with this information. If you believe this is an error, contact support at info@alphasourceai.com";

  const submit = async (e) => {
    e.preventDefault();
    setFormError('');
    if (!email || !name) {
      setFormError('Please enter your name and email.');
      return;
    }
    setBusy(true);
    try {
      const resp = await fetch('/api/candidate/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          name,
          role_token: roleToken,
        }),
      });
      if (resp.status === 409) {
        const data = await resp.json().catch(() => ({}));
        setFormError(unifiedMessage);
        return;
      }
      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}));
        setFormError(data.error || 'Submission failed.');
        return;
      }
      const data = await resp.json();
      onSubmitted(data);
    } catch {
      setFormError('Network error submitting form.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="block mb-1 text-sm">Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded border border-gray-300 px-3 py-2"
          required
        />
      </div>
      <div>
        <label className="block mb-1 text-sm">Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded border border-gray-300 px-3 py-2"
          required
        />
      </div>
      {formError && <p className="text-red-600 text-sm">{formError}</p>}
      <button
        type="submit"
        disabled={busy}
        className="w-full rounded bg-purple-600 py-2 font-semibold text-white disabled:opacity-50"
      >
        {busy ? 'Submitting…' : 'Submit'}
      </button>
    </form>
  );
}
