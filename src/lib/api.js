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

// ---- Auth helper (best-effort) --------------------------------------------

async function getAccessToken() {
  try {
    // Preferred: window.supabase (if your app sets this)
    const maybeSupabase = typeof window !== 'undefined' ? window.supabase : null;
    if (maybeSupabase?.auth?.getSession) {
      const { data } = await maybeSupabase.auth.getSession();
      const tok = data?.session?.access_token || data?.session?.accessToken;
      if (tok) return tok;
    }

    // Fallback: scan localStorage for the sb-*-auth-token key Supabase uses
    if (typeof window !== 'undefined' && window.localStorage) {
      const key = Object.keys(localStorage).find(k => /sb-.*-auth-token$/.test(k));
      if (key) {
        const raw = localStorage.getItem(key);
        if (raw) {
          const parsed = JSON.parse(raw);
          // v2 format tends to have "currentSession"
          const tok =
            parsed?.currentSession?.access_token ||
            parsed?.access_token ||
            parsed?.session?.access_token;
          if (tok) return tok;
        }
      }
    }
  } catch {
    // ignore; we'll just send unauthenticated
  }
  return null;
}

// ---- Core Request Helpers -------------------------------------------------

async function coreRequest(path, { method = 'GET', body, headers, signal, raw } = {}) {
  const url = joinUrl(BASE_RAW, path);

  // Build headers; inject bearer token unless the caller already set one
  const initHeaders = {
    ...(body && !(body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
    ...(headers || {}),
  };

  const hasAuthHeader =
    initHeaders.authorization ||
    initHeaders.Authorization ||
    initHeaders['authorization'] ||
    initHeaders['Authorization'];

  if (!hasAuthHeader) {
    const token = await getAccessToken();
    if (token) initHeaders.Authorization = `Bearer ${token}`;
  }

  const init = {
    method,
    credentials: 'include',
    headers: initHeaders,
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

// ---- Low-level helpers ----------------------------------------------------

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
  // Backend route: /roles-upload/upload-jd
  const fd = new FormData();
  if (roleId) fd.append('role_id', roleId);
  if (filename) fd.append('filename', filename);
  if (file) fd.append('file', file);
  return coreRequest('/roles-upload/upload-jd', { method: 'POST', body: fd });
}

// Candidates
export async function getCandidates(clientId) {
  const q = clientId ? `?client_id=${encodeURIComponent(clientId)}` : '';
  // dashboard returns { items: [...] } — normalize to [] so pages can map safely
  const res = await apiGet(`/dashboard/candidates${q}`);
  return res?.items || [];
}


// OTP / Interviews
export function verifyOtp(payload)       { return apiPost('/verify-otp', payload); }
export function createInterview(payload) { return apiPost('/interviews', payload); }

// If you adopt the new BE route that takes an :id:
// export function retryInterview(id) { return apiPost(`/interviews/retry/${encodeURIComponent(id)}/retry-create`); }
export function retryInterview(payload)  { return apiPost('/interviews/retry', payload); } // legacy FE shape

// ---- Default export + named 'api' (compat) --------------------------------

const api = {
  // low-level
  get: apiGet, post: apiPost, put: apiPut, del: apiDel, download: apiDownload, upload: apiUpload,
  // domain
  getMyClient, getClientMembers,
  getRoles, createRole, updateRole, deleteRole, uploadRoleJD,
  getCandidates,
  verifyOtp, createInterview, retryInterview,
};

export { api };        // named
export default api;    // default
export { api as Api }; // alias used by some pages
