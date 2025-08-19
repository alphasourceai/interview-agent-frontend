import { useEffect, useMemo, useState } from 'react'
import { apiGet } from '../lib/api'
import SignOutButton from '../components/SignOutButton.jsx'

export default function ClientDashboard() {
  const [me, setMe] = useState(null)
  const [clients, setClients] = useState([])       // { client_id, role, name }[]
  const [clientId, setClientId] = useState('')
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        setLoading(true)
        const [meResp, myClients] = await Promise.all([
          apiGet('/auth/me'),
          apiGet('/clients/my')
        ])
        if (!alive) return
        setMe(meResp)
        setClients(myClients.items || [])
        const first = (myClients.items?.[0]?.client_id) || (meResp.memberships?.[0]?.client_id) || ''
        setClientId(first)
      } catch (e) {
        setError(String(e))
      } finally {
        setLoading(false)
      }
    })()
    return () => { alive = false }
  }, [])

  useEffect(() => {
    if (!clientId) { setItems([]); return }
    let alive = true
    ;(async () => {
      try {
        setLoading(true)
        const qs = `?client_id=${encodeURIComponent(clientId)}`
        const { items } = await apiGet('/dashboard/interviews' + qs)
        if (!alive) return
        setItems(items || [])
      } catch (e) {
        setError(String(e))
      } finally {
        setLoading(false)
      }
    })()
    return () => { alive = false }
  }, [clientId])

  const hasMembership = (me?.memberships || []).length > 0
  const canInvite = hasMembership && (me?.memberships || []).some(m => ['owner','admin'].includes(m.role))
  const nameById = Object.fromEntries(clients.map(c => [c.client_id, c.name]))
  const roleById = Object.fromEntries(clients.map(c => [c.client_id, c.role]))
  const currentName = nameById[clientId] || clientId
  const currentRole = roleById[clientId] || (me?.memberships?.find(m => m.client_id === clientId)?.role) || 'member'

  const rows = useMemo(() => {
    return (items || []).map(r => ({
      id: r.id,
      created_at: new Date(r.created_at).toLocaleString(),
      role_title: r.role?.title || '—',
      has_video: r.has_video ? '✓' : '—',
      has_transcript: r.has_transcript ? '✓' : '—',
      has_analysis: r.has_analysis ? '✓' : '—',
      video_url: r.video_url || '',
      transcript_url: r.transcript_url || '',
      analysis_url: r.analysis_url || ''
    }))
  }, [items])

  return (
    <div style={{ padding: 24, fontFamily: 'system-ui', maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: 16 }}>
        <h1 style={{ margin: 0 }}>Dashboard</h1>
        <div style={{ display:'flex', gap: 8 }}>
          {canInvite && (
            <a
              href="/invite"
              style={{ textDecoration:'none', border:'1px solid #e5e7eb', padding:'8px 12px', borderRadius:8, background:'#f9fafb' }}>
              Invite teammate
            </a>
          )}
          <SignOutButton />
        </div>
      </div>

      {error && <div style={{ color: 'crimson', marginBottom: 16 }}>{error}</div>}

      {!hasMembership && (
        <div style={{ background: '#fff3cd', border: '1px solid #ffeeba', padding: 12, borderRadius: 8, marginBottom: 16 }}>
          You are signed in but not a member of any client yet. Ask an admin to invite you.
        </div>
      )}

      {hasMembership && (
        <div style={{ marginBottom: 16, display: 'flex', gap: 8, alignItems: 'center', flexWrap:'wrap' }}>
          <label htmlFor="clientSel">Client</label>
          <select
            id="clientSel"
            value={clientId}
            onChange={e => setClientId(e.target.value)}
            style={{ padding: 8 }}
          >
            {clients.map(c => (
              <option key={c.client_id} value={c.client_id}>
                {c.name} ({c.role})
              </option>
            ))}
          </select>
          <div style={{ color:'#6b7280' }}>
            Viewing: <strong>{currentName}</strong> &middot; Role: <strong>{currentRole}</strong>
          </div>
        </div>
      )}

      {loading && <div>Loading…</div>}

      {!loading && hasMembership && rows.length === 0 && (
        <div>No interviews yet for this client.</div>
      )}

      {!loading && rows.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={th}>Created</th>
                <th style={th}>Role</th>
                <th style={th}>Video</th>
                <th style={th}>Transcript</th>
                <th style={th}>Analysis</th>
                <th style={th}>Links</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id}>
                  <td style={td}>{r.created_at}</td>
                  <td style={td}>{r.role_title}</td>
                  <td style={td} title={r.video_url}>{r.has_video}</td>
                  <td style={td} title={r.transcript_url}>{r.has_transcript}</td>
                  <td style={td} title={r.analysis_url}>{r.has_analysis}</td>
                  <td style={td}>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {r.video_url && <a href={r.video_url} target="_blank" rel="noreferrer">Video</a>}
                      {r.transcript_url && <a href={r.transcript_url} target="_blank" rel="noreferrer">Transcript</a>}
                      {r.analysis_url && <a href={r.analysis_url} target="_blank" rel="noreferrer">Analysis</a>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

const th = { textAlign: 'left', borderBottom: '1px solid #e5e7eb', padding: '8px 6px' }
const td = { borderBottom: '1px solid #f1f5f9', padding: '8px 6px', verticalAlign: 'top' }
