import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import {
  ArrowRight,
  BadgeDollarSign,
  BriefcaseBusiness,
  Building2,
  CheckCircle,
  Clock3,
  Layers3,
  ShieldCheck,
  X,
} from "lucide-react";
import LeadCaptureForm from "@/components/LeadCaptureForm";
import { trackEvent } from "@/lib/analytics";
import { PUBLIC_CONTENT_LAST_UPDATED } from "@/lib/publicContent";
import { getPublicBackendBase, joinUrl } from "@/lib/urlConfig";

type PackageLoadState = "loading" | "ready" | "fallback";
type PurchaseIntentStatus = "idle" | "submitting" | "success";
type AgreementPrepStatus = "idle" | "preparing" | "ready";
type BillingCadenceKey = "monthly" | "annual";

type BillingCadence = {
  key?: string;
  display_name?: string;
  stripe_price_configured?: boolean;
};

type FirstRolePrepay = {
  enabled: boolean;
  selected?: boolean;
  credit_type?: string;
  normal_role_fee_cents: number;
  discounted_credit_amount_cents: number;
  discount_percent: number;
  non_refundable: boolean;
  expires: boolean;
  stripe_price_configured?: boolean;
};

type AlphaScreenPackage = {
  plan_key: string;
  display_name: string;
  platform_monthly_fee: number;
  platform_monthly_fee_cents: number;
  platform_annual_fee: number;
  platform_annual_fee_cents: number;
  annual_platform_fee_note: string;
  included_interviews: number;
  included_interviews_per_role: number;
  interview_duration_minutes: number;
  max_interview_minutes: number;
  additional_interview_price: number;
  additional_interview_fee: number;
  overage_price: number;
  per_role_fee: number;
  first_role_prepay: FirstRolePrepay;
  billing_cadences: BillingCadence[];
};

type PurchaseIntentForm = {
  company_legal_name: string;
  company_dba: string;
  buyer_first_name: string;
  buyer_last_name: string;
  buyer_email: string;
  buyer_phone: string;
  buyer_title: string;
  billing_cadence: string;
  first_role_prepay_selected: boolean;
  agreement_acknowledged: boolean;
  contact_acknowledged: boolean;
};

type PurchaseIntentResult = {
  purchase_intent_id: string;
  status: string;
  duplicate?: boolean;
  selected_package?: {
    plan_key?: string;
    display_name?: string;
    billing_cadence?: string;
    platform_fee?: number;
    platform_fee_cents?: number;
    platform_fee_billing_cadence?: string;
    platform_monthly_fee?: number;
    platform_monthly_fee_cents?: number;
    platform_annual_fee?: number;
    platform_annual_fee_cents?: number;
    annual_platform_fee_note?: string;
    included_interviews?: number;
    interview_duration_minutes?: number;
    max_interview_minutes?: number;
    additional_interview_price?: number;
    additional_interview_fee?: number;
    per_role_fee?: number;
    first_role_prepay?: Partial<FirstRolePrepay>;
  };
  next_step_message?: string;
};

type PurchaseAgreementResult = {
  purchase_intent_id?: string;
  status?: string;
  agreement?: {
    id?: string;
    status?: string;
    signing_url?: string | null;
    signing_path?: string | null;
    expires_at?: string | null;
    refreshed?: boolean;
    selected_package?: PurchaseIntentResult["selected_package"];
  };
  next_step_message?: string;
};

const SIGNUP_ALREADY_EXISTS_MESSAGE =
  "This email is already associated with an alphaScreen account or signup. Sign in, check your email, or contact support for help.";
const CHECKOUT_RECOVERY_STORAGE_KEY = "alphascreen:retail_checkout_recovery:v1";
const CHECKOUT_BACK_LINK_CLASS =
  "inline-flex text-sm font-semibold text-[#A380F6] transition-colors hover:text-[#0A1547]";

const FALLBACK_PACKAGES: AlphaScreenPackage[] = [
  {
    plan_key: "basic",
    display_name: "Basic",
    platform_monthly_fee: 299,
    platform_monthly_fee_cents: 29900,
    platform_annual_fee: 3299,
    platform_annual_fee_cents: 329900,
    annual_platform_fee_note: "Discounted annual platform fee",
    included_interviews: 20,
    included_interviews_per_role: 20,
    interview_duration_minutes: 10,
    max_interview_minutes: 10,
    additional_interview_price: 30,
    additional_interview_fee: 30,
    overage_price: 30,
    per_role_fee: 399,
    first_role_prepay: {
      enabled: true,
      selected: false,
      credit_type: "first_role_prepay",
      normal_role_fee_cents: 39900,
      discounted_credit_amount_cents: 35900,
      discount_percent: 10,
      non_refundable: true,
      expires: false,
      stripe_price_configured: false,
    },
    billing_cadences: [
      { key: "monthly", display_name: "Monthly", stripe_price_configured: false },
      { key: "annual", display_name: "Annual", stripe_price_configured: false },
    ],
  },
  {
    plan_key: "pro",
    display_name: "Pro",
    platform_monthly_fee: 599,
    platform_monthly_fee_cents: 59900,
    platform_annual_fee: 6499,
    platform_annual_fee_cents: 649900,
    annual_platform_fee_note: "Discounted annual platform fee",
    included_interviews: 30,
    included_interviews_per_role: 30,
    interview_duration_minutes: 12,
    max_interview_minutes: 12,
    additional_interview_price: 35,
    additional_interview_fee: 35,
    overage_price: 35,
    per_role_fee: 699,
    first_role_prepay: {
      enabled: true,
      selected: false,
      credit_type: "first_role_prepay",
      normal_role_fee_cents: 69900,
      discounted_credit_amount_cents: 62900,
      discount_percent: 10,
      non_refundable: true,
      expires: false,
      stripe_price_configured: false,
    },
    billing_cadences: [
      { key: "monthly", display_name: "Monthly", stripe_price_configured: false },
      { key: "annual", display_name: "Annual", stripe_price_configured: false },
    ],
  },
];

const BEST_FOR: Record<string, string> = {
  basic: "Lean teams that want consistent first-pass screening for focused roles.",
  pro: "Growing hiring teams with more active roles and higher candidate volume.",
};

const PLAN_ACCENTS: Record<string, { color: string; border: string; bg: string }> = {
  basic: {
    color: "#02D99D",
    border: "rgba(2,217,157,0.35)",
    bg: "rgba(2,217,157,0.08)",
  },
  pro: {
    color: "#A380F6",
    border: "rgba(163,128,246,0.35)",
    bg: "rgba(163,128,246,0.09)",
  },
};

const EMPTY_PURCHASE_FORM: PurchaseIntentForm = {
  company_legal_name: "",
  company_dba: "",
  buyer_first_name: "",
  buyer_last_name: "",
  buyer_email: "",
  buyer_phone: "",
  buyer_title: "",
  billing_cadence: "monthly",
  first_role_prepay_selected: false,
  agreement_acknowledged: false,
  contact_acknowledged: false,
};

function asNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeFirstRolePrepay(raw: unknown, fallback: FirstRolePrepay): FirstRolePrepay {
  const source = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
  return {
    enabled: source.enabled === false ? false : fallback.enabled,
    selected: source.selected === true,
    credit_type: String(source.credit_type || fallback.credit_type || "first_role_prepay").trim(),
    normal_role_fee_cents: asNumber(source.normal_role_fee_cents, fallback.normal_role_fee_cents),
    discounted_credit_amount_cents: asNumber(source.discounted_credit_amount_cents, fallback.discounted_credit_amount_cents),
    discount_percent: asNumber(source.discount_percent, fallback.discount_percent),
    non_refundable: source.non_refundable === false ? false : fallback.non_refundable,
    expires: source.expires === true,
    stripe_price_configured: source.stripe_price_configured === true,
  };
}

function purchaseIntentEndpoint(): string {
  return joinUrl(getPublicBackendBase(), "/api/alphascreen/purchase-intents");
}

function purchaseIntentAgreementEndpoint(purchaseIntentId: string): string {
  return joinUrl(getPublicBackendBase(), `/api/alphascreen/purchase-intents/${encodeURIComponent(purchaseIntentId)}/agreement`);
}

