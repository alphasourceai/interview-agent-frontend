// src/lib/api.js
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

const BASE = import.meta.env.VITE_BACKEND_URL;

async function authedFetch(path, opts = {}) {
  const session = (await supabase.auth.getSession()).data.session;
  const token = session?.access_token;
  const headers = new Headers(opts.headers || {});
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (!headers.has('Content-Type') && !(opts.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  const res = await fetch(`${BASE}${path}`, { ...opts, headers, credentials: 'include' });
  if (!res.ok) {
    let msg = 'Request failed';
    try { const j = await res.json(); msg = j.error || msg; } catch {}
    throw new Error(msg);
  }
  return res.json().catch(() => ({}));
}

export const Api = {
  me: () => authedFetch('/auth/me'),
  myClients: () => authedFetch('/clients/my'),

  roles: (client_id) => authedFetch(`/roles?client_id=${encodeURIComponent(client_id)}`),
  createRole: (payload, client_id) =>
    authedFetch(`/roles?client_id=${encodeURIComponent(client_id)}`, {
      method: 'POST',
      body: JSON.stringify(payload)
    }),

  uploadRoleJD: async ({ client_id, role_id, file }) => {
    const fd = new FormData();
    fd.append('file', file);
    const session = (await supabase.auth.getSession()).data.session;
    const token = session?.access_token;
    const res = await fetch(
      `${BASE}/roles/upload-jd?client_id=${encodeURIComponent(client_id)}&role_id=${encodeURIComponent(role_id)}`,
      { method: 'POST', body: fd, headers: token ? { Authorization: `Bearer ${token}` } : {} }
    );
    if (!res.ok) {
      let msg = 'Upload failed';
      try { const j = await res.json(); msg = j.error || msg; } catch {}
      throw new Error(msg);
    }
    return res.json();
  },

  candidates: (client_id) =>
    authedFetch(`/dashboard/candidates?client_id=${encodeURIComponent(client_id)}`),

  downloadReport: async (reportId) => {
    // let the browser follow the redirect
    window.location.href = `${BASE}/reports/${encodeURIComponent(reportId)}/download`;
  },
};
