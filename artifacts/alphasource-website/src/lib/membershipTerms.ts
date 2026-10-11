// Display-only prospective v2 contract. Prices come from the server; this module
// never builds a price catalog, Stripe request or legacy monthly/annual payload.
export type MembershipAudience = "public" | "sales" | "admin";
export type MembershipPaymentOption = "prepaid" | "monthly_installments";
export interface RetailMembershipOffer {
  schema_version: 2;
  offer_version: string;
  offer_key: string;
  plan_key: "basic" | "pro";
  display_name: string;
  currency: "usd";
  commitment_months: 3 | 6 | 12;
  payment_option: MembershipPaymentOption;
  platform_payment_cents: number;
  platform_commitment_total_cents: number;
  installment_count: number;
  initial_payment_cents: number;
  term_start_basis: "first_payment_success";
  contract_timezone: "UTC";
  first_role_prepay: { selected: boolean; amount_cents: number };
  renewal: { default_auto_renew: true; retain_accepted_pricing: true; commitment_months: number;
    non_renewal_cutoff: "before_term_end"; ends_installments_early: false };
}
export interface MembershipOfferSelection { offerVersion: string; offerKey: string }
const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
export function membershipMoney(cents: number): string {
  if (!Number.isSafeInteger(cents) || cents < 0) throw new Error("Invalid membership amount.");
  const exact = BigInt(cents);
  return `${money.format(Number(exact / 100n))}.${String(exact % 100n).padStart(2, "0")}`;
}
function amount(value: unknown, positive = false): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= (positive ? 1 : 0);
}
function object(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}
export function parseMembershipOffers(value: unknown, audience: MembershipAudience): RetailMembershipOffer[] {
  if (!["public", "sales", "admin"].includes(audience) || !Array.isArray(value) || value.length > 12) {
    throw new Error("Membership options could not be verified.");
  }
  const seen = new Set<string>();
  const seenTerms = new Set<string>();
  let version: string | null = null;
  const offers = value.map((item): RetailMembershipOffer => {
    const offer = object(item), role = object(offer?.first_role_prepay), renewal = object(offer?.renewal);
    if (!offer || !role || !renewal || offer.schema_version !== 2 || offer.currency !== "usd"
      || typeof offer.offer_version !== "string" || !offer.offer_version || offer.offer_version.length > 100
      || typeof offer.offer_key !== "string" || !offer.offer_key || offer.offer_key.length > 100
      || typeof offer.display_name !== "string" || !offer.display_name || offer.display_name.length > 100
      || (offer.plan_key !== "basic" && offer.plan_key !== "pro") || ![3, 6, 12].includes(Number(offer.commitment_months))
      || typeof offer.commitment_months !== "number"
      || (offer.payment_option !== "prepaid" && offer.payment_option !== "monthly_installments")
      || offer.term_start_basis !== "first_payment_success" || offer.contract_timezone !== "UTC"
      || !amount(offer.platform_payment_cents, true) || !amount(offer.platform_commitment_total_cents, true)
      || !amount(offer.initial_payment_cents, true) || !amount(role.amount_cents) || typeof role.selected !== "boolean"
      || (role.selected ? role.amount_cents <= 0 : role.amount_cents !== 0)
      || offer.initial_payment_cents !== offer.platform_payment_cents + role.amount_cents
      || renewal.default_auto_renew !== true || renewal.retain_accepted_pricing !== true
      || renewal.commitment_months !== offer.commitment_months || renewal.non_renewal_cutoff !== "before_term_end"
      || renewal.ends_installments_early !== false) throw new Error("Membership options could not be verified.");
    const count = offer.payment_option === "prepaid" ? 1 : offer.commitment_months;
    const termKey = `${offer.plan_key}/${offer.commitment_months}/${offer.payment_option}`;
    if (offer.installment_count !== count || offer.platform_commitment_total_cents !== offer.platform_payment_cents * count
      || seen.has(offer.offer_key) || seenTerms.has(termKey) || (version !== null && version !== offer.offer_version)) {
      throw new Error("Membership options could not be verified.");
    }
    seen.add(offer.offer_key);
    seenTerms.add(termKey);
    version = offer.offer_version;
    // Copy only the display projection. Unknown server fields cannot become
    // browser-authoritative financial or Stripe checkout inputs.
    return { schema_version: 2, offer_version: offer.offer_version, offer_key: offer.offer_key,
      plan_key: offer.plan_key as RetailMembershipOffer["plan_key"], display_name: offer.display_name, currency: "usd",
      commitment_months: offer.commitment_months as RetailMembershipOffer["commitment_months"],
      payment_option: offer.payment_option as MembershipPaymentOption, platform_payment_cents: offer.platform_payment_cents,
      platform_commitment_total_cents: offer.platform_commitment_total_cents, installment_count: count,
      initial_payment_cents: offer.initial_payment_cents, term_start_basis: "first_payment_success", contract_timezone: "UTC",
      first_role_prepay: { selected: role.selected, amount_cents: role.amount_cents },
      renewal: { default_auto_renew: true, retain_accepted_pricing: true, commitment_months: offer.commitment_months,
        non_renewal_cutoff: "before_term_end", ends_installments_early: false } };
  });
  return audience === "public" ? offers.filter(offer => offer.payment_option === "prepaid") : offers;
}
export function selectedMembershipOffer(offers: RetailMembershipOffer[], selection: MembershipOfferSelection | null,
  planKey: RetailMembershipOffer["plan_key"]): RetailMembershipOffer | null {
  return offers.find(offer => offer.plan_key === planKey && offer.offer_key === selection?.offerKey
    && offer.offer_version === selection.offerVersion) ?? null;
}
// Keys only. The server must price/revalidate the accepted offer/version. Never
// translate a3/6month commitment into the legacy billing_cadence="annual".
export function membershipSelectionPayload(offer: RetailMembershipOffer) {
  return { offer_version: offer.offer_version, plan_key: offer.plan_key,
    commitment_months: offer.commitment_months, payment_option: offer.payment_option };
}
export function membershipObligationCopy(offer: RetailMembershipOffer): string {
  return offer.payment_option === "prepaid"
    ? "Your membership stays active for the full prepaid term. Turning off renewal does not create a refund; exceptions follow the refund policy."
    : `All ${offer.commitment_months} monthly payments remain due for this term. Turning off renewal does not cancel remaining payments; access continues while payments are made.`;
}
