// src/pages/Roles.jsx
import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { supabase } from '../lib/supabaseClient'

async function getToken() {
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token || null
}

export default function Roles() {
  const [clients, setClients] = useState([])
  const [clientId, setClientId] = useState('')
  const [roles, setRoles] = useState([])
  const [title, setTitle] = useState('')
  const [interviewType, setInterviewType] = useState('basic')
  const [jobText, setJobText] = useState('')
  const [manualQs, setManualQs] = useState('')
  const [msg, setMsg] = useState('')
  const [loading, setLoading] = useState(true)

  async function loadClientsAndRoles(cid) {
    setLoading(true)
    try {
      const { clients } = await api.getMyClients(getToken)
      setClients(clients || [])
      const useId = cid || clients?.[0]?.client_id || ''
      setClientId(useId)
      if (useId) {
        const { roles } = await api.listRoles(useId, getToken)
        setRoles(roles || [])
      }
    } catch (e) {
      setMsg(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadClientsAndRoles() }, [])

  async function onCreate(e) {
    e.preventDefault()
    setMsg('')
    try {
      const payload = {
        client_id: clientId,
        title,
        interview_type: interviewType,
        job_description_text: jobText || undefined,
        manual_questions: manualQs ? manualQs.split('\n').map(s=>s.trim()).filter(Boolean) : [],
      }
      const res = await api.createRole(payload, getToken)
      setMsg(`Created: ${res?.role?.title || 'ok'}`)
      setTitle('')
      setJobText('')
      setManualQs('')
      await loadClientsAndRoles(clientId)
    } catch (e) {
      setMsg(e.message)
    }
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-semibold mb-4">Roles</h1>

      <div className="mb-4">
        <label className="block text-sm mb-1">Client</label>
        <select className="border rounded p-2" value={clientId} onChange={e=>loadClientsAndRoles(e.target.value)}>
          {clients.map(c => <option key={c.client_id} value={c.client_id}>{c.client_name || c.client_id}</option>)}
        </select>
      </div>

      <form onSubmit={onCreate} className="space-y-3 mb-8">
        <div>
          <label className="block text-sm mb-1">Role title</label>
          <input className="border rounded p-2 w-full" value={title} onChange={e=>setTitle(e.target.value)} required />
        </div>
        <div>
          <label className="block text-sm mb-1">Interview type</label>
          <select className="border rounded p-2" value={interviewType} onChange={e=>setInterviewType(e.target.value)}>
            <option value="basic">basic</option>
            <option value="detailed">detailed</option>
            <option value="technical">technical</option>
          </select>
        </div>
        <div>
          <label className="block text-sm mb-1">Job description (text)</label>
          <textarea className="border rounded p-2 w-full h-28" value={jobText} onChange={e=>setJobText(e.target.value)} />
        </div>
        <div>
          <label className="block text-sm mb-1">Manual questions (one per line)</label>
          <textarea className="border rounded p-2 w-full h-28" value={manualQs} onChange={e=>setManualQs(e.target.value)} />
        </div>
        <button className="border rounded px-4 py-2" disabled={!clientId || !title || loading}>
          Create role
        </button>
      </form>

      <h2 className="text-xl font-semibold mb-2">Existing roles</h2>
      {loading ? <div>Loading…</div> : (
        <div className="border rounded">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50">
                <th className="text-left p-2">Title</th>
                <th className="text-left p-2">Type</th>
                <th className="text-left p-2">Created</th>
              </tr>
            </thead>
            <tbody>
              {roles.map(r => (
                <tr key={r.id} className="border-t">
                  <td className="p-2">{r.title}</td>
                  <td className="p-2">{r.interview_type || 'basic'}</td>
                  <td className="p-2">{new Date(r.created_at).toLocaleString()}</td>
                </tr>
              ))}
              {roles.length === 0 && <tr><td className="p-2" colSpan={3}>No roles yet.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      {msg && <div className="mt-3 text-sm">{msg}</div>}
    </div>
  )
}
