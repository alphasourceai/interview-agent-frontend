// src/lib/api.js
// Unified API helpers that match existing call-sites across the app.
// Exports: { api, apiGet, apiPost, apiDownload }.
// Uses the shared Supabase client so we never create a second instance.

import { supabase } from "./supabaseClient";

const BASE = (import.meta.env.VITE_BACKEND_URL || "").replace(/\/+$/, "");

/* ------------------------------------------------------------------ */
/* Token + fetch helpers                                              */
/* ------------------------------------------------------------------ */

async function getToken() {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token || null;
}

async function authedFetch(path, opts = {}, tokenOverride) {
  const token = tokenOverride || (await getToken());
  const headers = new Headers(opts.headers || {});
  if (token) headers.set("Authorization", `Bearer ${token}`);
  // Only set Content-Type for non-FormData bodies
  if (!(opts.body instanceof FormData) && !headers.has("Content-Type") && opts.method && opts.method !== "GET") {
    headers.set("Content-Type", "application/json");
  }
  const url = path.startsWith("http") ? path : `${BASE}${path}`;
  return fetch(url, { ...opts, headers, credentials: "include" });
}

async function jsonOrThrow(res, msgPrefix = "Request failed") {
  const ct = res.headers.get("content-type") || "";
  if (!res.ok) {
    let msg = `${msgPrefix} (${res.status})`;
    try {
      if (ct.includes("application/json")) {
        const j = await res.json();
        msg = j.error || j.message || msg;
      } else {
        const t = await res.text();
        if (t) msg = t;
      }
    } catch {}
    throw new Error(msg);
  }
  return ct.includes("application/json") ? res.json() : res;
}

/* ------------------------------------------------------------------ */
/* Legacy convenience wrappers expected by multiple pages             */
/* ------------------------------------------------------------------ */

// GET that returns parsed JSON
export async function apiGet(path) {
  const res = await authedFetch(path, { method: "GET" });
  return jsonOrThrow(res, `GET ${path} failed`);
}

// POST JSON (or FormData) that returns parsed JSON
export async function apiPost(path, body) {
  const opts = {
    method: "POST",
    body: body instanceof FormData ? body : JSON.stringify(body ?? {}),
  };
  const res = await authedFetch(path, opts);
  return jsonOrThrow(res, `POST ${path} failed`);
}

// Start a browser download (redirects to signed URL). Returns void.
export async function apiDownload(path) {
  // Let the browser follow the 302 from the backend and download the file.
  if (typeof window !== "undefined") {
    window.location.href = path.startsWith("http") ? path : `${BASE}${path}`;
  }
}

/* ------------------------------------------------------------------ */
/* Structured API object used in Roles, Candidates, RoleCreator, etc. */
/* ------------------------------------------------------------------ */

export const api = {
  // Generic verbs (return parsed JSON)
  async get(path) {
    const res = await authedFetch(path, { method: "GET" });
    return jsonOrThrow(res, `GET ${path} failed`);
  },
  async post(path, body) {
    const opts = {
      method: "POST",
      body: body instanceof FormData ? body : JSON.stringify(body ?? {}),
    };
    const res = await authedFetch(path, opts);
    return jsonOrThrow(res, `POST ${path} failed`);
  },
  async put(path, body) {
    const res = await authedFetch(path, {
      method: "PUT",
      body: JSON.stringify(body ?? {}),
    });
    return jsonOrThrow(res, `PUT ${path} failed`);
  },
  async delete(path) {
    const res = await authedFetch(path, { method: "DELETE" });
    return jsonOrThrow(res, `DELETE ${path} failed`);
  },

  // RoleCreator.jsx expects these, optionally passing a token provider
  async getMe(getTokenFn) {
    const token = getTokenFn ? await getTokenFn() : null;
    const res = await authedFetch("/auth/me", { method: "GET" }, token || undefined);
    return jsonOrThrow(res, "GET /auth/me failed");
  },

  async getMyClients(getTokenFn) {
    const token = getTokenFn ? await getTokenFn() : null;
    const res = await authedFetch("/clients/my", { method: "GET" }, token || undefined);
    return jsonOrThrow(res, "GET /clients/my failed");
  },

  async createRole(payload, getTokenFn) {
    const token = getTokenFn ? await getTokenFn() : null;
    const res = await authedFetch("/roles", {
      method: "POST",
      body: JSON.stringify(payload || {}),
    }, token || undefined);
    return jsonOrThrow(res, "POST /roles failed");
  },
};

// Optional aliases if other files import different names (harmless to keep)
export const Api = api;
export default api;

// Also export internals for advanced callers/tests if needed
export { authedFetch };
