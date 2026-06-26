import * as Sentry from "@sentry/react";

const env =
  typeof import.meta !== "undefined" && import.meta.env ? import.meta.env : {};

const SENSITIVE_KEY_PATTERN =
  /(authorization|auth|token|secret|cookie|password|passwd|credential|session|csrf|xsrf|email|e-mail|phone|name|first_name|last_name|full_name|ip|address|message|resume|transcript|recording|form|input|field|value|body|payload|headers?)/i;
const BEARER_TOKEN_PATTERN = /Bearer\s+[A-Za-z0-9._~+/=-]+/gi;
const SECRET_TOKEN_PATTERN = /\b(?:sk|pk|rk|eyJ)[A-Za-z0-9._-]{12,}\b/g;
const EMAIL_PATTERN = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const IP_ADDRESS_PATTERN = /\b(?:\d{1,3}\.){3}\d{1,3}\b/g;
const SENSITIVE_QUERY_PATTERN = /([?&](?:token|auth|authorization|code|secret|session|password|key)=)[^&#\s]+/gi;
const PUBLIC_ANALYTICS_EVENTS_PATH = "/api/public-analytics/events";

let initialized = false;

function envText(key: string): string {
  const value = (env as Record<string, unknown>)[key];
  return typeof value === "string" ? value.trim() : "";
}

function sanitizeString(value: string): string {
  return value
    .replace(BEARER_TOKEN_PATTERN, "Bearer [redacted]")
    .replace(SECRET_TOKEN_PATTERN, "[redacted]")
    .replace(EMAIL_PATTERN, "[redacted-email]")
    .replace(IP_ADDRESS_PATTERN, "[redacted-ip]")
    .replace(SENSITIVE_QUERY_PATTERN, "$1[redacted]")
    .slice(0, 500);
}

function sanitizeValue(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return value;
  if (depth > 4) return "[redacted]";
  if (typeof value === "string") return sanitizeString(value);
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => sanitizeValue(item, depth + 1));
  if (typeof value !== "object") return "[redacted]";

  const safe: Record<string, unknown> = {};
  for (const [key, rawValue] of Object.entries(value as Record<string, unknown>)) {
    if (SENSITIVE_KEY_PATTERN.test(key)) {
      safe[key] = "[redacted]";
    } else {
      safe[key] = sanitizeValue(rawValue, depth + 1);
    }
  }
  return safe;
}

type SentryException = NonNullable<NonNullable<Sentry.ErrorEvent["exception"]>["values"]>[number];

function textIncludesFailedFetch(value: unknown): boolean {
  return typeof value === "string" && value.toLowerCase().includes("failed to fetch");
}

function textIncludesPublicAnalyticsEvents(value: unknown): boolean {
  return typeof value === "string" && value.includes(PUBLIC_ANALYTICS_EVENTS_PATH);
}

function isPublicAnalyticsFetchFailure(event: Sentry.ErrorEvent): boolean {
  const exceptionValues = event.exception?.values || [];
  const hasFailedFetch =
    textIncludesFailedFetch(event.message) ||
    exceptionValues.some((exception) => (
      textIncludesFailedFetch(exception.value) ||
      textIncludesFailedFetch(exception.type)
    ));

  if (!hasFailedFetch) return false;

  return Boolean(
    textIncludesPublicAnalyticsEvents(event.request?.url) ||
    event.breadcrumbs?.some((breadcrumb) => (
      textIncludesPublicAnalyticsEvents(breadcrumb.message) ||
      Object.values((breadcrumb.data || {}) as Record<string, unknown>).some(textIncludesPublicAnalyticsEvents)
    )),
  );
}

function sanitizeException(exception: SentryException): SentryException {
  return {
    ...exception,
    type: exception.type ? sanitizeString(exception.type) : exception.type,
    value: exception.value ? sanitizeString(exception.value) : exception.value,
    mechanism: exception.mechanism
      ? (sanitizeValue(exception.mechanism) as SentryException["mechanism"])
      : exception.mechanism,
    stacktrace: exception.stacktrace
      ? {
          ...exception.stacktrace,
          frames: exception.stacktrace.frames?.map((frame) => ({
            ...frame,
            vars: undefined,
            context_line: frame.context_line ? sanitizeString(frame.context_line) : frame.context_line,
            pre_context: frame.pre_context?.map(sanitizeString),
            post_context: frame.post_context?.map(sanitizeString),
          })),
        }
      : exception.stacktrace,
  };
}

function sanitizeEvent(event: Sentry.ErrorEvent): Sentry.ErrorEvent {
  const safeEvent: Sentry.ErrorEvent = {
    ...event,
    user: undefined,
    request: undefined,
    message: event.message ? sanitizeString(event.message) : event.message,
  };

  if (event.exception?.values) {
    safeEvent.exception = {
      ...event.exception,
      values: event.exception.values.map(sanitizeException),
    };
  }

  if (event.breadcrumbs) {
    safeEvent.breadcrumbs = event.breadcrumbs.map((breadcrumb) => ({
      ...breadcrumb,
      message: breadcrumb.message ? sanitizeString(breadcrumb.message) : breadcrumb.message,
      data: breadcrumb.data ? (sanitizeValue(breadcrumb.data) as Record<string, unknown>) : breadcrumb.data,
    }));
  }

  if (event.extra) {
    safeEvent.extra = sanitizeValue(event.extra) as Record<string, unknown>;
  }

  if (event.contexts) {
    const contexts = sanitizeValue(event.contexts) as Record<string, unknown>;
    delete contexts.trace;
    safeEvent.contexts = contexts as Sentry.ErrorEvent["contexts"];
  }

  if (event.tags) {
    safeEvent.tags = sanitizeValue(event.tags) as Sentry.ErrorEvent["tags"];
  }

  return safeEvent;
}

export function initSentry() {
  if (initialized || typeof window === "undefined") return;

  const dsn = envText("VITE_SENTRY_DSN");
  if (!dsn) return;

  initialized = true;
  Sentry.init({
    dsn,
    environment: envText("VITE_SENTRY_ENV") || "qa",
    release: envText("VITE_SENTRY_RELEASE") || undefined,
    sendDefaultPii: false,
    beforeSend: (event) => (isPublicAnalyticsFetchFailure(event) ? null : sanitizeEvent(event)),
  });
}

export function isSentryEnabled(): boolean {
  return initialized;
}
