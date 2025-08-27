import { useEffect, useState } from "react";
import { useClientContext } from "../lib/clientContext.jsx";
import { apiGet } from "../lib/api";

const th = { textAlign: "left", padding: "6px 8px", borderBottom: "1px solid #eee", fontWeight: 600 };
const td = { padding: "6px 8px", borderBottom: "1px solid #eee" };

export default function ClientDashboard() {
  const { currentClientId } = useClientContext();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!currentClientId) return;
      setLoading(true);
      try {
        const res = await apiGet(`/dashboard/interviews?client_id=${currentClientId}`);
        const items = res?.items || res || [];
        if (!cancelled) setRows(items);
      } catch {
        if (!cancelled) setRows([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [currentClientId]);

  if (loading) return <div>Loading…</div>;

  return (
    <div>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
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
          {rows.map(r => (
            <tr key={r.id}>
              <td style={td}>{r?.candidate?.name || "—"}</td>
              <td style={td}>{r?.candidate?.email || "—"}</td>
              <td style={td}>{r?.role?.title || "—"}</td>
              <td style={td}>{Number.isFinite(r?.resume_score) ? r.resume_score : "—"}</td>
              <td style={td}>{Number.isFinite(r?.interview_score) ? r.interview_score : "—"}</td>
              <td style={td}>{Number.isFinite(r?.overall_score) ? r.overall_score : "—"}</td>
              <td style={td}>{r?.created_at ? new Date(r.created_at).toLocaleString() : "—"}</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr><td style={td} colSpan={7}>No rows yet.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
