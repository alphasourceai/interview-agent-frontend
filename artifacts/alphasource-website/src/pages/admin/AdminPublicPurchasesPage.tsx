import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  Clock3,
  CreditCard,
  FileSignature,
  Filter,
  RefreshCw,
  Search,
  ShieldCheck,
  ShoppingCart,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import AdminLayout from "@/components/AdminLayout";
import { supabase } from "@/lib/supabaseClient";

type DaysFilter = "7" | "30" | "90";
type StatusFilter =
  | "all"
  | "signup_started"
  | "agreement_pending"
  | "signed_unpaid"
  | "checkout_pending"
  | "setup_pending"
  | "completed"
  | "failed_payment"
  | "canceled"
  | "unknown";
type MembershipFilter = "all" | "basic" | "pro" | "enterprise";
type CadenceFilter = "all" | "monthly" | "annual";

interface PublicPurchaseItem {
  id: string;
  purchase_intent_id?: string | null;
  status?: { key?: string | null; label?: string | null };
  company?: { legal_name?: string | null; dba?: string | null };
  buyer?: {
    name?: string | null;
    email?: string | null;
    phone?: string | null;
    title?: string | null;
  };
  membership?: {
    key?: string | null;
    display_name?: string | null;
    billing_cadence?: string | null;
    platform_fee?: number | null;
    per_role_fee?: number | null;
    included_interviews?: number | null;
    interview_duration_minutes?: number | null;
    additional_interview_price?: number | null;
  };
  first_role_prepay?: {
    first_role_prepay_selected?: boolean | null;
    first_role_prepay_amount_cents?: number | null;
    first_role_normal_role_fee_cents?: number | null;
    first_role_prepay_discount_percent?: number | null;
    first_role_prepay_credit_type?: string | null;
    first_role_credit_status?: string | null;
    used_by_role_id?: string | null;
    used_at?: string | null;
  } | null;
  source?: { path?: string | null };
  agreement?: {
    id?: string | null;
    status?: string | null;
    checkout_status?: string | null;
    checkout_session_id?: string | null;
    sent_at?: string | null;
    opened_at?: string | null;
    signed_at?: string | null;
    voided_at?: string | null;
  } | null;
  payment?: {
    checkout_status?: string | null;
    checkout_created_at?: string | null;
    checkout_paid_at?: string | null;
    stripe_checkout_session_id?: string | null;
    stripe_customer_id?: string | null;
    stripe_subscription_id?: string | null;
    billing_status?: string | null;
    subscription_status?: string | null;
    current_term_end?: string | null;
  };
  account_setup?: {
    client_id?: string | null;
    client_name?: string | null;
    member_found?: boolean;
    member_user_linked?: boolean;
    member_role?: string | null;
    member_created_at?: string | null;
  };
  email_delivery?: {
    welcome_email?: {
      category?: string | null;
      status?: string | null;
      is_problem?: boolean;
      last_event_at?: string | null;
    } | null;
    setup_email?: { status?: string | null } | null;
  };
  expires_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  support_summary?: string | null;
}

interface PublicPurchasesPayload {
  generated_at?: string;
  filters?: {
    date_from_display?: string;
    date_to_display?: string;
    status?: string;
    membership?: string;
    billing_cadence?: string;
  };
  summary?: {
    total?: number;
    started?: number;
    signup_started?: number;
    agreement_pending?: number;
    signed_unpaid?: number;
    checkout_pending?: number;
    setup_pending?: number;
    completed?: number;
    failed_payment?: number;
    canceled?: number;
    failed_canceled?: number;
    unknown?: number;
  };
  purchases?: {
    items?: PublicPurchaseItem[];
    pagination?: {
      page?: number;
      limit?: number;
      total?: number;
      total_pages?: number;
      returned?: number;
      has_more?: boolean;
    };
  };
}

type PurchaseAction = "agreement" | "setup" | "welcome" | "checkout" | "copy_summary";

interface ActionState {
  loading?: boolean;
  success?: string;
  error?: string;
}

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

const backendBase = firstBase(
  (env as Record<string, unknown>).VITE_BACKEND_URL,
  (env as Record<string, unknown>).VITE_API_URL,
  (env as Record<string, unknown>).VITE_PUBLIC_BACKEND_URL,
  (env as Record<string, unknown>).PUBLIC_BACKEND_URL,
  (env as Record<string, unknown>).BACKEND_URL,
);

