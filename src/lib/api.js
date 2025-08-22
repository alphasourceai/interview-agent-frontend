// chore: mvp-hardening-frontend-v3 (no-op)
// src/lib/api.js
import { supabase } from './supabaseClient'

const base = (import.meta.env.VITE_BACKEND_URL || '').replace(/\/+$/, '')

async function getToken() {
  const { data } = await supabase.auth.getSession()
  return data?.session?.access_token || null
}

async function authHeader() {
  const token = await getToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

function fullUrl(path) {
  if (!path) return base
  if (/^https?:\/\//i.test(path)) return path
  return `${base}${path.startsWith('/') ? path : `/${path}`}`
}

async function fetchJSON(path, { method = 'GET', body, headers = {} } = {}) {
  const url = fullUrl(path)
  const h = {
    'Content-Type': 'application/json',
    ...(await authHeader()),
    ...headers,
  }
  const res = await fetch(url, { method, headers: h, body: body ? JSON.stringify(body) : undefined })
  if (!res.ok) {
    let msg = `${res.status} ${res.statusText}`
    try { const j = await res.json(); if (j?.error) msg = j.error } catch {}
    throw new Error(msg)
  }
  const ct = res.headers.get('content-type') || ''
  return ct.includes('application/json') ? res.json() : res.text()
}

/* -------- Legacy helpers exported for backward compatibility -------- */
export async function apiGet(path) {
  return fetchJSON(path, { method: 'GET' })
}

export async function apiPost(path, body) {
  return fetchJSON(path, { method: 'POST', body })
}

export async function apiDownload(path, filename) {
  const url = fullUrl(path)
  const headers = await authHeader()
  const res = await fetch(url, { headers })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  const blob = await res.blob()
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename || (url.split('/').pop() || 'download')
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(a.href)
}

/* ---------------- New structured API (can be used gradually) ---------------- */
export const api = {
  // Auth / clients
  getMe: () => apiGet('/auth/me'),
  getMyClients: () => apiGet('/clients/my'),

  // Dashboard
  getDashboardInterviews: (clientId) =>
    apiGet(`/dashboard/interviews?client_id=${encodeURIComponent(clientId)}`),

  // Roles
  createRole: (payload) => apiPost('/roles', payload),
  listRoles: (clientId) => apiGet(`/roles?client_id=${encodeURIComponent(clientId)}`),

  // Files (signed URLs)
  getSignedUrl: (interviewId, kind) =>
    apiGet(`/files/signed-url?interview_id=${encodeURIComponent(interviewId)}&kind=${encodeURIComponent(kind)}`),

  // Reports
  generateReport: (interviewId) => apiGet(`/reports/${encodeURIComponent(interviewId)}/generate`),
  downloadReport: (interviewId) => apiDownload(`/reports/${encodeURIComponent(interviewId)}/download`),

  // Invites + Members
  createInvite: (payload) => apiPost('/clients/invite', payload),
  acceptInvite: (payload) => apiPost('/clients/accept-invite', payload),
  getMembers: (clientId) => apiGet(`/clients/members?client_id=${encodeURIComponent(clientId)}`),
  revokeMember: (payload) => apiPost('/clients/members/revoke', payload),
}
