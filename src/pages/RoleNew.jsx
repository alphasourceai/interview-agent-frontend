import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useClientContext } from "../lib/clientContext.jsx";

const field = { display: "grid", gap: 6, marginBottom: 12 };
const label = { fontSize: 14 };
const input = { border: "1px solid #d1d5db", borderRadius: 6, padding: 10, width: "100%" };
const btn = { border: "1px solid #ccc", borderRadius: 6, padding: "8px 12px", background: "#fff" };

export default function RoleNew() {
  const { currentClientId } = useClientContext();
  const [title, setTitle] = useState("");
  const [interviewType, setInterviewType] = useState("basic");
  const [manualQuestions, setManualQuestions] = useState("");
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();

  async function onSubmit(e) {
    e.preventDefault();
    if (!currentClientId || saving) return;
    setSaving(true);

    let jd_file = null;
    if (file) {
      jd_file = await api.roles.uploadJD({ client_id: currentClientId, file });
      if (!jd_file) {
        alert("Job description upload failed.");
        setSaving(false);
        return;
      }
    }

    const role = await api.roles.create({
      client_id: currentClientId,
      title,
      interview_type: interviewType,
      manual_questions: manualQuestions.split("\n").map(s => s.trim()).filter(Boolean),
      jd_file
    });

    setSaving(false);
    if (role?.id) navigate("/roles");
  }

  return (
    <div style={{ maxWidth: 720 }}>
      <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12 }}>Add Role</h1>
      <form onSubmit={onSubmit}>
        <div style={field}>
          <label style={label}>Role title</label>
          <input style={input} value={title} onChange={e => setTitle(e.target.value)} required />
        </div>

        <div style={field}>
          <label style={label}>Interview type</label>
          <select style={input} value={interviewType} onChange={e => setInterviewType(e.target.value)}>
            <option value="basic">basic</option>
            <option value="detailed">detailed</option>
            <option value="technical">technical</option>
          </select>
        </div>

        <div style={field}>
          <label style={label}>Job description (pdf/doc/docx)</label>
          <input
            type="file"
            accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            onChange={e => setFile(e.target.files?.[0] || null)}
          />
        </div>

        <div style={field}>
          <label style={label}>Manual questions (one per line)</label>
          <textarea style={{ ...input, minHeight: 120 }}
            value={manualQuestions}
            onChange={e => setManualQuestions(e.target.value)}
          />
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button type="submit" style={btn} disabled={saving}>{saving ? "Saving..." : "Save Role"}</button>
          <button type="button" style={btn} onClick={() => navigate("/roles")}>Cancel</button>
        </div>
      </form>
    </div>
  );
}