const surfaceCardStyle = {
  backgroundColor: "var(--as-surface)",
  border: "1px solid var(--as-border)",
  boxShadow: "var(--as-shadow)",
};
const mutedPanelStyle = {
  backgroundColor: "color-mix(in srgb, var(--as-text) 4%, transparent)",
  borderColor: "var(--as-border)",
};
const primaryTextStyle = { color: "var(--as-text)" };
const mutedTextStyle = { color: "var(--as-text-muted)" };
const subtleTextStyle = { color: "var(--as-text-subtle)" };
const fieldStyle = {
  backgroundColor: "var(--as-surface)",
  borderColor: "var(--as-border)",
  color: "var(--as-text)",
};

function parseJsonSafe(text: string): unknown {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function extractErrorMessage(text: string, fallback: string): string {
  if (!text) return fallback;
  const data = parseJsonSafe(text);
  const detail =
    data && typeof data === "object"
      ? (data as { detail?: unknown }).detail ??
        (data as { message?: unknown }).message ??
        (data as { error?: unknown }).error
      : null;
  if (typeof detail === "string" && detail.trim()) return detail;
  return fallback;
}

function titleCase(value: unknown): string {
  const raw = String(value || "").trim();
  if (!raw) return "Unknown";
  return raw
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function formatCount(value: unknown): string {
  const numeric = Number(value || 0);
  return Number.isFinite(numeric) ? numeric.toLocaleString() : "0";
}

function formatMoney(value: unknown): string {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "Not available";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(numeric);
}

function formatMoneyFromCents(value: unknown): string {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "Not available";
  return formatMoney(numeric / 100);
}

function formatDateTime(value: unknown): string {
  const raw = String(value || "").trim();
  if (!raw) return "Not available";
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return "Not available";
  return parsed.toLocaleString();
}

function safeText(value: unknown, fallback = "Not available"): string {
  const text = String(value || "").trim();
  return text || fallback;
}

function redactEmail(value: unknown): string {
  const email = String(value || "").trim();
  const [user, domain] = email.split("@");
  if (!user || !domain) return email || "this buyer";
  if (user.length <= 3) return `${user.slice(0, 1)}***@${domain}`;
  return `${user.slice(0, 2)}***@${domain}`;
}

function formatFirstRolePrepayStatus(item: PublicPurchaseItem): string {
  const prepay = item.first_role_prepay || null;
  if (prepay?.first_role_prepay_selected !== true) return "First role prepay: Not selected";
  const amount = formatMoneyFromCents(prepay.first_role_prepay_amount_cents);
  const status = String(prepay.first_role_credit_status || "").trim().toLowerCase();
  if (status === "used") {
    const usedBy = safeText(prepay.used_by_role_id, "unknown role");
    const usedAt = formatDateTime(prepay.used_at);
    return `First role prepay: Selected — ${amount} credit used by role ${usedBy} on ${usedAt}`;
  }
  if (status === "unused") return `First role prepay: Selected — ${amount} credit unused`;
  return `First role prepay: Selected — ${amount} credit ${safeText(status, "status unavailable")}`;
}

function actionKey(itemId: string, action: PurchaseAction): string {
  return `${itemId}:${action}`;
}

function canSendSetupOrWelcome(item: PublicPurchaseItem): boolean {
  const status = String(item.status?.key || "").toLowerCase();
  return status === "setup_pending" || status === "completed";
}

function canSendAgreementLink(item: PublicPurchaseItem): boolean {
  const status = String(item.status?.key || "").toLowerCase();
  const agreementStatus = String(item.agreement?.status || "").toLowerCase();
  const checkoutStatus = String(item.agreement?.checkout_status || item.payment?.checkout_status || "").toLowerCase();
  return status === "agreement_pending" && ["sent", "pending_signature", "signature_pending"].includes(agreementStatus) && checkoutStatus !== "paid";
}

function canSendCheckoutLink(item: PublicPurchaseItem): boolean {
  const status = String(item.status?.key || "").toLowerCase();
  return status === "signed_unpaid" || status === "checkout_pending";
}

function statusClass(status: unknown): string {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "completed") return "bg-[#02D99D]/10 text-[#00886A]";
  if (normalized === "setup_pending") return "bg-[#A380F6]/10 text-[#7C5FCC]";
  if (normalized === "failed_payment" || normalized === "canceled") return "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300";
  if (normalized === "checkout_pending" || normalized === "signed_unpaid") return "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300";
  if (normalized === "agreement_pending") return "bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300";
  return "bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-white/70";
}

function StatusBadge({ statusKey, label }: { statusKey?: string | null; label?: string | null }) {
  const key = String(statusKey || "unknown");
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-black ${statusClass(key)}`}>
      {safeText(label, titleCase(key))}
    </span>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  detail,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  detail: string;
  tone: string;
}) {
  return (
    <section className="rounded-2xl border p-4" style={surfaceCardStyle}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-widest" style={subtleTextStyle}>{label}</p>
          <p className="mt-2 text-2xl font-black" style={primaryTextStyle}>{value}</p>
        </div>
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${tone}`}>
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>
      </div>
      <p className="mt-3 text-xs font-semibold leading-relaxed" style={mutedTextStyle}>{detail}</p>
    </section>
  );
}