function isAgreementSigningPath(path: string): boolean {
  return /^\/membership-agreement\/sign\/[^/?#]+(?:[?#].*)?$/.test(String(path || "").trim());
}

function agreementSigningHref(result: PurchaseAgreementResult | null): string {
  const rawPath = String(result?.agreement?.signing_path || "").trim();
  if (isAgreementSigningPath(rawPath)) return rawPath;

  const rawUrl = String(result?.agreement?.signing_url || "").trim();
  if (!rawUrl) return "";
  try {
    const parsed = new URL(rawUrl, typeof window !== "undefined" ? window.location.origin : "https://www.alphasourceai.com");
    const path = `${parsed.pathname}${parsed.search}${parsed.hash}`;
    return isAgreementSigningPath(path) ? path : "";
  } catch (_) {
    return "";
  }
}

function validEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}

function cleanText(value: string, max: number): string {
  return String(value || "").trim().slice(0, max);
}

function buildPurchasePayload(form: PurchaseIntentForm, selectedPlan: AlphaScreenPackage) {
  return {
    plan_key: selectedPlan.plan_key,
    billing_cadence: form.billing_cadence || defaultCadence(selectedPlan),
    company_legal_name: cleanText(form.company_legal_name, 120),
    company_dba: cleanText(form.company_dba, 120),
    buyer_first_name: cleanText(form.buyer_first_name, 80),
    buyer_last_name: cleanText(form.buyer_last_name, 80),
    buyer_email: cleanText(form.buyer_email, 160),
    buyer_phone: cleanText(form.buyer_phone, 40),
    buyer_title: cleanText(form.buyer_title, 100),
    first_role_prepay_selected: form.first_role_prepay_selected === true,
    source_path: typeof window !== "undefined" ? window.location.pathname : "/alphascreen/pricing",
    agreement_acknowledged: form.agreement_acknowledged,
    contact_acknowledged: form.contact_acknowledged,
  };
}

function purchasePayloadKey(payload: ReturnType<typeof buildPurchasePayload>): string {
  return JSON.stringify(payload);
}

function saveCheckoutRecoveryState(input: {
  selectedPlanKey: string;
  form: PurchaseIntentForm;
  purchaseResult: PurchaseIntentResult | null;
  agreementResult: PurchaseAgreementResult | null;
  purchaseSubmissionKey: string;
}) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(CHECKOUT_RECOVERY_STORAGE_KEY, JSON.stringify({
      version: 1,
      saved_at: new Date().toISOString(),
      selected_plan_key: input.selectedPlanKey,
      form: input.form,
      purchase_result: input.purchaseResult,
      agreement_result: input.agreementResult,
      purchase_submission_key: input.purchaseSubmissionKey,
    }));
  } catch (_) {
    // Recovery is best-effort; the live checkout flow should not depend on storage.
  }
}

function loadCheckoutRecoveryState(): {
  selectedPlanKey: string;
  form: PurchaseIntentForm;
  purchaseResult: PurchaseIntentResult;
  agreementResult: PurchaseAgreementResult | null;
  purchaseSubmissionKey: string;
} | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(CHECKOUT_RECOVERY_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (parsed.version !== 1) return null;
    const form = parsed.form && typeof parsed.form === "object" ? parsed.form as Partial<PurchaseIntentForm> : null;
    const purchaseResult = parsed.purchase_result && typeof parsed.purchase_result === "object"
      ? parsed.purchase_result as PurchaseIntentResult
      : null;
    const selectedPlanKey = String(parsed.selected_plan_key || "").trim();
    if (!selectedPlanKey || !form || !purchaseResult?.purchase_intent_id) return null;
    return {
      selectedPlanKey,
      form: { ...EMPTY_PURCHASE_FORM, ...form },
      purchaseResult,
      agreementResult: parsed.agreement_result && typeof parsed.agreement_result === "object"
        ? parsed.agreement_result as PurchaseAgreementResult
        : null,
      purchaseSubmissionKey: String(parsed.purchase_submission_key || "").trim(),
    };
  } catch (_) {
    return null;
  }
}

function normalizePackage(raw: unknown): AlphaScreenPackage | null {
  const source = raw && typeof raw === "object" ? raw as Record<string, unknown> : null;
  if (!source) return null;
  const planKey = String(source.plan_key || "").trim().toLowerCase();
  if (planKey !== "basic" && planKey !== "pro") return null;

  const fallback = FALLBACK_PACKAGES.find((item) => item.plan_key === planKey) || FALLBACK_PACKAGES[0];
  const cadencesRaw = Array.isArray(source.billing_cadences) ? source.billing_cadences : fallback.billing_cadences;
  const billingCadences: BillingCadence[] = [];
  cadencesRaw.forEach((cadence) => {
    const item = cadence && typeof cadence === "object" ? cadence as Record<string, unknown> : {};
    const key = String(item.key || "").trim().toLowerCase();
    if (!key) return;
    billingCadences.push({
      key,
      display_name: String(item.display_name || key).trim(),
      stripe_price_configured: item.stripe_price_configured === true,
    });
  });

  return {
    plan_key: planKey,
    display_name: String(source.display_name || fallback.display_name).trim() || fallback.display_name,
    platform_monthly_fee: asNumber(source.platform_monthly_fee, fallback.platform_monthly_fee),
    platform_monthly_fee_cents: asNumber(source.platform_monthly_fee_cents, fallback.platform_monthly_fee_cents),
    platform_annual_fee: asNumber(source.platform_annual_fee, fallback.platform_annual_fee),
    platform_annual_fee_cents: asNumber(source.platform_annual_fee_cents, fallback.platform_annual_fee_cents),
    annual_platform_fee_note: String(source.annual_platform_fee_note || fallback.annual_platform_fee_note).trim(),
    included_interviews: asNumber(source.included_interviews, fallback.included_interviews),
    included_interviews_per_role: asNumber(source.included_interviews_per_role, fallback.included_interviews_per_role),
    interview_duration_minutes: asNumber(source.interview_duration_minutes, fallback.interview_duration_minutes),
    max_interview_minutes: asNumber(source.max_interview_minutes, fallback.max_interview_minutes),
    additional_interview_price: asNumber(source.additional_interview_price, fallback.additional_interview_price),
    additional_interview_fee: asNumber(source.additional_interview_fee, fallback.additional_interview_fee),
    overage_price: asNumber(source.overage_price, fallback.overage_price),
    per_role_fee: asNumber(source.per_role_fee, fallback.per_role_fee),
    first_role_prepay: normalizeFirstRolePrepay(source.first_role_prepay, fallback.first_role_prepay),
    billing_cadences: billingCadences,
  };
}

function normalizePackages(rawPackages: unknown): AlphaScreenPackage[] {
  if (!Array.isArray(rawPackages)) return FALLBACK_PACKAGES;
  const normalized = rawPackages
    .map(normalizePackage)
    .filter((item): item is AlphaScreenPackage => Boolean(item));

  const byKey = new Map(normalized.map((item) => [item.plan_key, item]));
  return FALLBACK_PACKAGES.map((fallback) => byKey.get(fallback.plan_key) || fallback);
}

