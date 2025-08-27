// src/lib/api.js
// Unified API helpers used across the app.
// Exports: { api, apiGet, apiPost, apiDownload }, plus default export = api.

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

  const hasBody = Object.prototype.hasOwnProperty.call(opts, "body");
  const isForm = hasBody && opts.body instanceof FormData;
  if (hasBody && !isForm && !headers.has("Content-Type")) {
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

export async function apiGet(path) {
  const res = await authedFetch(path, { method: "GET" });
  return jsonOrThrow(res, `GET ${path} failed`);
}

export async function apiPost(path, body) {
  const res = await authedFetch(path, {
    method: "POST",
    body: body instanceof FormData ? body : JSON.stringify(body ?? {}),
  });
  return jsonOrThrow(res, `POST ${path} failed`);
}

// Browser-followed download/redirect (no JSON expected)
export async function apiDownload(path) {
  if (typeof window !== "undefined") {
    window.location.href = path.startsWith("http") ? path : `${BASE}${path}`;
  }
}

/* ------------------------------------------------------------------ */
/* Structured API used in Roles, Candidates, RoleCreator, etc.        */
/* ------------------------------------------------------------------ */

export const api = {
  // Generic verbs that return parsed JSON
  async get(path) {
    const res = await authedFetch(path, { method: "GET" });
    return jsonOrThrow(res, `GET ${path} failed`);
  },
  async post(path, body) {
    const res = await authedFetch(path, {
      method: "POST",
      body: body instanceof FormData ? body : JSON.stringify(body ?? {}),
    });
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

  // RoleCreator.jsx expects these shape-wise (optionally passing a token provider)
  async getMe(getTokenFn) {
    const token = getTokenFn ? await getTokenFn() : undefined;
    const res = await authedFetch("/auth/me", { method: "GET" }, token);
    return jsonOrThrow(res, "GET /auth/me failed");
  },

  async getMyClients(getTokenFn) {
    const token = getTokenFn ? await getTokenFn() : undefined;
    const res = await authedFetch("/clients/my", { method: "GET" }, token);
    return jsonOrThrow(res, "GET /clients/my failed");
  },

  async createRole(payload, getTokenFn) {
    const token = getTokenFn ? await getTokenFn() : undefined;
    const res = await authedFetch(
      "/roles",
      { method: "POST", body: JSON.stringify(payload || {}) },
      token
    );
    return jsonOrThrow(res, "POST /roles failed");
  },
};

// Optional aliases; harmless if other files import different names
export const Api = api;
export default api;

// Also export internals for advanced callers/tests if needed
export { authedFetch };
