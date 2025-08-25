import { supabase } from "./supabaseClient";

async function getToken() {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token || null;
}

async function authedFetch(url, opts = {}) {
  const token = await getToken();
  const headers = new Headers(opts.headers || {});
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return fetch(url, { ...opts, headers });
}

const BASE = import.meta.env.VITE_BACKEND_URL;

// ---------- Low-level helpers (named exports) ----------
export async function apiGet(path) {
  const res = await authedFetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`GET ${path} failed (${res.status})`);
  return res.json();
}

export async function apiPost(path, body, asJson = true) {
  let opts = { method: "POST" };
  if (asJson) {
    opts.headers = { "Content-Type": "application/json" };
    opts.body = JSON.stringify(body || {});
  } else {
    opts.body = body; // e.g., FormData
  }
  const res = await authedFetch(`${BASE}${path}`, opts);
  if (res.status === 204) return null;
  const text = await res.text();
  let parsed = null;
  try { parsed = text ? JSON.parse(text) : null; } catch { parsed = text; }
  if (!res.ok) {
    const msg = parsed?.error || parsed?.message || `POST ${path} failed (${res.status})`;
    throw new Error(msg);
  }
  return parsed;
}

export async function apiDownload(path) {
  const res = await authedFetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`DOWNLOAD ${path} failed (${res.status})`);
  return res;
}

// Optional: add PUT/DELETE if needed later
export async function apiPut(path, body) {
  const res = await authedFetch(`${BASE}${path}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body || {}),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error || `PUT ${path} failed (${res.status})`);
  return json;
}

export async function apiDelete(path) {
  const res = await authedFetch(`${BASE}${path}`, { method: "DELETE" });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error || `DELETE ${path} failed (${res.status})`);
  return json;
}

// ---------- High-level helpers used by pages ----------
export const api = {
  roles: {
    async list({ client_id }) {
      const res = await authedFetch(`${BASE}/roles?client_id=${client_id}`);
      if (!res.ok) return [];
      const json = await res.json();
      return json.roles || json || [];
    },
    async uploadJD({ client_id, file }) {
      const form = new FormData();
      form.append("file", file);
      const res = await authedFetch(`${BASE}/roles/upload-jd?client_id=${client_id}`, {
        method: "POST",
        body: form,
      });
      if (!res.ok) return null;
      return res.json();
    },
    async create(body) {
      const res = await authedFetch(`${BASE}/roles`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) return null;
      const json = await res.json();
      return json.role || json;
    },
  },

  clients: {
    async my() {
      const res = await authedFetch(`${BASE}/clients/my`);
      if (!res.ok) return [];
      const json = await res.json();
      if (Array.isArray(json)) return json;
      if (Array.isArray(json.clients)) return json.clients;
      if (Array.isArray(json.items)) return json.items;
      if (Array.isArray(json.memberships)) {
        return json.memberships.map(m => ({
          id: m.client_id || m.id,
          name: m.name || m.client_name || m.client_id || m.id,
        }));
      }
      return [];
    },
  },

  async getMyClients() {
    const list = await this.clients.my();
    return list;
  },
};
