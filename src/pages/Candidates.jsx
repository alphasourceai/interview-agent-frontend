// src/pages/Candidates.jsx
import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { supabase } from '../lib/supabaseClient'

async function getToken() {
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token || null
}

export default function Candidates() {
  const [clients, setClients] = useState([])
  const [clientId, setClientId] = useState('')
  const [items, setItems] = useState([])
  const [msg, setMsg] = useState('')
  const [loading, setLoading] = useState(true)

  async function load(cid) {
    setLoading(true)
    try {
      const { clients } = await api.getMyClients(getToken)
      setClients(clients || [])
      const useId = cid || clients?.[0]?.client_id || ''
      setClientId(useId)
      if (useId) {
        const { items } = await api.getDashboardInterviews(useId, getToken)
        setItems(items || [])
      }
    } catch (e) {
      setMsg(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-semibold mb-4">Candidates</h1>

      <div className="mb-4">
        <label className="block text-sm mb-1">Client</label>
        <select className="border rounded p-2" value={clientId} onChange={e=>load(e.target.value)}>
          {clients.map(c => <option key={c.client_id} value={c.client_id}>{c.client_name || c.client_id}</option>)}
        </select>
      </div>

      {loading ? <div>Loading…</div> : (
        <div className="border rounded">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50">
                <th className="p-2 text-left">Candidate</th>
                <th className="p-2 text-left">Role</th>
                <th className="p-2 text-left">Scores</th>
                <th className="p-2 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map(x => (
                <tr key={x.id} className="border-t align-top">
                  <td className="p-2">
                    <div>{x.candidate?.name || '(unknown)'}</div>
                    <div className="text-xs opacity-70">{x.candidate?.email}</div>
                    <div className="text-xs opacity-70">{new Date(x.created_at).toLocaleString()}</div>
                  </td>
                  <td className="p-2">{x.role?.title || '(n/a)'}</td>
                  <td className="p-2">
                    <div>Overall: {x.overall_score ?? '—'}</div>
                    <div className="text-xs">Resume: {x.resume_score ?? '—'} | Interview: {x.interview_score ?? '—'}</div>
                  </td>
                  <td className="p-2 space-x-2">
                    {x.has_transcript && (
                      <button className="border rounded px-2 py-1"
                        onClick={async () => {
                          try {
                            const r = await api.getSignedUrl(x.id, 'transcript', getToken)
                            window.open(r.url, '_blank')
                          } catch (e) { alert(e.message) }
                        }}>
                        Transcript
                      </button>
                    )}
                    <button className="border rounded px-2 py-1"
                      onClick={async () => {
                        try { await api.downloadReport(x.id, getToken) } catch (e) { alert(e.message) }
                      }}>
                      Download PDF
                    </button>
                  </td>
                </tr>
              ))}
              {items.length === 0 && <tr><td className="p-2" colSpan={4}>No interviews yet.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      {msg && <div className="mt-3 text-sm">{msg}</div>}
    </div>
  )
}