function DetailRow({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-black uppercase tracking-widest" style={subtleTextStyle}>{label}</p>
      <p className="mt-1 break-words text-sm font-semibold" style={primaryTextStyle}>{safeText(value)}</p>
    </div>
  );
}

function PurchaseRow({
  item,
  expanded,
  onToggle,
  actionStates,
  onRecoveryAction,
  onCopySupportSummary,
}: {
  item: PublicPurchaseItem;
  expanded: boolean;
  onToggle: () => void;
  actionStates: Record<string, ActionState>;
  onRecoveryAction: (item: PublicPurchaseItem, action: Exclude<PurchaseAction, "copy_summary">) => void;
  onCopySupportSummary: (item: PublicPurchaseItem) => void;
}) {
  const rowId = String(item.id || item.purchase_intent_id || "");
  const membershipName = safeText(item.membership?.display_name, titleCase(item.membership?.key));
  const cadence = safeText(item.membership?.billing_cadence, "");
  const cadenceLabel = cadence ? titleCase(cadence) : "Billing not available";
  const usage = [
    item.membership?.included_interviews ? `${item.membership.included_interviews} interviews` : "",
    item.membership?.interview_duration_minutes ? `${item.membership.interview_duration_minutes}-minute cap` : "",
    item.membership?.additional_interview_price ? `${formatMoney(item.membership.additional_interview_price)} overage` : "",
  ].filter(Boolean).join(" · ");
  const statusKey = String(item.status?.key || "").toLowerCase();
  const setupState = actionStates[actionKey(rowId, "setup")] || {};
  const agreementState = actionStates[actionKey(rowId, "agreement")] || {};
  const welcomeState = actionStates[actionKey(rowId, "welcome")] || {};
  const checkoutState = actionStates[actionKey(rowId, "checkout")] || {};
  const copyState = actionStates[actionKey(rowId, "copy_summary")] || {};
  const hasRecoveryActions = canSendAgreementLink(item) || canSendSetupOrWelcome(item) || canSendCheckoutLink(item);
  const renderActionFeedback = (state: ActionState) => {
    if (state.error) return <p className="text-xs font-semibold text-rose-700 dark:text-rose-300">{state.error}</p>;
    if (state.success) return <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">{state.success}</p>;
    return null;
  };

  return (
    <article className="rounded-2xl border p-4" style={surfaceCardStyle}>
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="break-words text-base font-black" style={primaryTextStyle}>
              {safeText(item.company?.legal_name, "Unknown company")}
            </h3>
            <StatusBadge statusKey={item.status?.key} label={item.status?.label} />
          </div>
          <p className="mt-1 text-sm font-semibold" style={mutedTextStyle}>
            {membershipName} membership · {cadenceLabel} · {safeText(item.buyer?.email)}
          </p>
          <p className="mt-1 text-xs font-semibold" style={subtleTextStyle}>
            Started {formatDateTime(item.created_at)} from {safeText(item.source?.path, "unknown source")}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <div className="hidden text-right md:block">
            <p className="text-sm font-black" style={primaryTextStyle}>{formatMoney(item.membership?.platform_fee)}</p>
            <p className="text-xs font-semibold" style={mutedTextStyle}>
              + {formatMoney(item.membership?.per_role_fee)} / role
            </p>
          </div>
          <button
            type="button"
            onClick={onToggle}
            className="inline-flex items-center justify-center gap-2 rounded-full border px-3 py-2 text-xs font-black transition hover:border-[#A380F6] focus:outline-none focus:ring-2 focus:ring-[#A380F6]"
            style={fieldStyle}
            aria-expanded={expanded}
          >
            Details
            <ChevronDown className={`h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`} aria-hidden="true" />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="mt-4 space-y-4 rounded-2xl border p-4" style={mutedPanelStyle}>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <DetailRow label="Buyer" value={item.buyer?.name} />
            <DetailRow label="Buyer email" value={item.buyer?.email} />
            <DetailRow label="Buyer title" value={item.buyer?.title} />
            <DetailRow label="Buyer phone" value={item.buyer?.phone} />
            <DetailRow label="Membership" value={`${membershipName} · ${cadenceLabel}`} />
            <DetailRow label="First role prepay" value={formatFirstRolePrepayStatus(item)} />
            <DetailRow label="Usage" value={usage} />
            <DetailRow label="Agreement" value={item.agreement?.id} />
            <DetailRow label="Agreement status" value={`${safeText(item.agreement?.status)} · checkout ${safeText(item.agreement?.checkout_status)}`} />
            <DetailRow label="Signed at" value={formatDateTime(item.agreement?.signed_at)} />
            <DetailRow label="Checkout session" value={item.payment?.stripe_checkout_session_id} />
            <DetailRow label="Stripe customer" value={item.payment?.stripe_customer_id} />
            <DetailRow label="Subscription" value={item.payment?.stripe_subscription_id} />
            <DetailRow label="Billing status" value={`${safeText(item.payment?.billing_status)} · ${safeText(item.payment?.subscription_status)}`} />
            <DetailRow label="Client" value={item.account_setup?.client_name || item.account_setup?.client_id} />
            <DetailRow label="Member setup" value={item.account_setup?.member_user_linked ? `Linked · ${safeText(item.account_setup?.member_role)}` : item.account_setup?.member_found ? "Member row found, user not linked" : "Not found"} />
            <DetailRow label="Welcome email" value={item.email_delivery?.welcome_email ? `${safeText(item.email_delivery.welcome_email.status)} · ${formatDateTime(item.email_delivery.welcome_email.last_event_at)}` : "Not recorded"} />
          </div>
          <div className="rounded-2xl border p-4" style={fieldStyle}>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-sm font-black" style={primaryTextStyle}>Recovery actions</p>
                <p className="mt-1 text-xs font-semibold leading-relaxed" style={mutedTextStyle}>
                  Email sends are admin-only and do not change payment, billing, agreement, or access status.
                </p>
                {statusKey === "agreement_pending" && (
                  <p className="mt-2 text-xs font-semibold leading-relaxed text-sky-700 dark:text-sky-300">
                    Agreement sent; signature is pending. Checkout is unavailable until the buyer signs.
                  </p>
                )}
                {statusKey === "setup_pending" && (
                  <p className="mt-2 text-xs font-semibold leading-relaxed text-[#7C5FCC] dark:text-[#D7CBFB]">
                    Payment appears complete. Password setup or member user linking is still pending.
                  </p>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {canSendAgreementLink(item) && (
                  <button
                    type="button"
                    disabled={agreementState.loading}
                    onClick={() => onRecoveryAction(item, "agreement")}
                    className="rounded-full border border-[#A380F6]/35 px-3 py-2 text-xs font-black text-[#4E40A5] transition hover:bg-[#A380F6]/10 disabled:cursor-not-allowed disabled:opacity-50 dark:text-[#D7CBFB]"
                  >
                    {agreementState.loading ? "Sending..." : "Resend agreement link"}
                  </button>
                )}
                {canSendSetupOrWelcome(item) && (
                  <>
                    <button
                      type="button"
                      disabled={setupState.loading}
                      onClick={() => onRecoveryAction(item, "setup")}
                      className="rounded-full border border-[#A380F6]/35 px-3 py-2 text-xs font-black text-[#4E40A5] transition hover:bg-[#A380F6]/10 disabled:cursor-not-allowed disabled:opacity-50 dark:text-[#D7CBFB]"
                    >
                      {setupState.loading ? "Sending..." : "Resend setup email"}
                    </button>
                    <button
                      type="button"
                      disabled={welcomeState.loading}
                      onClick={() => onRecoveryAction(item, "welcome")}
                      className="rounded-full border border-[#A380F6]/35 px-3 py-2 text-xs font-black text-[#4E40A5] transition hover:bg-[#A380F6]/10 disabled:cursor-not-allowed disabled:opacity-50 dark:text-[#D7CBFB]"
                    >
                      {welcomeState.loading ? "Sending..." : "Resend welcome email"}
                    </button>
                  </>
                )}
                {canSendCheckoutLink(item) && (
                  <button
                    type="button"
                    disabled={checkoutState.loading}
                    onClick={() => onRecoveryAction(item, "checkout")}
                    className="rounded-full border border-[#A380F6]/35 px-3 py-2 text-xs font-black text-[#4E40A5] transition hover:bg-[#A380F6]/10 disabled:cursor-not-allowed disabled:opacity-50 dark:text-[#D7CBFB]"
                  >
                    {checkoutState.loading ? "Sending..." : "Resend checkout link"}
                  </button>
                )}
                <button
                  type="button"
                  disabled={copyState.loading}
                  onClick={() => onCopySupportSummary(item)}
                  className="rounded-full border px-3 py-2 text-xs font-black transition hover:border-[#A380F6] disabled:cursor-not-allowed disabled:opacity-50"
                  style={fieldStyle}
                >
                  Copy support summary
                </button>
              </div>
            </div>
            <div className="mt-3 space-y-1">
              {!hasRecoveryActions && (
                <p className="text-xs font-semibold" style={mutedTextStyle}>
                  Email recovery actions are not available for this current status.
                </p>
              )}
              {renderActionFeedback(agreementState)}
              {renderActionFeedback(setupState)}
              {renderActionFeedback(welcomeState)}
              {renderActionFeedback(checkoutState)}
              {renderActionFeedback(copyState)}
            </div>
          </div>
        </div>
      )}
    </article>
  );
}

