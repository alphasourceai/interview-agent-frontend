import { supabase } from "@/lib/supabaseClient";
import type {
  EnterpriseHandoffInput,
  EnterpriseHandoffResult,
  GhlSalesImport,
  PromotionCodeSummary,
  SalesAgreementPreview,
  SalesApi,
  SalesDeal,
  SalesDealDetail,
  SalesDealCreateResult,
  SalesDealDraft,
  SalesPackage,
  SalesRep,
} from "@/features/sales/types";

const env = (typeof import.meta !== "undefined" && import.meta.env ? import.meta.env : {}) as Record<string, unknown>;

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

const salesMockRequested = String(env.VITE_SALES_API_MODE || "").trim().toLowerCase() === "mock";
export const salesUsesMockApi = import.meta.env.DEV === true && salesMockRequested;

export class SalesApiError extends Error {
  status: number;
  code: string;
  retryAfterSeconds: number | null;
  dealId: string | null;

  constructor(message: string, status = 500, code = "sales_api_error", retryAfterSeconds: number | null = null, dealId: string | null = null) {
    super(message);
    this.name = "SalesApiError";
    this.status = status;
    this.code = code;
    this.retryAfterSeconds = retryAfterSeconds;
    this.dealId = dealId;
  }
}

async function authHeaders(idempotencyKey?: string): Promise<Record<string, string>> {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.access_token) {
    throw new SalesApiError("Please sign in to continue.", 401, "authentication_required");
  }
  return {
    Authorization: `Bearer ${data.session.access_token}`,
    "Content-Type": "application/json",
    ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
  };
}

async function requestJson<T>(path: string, init: RequestInit = {}, idempotencyKey?: string): Promise<T> {
  if (!backendBase) {
    throw new SalesApiError("The sales API is not configured.", 503, "sales_api_not_configured");
  }
  const headers = await authHeaders(idempotencyKey);
  const response = await fetch(`${backendBase}${path}`, {
    ...init,
    headers: { ...headers, ...(init.headers || {}) },
    credentials: "omit",
  });
  const text = await response.text();
  let payload: unknown = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = null;
  }
  if (!response.ok) {
    const record = payload && typeof payload === "object" ? payload as Record<string, unknown> : {};
    const detail = String(record.detail || record.message || record.error || "The request could not be completed.");
    const code = String(record.code || record.error || "sales_api_error");
    const retry = Number(record.retry_after_seconds);
    const fields = record.fields && typeof record.fields === "object" ? record.fields as Record<string, unknown> : {};
    const dealId = typeof fields.deal_id === "string" && fields.deal_id.trim() ? fields.deal_id.trim() : null;
    if ((response.status === 401 || response.status === 403) && typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("alphasource:sales-auth-invalid", {
        detail: { status: response.status, code },
      }));
    }
    throw new SalesApiError(detail, response.status, code, Number.isFinite(retry) ? retry : null, dealId);
  }
  return payload as T;
}

