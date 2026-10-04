import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { RefreshCw } from "lucide-react";
import AdminLayout from "@/components/AdminLayout";
import AdminSalesPaymentsTab from "./AdminSalesPaymentsTab";
import AdminSalesPayrollSummary from "./AdminSalesPayrollSummary";
import { supabase } from "@/lib/supabaseClient";

type Rep = { user_id: string; email: string; display_name: string; active: boolean };
type ReviewCandidate = { id: string; company_legal_name: string; selected_plan_key: string; selected_billing_cadence: string; created_by_user_id: string; activated_at: string; reviewed_receipt_count: number };
type Receipt = { id: string; purchase_intent_id: string; rep_user_id: string; provider: string; provider_payment_id: string; payment_kind: string; gross_membership_cents: number; discount_cents: number; provider_fee_cents: number; net_membership_cents: number; commission_cents: number; statement_week_start: string; reviewed_at: string; evidence_reference: string };
type Adjustment = { id: string; receipt_id: string; adjustment_type: string; commission_delta_cents: number; statement_week_start: string };
type Payout = { id: string; receipt_id: string; amount_cents: number; ach_reference: string; paid_at: string };
type Overview = {
  representatives: Rep[]; pending_evidence: ReviewCandidate[]; review_candidates: ReviewCandidate[]; receipts: Receipt[];
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

const inputClass = "w-full rounded-lg border border-[var(--as-border)] bg-[var(--as-surface)] px-3 py-2 text-sm text-[var(--as-text)]";
const buttonClass = "rounded-lg bg-[#A380F6] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50";

export default function AdminSalesPayrollPage() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [activeTab, setActiveTab] = useState<"summary" | "actions">("summary");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
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

  useEffect(() => { if (activeTab === "actions") void load(); }, [activeTab, load]);

  async function submit(path: string, body: object, success: string) {
    setSaving(true); setError(""); setNotice("");
    try { await request(path, body); setNotice(success); await load(); setRefreshKey((value) => value + 1); }
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

  return <AdminLayout title="Sales Payroll">
    <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6" style={{ color: "var(--as-text)" }}>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div><p className="text-xs font-bold uppercase tracking-[0.16em]" style={{ color: "#A380F6" }}>Sales team</p><h1 className="mt-1 text-2xl font-bold">Sales Payroll</h1>
          <p className="mt-1 text-sm" style={{ color: "var(--as-text-muted)" }}>Sales and earned commission by payment date. Annual terms paid monthly earn commission on each funded monthly payment, not the full year at activation.</p></div>
        {activeTab === "actions" && <button type="button" onClick={() => void load()} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm" style={{ borderColor: "var(--as-border)" }}><RefreshCw className="h-4 w-4" />Refresh actions</button>}
      </header>
      <nav aria-label="Sales Payroll sections" className="flex gap-2 border-b pb-2" style={{ borderColor: "var(--as-border)" }}>
        <button type="button" onClick={() => setActiveTab("summary")} aria-current={activeTab === "summary" ? "page" : undefined} className={activeTab === "summary" ? "rounded-lg bg-[#A380F6] px-4 py-2 text-sm font-semibold text-white" : "rounded-lg border px-4 py-2 text-sm"} style={activeTab === "summary" ? undefined : { borderColor: "var(--as-border)" }}>Sales overview</button>
        <button type="button" onClick={() => setActiveTab("actions")} aria-current={activeTab === "actions" ? "page" : undefined} className={activeTab === "actions" ? "rounded-lg bg-[#A380F6] px-4 py-2 text-sm font-semibold text-white" : "rounded-lg border px-4 py-2 text-sm"} style={activeTab === "actions" ? undefined : { borderColor: "var(--as-border)" }}>Actions</button>
      </nav>
      {activeTab === "summary" ? <AdminSalesPayrollSummary request={request} backendBase={backendBase} refreshKey={refreshKey} /> : <>
      {error && <p role="alert" className="rounded-lg border border-red-400/50 p-3 text-sm">{error}</p>}
      {notice && <p role="status" className="rounded-lg border border-green-400/50 p-3 text-sm">{notice}</p>}
      {loading && <p role="status" className="rounded-2xl border p-4 text-sm" style={{ backgroundColor: "var(--as-surface)", borderColor: "var(--as-border)" }}>Loading reviewed payroll actions…</p>}
      {overview?.truncated && <p role="alert" className="rounded-lg border border-amber-400/50 p-3 text-sm">The advanced receipt list exceeds its 500-row display limit. The date-filtered Sales overview and export remain complete; use a verified original receipt ID for older adjustments. Receipt approval and statement locking are paused until the full ledger is reconciled.</p>}
      <div><h2 className="text-lg font-bold">Payroll actions</h2><p className="text-sm" style={{ color: "var(--as-text-muted)" }}>Record reviewed adjustments, final days, and weekly statement locks. These controls do not initiate payments.</p></div>
      <div className="grid gap-4">
        <form onSubmit={recordAdjustment} className="grid gap-3 rounded-2xl border p-5 sm:grid-cols-2" style={{ backgroundColor: "var(--as-surface)", borderColor: "var(--as-border)" }}>
          <h2 className="font-bold sm:col-span-2">Add an adjustment to a sale</h2><p className="text-xs sm:col-span-2">Refunds, chargebacks, and recoveries use their effective date and remain linked to the original client sale.</p>
          <label className="text-sm">Original sale receipt ID<input required list="payroll-adjustment-receipts" value={adjustmentReceipt} onChange={(e) => setAdjustmentReceipt(e.target.value)} placeholder="Select or paste a receipt ID" className={inputClass} /><datalist id="payroll-adjustment-receipts">{overview?.receipts.map((r) => <option key={r.id} value={r.id} label={`${repNames.get(r.rep_user_id) || r.rep_user_id} · ${r.provider_payment_id}`} />)}</datalist></label>
          <label className="text-sm">Type<select value={adjustmentType} onChange={(e) => setAdjustmentType(e.target.value)} className={inputClass}><option value="refund">Refund</option><option value="chargeback">Chargeback</option><option value="recovery">Recovery</option></select></label>
          <label className="text-sm">Provider event ID<input required value={adjustmentEvent} onChange={(e) => setAdjustmentEvent(e.target.value)} className={inputClass} /></label>
          <label className="text-sm">Net membership affected ($)<input required value={adjustmentNet} onChange={(e) => setAdjustmentNet(e.target.value)} className={inputClass} /></label>
          <label className="text-sm">Effective time (timestamp with timezone)<input required value={adjustmentAt} onChange={(e) => setAdjustmentAt(e.target.value)} className={inputClass} placeholder="2026-10-02T18:00:00Z" /></label>
          <label className="text-sm">Evidence reference<input required value={adjustmentEvidence} onChange={(e) => setAdjustmentEvidence(e.target.value)} className={inputClass} /></label>
          <button type="submit" disabled={saving} className={buttonClass}>Record reviewed adjustment</button>
        </form>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <form onSubmit={recordDeparture} className="grid gap-3 rounded-2xl border p-5" style={{ backgroundColor: "var(--as-surface)", borderColor: "var(--as-border)" }}>
          <h2 className="font-bold">Record a representative’s final day</h2>
          <p className="text-xs">Review the actual final workday and evidence before saving. This entry cannot be edited; payment and close must both meet the 30-day Mountain Time cutoff.</p>
          <label className="text-sm">Representative<select required value={departureRep} onChange={(e) => setDepartureRep(e.target.value)} className={inputClass}><option value="">Select representative</option>{overview?.representatives.map((r) => <option key={r.user_id} value={r.user_id}>{r.display_name || r.email}</option>)}</select></label>
          <label className="text-sm">Final workday<input required type="date" value={finalDay} onChange={(e) => setFinalDay(e.target.value)} className={inputClass} /></label>
          <label className="text-sm">Evidence reference<input required value={departureEvidence} onChange={(e) => setDepartureEvidence(e.target.value)} className={inputClass} /></label>
          <button type="submit" disabled={saving} className={buttonClass}>Record reviewed final day</button>
          {!!overview?.departures.length && <p className="text-xs">Recorded: {overview.departures.map((d) => `${repNames.get(d.rep_user_id) || d.rep_user_id}: ${d.final_day}`).join(" · ")}</p>}
        </form>
        <form onSubmit={lockStatement} className="grid gap-3 rounded-2xl border p-5" style={{ backgroundColor: "var(--as-surface)", borderColor: "var(--as-border)" }}>
          <h2 className="font-bold">Lock a weekly statement</h2>
          <p className="text-xs">Lock only after the Monday–Sunday Mountain Time week closes and you have reconciled receipts and adjustments. The snapshot cannot be revised.</p>
          <label className="text-sm">Representative<select required value={statementRep} onChange={(e) => setStatementRep(e.target.value)} className={inputClass}><option value="">Select representative</option>{overview?.representatives.map((r) => <option key={r.user_id} value={r.user_id}>{r.display_name || r.email}</option>)}</select></label>
          <label className="text-sm">Monday week start<input required type="date" value={statementWeek} onChange={(e) => setStatementWeek(e.target.value)} className={inputClass} /></label>
          <button type="submit" disabled={saving || overview?.truncated} className={buttonClass}>Lock reviewed statement</button>
          {!!overview?.locked_statements.length && <p className="text-xs">Locked: {overview.locked_statements.map((s) => `${repNames.get(s.rep_user_id) || s.rep_user_id}: ${s.week_start}`).join(" · ")}</p>}
        </form>
      </div>
      <details open={advancedOpen} onToggle={(event) => setAdvancedOpen(event.currentTarget.open)} className="rounded-2xl border p-5" style={{ backgroundColor: "var(--as-surface)", borderColor: "var(--as-border)" }}>
        <summary className="cursor-pointer text-base font-bold">Advanced: receipts, payouts, and Mercury CSV</summary>
        {advancedOpen && <div className="mt-5 space-y-5">
          <section className="rounded-xl border p-4" style={{ borderColor: "var(--as-border)" }}>
            <h3 className="font-bold">Automated payroll</h3>
            <label className="mt-2 flex items-center gap-3 text-sm"><input type="checkbox" role="switch" checked={false} disabled aria-label="Automated payroll unavailable until worker is built" /> Off — not yet available</label>
            <p className="mt-1 text-xs" style={{ color: "var(--as-text-muted)" }}>A reviewed worker, reconciliation, and payout controls must be built before this can be enabled.</p>
          </section>
          <section className="rounded-xl border p-4" style={{ borderColor: "var(--as-border)" }}>
            <h3 className="font-bold">Activated sales for receipt review</h3>
            <p className="mt-1 text-xs">Reconcile each received platform payment with the provider before recording a receipt; monthly installments require separate reviews.</p>
            {!overview?.review_candidates.length ? <p className="mt-2 text-sm">No activated sales in the current ledger view.</p> : <ul className="mt-3 space-y-2 text-sm">{overview.review_candidates.map((row) =>
              <li key={row.id} className="flex flex-wrap justify-between gap-2 border-b pb-2" style={{ borderColor: "var(--as-border)" }}><span>{row.company_legal_name} · {row.selected_plan_key} {row.selected_billing_cadence} · {repNames.get(row.created_by_user_id) || "Attribution needs review"} · {row.reviewed_receipt_count} reviewed receipt{row.reviewed_receipt_count === 1 ? "" : "s"}</span><button type="button" className="underline" onClick={() => setIntentId(row.id)}>Review {row.reviewed_receipt_count ? "another" : "first"} receipt</button></li>)}</ul>}
          </section>
          <form onSubmit={recordReceipt} className="grid gap-3 rounded-xl border p-4 sm:grid-cols-2" style={{ borderColor: "var(--as-border)" }}>
            <h3 className="font-bold sm:col-span-2">Approve a verified provider receipt</h3>
            <p className="text-xs sm:col-span-2">Only funded platform membership payments belong here. Verify funding, discounts, fees, signed sale, and activation first.</p>
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
            <div className="sm:col-span-2"><button type="submit" disabled={saving || overview?.truncated} className={buttonClass}>Approve receipt</button></div>
          </form>
          <form onSubmit={recordPayout} className="grid gap-3 rounded-xl border p-4 sm:grid-cols-2" style={{ borderColor: "var(--as-border)" }}>
            <h3 className="font-bold sm:col-span-2">Record an ACH already sent</h3><p className="text-xs sm:col-span-2">This does not send money. Do not mark a planned transfer as paid.</p>
            <label className="text-sm">Source receipt<select required value={payoutReceipt} onChange={(e) => setPayoutReceipt(e.target.value)} className={inputClass}><option value="">Select receipt</option>{overview?.receipts.map((r) => <option key={r.id} value={r.id}>{repNames.get(r.rep_user_id)} · {r.provider_payment_id}</option>)}</select></label>
            <label className="text-sm">Amount actually paid ($)<input required value={payoutAmount} onChange={(e) => setPayoutAmount(e.target.value)} className={inputClass} /></label>
            <label className="text-sm">ACH confirmation reference<input required value={achReference} onChange={(e) => setAchReference(e.target.value)} className={inputClass} /></label>
            <label className="text-sm">Paid at (timestamp with timezone)<input required value={paidAt} onChange={(e) => setPaidAt(e.target.value)} className={inputClass} placeholder="2026-10-02T18:00:00Z" /></label>
            <label className="text-sm">Evidence reference<input required value={payoutEvidence} onChange={(e) => setPayoutEvidence(e.target.value)} className={inputClass} /></label>
            <div className="sm:col-span-2"><button type="submit" disabled={saving || overview?.truncated} className={buttonClass}>Record existing payout</button></div>
          </form>
          <AdminSalesPaymentsTab request={request} reps={overview?.representatives || []} onRecorded={() => { void load(); setRefreshKey((value) => value + 1); }} />
          <p className="text-xs" style={{ color: "var(--as-text-muted)" }}>No automatic receipt ingestion, refund execution, reconciliation, or ACH runs in this release.</p>
        </div>}
      </details>
      </>}
    </main>
  </AdminLayout>;
}
