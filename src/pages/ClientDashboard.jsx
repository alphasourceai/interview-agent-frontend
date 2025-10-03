// src/pages/ClientDashboard.jsx
import { useEffect, useMemo, useState } from 'react'
import { apiGet, apiDownload } from '../lib/api'
import SignOutButton from '../components/SignOutButton.jsx'
import '../styles/clientDashboard.css';

// --- Dashboard enhancements: sorting, filtering, tooltips (no summaries) ---
const TIPS = {
  experience: 'How well prior roles align with the job requirements.',
  skills: 'Match between hard/soft skills and the role’s needs.',
  education: 'Relevance and level of education for the role.',
  clarity: 'How clearly the candidate communicates ideas.',
  confidence: 'Apparent confidence and composure while answering.',
  body_language: 'Non-verbal cues such as posture and eye contact.'
};

function SortIcon({ dir }) {
  return <span style={{ marginLeft: 6, opacity: 0.8 }}>{dir === 'asc' ? '▲' : '▼'}</span>;
}

function HeaderButton({ label, active, dir, onClick }) {
  return (
    <button
      onClick={onClick}
      className="btn lilac"
      style={{
        ...btn,
        background: active ? '#AD8BF7' : '#f9fafb',
        color: active ? '#fff' : '#111',
        borderColor: active ? '#AD8BF7' : '#e5e7eb',
        padding: '4px 8px'
      }}
      title={`Sort by ${label}`}
      aria-pressed={active}
    >
      <span>{label}</span>
      {active && <SortIcon dir={dir} />}
    </button>
  );
}

function InfoTip({ text }) {
  const [open, setOpen] = useState(false);
  const [flip, setFlip] = useState(false);
  const wrapRef = useState(null)[0] || (typeof document !== 'undefined' ? { current: null } : null);
  const ref = wrapRef || { current: null };

  // ensure we have a stable ref object
  if (!wrapRef || !wrapRef.current) {
    // noop; TextEdit context may not allow creating refs outside render, so we'll use a lazy init below
  }

  const setWrapRef = (el) => {
    // store element so we can measure on hover
    if (ref) ref.current = el;
  };

  const onEnter = () => {
    setOpen(true);
    // next frame: measure and flip if overflowing to the right
    requestAnimationFrame(() => {
      const el = ref?.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const TOOLTIP_W = 260; // keep in sync with style maxWidth
      const overflowRight = rect.right + TOOLTIP_W + 16 > window.innerWidth; // + some padding
      setFlip(overflowRight);
    });
  };

  return (
    <span
      ref={setWrapRef}
      style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}
      onMouseEnter={onEnter}
      onMouseLeave={() => setOpen(false)}
      onFocus={onEnter}
      onBlur={() => setOpen(false)}
    >
      <span
        aria-hidden="true"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 14,
          height: 14,
          borderRadius: 999,
          fontSize: 10,
          background: '#AD8BF7',
          color: '#fff',
          marginLeft: 6,
          cursor: 'help'
        }}
      >
        i
      </span>
      {open && (
        <span
          role="tooltip"
          style={{
            position: 'absolute',
            top: -8,
            left: flip ? 'auto' : 12,
            right: flip ? 12 : 'auto',
            transform: 'translateY(-100%)',
            background: '#111827',
            color: '#EBFEFF',
            border: '1px solid rgba(255,255,255,0.14)',
            borderRadius: 8,
            padding: '8px 10px',
            whiteSpace: 'normal',
            fontSize: 12,
            zIndex: 50,
            maxWidth: 260,
            boxShadow: '0 6px 18px rgba(0,0,0,0.3)'
          }}
        >
          {text}
        </span>
      )}
    </span>
  );
}

