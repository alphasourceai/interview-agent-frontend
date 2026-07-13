import { createContext, useCallback, useContext, useEffect, useRef, useState, ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";

interface ClientLoginResult {
  error: string | null;
}

interface AdminLoginResult {
  error: string | null;
}

interface AuthContextType {
  isLoggedIn: boolean;
  clientAuthReady: boolean;
  adminAuthReady: boolean;
  isAdminLoggedIn: boolean;
  clientLoginLoading: boolean;
  clientLoginError: string;
  adminLoginLoading: boolean;
  adminLoginError: string;
  login: (email: string, password: string) => Promise<ClientLoginResult>;
  loginAdmin: (email: string, password: string) => Promise<AdminLoginResult>;
  resolveAdminAccess: () => Promise<boolean>;
  clearAdminLoginError: () => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  isLoggedIn: false,
  clientAuthReady: false,
  adminAuthReady: false,
  isAdminLoggedIn: false,
  clientLoginLoading: false,
  clientLoginError: "",
  adminLoginLoading: false,
  adminLoginError: "",
  login: async () => ({ error: null }),
  loginAdmin: async () => ({ error: null }),
  resolveAdminAccess: async () => false,
  clearAdminLoginError: () => {},
  logout: () => {},
});

const isValidEmail = (value: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());

const env =
  (typeof import.meta !== "undefined" && import.meta.env ? import.meta.env : {}) as Record<string, unknown>;

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
  env.VITE_BACKEND_URL,
  env.VITE_API_URL,
  env.VITE_PUBLIC_BACKEND_URL,
  env.PUBLIC_BACKEND_URL,
  env.BACKEND_URL,
);
const DASHBOARD_ACTIVITY_STORAGE_KEY = "alphasource:dashboard_last_activity_ms";
const DASHBOARD_INACTIVITY_LIMIT_MS = 60 * 60 * 1000;

function readStoredDashboardActivity(): number {
  if (typeof window === "undefined") return 0;
  try {
    const raw = window.localStorage.getItem(DASHBOARD_ACTIVITY_STORAGE_KEY);
    const parsed = Number(raw || "");
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  } catch {
    return 0;
  }
}

function seedDashboardActivityNow() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(DASHBOARD_ACTIVITY_STORAGE_KEY, String(Date.now()));
  } catch {}
}

function clearDashboardActivity() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(DASHBOARD_ACTIVITY_STORAGE_KEY);
  } catch {}
}

