import { useEffect } from "react";
import { useClientContext } from "../lib/clientContext.jsx";
import ClientDashboard from "./ClientDashboard.jsx";

const row = { display: "flex", alignItems: "center", gap: 10, marginBottom: 12 };
const select = { border: "1px solid #d1d5db", borderRadius: 6, padding: "6px 10px" };

export default function Candidates() {
  const { clients, currentClientId, setCurrentClientId } = useClientContext();

  useEffect(() => {
    if (!currentClientId && clients.length) setCurrentClientId(clients[0].id);
  }, [clients, currentClientId, setCurrentClientId]);

  return (
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12 }}>Candidates</h1>

      <div style={row}>
        <div style={{ fontWeight: 600 }}>Client</div>
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

      <ClientDashboard />
    </div>
  );
}
