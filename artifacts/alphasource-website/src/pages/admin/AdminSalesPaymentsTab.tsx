import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";

type Request = (path: string, body?: object) => Promise<Record<string, unknown>>;
type Rep = { user_id: string; email: string; display_name: string };
type PaymentRow = {
  receipt_id: string; rep_user_id: string; provider_payment_id: string; payment_kind: string;
  net_membership_cents: number; commission_cents: number; adjustment_cents: number;
  paid_cents: number; outstanding_cents: number; paid_dates: string[]; statement_week_start: string;
};
type Summary = { rep_user_id: string; display_name: string; email: string; receipt_count: number;
  net_membership_cents: number; adjustment_cents: number; earned_cents: number; paid_cents: number; outstanding_cents: number };
type PreviewRow = { row_number: number; ach_trace: string; value_date: string; paid_at: string;
  amount_cents: number; counterparty_label: string; source_account_allowed: boolean };
type Allocation = { receipt_id: string; amount: string };

const fieldClass = "w-full rounded-lg border px-3 py-2 text-sm";
const actionClass = "rounded-lg bg-[#9f75ef] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50";
const money = (cents: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(cents || 0) / 100);
function asCents(value: string): number {
  if (!/^\d+(?:\.\d{1,2})?$/.test(value.trim())) throw new Error("Enter dollars and cents without a sign or commas.");
  const [whole, fraction = ""] = value.trim().split(".");
  const result = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(result) || result <= 0) throw new Error("Each allocation must be a positive amount.");
  return result;
}

