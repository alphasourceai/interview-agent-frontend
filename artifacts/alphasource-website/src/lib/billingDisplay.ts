export type BillingModel = "fixed" | "rollover" | "usage" | null;

export function readAutoRenewUpdate(value: unknown, requested: boolean): { confirmed: boolean | null; notice: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Renewal response could not be verified.");
  const payload = value as Record<string, unknown>;
  if (payload.renewal === undefined) {
    const item = payload.item as { auto_renew?: unknown } | null | undefined;
    return { confirmed: typeof item?.auto_renew === "boolean" ? item.auto_renew : requested, notice: "Auto-renew updated." };
  }
  const renewal = payload.renewal as Record<string, unknown>;
  if (!renewal || typeof renewal !== "object" || Array.isArray(renewal)
    || !["waiting", "claimed", "unknown", "applied", "held", "busy"].includes(String(renewal.status))
    || typeof renewal.requested_auto_renew !== "boolean"
    || typeof renewal.stripe_renewal_billing_cutoff_at !== "string" || !Number.isFinite(Date.parse(renewal.stripe_renewal_billing_cutoff_at))) {
    throw new Error("Renewal response could not be verified.");
  }
  if (renewal.requested_auto_renew !== requested) return { confirmed: null,
    notice: "The prior renewal request is still pending; this change has not been applied." };
  if (renewal.status === "applied") return { confirmed: renewal.requested_auto_renew, notice: "Auto-renew confirmed with Stripe." };
  return { confirmed: null, notice: renewal.status === "waiting"
    ? "Renewal preference saved and scheduled. Current-term payments continue; the confirmed setting is unchanged."
    : renewal.status === "held" ? "Renewal request is held for review. The confirmed setting is unchanged."
      : "Renewal request is awaiting confirmation. The confirmed setting is unchanged." };
}

export interface ClientMembershipTerms {
  commitment_months: 3 | 6 | 12;
  payment_option: "prepaid" | "monthly_installments";
  currency: "usd";
  platform_payment_cents: number;
  platform_commitment_total_cents: number;
  installment_count: number;
  current_term_start_at: string;
  current_term_end_at: string;
  term_start_basis?: "generation_date" | "first_payment_success";
  auto_renew: boolean;
  stripe_renewal_billing_cutoff_at?: string;
  renewal_request_status?: "none" | "waiting" | "claimed" | "unknown" | "applied" | "held";
  requested_auto_renew?: boolean | null;
  renewal_requested_at?: string | null;
}

export function readClientMembershipTerms(value: unknown): ClientMembershipTerms | null {
  if (value == null) return null;
  if (typeof value !== "object" || Array.isArray(value)) throw new Error("Membership terms could not be verified.");
  const v = value as Record<string, unknown>;
  const count = v.payment_option === "prepaid" ? 1 : v.commitment_months;
  if (![3, 6, 12].includes(v.commitment_months as number)
    || (v.payment_option !== "prepaid" && v.payment_option !== "monthly_installments")
    || v.currency !== "usd" || typeof v.auto_renew !== "boolean"
    || typeof v.platform_payment_cents !== "number" || !Number.isSafeInteger(v.platform_payment_cents) || v.platform_payment_cents <= 0
    || typeof v.platform_commitment_total_cents !== "number" || !Number.isSafeInteger(v.platform_commitment_total_cents)
    || v.installment_count !== count || v.platform_commitment_total_cents !== v.platform_payment_cents * Number(count)
    || typeof v.current_term_start_at !== "string" || !Number.isFinite(Date.parse(v.current_term_start_at))
    || typeof v.current_term_end_at !== "string" || !Number.isFinite(Date.parse(v.current_term_end_at))
    || Date.parse(v.current_term_end_at) <= Date.parse(v.current_term_start_at)) {
    throw new Error("Membership terms could not be verified.");
  }
  if (v.term_start_basis !== undefined && v.term_start_basis !== "generation_date"
    && v.term_start_basis !== "first_payment_success") {
    throw new Error("Membership terms could not be verified.");
  }
  const renewal = v.stripe_renewal_billing_cutoff_at === undefined ? {} : (() => {
    if (typeof v.stripe_renewal_billing_cutoff_at !== "string" || !Number.isFinite(Date.parse(v.stripe_renewal_billing_cutoff_at))
      || !["none", "waiting", "claimed", "unknown", "applied", "held"].includes(String(v.renewal_request_status))
      || (v.requested_auto_renew !== null && typeof v.requested_auto_renew !== "boolean")
      || (v.renewal_requested_at !== null && (typeof v.renewal_requested_at !== "string" || !Number.isFinite(Date.parse(v.renewal_requested_at))))) {
      throw new Error("Renewal preference could not be verified.");
    }
    return { stripe_renewal_billing_cutoff_at: v.stripe_renewal_billing_cutoff_at,
      renewal_request_status: v.renewal_request_status as ClientMembershipTerms["renewal_request_status"],
      requested_auto_renew: v.requested_auto_renew as boolean | null,
      renewal_requested_at: v.renewal_requested_at as string | null };
  })();
  return {
    commitment_months: v.commitment_months as ClientMembershipTerms["commitment_months"],
    payment_option: v.payment_option, currency: "usd", platform_payment_cents: v.platform_payment_cents,
    platform_commitment_total_cents: v.platform_commitment_total_cents, installment_count: Number(count),
    current_term_start_at: v.current_term_start_at, current_term_end_at: v.current_term_end_at, auto_renew: v.auto_renew,
    ...(v.term_start_basis === undefined ? {} : { term_start_basis: v.term_start_basis }),
    ...renewal
  };
}

