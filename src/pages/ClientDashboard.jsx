import { useEffect, useMemo, useState } from 'react'
import { apiGet } from '../lib/api'

export default function ClientDashboard() {
  const [me, setMe] = useState(null)
  const [clientId, setClientId] = useState('')
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        setLoading(true)
        const meResp = await apiGet('/auth/me')
        if (!alive) return
        setMe(meResp)
        const first = meResp.memberships?.[0]?.client_id || ''
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
        const { items } = await apiGet('/dashboard/interviews?client_id=' + encodeURIComponent(clientId))
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

  const members = me?.memberships || []
  const hasMembership = members.length > 0

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
    <div style={{ padding: 24, fontFamily: 'system-ui', maxWidth: 1000, margin: '0 auto' }}>
      <h1 style={{ marginBottom: 16 }}>Dashboard</h1>

      {error && <div style={{ color: 'crimson', marginBottom: 16 }}>{error}</div>}

      {!hasMembership && (
        <div style={{ background: '#fff3cd', border: '1px solid #ffeeba', padding: 12, borderRadius: 8, marginBottom: 16 }}>
          You are signed in but not a member of any client yet. Ask an admin to invite you.
        </div>
      )}

      {hasMembership && (
        <div style={{ marginBottom: 16, display: 'flex', gap: 8, alignItems: 'center' }}>
          <label htmlFor="clientSel">Client</label>
          <select id="clientSel" value={clientId} onChange={e => setClientId(e.target.value)} style={{ padding: 8 }}>
            {members.map(m => (
              <option key={m.client_id} value={m.client_id}>
                {m.client_id} ({m.role})
              </option>
            ))}
          </select>
        </div>
      )}

      {loading && <div>Loading…</div>}

      {!loading && hasMembership && rows.length === 0 && <div>No interviews yet for this client.</div>}

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
