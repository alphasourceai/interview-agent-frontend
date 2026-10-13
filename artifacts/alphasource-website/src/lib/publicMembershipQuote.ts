// Display/payload adapters for the existing public purchase-intent workflow.
// Catalogs and saved server summaries are separate: a saved quote is never
// reconstructed from today's catalog, and neither projection authorizes payment.
import { parseMembershipQuoteCatalog, type MembershipQuoteCatalog } from "./membershipQuoteCatalog.ts";
import { membershipSelectionPayload, selectedMembershipOffer, type MembershipOfferSelection } from "./membershipTerms.ts";

function object(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}
function positive(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}
function invalid(): never { throw new Error("Current membership pricing could not be verified. Please refresh or contact support."); }
export function verifiedPublicCatalog(value: unknown): { catalog: MembershipQuoteCatalog | null; packages: Record<string, unknown>[] } {
  const catalog = parseMembershipQuoteCatalog(value, "public");
  if (catalog) return { catalog, packages: [] };
  const body = object(value);
  // Null parser means no v2 markers, NOT permission to backfill legacy prices.
  if (!Array.isArray(body?.packages) || body.packages.length !== 2) return invalid();
  const packages = body.packages.map(item => object(item) ?? invalid());
  if (new Set(packages.map(pkg => pkg.plan_key)).size !== 2) return invalid();
  for (const pkg of packages) {
    if (!["basic", "pro"].includes(String(pkg.plan_key)) || typeof pkg.display_name !== "string" || !pkg.display_name
      || Object.hasOwn(pkg, "commitment_months") || Object.hasOwn(pkg, "pricing_version")
      || ["platform_monthly_fee_cents", "platform_annual_fee_cents", "included_interviews_per_role", "max_interview_minutes"]
        .some(key => !positive(pkg[key]))
      || typeof pkg.per_role_fee !== "number" || !Number.isFinite(pkg.per_role_fee) || pkg.per_role_fee <= 0
      || typeof pkg.additional_interview_fee !== "number" || !Number.isFinite(pkg.additional_interview_fee) || pkg.additional_interview_fee < 0
      || pkg.platform_monthly_fee !== Number(pkg.platform_monthly_fee_cents) / 100
      || pkg.platform_annual_fee !== Number(pkg.platform_annual_fee_cents) / 100
      || !Array.isArray(pkg.billing_cadences) || pkg.billing_cadences.length !== 2
      || new Set(pkg.billing_cadences.map(item => object(item)?.key)).size !== 2
      || pkg.billing_cadences.some(item => !["monthly", "annual"].includes(String(object(item)?.key)))) return invalid();
    const role = object(pkg.first_role_prepay);
    if (!role || role.enabled !== true || !positive(role.normal_role_fee_cents)
      || !positive(role.discounted_credit_amount_cents) || role.discounted_credit_amount_cents >= role.normal_role_fee_cents
      || !positive(role.discount_percent) || role.normal_role_fee_cents !== Math.round(pkg.per_role_fee * 100)) return invalid();
  }
  return { catalog: null, packages };
}
export function publicRetailQuotePayload(identity: Record<string, unknown>, catalog: MembershipQuoteCatalog,
  selection: MembershipOfferSelection | null, planKey: "basic" | "pro") {
  const offer = selectedMembershipOffer(catalog.offers, selection, planKey);
  if (!offer || offer.payment_option !== "prepaid" || offer.offer_version !== catalog.pricing_version) return invalid();
  const fields = ["company_legal_name", "company_dba", "buyer_first_name", "buyer_last_name", "buyer_email", "buyer_phone",
    "buyer_title", "source_path", "agreement_acknowledged", "contact_acknowledged"];
  return { ...Object.fromEntries(fields.map(key => [key, identity[key]])), ...membershipSelectionPayload(offer),
    first_role_prepay_selected: identity.first_role_prepay_selected === true };
}
export interface SavedPublicMembershipTerms {
  commitment_months: 3 | 6 | 12; pricing_version: string; platform_fee_cents: number;
  first_role_selected: boolean; first_role_price_cents: number; per_role_fee_cents: number;
  included_interviews_per_role: number; max_interview_minutes: number; scored_question_count: number;
  additional_interview_fee_cents: number; billing_model: "fixed" | "rollover"; rollover_days: number | null;
}
export function savedPublicMembershipTerms(value: unknown): SavedPublicMembershipTerms | null {
  const summary = object(value);
  if (!summary) return null;
  if (!["commitment_months", "pricing_version", "payment_option"].some(key => Object.hasOwn(summary, key))) return null;
  const role = object(summary.first_role_prepay);
  if (![3, 6, 12].includes(Number(summary.commitment_months)) || typeof summary.commitment_months !== "number"
    || summary.payment_option !== "prepaid" || summary.billing_cadence !== "prepaid"
    || typeof summary.pricing_version !== "string" || !summary.pricing_version
    || !positive(summary.platform_fee_cents) || summary.platform_commitment_total_cents !== summary.platform_fee_cents
    || ["included_interviews_per_role", "max_interview_minutes", "scored_question_count"].some(key => !positive(summary[key]))
    || !["basic", "pro"].includes(String(summary.plan_key)) || typeof summary.display_name !== "string" || !summary.display_name
    || typeof summary.per_role_fee !== "number" || !Number.isSafeInteger(Math.round(summary.per_role_fee * 100)) || summary.per_role_fee <= 0
    || typeof summary.additional_interview_fee !== "number" || !Number.isSafeInteger(Math.round(summary.additional_interview_fee * 100)) || summary.additional_interview_fee < 0
    || !role || typeof role.selected !== "boolean" || !positive(role.normal_role_fee_cents)
    || typeof role.discounted_credit_amount_cents !== "number" || !Number.isSafeInteger(role.discounted_credit_amount_cents)
    || (role.selected ? role.discounted_credit_amount_cents <= 0 : role.discounted_credit_amount_cents !== 0)
    || role.normal_role_fee_cents !== Math.round(summary.per_role_fee * 100)
    || (role.selected && role.discounted_credit_amount_cents >= role.normal_role_fee_cents)
    || !(summary.billing_model === "fixed" && summary.rollover_days === null
      || summary.billing_model === "rollover" && positive(summary.rollover_days))) return invalid();
  return { commitment_months: summary.commitment_months as 3 | 6 | 12, pricing_version: summary.pricing_version,
    platform_fee_cents: summary.platform_fee_cents, first_role_selected: role.selected,
    first_role_price_cents: role.discounted_credit_amount_cents, per_role_fee_cents: Math.round(summary.per_role_fee * 100),
    included_interviews_per_role: summary.included_interviews_per_role as number,
    max_interview_minutes: summary.max_interview_minutes as number, scored_question_count: summary.scored_question_count as number,
    additional_interview_fee_cents: Math.round(summary.additional_interview_fee * 100),
    billing_model: summary.billing_model as "fixed" | "rollover", rollover_days: summary.rollover_days as number | null };
}
