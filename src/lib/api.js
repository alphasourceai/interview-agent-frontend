import { supabase } from './supabaseClient'
const base = import.meta.env.VITE_BACKEND_URL
async function authHeaders() {
  const { data: { session } } = await supabase.auth.getSession()
  const h = {}
  if (session?.access_token) h.Authorization = `Bearer ${session.access_token}`
  return h
}
export async function apiGet(path) {
  const res = await fetch(`${base}${path}`, { headers: await authHeaders() })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}
export async function apiPost(path, body) {
  const res = await fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
    body: JSON.stringify(body || {})
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}
export async function getSignedUrl(interviewId, kind) {
  const res = await api.get('/files/signed-url', { params: { interview_id: interviewId, kind } });
  return res.data.url;
}

// --- add at bottom of src/lib/api.js ---
export async function apiDownload(path, filename = 'report.pdf') {
  // assumes `api` is your configured axios instance that sets the Bearer token
  const res = await api.get(path, { responseType: 'blob' });
  const blob = new Blob([res.data], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