function hasStaleDashboardActivity(): boolean {
  const last = readStoredDashboardActivity();
  return last > 0 && (Date.now() - last) >= DASHBOARD_INACTIVITY_LIMIT_MS;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isLoggedIn, setIsLoggedIn]           = useState(false);
  const [clientAuthReady, setClientAuthReady] = useState(false);
  const [adminAuthReady, setAdminAuthReady]   = useState(false);
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [clientLoginLoading, setClientLoginLoading] = useState(false);
  const [clientLoginError, setClientLoginError]     = useState("");
  const [adminLoginLoading, setAdminLoginLoading]   = useState(false);
  const [adminLoginError, setAdminLoginError]       = useState("");
  const adminProbeRef = useRef(0);

  const probeAdminAccess = useCallback(async (session: Session): Promise<{ ok: true } | { ok: false; error: string }> => {
    const token = session?.access_token;
    if (!token) {
      return { ok: false, error: "Missing session token." };
    }

    if (!backendBase) {
      return { ok: false, error: "Missing backend base URL configuration." };
    }

    try {
      const res = await fetch(`${backendBase}/admin/clients`, {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
        credentials: "omit",
      });

      const text = await res.text();
      let data: unknown = null;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        data = null;
      }

      if (res.ok) {
        if (data && typeof data === "object" && Array.isArray((data as { items?: unknown }).items)) {
          return { ok: true };
        }
        return { ok: false, error: "Could not verify admin access." };
      }

      let message = text || `HTTP ${res.status}`;
      if (data && typeof data === "object") {
        const candidate =
          (data as { detail?: unknown }).detail ??
          (data as { message?: unknown }).message ??
          (data as { error?: unknown }).error;
        if (typeof candidate === "string" && candidate.trim()) {
          message = candidate;
        }
      }

      if (res.status === 401 || res.status === 403) {
        return { ok: false, error: "Your account is not an admin." };
      }

      return { ok: false, error: message };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : "Could not verify admin access.",
      };
    }
  }, []);

  const syncAdminFromSession = useCallback(async (session: Session | null): Promise<boolean> => {
    const probeId = ++adminProbeRef.current;

    if (!session) {
      setIsAdminLoggedIn(false);
      setAdminAuthReady(true);
      return false;
    }

    setAdminAuthReady(false);
    const probe = await probeAdminAccess(session);
    if (probeId !== adminProbeRef.current) return false;

    setIsAdminLoggedIn(probe.ok);
    setAdminAuthReady(true);
    return probe.ok;
  }, [probeAdminAccess]);

  const resolveAdminAccess = useCallback(async (): Promise<boolean> => {
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) {
        adminProbeRef.current += 1;
        setIsAdminLoggedIn(false);
        setAdminAuthReady(true);
        return false;
      }
      return syncAdminFromSession(data.session || null);
    } catch {
      adminProbeRef.current += 1;
      setIsAdminLoggedIn(false);
      setAdminAuthReady(true);
      return false;
    }
  }, [syncAdminFromSession]);

  useEffect(() => {
    let mounted = true;

    supabase.auth
      .getSession()
      .then(async ({ data }) => {
        if (!mounted) return;
        const session = data.session || null;
        if (session && hasStaleDashboardActivity()) {
          clearDashboardActivity();
          await supabase.auth.signOut({ scope: "local" }).catch(() => {});
          setIsLoggedIn(false);
          setClientAuthReady(true);
          setIsAdminLoggedIn(false);
          setAdminAuthReady(true);
          return;
        }
        if (session) {
          if (readStoredDashboardActivity() <= 0) {
            seedDashboardActivityNow();
          }
        } else {
          clearDashboardActivity();
        }
        setIsLoggedIn(Boolean(session));
        setClientAuthReady(true);
      })
      .catch(() => {
        if (!mounted) return;
        clearDashboardActivity();
        setIsLoggedIn(false);
        setClientAuthReady(true);
        setIsAdminLoggedIn(false);
        setAdminAuthReady(true);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && String(event || "") === "INITIAL_SESSION" && hasStaleDashboardActivity()) {
        clearDashboardActivity();
        setIsLoggedIn(false);
        setIsAdminLoggedIn(false);
        setAdminAuthReady(true);
        void supabase.auth.signOut({ scope: "local" }).catch(() => {});
        return;
      }
      if (!session) clearDashboardActivity();
      setIsLoggedIn(Boolean(session));
      if (!session) {
        adminProbeRef.current += 1;
        setIsAdminLoggedIn(false);
        setAdminAuthReady(true);
      } else if (String(event || "") === "SIGNED_IN") {
        adminProbeRef.current += 1;
        setIsAdminLoggedIn(false);
        setAdminAuthReady(true);
      }
    });

    return () => {
      mounted = false;
      adminProbeRef.current += 1;
      subscription.unsubscribe();
    };
  }, []);

  const login = async (email: string, password: string): Promise<ClientLoginResult> => {
    const normalizedEmail = String(email || "").trim();

    if (!normalizedEmail || !password) {
      const message = "Email and password are required.";
      setClientLoginError(message);
      return { error: message };
    }

    setClientLoginLoading(true);
    setClientLoginError("");

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });

      if (error) {
        const message = error.message || "Could not sign in.";
        setClientLoginError(message);
        return { error: message };
      }

      setIsLoggedIn(true);
      seedDashboardActivityNow();
      setClientLoginError("");
      return { error: null };
    } catch {
      const message = "Could not sign in.";
      setClientLoginError(message);
      return { error: message };
    } finally {
      setClientLoginLoading(false);
    }
  };

  const loginAdmin = async (email: string, password: string): Promise<AdminLoginResult> => {
    const normalizedEmail = String(email || "").trim();

    if (!normalizedEmail || !password) {
      const message = "Email and password are required.";
      setAdminLoginError(message);
      return { error: message };
    }

    if (!isValidEmail(normalizedEmail)) {
      const message = "Please enter a valid email address.";
      setAdminLoginError(message);
      return { error: message };
    }

    setAdminLoginLoading(true);
    setAdminLoginError("");
    setAdminAuthReady(false);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });

      if (error) {
        const message = error.message || "Could not sign in.";
        setAdminLoginError(message);
        setAdminAuthReady(true);
        return { error: message };
      }

      if (!data.session) {
        const message = "Could not sign in.";
        setAdminLoginError(message);
        setAdminAuthReady(true);
        return { error: message };
      }

      const probe = await probeAdminAccess(data.session);
      if (!probe.ok) {
        setAdminLoginError(probe.error);
        setIsAdminLoggedIn(false);
        clearDashboardActivity();
        await supabase.auth.signOut();
        setAdminAuthReady(true);
        return { error: probe.error };
      }

      setIsAdminLoggedIn(true);
      setAdminAuthReady(true);
      seedDashboardActivityNow();
      setAdminLoginError("");
      return { error: null };
    } catch {
      const message = "Could not sign in.";
      setAdminLoginError(message);
      setAdminAuthReady(true);
      return { error: message };
    } finally {
      setAdminLoginLoading(false);
    }
  };

  const clearAdminLoginError = () => setAdminLoginError("");

  const logout = () => {
    clearDashboardActivity();
    adminProbeRef.current += 1;
    void supabase.auth.signOut().catch(() => {});
    setIsLoggedIn(false);
    setIsAdminLoggedIn(false);
    setAdminAuthReady(true);
    setClientLoginError("");
    setClientLoginLoading(false);
    setAdminLoginError("");
    setAdminLoginLoading(false);
  };

  return (
    <AuthContext.Provider
      value={{
        isLoggedIn,
        clientAuthReady,
        adminAuthReady,
        isAdminLoggedIn,
        clientLoginLoading,
        clientLoginError,
        adminLoginLoading,
        adminLoginError,
        login,
        loginAdmin,
        resolveAdminAccess,
        clearAdminLoginError,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
