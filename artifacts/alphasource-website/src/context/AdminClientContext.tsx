import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "@/lib/supabaseClient";

export interface AdminClient {
  id: string;
  name: string;
  letter: string;
  color: string;
  parent_client_id?: string | null;
  entity_label?: string | null;
  billing_client_id?: string | null;
  is_parent_client?: boolean;
  is_child_client?: boolean;
  parent_client_name?: string | null;
  child_count?: number | null;
}

export const ADMIN_CLIENTS: AdminClient[] = [
  { id: "all",        name: "All Clients",               letter: "∗", color: "#0A1547" },
  { id: "acme",       name: "Acme Dental Group",          letter: "A", color: "#A380F6" },
  { id: "ridge",      name: "Ridge Medical Partners",     letter: "R", color: "#02ABE0" },
  { id: "summit",     name: "Summit Health Network",      letter: "S", color: "#02D99D" },
  { id: "crestwood",  name: "Crestwood Orthopedics",      letter: "C", color: "#F0A500" },
  { id: "lakeside",   name: "Lakeside Dermatology",       letter: "L", color: "#FF6B6B" },
  { id: "pinnacle",   name: "Pinnacle Surgical Group",    letter: "P", color: "#5B6FBB" },
  { id: "harborcove", name: "Harbor Cove Family Health",  letter: "H", color: "#0285B0" },
];

interface AdminClientContextType {
  clients: AdminClient[];
  selectedClient: AdminClient;
  selectedClientId: string;
  setSelectedClient: (c: AdminClient) => void;
  setSelectedClientId: (id: string) => void;
  loading: boolean;
  error: string;
  refreshClients: () => Promise<void>;
}

const FALLBACK_CLIENT: AdminClient = ADMIN_CLIENTS[0];

const AdminClientContext = createContext<AdminClientContextType>({
  clients: [FALLBACK_CLIENT],
  selectedClient: FALLBACK_CLIENT,
  selectedClientId: FALLBACK_CLIENT.id,
  setSelectedClient: () => {},
  setSelectedClientId: () => {},
  loading: false,
  error: "",
  refreshClients: async () => {},
});

const env =
  typeof import.meta !== "undefined" && import.meta.env ? import.meta.env : {};

function trimTrailingSlashes(value: unknown): string {
  return String(value || "").trim().replace(/\/+$/, "");
}

function firstBase(...values: unknown[]): string {
  for (const value of values) {
    const normalized = trimTrailingSlashes(value);
    if (normalized) return normalized;
  }
  return "";
}

const backendBase = firstBase(
  (env as Record<string, unknown>).VITE_BACKEND_URL,
  (env as Record<string, unknown>).VITE_API_URL,
  (env as Record<string, unknown>).VITE_PUBLIC_BACKEND_URL,
  (env as Record<string, unknown>).PUBLIC_BACKEND_URL,
  (env as Record<string, unknown>).BACKEND_URL,
);

const SELECTED_ADMIN_CLIENT_STORAGE_KEY = "alphasource:admin_selected_client_id";
const CLIENT_COLORS = ["#A380F6", "#02ABE0", "#02D99D", "#F0A500", "#FF6B6B", "#5B6FBB", "#0285B0"] as const;

