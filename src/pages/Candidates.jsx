// src/pages/Candidates.jsx
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useClientContext } from '../lib/clientContext';

const th = { textAlign: 'left', borderBottom: '1px solid #e5e7eb', padding: '8px 6px', whiteSpace: 'nowrap' };
const td = { borderBottom: '1px solid #f1f5f9', padding: '8px 6px', verticalAlign: 'top' };
const btn = { border: '1px solid #e5e7eb', padding: '6px 10px', borderRadius: 6, background: '#f9fafb', cursor: 'pointer' };
const disabledBtn = { opacity: 0.6, cursor: 'not-allowed' };

async function getToken() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token || null;
}

export default function Candidates() {
  const { clients, selectedClientId, loadClients, setSelectedClientId } = useClientContext();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState({});
  const [opening, setOpening] = useState({}); // map of "id:kind" -> boolean

  useEffect(() => {
    loadClients?.();
  }, [loadClients]);

  useEffect(() => {
    let abort = false;
    (async () => {
      setLoading(true);
      try {
        const token = await getToken();
        const base = (import.meta.env.VITE_BACKEND_URL || '').replace(/\/+$/, '') || window.location.origin;
        const url = `${base}/dashboard/interviews${selectedClientId ? `?client_id=${encodeURIComponent(selectedClientId)}` : ''}`;
        const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
        const j = await r.json().catch(() => (Array.isArray([]) ? [] : { items: [] }));
        if (!abort) setRows(Array.isArray(j) ? j : (j.items || []));
      } catch {
        if (!abort) setRows([]);
      } finally {
        if (!abort) setLoading(false);
      }
    })();
    return () => { abort = true; };
  }, [selectedClientId]);

  const byId = useMemo(() => Object.fromEntries(rows.map((r) => [r.id, r])), [rows]);

  async function openSigned(interviewId, kind) {
    // kind: 'transcript' | 'analysis'
    const key = `${interviewId}:${kind}`;
    try {
      setOpening((p) => ({ ...p, [key]: true }));
      const token = await getToken();
      const base = (import.meta.env.VITE_BACKEND_URL || '').replace(/\/+$/, '') || window.location.origin;
      const url = `${base}/files/signed-url?interview_id=${encodeURIComponent(interviewId)}&kind=${encodeURIComponent(kind)}`;
      const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      const j = await r.json();
      if (!j?.url) throw new Error(j?.error || 'No URL');
      window.open(j.url, '_blank', 'noopener');
    } catch (e) {
      alert(e.message || 'Could not open file');
    } finally {
      setOpening((p) => ({ ...p, [key]: false }));
    }
  }

  async function downloadPdf(interviewId) {
    const key = `${interviewId}:pdf`;
    try {
      setOpening((p) => ({ ...p, [key]: true }));
      const token = await getToken();
      const base = (import.meta.env.VITE_BACKEND_URL || '').replace(/\/+$/, '') || window.location.origin;
      const url = `${base}/reports/${encodeURIComponent(interviewId)}/download`;
      const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) throw new Error('Failed to start download');
      const blob = await r.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `Interview_${interviewId}.pdf`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e) {
      alert(e.message || 'Could not download PDF');
    } finally {
      setOpening((p) => ({ ...p, [key]: false }));
    }
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-semibold mb-4">Candidates</h1>

      <div className="mb-4">
        <label className="block text-sm mb-1">Client</label>
        <select
          className="border rounded p-2"
          value={selectedClientId || ''}
          onChange={(e) => setSelectedClientId(e.target.value)}
        >
          {(clients || []).map((c) => (
            <option key={c.id} value={c.id}>{c.name || c.id}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div>Loading…</div>
      ) : rows.length === 0 ? (
        <div>No rows yet.</div>
      ) : (
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th style={th} />
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
            {rows.map((r) => (
              <FragmentRow
                key={r.id}
                row={r}
                expanded={!!expanded[r.id]}
                setExpanded={(on) => setExpanded((p) => ({ ...p, [r.id]: on }))}
                openSigned={openSigned}
                opening={opening}
                downloadPdf={downloadPdf}
              />
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function FragmentRow({ row, expanded, setExpanded, openSigned, opening, downloadPdf }) {
  return (
    <>
      <tr>
        <td style={td}>
          <button className="border rounded px-2 py-1" onClick={() => setExpanded(!expanded)}>
            {expanded ? '▾' : '▸'}
          </button>
        </td>
        <td style={td}><strong>{row?.candidate?.name || '—'}</strong></td>
        <td style={td}>{row?.candidate?.email || '—'}</td>
        <td style={td}>{row?.role?.title || '—'}</td>
        <td style={td}>{Number.isFinite(row?.resume_score) ? `${row.resume_score}%` : '—'}</td>
        <td style={td}>{Number.isFinite(row?.interview_score) ? `${row.interview_score}%` : '—'}</td>
        <td style={td}>{Number.isFinite(row?.overall_score) ? `${row.overall_score}%` : '—'}</td>
        <td style={td}>{row?.created_at ? new Date(row.created_at).toLocaleString() : '—'}</td>
      </tr>
      {expanded && (
        <tr>
          <td style={td}></td>
          <td style={td} colSpan={7}>
            <div className="flex items-center gap-2 mb-3">
              <button
                style={{ ...btn, ...(row?.has_video ? {} : disabledBtn) }}
                disabled={!row?.has_video}
                onClick={() => window.open(row.video_url, '_blank', 'noopener')}
              >
                Video
              </button>
              <button
                style={{ ...btn, ...(row?.has_transcript ? {} : disabledBtn) }}
                disabled={!row?.has_transcript || opening[`${row.id}:transcript`]}
                onClick={() => openSigned(row.id, 'transcript')}
              >
                {opening[`${row.id}:transcript`] ? 'Opening…' : 'Transcript'}
              </button>
              <button
                style={{ ...btn, ...(row?.has_analysis ? {} : disabledBtn) }}
                disabled={!row?.has_analysis || opening[`${row.id}:analysis`]}
                onClick={() => openSigned(row.id, 'analysis')}
              >
                {opening[`${row.id}:analysis`] ? 'Opening…' : 'Analysis JSON'}
              </button>
              <button
                style={btn}
                disabled={opening[`${row.id}:pdf`]}
                onClick={() => downloadPdf(row.id)}
              >
                {opening[`${row.id}:pdf`] ? 'Preparing…' : 'Download PDF'}
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card title="Resume Analysis" items={row.resume_breakdown} />
              <Card title="Interview Analysis" items={row.interview_breakdown} />
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function Card({ title, items }) {
  const entries = Object.entries(items || {});
  return (
    <div className="border rounded p-3">
      <div className="font-semibold mb-2">{title}</div>
      {entries.length === 0 ? (
        <div className="text-sm text-slate-500">No data</div>
      ) : (
        <ul className="text-sm space-y-1">
          {entries.map(([k, v]) => (
            <li key={k}>
              <span className="inline-block w-28 text-slate-500">{k}</span>
              <span className="font-medium">{String(v)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
