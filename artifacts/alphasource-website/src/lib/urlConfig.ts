type QueryValue = string | number | boolean | null | undefined;
type QueryInput = string | URLSearchParams | Record<string, QueryValue>;

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

export const canonicalFrontendBase = firstBase(
  (env as Record<string, unknown>).VITE_CLIENT_APP_BASE,
  (env as Record<string, unknown>).VITE_PUBLIC_SITE_BASE,
  (env as Record<string, unknown>).VITE_FRONTEND_BASE,
  (env as Record<string, unknown>).VITE_FRONTEND_URL,
  (env as Record<string, unknown>).VITE_APP_BASE_URL,
  (env as Record<string, unknown>).VITE_SITE_URL,
);

export const publicSiteBase = firstBase(
  (env as Record<string, unknown>).VITE_PUBLIC_SITE_BASE,
  (env as Record<string, unknown>).VITE_SITE_URL,
  (env as Record<string, unknown>).VITE_FRONTEND_URL,
  (env as Record<string, unknown>).VITE_APP_BASE_URL,
);

export const publicBackendBase = firstBase(
  (env as Record<string, unknown>).VITE_BACKEND_URL,
  (env as Record<string, unknown>).VITE_API_URL,
  (env as Record<string, unknown>).VITE_PUBLIC_BACKEND_URL,
  (env as Record<string, unknown>).PUBLIC_BACKEND_URL,
  (env as Record<string, unknown>).BACKEND_URL,
);

export function resolveWindowOrigin(): string {
  if (typeof window === "undefined" || !window.location) return "";
  return trimTrailingSlashes(window.location.origin);
}

function serializeQuery(query?: QueryInput): string {
  if (!query) return "";
  if (query instanceof URLSearchParams) return query.toString();
  if (typeof query === "string") return query.replace(/^\?+/, "");

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === null || value === undefined) continue;
    params.set(key, String(value));
  }
  return params.toString();
}

export function appendQuery(url: string, query?: QueryInput): string {
  const serialized = serializeQuery(query);
  return serialized ? `${url}?${serialized}` : url;
}

export function joinUrl(base: string, path: string): string {
  const cleanBase = trimTrailingSlashes(base);
  if (!cleanBase) return path.startsWith("/") ? path : `/${path}`;
  if (path.startsWith("/")) return `${cleanBase}${path}`;
  return `${cleanBase}/${path}`;
}

export function getPublicSiteBase(): string {
  return firstBase(publicSiteBase, canonicalFrontendBase, resolveWindowOrigin());
}

export function getPublicBackendBase(): string {
  return firstBase(publicBackendBase, resolveWindowOrigin());
}

export function buildPwResetUrl(
  query?: QueryInput,
  { base }: { base?: string } = {},
): string {
  const origin = firstBase(
    typeof base === "string" ? base : "",
    canonicalFrontendBase,
    resolveWindowOrigin(),
  );

  const pwResetBase = origin ? `${origin}/pwreset` : "/pwreset";
  return appendQuery(pwResetBase, query);
}
