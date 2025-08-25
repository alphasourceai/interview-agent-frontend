import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useClientContext } from "../lib/clientContext.jsx";

export default function Roles() {
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { currentClientId } = useClientContext();

  useEffect(() => {
    let ignore = false;
    async function load() {
      setLoading(true);
      const res = await api.roles.list({ client_id: currentClientId });
      if (!ignore) setRoles(res || []);
      setLoading(false);
    }
    if (currentClientId) load();
    return () => { ignore = true; };
  }, [currentClientId]);

  return (
    <div className="mx-auto max-w-6xl p-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">Roles</h1>
        <button onClick={() => navigate("/roles/new")} className="rounded-md px-3 py-1.5 border">Add Role</button>
      </div>
      {loading ? (
        <div>Loading...</div>
      ) : roles.length === 0 ? (
        <div className="text-gray-600">No roles yet.</div>
      ) : (
        <table className="w-full border text-sm">
          <thead>
            <tr className="bg-gray-50">
              <th className="p-2 text-left">Title</th>
              <th className="p-2 text-left">Interview Type</th>
              <th className="p-2 text-left">Created</th>
            </tr>
          </thead>
          <tbody>
            {roles.map(r => (
              <tr key={r.id} className="border-t">
                <td className="p-2">{r.title}</td>
                <td className="p-2 capitalize">{r.interview_type}</td>
                <td className="p-2">{r.created_at ? new Date(r.created_at).toLocaleString() : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
