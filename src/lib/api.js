// src/lib/api.js

// ---- Config ---------------------------------------------------------------
const BASE_RAW =
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_BACKEND_URL) ||
  (typeof window !== 'undefined' && window.__BACKEND_URL__) ||
  '';

function joinUrl(base, path) {
  if (!base) return path;
  if (base.endsWith('/') && path.startsWith('/')) return base.slice(1) + path;
  if (!base.endsWith('/') && !path.startsWith('/')) return base + '/' + path;
  return base + path;
}

// ---- Core Request Helpers -------------------------------------------------

async function coreRequest(path, { method = 'GET', body, headers, signal, raw } = {}) {
  const url = joinUrl(BASE_RAW, path);

  const init = {
    method,
    credentials: 'include', // include cookies (Supabase auth, etc.)
    headers: {
      ...(body && !(body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
      ...(headers || {}),
    },
    signal,
  };

  if (body !== undefined) {
    init.body = body instanceof FormData ? body : JSON.stringify(body);
  }

  const res = await fetch(url, init);

  // Non-2xx -> throw with some detail
  if (!res.ok) {
    // If caller wants the raw response, return it even if !ok
    if (raw) return res;

    let errText = '';
    try {
      const ct = res.headers.get('content-type') || '';
      if (ct.includes('application/json')) {
        const j = await res.json();
        errText = j?.error || JSON.stringify(j);
      } else {
        errText = await res.text();
      }
    } catch {
      /* ignore */
    }
    const e = new Error(errText || `HTTP ${res.status}`);
    e.status = res.status;
    throw e;
  }

  if (raw) return res;

  // Try to parse JSON when appropriate
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) return res.json();
  return res.text();
}

// Named HTTP helpers (some pages import these directly)
export function apiGet(path, opts) {
  return coreRequest(path, { method: 'GET', ...(opts || {}) });
}
export function apiPost(path, body, opts) {
  return coreRequest(path, { method: 'POST', body, ...(opts || {}) });
}
export function apiPut(path, body, opts) {
  return coreRequest(path, { method: 'PUT', body, ...(opts || {}) });
}
export function apiDel(path, opts) {
  return coreRequest(path, { method: 'DELETE', ...(opts || {}) });
}

// File download helper (saves Blob; caller decides how to handle it)
export async function apiDownload(path, filename = 'download') {
  const res = await coreRequest(path, { method: 'GET', raw: true });
  const blob = await res.blob();
  // Create a temporary link for download
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// Generic multipart upload (FormData)
export function apiUpload(path, fields = {}, fileField = 'file') {
  const fd = new FormData();
  Object.entries(fields).forEach(([k, v]) => {
    // allow File/Blob or primitive values
    if (v !== undefined && v !== null) fd.append(k, v);
  });
  return coreRequest(path, { method: 'POST', body: fd });
}

// ---- Domain Helpers used by pages -----------------------------------------

// Clients
export function getMyClient() {
  return apiGet('/clients/my');
}
export function getClientMembers(clientId) {
  const q = clientId ? `?client_id=${encodeURIComponent(clientId)}` : '';
  return apiGet(`/clients/members${q}`);
}

// Roles
export function getRoles(clientId) {
  const q = clientId ? `?client_id=${encodeURIComponent(clientId)}` : '';
  return apiGet(`/roles${q}`);
}
export function createRole(payload) {
  return apiPost('/roles', payload);
}
export function updateRole(roleId, payload) {
  return apiPut(`/roles/${encodeURIComponent(roleId)}`, payload);
}
export function deleteRole(roleId) {
  return apiDel(`/roles/${encodeURIComponent(roleId)}`);
}

// Role JD upload (if your backend expects multipart to /roles-upload)
export function uploadRoleJD({ roleId, file, filename }) {
  const path = '/roles-upload';
  const fd = new FormData();
  if (roleId) fd.append('role_id', roleId);
  if (filename) fd.append('filename', filename);
  if (file) fd.append('file', file);
  return coreRequest(path, { method: 'POST', body: fd });
}

// Candidates
export function getCandidates(clientId) {
  const q = clientId ? `?client_id=${encodeURIComponent(clientId)}` : '';
  return apiGet(`/candidates${q}`);
}

// Verify OTP (if used in your login flow)
export function verifyOtp(payload) {
  return apiPost('/verify-otp', payload);
}

// Interviews (Tavus)
export function createInterview(payload) {
  return apiPost('/interviews', payload);
}
export function retryInterview(payload) {
  return apiPost('/interviews/retry', payload);
}

// ---- Default export (legacy object style) ---------------------------------

const api = {
  // low-level
  get: apiGet,
  post: apiPost,
  put: apiPut,
  del: apiDel,
  download: apiDownload,
  upload: apiUpload,

  // domain
  getMyClient,
  getClientMembers,
  getRoles,
  createRole,
  updateRole,
  deleteRole,
  uploadRoleJD,
  getCandidates,
  verifyOtp,
  createInterview,
  retryInterview,
};

export default api;
