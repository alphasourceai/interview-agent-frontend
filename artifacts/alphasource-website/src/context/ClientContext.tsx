import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { supabase } from "@/lib/supabaseClient";

export interface Client {
  id: string;
  name: string;
  letter: string;
  color: string;
  role?: string;
  parent_client_id?: string | null;
  entity_label?: string | null;
  billing_client_id?: string | null;
  is_parent_client?: boolean;
  is_child_client?: boolean;
  inherited?: boolean;
  inherited_from_client_id?: string | null;
  permissions?: {
    can_create_roles?: boolean;
    can_purchase_interviews?: boolean;
    can_view_legal_billing?: boolean;
    can_manage_members?: boolean;
  };
}

export interface ClientMembership {
  client_id: string;
  role?: string;
}

interface ClientContextType {
  clients: Client[];
  selectedClient: Client;
  selectedClientId: string;
  setSelectedClient: (c: Client) => void;
  setSelectedClientId: (id: string) => void;
  loading: boolean;
  error: string;
  isGlobalAdmin: boolean;
  memberships: ClientMembership[];
  defaultClientId: string;
  refreshClients: () => Promise<void>;
}

const FALLBACK_CLIENT: Client = {
  id: "",
  name: "Client account",
  letter: "C",
  color: "#0A1547",
};

