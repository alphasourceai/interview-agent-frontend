import { supabase } from './supabaseClient';

const base = import.meta.env.VITE_BACKEND_URL?.replace(/\/+$/, '') || '';

async function authHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  const h = {};
  if (session?.access_token) h.Authorization = `Bearer ${session.access_token}`;
  return h;
}

async function handleJson(res) {
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch {}
  if (!res.ok) {
    const msg = (data && (data.error || data.message)) || text || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

export async function apiGet(path) {
  const res = await fetch(`${base}${path}`, {
    headers: await authHeaders(),
    credentials: 'include'
  });
  return handleJson(res);
}

export async function apiPost(path, body) {
  const res = await fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
    body: JSON.stringify(body || {}),
    credentials: 'include'
  });
  return handleJson(res);
}

export async function apiDelete(path) {
  const res = await fetch(`${base}${path}`, {
    method: 'DELETE',
    headers: await authHeaders(),
    credentials: 'include'
  });
  return handleJson(res);
}

export async function getSignedUrl(interviewId, kind) {
  const qs = `?interview_id=${encodeURIComponent(interviewId)}&kind=${encodeURIComponent(kind)}`;
  const data = await apiGet(`/files/signed-url${qs}`);
  if (!data?.url) throw new Error('No signed URL returned');
  return data.url;
}

export async function apiDownload(path, filename = 'report.pdf') {
  const res = await fetch(`${base}${path}`, {
    method: 'GET',
    headers: await authHeaders(),
    credentials: 'include'
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function apiUpload(path, formData) {
  const res = await fetch(`${base}${path}`, {
    method: 'POST',
    headers: await authHeaders(),
    body: formData,
    credentials: 'include'
  });
  return handleJson(res);
}

export const api = {
  get: apiGet,
  post: apiPost,
  delete: apiDelete,
  download: apiDownload,
  getSignedUrl,
  upload: apiUpload,
};