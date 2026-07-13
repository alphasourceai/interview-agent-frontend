import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";

const TRACKING_PREFERENCES_STORAGE_KEY = "alphasource:tracking-preferences:v2";
const LEGACY_TRACKING_CONSENT_STORAGE_KEY = "alphasource:tracking-consent:v1";
const ANALYTICS_ANONYMOUS_ID_STORAGE_KEY = "alphasource:anonymous_id";
const ANALYTICS_SESSION_ID_STORAGE_KEY = "alphasource:session_id";

export const PUBLIC_OPTIONAL_TRACKING_ROUTES = new Set([
  "/",
  "/about",
  "/alphascreen",
  "/alphascreen/pricing",
  "/alphascreen/how-it-works",
  "/alphascreen/security",
  "/alphascreen/candidate-experience",
  "/alphascreen/for-dental-groups",
  "/alphascreen/roi",
  "/faq",
  "/support",
  "/terms",
  "/privacy",
]);

export type OptionalTrackingPreferences = {
  analytics: boolean;
  marketingAttribution: boolean;
  visitorChat: boolean;
  updatedAt: string;
};

export type OptionalTrackingSelection = Pick<
  OptionalTrackingPreferences,
  "analytics" | "marketingAttribution" | "visitorChat"
>;

type LegacyTrackingConsentChoice = "granted" | "denied";

type TrackingConsentContextValue = {
  analyticsEnabled: boolean;
  allowAllOptionalTracking: () => void;
  closeTrackingPreferences: () => void;
  hasSavedPreferences: boolean;
  marketingAttributionEnabled: boolean;
  openTrackingPreferences: () => void;
  preferences: OptionalTrackingPreferences | null;
  preferencesOpen: boolean;
  rejectOptionalTracking: () => void;
  savePreferences: (selection: OptionalTrackingSelection) => void;
  visitorChatEnabled: boolean;
};

const EMPTY_OPTIONAL_TRACKING_SELECTION: OptionalTrackingSelection = {
  analytics: false,
  marketingAttribution: false,
  visitorChat: false,
};

const ALL_OPTIONAL_TRACKING_SELECTION: OptionalTrackingSelection = {
  analytics: true,
  marketingAttribution: true,
  visitorChat: true,
};

const TrackingConsentContext = createContext<TrackingConsentContextValue | null>(null);

export function normalizeTrackingPath(path: string): string {
  const clean = String(path || "/").split("?")[0].split("#")[0] || "/";
  return clean.length > 1 ? clean.replace(/\/+$/, "") : "/";
}

export function isPublicOptionalTrackingRoute(path: string): boolean {
  return PUBLIC_OPTIONAL_TRACKING_ROUTES.has(normalizeTrackingPath(path));
}

function isValidUpdatedAt(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const timestamp = new Date(value);
  return Number.isFinite(timestamp.getTime()) && timestamp.toISOString() === value;
}

function parseStoredPreferences(value: string | null): OptionalTrackingPreferences | null {
  if (!value) return null;

  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== "object") return null;

    const preferences = parsed as Partial<OptionalTrackingPreferences>;
    if (
      typeof preferences.analytics !== "boolean" ||
      typeof preferences.marketingAttribution !== "boolean" ||
      typeof preferences.visitorChat !== "boolean" ||
      !isValidUpdatedAt(preferences.updatedAt)
    ) {
      return null;
    }

    return preferences as OptionalTrackingPreferences;
  } catch {
    return null;
  }
}

function savePreferencesToStorage(preferences: OptionalTrackingPreferences): boolean {
  try {
    window.localStorage.setItem(TRACKING_PREFERENCES_STORAGE_KEY, JSON.stringify(preferences));
    return true;
  } catch {
    return false;
  }
}

function clearOptionalTrackingIdentifiers(): void {
  try {
    window.localStorage.removeItem(ANALYTICS_ANONYMOUS_ID_STORAGE_KEY);
    window.sessionStorage.removeItem(ANALYTICS_SESSION_ID_STORAGE_KEY);
  } catch {
    // Storage can be unavailable in restrictive browser contexts.
  }
}

