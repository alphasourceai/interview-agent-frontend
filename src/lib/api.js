// src/lib/api.js
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

const BASE = import.meta.env.VITE_BACKEND_URL;

async function authedFetch(path, opts = {}) {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;

  const headers = new Headers(opts.headers || {});
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const isFormData = opts.body instanceof FormData;
  if (!isFormData && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers,
    credentials: 'include',
  });

  // Let callers handle non-JSON (e.g., redirects) if needed
  const contentType = res.headers.get('content-type') || '';

  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      if (contentType.includes('application/json')) {
        const j = await res.json();
        message = j.error || j.message || message;
      } else {
        const t = await res.text();
        if (t) message = t;
      }
    } catch (_) {}
    throw new Error(message);
  }

  if (contentType.includes('application/json')) {
    return res.json();
  }
  return res; // caller can handle blobs/redirects if needed
}

/* ------------------------------------------------------------------ */
/* Convenience wrappers expected by legacy pages (e.g., AcceptInvite) */
/* ------------------------------------------------------------------ */

export function apiGet(path) {
  return authedFetch(path, { method: 'GET' });
}

export function apiPost(path, body) {
  return authedFetch(path, {
    method: 'POST',
    body: body instanceof FormData ? body : JSON.stringify(body ?? {}),
  });
}

/* -------------------------- High-level API ------------------------- */

export const Api = {
  me: () => authedFetch('/auth/me'),
  myClients: () => authedFetch('/clients/my'),

  roles: (client_id) =>
    authedFetch(`/roles?client_id=${encodeURIComponent(client_id)}`),

  createRole: (payload, client_id) =>
    authedFetch(`/roles?client_id=${encodeURIComponent(client_id)}`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  uploadRoleJD: async ({ client_id, role_id, file }) => {
    const fd = new FormData();
    fd.append('file', file);
    const { data } = await supabase.auth.getSession();
    const token = data?.session?.access_token;

    const res = await fetch(
      `${BASE}/roles/upload-jd?client_id=${encodeURIComponent(
        client_id
      )}&role_id=${encodeURIComponent(role_id)}`,
      {
        method: 'POST',
        body: fd,
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        credentials: 'include',
      }
    );

    if (!res.ok) {
      let msg = 'Upload failed';
      try {
        const j = await res.json();
        msg = j.error || j.message || msg;
      } catch (_) {}
      throw new Error(msg);
    }
    return res.json();
  },

  candidates: (client_id) =>
    authedFetch(
      `/dashboard/candidates?client_id=${encodeURIComponent(client_id)}`
    ),

  downloadReport: async (reportId) => {
    window.location.href = `${BASE}/reports/${encodeURIComponent(
      reportId
    )}/download`;
  },
};

export default Api;
