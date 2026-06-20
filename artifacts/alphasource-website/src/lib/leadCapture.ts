import {
  currentUtm,
  getAnonymousId,
  getSessionId,
  trackEvent,
} from "@/lib/analytics";
import { getPublicBackendBase, joinUrl } from "@/lib/urlConfig";

export const LEAD_CAPTURE_NOTICE_VERSION = "public-lead-capture-v1-2026-06-19";

export type LeadDraftStatus = "partial" | "abandoned" | "submitted";

export type LeadDraftFields = {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  message?: string;
};

type SaveLeadDraftInput = {
  draftId: string;
  formId: string;
  formType: string;
  productInterest: string;
  status: LeadDraftStatus;
  fields: LeadDraftFields;
  fieldsCompleted: string[];
  lastField?: string;
  cta?: string;
  keepalive?: boolean;
};

function safePath(value: string): string {
  if (!value) return "";
  try {
    return new URL(value, window.location.origin).pathname || "/";
  } catch {
    return String(value || "").split("?")[0].split("#")[0] || "";
  }
}

function leadEndpoint(): string {
  return joinUrl(getPublicBackendBase(), "/api/public-leads/draft");
}

export function createLeadDraftId(): string {
  try {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
      return crypto.randomUUID();
    }
  } catch {
    // no-op
  }
  const random = Math.random().toString(16).slice(2).padEnd(12, "0").slice(0, 12);
  return `10000000-1000-4000-8000-${random}`;
}

export function getLeadDraftId(formId: string): string {
  if (typeof window === "undefined") return createLeadDraftId();
  const key = `alphasource:lead_draft:${formId}`;
  try {
    const existing = String(window.localStorage.getItem(key) || "");
    if (existing) return existing;
    const next = createLeadDraftId();
    window.localStorage.setItem(key, next);
    return next;
  } catch {
    return createLeadDraftId();
  }
}

export function hasUsableContact(fields: LeadDraftFields): boolean {
  const email = String(fields.email || "").trim();
  const phoneDigits = String(fields.phone || "").replace(/\D+/g, "");
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || phoneDigits.length >= 7;
}

export async function saveLeadDraft(input: SaveLeadDraftInput): Promise<boolean> {
  if (!hasUsableContact(input.fields)) return false;
  const isSubmitted = input.status === "submitted";
  const fields: LeadDraftFields = {
    first_name: input.fields.first_name,
    last_name: input.fields.last_name,
    email: input.fields.email,
    phone: input.fields.phone,
    ...(isSubmitted ? { message: input.fields.message || "" } : {}),
  };

  const payload = {
    draft_id: input.draftId,
    form_id: input.formId,
    form_type: input.formType,
    product_interest: input.productInterest,
    status: input.status,
    fields,
    fields_completed: input.fieldsCompleted,
    last_field: input.lastField || "",
    anonymous_id: getAnonymousId(),
    session_id: getSessionId(),
    privacy_notice_version: LEAD_CAPTURE_NOTICE_VERSION,
    source: {
      path: typeof window !== "undefined" ? window.location.pathname || "/" : "/",
      referrer_path: typeof document !== "undefined" ? safePath(document.referrer || "") : "",
      cta: input.cta || "",
      utm: currentUtm(),
    },
  };

  try {
    const response = await fetch(leadEndpoint(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: input.keepalive === true,
    });
    if (!response.ok) throw new Error(`lead_capture_${response.status}`);
    trackEvent("lead_draft_saved", {
      form_id: input.formId,
      form_type: input.formType,
      status: input.status,
      fields_completed: input.fieldsCompleted,
    });
    return true;
  } catch {
    trackEvent("lead_draft_save_failed", {
      form_id: input.formId,
      form_type: input.formType,
      status: input.status,
    });
    return false;
  }
}