export default function AdminSalesPaymentsTab({ request, reps, onRecorded }: { request: Request; reps: Rep[]; onRecorded: () => void }) {
  const [summary, setSummary] = useState<Summary[]>([]);
  const [rows, setRows] = useState<PaymentRow[]>([]);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [repFilter, setRepFilter] = useState("");
  const [csv, setCsv] = useState("");
  const [preview, setPreview] = useState<PreviewRow[]>([]);
  const [selectedRow, setSelectedRow] = useState(0);
  const [selectedRep, setSelectedRep] = useState("");
  const [allocations, setAllocations] = useState<Allocation[]>([{ receipt_id: "", amount: "" }]);
  const [attested, setAttested] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [reverseId, setReverseId] = useState("");
  const [reverseAt, setReverseAt] = useState("");
  const [reverseEvidence, setReverseEvidence] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (repFilter) params.set("rep_user_id", repFilter);
      const data = await request(`/payments?${params.toString()}`);
      setSummary(data.summary as Summary[]);
      setRows(data.rows as PaymentRow[]);
      setTotal(Number(data.total || 0));
      setError("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not load payments."); }
    finally { setLoading(false); }
  }, [page, repFilter, request]);
  useEffect(() => { void load(); }, [load]);

  const picked = useMemo(() => preview.find((row) => row.row_number === selectedRow), [preview, selectedRow]);
  const repRows = useMemo(() => rows.filter((row) => row.rep_user_id === selectedRep), [rows, selectedRep]);
  const allocationsCents = useMemo(() => {
    try { return allocations.reduce((sum, item) => sum + (item.amount ? asCents(item.amount) : 0), 0); }
    catch { return -1; }
  }, [allocations]);

  async function previewFile(file: File | null) {
    setError(""); setNotice(""); setPreview([]); setSelectedRow(0); setCsv(""); setAttested(false);
    if (!file) return;
    if (file.size > 1024 * 1024) { setError("Use a Mercury CSV smaller than 1 MB."); return; }
    try {
      const text = await file.text();
      const data = await request("/mercury/preview", { csv: text });
      setCsv(text);
      setPreview(data.rows as PreviewRow[]);
      setNotice("Preview only. Nothing has been recorded as paid.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "CSV preview failed."); }
  }

  async function recordImport(event: FormEvent) {
    event.preventDefault(); setError(""); setNotice("");
    if (!picked || !picked.source_account_allowed || !selectedRep || !attested) { setError("Choose an approved bank row and representative, then complete the verification checkbox."); return; }
    if (repFilter !== selectedRep) { setError("Filter the payments table to the selected representative before allocating receipts."); return; }
    try {
      const reviewed = allocations.map((item) => ({ receipt_id: item.receipt_id, amount_cents: asCents(item.amount) }));
      if (new Set(reviewed.map((item) => item.receipt_id)).size !== reviewed.length ||
          reviewed.some((item) => !item.receipt_id) || allocationsCents !== picked.amount_cents) {
        throw new Error("Allocate the exact bank amount to distinct receipts for this representative.");
      }
      setSaving(true);
      await request("/mercury/import", { csv, row_number: picked.row_number, rep_user_id: selectedRep,
        allocations: reviewed, attested: true });
      setCsv(""); setPreview([]); setSelectedRow(0); setAttested(false);
      setAllocations([{ receipt_id: "", amount: "" }]);
      setNotice("Reviewed Mercury ACH recorded. No money was sent.");
      await load(); onRecorded();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Import failed."); }
    finally { setSaving(false); }
  }

  async function recordReversal(event: FormEvent) {
    event.preventDefault(); setError(""); setNotice(""); setSaving(true);
    try {
      const date = new Date(reverseAt);
      if (!Number.isFinite(date.getTime())) throw new Error("Enter a valid reversal time.");
      await request("/mercury/reverse", { bank_transaction_id: reverseId, observed_at: date.toISOString(), evidence_reference: reverseEvidence });
      setNotice("Bank reversal recorded. The original payment remains in the audit trail and outstanding commission is restored.");
      setReverseId(""); setReverseAt(""); setReverseEvidence("");
      await load(); onRecorded();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Reversal failed."); }
    finally { setSaving(false); }
  }

  return <div className="space-y-6">
    <section className="rounded-xl border p-4">
      <h2 className="text-lg font-bold">Payments by salesperson</h2>
      <p className="mt-1 text-xs">Earned commission is based on reviewed membership receipts and linked adjustments. Paid dates show each recorded, non-reversed payout. No payment is initiated here.</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{summary.map((rep) => <button type="button" key={rep.rep_user_id}
        onClick={() => { setRepFilter(rep.rep_user_id); setPage(0); }} className="rounded-xl border p-3 text-left">
        <strong>{rep.display_name || rep.email}</strong><span className="mt-1 block text-xs">{rep.receipt_count} reviewed receipts · sale net {money(rep.net_membership_cents)}</span>
        <span className="block text-xs">Adjustments {money(rep.adjustment_cents)} · earned {money(rep.earned_cents)}</span>
        <span className="block text-xs">Paid {money(rep.paid_cents)} · outstanding {money(rep.outstanding_cents)}</span>
      </button>)}</div>
      <label className="mt-4 block max-w-sm text-sm">Salesperson
        <select value={repFilter} onChange={(e) => { setRepFilter(e.target.value); setPage(0); }} className={fieldClass}>
          <option value="">All salespeople</option>{reps.map((rep) => <option key={rep.user_id} value={rep.user_id}>{rep.display_name || rep.email}</option>)}
        </select>
      </label>
      {loading ? <p className="mt-3 text-sm">Loading payments…</p> : rows.length === 0 ? <p className="mt-3 text-sm">No reviewed commission receipts in this view.</p> :
        <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[900px] text-left text-sm"><thead><tr><th>Salesperson / sale</th><th>Sale amount</th><th>Adjustments</th><th>Commission earned</th><th>Commission paid</th><th>Paid date(s)</th><th>Outstanding</th></tr></thead>
          <tbody>{rows.map((row) => <tr key={row.receipt_id} className="border-t"><td className="py-2">{reps.find((rep) => rep.user_id === row.rep_user_id)?.display_name || row.rep_user_id}<br/><small>{row.provider_payment_id} · {row.payment_kind}</small></td>
            <td>{money(row.net_membership_cents)}</td><td>{money(row.adjustment_cents)}</td><td>{money(row.commission_cents + row.adjustment_cents)}</td><td>{money(row.paid_cents)}</td>
            <td>{row.paid_dates?.length ? row.paid_dates.map((date) => new Date(date).toLocaleDateString()).join(", ") : "—"}</td><td>{money(row.outstanding_cents)}</td></tr>)}</tbody></table></div>}
      <div className="mt-3 flex items-center gap-3 text-sm"><button type="button" disabled={page === 0 || loading} onClick={() => setPage((value) => value - 1)} className="underline disabled:opacity-40">Previous</button>
        <span>Page {page + 1} · {total} receipts</span><button type="button" disabled={(page + 1) * 100 >= total || loading} onClick={() => setPage((value) => value + 1)} className="underline disabled:opacity-40">Next</button></div>
    </section>
    {error && <p role="alert" className="rounded-lg border border-red-400/50 p-3 text-sm">{error}</p>}
    {notice && <p role="status" className="rounded-lg border border-green-400/50 p-3 text-sm">{notice}</p>}
    <section className="rounded-xl border p-4"><h2 className="font-bold">Import a Mercury ACH already sent</h2>
      <p className="mt-1 text-xs">Upload a Mercury transaction CSV to preview. Only a manually verified, posted outgoing ACH from the approved payroll account can be recorded. A mixed-purpose transfer cannot be imported. The file is not stored.</p>
      <input type="file" accept=".csv,text/csv" onChange={(event) => void previewFile(event.target.files?.[0] || null)} className="mt-3 block text-sm" aria-label="Mercury CSV" />
      {!!preview.length && <form onSubmit={(event) => void recordImport(event)} className="mt-4 space-y-3">
        <label className="block text-sm">Bank transaction
          <select required value={selectedRow} onChange={(event) => { setSelectedRow(Number(event.target.value)); setAttested(false); }} className={fieldClass}>
            <option value={0}>Select a transaction</option>{preview.map((row) => <option key={row.row_number} value={row.row_number}>
              {row.value_date} · {row.counterparty_label} · {money(row.amount_cents)} · trace ending {row.ach_trace.slice(-4)}{row.source_account_allowed ? "" : " · account not approved"}
            </option>)}</select></label>
        <label className="block text-sm">Salesperson for this entire ACH
          <select required value={selectedRep} onChange={(event) => { setSelectedRep(event.target.value); setRepFilter(event.target.value); setPage(0); setAllocations([{ receipt_id: "", amount: "" }]); }} className={fieldClass}>
            <option value="">Select salesperson</option>{reps.map((rep) => <option key={rep.user_id} value={rep.user_id}>{rep.display_name || rep.email}</option>)}
          </select></label>
        <p className="text-xs">Allocate exactly {money(picked?.amount_cents || 0)} across reviewed receipts for this salesperson. The database still checks locked statements, payout timing, and remaining commission.</p>
        {allocations.map((item, index) => <div key={index} className="grid gap-2 sm:grid-cols-[1fr_180px_auto]">
          <select required aria-label={`Receipt ${index + 1}`} value={item.receipt_id} onChange={(event) => setAllocations((current) => current.map((value, i) => i === index ? { ...value, receipt_id: event.target.value } : value))} className={fieldClass}>
            <option value="">Select receipt</option>{repRows.map((row) => <option key={row.receipt_id} value={row.receipt_id}>{row.provider_payment_id} · outstanding {money(row.outstanding_cents)}</option>)}
          </select><input required aria-label={`Allocation ${index + 1} in dollars`} value={item.amount} onChange={(event) => setAllocations((current) => current.map((value, i) => i === index ? { ...value, amount: event.target.value } : value))} placeholder="Dollars" className={fieldClass} />
          <button type="button" disabled={allocations.length === 1} onClick={() => setAllocations((current) => current.filter((_, i) => i !== index))} className="px-2 text-sm underline disabled:opacity-40">Remove</button>
        </div>)}
        <button type="button" onClick={() => setAllocations((current) => [...current, { receipt_id: "", amount: "" }])} className="text-sm underline">Add receipt allocation</button>
        <p className="text-sm">Allocated {allocationsCents < 0 ? "Invalid amount" : money(allocationsCents)} of {money(picked?.amount_cents || 0)}</p>
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" required checked={attested} onChange={(event) => setAttested(event.target.checked)} />
          I verified this exact outgoing ACH, recipient, posted status, and complete commission allocation in Mercury. It is not a card, check, wire, internal transfer, or mixed expense.</label>
        <button type="submit" disabled={saving || !picked?.source_account_allowed || !selectedRep || allocationsCents !== picked?.amount_cents || !repRows.length} className={actionClass}>Record reviewed ACH</button>
      </form>}
    </section>
    <form onSubmit={(event) => void recordReversal(event)} className="grid gap-3 rounded-xl border p-4 sm:grid-cols-2">
      <h2 className="font-bold sm:col-span-2">Record a returned or reversed Mercury payout</h2>
      <p className="text-xs sm:col-span-2">Only after verifying a reversal in Mercury. This preserves the original bank transaction and reopens its commission balance.</p>
      <label className="text-sm">Bank import ID<input required value={reverseId} onChange={(event) => setReverseId(event.target.value)} className={fieldClass} /></label>
      <label className="text-sm">Reversal observed at<input required type="datetime-local" value={reverseAt} onChange={(event) => setReverseAt(event.target.value)} className={fieldClass} /></label>
      <label className="text-sm sm:col-span-2">Mercury evidence reference<input required value={reverseEvidence} onChange={(event) => setReverseEvidence(event.target.value)} className={fieldClass} /></label>
      <button type="submit" disabled={saving} className={actionClass}>Record reviewed reversal</button>
    </form>
  </div>;
}
