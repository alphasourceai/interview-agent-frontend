import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type AppearanceMode = "light" | "dark" | "system";
type ResolvedAppearanceMode = "light" | "dark";

interface AppearanceContextType {
  mode: AppearanceMode;
  resolvedMode: ResolvedAppearanceMode;
  setMode: (mode: AppearanceMode) => void;
}

const APPEARANCE_STORAGE_KEY = "alphasource:appearance";
const SYSTEM_DARK_QUERY = "(prefers-color-scheme: dark)";

const AppearanceContext = createContext<AppearanceContextType>({
  mode: "light",
  resolvedMode: "light",
  setMode: () => {},
});

function normalizeMode(value: unknown): AppearanceMode {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized === "dark" || normalized === "system" ? normalized : "light";
}

function readStoredMode(): AppearanceMode {
  if (typeof window === "undefined") return "light";
  try {
    return normalizeMode(window.localStorage.getItem(APPEARANCE_STORAGE_KEY));
  } catch {
    return "light";
  }
}

function readSystemMode(): ResolvedAppearanceMode {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return "light";
  return window.matchMedia(SYSTEM_DARK_QUERY).matches ? "dark" : "light";
}

function writeStoredMode(mode: AppearanceMode): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(APPEARANCE_STORAGE_KEY, mode);
  } catch {
    // Appearance still works for the current session if localStorage is unavailable.
  }
}

export function AppearanceProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<AppearanceMode>(() => readStoredMode());
  const [systemMode, setSystemMode] = useState<ResolvedAppearanceMode>(() => readSystemMode());

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mediaQuery = window.matchMedia(SYSTEM_DARK_QUERY);
    const syncSystemMode = () => setSystemMode(mediaQuery.matches ? "dark" : "light");
    syncSystemMode();
    mediaQuery.addEventListener?.("change", syncSystemMode);
    return () => mediaQuery.removeEventListener?.("change", syncSystemMode);
  }, []);

  const setMode = useCallback((nextMode: AppearanceMode) => {
    const normalized = normalizeMode(nextMode);
    setModeState(normalized);
    writeStoredMode(normalized);
  }, []);

  const resolvedMode = mode === "system" ? systemMode : mode;

  const value = useMemo(
    () => ({
      mode,
      resolvedMode,
      setMode,
    }),
    [mode, resolvedMode, setMode],
  );

  return (
    <AppearanceContext.Provider value={value}>
      {children}
    </AppearanceContext.Provider>
  );
}

export function useAppearance() {
  return useContext(AppearanceContext);
}
