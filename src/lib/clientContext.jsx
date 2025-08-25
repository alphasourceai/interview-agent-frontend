import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";

const Ctx = createContext(null);

async function authedFetch(url, opts = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  const headers = new Headers(opts.headers || {});
  if (session?.access_token) headers.set("Authorization", `Bearer ${session.access_token}`);
  return fetch(url, { ...opts, headers });
}

export function ClientProvider({ children }) {
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState([]);
  const [currentClientId, setCurrentClientId] = useState(null);

  useEffect(() => {
    let stop = false;
    async function load() {
      setLoading(true);
      try {
        let list = [];
        let res = await authedFetch(`${import.meta.env.VITE_BACKEND_URL}/clients/my`);
        if (res.ok) {
          const json = await res.json();
          if (Array.isArray(json)) list = json;
          else if (Array.isArray(json.clients)) list = json.clients;
          else if (Array.isArray(json.items)) list = json.items;
          else if (Array.isArray(json.memberships)) {
            list = json.memberships.map(m => ({
              id: m.client_id || m.id,
              name: m.name || m.client_name || m.client_id || m.id,
            }));
          }
        }
        if (!list.length) {
          res = await authedFetch(`${import.meta.env.VITE_BACKEND_URL}/auth/me`);
          if (res.ok) {
            const me = await res.json();
            const ids = Array.isArray(me?.clientIds) ? me.clientIds : [];
            list = ids.map(id => ({ id, name: id }));
          }
        }
        const normalized = list.map(x => ({
          id: x.id || x.client_id,
          name: x.name || x.title || (x.id || x.client_id),
        })).filter(x => x.id);
        if (!stop) {
          setClients(normalized);
          const saved = localStorage.getItem("currentClientId");
          const first = normalized[0]?.id || null;
          const chosen = saved && normalized.some(c => c.id === saved) ? saved : first;
          setCurrentClientId(chosen);
        }
      } catch {} finally {
        if (!stop) setLoading(false);
      }
    }
    load();
    return () => { stop = true; };
  }, []);

  useEffect(() => {
    if (currentClientId) localStorage.setItem("currentClientId", currentClientId);
  }, [currentClientId]);

  const value = useMemo(() => ({
    loading,
    clients,
    currentClientId,
    setCurrentClientId,
  }), [loading, clients, currentClientId]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useClientContext() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useClientContext must be used within ClientProvider");
  return v;
}
