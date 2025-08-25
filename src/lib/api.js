import { supabase } from "./supabaseClient";

async function authedFetch(url, opts = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  const headers = new Headers(opts.headers || {});
  if (session?.access_token) headers.set("Authorization", `Bearer ${session.access_token}`);
  return fetch(url, { ...opts, headers });
}

// legacy helpers preserved
export async function apiGet(path) {
  const res = await authedFetch(`${import.meta.env.VITE_BACKEND_URL}${path}`);
  if (!res.ok) throw new Error(`GET ${path} failed`);
  return res.json();
}

export async function apiDownload(path) {
  const res = await authedFetch(`${import.meta.env.VITE_BACKEND_URL}${path}`);
  if (!res.ok) throw new Error(`DOWNLOAD ${path} failed`);
  return res;
}

export const api = {
  // ----- ROLES -----
  roles: {
    async list({ client_id }) {
      const res = await authedFetch(`${import.meta.env.VITE_BACKEND_URL}/roles?client_id=${client_id}`);
      if (!res.ok) return [];
      const json = await res.json();
      return json.roles || json || [];
    },
    async uploadJD({ client_id, file }) {
      const form = new FormData();
      form.append("file", file);
      const res = await authedFetch(
        `${import.meta.env.VITE_BACKEND_URL}/roles/upload-jd?client_id=${client_id}`,
        { method: "POST", body: form }
      );
      if (!res.ok) return null;
      return res.json();
    },
    async create(body) {
      const res = await authedFetch(`${import.meta.env.VITE_BACKEND_URL}/roles`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) return null;
      const json = await res.json();
      return json.role || json;
    },
  },

  // ----- CLIENTS (new) -----
  clients: {
    async my() {
      const res = await authedFetch(`${import.meta.env.VITE_BACKEND_URL}/clients/my`);
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

  // ----- LEGACY: api.getMyClients(getToken?) -----
  // Some pages still call api.getMyClients(getToken). We ignore the arg and return a simple array.
  async getMyClients() {
    const list = await this.clients.my();
    return list;
  },
};
