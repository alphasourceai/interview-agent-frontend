import { createContext, useContext, useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "./supabaseClient";

const Ctx = createContext(null);
const API_BASE = (import.meta.env.VITE_BACKEND_URL || "").replace(/\/+$/, "");

async function authedFetch(path, opts = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  const headers = new Headers(opts.headers || {});
  if (session?.access_token) headers.set("Authorization", `Bearer ${session.access_token}`);
  const url = path.startsWith("http") ? path : `${API_BASE}${path}`;
  return fetch(url, { ...opts, headers });
}

export function ClientProvider({ children }) {
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState([]);       // [{id, name, role?}]
  const [currentClientId, setCurrentClientId] = useState(null);

  const refreshClients = useCallback(async () => {
    setLoading(true);
    try {
      // 1) fetch memberships from backend (preferred)
      let list = [];
      let res = await authedFetch("/clients/my");
      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json)) list = json;                    // rare
        else if (Array.isArray(json.clients)) list = json.clients;
        else if (Array.isArray(json.items)) list = json.items;   // alias
        else if (Array.isArray(json.memberships)) {
          list = json.memberships.map(m => ({
            id: m.client_id || m.id,
            name: m.name || m.client_name || null,
            role: m.role || "member",
          }));
        }
      }

      // 2) fallback to /auth/me to at least get IDs
      if (!list.length) {
        res = await authedFetch("/auth/me");
        if (res.ok) {
          const me = await res.json();
          const ids = Array.isArray(me?.clientIds) ? me.clientIds : [];
          list = ids.map(id => ({ id, name: null }));
        }
      }

      // 3) normalize + enrich names from Supabase if missing
      const norm = (list || [])
        .map(x => ({ id: x.id || x.client_id, name: x.name || x.title || null, role: x.role || "member" }))
        .filter(x => x.id);

      const needLookup = norm.filter(x => !x.name).map(x => x.id);
      if (needLookup.length) {
        const { data: rows } = await supabase
          .from("clients")
          .select("id,name")
          .in("id", needLookup);
        const nameMap = Object.fromEntries((rows || []).map(r => [r.id, r.name]));
        for (const c of norm) {
          if (!c.name && nameMap[c.id]) c.name = nameMap[c.id];
        }
      }

      setClients(norm);

      // choose a client (persist across reloads)
      const saved = localStorage.getItem("currentClientId");
      const first = norm[0]?.id || null;
      const chosen = saved && norm.some(c => c.id === saved) ? saved : first;
      setCurrentClientId(chosen || null);
    } catch {
      setClients([]);
      setCurrentClientId(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // initial load
  useEffect(() => {
    let stop = false;
    (async () => { if (!stop) await refreshClients(); })();
    return () => { stop = true; };
  }, [refreshClients]);

  // persist selection
  useEffect(() => {
    if (currentClientId) localStorage.setItem("currentClientId", currentClientId);
  }, [currentClientId]);

  const value = useMemo(() => ({
    loading,
    clients,
    currentClientId,
    setCurrentClientId,
    refreshClients,
    // ---- Back-compat aliases (existing pages rely on these) ----
    selectedClientId: currentClientId,
    setSelectedClientId: setCurrentClientId,
    loadClients: refreshClients,
  }), [loading, clients, currentClientId, refreshClients]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useClientContext() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useClientContext must be used within ClientProvider");
  return v;
}
