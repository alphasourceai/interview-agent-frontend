// src/pages/RoleNew.jsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { supabase } from '../lib/supabaseClient';
import { useClientContext } from '../lib/clientContext';

async function getToken() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token || null;
}

export default function RoleNew() {
  const nav = useNavigate();
  const { clients, selectedClientId, loadClients, setSelectedClientId } = useClientContext();
  const [title, setTitle] = useState('');
  const [interviewType, setInterviewType] = useState('basic');
  const [jdFile, setJdFile] = useState(null);
  const [manualQs, setManualQs] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadClients?.();
  }, [loadClients]);

  async function uploadJD(client_id) {
    if (!jdFile) return null;
    const token = await getToken();
    const base = (import.meta.env.VITE_BACKEND_URL || '').replace(/\/+$/, '') || window.location.origin;
    const fd = new FormData();
    fd.append('file', jdFile);
    fd.append('client_id', client_id);
    const resp = await fetch(`${base}/roles/upload-jd?client_id=${encodeURIComponent(client_id)}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: fd,
    });
    if (!resp.ok) {
      const t = await resp.text().catch(() => '');
      throw new Error(`JD upload failed (${resp.status}) ${t || ''}`);
    }
    const j = await resp.json();
    return j?.storage_path || null; // e.g. "kbs/<client>/<...>.pdf"
  }

  async function onSubmit(e) {
    e.preventDefault();
    if (!selectedClientId) return;
    setSaving(true);
    try {
      const job_description_url = await uploadJD(selectedClientId);
      const payload = {
        client_id: selectedClientId,
        title,
        interview_type: interviewType,
        job_description_url,                                // <— now stored
        manual_questions: manualQs
          ? manualQs.split('\n').map((s) => s.trim()).filter(Boolean)
          : [],
      };
      await api.createRole(payload, getToken);
      nav('/roles');
    } catch (err) {
      alert(err.message || 'Job description upload failed.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-semibold mb-4">Add Role</h1>

      <div className="mb-4">
        <label className="block text-sm mb-1">Client</label>
        <select
          className="border rounded p-2"
          value={selectedClientId || ''}
          onChange={(e) => setSelectedClientId(e.target.value)}
        >
          {(clients || []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name || c.id}
            </option>
          ))}
        </select>
      </div>

      <form onSubmit={onSubmit} className="space-y-3">
        <div>
          <label className="block text-sm mb-1">Role title</label>
          <input className="border rounded p-2 w-full" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>

        <div>
          <label className="block text-sm mb-1">Interview type</label>
          <select className="border rounded p-2" value={interviewType} onChange={(e) => setInterviewType(e.target.value)}>
            <option value="basic">basic</option>
            <option value="technical">technical</option>
            <option value="detailed">detailed</option>
          </select>
        </div>

        <div>
          <label className="block text-sm mb-1">Job description (pdf/doc/docx)</label>
          <input type="file" accept=".pdf,.doc,.docx" onChange={(e) => setJdFile(e.target.files?.[0] || null)} />
          <div className="text-xs text-slate-500 mt-1">10–20MB max</div>
        </div>

        <div>
          <label className="block text-sm mb-1">Manual questions (one per line)</label>
          <textarea className="border rounded p-2 w-full min-h-[160px]" value={manualQs} onChange={(e) => setManualQs(e.target.value)} />
        </div>

        <div className="flex gap-2">
          <button className="border px-4 py-1 rounded" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
          <button type="button" className="border px-4 py-1 rounded" onClick={() => nav('/roles')}>Cancel</button>
        </div>
      </form>
    </div>
  );
}