const ClientContext = createContext<ClientContextType>({
  clients: [],
  selectedClient: FALLBACK_CLIENT,
  selectedClientId: "",
  setSelectedClient: () => {},
  setSelectedClientId: () => {},
  loading: false,
  error: "",
  isGlobalAdmin: false,
  memberships: [],
  defaultClientId: "",
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

const CLIENT_COLORS = ["#A380F6", "#02ABE0", "#02D99D", "#0A1547"] as const;
const SELECTED_CLIENT_STORAGE_KEY = "alphasource:selected_client_id";

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
  const seed = String(id || index || "client");
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

function normalizePermissions(value: unknown): Client["permissions"] | undefined {
  if (!value || typeof value !== "object") return undefined;
  const source = value as Record<string, unknown>;
  return {
    can_create_roles: optionalBoolean(source.can_create_roles),
    can_purchase_interviews: optionalBoolean(source.can_purchase_interviews),
    can_view_legal_billing: optionalBoolean(source.can_view_legal_billing),
    can_manage_members: optionalBoolean(source.can_manage_members),
  };
}

function parseJsonSafe(text: string): unknown {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function readStoredClientId(): string {
  if (typeof window === "undefined") return "";
  try {
    return String(window.localStorage.getItem(SELECTED_CLIENT_STORAGE_KEY) || "").trim();
  } catch {
    return "";
  }
}

function readQueryClientId(): string {
  if (typeof window === "undefined") return "";
  try {
    return String(new URL(window.location.href).searchParams.get("client_id") || "").trim();
  } catch {
    return "";
  }
}

function writeStoredClientId(clientId: string): void {
  if (typeof window === "undefined") return;
  const normalized = String(clientId || "").trim();
  try {
    if (!normalized) {
      window.localStorage.removeItem(SELECTED_CLIENT_STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(SELECTED_CLIENT_STORAGE_KEY, normalized);
  } catch {
    // no-op
  }
}

export function ClientProvider({ children }: { children: ReactNode }) {
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientIdState, setSelectedClientIdState] = useState<string>(() => readQueryClientId() || readStoredClientId());
  const queryClientIdRef = useRef<string>(readQueryClientId());
  const queryClientIdConsumedRef = useRef<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");
  const [isGlobalAdmin, setIsGlobalAdmin] = useState<boolean>(false);
  const [memberships, setMemberships] = useState<ClientMembership[]>([]);
  const [defaultClientId, setDefaultClientId] = useState<string>("");

  const setSelectedClientId = useCallback((clientId: string) => {
    const normalized = String(clientId || "").trim();
    setSelectedClientIdState(normalized);
    writeStoredClientId(normalized);
  }, []);

  const setSelectedClient = useCallback(
    (client: Client) => {
      setSelectedClientId(client?.id || "");
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
        name: "Loading client...",
      };
    }
    if (clients.length > 0) return clients[0];
    return FALLBACK_CLIENT;
  }, [clients, selectedClientIdState, loading]);

  const selectedClientId = useMemo(() => {
    const activeClientId = String(selectedClientIdState || "").trim();
    if (activeClientId && (loading || clients.some((client) => client.id === activeClientId))) {
      return activeClientId;
    }
    return selectedClient.id || "";
  }, [selectedClientIdState, loading, clients, selectedClient.id]);

  const fetchJson = useCallback(async (path: string, token: string): Promise<unknown> => {
    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;

    const response = await fetch(`${backendBase}${path}`, {
      method: "GET",
      headers,
      credentials: "omit",
    });

    const text = await response.text();
    const data = parseJsonSafe(text);
    if (!response.ok) {
      const detail =
        data && typeof data === "object"
          ? (data as { detail?: unknown }).detail ??
            (data as { message?: unknown }).message ??
            (data as { error?: unknown }).error
          : null;
      const message =
        typeof detail === "string" && detail.trim()
          ? detail
          : text || `HTTP ${response.status}`;
      throw new Error(message);
    }

    return data;
  }, []);

  const refreshClients = useCallback(async () => {
    if (!backendBase) {
      setClients([]);
      setSelectedClientIdState("");
      setMemberships([]);
      setDefaultClientId("");
      setIsGlobalAdmin(false);
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

      const [meRaw, myClientsRaw] = await Promise.all([
        fetchJson("/auth/me", token),
        fetchJson("/clients/my", token),
      ]);

      const me = meRaw && typeof meRaw === "object" ? (meRaw as Record<string, unknown>) : {};
      const myClients = myClientsRaw && typeof myClientsRaw === "object"
        ? (myClientsRaw as Record<string, unknown>)
        : {};

      const scope = me.client_scope && typeof me.client_scope === "object"
        ? (me.client_scope as Record<string, unknown>)
        : {};

      const membershipsRaw = Array.isArray(scope.memberships)
        ? scope.memberships
        : (Array.isArray(me.memberships) ? me.memberships : []);

      const normalizedMemberships: ClientMembership[] = membershipsRaw
        .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"))
        .map((item) => ({
          client_id: String(item.client_id || "").trim(),
          role: typeof item.role === "string" ? item.role : undefined,
        }))
        .filter((item) => Boolean(item.client_id));

      const roleByClientId = Object.fromEntries(
        normalizedMemberships.map((item) => [item.client_id, item.role || "member"]),
      );

      const items = Array.isArray(myClients.items) ? myClients.items : [];
      const normalizedClients: Client[] = items
        .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"))
        .map((item, index) => {
          const id = String(item.client_id || item.id || "").trim();
          const name = String(item.name || "").trim() || id || `Client ${index + 1}`;
          const role =
            typeof item.role === "string"
              ? item.role
              : (typeof roleByClientId[id] === "string" ? String(roleByClientId[id]) : undefined);
          return {
            id,
            name,
            letter: letterForClient(name),
            color: colorForClient(id, index),
            role,
            parent_client_id: optionalText(item.parent_client_id),
            entity_label: optionalText(item.entity_label),
            billing_client_id: optionalText(item.billing_client_id),
            is_parent_client: optionalBoolean(item.is_parent_client),
            is_child_client: optionalBoolean(item.is_child_client),
            inherited: optionalBoolean(item.inherited),
            inherited_from_client_id: optionalText(item.inherited_from_client_id),
            permissions: normalizePermissions(item.permissions),
          };
        })
        .filter((item) => Boolean(item.id));
      const dedupedClients = normalizedClients.filter(
        (client, index, list) => list.findIndex((entry) => entry.id === client.id) === index,
      );

      const scopedDefaultClientId = String(scope.default_client_id || "").trim();
      const validIds = new Set(dedupedClients.map((client) => client.id));
      const membershipClientId =
        normalizedMemberships.find((membership) => validIds.has(membership.client_id))?.client_id || "";
      const storedClientId = readStoredClientId();
      const queryClientId = !queryClientIdConsumedRef.current ? queryClientIdRef.current : "";

      setClients(dedupedClients);
      setMemberships(normalizedMemberships);
      setDefaultClientId(scopedDefaultClientId);
      setIsGlobalAdmin(me.isGlobalAdmin === true);

      setSelectedClientIdState((current) => {
        const activeClientId = String(current || "").trim();
        const resolvedClientId =
          (queryClientId && validIds.has(queryClientId) ? queryClientId : "") ||
          (activeClientId && validIds.has(activeClientId) ? activeClientId : "") ||
          (storedClientId && validIds.has(storedClientId) ? storedClientId : "") ||
          (scopedDefaultClientId && validIds.has(scopedDefaultClientId) ? scopedDefaultClientId : "") ||
          (membershipClientId && validIds.has(membershipClientId) ? membershipClientId : "") ||
          (dedupedClients[0]?.id || "");
        writeStoredClientId(resolvedClientId);
        return resolvedClientId;
      });
      if (dedupedClients.length > 0) {
        queryClientIdConsumedRef.current = true;
      }
    } catch (bootstrapError) {
      setClients([]);
      setSelectedClientIdState("");
      setMemberships([]);
      setDefaultClientId("");
      setIsGlobalAdmin(false);
      setError(
        bootstrapError instanceof Error
          ? bootstrapError.message
          : "Could not load client accounts.",
      );
    } finally {
      setLoading(false);
    }
  }, [fetchJson]);

  useEffect(() => {
    let mounted = true;
    void refreshClients();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      if (!session) {
        setClients([]);
        setSelectedClientIdState("");
        setMemberships([]);
        setDefaultClientId("");
        setIsGlobalAdmin(false);
        setLoading(false);
        return;
      }
      void refreshClients().catch(() => {
        if (!mounted) return;
        setError("Could not load client accounts.");
        setLoading(false);
      });
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [refreshClients]);

  return (
    <ClientContext.Provider
      value={{
        clients,
        selectedClient,
        selectedClientId,
        setSelectedClient,
        setSelectedClientId,
        loading,
        error,
        isGlobalAdmin,
        memberships,
        defaultClientId,
        refreshClients,
      }}
    >
      {children}
    </ClientContext.Provider>
  );
}

export function useClient() {
  return useContext(ClientContext);
}
