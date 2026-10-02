import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { RefreshCw } from "lucide-react";
import AdminLayout from "@/components/AdminLayout";
import { supabase } from "@/lib/supabaseClient";

type Rep = { user_id: string; email: string; display_name: string; active: boolean };
type Pending = { id: string; company_legal_name: string; selected_plan_key: string; selected_billing_cadence: string; created_by_user_id: string; activated_at: string };
type Receipt = { id: string; purchase_intent_id: string; rep_user_id: string; provider: string; provider_payment_id: string; payment_kind: string; gross_membership_cents: number; discount_cents: number; provider_fee_cents: number; net_membership_cents: number; commission_cents: number; statement_week_start: string; reviewed_at: string; evidence_reference: string };
type Adjustment = { id: string; receipt_id: string; adjustment_type: string; commission_delta_cents: number; statement_week_start: string };
type Payout = { id: string; receipt_id: string; amount_cents: number; ach_reference: string; paid_at: string };
type Overview = {
  representatives: Rep[]; pending_evidence: Pending[]; receipts: Receipt[];
  adjustments: Adjustment[]; payouts: Payout[];
  departures: Array<{ rep_user_id: string; final_day: string }>;
  locked_statements: Array<{ rep_user_id: string; week_start: string; locked_at: string }>;
  truncated: boolean;
  automation: { enabled: boolean; can_enable: boolean; reason: string };
};

const env = typeof import.meta !== "undefined" && import.meta.env ? import.meta.env : {};
const backendBase = String(
  (env as Record<string, unknown>).VITE_BACKEND_URL ||
  (env as Record<string, unknown>).VITE_API_URL ||
  (env as Record<string, unknown>).VITE_PUBLIC_BACKEND_URL ||
  (env as Record<string, unknown>).PUBLIC_BACKEND_URL ||
  (env as Record<string, unknown>).BACKEND_URL || "",
).trim().replace(/\/+$/, "");

function cents(dollars: string): number {
  const value = dollars.trim().replace(/[$,]/g, "");
  if (!/^\d+(?:\.\d{1,2})?$/.test(value)) throw new Error("Enter a nonnegative dollar amount with at most two decimals.");
  const result = Math.round(Number(value) * 100);
  if (!Number.isSafeInteger(result)) throw new Error("Amount is out of range.");
  return result;
}

function money(value: number | null | undefined): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(value || 0) / 100);
}

function iso(value: string): string {
  if (!/(?:Z|[+-]\d{2}:\d{2})$/i.test(value.trim())) throw new Error("Use a timestamp with an explicit timezone, such as 2026-10-02T18:00:00Z.");
  const date = new Date(value);
  if (!value || !Number.isFinite(date.getTime())) throw new Error("Enter a valid date and time.");
  return date.toISOString();
}

function errorMessage(value: unknown): string {
  if (value instanceof Error) return value.message;
  return "Sales Payroll is unavailable.";
}

const inputClass = "w-full rounded-lg border px-3 py-2 text-sm";
const buttonClass = "rounded-lg bg-[#9f75ef] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50";

