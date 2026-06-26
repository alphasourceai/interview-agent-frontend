import { getPublicBackendBase, joinUrl } from "@/lib/urlConfig";

type AnalyticsProperties = Record<string, unknown>;

type AnalyticsPayload = {
  event_name: string;
  anonymous_id: string;
  session_id: string;
  path: string;
  page_title: string;
  referrer_path: string;
  utm: Record<string, string>;
  properties: AnalyticsProperties;
  occurred_at: string;
};

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

const env =
  typeof import.meta !== "undefined" && import.meta.env ? import.meta.env : {};

const ANALYTICS_ENABLED =
  (env as Record<string, unknown>).VITE_PUBLIC_ANALYTICS_ENABLED !== "false";
const ANONYMOUS_ID_KEY = "alphasource:anonymous_id";
const SESSION_ID_KEY = "alphasource:session_id";
const PII_PROPERTY_KEYS = new Set([
  "email",
  "phone",
  "name",
  "first_name",
  "last_name",
  "message",
  "company_name",
]);

function createId(prefix: string): string {
  try {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
      return `${prefix}_${crypto.randomUUID()}`;
    }
  } catch {
    // no-op
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function readStorage(storage: Storage | null, key: string): string {
  if (!storage) return "";
  try {
    return String(storage.getItem(key) || "");
  } catch {
    return "";
  }
}

function writeStorage(storage: Storage | null, key: string, value: string) {
  if (!storage) return;
  try {
    storage.setItem(key, value);
  } catch {
    // no-op
  }
}

function getStorage(kind: "local" | "session"): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return kind === "local" ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

export function getAnonymousId(): string {
  const storage = getStorage("local");
  const existing = readStorage(storage, ANONYMOUS_ID_KEY);
  if (existing) return existing;
  const next = createId("anon");
  writeStorage(storage, ANONYMOUS_ID_KEY, next);
  return next;
}

export function getSessionId(): string {
  const storage = getStorage("session");
  const existing = readStorage(storage, SESSION_ID_KEY);
  if (existing) return existing;
  const next = createId("session");
  writeStorage(storage, SESSION_ID_KEY, next);
  return next;
}

function cleanPath(value: string): string {
  if (!value) return "";
  try {
    const url = new URL(value, window.location.origin);
    return url.pathname || "/";
  } catch {
    return String(value || "").split("?")[0].split("#")[0] || "";
  }
}

function currentPath(): string {
  if (typeof window === "undefined") return "/";
  return window.location.pathname || "/";
}

export function currentUtm(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const params = new URLSearchParams(window.location.search || "");
  const utm: Record<string, string> = {};
  ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"].forEach((key) => {
    const value = String(params.get(key) || "").trim();
    if (value) utm[key] = value.slice(0, 160);
  });
  return utm;
}

function sanitizeProperties(properties: AnalyticsProperties = {}): AnalyticsProperties {
  const safe: AnalyticsProperties = {};
  for (const [key, rawValue] of Object.entries(properties || {})) {
    const normalizedKey = key.trim();
    if (!normalizedKey || PII_PROPERTY_KEYS.has(normalizedKey.toLowerCase())) continue;
    if (rawValue === null || rawValue === undefined) continue;
    if (typeof rawValue === "string") {
      safe[normalizedKey] = rawValue.slice(0, 300);
    } else if (typeof rawValue === "number" || typeof rawValue === "boolean") {
      safe[normalizedKey] = rawValue;
    } else if (Array.isArray(rawValue)) {
      safe[normalizedKey] = rawValue.slice(0, 20).map((item) => String(item).slice(0, 120));
    } else {
      safe[normalizedKey] = String(rawValue).slice(0, 300);
    }
  }
  return safe;
}

function endpoint(): string {
  return joinUrl(getPublicBackendBase(), "/api/public-analytics/events");
}

export function buildAnalyticsPayload(
  eventName: string,
  properties: AnalyticsProperties = {},
): AnalyticsPayload {
  const path = currentPath();
  return {
    event_name: eventName,
    anonymous_id: getAnonymousId(),
    session_id: getSessionId(),
    path,
    page_title: typeof document !== "undefined" ? document.title || "" : "",
    referrer_path: typeof document !== "undefined" ? cleanPath(document.referrer || "") : "",
    utm: currentUtm(),
    properties: sanitizeProperties(properties),
    occurred_at: new Date().toISOString(),
  };
}

export function trackEvent(eventName: string, properties: AnalyticsProperties = {}) {
  if (!ANALYTICS_ENABLED || typeof window === "undefined") return;
  const payload = buildAnalyticsPayload(eventName, properties);

  try {
    void fetch(endpoint(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    // Analytics must never block the page.
  }

  try {
    window.gtag?.("event", eventName, payload.properties);
  } catch {
    // no-op
  }
}

export function trackPageView(path: string) {
  trackEvent("page_viewed", { path: cleanPath(path) || "/" });
}

export function trackCtaClick(label: string, target: string, placement?: string) {
  trackEvent("cta_clicked", {
    cta_label: label,
    cta_target: cleanPath(target) || target,
    placement: placement || "unknown",
  });
}
