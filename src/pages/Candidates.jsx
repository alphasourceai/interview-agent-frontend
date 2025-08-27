// src/pages/Candidates.jsx
import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import { useClientContext } from "../lib/clientContext";

function parseSummary(any) {
  if (!any) return null;
  if (typeof any === "string") {
    try { return JSON.parse(any); } catch { return null; }
  }
  return any;
}
function pct(v) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n) : null;
}
function Bar({ value }) {
  const v = pct(value);
  return (
    <div style={{ width: 180, height: 6, background: "#eee", borderRadius: 3 }}>
      <div style={{ width: `${v ?? 0}%`, height: "100%", borderRadius: 3, background: "#888" }} />
    </div>
  );
}
function ScoreCell({ v }) {
  const n = pct(v);
  return <td style={{ textAlign: "center" }}>{n != null ? `${n}%` : "—"}</td>;
}

export default function Candidates() {
  const { selectedClientId: clientId } = useClientContext();
  const [rows, setRows] = useState([]);
  const [openId, setOpenId] = useState(null);
  const [downloading, setDownloading] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    let stop = false;
    async function run() {
      if (!clientId) { setRows([]); return; }
      setErr("");
      try {
        const data = await api.listCandidates(clientId);
        if (!stop) setRows(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error(e);
        if (!stop) setErr("Failed to load candidates.");
      }
    }
    run();
    return () => { stop = true; };
  }, [clientId]);

  const computed = useMemo(() => {
    return rows.map((row) => {
      const summary = parseSummary(row.analysis_summary);
      const resumeScore =
        summary?.resume_score ??
        summary?.overall_resume_match_percent ??
        null;
      const interviewScore =
        summary?.interview_score ??
        summary?.overall_interview_match_percent ??
        null;

      // Prefer explicit overall; else average available pieces
      let overall = summary?.overall_score ?? null;
      if (overall == null) {
        const parts = [resumeScore, interviewScore].filter((v) => v != null);
        if (parts.length) overall = Math.round(parts.reduce((a, b) => a + b, 0) / parts.length);
      }

      return {
        ...row,
        _summary: summary,
        _resumeScore: pct(resumeScore),
        _interviewScore: pct(interviewScore),
        _overall: pct(overall),
      };
    });
  }, [rows]);

  async function handleDownload(reportId) {
    try {
      setDownloading(reportId || true);
      const blob = await api.downloadReport(reportId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Interview_Report_${reportId || "report"}.pdf`;
      document.body.appendChild(a);
      a.click();
      URL.revokeObjectURL(url);
      a.remove();
    } catch (e) {
      console.error(e);
      alert("Failed to start download.");
    } finally {
      setDownloading(null);
    }
  }

  return (
    <div style={{ padding: 16 }}>
      <h2>Candidates</h2>
      {err && <div style={{ color: "crimson", marginBottom: 8 }}>{err}</div>}

      <div style={{ marginBottom: 8 }}>
        <label style={{ marginRight: 8 }}>Client</label>
        {/* The dropdown lives in the navbar via ClientContext; shown here read-only */}
        <span style={{ padding: "2px 6px", border: "1px solid #ddd", borderRadius: 4 }}>
          {clientId ? "Selected" : "—"}
        </span>
      </div>

      <table cellPadding={6} style={{ width: "100%" }}>
        <thead>
          <tr>
            <th />
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
          {computed.map((c) => {
            const id = c.id || c.uuid || c.interview_id || c.candidate_id;
            const isOpen = openId === id;
            const reportId = c.report_id || c.report_uuid || c.id; // be flexible
            return (
              <FragmentRow
                key={id}
                row={c}
                isOpen={isOpen}
                onToggle={() => setOpenId(isOpen ? null : id)}
                onDownload={() => handleDownload(reportId)}
                downloading={downloading === reportId}
              />
            );
          })}
          {computed.length === 0 && (
            <tr>
              <td colSpan={8} style={{ color: "#666" }}>No rows yet.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function FragmentRow({ row, isOpen, onToggle, onDownload, downloading }) {
  const created = row.created_at ? new Date(row.created_at).toLocaleString() : "—";
  const name = row.name || [row.first_name, row.last_name].filter(Boolean).join(" ") || "—";
  const roleName = row.role_title || row.role || "—";

  return (
    <>
      <tr className="border-t">
        <td>
          <button onClick={onToggle} aria-label="expand">{isOpen ? "▾" : "▸"}</button>
        </td>
        <td style={{ fontWeight: 600 }}>{name}</td>
        <td>{row.email || "—"}</td>
        <td>{roleName}</td>
        <ScoreCell v={row._resumeScore} />
        <ScoreCell v={row._interviewScore} />
        <ScoreCell v={row._overall} />
        <td>{created}</td>
      </tr>
      {isOpen && (
        <tr>
          <td />
          <td colSpan={7}>
            <div style={{ display: "flex", gap: 24, alignItems: "center", marginBottom: 10 }}>
              {row.interview_video_url ? (
                <a href={row.interview_video_url} target="_blank" rel="noreferrer">
                  <button>Video</button>
                </a>
              ) : null}
              {row.transcript_url ? (
                <a href={row.transcript_url} target="_blank" rel="noreferrer">
                  <button>Transcript</button>
                </a>
              ) : null}
              <button onClick={onDownload} disabled={downloading}>
                {downloading ? "Preparing..." : "Download PDF"}
              </button>
            </div>

            <div style={{ display: "grid", gap: 16, gridTemplateColumns: "1fr 1fr" }}>
              <section>
                <h4 style={{ margin: 0 }}>Resume Analysis</h4>
                <DetailRow label="Experience" value={row._summary?.experience_match_percent} />
                <DetailRow label="Skills" value={row._summary?.skills_match_percent} />
                <DetailRow label="Education" value={row._summary?.education_match_percent} />
                {row._summary?.summary && (
                  <p style={{ marginTop: 8, color: "#444" }}>{row._summary.summary}</p>
                )}
              </section>
              <section>
                <h4 style={{ margin: 0 }}>Interview Analysis</h4>
                <DetailRow label="Clarity" value={row._summary?.interview_clarity_percent} />
                <DetailRow label="Confidence" value={row._summary?.interview_confidence_percent} />
                <DetailRow label="Body Language" value={row._summary?.interview_body_language_percent} />
              </section>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function DetailRow({ label, value }) {
  const v = pct(value);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
      <div style={{ width: 120 }}>{label}</div>
      <Bar value={v ?? 0} />
      <div style={{ width: 40, textAlign: "right" }}>{v != null ? `${v}%` : "—"}</div>
    </div>
  );
}