function readInitialPreferences(): OptionalTrackingPreferences | null {
  try {
    const storedPreferences = parseStoredPreferences(
      window.localStorage.getItem(TRACKING_PREFERENCES_STORAGE_KEY),
    );
    if (storedPreferences) return storedPreferences;

    const legacyConsent = window.localStorage.getItem(LEGACY_TRACKING_CONSENT_STORAGE_KEY);
    if (legacyConsent !== "granted" && legacyConsent !== "denied") return null;

    const legacySelection: OptionalTrackingSelection =
      (legacyConsent as LegacyTrackingConsentChoice) === "granted"
        ? ALL_OPTIONAL_TRACKING_SELECTION
        : EMPTY_OPTIONAL_TRACKING_SELECTION;
    const migratedPreferences: OptionalTrackingPreferences = {
      ...legacySelection,
      updatedAt: new Date().toISOString(),
    };

    if (savePreferencesToStorage(migratedPreferences)) {
      window.localStorage.removeItem(LEGACY_TRACKING_CONSENT_STORAGE_KEY);
    }

    return migratedPreferences;
  } catch {
    return null;
  }
}

export function TrackingConsentProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState<OptionalTrackingPreferences | null>(() =>
    typeof window === "undefined" ? null : readInitialPreferences(),
  );
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const triggerRef = useRef<HTMLElement | null>(null);

  const closeTrackingPreferences = useCallback(() => {
    setPreferencesOpen(false);
    window.requestAnimationFrame(() => {
      if (triggerRef.current?.isConnected) triggerRef.current.focus();
    });
  }, []);

  const openTrackingPreferences = useCallback(() => {
    if (document.activeElement instanceof HTMLElement) {
      triggerRef.current = document.activeElement;
    }
    setPreferencesOpen(true);
  }, []);

  const savePreferences = useCallback(
    (selection: OptionalTrackingSelection) => {
      const nextPreferences: OptionalTrackingPreferences = {
        analytics: Boolean(selection.analytics),
        marketingAttribution: Boolean(selection.marketingAttribution),
        visitorChat: Boolean(selection.visitorChat),
        updatedAt: new Date().toISOString(),
      };

      if (!nextPreferences.analytics) clearOptionalTrackingIdentifiers();
      savePreferencesToStorage(nextPreferences);
      setPreferences(nextPreferences);
      closeTrackingPreferences();
    },
    [closeTrackingPreferences],
  );

  const allowAllOptionalTracking = useCallback(() => {
    savePreferences(ALL_OPTIONAL_TRACKING_SELECTION);
  }, [savePreferences]);

  const rejectOptionalTracking = useCallback(() => {
    savePreferences(EMPTY_OPTIONAL_TRACKING_SELECTION);
  }, [savePreferences]);

  const value = useMemo<TrackingConsentContextValue>(
    () => ({
      analyticsEnabled: preferences?.analytics === true,
      allowAllOptionalTracking,
      closeTrackingPreferences,
      hasSavedPreferences: preferences !== null,
      marketingAttributionEnabled: preferences?.marketingAttribution === true,
      openTrackingPreferences,
      preferences,
      preferencesOpen,
      rejectOptionalTracking,
      savePreferences,
      visitorChatEnabled: preferences?.visitorChat === true,
    }),
    [
      allowAllOptionalTracking,
      closeTrackingPreferences,
      openTrackingPreferences,
      preferences,
      preferencesOpen,
      rejectOptionalTracking,
      savePreferences,
    ],
  );

  return <TrackingConsentContext.Provider value={value}>{children}</TrackingConsentContext.Provider>;
}

export function useTrackingConsent(): TrackingConsentContextValue {
  const context = useContext(TrackingConsentContext);
  if (!context) throw new Error("useTrackingConsent must be used within TrackingConsentProvider");
  return context;
}