function formatUsd(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function centsToDollars(cents: unknown): number {
  const numeric = Number(cents);
  if (!Number.isFinite(numeric)) return 0;
  return Math.round(numeric) / 100;
}

function firstRoleStandardFee(plan: AlphaScreenPackage): number {
  const fromCents = centsToDollars(plan.first_role_prepay.normal_role_fee_cents);
  return fromCents > 0 ? fromCents : plan.per_role_fee;
}

function firstRolePrepayFee(plan: AlphaScreenPackage): number {
  const fromCents = centsToDollars(plan.first_role_prepay.discounted_credit_amount_cents);
  if (fromCents > 0) return fromCents;
  return Math.round(firstRoleStandardFee(plan) * 0.9);
}

function firstRoleDiscountPercent(plan: AlphaScreenPackage): number {
  const configured = Number(plan.first_role_prepay.discount_percent);
  return Number.isFinite(configured) && configured > 0 ? configured : 10;
}

function platformFeeForCadence(plan: AlphaScreenPackage, billingCadence: string): number {
  return billingCadence === "annual" ? plan.platform_annual_fee : plan.platform_monthly_fee;
}

function formatPlatformFee(plan: AlphaScreenPackage, billingCadence: string): string {
  const value = platformFeeForCadence(plan, billingCadence);
  return formatUsd(value);
}

function cadenceOptions(plan: AlphaScreenPackage | null): BillingCadence[] {
  const options = (plan?.billing_cadences || []).filter((cadence) => String(cadence.key || "").trim());
  return options.length ? options : [{ key: "monthly", display_name: "Monthly" }];
}

function defaultCadence(plan: AlphaScreenPackage | null): string {
  const options = cadenceOptions(plan);
  return options.find((cadence) => cadence.key === "monthly")?.key || options[0]?.key || "monthly";
}

function planSupportsCadence(plan: AlphaScreenPackage | null, cadence: string): boolean {
  return cadenceOptions(plan).some((option) => option.key === cadence);
}

function cadenceLabel(plan: AlphaScreenPackage | null, key: string): string {
  const match = cadenceOptions(plan).find((cadence) => cadence.key === key);
  return match?.display_name || key || "Billing cadence";
}

function validatePurchaseForm(form: PurchaseIntentForm, selectedPlan: AlphaScreenPackage | null): string {
  if (!selectedPlan) return "Choose Basic or Pro before starting membership signup.";
  if (!cleanText(form.company_legal_name, 120)) return "Company legal name is required.";
  if (!cleanText(form.buyer_first_name, 80)) return "Buyer first name is required.";
  if (!cleanText(form.buyer_last_name, 80)) return "Buyer last name is required.";
  if (!validEmail(form.buyer_email)) return "Enter a valid email address.";
  if (!cleanText(form.buyer_phone, 40)) return "Phone is required.";
  if (!cleanText(form.buyer_title, 100)) return "Title is required.";
  if (!form.agreement_acknowledged) return "Confirm that agreement signing and payment are required before access is activated.";
  if (!form.contact_acknowledged) return "Confirm that alphaSource may contact you about this alphaScreen membership.";
  return "";
}

function PackageMetric({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-[#0A1547]/10 bg-white px-4 py-3">
      <div className="mt-0.5 text-[#02ABE0]">{icon}</div>
      <div>
        <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#0A1547]/45">{label}</p>
        <p className="text-sm font-black text-[#0A1547]">{value}</p>
      </div>
    </div>
  );
}

function PlanCard({
  plan,
  selected,
  billingCadence,
  onStart,
}: {
  plan: AlphaScreenPackage;
  selected: boolean;
  billingCadence: BillingCadenceKey;
  onStart: (plan: AlphaScreenPackage) => void;
}) {
  const accent = PLAN_ACCENTS[plan.plan_key] || PLAN_ACCENTS.basic;
  const included = plan.included_interviews_per_role || plan.included_interviews;
  const duration = plan.max_interview_minutes || plan.interview_duration_minutes;
  const overage = plan.additional_interview_fee || plan.additional_interview_price || plan.overage_price;
  const platformSuffix = billingCadence === "annual" ? "/year platform" : "/mo platform";

  return (
    <article
      className="flex h-full flex-col rounded-lg border bg-white p-6 shadow-sm transition-transform hover:-translate-y-1"
      style={{
        borderColor: plan.plan_key === "pro" ? accent.border : "rgba(10,21,71,0.10)",
        boxShadow: plan.plan_key === "pro" ? "0 18px 46px rgba(10,21,71,0.12)" : "0 10px 28px rgba(10,21,71,0.06)",
      }}
    >
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.18em]" style={{ color: accent.color }}>
            {plan.display_name}
          </p>
          <h2 className="mt-2 text-2xl font-black text-[#0A1547]">{plan.display_name} membership</h2>
        </div>
        <div className="rounded-lg p-2.5" style={{ backgroundColor: accent.bg, color: accent.color }}>
          {plan.plan_key === "pro" ? <BriefcaseBusiness className="h-5 w-5" /> : <Layers3 className="h-5 w-5" />}
        </div>
      </div>

      <div className="mb-5">
        <div className="flex items-end gap-2">
          <span className="text-4xl font-black tracking-normal text-[#0A1547]">{formatPlatformFee(plan, billingCadence)}</span>
          <span className="pb-1.5 text-sm font-bold text-[#0A1547]/55">{platformSuffix}</span>
        </div>
        <p className="mt-2 text-sm font-black text-[#0A1547]">+ {formatUsd(plan.per_role_fee)} / role</p>
        <p className="mt-1 text-xs font-bold text-[#0A1547]/55">
          New self-serve buyers can optionally prepay their first role during signup and save 10% on that first role.
        </p>
        {billingCadence === "annual" ? (
          <p className="mt-1 text-xs font-bold text-[#0A1547]/55">
            Annual platform pricing is discounted and billed upfront.
          </p>
        ) : null}
        <p className="mt-2 text-sm leading-relaxed text-[#0A1547]/60">{BEST_FOR[plan.plan_key]}</p>
      </div>

      <div className="grid gap-3">
        <PackageMetric
          icon={<CheckCircle className="h-4 w-4" />}
          label="Included"
          value={`${included} interviews per role`}
        />
        <PackageMetric
          icon={<Clock3 className="h-4 w-4" />}
          label="Interview cap"
          value={`${duration}-minute interviews`}
        />
        <PackageMetric
          icon={<BadgeDollarSign className="h-4 w-4" />}
          label="Additional interviews"
          value={`${formatUsd(overage)} per additional interview`}
        />
      </div>

      <div className="mt-5 grid gap-2">
        {["On-Demand PDF Reports", "Email support"].map((item) => (
          <div key={item} className="flex items-center gap-2 text-sm font-bold text-[#0A1547]/70">
            <CheckCircle className="h-4 w-4 flex-shrink-0" style={{ color: accent.color }} />
            <span>{item}</span>
          </div>
        ))}
      </div>

      <div className="mt-auto grid gap-2 pt-6">
        <button
          type="button"
          onClick={() => onStart(plan)}
          className="min-h-12 w-full rounded-full px-4 py-3 text-sm font-black text-white shadow-lg transition-all hover:-translate-y-0.5 hover:shadow-xl active:translate-y-0"
          style={{
            backgroundColor: selected ? "#0A1547" : accent.color,
            boxShadow: selected ? "0 14px 28px rgba(10,21,71,0.22)" : `0 14px 28px ${accent.color}33`,
          }}
          data-analytics-cta={`Start with ${plan.display_name}`}
          data-analytics-placement="pricing-card"
          data-analytics-target="#signup-modal"
        >
          Start {plan.display_name} membership
        </button>
        <a
          href="#pricing-demo"
          className="flex min-h-11 w-full items-center justify-center gap-2 rounded-full border border-[#0A1547]/10 bg-white px-4 py-3 text-sm font-black text-[#0A1547]/55 transition-colors hover:border-[#A380F6]/35 hover:text-[#A380F6]"
          data-analytics-cta={`Request demo for ${plan.display_name}`}
          data-analytics-placement="pricing-card"
          data-analytics-target="#pricing-demo"
        >
          Request demo
          <ArrowRight className="h-4 w-4" />
        </a>
      </div>
    </article>
  );
}

function EnterpriseCard() {
  return (
    <article className="flex h-full flex-col rounded-lg border border-[#0A1547]/10 bg-[#0A1547] p-6 text-white shadow-sm">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#02ABE0]">Enterprise</p>
          <h2 className="mt-2 text-2xl font-black">Enterprise membership</h2>
        </div>
        <div className="rounded-lg bg-white/10 p-2.5 text-[#02D99D]">
          <Building2 className="h-5 w-5" />
        </div>
      </div>
      <p className="text-sm leading-relaxed text-white/70">
        For teams that need custom interview volume, enterprise onboarding, advanced scoring options, or custom membership terms.
      </p>
      <div className="mt-6 grid gap-3">
        {[
          "Custom interviews included",
          "15-minute interview cap",
          "Volume discounts",
          "Advanced scoring models available",
          "Priority Support",
        ].map((item) => (
          <div key={item} className="flex items-center gap-3 text-sm font-bold text-white/85">
            <CheckCircle className="h-4 w-4 flex-shrink-0 text-[#02D99D]" />
            <span>{item}</span>
          </div>
        ))}
      </div>
      <div className="mt-auto grid gap-2 pt-6">
        <div className="hidden min-h-11 lg:block" aria-hidden="true" />
        <a
          href="#pricing-demo"
          className="flex min-h-11 w-full items-center justify-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-3 text-sm font-black text-white transition-colors hover:bg-white hover:text-[#0A1547]"
          data-analytics-cta="Talk to Sales"
          data-analytics-placement="pricing-enterprise"
          data-analytics-target="#pricing-demo"
        >
          Talk to sales
          <ArrowRight className="h-4 w-4" />
        </a>
      </div>
    </article>
  );
}

function PurchaseTextField({
  label,
  value,
  onChange,
  required = false,
  type = "text",
  placeholder,
  maxLength,
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  type?: string;
  placeholder?: string;
  maxLength?: number;
  autoComplete?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-black text-[#0A1547]">
        {label}
        {required ? <span className="text-[#A380F6]"> *</span> : null}
      </span>
      <input
        type={type}
        required={required}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        autoComplete={autoComplete}
        className="w-full rounded-lg border border-[#0A1547]/12 bg-white px-4 py-3 text-sm text-[#0A1547] outline-none transition-colors placeholder:text-[#0A1547]/35 focus:border-[#A380F6] focus:ring-2 focus:ring-[#A380F6]/20"
      />
    </label>
  );
}

function PurchaseIntentPanel({
  selectedPlan,
  form,
  status,
  error,
  result,
  agreementStatus,
  agreementError,
  agreementResult,
  onChange,
  onSubmit,
  onContinueToAgreement,
  onBackToPricing,
  onBackToSignup,
}: {
  selectedPlan: AlphaScreenPackage | null;
  form: PurchaseIntentForm;
  status: PurchaseIntentStatus;
  error: string;
  result: PurchaseIntentResult | null;
  agreementStatus: AgreementPrepStatus;
  agreementError: string;
  agreementResult: PurchaseAgreementResult | null;
  onChange: <K extends keyof PurchaseIntentForm>(field: K, value: PurchaseIntentForm[K]) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onContinueToAgreement: () => void;
  onBackToPricing: () => void;
  onBackToSignup: () => void;
}) {
  if (!selectedPlan) {
    return (
      <div className="rounded-lg border border-dashed border-[#0A1547]/18 bg-white px-6 py-8 text-center">
        <h3 className="text-xl font-black text-[#0A1547]">Choose Basic or Pro to start membership signup.</h3>
        <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-[#0A1547]/60">
          No payment is collected in this step. You will review and sign the membership agreement before secure checkout.
        </p>
      </div>
    );
  }

  const included = selectedPlan.included_interviews_per_role || selectedPlan.included_interviews;
  const duration = selectedPlan.max_interview_minutes || selectedPlan.interview_duration_minutes;
  const overage = selectedPlan.additional_interview_fee || selectedPlan.additional_interview_price || selectedPlan.overage_price;
  const options = cadenceOptions(selectedPlan);
  const planName = result?.selected_package?.display_name || selectedPlan.display_name;
  const billingCadence = form.billing_cadence === "annual" ? "annual" : "monthly";
  const selectedPlatformFee = result?.selected_package?.platform_fee ?? platformFeeForCadence(selectedPlan, billingCadence);
  const selectedPlatformFeeLabel = formatUsd(selectedPlatformFee);
  const standardFirstRoleFee = firstRoleStandardFee(selectedPlan);
  const discountedFirstRoleFee = firstRolePrepayFee(selectedPlan);
  const firstRoleDiscount = firstRoleDiscountPercent(selectedPlan);
  const prepaySelected = form.first_role_prepay_selected === true;
  const totalDueToday = selectedPlatformFee + (prepaySelected ? discountedFirstRoleFee : 0);

  if (status === "success" && result) {
    const signingUrl = agreementSigningHref(agreementResult);
    return (
      <div className="rounded-lg border border-[#02D99D]/35 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#02D99D]/10 text-[#02D99D]">
              <CheckCircle className="h-6 w-6" />
            </div>
            <p className="text-sm font-black uppercase tracking-[0.18em] text-[#02D99D]">
              {result.duplicate ? "Signup details found" : "Signup details saved"}
            </p>
            <h3 className="mt-2 text-2xl font-black text-[#0A1547]">{planName} membership is ready for agreement review.</h3>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#0A1547]/60">
              Next: review and sign your membership agreement. After signing, you will continue to secure payment.
            </p>
          </div>
          <div className="rounded-lg bg-[#F8F9FD] px-4 py-3 text-sm font-bold text-[#0A1547]/65">
            No payment collected
          </div>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-lg border border-[#0A1547]/10 bg-[#F8F9FD] p-4">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[#0A1547]/45">Membership</p>
            <p className="mt-2 text-sm font-black text-[#0A1547]">
              {planName} membership - {cadenceLabel(selectedPlan, form.billing_cadence)}
            </p>
            <p className="mt-1 text-xs font-semibold text-[#0A1547]/55">
              {selectedPlatformFeeLabel} platform, {formatUsd(selectedPlan.per_role_fee)} / role
            </p>
            <p className="mt-1 text-xs font-semibold text-[#0A1547]/55">
              {prepaySelected
                ? `First role prepaid at ${formatUsd(discountedFirstRoleFee)} today.`
                : "First role billed later when opened."}
            </p>
            <p className="mt-1 text-xs font-semibold text-[#0A1547]/55">
              {included} interviews, {duration}-minute cap, {formatUsd(overage)} additional interviews
            </p>
          </div>
          <div className="rounded-lg border border-[#0A1547]/10 bg-[#F8F9FD] p-4">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[#0A1547]/45">Company</p>
            <p className="mt-2 text-sm font-black text-[#0A1547]">{form.company_legal_name}</p>
            {form.company_dba ? <p className="mt-1 text-xs font-semibold text-[#0A1547]/55">DBA {form.company_dba}</p> : null}
          </div>
          <div className="rounded-lg border border-[#0A1547]/10 bg-[#F8F9FD] p-4">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[#0A1547]/45">Buyer</p>
            <p className="mt-2 text-sm font-black text-[#0A1547]">
              {form.buyer_first_name} {form.buyer_last_name}
            </p>
            <p className="mt-1 text-xs font-semibold text-[#0A1547]/55">{form.buyer_email}</p>
          </div>
        </div>
        <div className="mt-6 rounded-lg border border-[#0A1547]/10 bg-[#F8F9FD] p-4">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-[#0A1547]/45">Order summary</p>
          <div className="mt-3 space-y-2 text-sm font-semibold text-[#0A1547]/65">
            <div className="flex items-center justify-between gap-3">
              <span>{planName} membership - {cadenceLabel(selectedPlan, form.billing_cadence)}</span>
              <span className="font-black text-[#0A1547]">{selectedPlatformFeeLabel}</span>
            </div>
            {prepaySelected ? (
              <div className="flex items-center justify-between gap-3">
                <span>Discounted first-role prepay</span>
                <span className="font-black text-[#0A1547]">{formatUsd(discountedFirstRoleFee)}</span>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-3">
                <span>First role</span>
                <span className="font-black text-[#0A1547]">Billed when opened</span>
              </div>
            )}
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-[#0A1547]/10 pt-3">
            <span className="text-sm font-black text-[#0A1547]">Total due today</span>
            <span className="text-base font-black text-[#0A1547]">{formatUsd(totalDueToday)}</span>
          </div>
        </div>
        <div className="mt-6 grid gap-3 rounded-lg border border-[#0A1547]/10 bg-[#F8F9FD] p-4 md:grid-cols-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[#02D99D]">Step 1</p>
            <p className="mt-1 text-sm font-black text-[#0A1547]">Signup details saved</p>
            <p className="mt-1 text-xs font-semibold text-[#0A1547]/55">{planName} membership details are saved for agreement review.</p>
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[#A380F6]">Step 2</p>
            <p className="mt-1 text-sm font-black text-[#0A1547]">Review and sign agreement</p>
            <p className="mt-1 text-xs font-semibold text-[#0A1547]/55">Next: review and sign your membership agreement.</p>
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[#0A1547]/45">Step 3</p>
            <p className="mt-1 text-sm font-black text-[#0A1547]">Secure payment</p>
            <p className="mt-1 text-xs font-semibold text-[#0A1547]/55">After signing, you will continue to secure payment.</p>
          </div>
        </div>
        {agreementError ? (
          <div className="mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700" role="alert">
            {agreementError}
          </div>
        ) : null}
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
          {signingUrl ? (
            <a
              href={signingUrl}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-[#8E6EE0] bg-[#A380F6] px-6 py-3.5 text-sm font-black text-white shadow-[0_10px_24px_rgba(163,128,246,0.26)] transition-colors hover:border-[#7B5FD4] hover:bg-[#8E6EE0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A380F6]/45 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
              data-analytics-cta="Open Membership Agreement"
              data-analytics-placement="signup-modal-success"
              data-analytics-target="/membership-agreement/sign"
            >
              Open membership agreement
              <ArrowRight className="h-4 w-4" />
            </a>
          ) : (
            <button
              type="button"
              onClick={onContinueToAgreement}
              disabled={agreementStatus === "preparing"}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-[#0A1547] px-6 py-3.5 text-sm font-black text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              data-analytics-cta="Continue to Agreement"
              data-analytics-placement="signup-modal-success"
              data-analytics-target="/membership-agreement/sign"
            >
              {agreementStatus === "preparing" ? "Preparing agreement..." : "Continue to agreement"}
              <ArrowRight className="h-4 w-4" />
            </button>
          )}
          <p className="text-xs font-semibold leading-relaxed text-[#0A1547]/50">
            No payment details are collected here. Secure checkout opens after agreement signing.
          </p>
        </div>
        <div className="mt-5 flex justify-start">
          <button
            type="button"
            onClick={onBackToSignup}
            disabled={agreementStatus === "preparing"}
            className={`${CHECKOUT_BACK_LINK_CLASS} disabled:cursor-not-allowed disabled:opacity-50`}
          >
            &larr; Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="rounded-lg border border-[#0A1547]/10 bg-white p-6 shadow-sm" data-testid="signup-profile-form">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.18em] text-[#A380F6]">Membership details</p>
          <h3 className="mt-2 text-2xl font-black text-[#0A1547]">Start {selectedPlan.display_name} membership</h3>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#0A1547]/60">
            Share the buyer and company details for agreement review. Payment is handled later through secure checkout.
          </p>
        </div>
        <div className="rounded-lg bg-[#F8F9FD] px-4 py-3 text-sm font-bold text-[#0A1547]/65">
          {selectedPlatformFeeLabel} membership today - {prepaySelected ? `${formatUsd(discountedFirstRoleFee)} first role today` : `${formatUsd(selectedPlan.per_role_fee)} role fee later`}
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <PurchaseTextField
          label="Company legal name"
          required
          value={form.company_legal_name}
          onChange={(value) => onChange("company_legal_name", value)}
          placeholder="Acme Corporation, Inc."
          maxLength={120}
          autoComplete="organization"
        />
        <PurchaseTextField
          label="DBA"
          value={form.company_dba}
          onChange={(value) => onChange("company_dba", value)}
          placeholder="Optional"
          maxLength={120}
        />
        <PurchaseTextField
          label="First name"
          required
          value={form.buyer_first_name}
          onChange={(value) => onChange("buyer_first_name", value)}
          placeholder="Jane"
          maxLength={80}
          autoComplete="given-name"
        />
        <PurchaseTextField
          label="Last name"
          required
          value={form.buyer_last_name}
          onChange={(value) => onChange("buyer_last_name", value)}
          placeholder="Smith"
          maxLength={80}
          autoComplete="family-name"
        />
        <PurchaseTextField
          label="Account email"
          required
          type="email"
          value={form.buyer_email}
          onChange={(value) => onChange("buyer_email", value)}
          placeholder="jane@example.com"
          maxLength={160}
          autoComplete="email"
        />
        <PurchaseTextField
          label="Phone"
          required
          type="tel"
          value={form.buyer_phone}
          onChange={(value) => onChange("buyer_phone", value)}
          placeholder="+1 (555) 123-4567"
          maxLength={40}
          autoComplete="tel"
        />
        <PurchaseTextField
          label="Title"
          required
          value={form.buyer_title}
          onChange={(value) => onChange("buyer_title", value)}
          placeholder="Director of Operations"
          maxLength={100}
          autoComplete="organization-title"
        />
        <label className="block">
          <span className="mb-1.5 block text-sm font-black text-[#0A1547]">Billing cadence</span>
          <select
            value={form.billing_cadence}
            onChange={(event) => onChange("billing_cadence", event.target.value)}
            className="h-[46px] w-full rounded-lg border border-[#0A1547]/12 bg-white px-4 text-sm font-bold text-[#0A1547] outline-none transition-colors focus:border-[#A380F6] focus:ring-2 focus:ring-[#A380F6]/20"
          >
            {options.map((cadence) => (
              <option key={String(cadence.key)} value={String(cadence.key)}>
                {cadence.display_name || cadence.key}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-6 grid gap-3 rounded-lg border border-[#0A1547]/10 bg-[#F8F9FD] p-4">
        <div>
          <p className="text-sm font-black text-[#0A1547]">First role payment</p>
          <p className="mt-1 text-xs font-semibold leading-relaxed text-[#0A1547]/55">
            Choose how you want to handle the first paid role under this billing account.
          </p>
        </div>
        <div className="grid gap-3 lg:grid-cols-2" role="radiogroup" aria-label="First role payment choice">
          <label className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors ${
            !prepaySelected ? "border-[#A380F6] bg-white" : "border-[#0A1547]/10 bg-white/70 hover:border-[#A380F6]/45"
          }`}>
            <input
              type="radio"
              name="first_role_prepay_selected"
              checked={!prepaySelected}
              onChange={() => onChange("first_role_prepay_selected", false)}
              className="mt-1 h-4 w-4 border-[#0A1547]/25 text-[#A380F6] focus:ring-[#A380F6]"
            />
            <span>
              <span className="block text-sm font-black text-[#0A1547]">Pay when I open my first role later</span>
              <span className="mt-1 block text-xs font-semibold leading-relaxed text-[#0A1547]/60">
                Skip the first-role prepayment and pay the standard role fee when you open a role in alphaScreen.
              </span>
            </span>
          </label>
          <label className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors ${
            prepaySelected ? "border-[#A380F6] bg-white" : "border-[#0A1547]/10 bg-white/70 hover:border-[#A380F6]/45"
          }`}>
            <input
              type="radio"
              name="first_role_prepay_selected"
              checked={prepaySelected}
              onChange={() => onChange("first_role_prepay_selected", true)}
              className="mt-1 h-4 w-4 border-[#0A1547]/25 text-[#A380F6] focus:ring-[#A380F6]"
            />
            <span>
              <span className="block text-sm font-black text-[#0A1547]">
                <span className="relative inline-flex px-2 text-[#0A1547]">
                  <span className="absolute -inset-x-0.5 inset-y-0 rounded-md bg-yellow-200/80" aria-hidden="true" />
                  <span className="relative">Purchase first role now and save {firstRoleDiscount}%</span>
                </span>
              </span>
              <span className="mt-1 block text-xs font-semibold leading-relaxed text-[#0A1547]/60">
                Add your first role to today&apos;s checkout at a one-time {firstRoleDiscount}% discount. Your first role will be prepaid, and additional roles are billed at the standard role fee.
              </span>
              <span className="mt-2 block text-xs font-black text-[#0A1547]">
                {formatUsd(discountedFirstRoleFee)} now instead of {formatUsd(standardFirstRoleFee)}
              </span>
            </span>
          </label>
        </div>
        <p className="text-xs font-semibold leading-relaxed text-[#0A1547]/55">
          If selected, your initial Stripe Checkout includes the membership fee plus the discounted first-role fee. This one-time website signup offer creates a non-refundable first-role credit with no expiration, usable by the parent or child entity under the same billing account.
        </p>
      </div>

      <div className="mt-6 rounded-lg border border-[#0A1547]/10 bg-white p-4">
        <p className="text-sm font-black text-[#0A1547]">Order summary</p>
        <div className="mt-3 space-y-2 text-sm font-semibold text-[#0A1547]/65">
          <div className="flex items-center justify-between gap-3">
            <span>{selectedPlan.display_name} membership - {cadenceLabel(selectedPlan, form.billing_cadence)}</span>
            <span className="font-black text-[#0A1547]">{selectedPlatformFeeLabel}</span>
          </div>
          {prepaySelected ? (
            <div className="flex items-center justify-between gap-3">
              <span>Discounted first-role prepay</span>
              <span className="font-black text-[#0A1547]">{formatUsd(discountedFirstRoleFee)}</span>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <span>First role</span>
              <span className="font-black text-[#0A1547]">Billed when opened</span>
            </div>
          )}
        </div>
        <div className="mt-3 flex items-center justify-between border-t border-[#0A1547]/10 pt-3">
          <span className="text-sm font-black text-[#0A1547]">Total due today</span>
          <span className="text-base font-black text-[#0A1547]">{formatUsd(totalDueToday)}</span>
        </div>
        <p className="mt-2 text-xs font-semibold leading-relaxed text-[#0A1547]/50">
          {prepaySelected
            ? "Today's checkout includes the membership fee and discounted first-role fee."
            : "Today's checkout includes the membership fee only. Role fees are billed when roles are opened."}
        </p>
      </div>

      <div className="mt-6 grid gap-3">
        <label className="flex items-start gap-3 rounded-lg border border-[#0A1547]/10 bg-[#F8F9FD] p-4 text-sm font-semibold leading-relaxed text-[#0A1547]/70">
          <input
            type="checkbox"
            checked={form.agreement_acknowledged}
            onChange={(event) => onChange("agreement_acknowledged", event.target.checked)}
            className="mt-1 h-4 w-4 rounded border-[#0A1547]/25 text-[#A380F6] focus:ring-[#A380F6]"
          />
          <span>I understand signup requires membership agreement signing and payment before access is activated.</span>
        </label>
        <label className="flex items-start gap-3 rounded-lg border border-[#0A1547]/10 bg-[#F8F9FD] p-4 text-sm font-semibold leading-relaxed text-[#0A1547]/70">
          <input
            type="checkbox"
            checked={form.contact_acknowledged}
            onChange={(event) => onChange("contact_acknowledged", event.target.checked)}
            className="mt-1 h-4 w-4 rounded border-[#0A1547]/25 text-[#A380F6] focus:ring-[#A380F6]"
          />
          <span>I agree to be contacted about this alphaScreen membership.</span>
        </label>
      </div>

      {error ? (
        <div className="mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700" role="alert">
          {error}
        </div>
      ) : null}

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <button
          type="submit"
          disabled={status === "submitting"}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-[#0A1547] px-6 py-3.5 text-sm font-black text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          data-analytics-cta="Continue with Signup"
          data-analytics-placement="signup-modal"
          data-analytics-target="/alphascreen/pricing#signup-modal"
        >
          {status === "submitting" ? "Saving details..." : "Continue with signup"}
          <ArrowRight className="h-4 w-4" />
        </button>
        <p className="text-xs font-semibold leading-relaxed text-[#0A1547]/50">
          Payment details are not collected in this step.
        </p>
      </div>
      <div className="mt-5 flex justify-start">
        <button
          type="button"
          onClick={onBackToPricing}
          disabled={status === "submitting"}
          className={`${CHECKOUT_BACK_LINK_CLASS} disabled:cursor-not-allowed disabled:opacity-50`}
        >
          &larr; Back
        </button>
      </div>
    </form>
  );
}

function LoadingNotice({ state }: { state: PackageLoadState }) {
  if (state === "ready") return null;

  const isLoading = state === "loading";
  return (
    <div className="mb-6 rounded-lg border border-[#0A1547]/10 bg-white px-4 py-3 text-sm font-semibold text-[#0A1547]/65">
      {isLoading
        ? "Loading current alphaScreen membership configuration..."
        : "Showing current membership defaults while live membership configuration is unavailable."}
    </div>
  );
}

export default function AlphaScreenPricingPage() {
  const [packages, setPackages] = useState<AlphaScreenPackage[]>(FALLBACK_PACKAGES);
  const [loadState, setLoadState] = useState<PackageLoadState>("loading");
  const purchaseFormStartedRef = useRef(false);
  const [selectedBillingCadence, setSelectedBillingCadence] = useState<BillingCadenceKey>("monthly");
  const [checkoutModalOpen, setCheckoutModalOpen] = useState(false);
  const [selectedPlanKey, setSelectedPlanKey] = useState("");
  const [purchaseForm, setPurchaseForm] = useState<PurchaseIntentForm>(EMPTY_PURCHASE_FORM);
  const [purchaseStatus, setPurchaseStatus] = useState<PurchaseIntentStatus>("idle");
  const [purchaseError, setPurchaseError] = useState("");
  const [purchaseResult, setPurchaseResult] = useState<PurchaseIntentResult | null>(null);
  const [purchaseSubmissionKey, setPurchaseSubmissionKey] = useState("");
  const [agreementStatus, setAgreementStatus] = useState<AgreementPrepStatus>("idle");
  const [agreementError, setAgreementError] = useState("");
  const [agreementResult, setAgreementResult] = useState<PurchaseAgreementResult | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function loadPackages() {
      try {
        const response = await fetch(joinUrl(getPublicBackendBase(), "/api/alphascreen/packages"), {
          headers: { Accept: "application/json" },
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`Package endpoint returned ${response.status}`);
        const body = await response.json() as { packages?: unknown };
        setPackages(normalizePackages(body.packages));
        setLoadState("ready");
      } catch (error) {
        if (controller.signal.aborted) return;
        setPackages(FALLBACK_PACKAGES);
        setLoadState("fallback");
      }
    }

    void loadPackages();
    return () => controller.abort();
  }, []);

  const planCards = useMemo(() => normalizePackages(packages), [packages]);
  const selectedPlan = useMemo(
    () => planCards.find((plan) => plan.plan_key === selectedPlanKey) || null,
    [planCards, selectedPlanKey],
  );

  const startPurchase = (plan: AlphaScreenPackage) => {
    const cadence = planSupportsCadence(plan, selectedBillingCadence) ? selectedBillingCadence : defaultCadence(plan);
    setSelectedPlanKey(plan.plan_key);
    setCheckoutModalOpen(true);
    purchaseFormStartedRef.current = false;
    setPurchaseStatus("idle");
    setPurchaseError("");
    setPurchaseResult(null);
    setPurchaseSubmissionKey("");
    setAgreementStatus("idle");
    setAgreementError("");
    setAgreementResult(null);
    setPurchaseForm((prev) => ({ ...prev, billing_cadence: cadence }));
    trackEvent("signup_started", { plan: plan.plan_key, step: "plan_selection" });
  };

  const closeCheckoutModal = () => {
    if (purchaseStatus === "submitting" || agreementStatus === "preparing") return;
    setCheckoutModalOpen(false);
  };

  const backToPricing = () => {
    if (purchaseStatus === "submitting" || agreementStatus === "preparing") return;
    setCheckoutModalOpen(false);
    trackEvent("signup_back_clicked", {
      plan: selectedPlanKey,
      step: purchaseStatus === "success" ? "agreement_review" : "buyer_intake",
    });
  };

  const backToSignupForm = () => {
    if (agreementStatus === "preparing") return;
    setPurchaseStatus("idle");
    setPurchaseError("");
    setAgreementError("");
    trackEvent("signup_back_clicked", {
      plan: selectedPlanKey,
      step: "agreement_created",
    });
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search || "");
    if (params.get("checkout_recovery") !== "agreement_created") return;

    const recovery = loadCheckoutRecoveryState();
    if (!recovery) return;

    setSelectedPlanKey(recovery.selectedPlanKey);
    setSelectedBillingCadence(recovery.form.billing_cadence === "annual" ? "annual" : "monthly");
    setPurchaseForm(recovery.form);
    setPurchaseResult(recovery.purchaseResult);
    setPurchaseSubmissionKey(recovery.purchaseSubmissionKey);
    setAgreementResult(recovery.agreementResult);
    setAgreementStatus(agreementSigningHref(recovery.agreementResult) ? "ready" : "idle");
    setPurchaseStatus("success");
    setCheckoutModalOpen(true);
    setPurchaseError("");
    setAgreementError("");

    params.delete("checkout_recovery");
    const nextSearch = params.toString();
    const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ""}${window.location.hash || "#signup-modal"}`;
    window.history.replaceState(null, "", nextUrl);
  }, []);

  const updateSelectedBillingCadence = (cadence: BillingCadenceKey) => {
    setSelectedBillingCadence(cadence);
    if (selectedPlan && planSupportsCadence(selectedPlan, cadence)) {
      setPurchaseForm((prev) => ({ ...prev, billing_cadence: cadence }));
    }
  };

  const updatePurchaseField = <K extends keyof PurchaseIntentForm>(field: K, value: PurchaseIntentForm[K]) => {
    if (!purchaseFormStartedRef.current) {
      purchaseFormStartedRef.current = true;
      trackEvent("lead_form_started", {
        form_id: "alphascreen-signup-profile",
        form_type: "signup_profile",
        product_interest: "alphascreen",
        first_field: String(field),
      });
      trackEvent("signup_step_viewed", { plan: selectedPlanKey, step: "buyer_intake" });
    }
    setPurchaseError("");
    if (field === "billing_cadence" && (value === "monthly" || value === "annual")) {
      setSelectedBillingCadence(value);
    }
    setPurchaseForm((prev) => ({ ...prev, [field]: value }));
  };

  const handlePurchaseSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const validationMessage = validatePurchaseForm(purchaseForm, selectedPlan);
    trackEvent("lead_form_submit_attempted", {
      form_id: "alphascreen-signup-profile",
      form_type: "signup_profile",
      product_interest: "alphascreen",
    });

    if (validationMessage || !selectedPlan) {
      setPurchaseError(validationMessage || "Choose Basic or Pro before submitting.");
      trackEvent("lead_form_submit_failed", {
        form_id: "alphascreen-signup-profile",
        form_type: "signup_profile",
        product_interest: "alphascreen",
        error_type: "validation",
      });
      return;
    }

    setPurchaseStatus("submitting");
    setPurchaseError("");

    const payload = buildPurchasePayload(purchaseForm, selectedPlan);
    const nextSubmissionKey = purchasePayloadKey(payload);

    if (purchaseResult?.purchase_intent_id && purchaseSubmissionKey === nextSubmissionKey) {
      setPurchaseStatus("success");
      setPurchaseError("");
      saveCheckoutRecoveryState({
        selectedPlanKey,
        form: purchaseForm,
        purchaseResult,
        agreementResult,
        purchaseSubmissionKey,
      });
      return;
    }

    try {
      const response = await fetch(purchaseIntentEndpoint(), {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await response.json().catch(() => ({})) as PurchaseIntentResult & {
        detail?: string;
        message?: string;
        code?: string;
        error?: string;
      };

      if (!response.ok) {
        const errorCode = String(body.code || body.error || "").trim();
        const detail = errorCode === "SIGNUP_ALREADY_EXISTS" || errorCode === "signup_already_exists"
          ? SIGNUP_ALREADY_EXISTS_MESSAGE
          : body.detail || body.message || (response.status === 429
            ? "Too many signup attempts. Please wait a few minutes and try again."
            : "We could not save these signup details. Please try again.");
        setPurchaseStatus("idle");
        setPurchaseError(detail);
        trackEvent("lead_form_submit_failed", {
          form_id: "alphascreen-signup-profile",
          form_type: "signup_profile",
          product_interest: "alphascreen",
          error_type: response.status === 429 ? "rate_limited" : "backend",
        });
        return;
      }

      setPurchaseResult(body);
      setPurchaseSubmissionKey(nextSubmissionKey);
      setPurchaseStatus("success");
      setAgreementStatus("idle");
      setAgreementError("");
      setAgreementResult(null);
      saveCheckoutRecoveryState({
        selectedPlanKey: selectedPlan.plan_key,
        form: purchaseForm,
        purchaseResult: body,
        agreementResult: null,
        purchaseSubmissionKey: nextSubmissionKey,
      });
      trackEvent("lead_form_submit_succeeded", {
        form_id: "alphascreen-signup-profile",
        form_type: "signup_profile",
        product_interest: "alphascreen",
      });
      trackEvent("signup_step_completed", {
        plan: selectedPlan.plan_key,
        step: "signup_profile",
        completion_percent: 50,
      });
    } catch (_) {
      setPurchaseStatus("idle");
      setPurchaseError("We could not reach the signup service. Please try again.");
      trackEvent("lead_form_submit_failed", {
        form_id: "alphascreen-signup-profile",
        form_type: "signup_profile",
        product_interest: "alphascreen",
        error_type: "network",
      });
    }
  };

  const handleContinueToAgreement = async () => {
    const purchaseIntentId = String(purchaseResult?.purchase_intent_id || "").trim();
    if (!purchaseIntentId || agreementStatus === "preparing") return;
    setAgreementStatus("preparing");
    setAgreementError("");
    trackEvent("signup_step_viewed", {
      plan: selectedPlanKey,
      step: "agreement_prepare",
      completion_percent: 60,
    });

    try {
      const response = await fetch(purchaseIntentAgreementEndpoint(purchaseIntentId), {
        method: "POST",
        headers: { Accept: "application/json" },
      });
      const body = await response.json().catch(() => ({})) as PurchaseAgreementResult & {
        detail?: string;
        code?: string;
        error?: string;
      };

      if (!response.ok) {
        const detail = body.detail || "We could not prepare the membership agreement. Please try again.";
        setAgreementStatus("idle");
        setAgreementError(detail);
        return;
      }

      const signingHref = agreementSigningHref(body);
      setAgreementResult(body);
      if (!signingHref) {
        setAgreementStatus("idle");
        setAgreementError("The agreement was prepared, but the signing link was unavailable. Please try again or contact support.");
        return;
      }
      setAgreementStatus("ready");
      saveCheckoutRecoveryState({
        selectedPlanKey,
        form: purchaseForm,
        purchaseResult,
        agreementResult: body,
        purchaseSubmissionKey,
      });
      trackEvent("signup_step_completed", {
        plan: selectedPlanKey,
        step: "agreement_prepare",
        completion_percent: 70,
      });
    } catch (_) {
      setAgreementStatus("idle");
      setAgreementError("We could not reach the agreement service. Please try again.");
    }
  };

  return (
    <div className="bg-white">
      <section className="relative overflow-hidden bg-[#F8F9FD] pt-28">
        <div className="absolute inset-0 opacity-25" style={{
          backgroundImage: "radial-gradient(circle at 1px 1px, rgba(10,21,71,0.14) 1px, transparent 0)",
          backgroundSize: "36px 36px",
        }} />
        <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-6 pb-16 pt-10 lg:grid-cols-[1.05fr_0.95fr] lg:px-8 lg:pb-20">
          <div>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#A380F6]/25 bg-white px-3 py-1.5 text-sm font-bold text-[#A380F6] shadow-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-[#02D99D]" />
              alphaScreen memberships
            </div>
            <h1 className="max-w-3xl text-5xl font-black leading-[1.04] tracking-normal text-[#0A1547] lg:text-6xl">
              Start with the membership that fits your hiring volume.
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-relaxed text-[#0A1547]/65">
              Choose Basic or Pro for structured AI-assisted candidate screening, or talk to sales for Enterprise volume and rollout support.
            </p>
            <p className="mt-4 text-sm font-semibold text-[#0A1547]/45">
              Last updated {PUBLIC_CONTENT_LAST_UPDATED}
            </p>
            <a
              href="#pricing-demo"
              className="mt-8 inline-flex items-center justify-center gap-2 rounded-full border border-[#0A1547]/12 bg-white px-5 py-3 text-sm font-black text-[#0A1547] transition-colors hover:border-[#A380F6] hover:text-[#A380F6]"
              data-analytics-cta="Request a Demo"
              data-analytics-placement="pricing-hero"
              data-analytics-target="#pricing-demo"
            >
              Request a demo
            </a>
          </div>

          <div className="rounded-lg border border-[#0A1547]/10 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between border-b border-[#0A1547]/8 pb-4">
              <div className="flex items-center gap-3">
                <img src="/alpha-symbol.png" alt="" className="h-9 w-9" />
                <div>
                  <p className="text-sm font-black text-[#0A1547]">alphaScreen memberships</p>
                  <p className="text-xs font-bold text-[#0A1547]/45">Membership pricing preview</p>
                </div>
              </div>
              <ShieldCheck className="h-5 w-5 text-[#02D99D]" />
            </div>
            <div className="mt-5 grid gap-3">
              {[
                ["Basic", "$299/mo or $3,299/year + $399/role", "20 interviews, 10-minute cap, $30 additional interviews"],
                ["Pro", "$599/mo or $6,499/year + $699/role", "30 interviews, 12-minute cap, $35 additional interviews"],
                ["Enterprise", "Custom membership", "Talk to sales for custom volume"],
              ].map(([name, price, detail]) => (
                <div key={name} className="grid grid-cols-[1fr_auto] gap-3 rounded-lg bg-[#F8F9FD] px-4 py-3">
                  <div>
                    <p className="text-sm font-black text-[#0A1547]">{name}</p>
                    <p className="text-xs font-semibold text-[#0A1547]/50">{price}</p>
                  </div>
                  <p className="self-center text-right text-xs font-black text-[#0A1547]/60">{detail}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="packages" className="bg-white py-16 lg:py-20">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mb-8 grid gap-5 lg:grid-cols-[1fr_auto] lg:items-end">
            <div className="max-w-3xl">
              <p className="text-sm font-black uppercase tracking-[0.18em] text-[#02ABE0]">Memberships</p>
              <h2 className="mt-3 text-3xl font-black leading-tight text-[#0A1547] lg:text-4xl">
                Choose the membership that fits your hiring needs.
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#0A1547]/60">
                Select Basic or Pro to start membership signup, or choose Enterprise for custom volume and rollout support.
              </p>
            </div>
            <div className="rounded-lg border border-[#0A1547]/10 bg-[#F8F9FD] p-1">
              {(["monthly", "annual"] as BillingCadenceKey[]).map((cadence) => (
                <button
                  key={cadence}
                  type="button"
                  onClick={() => updateSelectedBillingCadence(cadence)}
                  className={`rounded-md px-4 py-2 text-sm font-black transition-colors ${
                    selectedBillingCadence === cadence
                      ? "bg-[#0A1547] text-white"
                      : "text-[#0A1547]/65 hover:text-[#0A1547]"
                  }`}
                >
                  {cadence === "annual" ? "Annual" : "Monthly"}
                </button>
              ))}
            </div>
          </div>
          <LoadingNotice state={loadState} />
          <div className="grid gap-5 lg:grid-cols-3">
            {planCards.map((plan) => (
              <PlanCard
                key={plan.plan_key}
                plan={plan}
                selected={selectedPlanKey === plan.plan_key}
                billingCadence={selectedBillingCadence}
                onStart={startPurchase}
              />
            ))}
            <EnterpriseCard />
          </div>
          <p className="mt-5 max-w-3xl text-sm leading-relaxed text-[#0A1547]/55">
            Annual platform pricing is discounted and billed upfront. Role fees are billed separately when roles are created. Basic additional interviews are fixed at $30 each. Pro additional interviews are fixed at $35 each. Secure checkout opens after agreement signing.
            {" "}
            New self-serve buyers can optionally prepay their first role during signup and save 10% on that first role.
            {" "}
            For product and workflow questions, review the <a href="/faq" className="font-black text-[#0A1547] underline decoration-[#A380F6]/35 underline-offset-4 transition-colors hover:text-[#A380F6]">alphaScreen FAQ</a> or <a href="/alphascreen" className="font-black text-[#0A1547] underline decoration-[#A380F6]/35 underline-offset-4 transition-colors hover:text-[#A380F6]">alphaScreen overview</a>.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            {[
              ["How it works", "/alphascreen/how-it-works"],
              ["Security", "/alphascreen/security"],
              ["Candidate experience", "/alphascreen/candidate-experience"],
              ["Dental groups", "/alphascreen/for-dental-groups"],
              ["ROI estimator", "/alphascreen/roi"],
              ["Support", "/support"],
            ].map(([label, href]) => (
              <a
                key={href}
                href={href}
                className="rounded-full border border-[#0A1547]/10 bg-[#F8F9FD] px-3 py-2 text-xs font-black text-[#0A1547]/65 transition-colors hover:border-[#A380F6]/45 hover:text-[#A380F6]"
                data-analytics-cta={label}
                data-analytics-placement="pricing-related-links"
              >
                {label}
              </a>
            ))}
          </div>
        </div>
      </section>

      {checkoutModalOpen ? (
        <div id="signup-modal" className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[#0A1547]/55 px-4 py-5 backdrop-blur-sm sm:py-8">
          <button
            type="button"
            className="absolute inset-0 cursor-default"
            aria-label="Close signup modal"
            onClick={closeCheckoutModal}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="signup-modal-title"
            className="relative w-full max-w-5xl rounded-lg bg-white shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4 border-b border-[#0A1547]/10 px-5 py-4 sm:px-6">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[#A380F6]">alphaScreen signup</p>
                <h2 id="signup-modal-title" className="mt-1 text-xl font-black text-[#0A1547] sm:text-2xl">
                  Start membership signup
                </h2>
                <p className="mt-1 text-sm font-semibold text-[#0A1547]/55">
                  Agreement review comes next. Payment is not collected here.
                </p>
              </div>
              <button
                type="button"
                onClick={closeCheckoutModal}
                disabled={purchaseStatus === "submitting" || agreementStatus === "preparing"}
                className="inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border border-[#0A1547]/10 bg-[#F8F9FD] text-[#0A1547] transition-colors hover:border-[#A380F6] hover:text-[#A380F6] disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="max-h-[calc(100vh-9rem)] overflow-y-auto p-4 sm:p-6">
              <PurchaseIntentPanel
                selectedPlan={selectedPlan}
                form={purchaseForm}
                status={purchaseStatus}
                error={purchaseError}
                result={purchaseResult}
                agreementStatus={agreementStatus}
                agreementError={agreementError}
                agreementResult={agreementResult}
                onChange={updatePurchaseField}
                onSubmit={handlePurchaseSubmit}
                onContinueToAgreement={handleContinueToAgreement}
                onBackToPricing={backToPricing}
                onBackToSignup={backToSignupForm}
              />
            </div>
          </div>
        </div>
      ) : null}

      <section className="bg-[#F8F9FD] py-16 lg:py-20">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="grid gap-8">
            <div className="max-w-3xl">
              <p className="text-sm font-black uppercase tracking-[0.18em] text-[#A380F6]">Signup workflow</p>
              <h2 className="mt-3 text-3xl font-black leading-tight text-[#0A1547]">What happens next after signup starts</h2>
              <p className="mt-4 text-sm leading-relaxed text-[#0A1547]/60">
                Pick the membership that fits your hiring volume, review terms, complete checkout, and set up access before creating roles and inviting candidates.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {[
                ["1", "Start membership signup", "Select Basic, Pro, or talk to sales for custom terms."],
                ["2", "Review agreement", "Review and sign your membership agreement."],
                ["3", "Complete Stripe Checkout", "Continue to secure payment after signing."],
                ["4", "Set your password", "Finish account setup and access the dashboard."],
                ["5", "Create roles and invite candidates", "Configure screening roles and send candidates into the workflow."],
              ].map(([step, title, body]) => (
                <div key={step} className="rounded-lg border border-[#0A1547]/10 bg-white p-5">
                  <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-full bg-[#0A1547] text-sm font-black text-white">
                    {step}
                  </div>
                  <h3 className="text-base font-black text-[#0A1547]">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-[#0A1547]/60">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="pricing-demo" className="bg-white py-16 lg:py-20">
        <div className="mx-auto grid max-w-6xl gap-8 px-6 lg:grid-cols-[0.9fr_1fr] lg:items-start lg:px-8">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.18em] text-[#02ABE0]">Demo and contact</p>
            <h2 className="mt-3 text-3xl font-black leading-tight text-[#0A1547] lg:text-4xl">
              Need a custom rollout or Enterprise volume?
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-[#0A1547]/60">
              Request a demo and the alphaSource team can help confirm membership fit, implementation timing, and onboarding options.
            </p>
          </div>
          <div className="rounded-lg border border-[#0A1547]/10 bg-[#F8F9FD] p-6 shadow-sm">
            <LeadCaptureForm
              formId="alphascreen-pricing-demo"
              formType="demo"
              formTestId="alphascreen-pricing-demo-form"
              productInterest="alphascreen"
              successTitle="We'll be in touch!"
              successBody="Our team will reach out to discuss alphaScreen membership fit."
              ctaLabel="Request pricing demo"
            />
          </div>
        </div>
      </section>
    </div>
  );
}
