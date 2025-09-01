// src/lib/api.js

// ---- Config ---------------------------------------------------------------
const BASE_RAW =
  (typeof import.meta !== 'undefined' &&
    import.meta.env &&
    (import.meta.env.VITE_BACKEND_URL || import.meta.env.VITE_API_BASE)) ||
  (typeof window !== 'undefined' && (window.__BACKEND_URL__ || window.__API_BASE__)) ||
  '';

function joinUrl(base, path) {
  if (!base) return path;
  if (base.endsWith('/') && path.startsWith('/')) return base.slice(0, -1) + path;
  if (!base.endsWith('/') && !path.startsWith('/')) return base + '/' + path;
  return base + path;
}

// ---- Auth header ----------------------------------------------------------

async function getAccessToken() {
  // 1) Explicit globals (handy for tests)
  if (typeof window !== 'undefined') {
    if (window.__AUTH_TOKEN__) return window.__AUTH_TOKEN__;
    if (window.__SB_TOKEN__) return window.__SB_TOKEN__;
  }

  // 2) Simple localStorage key you might set manually
  try {
    const direct = window?.localStorage?.getItem('sb-access-token');
    if (direct) return direct;
  } catch {}

  // 3) Parse Supabase auth key in localStorage (sb-<projectRef>-auth-token)
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      for (let i = 0; i < window.localStorage.length; i++) {
        const k = window.localStorage.key(i);
        if (k && /-auth-token$/.test(k)) {
          const raw = window.localStorage.getItem(k);
          try {
            const obj = JSON.parse(raw);
            const token =
              obj?.access_token ||
              obj?.currentSession?.access_token ||
              obj?.session?.access_token ||
              obj?.accessToken ||
              null;
            if (token) return token;
          } catch {}
        }
      }
    }
  } catch {}

  // 4) Ask your Supabase client directly (dynamic import to avoid cycles)
  try {
    const mod = await import('./supabaseClient');
    const supabase =
      mod?.supabase || mod?.default?.supabase || mod?.default || mod;

    if (supabase?.auth?.getSession) {
      const { data } = await supabase.auth.getSession();
      return data?.session?.access_token || null;
    }
  } catch {
    // swallow — module might not exist yet in some builds
  }

  return null;
}

async function getAuthHeaders() {
  const token = await getAccessToken();
  const h = {};
  if (token) h['Authorization'] = `Bearer ${token}`;
  return h;
}

// ---- Core Request Helpers -------------------------------------------------

async function coreRequest(
  path,
  { method = 'GET', body, headers, signal, raw } = {}
) {
  const url = joinUrl(BASE_RAW, path);

  const authHeaders = await getAuthHeaders();

  const init = {
    method,
    credentials: 'include',
    headers: {
      ...(body && !(body instanceof FormData)
        ? { 'Content-Type': 'application/json' }
        : {}),
      ...authHeaders,
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

// Low-level helpers
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

export async function apiDownload(path, filename = 'download') {
  const res = await coreRequest(path, { method: 'GET', raw: true });
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

export function apiUpload(path, fields = {}) {
  const fd = new FormData();
  Object.entries(fields).forEach(([k, v]) => {
    if (v !== undefined && v !== null) fd.append(k, v);
  });
  // coreRequest will add Authorization but NOT set content-type for FormData
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
// Note: your backend currently doesn't expose PUT/DELETE /roles/:id
// Keeping these for future parity—may 404 until implemented server-side.
export function updateRole(roleId, payload) {
  return apiPut(`/roles/${encodeURIComponent(roleId)}`, payload);
}
export function deleteRole(roleId) {
  return apiDel(`/roles/${encodeURIComponent(roleId)}`);
}
export function uploadRoleJD({ roleId, file, filename }) {
  // backend route is /roles-upload/upload-jd
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
export function getCandidatesByRole(roleId) {
  return apiGet(`/candidates/by-role/${encodeURIComponent(roleId)}`);
}

// OTP / Interviews
export function verifyOtp(payload) {
  return apiPost('/verify-otp', payload);
}
export function createInterview(payload) {
  return apiPost('/interviews', payload);
}
// New helper that matches the backend retry route
export function retryInterviewById(interviewId) {
  return apiPost(`/interviews/retry/${encodeURIComponent(interviewId)}/retry-create`, {});
}
// Back-compat (if some page posts to /interviews/retry with a body)
export function retryInterview(payload) {
  const id = payload?.id || payload?.interview_id;
  if (!id) throw new Error('retryInterview: interview id required');
  return retryInterviewById(id);
}

// ---- Default export + named 'api' (so pages can `import { api }`) ---------

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
  getCandidatesByRole,
  verifyOtp,
  createInterview,
  retryInterview,
  retryInterviewById,
};

// Support all import styles used across the app
export { api };
export default api;
export { api as Api };
export { apiGet, apiPost, apiPut, apiDel as apiDelete };
