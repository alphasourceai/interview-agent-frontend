import { supabase } from './supabaseClient'
const base = import.meta.env.VITE_BACKEND_URL
async function authHeaders() {
  const { data: { session } } = await supabase.auth.getSession()
  const h = {}
  if (session?.access_token) h.Authorization = `Bearer ${session.access_token}`
  return h
}
export async function apiGet(path) {
  const res = await fetch(`${base}${path}`, { headers: await authHeaders() })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}
export async function apiPost(path, body) {
  const res = await fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
    body: JSON.stringify(body || {})
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}
