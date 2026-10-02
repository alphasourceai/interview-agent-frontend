import { useEffect, useState } from "react";
import { ArrowLeft, Building2, CalendarClock, Contact, Loader2, Mail, Phone, RefreshCw } from "lucide-react";
import { Link, useRoute } from "wouter";
import { SalesPageHeading } from "@/components/SalesLayout";
import { salesApi } from "@/features/sales/salesApi";
import type { SalesDealDetail } from "@/features/sales/types";

function labelEvent(value: string): string {
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function displayDate(value: string): string {
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(date)
    : "Unknown";
}

function formatMoney(cents: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

export default function SalesDealDetailPage() {
  const [, params] = useRoute("/sales/deals/:id");
  const dealId = params?.id ? decodeURIComponent(params.id) : "";
  const [deal, setDeal] = useState<SalesDealDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const timeline = Array.isArray(deal?.timeline) ? deal.timeline : [];

  const load = async () => {
    if (!dealId) return;
    setLoading(true);
    setError("");
    try {
      setDeal(await salesApi.getDeal(dealId));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "The deal could not be loaded.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [dealId]);

  return (
    <div>
      <Link href="/sales" className="mb-5 inline-flex items-center gap-2 text-xs font-black text-[#0A1547]/55 transition hover:text-[#A380F6]"><ArrowLeft className="h-4 w-4" /> Back to my deals</Link>
      <SalesPageHeading
        eyebrow="Deal summary"
        title={deal?.company_dba || deal?.company_legal_name || "Sales deal"}
        description="Read-only customer, membership, CRM, and transaction history for this sale."
        action={<button type="button" onClick={() => void load()} disabled={loading} className="inline-flex h-10 items-center gap-2 rounded-[9px] border px-3 text-xs font-black disabled:opacity-50" style={{ borderColor: "var(--as-border)", color: "var(--as-text)" }}><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh</button>}
      />

      {loading && !deal ? <div className="grid min-h-52 place-items-center rounded-2xl border" style={{ borderColor: "var(--as-border)", backgroundColor: "var(--as-surface)" }}><Loader2 className="h-6 w-6 animate-spin text-[#A380F6]" /></div> : null}
      {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700" role="alert">{error}</div> : null}

      {deal ? (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-5">
            <section className="rounded-2xl border p-5 sm:p-6" style={{ borderColor: "var(--as-border)", backgroundColor: "var(--as-surface)", boxShadow: "var(--as-shadow)" }}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div><p className="text-xs font-black uppercase tracking-[0.14em] text-[#A380F6]">{deal.plan_name} · {deal.billing_cadence}</p><h2 className="mt-2 text-xl font-black" style={{ color: "var(--as-text)" }}>{deal.status_label}</h2></div>
                <div className="text-right"><p className="text-xs font-bold" style={{ color: "var(--as-text-muted)" }}>Expected initial payment</p><p className="mt-1 text-xl font-black" style={{ color: "var(--as-text)" }}>{formatMoney(deal.initial_payment_cents)}</p></div>
              </div>
              <dl className="mt-6 grid gap-4 border-t pt-5 sm:grid-cols-2" style={{ borderColor: "var(--as-border)" }}>
                <div><dt className="text-[10px] font-black uppercase tracking-[0.14em]" style={{ color: "var(--as-text-subtle)" }}>Legal company</dt><dd className="mt-1 text-sm font-bold" style={{ color: "var(--as-text)" }}>{deal.company_legal_name}</dd></div>
                <div><dt className="text-[10px] font-black uppercase tracking-[0.14em]" style={{ color: "var(--as-text-subtle)" }}>Buyer</dt><dd className="mt-1 text-sm font-bold" style={{ color: "var(--as-text)" }}>{deal.buyer_name} · {deal.buyer_title || "Title not recorded"}</dd></div>
                <div><dt className="text-[10px] font-black uppercase tracking-[0.14em]" style={{ color: "var(--as-text-subtle)" }}>Buyer contact</dt><dd className="mt-1 flex flex-col gap-1 text-sm font-semibold" style={{ color: "var(--as-text-muted)" }}><span className="flex items-center gap-2"><Mail className="h-3.5 w-3.5" />{deal.buyer_email}</span><span className="flex items-center gap-2"><Phone className="h-3.5 w-3.5" />{deal.buyer_phone || "Not recorded"}</span></dd></div>
                <div><dt className="text-[10px] font-black uppercase tracking-[0.14em]" style={{ color: "var(--as-text-subtle)" }}>Candidate assistance</dt><dd className="mt-1 text-sm font-semibold" style={{ color: "var(--as-text-muted)" }}>{deal.candidate_assistance_name || "Not recorded"}<br />{deal.candidate_assistance_email || ""}</dd></div>
              </dl>
              {deal.sales_note ? <div className="mt-5 rounded-xl bg-[#0A1547]/[0.035] p-4"><p className="text-[10px] font-black uppercase tracking-[0.14em]" style={{ color: "var(--as-text-subtle)" }}>Sales note</p><p className="mt-2 text-sm font-semibold leading-relaxed" style={{ color: "var(--as-text-muted)" }}>{deal.sales_note}</p></div> : null}
            </section>

            <section className="rounded-2xl border p-5 sm:p-6" style={{ borderColor: "var(--as-border)", backgroundColor: "var(--as-surface)", boxShadow: "var(--as-shadow)" }}>
              <div className="flex items-center gap-3"><CalendarClock className="h-5 w-5 text-[#A380F6]" /><h2 className="text-lg font-black" style={{ color: "var(--as-text)" }}>Transaction timeline</h2></div>
              {timeline.length ? <ol className="mt-5 space-y-4">{timeline.map((event) => <li key={event.id} className="flex gap-3"><span className="mt-1 h-2.5 w-2.5 flex-none rounded-full bg-[#A380F6]" /><div><p className="text-sm font-black" style={{ color: "var(--as-text)" }}>{labelEvent(event.event_type)}</p><p className="mt-1 text-xs font-semibold" style={{ color: "var(--as-text-muted)" }}>{displayDate(event.created_at)}</p></div></li>)}</ol> : <p className="mt-4 text-sm font-semibold" style={{ color: "var(--as-text-muted)" }}>No timeline events have been recorded yet.</p>}
            </section>
          </div>

          <aside className="h-fit space-y-4 xl:sticky xl:top-[94px]">
            <div className="rounded-2xl border p-5" style={{ borderColor: "var(--as-border)", backgroundColor: "var(--as-surface)", boxShadow: "var(--as-shadow)" }}>
              <div className="flex items-center gap-2"><Contact className="h-4 w-4 text-[#02ABE0]" /><h2 className="text-sm font-black" style={{ color: "var(--as-text)" }}>GoHighLevel links</h2></div>
              <dl className="mt-4 space-y-3 text-xs"><div><dt className="font-black" style={{ color: "var(--as-text-subtle)" }}>Contact ID</dt><dd className="mt-1 break-all font-semibold" style={{ color: "var(--as-text-muted)" }}>{deal.ghl_contact_id || "Not linked"}</dd></div><div><dt className="font-black" style={{ color: "var(--as-text-subtle)" }}>Opportunity ID</dt><dd className="mt-1 break-all font-semibold" style={{ color: "var(--as-text-muted)" }}>{deal.ghl_opportunity_id || "Not linked"}</dd></div></dl>
            </div>
            <div className="rounded-2xl border border-[#A380F6]/20 bg-[#A380F6]/[0.055] p-5"><Building2 className="h-5 w-5 text-[#A380F6]" /><h2 className="mt-3 text-sm font-black text-[#0A1547]">Need company help?</h2><p className="mt-2 text-xs font-semibold leading-relaxed text-[#0A1547]/55">Share the deal ID with the alphaSource company representative. Paid agreements and activation issues require administrator handling.</p><p className="mt-3 break-all rounded-lg bg-white/70 px-3 py-2 text-[11px] font-black text-[#0A1547]">{deal.id}</p></div>
          </aside>
        </div>
      ) : null}
    </div>
  );
}
