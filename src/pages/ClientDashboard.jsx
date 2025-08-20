import { useEffect, useMemo, useState } from 'react'
import { apiGet, apiDownload } from '../lib/api'
import SignOutButton from '../components/SignOutButton.jsx'

export default function ClientDashboard() {
  const [me, setMe] = useState(null)
  const [clients, setClients] = useState([])
  const [clientId, setClientId] = useState('')
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [opening, setOpening] = useState({})       // { [key]: boolean } e.g. "id:transcript", "id:pdf"
  const [expanded, setExpanded] = useState({})     // { [id]: boolean }

  // ---- helpers ----
  const pctText = (v) =>
    (typeof v === 'number' && isFinite(v)) || v === 0 ? `${Math.max(0, Math.min(100, v))}%` : '—'
  const fmtDate = (iso) => {
    try { return new Date(iso).toLocaleString() } catch { return iso || '—' }
  }

  function toggleRow(id) {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }))
  }

  async function openSigned(interviewId, kind) {
    const key = `${interviewId}:${kind}`
    try {
      setOpening(prev => ({ ...prev, [key]: true }))
      const qs = `?interview_id=${encodeURIComponent(interviewId)}&kind=${encodeURIComponent(kind)}`
      const { url } = await apiGet('/files/signed-url' + qs)
      if (!url) throw new Error('No signed URL returned')
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch (e) {
      setError(String(e?.message || e))
    } finally {
      setOpening(prev => ({ ...prev, [key]: false }))
    }
  }

  async function generatePdf(interviewId) {
    const key = `${interviewId}:pdf`
    try {
      setOpening(prev => ({ ...prev, [key]: true }))
       // Auto-download from backend (sends Authorization header via axios)
await apiDownload(
`/reports/${encodeURIComponent(interviewId)}/download`,
`Candidate_Report_${interviewId}.pdf`
)
    } catch (e) {
      setError(String(e?.message || e))
    } finally {
      setOpening(prev => ({ ...prev, [key]: false }))
    }
  }

  // ---- load user + clients ----
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

  // ---- load interviews for selected client ----
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
      created_at: r.created_at,
      // candidate block from API (safe defaults)
      candidate: {
        id: r.candidate?.id || null,
        name: r.candidate?.name || '',
        email: r.candidate?.email || ''
      },
      role: r.role || null,
      video_url: r.video_url || null,
      transcript_url: r.transcript_url || null,
      analysis_url: r.analysis_url || null,
      has_video: !!r.video_url,
      has_transcript: !!r.transcript_url,
      has_analysis: !!r.analysis_url,
      resume_score: r.resume_score ?? null,
      interview_score: r.interview_score ?? null,
      overall_score: r.overall_score ?? null,
      resume_analysis: {
        experience: r.resume_analysis?.experience ?? null,
        skills: r.resume_analysis?.skills ?? null,
        education: r.resume_analysis?.education ?? null,
        summary: r.resume_analysis?.summary || ''
      },
      interview_analysis: {
        clarity: r.interview_analysis?.clarity ?? null,
        confidence: r.interview_analysis?.confidence ?? null,
        body_language: r.interview_analysis?.body_language ?? null
      }
    }))
  }, [items])

  return (
    <div style={{ padding: 24, fontFamily: 'system-ui', maxWidth: 1200, margin: '0 auto' }}>
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
            Viewing: <strong>{currentName}</strong> · Role: <strong>{currentRole}</strong>
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
                <th style={{...th, width: 36}}></th>
                <th style={th}>Name</th>
                <th style={th}>Email</th>
                <th style={th}>Role</th>
                <th style={th}>Resume</th>
                <th style={th}>Interview</th>
                <th style={th}>Overall</th>
                <th style={th}>Created</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => {
                const trKey = `${r.id}:transcript`
                const pdfKey = `${r.id}:pdf`
                const opened = !!expanded[r.id]
                return (
                  <>
                    <tr key={r.id} style={{ background: opened ? '#f9fafb' : 'transparent' }}>
                      <td style={{ ...td, verticalAlign: 'top' }}>
                        <button
                          onClick={() => toggleRow(r.id)}
                          title={opened ? 'Collapse' : 'Expand'}
                          aria-label={opened ? 'Collapse' : 'Expand'}
                          style={{
                            ...btn,
                            width: 28,
                            height: 28,
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: 0
                          }}
                        >
                          <span style={{ display:'inline-block', transform: opened ? 'rotate(90deg)' : 'none', transition:'transform 120ms ease' }}>▶</span>
                        </button>
                      </td>
                      <td style={td}>
                        <div style={{ fontWeight: 600 }}>{r.candidate.name || '—'}</div>
                      </td>
                      <td style={td}>{r.candidate.email || '—'}</td>
                      <td style={td}>{r.role?.title || '—'}</td>
                      <td style={td}>{pctText(r.resume_score)}</td>
                      <td style={td}>{pctText(r.interview_score)}</td>
                      <td style={td}>{pctText(r.overall_score)}</td>
                      <td style={td}>{fmtDate(r.created_at)}</td>
                    </tr>

                    {opened && (
                      <tr>
                        <td style={td}></td>
                        <td style={{...td, paddingTop: 0}} colSpan={7}>
                          {/* expanded content */}
                          <div style={{ display:'grid', gap: 12 }}>
                            {/* actions */}
                            <div style={{ display:'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                              {r.video_url && (
                                <a href={r.video_url} target="_blank" rel="noreferrer" style={btn}>
                                  Video
                                </a>
                              )}
                              <button
                                onClick={() => openSigned(r.id, 'transcript')}
                                disabled={!r.has_transcript || !!opening[trKey]}
                                style={{
                                  ...btn,
                                  ...(r.has_transcript ? {} : disabledBtn),
                                  ...(opening[trKey] ? disabledBtn : {})
                                }}
                              >
                                {opening[trKey] ? 'Opening…' : 'Transcript'}
                              </button>
                              <button
                                onClick={() => generatePdf(r.id)}
                                disabled={!!opening[pdfKey]}
                                style={{ ...btn, ...(opening[pdfKey] ? disabledBtn : {}) }}
                              >
                                {opening[pdfKey] ? 'Generating…' : 'Download PDF'}
                              </button>
                            </div>

                            {/* resume analysis */}
                            <div style={{ display:'grid', gridTemplateColumns:'repeat(12,1fr)', gap: 12, marginTop: 8 }}>
                              <div style={{ gridColumn: 'span 6', border:'1px solid #e5e7eb', borderRadius: 12, padding: 12, background:'#fff' }}>
                                <div style={{ fontWeight: 600, marginBottom: 8 }}>Resume Analysis</div>
                                <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap: 8 }}>
                                  <Meter label="Experience" value={r.resume_analysis.experience} />
                                  <Meter label="Skills" value={r.resume_analysis.skills} />
                                  <Meter label="Education" value={r.resume_analysis.education} />
                                </div>
                                {r.resume_analysis.summary && (
                                  <div style={{ marginTop: 8, color:'#374151' }}>
                                    {r.resume_analysis.summary}
                                  </div>
                                )}
                              </div>

                              <div style={{ gridColumn: 'span 6', border:'1px solid #e5e7eb', borderRadius: 12, padding: 12, background:'#fff' }}>
                                <div style={{ fontWeight: 600, marginBottom: 8 }}>Interview Analysis</div>
                                <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap: 8 }}>
                                  <Meter label="Clarity" value={r.interview_analysis.clarity} />
                                  <Meter label="Confidence" value={r.interview_analysis.confidence} />
                                  <Meter label="Body Language" value={r.interview_analysis.body_language} />
                                </div>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ---- small presentational helpers ----
function Meter({ label, value }) {
  const pct = (typeof value === 'number' && isFinite(value)) || value === 0
    ? Math.max(0, Math.min(100, value))
    : null
  return (
    <div style={{ display:'grid', gap: 4 }}>
      <div style={{ display:'flex', justifyContent:'space-between', fontSize: 12, color:'#374151' }}>
        <span>{label}</span>
        <span style={{ fontWeight: 600, color:'#111827' }}>{pct === null ? '—' : `${pct}%`}</span>
      </div>
      <div style={{ height: 8, background:'#e5e7eb', borderRadius: 8, overflow:'hidden' }}>
        <div style={{ height: '100%', width: pct === null ? 0 : `${pct}%`, background:'#60a5fa' }} />
      </div>
    </div>
  )
}

const th = { textAlign: 'left', borderBottom: '1px solid #e5e7eb', padding: '8px 6px', whiteSpace:'nowrap' }
const td = { borderBottom: '1px solid #f1f5f9', padding: '8px 6px', verticalAlign: 'top' }
const btn = {
  border: '1px solid #e5e7eb',
  padding: '6px 10px',
  borderRadius: 6,
  background: '#f9fafb',
  cursor: 'pointer',
  textDecoration: 'none',
  display: 'inline-block'
}
const disabledBtn = { opacity: 0.6, cursor: 'not-allowed' }
