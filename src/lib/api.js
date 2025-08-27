// src/lib/api.js
import { supabase } from "./supabaseClient";

const BASE = (import.meta.env.VITE_BACKEND_URL || "").replace(/\/+$/, "");

async function getToken() {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token || null;
}

async function authedFetch(path, opts = {}) {
  const token = await getToken();
  const headers = new Headers(opts.headers || {});
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const url = path.startsWith("http") ? path : `${BASE}${path}`;
  return fetch(url, { ...opts, headers });
}

/* ---------- New structured API ---------- */

export const api = {
  async getRoles(clientId) {
    if (!clientId) return [];
    const res = await authedFetch(`/roles?client_id=${encodeURIComponent(clientId)}`);
    if (!res.ok) {
      // 403 when RLS/client-scope denies; don't crash the page
      if (res.status === 403) return [];
      throw new Error(`Roles failed: ${res.status}`);
    }
    const json = await res.json();
    return Array.isArray(json) ? json : (json.items || []);
  },

  async createRole({ clientId, title, interview_type, questions = [], jd_text, jd_file }) {
    if (!clientId) throw new Error("Missing clientId");

    // (A) If a file was provided, try the upload endpoint first
    if (jd_file) {
      const form = new FormData();
      form.append("client_id", clientId);
      form.append("title", title || "");
      form.append("interview_type", interview_type || "basic");
      form.append("questions", JSON.stringify(questions || []));
      form.append("jd_file", jd_file);

      const res = await authedFetch(`/roles/upload-jd`, { method: "POST", body: form });
      if (res.ok) return await res.json();

      // If file upload fails (e.g. bucket perm), fall back to text-only create
      console.warn("JD upload failed, falling back to text create.", res.status);
    }

    // (B) Text-based create
    const res2 = await authedFetch(`/roles`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: clientId,
        title,
        interview_type,
        questions,
        jd_text: jd_text || null,
      }),
    });
    if (!res2.ok) throw new Error(`Role create failed: ${res2.status}`);
    return await res2.json();
  },

  async listCandidates(clientId) {
    if (!clientId) return [];
    // Supports both the newer /dashboard/candidates and the legacy /dashboard/interviews
    let res = await authedFetch(`/dashboard/candidates?client_id=${encodeURIComponent(clientId)}`);
    if (res.status === 404) {
      res = await authedFetch(`/dashboard/interviews?client_id=${encodeURIComponent(clientId)}`);
    }
    if (!res.ok) throw new Error(`Candidates failed: ${res.status}`);
    const json = await res.json();
    return Array.isArray(json) ? json : (json.items || []);
  },

  async downloadReport(reportId) {
    if (!reportId) throw new Error("Missing reportId");
    const res = await authedFetch(`/reports/${encodeURIComponent(reportId)}/download`, {
      method: "GET",
    });
    if (!res.ok) throw new Error(`Report download failed: ${res.status}`);
    return await res.blob();
  },
};

/* ---------- Legacy helpers kept for backward-compat ---------- */

export async function apiGet(path) {
  const res = await authedFetch(path);
  if (!res.ok) throw new Error(`GET ${path} -> ${res.status}`);
  return res.json();
}
export async function apiPost(path, body) {
  const res = await authedFetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body || {}),
  });
  if (!res.ok) throw new Error(`POST ${path} -> ${res.status}`);
  return res.json();
}
/** Legacy "download" now returns a Blob (so callers can save it). */
export async function apiDownload(path) {
  const res = await authedFetch(path);
  if (!res.ok) throw new Error(`DOWNLOAD ${path} -> ${res.status}`);
  return res.blob();
}
