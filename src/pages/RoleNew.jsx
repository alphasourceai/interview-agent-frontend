import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useClientContext } from "../lib/clientContext.jsx";

export default function RoleNew() {
  const { currentClientId } = useClientContext();
  const [title, setTitle] = useState("");
  const [interviewType, setInterviewType] = useState("basic");
  const [manualQuestions, setManualQuestions] = useState("");
  const [file, setFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!currentClientId) return;
    setSubmitting(true);

    let jd_file = null;
    if (file) {
      jd_file = await api.roles.uploadJD({ client_id: currentClientId, file });
      if (!jd_file || !jd_file.path) {
        alert("Upload failed");
        setSubmitting(false);
        return;
      }
    }

    const role = await api.roles.create({
      client_id: currentClientId,
      title,
      interview_type: interviewType,
      manual_questions: manualQuestions.split("\n").map(s => s.trim()).filter(Boolean),
      jd_file,
    });

    setSubmitting(false);
    if (!role) return;
    navigate("/roles");
  };

  return (
    <div className="mx-auto max-w-2xl p-4">
      <h1 className="text-xl font-semibold mb-4">Add Role</h1>
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="block text-sm mb-1">Role Title</label>
          <input className="w-full border rounded-md p-2" value={title} onChange={e => setTitle(e.target.value)} required />
        </div>
        <div>
          <label className="block text-sm mb-1">Interview Type</label>
          <select className="w-full border rounded-md p-2" value={interviewType} onChange={e => setInterviewType(e.target.value)}>
            <option value="basic">basic</option>
            <option value="detailed">detailed</option>
            <option value="technical">technical</option>
          </select>
        </div>
        <div>
          <label className="block text-sm mb-1">Job Description (pdf/doc/docx)</label>
          <input type="file" accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={e => setFile(e.target.files?.[0] || null)} />
        </div>
        <div>
          <label className="block text-sm mb-1">Manual Questions (one per line)</label>
          <textarea className="w-full border rounded-md p-2 min-h-[120px]" value={manualQuestions} onChange={e => setManualQuestions(e.target.value)} />
        </div>
        <div className="flex gap-2">
          <button disabled={submitting} className="rounded-md px-3 py-1.5 border" type="submit">
            {submitting ? "Saving..." : "Save Role"}
          </button>
          <button type="button" className="rounded-md px-3 py-1.5 border" onClick={() => navigate("/roles")}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