export default function AdminPublicPurchasesPage() {
  const [payload, setPayload] = useState<PublicPurchasesPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [days, setDays] = useState<DaysFilter>("30");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [membership, setMembership] = useState<MembershipFilter>("all");
  const [cadence, setCadence] = useState<CadenceFilter>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [reloadNonce, setReloadNonce] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [actionStates, setActionStates] = useState<Record<string, ActionState>>({});

  const getToken = useCallback(async (): Promise<string> => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const token = String(session?.access_token || "").trim();
    if (!token) throw new Error("Missing session token.");
    return token;
  }, []);

  const loadPublicPurchases = useCallback(async () => {
    if (!backendBase) {
      setPayload(null);
      setError("Missing backend base URL configuration.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const token = await getToken();
      const params = new URLSearchParams({
        days,
        page: String(page),
        limit: "25",
      });
      if (status !== "all") params.set("status", status);
      if (membership !== "all") params.set("membership", membership);
      if (cadence !== "all") params.set("cadence", cadence);
      if (search.trim()) params.set("search", search.trim());
      const response = await fetch(`${backendBase}/admin/public-purchases?${params.toString()}`, {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
        credentials: "omit",
      });
      const text = await response.text();
      if (!response.ok) throw new Error(extractErrorMessage(text, "Could not load public purchases."));
      setPayload((parseJsonSafe(text) as PublicPurchasesPayload | null) || null);
    } catch (loadError) {
      setPayload(null);
      setError(loadError instanceof Error ? loadError.message : "Could not load public purchases.");
    } finally {
      setLoading(false);
    }
  }, [cadence, days, getToken, membership, page, search, status]);

  useEffect(() => {
    void loadPublicPurchases();
  }, [loadPublicPurchases, reloadNonce]);

  const resetPage = useCallback(() => {
    setPage(1);
    setExpandedId(null);
  }, []);

  const setRowActionState = useCallback((itemId: string, action: PurchaseAction, state: ActionState) => {
    setActionStates((current) => ({
      ...current,
      [actionKey(itemId, action)]: state,
    }));
  }, []);

  const runRecoveryAction = useCallback(async (item: PublicPurchaseItem, action: Exclude<PurchaseAction, "copy_summary">) => {
    const itemId = String(item.id || item.purchase_intent_id || "").trim();
    if (!itemId) return;
    const email = safeText(item.buyer?.email, "this buyer");
    const confirmation =
      action === "agreement"
        ? `Send membership agreement link to ${email}?`
        : action === "setup"
        ? `Send password setup email to ${redactEmail(email)}?`
        : action === "welcome"
          ? `Send welcome email to ${email}?`
          : `Send checkout recovery link to ${email}?`;
    if (!window.confirm(confirmation)) return;
    if (!backendBase) {
      setRowActionState(itemId, action, { error: "Missing backend base URL configuration." });
      return;
    }
    const endpoint =
      action === "agreement"
        ? "resend-agreement-link"
        : action === "setup"
        ? "resend-setup-email"
        : action === "welcome"
          ? "resend-welcome-email"
          : "resend-checkout-link";
    setRowActionState(itemId, action, { loading: true });
    try {
      const token = await getToken();
      const response = await fetch(`${backendBase}/admin/public-purchases/${encodeURIComponent(itemId)}/${endpoint}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        credentials: "omit",
      });
      const text = await response.text();
      if (!response.ok) {
        throw new Error(extractErrorMessage(text, "Recovery action failed."));
      }
      const data = parseJsonSafe(text) as { message?: unknown; recipient?: unknown } | null;
      const fallback =
        action === "agreement"
          ? "Agreement link sent."
          : action === "setup"
          ? "Password setup email sent."
          : action === "welcome"
            ? "Welcome email sent."
            : "Checkout recovery link sent.";
      setRowActionState(itemId, action, { success: String(data?.message || fallback) });
      setReloadNonce((value) => value + 1);
    } catch (actionError) {
      setRowActionState(itemId, action, {
        error: actionError instanceof Error ? actionError.message : "Recovery action failed.",
      });
    }
  }, [getToken, setRowActionState]);

  const copySupportSummary = useCallback(async (item: PublicPurchaseItem) => {
    const itemId = String(item.id || item.purchase_intent_id || "").trim();
    if (!itemId) return;
    const summary = String(item.support_summary || "").trim();
    if (!summary) {
      setRowActionState(itemId, "copy_summary", { error: "Support summary is not available for this row." });
      return;
    }
    setRowActionState(itemId, "copy_summary", { loading: true });
    try {
      await navigator.clipboard.writeText(summary);
      setRowActionState(itemId, "copy_summary", { success: "Support summary copied." });
    } catch {
      setRowActionState(itemId, "copy_summary", { error: "Could not copy support summary." });
    }
  }, [setRowActionState]);

  const purchases = payload?.purchases?.items || [];
  const pagination = payload?.purchases?.pagination || {};
  const summary = payload?.summary || {};
  const dateLabel = payload?.filters?.date_from_display && payload?.filters?.date_to_display
    ? `${payload.filters.date_from_display} to ${payload.filters.date_to_display}`
    : `Last ${days} days`;
  const statusOptions = useMemo<Array<{ value: StatusFilter; label: string }>>(() => [
    { value: "all", label: "All statuses" },
    { value: "signup_started", label: "Signup started" },
    { value: "agreement_pending", label: "Agreement pending" },
    { value: "signed_unpaid", label: "Signed / unpaid" },
    { value: "checkout_pending", label: "Checkout pending" },
    { value: "setup_pending", label: "Setup pending" },
    { value: "completed", label: "Completed" },
    { value: "failed_payment", label: "Failed payment" },
    { value: "canceled", label: "Canceled" },
    { value: "unknown", label: "Unknown" },
  ], []);

  return (
    <AdminLayout title="Public Purchases">
      <div className="space-y-6">
        <section className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-[10px] font-black uppercase tracking-[0.24em]" style={subtleTextStyle}>Admin only</p>
            <h1 className="mt-2 text-2xl font-black sm:text-3xl" style={primaryTextStyle}>Public Purchases</h1>
            <p className="mt-2 text-sm font-semibold leading-relaxed" style={mutedTextStyle}>
              Track self-serve alphaScreen membership signups, agreement status, payment progress, and account setup.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/admin/public-purchases/playbook"
              className="inline-flex items-center justify-center gap-2 rounded-full border px-4 py-2 text-sm font-black transition hover:border-[#A380F6] focus:outline-none focus:ring-2 focus:ring-[#A380F6]"
              style={fieldStyle}
            >
              <BookOpen className="h-4 w-4" aria-hidden="true" />
              Support Playbook
            </Link>
            <button
              type="button"
              onClick={() => setReloadNonce((value) => value + 1)}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-black text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              style={{ backgroundColor: "#A380F6" }}
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} aria-hidden="true" />
              Refresh
            </button>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            icon={ShoppingCart}
            label="Started"
            value={formatCount(summary.signup_started ?? summary.started)}
            detail={`New signup submissions in ${dateLabel}.`}
            tone="border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-500/25 dark:bg-sky-500/10 dark:text-sky-300"
          />
          <SummaryCard
            icon={FileSignature}
            label="Agreement pending"
            value={formatCount(summary.agreement_pending)}
            detail="Agreement has not been signed yet."
            tone="border-[#A380F6]/25 bg-[#A380F6]/5 text-[#7C5FCC]"
          />
          <SummaryCard
            icon={CreditCard}
            label="Signed / checkout"
            value={formatCount(Number(summary.signed_unpaid || 0) + Number(summary.checkout_pending || 0))}
            detail="Signed but unpaid or currently in checkout."
            tone="border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-300"
          />
          <SummaryCard
            icon={ShieldCheck}
            label="Setup pending"
            value={formatCount(summary.setup_pending)}
            detail="Payment appears complete, account setup is still in progress."
            tone="border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-500/25 dark:bg-indigo-500/10 dark:text-indigo-300"
          />
          <SummaryCard
            icon={CheckCircle2}
            label="Completed"
            value={formatCount(summary.completed)}
            detail="Active billing and linked member access are present."
            tone="border-[#02D99D]/25 bg-[#02D99D]/5 text-[#00886A]"
          />
          <SummaryCard
            icon={AlertCircle}
            label="Failed / canceled"
            value={formatCount(summary.failed_canceled)}
            detail="Payment failed, purchase expired, or purchase was canceled."
            tone="border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/25 dark:bg-rose-500/10 dark:text-rose-300"
          />
          <SummaryCard
            icon={Clock3}
            label="Unknown"
            value={formatCount(summary.unknown)}
            detail="Records that do not map cleanly to a known state."
            tone="border-slate-200 bg-slate-50 text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-white/75"
          />
          <SummaryCard
            icon={UserRound}
            label="Total"
            value={formatCount(summary.total)}
            detail="Total matching public purchase records after filters."
            tone="border-slate-200 bg-slate-50 text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-white/75"
          />
        </section>

        <section className="rounded-2xl border p-4" style={surfaceCardStyle}>
          <div className="mb-4 flex items-center gap-2">
            <Filter className="h-4 w-4" style={subtleTextStyle} aria-hidden="true" />
            <h2 className="text-sm font-black" style={primaryTextStyle}>Filters</h2>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
            <label className="space-y-1.5">
              <span className="text-[10px] font-black uppercase tracking-widest" style={subtleTextStyle}>Date range</span>
              <select
                value={days}
                onChange={(event) => { resetPage(); setDays(event.target.value as DaysFilter); }}
                className="w-full rounded-xl border px-3 py-2 text-sm font-semibold outline-none focus:ring-2 focus:ring-[#A380F6]"
                style={fieldStyle}
              >
                <option value="7">Last 7 days</option>
                <option value="30">Last 30 days</option>
                <option value="90">Last 90 days</option>
              </select>
            </label>
            <label className="space-y-1.5">
              <span className="text-[10px] font-black uppercase tracking-widest" style={subtleTextStyle}>Status</span>
              <select
                value={status}
                onChange={(event) => { resetPage(); setStatus(event.target.value as StatusFilter); }}
                className="w-full rounded-xl border px-3 py-2 text-sm font-semibold outline-none focus:ring-2 focus:ring-[#A380F6]"
                style={fieldStyle}
              >
                {statusOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
            <label className="space-y-1.5">
              <span className="text-[10px] font-black uppercase tracking-widest" style={subtleTextStyle}>Membership</span>
              <select
                value={membership}
                onChange={(event) => { resetPage(); setMembership(event.target.value as MembershipFilter); }}
                className="w-full rounded-xl border px-3 py-2 text-sm font-semibold outline-none focus:ring-2 focus:ring-[#A380F6]"
                style={fieldStyle}
              >
                <option value="all">All memberships</option>
                <option value="basic">Basic</option>
                <option value="pro">Pro</option>
                <option value="enterprise">Enterprise</option>
              </select>
            </label>
            <label className="space-y-1.5">
              <span className="text-[10px] font-black uppercase tracking-widest" style={subtleTextStyle}>Cadence</span>
              <select
                value={cadence}
                onChange={(event) => { resetPage(); setCadence(event.target.value as CadenceFilter); }}
                className="w-full rounded-xl border px-3 py-2 text-sm font-semibold outline-none focus:ring-2 focus:ring-[#A380F6]"
                style={fieldStyle}
              >
                <option value="all">All cadences</option>
                <option value="monthly">Monthly</option>
                <option value="annual">Annual</option>
              </select>
            </label>
            <label className="space-y-1.5">
              <span className="text-[10px] font-black uppercase tracking-widest" style={subtleTextStyle}>Search</span>
              <div className="flex items-center gap-2 rounded-xl border px-3 py-2 focus-within:ring-2 focus-within:ring-[#A380F6]" style={fieldStyle}>
                <Search className="h-4 w-4" style={subtleTextStyle} aria-hidden="true" />
                <input
                  value={search}
                  onChange={(event) => { resetPage(); setSearch(event.target.value); }}
                  placeholder="Company or buyer email"
                  className="min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none"
                />
              </div>
            </label>
          </div>
        </section>

        {error && (
          <section className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-700 dark:border-rose-500/25 dark:bg-rose-500/10 dark:text-rose-300">
            {error}
          </section>
        )}

        <section className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-base font-black" style={primaryTextStyle}>Purchase rows</h2>
              <p className="text-xs font-semibold" style={mutedTextStyle}>
                Showing {formatCount(pagination.returned)} of {formatCount(pagination.total)} matching records.
              </p>
            </div>
            <p className="text-xs font-semibold" style={subtleTextStyle}>
              Last refreshed {formatDateTime(payload?.generated_at)}
            </p>
          </div>

          {loading && purchases.length === 0 ? (
            <section className="rounded-2xl border p-6 text-sm font-semibold" style={surfaceCardStyle}>
              Loading public purchases...
            </section>
          ) : purchases.length === 0 ? (
            <section className="rounded-2xl border p-6 text-sm font-semibold" style={surfaceCardStyle}>
              No public purchases match the current filters.
            </section>
          ) : (
            purchases.map((item) => {
              const rowId = String(item.id || item.purchase_intent_id || "");
              return (
                <PurchaseRow
                  key={rowId}
                  item={item}
                  expanded={expandedId === rowId}
                  onToggle={() => setExpandedId((current) => (current === rowId ? null : rowId))}
                  actionStates={actionStates}
                  onRecoveryAction={runRecoveryAction}
                  onCopySupportSummary={copySupportSummary}
                />
              );
            })
          )}
        </section>

        <section className="flex flex-col gap-3 rounded-2xl border p-4 sm:flex-row sm:items-center sm:justify-between" style={surfaceCardStyle}>
          <p className="text-xs font-semibold" style={mutedTextStyle}>
            Page {formatCount(pagination.page || page)} of {formatCount(pagination.total_pages || 1)}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={loading || page <= 1}
              onClick={() => { setExpandedId(null); setPage((value) => Math.max(1, value - 1)); }}
              className="rounded-full border px-4 py-2 text-xs font-black transition hover:border-[#A380F6] disabled:cursor-not-allowed disabled:opacity-50"
              style={fieldStyle}
            >
              Previous
            </button>
            <button
              type="button"
              disabled={loading || !pagination.has_more}
              onClick={() => { setExpandedId(null); setPage((value) => value + 1); }}
              className="rounded-full border px-4 py-2 text-xs font-black transition hover:border-[#A380F6] disabled:cursor-not-allowed disabled:opacity-50"
              style={fieldStyle}
            >
              Next
            </button>
          </div>
        </section>
      </div>
    </AdminLayout>
  );
}
