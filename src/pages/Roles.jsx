// src/pages/Roles.jsx
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { useClientContext } from "../lib/clientContext";

export default function Roles() {
  const { selectedClientId: clientId } = useClientContext();
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    let cancel = false;
    async function run() {
      if (!clientId) {
        setRoles([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      setErr("");
      try {
        const items = await api.getRoles(clientId);
        if (!cancel) setRoles(Array.isArray(items) ? items : []);
      } catch (e) {
        console.error(e);
        if (!cancel) {
          setErr(e.message || "Failed to load roles.");
          setRoles([]);
        }
      } finally {
        !cancel && setLoading(false);
      }
    }
    run();
    return () => { cancel = true; };
  }, [clientId]);

  return (
    <div style={{ padding: 16 }}>
      <h2>Roles</h2>

      <div style={{ margin: "8px 0" }}>
        <Link to="/roles/new">
          <button>Add Role</button>
        </Link>
      </div>

      {loading && <div>Loading...</div>}
      {!loading && err && <div style={{ color: "crimson" }}>{err}</div>}
      {!loading && !err && (!roles || roles.length === 0) && <div>No roles yet.</div>}

      {!loading && !err && Array.isArray(roles) && roles.length > 0 && (
        <table cellPadding={6}>
          <thead>
            <tr>
              <th>Title</th>
              <th>Interview type</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {roles.map((r) => (
              <tr key={r.id || r.uuid}>
                <td>{r.title || "—"}</td>
                <td style={{ textTransform: "capitalize" }}>{r.interview_type || "—"}</td>
                <td>{r.created_at ? new Date(r.created_at).toLocaleString() : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
