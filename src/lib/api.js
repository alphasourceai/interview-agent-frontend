// src/lib/api.js

// ---- Config ---------------------------------------------------------------
const BASE_RAW =
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_BACKEND_URL) ||
  (typeof window !== 'undefined' && window.__BACKEND_URL__) ||
  '';

function joinUrl(base, path) {
  if (!base) return path;
  if (base.endsWith('/') && path.startsWith('/')) return base.slice(0, -1) + path;
  if (!base.endsWith('/') && !path.startsWith('/')) return base + '/' + path;
  return base + path;
}

// ---- Core Request Helpers -------------------------------------------------

async function coreRequest(path, { method = 'GET', body, headers, signal, raw } = {}) {
  const url = joinUrl(BASE_RAW, path);

  const init = {
    method,
    credentials: 'include',
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

  if (!res.ok) {
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
    } catch {}
    const e = new Error(errText || `HTTP ${res.status}`);
    e.status = res.status;
    throw e;
  }

  if (raw) return res;

  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) return res.json();
  return res.text();
}

// Low-level helpers (named exports at definition — do not re-export again)
export function apiGet(path, opts)                { return coreRequest(path, { method: 'GET',    ...(opts || {}) }); }
export function apiPost(path, body, opts)         { return coreRequest(path, { method: 'POST',   body, ...(opts || {}) }); }
export function apiPut(path, body, opts)          { return coreRequest(path, { method: 'PUT',    body, ...(opts || {}) }); }
export function apiDel(path, opts)                { return coreRequest(path, { method: 'DELETE', ...(opts || {}) }); }
export async function apiDownload(path, filename = 'download') {
  const res = await coreRequest(path, { method: 'GET', raw: true });
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}
export function apiUpload(path, fields = {}) {
  const fd = new FormData();
  Object.entries(fields).forEach(([k, v]) => {
    if (v !== undefined && v !== null) fd.append(k, v);
  });
  return coreRequest(path, { method: 'POST', body: fd });
}

// ---- Domain Helpers -------------------------------------------------------

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
export function uploadRoleJD({ roleId, file, filename }) {
  // Match backend route: /roles-upload/upload-jd
  const fd = new FormData();
  if (roleId) fd.append('role_id', roleId);
  if (filename) fd.append('filename', filename);
  if (file) fd.append('file', file);
  return coreRequest('/roles-upload/upload-jd', { method: 'POST', body: fd });
}

// Candidates
export function getCandidates(clientId) {
  const q = clientId ? `?client_id=${encodeURIComponent(clientId)}` : '';
  return apiGet(`/candidates${q}`);
}

// OTP / Interviews
export function verifyOtp(payload)        { return apiPost('/verify-otp', payload); }
export function createInterview(payload)  { return apiPost('/interviews', payload); }
// If you need retry-by-id later, build the URL with the id (current BE expects /interviews/retry/:id/retry-create)
// export function retryInterview(id)     { return apiPost(`/interviews/retry/${encodeURIComponent(id)}/retry-create`); }
export function retryInterview(payload)   { return apiPost('/interviews/retry', payload); } // keeps prior FE shape if used

// ---- Default export + named 'api' (so pages can `import { api }`) ---------

const api = {
  // low-level
  get: apiGet, post: apiPost, put: apiPut, del: apiDel, download: apiDownload, upload: apiUpload,
  // domain
  getMyClient, getClientMembers,
  getRoles, createRole, updateRole, deleteRole, uploadRoleJD,
  getCandidates,
  verifyOtp, createInterview, retryInterview,
};

export { api };       // named export
export default api;   // default export
export { api as Api } // alias used by some pages