function createIdempotencyKey(prefix: string): string {
  const random = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}:${random}`;
}

const realSalesApi: SalesApi = {
  getMe: () => requestJson<SalesRep>("/sales/me"),
  getPackages: () => requestJson<{ items: SalesPackage[] }>("/sales/packages").then((result) => result.items || []),
  listDeals: () => requestJson<{ items: SalesDeal[] }>("/sales/deals").then((result) => result.items || []),
  listImports: () => requestJson<{ items: GhlSalesImport[] }>("/sales/imports").then((result) => result.items || []),
  getImport: (importId) => requestJson<GhlSalesImport>(`/sales/imports/${encodeURIComponent(importId)}`),
  getDeal: (dealId) => requestJson<SalesDealDetail>(`/sales/deals/${encodeURIComponent(dealId)}`),
  validatePromotionCode: (code, draft) => requestJson<PromotionCodeSummary>("/sales/promotion-codes/validate", {
    method: "POST",
    body: JSON.stringify({
      code,
      plan_key: draft.plan_key,
      billing_cadence: draft.billing_cadence,
      first_role_prepay_selected: draft.first_role_prepay_selected,
    }),
  }, createIdempotencyKey("sales-promotion-validate")),
  previewDeal: (draft) => requestJson<SalesAgreementPreview>("/sales/deals/preview", {
    method: "POST",
    body: JSON.stringify(draft),
  }, createIdempotencyKey("sales-deal-preview")),
  createDeal: (draft, previewId, idempotencyKey) => requestJson<SalesDealCreateResult>("/sales/deals", {
    method: "POST",
    body: JSON.stringify({ ...draft, preview_id: previewId }),
  }, idempotencyKey),
  resendAgreement: (dealId) => requestJson<{ message: string }>(`/sales/deals/${encodeURIComponent(dealId)}/resend-agreement`, {
    method: "POST",
  }, createIdempotencyKey("sales-agreement-resend")),
  sendPaymentReminder: (dealId) => requestJson<{ message: string }>(`/sales/deals/${encodeURIComponent(dealId)}/send-payment-reminder`, {
    method: "POST",
  }, createIdempotencyKey("sales-payment-reminder")),
  cancelDeal: (dealId) => requestJson<{ deal: SalesDeal; message: string }>(`/sales/deals/${encodeURIComponent(dealId)}/cancel`, {
    method: "POST",
  }, createIdempotencyKey("sales-deal-cancel")),
  createEnterpriseHandoff: (input) => requestJson<EnterpriseHandoffResult>("/sales/enterprise-handoffs", {
    method: "POST",
    body: JSON.stringify(input),
  }, createIdempotencyKey("sales-enterprise-handoff")),
};

const mockPackages: SalesPackage[] = [
  {
    plan_key: "basic",
    display_name: "Essential",
    platform_monthly_fee_cents: 29900,
    platform_annual_fee_cents: 329900,
    per_role_fee_cents: 39900,
    included_interviews_per_role: 20,
    max_interview_minutes: 10,
    additional_interview_fee_cents: 3000,
    first_role_prepay: { enabled: true, amount_cents: 35900, normal_role_fee_cents: 39900, discount_label: "First-role prepay savings" },
  },
  {
    plan_key: "pro",
    display_name: "Pro",
    platform_monthly_fee_cents: 59900,
    platform_annual_fee_cents: 649900,
    per_role_fee_cents: 69900,
    included_interviews_per_role: 30,
    max_interview_minutes: 12,
    additional_interview_fee_cents: 3500,
    first_role_prepay: { enabled: true, amount_cents: 62900, normal_role_fee_cents: 69900, discount_label: "First-role prepay savings" },
  },
];

const mockDeals: SalesDeal[] = [
  {
    id: "deal-demo-1048",
    company_legal_name: "Summit Dental Partners LLC",
    company_dba: "Summit Dental",
    buyer_name: "Morgan Lee",
    buyer_email: "morgan@example.com",
    plan_key: "pro",
    plan_name: "Pro",
    billing_cadence: "annual",
    status: "signed_payment_needed",
    status_label: "Signed — payment needed",
    initial_payment_cents: 712800,
    promotion_label: null,
    created_at: "2026-09-16T16:20:00.000Z",
    updated_at: "2026-09-17T14:05:00.000Z",
    last_activity_at: "2026-09-17T14:05:00.000Z",
    next_action: "send_payment_reminder",
    available_actions: ["send_payment_reminder", "cancel"],
    ghl_opportunity_id: "opportunity_demo_1048",
  },
  {
    id: "deal-demo-1047",
    company_legal_name: "Front Range Ortho Group",
    company_dba: "",
    buyer_name: "Casey Bennett",
    buyer_email: "casey@example.com",
    plan_key: "basic",
    plan_name: "Essential",
    billing_cadence: "monthly",
    status: "agreement_sent",
    status_label: "Agreement sent",
    initial_payment_cents: 29900,
    promotion_label: null,
    created_at: "2026-09-16T15:10:00.000Z",
    updated_at: "2026-09-16T15:10:00.000Z",
    last_activity_at: "2026-09-16T15:10:00.000Z",
    next_action: "resend_agreement",
    available_actions: ["resend_agreement", "cancel"],
    ghl_opportunity_id: "opportunity_demo_1047",
  },
  {
    id: "deal-demo-1046",
    company_legal_name: "Peak Family Dentistry PLLC",
    company_dba: "Peak Family Dentistry",
    buyer_name: "Jordan Kim",
    buyer_email: "jordan@example.com",
    plan_key: "basic",
    plan_name: "Essential",
    billing_cadence: "annual",
    status: "activated",
    status_label: "Activated / Closed Won",
    initial_payment_cents: 365800,
    promotion_label: null,
    created_at: "2026-09-12T17:45:00.000Z",
    updated_at: "2026-09-13T19:22:00.000Z",
    last_activity_at: "2026-09-13T19:22:00.000Z",
    next_action: "view",
    available_actions: ["view"],
    ghl_opportunity_id: "opportunity_demo_1046",
  },
  {
    id: "deal-demo-1045",
    company_legal_name: "Aspen Grove Dental Care",
    company_dba: "",
    buyer_name: "Taylor Ruiz",
    buyer_email: "taylor@example.com",
    plan_key: "pro",
    plan_name: "Pro",
    billing_cadence: "monthly",
    status: "setup_in_progress",
    status_label: "Account setup in progress",
    initial_payment_cents: 59900,
    promotion_label: null,
    created_at: "2026-09-11T14:25:00.000Z",
    updated_at: "2026-09-11T14:40:00.000Z",
    last_activity_at: "2026-09-11T14:40:00.000Z",
    next_action: "escalate",
    available_actions: ["escalate"],
    ghl_opportunity_id: "opportunity_demo_1045",
  },
];

const mockImports: GhlSalesImport[] = [{
  id: "31000000-0000-4000-8000-000000000001",
  status: "ready",
  sync_state: "ready",
  company_name: "Canyon View Dental LLC",
  buyer_first_name: "Avery",
  buyer_last_name: "Stone",
  buyer_email: "avery@example.com",
  buyer_phone: "+17205550199",
  buyer_title: "Owner",
  opportunity_name: "Canyon View Dental - alphaScreen",
  opportunity_source: "Outbound",
  ghl_contact_id: "contact_demo_ready",
  ghl_opportunity_id: "opportunity_demo_ready",
  purchase_intent_id: null,
  imported_at: "2026-09-22T16:00:00.000Z",
  updated_at: "2026-09-22T16:00:00.000Z",
  provider_url: "https://app.gohighlevel.com/v2/location/demo/opportunities/list",
}];

function delay(ms = 260): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function packageForDraft(draft: SalesDealDraft): SalesPackage {
  const selected = mockPackages.find((pkg) => pkg.plan_key === draft.plan_key);
  if (!selected) throw new SalesApiError("Select an available membership.", 400, "invalid_plan");
  return selected;
}

function mockPricing(draft: SalesDealDraft, promotion: PromotionCodeSummary | null): SalesAgreementPreview["pricing"] {
  const pkg = packageForDraft(draft);
  const platformFee = draft.billing_cadence === "annual" ? pkg.platform_annual_fee_cents : pkg.platform_monthly_fee_cents;
  const firstRole = draft.first_role_prepay_selected ? pkg.first_role_prepay.amount_cents : 0;
  const promotionDiscount = promotion?.percent_off ? Math.round(platformFee * (promotion.percent_off / 100)) : promotion?.amount_off_cents || 0;
  return {
    platform_fee_cents: platformFee,
    first_role_prepay_cents: firstRole,
    promotion_discount_cents: promotionDiscount,
    initial_payment_cents: Math.max(0, platformFee + firstRole - promotionDiscount),
    recurring_platform_fee_cents: platformFee,
    per_role_fee_cents: pkg.per_role_fee_cents,
    promotion,
  };
}

const mockPromotion: PromotionCodeSummary = {
  code: "DEMO10",
  promotion_code_id: "promo_demo_fixture",
  label: "10% off the initial platform fee",
  amount_off_cents: null,
  percent_off: 10,
  expires_at: null,
};

const mockSalesApi: SalesApi = {
  async getMe() {
    await delay(120);
    return { user_id: "sales-rep-demo", email: "michael@alphasourceai.com", display_name: "Michael Afesi", access_role: "sales_rep" };
  },
  async getPackages() {
    await delay();
    return structuredClone(mockPackages);
  },
  async listDeals() {
    await delay();
    return structuredClone(mockDeals);
  },
  async listImports() {
    await delay();
    return structuredClone(mockImports);
  },
  async getImport(importId) {
    await delay();
    const item = mockImports.find((candidate) => candidate.id === importId);
    if (!item) throw new SalesApiError("GHL sales draft not found.", 404, "ghl_import_not_found");
    return structuredClone(item);
  },
  async getDeal(dealId) {
    await delay();
    const deal = mockDeals.find((item) => item.id === dealId);
    if (!deal) throw new SalesApiError("Deal not found.", 404, "deal_not_found");
    return {
      ...structuredClone(deal),
      buyer_phone: "720-555-0148",
      buyer_title: "Owner",
      candidate_assistance_name: deal.buyer_name,
      candidate_assistance_email: deal.buyer_email,
      ghl_contact_id: `contact_${deal.id}`,
      sales_note: "Buyer reviewed the membership options during the discovery call.",
      timeline: [
        {
          id: `event_sent_${deal.id}`,
          event_type: "agreement_sent",
          safe_metadata: {},
          created_at: deal.created_at,
        },
        ...(["signed_payment_needed", "checkout_in_progress", "setup_in_progress", "activated"].includes(deal.status) ? [{
          id: `event_signed_${deal.id}`,
          event_type: "agreement_signed",
          safe_metadata: {},
          created_at: deal.last_activity_at || deal.updated_at,
        }] : []),
        ...(deal.status === "activated" ? [{
          id: `event_activated_${deal.id}`,
          event_type: "account_activated",
          safe_metadata: {},
          created_at: deal.last_activity_at || deal.updated_at,
        }] : []),
      ],
    };
  },
  async validatePromotionCode(code) {
    await delay();
    if (code.trim().toUpperCase() !== "DEMO10") {
      throw new SalesApiError("That code is inactive, expired, or not eligible for this membership.", 422, "promotion_code_invalid");
    }
    return structuredClone(mockPromotion);
  },
  async previewDeal(draft) {
    await delay(420);
    const promotion = draft.promotion_code.trim().toUpperCase() === "DEMO10" ? mockPromotion : null;
    const pricing = mockPricing(draft, promotion);
    const effectiveDate = new Date().toISOString().slice(0, 10);
    const renewal = new Date(`${effectiveDate}T12:00:00`);
    renewal.setFullYear(renewal.getFullYear() + 1);
    const renewalDate = renewal.toISOString().slice(0, 10);
    const agreementExpiresAt = new Date(`${effectiveDate}T23:59:59.999`).toISOString();
    const agreementText = `alphaScreen membership agreement preview\n\nCompany: ${draft.company_legal_name}\nMembership: ${packageForDraft(draft).display_name}\nBilling: ${draft.billing_cadence}\nMembership begins: ${effectiveDate}\nInitial renewal date: ${renewalDate}\n\nPrototype preview only.`;
    return {
      preview_id: `preview-${Date.now()}`,
      preview_url: `data:text/plain;charset=utf-8,${encodeURIComponent(agreementText)}`,
      expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      agreement_effective_date: effectiveDate,
      agreement_renewal_date: renewalDate,
      agreement_expires_at: agreementExpiresAt,
      normalized_draft: structuredClone(draft),
      pricing,
    };
  },
  async createDeal(draft, previewId) {
    await delay(520);
    if (!previewId) throw new SalesApiError("Preview the agreement before sending it.", 409, "preview_required");
    const pkg = packageForDraft(draft);
    const promotion = draft.promotion_code.trim().toUpperCase() === "DEMO10" ? mockPromotion : null;
    const now = new Date().toISOString();
    const deal: SalesDeal = {
      id: `deal-demo-${Date.now()}`,
      company_legal_name: draft.company_legal_name,
      company_dba: draft.company_dba,
      buyer_name: `${draft.buyer_first_name} ${draft.buyer_last_name}`.trim(),
      buyer_email: draft.buyer_email,
      plan_key: draft.plan_key,
      plan_name: pkg.display_name,
      billing_cadence: draft.billing_cadence,
      status: "agreement_sent",
      status_label: "Agreement sent",
      initial_payment_cents: mockPricing(draft, promotion).initial_payment_cents,
      promotion_label: promotion?.label || null,
      created_at: now,
      updated_at: now,
      last_activity_at: now,
      next_action: "resend_agreement",
      available_actions: ["resend_agreement", "cancel"],
      ghl_opportunity_id: draft.ghl_opportunity_id || null,
    };
    mockDeals.unshift(deal);
    return { deal: structuredClone(deal), message: `Agreement sent to ${draft.buyer_email}.` };
  },
  async resendAgreement() {
    await delay();
    return { message: "The agreement email was sent again." };
  },
  async sendPaymentReminder() {
    await delay();
    return { message: "The payment reminder was sent." };
  },
  async cancelDeal(dealId) {
    await delay();
    const deal = mockDeals.find((item) => item.id === dealId);
    if (!deal) throw new SalesApiError("Deal not found.", 404, "deal_not_found");
    if (deal.status === "activated") throw new SalesApiError("Paid agreements require administrator handling.", 409, "agreement_already_paid");
    deal.status = "canceled";
    deal.status_label = "Canceled";
    deal.next_action = "view";
    deal.available_actions = ["view"];
    deal.updated_at = new Date().toISOString();
    deal.last_activity_at = deal.updated_at;
    return { deal: structuredClone(deal), message: "The unpaid transaction was canceled." };
  },
  async createEnterpriseHandoff(input) {
    await delay(480);
    return { handoff_id: `handoff-demo-${Date.now()}`, message: `${input.company_name} was recorded for executive follow-up.` };
  },
};

export const salesApi: SalesApi = salesUsesMockApi ? mockSalesApi : realSalesApi;
