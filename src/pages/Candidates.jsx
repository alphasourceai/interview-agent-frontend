import { useEffect, useState, useMemo } from 'react';
import { api, apiDownload } from '../lib/api';
import { useClientContext } from '../lib/clientContext';

export default function Candidates() {
  const { clientId, clientName } = useClientContext();
  const [rows, setRows] = useState([]);
  const [expanded, setExpanded] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!clientId) return;
    setLoading(true);
    api.get(`/dashboard/candidates?client_id=${encodeURIComponent(clientId)}`)
      .then(r => {
        const data = Array.isArray(r) ? r : [];
        setRows(data);
      })
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [clientId]);

  const toggle = (id) => setExpanded(e => ({ ...e, [id]: !e[id] }));

  const title = useMemo(() => clientName ? `Client: ${clientName}` : 'Client', [clientName]);

  return (
    <div>
      <h2>Candidates</h2>
      <div style={{ margin: '8px 0' }}>
        <strong>{title}</strong>
      </div>

      {loading ? <div>Loading…</div> : (
        <table className="table">
          <thead>
            <tr>
              <th style={{ width: 28 }}></th>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Resume</th>
              <th>Interview</th>
              <th>Overall</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {(rows || []).map((c) => (
              <FragmentRow key={c.id} c={c} open={!!expanded[c.id]} onToggle={() => toggle(c.id)} />
            ))}
            {(!rows || rows.length === 0) && (
              <tr><td colSpan={8} style={{ color: '#777' }}>No rows yet.</td></tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}

function FragmentRow({ c, open, onToggle }) {
  const resume = c.resume_score ?? '—';
  const interview = c.interview_score ?? '—';
  const overall = c.overall_score ?? '—';
  const created = c.created_at ? new Date(c.created_at).toLocaleString() : '—';

  const onDownload = async () => {
    try {
      if (c.report_id) {
        await apiDownload(`/reports/${c.report_id}/download`);
        return;
      }
      // fallback: generate-by-candidate then download (works when report doesn’t exist yet)
      await apiDownload(`/reports/by-candidate/${c.id}/download`);
    } catch {
      alert('Failed to start download');
    }
  };

  return (
    <>
      <tr>
        <td>
          <button onClick={onToggle} aria-label={open ? 'Collapse' : 'Expand'}>
            {open ? '▾' : '▸'}
          </button>
        </td>
        <td>{c.name || '—'}</td>
        <td>{c.email || '—'}</td>
        <td>{c.role_title || c.role_id || '—'}</td>
        <td>{isNumber(resume) ? `${resume}%` : '—'}</td>
        <td>{isNumber(interview) ? `${interview}%` : '—'}</td>
        <td>{isNumber(overall) ? `${overall}%` : '—'}</td>
        <td>{created}</td>
      </tr>
      {open && (
        <tr>
          <td></td>
          <td colSpan={7}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              {c.interview_video_url ? (
                <a href={c.interview_video_url} target="_blank" rel="noreferrer">Video</a>
              ) : <button disabled>Video</button>}
              {c.transcript_url ? (
                <a href={c.transcript_url} target="_blank" rel="noreferrer">Transcript</a>
              ) : <button disabled>Transcript</button>}
              <button onClick={onDownload}>Download PDF</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <h4>Resume Analysis</h4>
                <p style={{ whiteSpace: 'pre-wrap' }}>{c.resume_analysis || 'No data'}</p>
              </div>
              <div>
                <h4>Interview Analysis</h4>
                <p style={{ whiteSpace: 'pre-wrap' }}>{c.interview_analysis || 'No data'}</p>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function isNumber(v) { return typeof v === 'number' && Number.isFinite(v); }
