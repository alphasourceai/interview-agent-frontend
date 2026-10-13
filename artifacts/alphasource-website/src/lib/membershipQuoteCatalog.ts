// Server catalog projection for the EXISTING pricing/signup and staff forms.
// Missing new catalog is legacy. A present bad catalog must never fall back to
// old prices. No prices are duplicated here and no provider inputs are emitted.
import { parseMembershipOffers, selectedMembershipOffer, membershipSelectionPayload, type MembershipOfferSelection,
  type MembershipAudience, type RetailMembershipOffer } from "./membershipTerms.ts";

export interface RetailPlanDisplay {
  plan_key: "basic" | "pro";
  display_name: string;
  per_role_fee_cents: number;
  additional_interview_fee_cents: number;
  included_interviews_per_role: number;
  max_interview_minutes: number;
  scored_question_count: number;
  billing_model: "fixed" | "rollover";
  rollover_days: number | null;
  first_role_prepay_price_cents: number;
}
export interface MembershipQuoteCatalog {
  pricing_version: string;
  offers: RetailMembershipOffer[];
  plans: Record<"basic" | "pro", RetailPlanDisplay>;
}
function object(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}
function positive(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}
function invalid(): never { throw new Error("Membership options could not be verified. Please refresh or contact support."); }
export function parseMembershipQuoteCatalog(value: unknown, audience: MembershipAudience): MembershipQuoteCatalog | null {
  const payload = object(value);
  if (!payload) return invalid();
  const markedItems = Array.isArray(payload.items) && payload.items.some(item => object(item)?.schema_version === 2);
  if (!Object.hasOwn(payload,"offers") && !Object.hasOwn(payload,"pricing_version")
    && !Object.hasOwn(payload,"first_role_prepay_prices") && !markedItems) return null;
  if (typeof payload.pricing_version !== "string" || !payload.pricing_version || !Array.isArray(payload.offers)) return invalid();
  const raw = payload.offers.map(item => object(item) ?? invalid());
  const offers = parseMembershipOffers(payload.offers, audience);
  if (raw.length !== (audience === "public" ? 6 : 12) || offers.length !== raw.length
    || offers.some(offer => offer.offer_version !== payload.pricing_version)) return invalid();
  const rolePrices = object(payload.first_role_prepay_prices);
  if (!rolePrices) return invalid();
  const plans = {} as Record<"basic" | "pro", RetailPlanDisplay>;
  for (const plan of ["basic","pro"] as const) {
    const selected = raw.filter(offer => offer.plan_key === plan);
    if (selected.length !== (audience === "public" ? 3 : 6)) return invalid();
    const meta = selected[0];
    for (const key of ["per_role_fee_cents","included_interviews_per_role","max_interview_minutes","scored_question_count"])
      if (!positive(meta[key])) return invalid();
    if ((meta.max_interview_minutes as number) >= 60 || (meta.scored_question_count as number) > 7
      || (meta.billing_model === "rollover" && (meta.rollover_days as number) > 3650)) return invalid();
    if (typeof meta.additional_interview_fee_cents !== "number" || !Number.isSafeInteger(meta.additional_interview_fee_cents)
      || meta.additional_interview_fee_cents < 0 || !positive(rolePrices[plan])
      || rolePrices[plan] >= (meta.per_role_fee_cents as number)
      || !(meta.billing_model === "fixed" && meta.rollover_days === null
        || meta.billing_model === "rollover" && positive(meta.rollover_days))) return invalid();
    const projection: RetailPlanDisplay = { plan_key: plan, display_name: meta.display_name as string,
      per_role_fee_cents: meta.per_role_fee_cents as number, additional_interview_fee_cents: meta.additional_interview_fee_cents,
      included_interviews_per_role: meta.included_interviews_per_role as number, max_interview_minutes: meta.max_interview_minutes as number,
      scored_question_count: meta.scored_question_count as number, billing_model: meta.billing_model as RetailPlanDisplay["billing_model"],
      rollover_days: meta.rollover_days as number | null, first_role_prepay_price_cents: rolePrices[plan] as number };
    for (const offer of selected) {
      if (offer.offer_key !== `${plan}-${offer.commitment_months}-${offer.payment_option}`
        || (object(offer.first_role_prepay)?.selected !== false)
        || Object.entries(projection).some(([key,expected]) => key !== "first_role_prepay_price_cents" && offer[key] !== expected)) return invalid();
    }
    plans[plan] = projection;
  }
  return { pricing_version: payload.pricing_version, offers, plans };
}
export function membershipInitialAmount(offer: RetailMembershipOffer, plan: RetailPlanDisplay, firstRoleSelected: boolean): number {
  if (offer.plan_key !== plan.plan_key || offer.first_role_prepay.selected) return invalid();
  const amount = offer.platform_payment_cents + (firstRoleSelected ? plan.first_role_prepay_price_cents : 0);
  if (!positive(amount)) return invalid();
  return amount;
}

export function adminRetailQuotePayload(identity: Record<string, unknown>, catalog: MembershipQuoteCatalog,
  selection: MembershipOfferSelection | null, planKey: "basic" | "pro", firstRoleSelected: boolean) {
  const offer = selectedMembershipOffer(catalog.offers, selection, planKey);
  if (!offer || offer.offer_version !== catalog.pricing_version) return invalid();
  const fields = ["client_mode", "attached_client_id", "client_id", "confirm_replace_existing", "client_legal_name",
    "dba_trade_name", "primary_admin_name", "admin_email", "candidate_assistance_contact"];
  return { ...Object.fromEntries(fields.map(key => [key, identity[key]])), ...membershipSelectionPayload(offer),
    membership_tier: planKey, first_role_prepay_selected: firstRoleSelected === true };
}