// Generation-date agreements bind a UTC calendar day, not the prior local
// evening. Historical first-payment terms keep their original local display.
export function membershipTermEndDate(value: unknown, basis?: ClientMembershipTerms["term_start_basis"],
  localTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone): string {
  const raw = String(value || "").trim();
  const parsed = new Date(raw);
  if (!raw || Number.isNaN(parsed.getTime())) return "—";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric",
    timeZone: basis === "generation_date" ? "UTC" : localTimeZone }).format(parsed);
}

// The provider cutoff is a real instant. Include local time and zone so it
// cannot be mistaken for the contract's calendar end date.
export function stripeRenewalCutoffDate(value: unknown,
  localTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone): string {
  const raw = String(value || "").trim();
  const parsed = new Date(raw);
  if (!raw || Number.isNaN(parsed.getTime())) return "—";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit", timeZoneName: "short", timeZone: localTimeZone }).format(parsed);
}

export function billingModel(value: unknown): BillingModel {
  return value === "fixed" || value === "rollover" || value === "usage"
    ? value
    : null;
}
export function nonNegativeCount(value: unknown): number | null {
  if (
    value == null ||
    (typeof value !== "number" && typeof value !== "string") ||
    (typeof value === "string" && !value.trim())
  )
    return null;
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= 0 ? number : null;
}
export function moneyCents(value: unknown): string {
  const cents = nonNegativeCount(value);
  return cents === null
    ? "Not configured"
    : new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
      }).format(cents / 100);
}
export function moneyDollars(value: unknown): string {
  if (
    (typeof value !== "number" && typeof value !== "string") ||
    (typeof value === "string" && !value.trim())
  )
    return "Not configured";
  const dollars = Number(value);
  if (!Number.isFinite(dollars) || dollars < 0) return "Not configured";
  return moneyCents(Math.round(dollars * 100));
}
export function hasPricedUsage(value: unknown): boolean {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every(
      (line) =>
        line &&
        typeof line === "object" &&
        nonNegativeCount(line.quantity) !== null &&
        nonNegativeCount(line.unit_price_cents) !== null &&
        nonNegativeCount(line.amount_cents) !== null,
    )
  );
}
export function modelLabel(value: unknown): string {
  const model = billingModel(value);
  return model === "fixed"
    ? "Per-role allowance"
    : model === "rollover"
      ? "Per-role allowance + rollover credits"
      : model === "usage"
        ? "Metered interviews"
        : "Model unavailable";
}
export interface RoleCapacity {
  model: BillingModel;
  own: number | null;
  shared: number | null;
  pool: number | null;
  used: number | null;
}
export function roleCapacity(row: Record<string, unknown>): RoleCapacity {
  return {
    model: billingModel(row.billing_model),
    own: nonNegativeCount(row.own_remaining_interviews),
    shared: nonNegativeCount(row.credit_interviews),
    pool: nonNegativeCount(row.pool_remaining_interviews),
    used: nonNegativeCount(row.used_interviews),
  };
}
export function capacityLabel(capacity: RoleCapacity): string {
  const used =
    capacity.used === null ? "Usage unavailable" : `${capacity.used} used`;
  if (capacity.model === "usage") return `Metered · ${used}`;
  if (!capacity.model || capacity.own === null)
    return `Capacity unavailable · ${used}`;
  return `${capacity.own} role-owned left · ${used}`;
}
// Shared credit/pool is deliberately NOT added once per role.
export function summarizeRoleCapacity(capacities: RoleCapacity[]): {
  value: string;
  detail: string;
} {
  if (!capacities.length) return { value: "—", detail: "no roles in scope" };
  if (
    capacities.some((c) => !c.model || (c.model !== "usage" && c.own === null))
  )
    return { value: "—", detail: "capacity unavailable" };
  const metered = capacities.filter((c) => c.model === "usage").length;
  const own = capacities.reduce(
    (sum, c) => sum + (c.model !== "usage" ? (c.own ?? 0) : 0),
    0,
  );
  if (metered === capacities.length)
    return {
      value: "Metered",
      detail: "usage-based roles; not a remaining quota",
    };
  return {
    value: String(own),
    detail: metered
      ? `role-owned interviews; ${metered} metered roles separate`
      : "role-owned interviews; shared credits separate",
  };
}
export function usageInvoiceStatusLabel(status: unknown): string {
  return status === "reserved" ? "Reserved · not invoiced"
    : status === "paid" ? "Paid" : status === "invoiced_open" ? "Invoiced · awaiting payment"
    : status == null ? "Invoiced" : "Status unavailable"; // Legacy ledger rows keep their description.
}
