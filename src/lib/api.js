// src/lib/api.js
const base = (import.meta.env.VITE_BACKEND_URL || '').replace(/\/+$/, '')

async function authHeader(getToken) {
  const token = await getToken?.()
  return token ? { Authorization: `Bearer ${token}` } : {}
}
async function fetchJSON(path, { method = 'GET', body, headers = {}, getToken } = {}) {
  const url = `${base}${path.startsWith('/') ? path : `/${path}`}`
  const h = {
    'Content-Type': 'application/json',
    ...(await authHeader(getToken)),
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

export const api = {
  // Auth / clients
  getMe: (getToken) => fetchJSON('/auth/me', { getToken }),
  getMyClients: (getToken) => fetchJSON('/clients/my', { getToken }),

  // Dashboard
  getDashboardInterviews: (clientId, getToken) =>
    fetchJSON(`/dashboard/interviews?client_id=${encodeURIComponent(clientId)}`, { getToken }),

  // Roles
  createRole: (payload, getToken) =>
    fetchJSON('/roles', { method: 'POST', body: payload, getToken }),
  listRoles: (clientId, getToken) =>
    fetchJSON(`/roles?client_id=${encodeURIComponent(clientId)}`, { getToken }),

  // Files (signed URLs)
  getSignedUrl: (interviewId, kind, getToken) =>
    fetchJSON(`/files/signed-url?interview_id=${encodeURIComponent(interviewId)}&kind=${encodeURIComponent(kind)}`, { getToken }),

  // Reports
  generateReport: (interviewId, getToken) =>
    fetchJSON(`/reports/${encodeURIComponent(interviewId)}/generate`, { getToken }),
  async downloadReport(interviewId, getToken) {
    const url = `${base}/reports/${encodeURIComponent(interviewId)}/download`
    const headers = await authHeader(getToken)
    const res = await fetch(url, { headers })
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
    const blob = await res.blob()
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `report-${interviewId}.pdf`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(a.href)
  },

  // Invites + Members
  createInvite: (payload, getToken) =>
    fetchJSON('/clients/invite', { method: 'POST', body: payload, getToken }),
  acceptInvite: (payload, getToken) =>
    fetchJSON('/clients/accept-invite', { method: 'POST', body: payload, getToken }),
  getMembers: (clientId, getToken) =>
    fetchJSON(`/clients/members?client_id=${encodeURIComponent(clientId)}`, { getToken }),
  revokeMember: (payload, getToken) =>
    fetchJSON('/clients/members/revoke', { method: 'POST', body: payload, getToken }),
}
