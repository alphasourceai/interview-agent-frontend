export type SalesPlanKey = "basic" | "pro";
export type SalesBillingCadence = "monthly" | "annual";

export type SalesDealStatus =
  | "agreement_sent"
  | "signed_payment_needed"
  | "checkout_in_progress"
  | "setup_in_progress"
  | "activated"
  | "needs_attention"
  | "expired"
  | "canceled";

export type SalesDealAction =
  | "resend_agreement"
  | "send_payment_reminder"
  | "cancel"
  | "start_replacement"
  | "escalate"
  | "view";

export interface SalesRep {
  user_id: string;
  email: string;
  display_name: string;
  access_role: "sales_rep" | "global_admin";
}

export interface SalesPackage {
  plan_key: SalesPlanKey;
  display_name: "Essential" | "Pro";
  platform_monthly_fee_cents: number;
  platform_annual_fee_cents: number;
  per_role_fee_cents: number;
  included_interviews_per_role: number;
  max_interview_minutes: number;
  additional_interview_fee_cents: number;
  first_role_prepay: {
    enabled: boolean;
    amount_cents: number;
    normal_role_fee_cents: number;
    discount_label: string;
  };
}

export interface SalesCustomerInput {
  company_legal_name: string;
  company_dba: string;
  buyer_first_name: string;
  buyer_last_name: string;
  buyer_email: string;
  buyer_phone: string;
  buyer_title: string;
  candidate_assistance_name: string;
  candidate_assistance_email: string;
  ghl_import_id: string;
  ghl_contact_id: string;
  ghl_opportunity_id: string;
  sales_note: string;
}

export interface GhlSalesImport {
  id: string;
  status: "ready" | "linked" | "won_pending" | "won" | "exception" | "detached";
  sync_state: string;
  company_name: string;
  buyer_first_name: string;
  buyer_last_name: string;
  buyer_email: string;
  buyer_phone: string;
  buyer_title: string;
  opportunity_name: string;
  opportunity_source: string;
  ghl_contact_id: string;
  ghl_opportunity_id: string;
  purchase_intent_id: string | null;
  imported_at: string;
  updated_at: string;
  provider_url: string;
}

export interface PromotionCodeSummary {
  code: string;
  promotion_code_id: string;
  label: string;
  amount_off_cents: number | null;
  percent_off: number | null;
  expires_at: string | null;
}

export interface SalesDealDraft extends SalesCustomerInput {
  plan_key: SalesPlanKey;
  billing_cadence: SalesBillingCadence;
  first_role_prepay_selected: boolean;
  promotion_code: string;
}

export interface SalesPricingSummary {
  platform_fee_cents: number;
  first_role_prepay_cents: number;
  promotion_discount_cents: number;
  initial_payment_cents: number;
  recurring_platform_fee_cents: number;
  per_role_fee_cents: number;
  promotion: PromotionCodeSummary | null;
}

export interface SalesAgreementPreview {
  preview_id: string;
  preview_url: string;
  expires_at: string;
  agreement_effective_date: string;
  agreement_renewal_date: string;
  agreement_expires_at: string;
  normalized_draft: SalesDealDraft;
  pricing: SalesPricingSummary;
}

export interface SalesDeal {
  id: string;
  company_legal_name: string;
  company_dba: string;
  buyer_name: string;
  buyer_email: string;
  plan_key: SalesPlanKey;
  plan_name: "Essential" | "Pro";
  billing_cadence: SalesBillingCadence;
  status: SalesDealStatus;
  status_label: string;
  initial_payment_cents: number;
  promotion_label: string | null;
  created_at: string;
  updated_at: string;
  last_activity_at?: string;
  next_action: SalesDealAction;
  available_actions: SalesDealAction[];
  ghl_opportunity_id: string | null;
}

export interface SalesDealTimelineEvent {
  id: string;
  event_type: string;
  safe_metadata: Record<string, unknown>;
  created_at: string;
}

export interface SalesDealDetail extends SalesDeal {
  buyer_phone: string;
  buyer_title: string;
  candidate_assistance_name: string;
  candidate_assistance_email: string;
  ghl_contact_id: string | null;
  sales_note: string;
  timeline: SalesDealTimelineEvent[];
}

export interface SalesDealCreateResult {
  deal: SalesDeal;
  message: string;
}

export interface EnterpriseHandoffInput {
  company_name: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  estimated_monthly_interviews: string;
  locations: string;
  desired_timeline: string;
  requirements: string;
  notes: string;
  ghl_contact_id: string;
  ghl_opportunity_id: string;
}

export interface EnterpriseHandoffResult {
  handoff_id: string;
  message: string;
}

export interface SalesApi {
  getMe(): Promise<SalesRep>;
  getPackages(): Promise<SalesPackage[]>;
  listDeals(): Promise<SalesDeal[]>;
  listImports(): Promise<GhlSalesImport[]>;
  getImport(importId: string): Promise<GhlSalesImport>;
  getDeal(dealId: string): Promise<SalesDealDetail>;
  validatePromotionCode(code: string, draft: SalesDealDraft): Promise<PromotionCodeSummary>;
  previewDeal(draft: SalesDealDraft): Promise<SalesAgreementPreview>;
  createDeal(draft: SalesDealDraft, previewId: string, idempotencyKey: string): Promise<SalesDealCreateResult>;
  resendAgreement(dealId: string): Promise<{ message: string }>;
  sendPaymentReminder(dealId: string): Promise<{ message: string }>;
  cancelDeal(dealId: string): Promise<{ deal: SalesDeal; message: string }>;
  createEnterpriseHandoff(input: EnterpriseHandoffInput): Promise<EnterpriseHandoffResult>;
}