export default function AdminSalesPayrollPage() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [intentId, setIntentId] = useState("");
  const [provider, setProvider] = useState("stripe");
  const [paymentKind, setPaymentKind] = useState("monthly");
  const [paymentId, setPaymentId] = useState("");
  const [paymentAt, setPaymentAt] = useState("");
  const [fundsAt, setFundsAt] = useState("");
  const [gross, setGross] = useState("");
  const [discount, setDiscount] = useState("0");
  const [fee, setFee] = useState("0");
  const [evidence, setEvidence] = useState("");
  const [adjustmentReceipt, setAdjustmentReceipt] = useState("");
  const [adjustmentType, setAdjustmentType] = useState("refund");
  const [adjustmentEvent, setAdjustmentEvent] = useState("");
  const [adjustmentNet, setAdjustmentNet] = useState("");
  const [adjustmentAt, setAdjustmentAt] = useState("");
  const [adjustmentEvidence, setAdjustmentEvidence] = useState("");
  const [payoutReceipt, setPayoutReceipt] = useState("");
  const [payoutAmount, setPayoutAmount] = useState("");
  const [achReference, setAchReference] = useState("");
  const [paidAt, setPaidAt] = useState("");
  const [payoutEvidence, setPayoutEvidence] = useState("");
  const [departureRep, setDepartureRep] = useState("");
  const [finalDay, setFinalDay] = useState("");
  const [departureEvidence, setDepartureEvidence] = useState("");
  const [statementRep, setStatementRep] = useState("");
  const [statementWeek, setStatementWeek] = useState("");

  const request = useCallback(async (path: string, body?: object) => {
    if (!backendBase) throw new Error("The sales service URL is not configured.");
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error("Please sign in again.");
    const response = await fetch(`${backendBase}/admin/sales-payroll${path}`, {
      method: body ? "POST" : "GET", credentials: "omit", cache: "no-store",
      headers: { Authorization: `Bearer ${session.access_token}`, ...(body ? { "Content-Type": "application/json" } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
    if (!response.ok) throw new Error(String(payload.error || "Sales Payroll request failed.").replace(/_/g, " "));
    return payload;
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try { setOverview(await request("/") as Overview); setError(""); }
    catch (cause) { setError(errorMessage(cause)); }
    finally { setLoading(false); }
  }, [request]);

  useEffect(() => { void load(); }, [load]);

  async function submit(path: string, body: object, success: string) {
    setSaving(true); setError(""); setNotice("");
    try { await request(path, body); setNotice(success); await load(); }
    catch (cause) { setError(errorMessage(cause)); }
    finally { setSaving(false); }
  }

  function recordReceipt(event: FormEvent) {
    event.preventDefault();
    try {
      void submit("/receipts", {
        purchase_intent_id: intentId, provider, provider_payment_id: paymentId, payment_kind: paymentKind,
        payment_success_at: iso(paymentAt), funds_received_at: iso(fundsAt),
        gross_membership_cents: cents(gross), discount_cents: cents(discount), provider_fee_cents: cents(fee),
        evidence_reference: evidence,
      }, "Verified receipt recorded. No payment was sent.");
    } catch (cause) { setError(errorMessage(cause)); }
  }

  function recordAdjustment(event: FormEvent) {
    event.preventDefault();
    try {
      void submit("/adjustments", {
        receipt_id: adjustmentReceipt, adjustment_type: adjustmentType, provider_event_id: adjustmentEvent,
        net_membership_cents: cents(adjustmentNet), effective_at: iso(adjustmentAt), evidence_reference: adjustmentEvidence,
      }, "Linked adjustment recorded. No money moved.");
    } catch (cause) { setError(errorMessage(cause)); }
  }

  function recordPayout(event: FormEvent) {
    event.preventDefault();
    try {
      void submit("/payouts", {
        receipt_id: payoutReceipt, amount_cents: cents(payoutAmount), ach_reference: achReference,
        paid_at: iso(paidAt), evidence_reference: payoutEvidence,
      }, "Existing ACH payout recorded. This action did not initiate payment.");
    } catch (cause) { setError(errorMessage(cause)); }
  }

  function recordDeparture(event: FormEvent) {
    event.preventDefault();
    void submit("/departures", { rep_user_id: departureRep, final_day: finalDay, evidence_reference: departureEvidence },
      "Reviewed final day recorded. Existing locked receipts were not changed.");
  }

  function lockStatement(event: FormEvent) {
    event.preventDefault();
    void submit("/statements/lock", { rep_user_id: statementRep, week_start: statementWeek },
      "Weekly statement locked. Its reviewed lines are immutable.");
  }

  const repNames = useMemo(() => new Map((overview?.representatives || []).map((rep) => [rep.user_id, rep.display_name || rep.email])), [overview]);
  const adjustmentTotals = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of overview?.adjustments || []) map.set(row.receipt_id, (map.get(row.receipt_id) || 0) + row.commission_delta_cents);
    return map;
  }, [overview]);
  const paidTotals = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of overview?.payouts || []) map.set(row.receipt_id, (map.get(row.receipt_id) || 0) + row.amount_cents);
    return map;
  }, [overview]);
  const totalVerified = (overview?.receipts || []).reduce((sum, row) => sum + row.commission_cents, 0) +
    (overview?.adjustments || []).reduce((sum, row) => sum + row.commission_delta_cents, 0);
  const totalPaid = (overview?.payouts || []).reduce((sum, row) => sum + row.amount_cents, 0);

  return <AdminLayout title="Sales Payroll">
    <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6" style={{ color: "var(--as-text)" }}>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div><h1 className="text-2xl font-bold">Sales Payroll</h1>
          <p className="mt-1 text-sm">Manual, admin-reviewed receipts. Annual plans paid monthly earn commission only on each funded net monthly payment, never the full year at activation.</p></div>
        <button type="button" onClick={() => void load()} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"><RefreshCw className="h-4 w-4" />Refresh</button>
      </header>
      {error && <p role="alert" className="rounded-lg border border-red-400/50 p-3 text-sm">{error}</p>}
      {notice && <p role="status" className="rounded-lg border border-green-400/50 p-3 text-sm">{notice}</p>}
      {overview?.truncated && <p role="alert" className="rounded-lg border border-amber-400/50 p-3 text-sm">The ledger exceeds the display limit. Do not use these totals for payroll until the full ledger is exported and reconciled.</p>}
      <section className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border p-4"><p className="text-sm">Pending receipt evidence</p><p className="text-2xl font-bold">{overview?.pending_evidence.length ?? "—"}</p><p className="text-xs">No commission amount is assumed.</p></div>
        <div className="rounded-xl border p-4"><p className="text-sm">Verified commission, net of adjustments</p><p className="text-2xl font-bold">{overview?.truncated ? "Incomplete" : money(totalVerified)}</p></div>
        <div className="rounded-xl border p-4"><p className="text-sm">Recorded ACH payouts</p><p className="text-2xl font-bold">{overview?.truncated ? "Incomplete" : money(totalPaid)}</p><p className="text-xs">Recording does not initiate ACH.</p></div>
      </section>
      <section className="rounded-xl border p-4">
        <h2 className="font-bold">Automation</h2>
        <label className="mt-2 flex items-center gap-3 text-sm"><input type="checkbox" role="switch" checked={false} disabled aria-label="Automated payroll disabled pending separate review" /> Automated payroll: Off</label>
        <p className="mt-1 text-xs">{overview?.automation.reason || "Automation is not available."} The server rejects attempts to turn it on.</p>
      </section>
      <section className="rounded-xl border p-4">
        <h2 className="font-bold">Activated sales awaiting a reviewed receipt</h2>
        {!overview?.pending_evidence.length ? <p className="mt-2 text-sm">None in the current view.</p> : <ul className="mt-3 space-y-2 text-sm">{overview.pending_evidence.map((row) =>
          <li key={row.id} className="flex flex-wrap justify-between gap-2 border-b pb-2"><span>{row.company_legal_name} · {row.selected_plan_key} {row.selected_billing_cadence} · {repNames.get(row.created_by_user_id) || "Attribution needs review"}</span><button type="button" className="underline" onClick={() => setIntentId(row.id)}>Review receipt</button></li>)}</ul>}
      </section>
      <form onSubmit={recordReceipt} className="grid gap-3 rounded-xl border p-4 sm:grid-cols-2">
        <h2 className="font-bold sm:col-span-2">Approve a verified provider receipt</h2>
        <p className="text-xs sm:col-span-2">Check the provider payment, funding, discounts, allocated fees, signed sale, and account activation before approving. Only platform membership fees belong here.</p>
        <label className="text-sm">Activated sale ID<input required value={intentId} onChange={(e) => setIntentId(e.target.value)} className={inputClass} /></label>
        <label className="text-sm">Provider<select value={provider} onChange={(e) => setProvider(e.target.value)} className={inputClass}><option value="stripe">Stripe</option><option value="financing_partner">Financing partner</option><option value="other_verified">Other verified</option></select></label>
        <label className="text-sm">Provider payment ID<input required value={paymentId} onChange={(e) => setPaymentId(e.target.value)} className={inputClass} /></label>
        <label className="text-sm">Payment type<select value={paymentKind} onChange={(e) => setPaymentKind(e.target.value)} className={inputClass}><option value="monthly">Annual term paid monthly</option><option value="paid_in_full">Annual paid in full</option><option value="financed_checkout">Financed checkout</option></select></label>
        <label className="text-sm">Payment succeeded (timestamp with timezone)<input required value={paymentAt} onChange={(e) => setPaymentAt(e.target.value)} className={inputClass} placeholder="2026-10-02T18:00:00Z" /></label>
        <label className="text-sm">Funds received (timestamp with timezone)<input required value={fundsAt} onChange={(e) => setFundsAt(e.target.value)} className={inputClass} placeholder="2026-10-05T18:00:00Z" /></label>
        <label className="text-sm">Gross platform membership ($)<input required value={gross} onChange={(e) => setGross(e.target.value)} className={inputClass} /></label>
        <label className="text-sm">Approved discount ($)<input required value={discount} onChange={(e) => setDiscount(e.target.value)} className={inputClass} /></label>
        <label className="text-sm">Allocated provider fee ($)<input required value={fee} onChange={(e) => setFee(e.target.value)} className={inputClass} /></label>
        <label className="text-sm">Evidence reference<input required value={evidence} onChange={(e) => setEvidence(e.target.value)} className={inputClass} placeholder="Provider receipt or internal review ID" /></label>
        <div className="sm:col-span-2"><button type="submit" disabled={saving} className={buttonClass}>Approve receipt</button></div>
      </form>
      <section className="overflow-x-auto rounded-xl border p-4">
        <h2 className="font-bold">Reviewed receipt ledger</h2>
        {!overview?.receipts.length ? <p className="mt-2 text-sm">No receipts reviewed yet. Activated deals remain pending evidence, not $0 commission.</p> :
          <table className="mt-3 w-full min-w-[850px] text-left text-sm"><thead><tr><th>Rep / source</th><th>Payment</th><th>Net membership</th><th>Commission</th><th>Adjustment</th><th>ACH paid</th><th>Remaining</th><th>Week</th></tr></thead><tbody>{overview.receipts.map((row) => {
            const adjusted = adjustmentTotals.get(row.id) || 0; const paid = paidTotals.get(row.id) || 0;
            return <tr key={row.id} className="border-t"><td className="py-2">{repNames.get(row.rep_user_id) || row.rep_user_id}<br/><small>{row.id}</small></td><td>{row.provider} · {row.payment_kind}<br/><small>{row.provider_payment_id}</small></td><td>{money(row.net_membership_cents)}</td><td>{money(row.commission_cents)}</td><td>{money(adjusted)}</td><td>{money(paid)}</td><td>{money(row.commission_cents + adjusted - paid)}</td><td>{row.statement_week_start}</td></tr>;
          })}</tbody></table>}
      </section>
      <div className="grid gap-4 lg:grid-cols-2">
        <form onSubmit={recordAdjustment} className="grid gap-3 rounded-xl border p-4">
          <h2 className="font-bold">Record a linked refund, chargeback, or recovery</h2>
          <label className="text-sm">Original receipt<select required value={adjustmentReceipt} onChange={(e) => setAdjustmentReceipt(e.target.value)} className={inputClass}><option value="">Select receipt</option>{overview?.receipts.map((r) => <option key={r.id} value={r.id}>{repNames.get(r.rep_user_id)} · {r.provider_payment_id}</option>)}</select></label>
          <label className="text-sm">Type<select value={adjustmentType} onChange={(e) => setAdjustmentType(e.target.value)} className={inputClass}><option value="refund">Refund</option><option value="chargeback">Chargeback</option><option value="recovery">Recovery</option></select></label>
          <label className="text-sm">Provider event ID<input required value={adjustmentEvent} onChange={(e) => setAdjustmentEvent(e.target.value)} className={inputClass} /></label>
          <label className="text-sm">Net membership affected ($)<input required value={adjustmentNet} onChange={(e) => setAdjustmentNet(e.target.value)} className={inputClass} /></label>
          <label className="text-sm">Effective time (timestamp with timezone)<input required value={adjustmentAt} onChange={(e) => setAdjustmentAt(e.target.value)} className={inputClass} placeholder="2026-10-02T18:00:00Z" /></label>
          <label className="text-sm">Evidence reference<input required value={adjustmentEvidence} onChange={(e) => setAdjustmentEvidence(e.target.value)} className={inputClass} /></label>
          <button type="submit" disabled={saving} className={buttonClass}>Record reviewed adjustment</button>
        </form>
        <form onSubmit={recordPayout} className="grid gap-3 rounded-xl border p-4">
          <h2 className="font-bold">Record an ACH already sent</h2><p className="text-xs">This never sends money. Do not record a planned transfer as paid.</p>
          <label className="text-sm">Source receipt<select required value={payoutReceipt} onChange={(e) => setPayoutReceipt(e.target.value)} className={inputClass}><option value="">Select receipt</option>{overview?.receipts.map((r) => <option key={r.id} value={r.id}>{repNames.get(r.rep_user_id)} · {r.provider_payment_id}</option>)}</select></label>
          <label className="text-sm">Amount actually paid ($)<input required value={payoutAmount} onChange={(e) => setPayoutAmount(e.target.value)} className={inputClass} /></label>
          <label className="text-sm">ACH confirmation reference<input required value={achReference} onChange={(e) => setAchReference(e.target.value)} className={inputClass} /></label>
          <label className="text-sm">Paid at (timestamp with timezone)<input required value={paidAt} onChange={(e) => setPaidAt(e.target.value)} className={inputClass} placeholder="2026-10-02T18:00:00Z" /></label>
          <label className="text-sm">Evidence reference<input required value={payoutEvidence} onChange={(e) => setPayoutEvidence(e.target.value)} className={inputClass} /></label>
          <button type="submit" disabled={saving} className={buttonClass}>Record existing payout</button>
        </form>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <form onSubmit={recordDeparture} className="grid gap-3 rounded-xl border p-4">
          <h2 className="font-bold">Record a representative’s final day</h2>
          <p className="text-xs">Review the actual final workday and evidence before saving. This entry cannot be edited; payment and close must both meet the 30-day Mountain Time cutoff.</p>
          <label className="text-sm">Representative<select required value={departureRep} onChange={(e) => setDepartureRep(e.target.value)} className={inputClass}><option value="">Select representative</option>{overview?.representatives.map((r) => <option key={r.user_id} value={r.user_id}>{r.display_name || r.email}</option>)}</select></label>
          <label className="text-sm">Final workday<input required type="date" value={finalDay} onChange={(e) => setFinalDay(e.target.value)} className={inputClass} /></label>
          <label className="text-sm">Evidence reference<input required value={departureEvidence} onChange={(e) => setDepartureEvidence(e.target.value)} className={inputClass} /></label>
          <button type="submit" disabled={saving} className={buttonClass}>Record reviewed final day</button>
          {!!overview?.departures.length && <p className="text-xs">Recorded: {overview.departures.map((d) => `${repNames.get(d.rep_user_id) || d.rep_user_id}: ${d.final_day}`).join(" · ")}</p>}
        </form>
        <form onSubmit={lockStatement} className="grid gap-3 rounded-xl border p-4">
          <h2 className="font-bold">Lock a weekly statement</h2>
          <p className="text-xs">Lock only after the Monday–Sunday Mountain Time week closes and you have reconciled receipts and adjustments. The snapshot cannot be revised.</p>
          <label className="text-sm">Representative<select required value={statementRep} onChange={(e) => setStatementRep(e.target.value)} className={inputClass}><option value="">Select representative</option>{overview?.representatives.map((r) => <option key={r.user_id} value={r.user_id}>{r.display_name || r.email}</option>)}</select></label>
          <label className="text-sm">Monday week start<input required type="date" value={statementWeek} onChange={(e) => setStatementWeek(e.target.value)} className={inputClass} /></label>
          <button type="submit" disabled={saving} className={buttonClass}>Lock reviewed statement</button>
          {!!overview?.locked_statements.length && <p className="text-xs">Locked: {overview.locked_statements.map((s) => `${repNames.get(s.rep_user_id) || s.rep_user_id}: ${s.week_start}`).join(" · ")}</p>}
        </form>
      </div>
      <p className="text-xs">No automatic receipt ingestion, refund execution, reconciliation, or ACH runs in this release. Automation remains off and cannot be enabled until a separate worker and review are complete.</p>
    </main>
  </AdminLayout>;
}