function parseJsonSafe(text: string): unknown {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function errorMessageFromResponse(text: string, fallback: string): string {
  if (!text) return fallback;
  const data = parseJsonSafe(text);
  const detail =
    data && typeof data === "object"
      ? (data as { detail?: unknown }).detail ??
        (data as { message?: unknown }).message ??
        (data as { error?: unknown }).error
      : null;
  if (typeof detail === "string" && detail.trim()) return detail;
  return text || fallback;
}

function hashText(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function letterForClient(name: string): string {
  const match = String(name || "").trim().match(/[A-Za-z0-9]/);
  return match ? match[0].toUpperCase() : "C";
}

function colorForClient(id: string, index: number): string {
  const seed = String(id || index || "admin-client");
  return CLIENT_COLORS[hashText(seed) % CLIENT_COLORS.length];
}

function optionalText(value: unknown): string | null | undefined {
  if (value === null) return null;
  if (value === undefined) return undefined;
  const normalized = String(value || "").trim();
  return normalized || null;
}

function optionalBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function optionalNumber(value: unknown): number | null | undefined {
  if (value === null) return null;
  if (value === undefined || value === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function readStoredClientId(): string {
  if (typeof window === "undefined") return "";
  try {
    return String(window.localStorage.getItem(SELECTED_ADMIN_CLIENT_STORAGE_KEY) || "").trim();
  } catch {
    return "";
  }
}

function writeStoredClientId(clientId: string): void {
  if (typeof window === "undefined") return;
  const normalized = String(clientId || "").trim();
  try {
    if (!normalized) {
      window.localStorage.removeItem(SELECTED_ADMIN_CLIENT_STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(SELECTED_ADMIN_CLIENT_STORAGE_KEY, normalized);
  } catch {
    // no-op
  }
}

export function AdminClientProvider({ children }: { children: ReactNode }) {
  const [clients, setClients] = useState<AdminClient[]>([FALLBACK_CLIENT]);
  const [selectedClientIdState, setSelectedClientIdState] = useState<string>(() => readStoredClientId() || FALLBACK_CLIENT.id);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");

  const setSelectedClientId = useCallback((clientId: string) => {
    const normalized = String(clientId || "").trim();
    setSelectedClientIdState(normalized);
    writeStoredClientId(normalized);
  }, []);

  const setSelectedClient = useCallback(
    (client: AdminClient) => {
      setSelectedClientId(client?.id || FALLBACK_CLIENT.id);
    },
    [setSelectedClientId],
  );

  const selectedClient = useMemo(() => {
    const activeClientId = String(selectedClientIdState || "").trim();
    const matchedClient = clients.find((client) => client.id === activeClientId);
    if (matchedClient) return matchedClient;
    if (loading && activeClientId) {
      return {
        ...FALLBACK_CLIENT,
        id: activeClientId,
        name: activeClientId === FALLBACK_CLIENT.id ? FALLBACK_CLIENT.name : "Loading client...",
      };
    }
    return clients[0] || FALLBACK_CLIENT;
  }, [clients, selectedClientIdState, loading]);

  const selectedClientId = useMemo(() => {
    const activeClientId = String(selectedClientIdState || "").trim();
    if (activeClientId && (loading || clients.some((client) => client.id === activeClientId))) {
      return activeClientId;
    }
    return selectedClient.id || FALLBACK_CLIENT.id;
  }, [selectedClientIdState, loading, clients, selectedClient.id]);

  const refreshClients = useCallback(async () => {
    if (!backendBase) {
      setClients([FALLBACK_CLIENT]);
      setSelectedClientIdState(FALLBACK_CLIENT.id);
      setError("Missing backend base URL configuration.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = String(session?.access_token || "").trim();
      if (!token) throw new Error("Missing session token.");

      const response = await fetch(`${backendBase}/admin/clients`, {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
        credentials: "omit",
      });

      const text = await response.text();
      if (!response.ok) {
        throw new Error(errorMessageFromResponse(text, "Could not load admin clients."));
      }

      const payload = parseJsonSafe(text);
      const items = payload && typeof payload === "object" && Array.isArray((payload as { items?: unknown }).items)
        ? (payload as { items: unknown[] }).items
        : [];

      const normalizedClients: AdminClient[] = items
        .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"))
        .map((item, index) => {
          const id = String(item.id || "").trim();
          const name = String(item.name || "").trim() || id || `Client ${index + 1}`;
          return {
            id,
            name,
            letter: letterForClient(name),
            color: colorForClient(id, index),
            parent_client_id: optionalText(item.parent_client_id),
            entity_label: optionalText(item.entity_label),
            billing_client_id: optionalText(item.billing_client_id),
            is_parent_client: optionalBoolean(item.is_parent_client),
            is_child_client: optionalBoolean(item.is_child_client),
            parent_client_name: optionalText(item.parent_client_name),
            child_count: optionalNumber(item.child_count),
          };
        })
        .filter((item) => Boolean(item.id));
      const dedupedClients = normalizedClients.filter(
        (client, index, list) => list.findIndex((entry) => entry.id === client.id) === index,
      );

      const nextClients = [FALLBACK_CLIENT, ...dedupedClients];
      const validIds = new Set(nextClients.map((client) => client.id));
      const storedClientId = readStoredClientId();

      setClients(nextClients);
      setSelectedClientIdState((current) => {
        const activeClientId = String(current || "").trim();
        const resolvedClientId =
          (activeClientId && validIds.has(activeClientId) ? activeClientId : "") ||
          (storedClientId && validIds.has(storedClientId) ? storedClientId : "") ||
          FALLBACK_CLIENT.id;
        writeStoredClientId(resolvedClientId);
        return resolvedClientId;
      });
    } catch (bootstrapError) {
      setClients([FALLBACK_CLIENT]);
      setSelectedClientIdState(FALLBACK_CLIENT.id);
      setError(
        bootstrapError instanceof Error
          ? bootstrapError.message
          : "Could not load admin clients.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    void refreshClients();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      if (!session) {
        setClients([FALLBACK_CLIENT]);
        setSelectedClientIdState(FALLBACK_CLIENT.id);
        setLoading(false);
        return;
      }
      void refreshClients().catch(() => {
        if (!mounted) return;
        setError("Could not load admin clients.");
        setLoading(false);
      });
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [refreshClients]);

  return (
    <AdminClientContext.Provider
      value={{
        clients,
        selectedClient,
        selectedClientId,
        setSelectedClient,
        setSelectedClientId,
        loading,
        error,
        refreshClients,
      }}
    >
      {children}
    </AdminClientContext.Provider>
  );
}

export function useAdminClient() {
  return useContext(AdminClientContext);
}