export default function ClientDashboard() {
  const [me, setMe] = useState(null)
  const [clients, setClients] = useState([])
  const [clientId, setClientId] = useState('')
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [opening, setOpening] = useState({})
  const [expanded, setExpanded] = useState({})

  // sort & filter UI state
  const [sortBy, setSortBy] = useState('created'); // 'name' | 'role' | 'created'
  const [sortDir, setSortDir] = useState('desc');  // 'asc' | 'desc'
  const [roleFilter, setRoleFilter] = useState(''); // role title or ''
  const [minOverall, setMinOverall] = useState(''); // numeric (string input)

  const hasMembership = (me?.memberships || []).length > 0
  const canInvite =
    hasMembership &&
    (me?.memberships || []).some(m => ['owner', 'admin'].includes(m.role))

  const nameById = useMemo(
    () => Object.fromEntries(clients.map(c => [c.client_id, c.name])),
    [clients]
  )
  const roleById = useMemo(
    () => Object.fromEntries(clients.map(c => [c.client_id, c.role])),
    [clients]
  )
  const currentName = nameById[clientId] || clientId
  const currentRole =
    roleById[clientId] ||
    (me?.memberships || []).find(m => m.client_id === clientId)?.role ||
    'member'

  const pctText = (v) =>
    (typeof v === 'number' && isFinite(v)) || v === 0
      ? `${Math.max(0, Math.min(100, v))}%`
      : '—'
  const fmtDate = (iso) => {
    try {
      return new Date(iso).toLocaleString()
    } catch {
      return iso || '—'
    }
  }

  function toggleRow(id) {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }))
  }

  async function openSigned(interviewId, kind) {
    if (!interviewId) return
    const key = `${interviewId}:${kind}`
    try {
      setOpening(p => ({ ...p, [key]: true }))
      const qs =
        `?interview_id=${encodeURIComponent(interviewId)}&kind=${encodeURIComponent(kind)}`
      const { url } = await apiGet('/files/signed-url' + qs)
      if (!url) throw new Error('No signed URL returned')
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch (e) {
      setError(String(e?.message || e))
    } finally {
      setOpening(p => ({ ...p, [key]: false }))
    }
  }

  async function generatePdf(interviewId) {
    if (!interviewId) return
    const key = `${interviewId}:pdf`
    try {
      setOpening(p => ({ ...p, [key]: true }))
      await apiDownload(
        `/reports/${encodeURIComponent(interviewId)}/download`,
        `Candidate_Report_${interviewId}.pdf`
      )
    } catch (e) {
      setError(String(e?.message || e))
    } finally {
      setOpening(p => ({ ...p, [key]: false }))
    }
  }

  // Load me + clients
  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        setLoading(true)
        const [meResp, myClients] = await Promise.all([
          apiGet('/auth/me'),
          apiGet('/clients/my'),
        ])
        if (!alive) return
        setMe(meResp)
        const list = myClients?.items || []
        setClients(list)
        const first =
          list[0]?.client_id ||
          meResp.memberships?.[0]?.client_id ||
          ''
        setClientId(first)
      } catch (e) {
        setError(String(e?.message || e))
      } finally {
        setLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [])

  // Load candidate-centric rows for selected client
  useEffect(() => {
    if (!clientId) {
      setItems([])
      return
    }
    let alive = true
    ;(async () => {
      try {
        setLoading(true)
        const qs = `?client_id=${encodeURIComponent(clientId)}`
        const resp = await apiGet('/dashboard/rows' + qs)
        const raw = resp?.items || []

        const scrubbed = (raw || []).filter(r => r && r.id) // basic sanity

        console.debug('[dashboard] fetched rows:', {
          requestedClientId: clientId,
          rawCount: raw.length,
          scrubbedCount: scrubbed.length,
          sample: scrubbed.slice(0, 3),
        })

        if (!alive) return
        setItems(scrubbed)
      } catch (e) {
        setError(String(e?.message || e))
      } finally {
        setLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [clientId])

  // Normalize for table
  const rows = useMemo(() => {
    return (items || []).map(r => ({
      id: r.id, // candidate id
      created_at: r.created_at,
      latest_interview_id: r.latest_interview_id || null,
      latest_report_url: r.latest_report_url || null,

      candidate: {
        id: r.candidate?.id || null,
        name: r.candidate?.name || '',
        email: r.candidate?.email || '',
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
        summary: r.resume_analysis?.summary || '',
      },
      interview_analysis: {
        clarity: r.interview_analysis?.clarity ?? null,
        confidence: r.interview_analysis?.confidence ?? null,
        body_language: r.interview_analysis?.body_language ?? null,
      },
    }))
  }, [items])

  // unique role titles available in current rows
  const availableRoles = useMemo(() => {
    const set = new Set((rows || []).map(r => r.role?.title).filter(Boolean));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [rows]);

  // apply filters + sorting
  const displayRows = useMemo(() => {
    let out = [...(rows || [])];

    // filter by role title
    if (roleFilter) {
      out = out.filter(r => (r.role?.title || '') === roleFilter);
    }
    // filter by min overall score
    const min = parseInt(minOverall, 10);
    if (!Number.isNaN(min)) {
      out = out.filter(r => {
        const v = typeof r.overall_score === 'number' ? r.overall_score : -1;
        return v >= min;
      });
    }

    // sorting
    out.sort((a, b) => {
      let av, bv;
      if (sortBy === 'name') {
        av = (a.candidate.name || '').toLowerCase();
        bv = (b.candidate.name || '').toLowerCase();
        if (av < bv) return sortDir === 'asc' ? -1 : 1;
        if (av > bv) return sortDir === 'asc' ? 1 : -1;
        return 0;
      } else if (sortBy === 'role') {
        av = (a.role?.title || '').toLowerCase();
        bv = (b.role?.title || '').toLowerCase();
        if (av < bv) return sortDir === 'asc' ? -1 : 1;
        if (av > bv) return sortDir === 'asc' ? 1 : -1;
        return 0;
      } else {
        // created
        av = new Date(a.created_at || 0).getTime();
        bv = new Date(b.created_at || 0).getTime();
        return sortDir === 'asc' ? av - bv : bv - av;
      }
    });

    return out;
  }, [rows, roleFilter, minOverall, sortBy, sortDir]);

  return (
    <div className="client-dash" style={{ padding: 24, fontFamily: 'system-ui', maxWidth: 1200, margin: '0 auto' }}>
      <div className="dash-head">
        <h1 style={{ margin: 0 }}>Dashboard</h1>
        <div className="dash-actions">
          {canInvite && (
            <a
              href="/invite"
              style={{
                textDecoration:'none',
                border:'1px solid #e5e7eb',
                padding:'8px 12px',
                borderRadius:8,
                background:'#f9fafb'
              }}
            >
              Invite teammate
            </a>
          )}
          <SignOutButton />
        </div>
      </div>

      {error && <div style={{ color: 'crimson', marginBottom: 16 }}>{error}</div>}

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

      {/* Filters: Role + Min Overall */}
      <div className="filters">
        <div style={{ fontWeight: 600, opacity: 0.9, marginRight: 4 }}>Filters:</div>
        <div style={{ display:'flex', alignItems:'center', gap: 6 }}>
          <label htmlFor="roleFilter">Role</label>
          <select
            id="roleFilter"
            value={roleFilter}
            onChange={e => setRoleFilter(e.target.value)}
            style={{ padding: 8 }}
          >
            <option value="">All roles</option>
            {availableRoles.map(r => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>

        <div style={{ display:'flex', alignItems:'center', gap: 6 }}>
          <label htmlFor="minOverall">Min overall</label>
          <input
            id="minOverall"
            type="number"
            min={0}
            max={100}
            step={1}
            placeholder="e.g. 70"
            value={minOverall}
            onChange={e => setMinOverall(e.target.value)}
            style={{ padding: 8, width: 90 }}
          />
          {minOverall !== '' && (
            <button
              type="button"
              onClick={() => setMinOverall('')}
              className="btn lilac"
              style={{ ...btn, background:'#AD8BF7', color:'#fff', borderColor:'#AD8BF7' }}
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {!hasMembership && !loading && (
        <div
          style={{
            background: '#fff3cd',
            border: '1px solid #ffeeba',
            padding: 12,
            borderRadius: 8,
            marginTop: 8
          }}
        >
          You are signed in but not a member of any client yet.
        </div>
      )}

      {loading && <div>Loading…</div>}

      {!loading && displayRows.length === 0 && <div>No rows yet.</div>}

      {!loading && displayRows.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{...th, width: 36}}></th>
                <th style={th}>
                  <HeaderButton
                    label="Name"
                    active={sortBy === 'name'}
                    dir={sortDir}
                    onClick={() => {
                      setSortBy('name');
                      setSortDir(d => (sortBy === 'name' ? (d === 'asc' ? 'desc' : 'asc') : 'asc'));
                    }}
                  />
                </th>
                <th style={th}>Email</th>
                <th style={th}>
                  <HeaderButton
                    label="Role"
                    active={sortBy === 'role'}
                    dir={sortDir}
                    onClick={() => {
                      setSortBy('role');
                      setSortDir(d => (sortBy === 'role' ? (d === 'asc' ? 'desc' : 'asc') : 'asc'));
                    }}
                  />
                </th>
                <th style={th}>Resume</th>
                <th style={th}>Interview</th>
                <th style={th}>Overall</th>
                <th style={th}>
                  <HeaderButton
                    label="Created"
                    active={sortBy === 'created'}
                    dir={sortDir}
                    onClick={() => {
                      setSortBy('created');
                      setSortDir(d => (sortBy === 'created' ? (d === 'asc' ? 'desc' : 'asc') : 'desc'));
                    }}
                  />
                </th>
              </tr>
            </thead>
            <tbody>
              {displayRows.map(r => {
                const trKey = `${r.latest_interview_id || r.id}:transcript`
                const pdfKey = `${r.latest_interview_id || r.id}:pdf`
                const opened = !!expanded[r.id]
                return (
                  <FragmentRow
                    key={r.id}
                    r={r}
                    opened={opened}
                    toggleRow={toggleRow}
                    pctText={pctText}
                    fmtDate={fmtDate}
                    openSigned={openSigned}
                    opening={opening}
                    generatePdf={generatePdf}
                    trKey={trKey}
                    pdfKey={pdfKey}
                  />
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function FragmentRow({
  r, opened, toggleRow, pctText, fmtDate, openSigned, opening, generatePdf, trKey, pdfKey
}) {
  return (
    <>
      <tr className={opened ? 'cd-row opened' : 'cd-row'}>
        <td style={{ ...td, verticalAlign: 'top' }}>
          <button
            onClick={() => toggleRow(r.id)}
            title={opened ? 'Collapse' : 'Expand'}
            aria-label={opened ? 'Collapse' : 'Expand'}
            className="btn lilac expand-toggle"
            style={{
              width: 28,
              height: 28,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 0
            }}
          >
            <span
              style={{
                display:'inline-block',
                transform: opened ? 'rotate(90deg)' : 'none',
                transition:'transform 120ms ease'
              }}
            >
              ▶
            </span>
          </button>
        </td>
        <td style={td}><div style={{ fontWeight: 600 }}>{r.candidate.name || '—'}</div></td>
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
            <div style={{ display:'grid', gap: 12 }}>
              <div className="row-actions" style={{ display:'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                {r.video_url && (
                  <a href={r.video_url} target="_blank" rel="noreferrer" className="btn lilac">Video</a>
                )}

                <button
                  onClick={() => openSigned(r.latest_interview_id, 'transcript')}
                  disabled={!r.latest_interview_id || !r.has_transcript || !!opening[trKey]}
                  className={`btn lilac${(!r.latest_interview_id || !r.has_transcript || !!opening[trKey]) ? ' is-disabled' : ''}`}
                >
                  {opening[trKey] ? 'Opening…' : 'Transcript'}
                </button>

                <button
                  onClick={() => {
                    if (r.latest_report_url) {
                      window.open(r.latest_report_url, '_blank', 'noopener,noreferrer')
                    } else if (r.latest_interview_id) {
                      generatePdf(r.latest_interview_id)
                    }
                  }}
                  disabled={!!opening[pdfKey] || (!r.latest_report_url && !r.latest_interview_id)}
                  className={`btn lilac${(!!opening[pdfKey] || (!r.latest_report_url && !r.latest_interview_id)) ? ' is-disabled' : ''}`}
                >
                  {opening[pdfKey] ? 'Generating…' : 'Download PDF'}
                </button>
              </div>

              <div style={{ display:'grid', gridTemplateColumns:'repeat(12,1fr)', gap: 12, marginTop: 8 }}>
                <div className="detail-card" style={{ gridColumn: 'span 6' }}>
                  <div className="detail-title">Resume Analysis</div>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap: 8 }}>
                    <div><Meter label="Experience" value={r.resume_analysis.experience} /> <InfoTip text={TIPS.experience} /></div>
                    <div><Meter label="Skills" value={r.resume_analysis.skills} /> <InfoTip text={TIPS.skills} /></div>
                    <div><Meter label="Education" value={r.resume_analysis.education} /> <InfoTip text={TIPS.education} /></div>
                  </div>
                  {r.resume_analysis.summary && (
                    <div style={{ marginTop: 8, color:'#374151' }}>
                      {r.resume_analysis.summary}
                    </div>
                  )}
                </div>

                <div className="detail-card" style={{ gridColumn: 'span 6' }}>
                  <div className="detail-title">Interview Analysis</div>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap: 8 }}>
                    <div><Meter label="Clarity" value={r.interview_analysis.clarity} /> <InfoTip text={TIPS.clarity} /></div>
                    <div><Meter label="Confidence" value={r.interview_analysis.confidence} /> <InfoTip text={TIPS.confidence} /></div>
                    <div><Meter label="Body Language" value={r.interview_analysis.body_language} /> <InfoTip text={TIPS.body_language} /></div>
                  </div>
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

function Meter({ label, value }) {
  const pct =
    (typeof value === 'number' && isFinite(value)) || value === 0
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

const th = {
  textAlign: 'left',
  borderBottom: '1px solid #e5e7eb',
  padding: '8px 6px',
  whiteSpace: 'nowrap',
}
const td = { borderBottom: '1px solid #f1f5f9', padding: '8px 6px', verticalAlign: 'top' }
const btn = {
  border: '1px solid #e5e7eb',
  padding: '6px 10px',
  borderRadius: 6,
  background: '#f9fafb',
  cursor: 'pointer',
  textDecoration: 'none',
  display: 'inline-block',
} 
const disabledBtn = { opacity: 0.6, cursor: 'not-allowed' }
