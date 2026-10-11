import { useId } from "react";
import { membershipMoney, membershipObligationCopy, selectedMembershipOffer,
  type MembershipAudience, type MembershipOfferSelection, type MembershipPaymentOption,
  type RetailMembershipOffer } from "@/lib/membershipTerms";

// Prepared shared selector, not mounted in checkout yet. The parent must supply
// validated server offers and control both the offer key and accepted version.
export function MembershipTermsSelector({ offers, planKey, audience, selection, onChange, disabled = false }: {
  offers: RetailMembershipOffer[]; planKey: RetailMembershipOffer["plan_key"]; audience: MembershipAudience;
  selection: MembershipOfferSelection | null; onChange: (selection: MembershipOfferSelection) => void; disabled?: boolean;
}) {
  const labelId = useId();
  const available = offers.filter(offer => offer.plan_key === planKey
    && (audience !== "public" || offer.payment_option === "prepaid"));
  const selected = selectedMembershipOffer(available, selection, planKey);
  const paymentOption = selected?.payment_option ?? "prepaid";
  const months = selected?.commitment_months ?? 3;
  function choose(nextMonths: number, option: MembershipPaymentOption) {
    const offer = available.find(item => item.commitment_months === nextMonths && item.payment_option === option);
    if (offer && !disabled) onChange({ offerKey: offer.offer_key, offerVersion: offer.offer_version });
  }
  return (
    <section className="space-y-5" aria-labelledby={labelId}>
      <div>
        <h3 id={labelId} className="text-base font-black" style={{ color: "var(--as-text)" }}>Membership term</h3>
        <p className="mt-1 text-sm" style={{ color: "var(--as-text-muted)" }}>Choose your commitment. Your term starts when your first payment succeeds.</p>
      </div>
      {audience !== "public" ? (
        <fieldset disabled={disabled} className="flex flex-wrap gap-2">
          <legend className="mb-2 text-xs font-bold" style={{ color: "var(--as-text-muted)" }}>Payment schedule</legend>
          {(["prepaid", "monthly_installments"] as const).map(option => {
            const offer = available.find(item => item.commitment_months === months && item.payment_option === option);
            return <button key={option} type="button" aria-pressed={selected ? paymentOption === option : false}
              disabled={!offer || disabled} onClick={() => choose(months, option)}
              className={`rounded-[10px] border px-4 py-2.5 text-sm font-bold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#A380F6] disabled:opacity-45 ${selected && paymentOption === option ? "border-[#A380F6] bg-[#A380F6]/10" : "border-[#0A1547]/10 bg-transparent"}`}
              style={{ color: "var(--as-text)" }}>{option === "prepaid" ? "Pay upfront" : "Pay monthly"}</button>;
          })}
        </fieldset>
      ) : null}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3" role="group" aria-label="Commitment length">
        {([3, 6, 12] as const).map(commitmentMonths => {
          const offer = available.find(item => item.commitment_months === commitmentMonths && item.payment_option === paymentOption);
          const active = Boolean(selected && selected.offer_key === offer?.offer_key);
          return <button key={commitmentMonths} type="button" aria-pressed={active} disabled={disabled || !offer}
            onClick={() => choose(commitmentMonths, paymentOption)}
            className={`min-w-0 rounded-[14px] border p-4 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#A380F6] disabled:opacity-45 ${active ? "border-[#A380F6] bg-[#A380F6]/10" : "border-[#0A1547]/10 bg-transparent"}`}>
            <span className="block text-sm font-black" style={{ color: "var(--as-text)" }}>{commitmentMonths} months</span>
            <span className="mt-3 block text-xl font-black" style={{ color: "var(--as-text)" }}>{offer ? membershipMoney(offer.platform_payment_cents) : "Unavailable"}</span>
            <span className="mt-1 block text-xs font-semibold" style={{ color: "var(--as-text-muted)" }}>{paymentOption === "prepaid" ? "platform membership, paid upfront" : "per month, platform membership"}</span>
            {offer && paymentOption === "monthly_installments" ? <span className="mt-2 block text-xs" style={{ color: "var(--as-text-muted)" }}>{membershipMoney(offer.platform_commitment_total_cents)} over {commitmentMonths} months</span> : null}
          </button>;
        })}
      </div>
      {selected ? (
        <div className="rounded-[14px] border border-[#0A1547]/10 p-4" aria-live="polite">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="text-sm font-bold" style={{ color: "var(--as-text)" }}>Initial payment, before tax</span>
            <span className="text-xl font-black" style={{ color: "var(--as-text)" }}>{membershipMoney(selected.initial_payment_cents)}</span>
          </div>
          {selected.first_role_prepay.selected ? <p className="mt-2 text-xs" style={{ color: "var(--as-text-muted)" }}>Includes {membershipMoney(selected.first_role_prepay.amount_cents)} of one-time first-role prepayment. It does not renew.</p> : null}
          <p className="mt-3 text-sm leading-relaxed" style={{ color: "var(--as-text-muted)" }}>{membershipObligationCopy(selected)}</p>
          <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--as-text-muted)" }}>Auto-renew is on by default: the same {selected.commitment_months}-month term at your accepted platform price. You may turn it off any time before the term ends.</p>
          <p className="mt-2 text-xs" style={{ color: "var(--as-text-muted)" }}>Role and additional-interview charges are separate.</p>
        </div>
      ) : <p role="status" className="text-sm" style={{ color: "var(--as-text-muted)" }}>Choose a current offer to continue. A previous selection will not be silently repriced.</p>}
    </section>
  );
}
