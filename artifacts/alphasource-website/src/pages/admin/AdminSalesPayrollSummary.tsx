import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronRight, Download, RefreshCw } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

type Request = (path: string, body?: object) => Promise<Record<string, unknown>>;
type Totals = { sale_count: number; gross_sales_cents: number; adjustment_cents: number; net_revenue_cents: number; commission_cents: number };
type Event = { id: string; date: string; client_name: string; activity: string; receipt_id: string; gross_sales_cents: number; adjustment_cents: number; net_revenue_cents: number; commission_cents: number };
type Representative = Totals & { user_id: string; display_name: string; email: string; events: Event[] };
type Report = { date_from: string; date_to: string; timezone: string; generated_at: string; basis: string; totals: Totals; representatives: Representative[] };
type Period = "wtd" | "mtd" | "30d" | "90d" | "ytd" | "custom";

const money = (cents: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
const count = (value: number) => new Intl.NumberFormat("en-US").format(value);
const panel = "rounded-2xl border p-5";
const surface = { backgroundColor: "var(--as-surface)", borderColor: "var(--as-border)", boxShadow: "var(--as-shadow)" };
const muted = { color: "var(--as-text-muted)" };
const dateFormat = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
const displayDate = (value: string) => dateFormat.format(new Date(`${value}T12:00:00Z`));

function mountainToday() {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Denver", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const value = (type: string) => parts.find((part) => part.type === type)?.value || "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

function dayOffset(date: string, days: number) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function datesFor(period: Period, today: string) {
  const date = new Date(`${today}T12:00:00Z`);
  if (period === "wtd") return { from: dayOffset(today, -(date.getUTCDay() + 6) % 7), to: today };
  if (period === "mtd") return { from: `${today.slice(0, 7)}-01`, to: today };
  if (period === "30d") return { from: dayOffset(today, -29), to: today };
  if (period === "90d") return { from: dayOffset(today, -89), to: today };
  return { from: `${today.slice(0, 4)}-01-01`, to: today };
}

function errorText(value: unknown) { return value instanceof Error ? value.message : "Could not load sales payroll."; }

export default function AdminSalesPayrollSummary({ request, backendBase, refreshKey }: { request: Request; backendBase: string; refreshKey: number }) {
  const [period, setPeriod] = useState<Period>("mtd");
  const today = mountainToday();
  const [customFrom, setCustomFrom] = useState(today);
  const [customTo, setCustomTo] = useState(today);
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const generation = useRef(0);
  const dates = useMemo(() => period === "custom" ? { from: customFrom, to: customTo } : datesFor(period, today), [period, customFrom, customTo, today]);
  const validDates = Boolean(dates.from && dates.to && dates.from <= dates.to);
  const params = useMemo(() => new URLSearchParams({ date_from: dates.from, date_to: dates.to }).toString(), [dates.from, dates.to]);
  const currentReport = report?.date_from === dates.from && report?.date_to === dates.to ? report : null;

  const load = useCallback(async () => {
    const current = ++generation.current;
    setReport(null); setError("");
    if (!validDates) { setLoading(false); setError("Choose a valid start and end date."); return; }
    setLoading(true);
    try {
      const result = await request(`/report?${params}`) as Report;
      if (current === generation.current) setReport(result);
    } catch (cause) { if (current === generation.current) setError(errorText(cause)); }
    finally { if (current === generation.current) setLoading(false); }
  }, [request, params, validDates]);

  useEffect(() => { void load(); return () => { generation.current += 1; }; }, [load, refreshKey]);

  async function exportWorkbook() {
    if (!currentReport || loading || exporting || !backendBase) return;
    setExporting(true); setError("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Please sign in again.");
      const response = await fetch(`${backendBase}/admin/sales-payroll/export?${params}`, {
        cache: "no-store", credentials: "omit", headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({})) as { error?: string };
        throw new Error((payload.error || "Export failed.").replace(/_/g, " "));
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url; anchor.download = `sales-payroll-${currentReport.date_from}-to-${currentReport.date_to}.xlsx`;
      document.body.append(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(url);
    } catch (cause) { setError(errorText(cause)); }
    finally { setExporting(false); }
  }

  const filters: Array<[Period, string]> = [["wtd", "WTD"], ["mtd", "MTD"], ["30d", "30 days"], ["90d", "90 days"], ["ytd", "YTD"], ["custom", "Custom"]];
  const cards: Array<[string, string, string]> = [
    ["Total sales", money(currentReport?.totals.gross_sales_cents || 0), "Reviewed platform membership payments"],
    ["Number of sales", count(currentReport?.totals.sale_count || 0), "Distinct client deals paid in this period"],
    ["Total commissions", money(currentReport?.totals.commission_cents || 0), "Earned, including dated adjustments"],
  ];
  return <div className="space-y-5">
    <section className={`${panel} flex flex-wrap items-end justify-between gap-4`} style={surface} aria-label="Payroll date filters">
      <div><p className="text-xs font-bold uppercase tracking-[0.16em]" style={{ color: "#A380F6" }}>Reporting period</p>
        <div className="mt-3 flex flex-wrap gap-2">{filters.map(([key, label]) => <button key={key} type="button" onClick={() => setPeriod(key)} aria-pressed={period === key}
          className={`rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${period === key ? "bg-[#A380F6] text-white" : "border hover:bg-[#A380F6]/10"}`}
          style={period === key ? undefined : { borderColor: "var(--as-border)" }}>{label}</button>)}</div>
        {period === "custom" && <div className="mt-3 flex flex-wrap gap-3 text-sm">
          <label>From <input aria-label="From date" type="date" value={customFrom} onChange={(event) => setCustomFrom(event.target.value)} className="ml-1 rounded-lg border px-2 py-1.5" style={surface} /></label>
          <label>To <input aria-label="To date" type="date" value={customTo} onChange={(event) => setCustomTo(event.target.value)} className="ml-1 rounded-lg border px-2 py-1.5" style={surface} /></label>
        </div>}
        <p className="mt-3 text-xs" style={muted}>{validDates ? `${displayDate(dates.from)} – ${displayDate(dates.to)} · Mountain Time` : "Select a valid date range."}</p>
      </div>
      <div className="flex gap-2"><button type="button" onClick={() => void load()} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold disabled:opacity-50" style={{ borderColor: "var(--as-border)" }}><RefreshCw size={16} />Refresh</button>
        <button type="button" onClick={() => void exportWorkbook()} disabled={!currentReport || loading || exporting} className="inline-flex items-center gap-2 rounded-lg bg-[#A380F6] px-4 py-2 text-sm font-bold text-white disabled:opacity-50"><Download size={16} />{exporting ? "Exporting…" : "Export Excel"}</button></div>
    </section>
    {error && <p role="alert" className="rounded-xl border border-red-400/50 bg-red-500/5 px-4 py-3 text-sm">{error}</p>}
    {loading || (validDates && !currentReport && !error) ? <div role="status" className={panel} style={surface}>Loading payroll for this period…</div> : currentReport && <>
      {currentReport.representatives.every((rep) => rep.events.length === 0) && <p role="status" className={panel} style={surface}>No reviewed payments or adjustments in this period. Unreviewed activations are excluded; review them under Actions → Advanced receipts.</p>}
      <section className="grid gap-4 md:grid-cols-3" aria-label="Payroll totals">{cards.map(([label, value, help]) => <div key={label} className={panel} style={surface}>
        <p className="text-sm font-semibold" style={muted}>{label}</p><p className="mt-2 text-3xl font-bold tabular-nums">{value}</p><p className="mt-1 text-xs" style={muted}>{help}</p>
      </div>)}</section>
      <section className={`${panel} !p-0 overflow-hidden`} style={surface}>
        <div className="px-5 py-4"><h2 className="text-lg font-bold">Sales by salesperson</h2>
          <p className="mt-1 text-sm" style={muted}>Sales amount is gross reviewed membership payments. Adjustments include discounts, provider fees, refunds, chargebacks, and recoveries. Net revenue is sales plus adjustments.</p></div>
        <div className="overflow-x-auto"><table className="w-full min-w-[840px] text-left text-sm">
          <thead style={{ backgroundColor: "var(--as-surface-muted)", color: "var(--as-text-muted)" }}><tr className="text-xs font-bold uppercase tracking-wider"><th className="px-5 py-3">Salesperson</th><th className="px-3 py-3 text-right">Sales</th><th className="px-3 py-3 text-right">Sales amount</th><th className="px-3 py-3 text-right">Adjustments</th><th className="px-3 py-3 text-right">Net revenue</th><th className="px-5 py-3 text-right">Commission</th></tr></thead>
          <tbody>{currentReport.representatives.map((rep) => <Fragment key={rep.user_id}>
            <tr className="border-t" style={{ borderColor: "var(--as-border)" }}><th scope="row" className="px-5 py-4 font-semibold"><button type="button" aria-expanded={expanded === rep.user_id} aria-controls={`payroll-detail-${rep.user_id}`} onClick={() => setExpanded((value) => value === rep.user_id ? null : rep.user_id)} className="flex items-center gap-2 text-left hover:text-[#A380F6]"><span>{expanded === rep.user_id ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</span><span>{rep.display_name || rep.email}<small className="block font-normal" style={muted}>{rep.email}</small></span></button></th>
              <td className="px-3 py-4 text-right tabular-nums">{count(rep.sale_count)}</td><td className="px-3 py-4 text-right tabular-nums">{money(rep.gross_sales_cents)}</td><td className="px-3 py-4 text-right tabular-nums">{money(rep.adjustment_cents)}</td><td className="px-3 py-4 text-right font-semibold tabular-nums">{money(rep.net_revenue_cents)}</td><td className="px-5 py-4 text-right font-bold tabular-nums">{money(rep.commission_cents)}</td></tr>
            {expanded === rep.user_id && <tr id={`payroll-detail-${rep.user_id}`}><td colSpan={6} className="border-t px-5 py-4" style={{ borderColor: "var(--as-border)", backgroundColor: "var(--as-surface-muted)" }}>
              <h3 className="mb-2 text-sm font-bold">Client activity for {rep.display_name || rep.email}</h3>
              {rep.events.length === 0 ? <p className="text-sm" style={muted}>No reviewed payments or adjustments in this period.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead><tr className="text-xs uppercase" style={muted}><th className="py-2">Date</th><th>Client / receipt</th><th>Activity</th><th className="text-right">Sales amount</th><th className="text-right">Adjustments</th><th className="text-right">Net revenue</th><th className="text-right">Commission</th></tr></thead><tbody>{rep.events.map((event) => <tr key={event.id} className="border-t" style={{ borderColor: "var(--as-border)" }}><td className="py-2">{displayDate(event.date)}</td><td>{event.client_name}<small className="block break-all" style={muted}>Receipt {event.receipt_id}</small></td><td>{event.activity}</td><td className="text-right tabular-nums">{money(event.gross_sales_cents)}</td><td className="text-right tabular-nums">{money(event.adjustment_cents)}</td><td className="text-right tabular-nums">{money(event.net_revenue_cents)}</td><td className="text-right tabular-nums">{money(event.commission_cents)}</td></tr>)}</tbody></table></div>}
            </td></tr>}
          </Fragment>)}</tbody>
          <tfoot><tr className="border-t font-bold" style={{ borderColor: "var(--as-border)", backgroundColor: "var(--as-surface-muted)" }}><th className="px-5 py-4 text-left">Total</th><td className="px-3 py-4 text-right">{count(currentReport.totals.sale_count)}</td><td className="px-3 py-4 text-right">{money(currentReport.totals.gross_sales_cents)}</td><td className="px-3 py-4 text-right">{money(currentReport.totals.adjustment_cents)}</td><td className="px-3 py-4 text-right">{money(currentReport.totals.net_revenue_cents)}</td><td className="px-5 py-4 text-right">{money(currentReport.totals.commission_cents)}</td></tr></tfoot>
        </table></div>
        <p className="border-t px-5 py-3 text-xs" style={{ borderColor: "var(--as-border)", ...muted }}>A refund or recovery on an older sale appears on its effective date and is attached to that client; it does not count as a new sale. Monthly installments on one client deal count once in the selected period. Commission sums reviewed per-payment amounts, so rounding can differ by a cent from 50% of aggregate net revenue. This is earned activity by date, not a locked weekly statement or an amount to pay.</p>
      </section>
    </>}
  </div>;
}
