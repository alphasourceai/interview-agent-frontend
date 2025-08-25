import { useEffect, useState } from "react";
import { useClientContext } from "../lib/clientContext.jsx";
import { apiGet, apiPost } from "../lib/api";
import { supabase } from "../lib/supabaseClient";

const label = { fontSize: 14, fontWeight: 600, marginRight: 8 };
const select = { border: "1px solid #d1d5db", borderRadius: 6, padding: "6px 10px" };
const btn = { border: "1px solid #ccc", borderRadius: 6, padding: "6px 10px", background: "#fff" };
const input = { border: "1px solid #d1d5db", borderRadius: 6, padding: "6px 10px" };
const cell = { padding: "6px 8px", borderBottom: "1px solid #eee" };

async function loadMembersAny(clientId) {
  // Try /clients/members?client_id=...
  try {
    const r = await apiGet(`/clients/members?client_id=${clientId}`);
    const items = r?.members || r?.items || r || [];
    return Array.isArray(items) ? items : [];
  } catch (e) {
    // Try /clients/:id/members
    try {
      const r2 = await apiGet(`/clients/${clientId}/members`);
      const items = r2?.members || r2?.items || r2 || [];
      return Array.isArray(items) ? items : [];
    } catch {
      // Final fallback: read directly (if table is readable)
      const { data } = await supabase
        .from("client_members")
        .select("user_id,name,email,role")
        .eq("client_id", clientId);
      return data || [];
    }
  }
}

export default function Account() {
  const { clients, currentClientId, setCurrentClientId } = useClientContext();
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [error, setError] = useState("");

  async function refresh() {
    if (!currentClientId) return;
    setLoading(true);
    setError("");
    try {
      const items = await loadMembersAny(currentClientId);
      setMembers(items);
    } catch (e) {
      setError(e.message || "Failed to load members");
      setMembers([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { refresh(); }, [currentClientId]);

  async function invite() {
    if (!currentClientId || !inviteEmail) return;
    setError("");
    try {
      await apiPost("/clients/invite", {
        client_id: currentClientId,
        email: inviteEmail,
        name: inviteName || null,
        role: inviteRole,
      });
      setInviteName(""); setInviteEmail(""); setInviteRole("member");
      await refresh();
      alert("Invitation sent.");
    } catch (e) {
      setError(e.message || "Invite failed");
    }
  }

  async function revoke(user_id) {
    if (!currentClientId || !user_id) return;
    setError("");
    try {
      await apiPost("/clients/revoke", { client_id: currentClientId, user_id });
      await refresh();
    } catch (e) {
      setError(e.message || "Revoke failed");
    }
  }

  return (
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12 }}>Account</h1>

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
        <div style={label}>Client</div>
        <select
          style={select}
          value={currentClientId || ""}
          onChange={(e) => setCurrentClientId(e.target.value)}
        >
          {clients.map(c => (
            <option key={c.id} value={c.id}>{c.name || c.id}</option>
          ))}
        </select>
      </div>

      <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Members</h2>
      {error && <div style={{ color: "#dc2626", marginBottom: 8 }}>{error}</div>}
      {loading ? (
        <div>Loading…</div>
      ) : members.length === 0 ? (
        <div>No members yet.</div>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 16 }}>
          <thead>
            <tr>
              <th style={{ ...cell, textAlign: "left" }}>Name</th>
              <th style={{ ...cell, textAlign: "left" }}>Email</th>
              <th style={{ ...cell, textAlign: "left" }}>Role</th>
              <th style={{ ...cell, textAlign: "left" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {members.map(m => (
              <tr key={m.user_id || m.id || (m.email || Math.random())}>
                <td style={cell}>{m.name || "—"}</td>
                <td style={cell}>{m.email || m.user_email || "—"}</td>
                <td style={cell}>{m.role || "member"}</td>
                <td style={cell}>
                  {(m.user_id || m.id) ? (
                    <button style={btn} onClick={() => revoke(m.user_id || m.id)}>Revoke</button>
                  ) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>Invite a member</h3>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input
          type="text"
          placeholder="Full name"
          value={inviteName}
          onChange={(e) => setInviteName(e.target.value)}
          style={input}
        />
        <input
          type="email"
          placeholder="email@example.com"
          value={inviteEmail}
          onChange={(e) => setInviteEmail(e.target.value)}
          style={input}
        />
        <select style={select} value={inviteRole} onChange={(e) => setInviteRole(e.target.value)}>
          <option value="member">member</option>
          <option value="owner">owner</option>
          <option value="admin">admin</option>
        </select>
        <button style={btn} onClick={invite}>Invite</button>
      </div>
    </div>
  );
}
