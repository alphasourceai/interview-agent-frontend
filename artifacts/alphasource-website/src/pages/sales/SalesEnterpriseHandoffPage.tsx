import { useState, type ReactNode } from "react";
import { ArrowUpRight, Building2, CheckCircle2, ExternalLink, Loader2, ShieldCheck, UsersRound } from "lucide-react";
import { SalesPageHeading } from "@/components/SalesLayout";
import { salesApi } from "@/features/sales/salesApi";
import type { EnterpriseHandoffInput } from "@/features/sales/types";

const initialForm: EnterpriseHandoffInput = {
  company_name: "",
  contact_name: "",
  contact_email: "",
  contact_phone: "",
  estimated_monthly_interviews: "",
  locations: "",
  desired_timeline: "",
  requirements: "",
  notes: "",
  ghl_contact_id: "",
  ghl_opportunity_id: "",
};

function Field({ label, required, children }: { label: string; required?: boolean; children: ReactNode }) {
  return <label className="block"><span className="text-xs font-black" style={{ color: "var(--as-text)" }}>{label}{required ? <span className="ml-1 text-[#A380F6]">*</span> : null}</span>{children}</label>;
}

const fieldClass = "mt-2 h-11 w-full rounded-[10px] border bg-transparent px-3.5 text-sm font-semibold outline-none transition focus:border-[#A380F6] focus:ring-4 focus:ring-[#A380F6]/10";

export default function SalesEnterpriseHandoffPage() {
  const [form, setForm] = useState(initialForm);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const update = <K extends keyof EnterpriseHandoffInput>(key: K, value: EnterpriseHandoffInput[K]) => setForm((current) => ({ ...current, [key]: value }));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setSuccess("");
    if (!form.company_name.trim() || !form.contact_name.trim() || !form.contact_email.trim()) {
      setError("Company, contact name, and contact email are required.");
      return;
    }
    setBusy(true);
    try {
      const result = await salesApi.createEnterpriseHandoff(form);
      setSuccess(result.message);
      setForm(initialForm);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "The handoff could not be submitted.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <SalesPageHeading eyebrow="Executive sales" title="Enterprise handoff" description="Capture the opportunity and route it to the executive team. Enterprise pricing, agreements, and checkout remain outside the sales workspace." />

      {success ? <div className="mb-5 flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800" role="status"><CheckCircle2 className="h-4 w-4" /> {success}</div> : null}
      {error ? <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700" role="alert">{error}</div> : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <form onSubmit={submit} className="rounded-2xl border p-5 sm:p-6" style={{ borderColor: "var(--as-border)", backgroundColor: "var(--as-surface)", boxShadow: "var(--as-shadow)" }}>
          <div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-[#A380F6]/10 text-[#A380F6]"><Building2 className="h-5 w-5" /></div><div><h2 className="text-lg font-black" style={{ color: "var(--as-text)" }}>Opportunity details</h2><p className="text-xs font-semibold" style={{ color: "var(--as-text-muted)" }}>Give the executive owner enough context for a productive follow-up.</p></div></div>
          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <Field label="Company" required><input value={form.company_name} onChange={(event) => update("company_name", event.target.value)} className={fieldClass} style={{ borderColor: "var(--as-border)", color: "var(--as-text)" }} /></Field>
            <Field label="Primary contact" required><input value={form.contact_name} onChange={(event) => update("contact_name", event.target.value)} className={fieldClass} style={{ borderColor: "var(--as-border)", color: "var(--as-text)" }} /></Field>
            <Field label="Contact email" required><input type="email" value={form.contact_email} onChange={(event) => update("contact_email", event.target.value)} className={fieldClass} style={{ borderColor: "var(--as-border)", color: "var(--as-text)" }} /></Field>
            <Field label="Contact phone"><input type="tel" value={form.contact_phone} onChange={(event) => update("contact_phone", event.target.value)} className={fieldClass} style={{ borderColor: "var(--as-border)", color: "var(--as-text)" }} /></Field>
            <Field label="Estimated interviews per month"><input value={form.estimated_monthly_interviews} onChange={(event) => update("estimated_monthly_interviews", event.target.value)} className={fieldClass} style={{ borderColor: "var(--as-border)", color: "var(--as-text)" }} placeholder="Approximate range" /></Field>
            <Field label="Locations or entities"><input value={form.locations} onChange={(event) => update("locations", event.target.value)} className={fieldClass} style={{ borderColor: "var(--as-border)", color: "var(--as-text)" }} placeholder="Number or short description" /></Field>
            <Field label="Desired timeline"><input value={form.desired_timeline} onChange={(event) => update("desired_timeline", event.target.value)} className={fieldClass} style={{ borderColor: "var(--as-border)", color: "var(--as-text)" }} placeholder="This quarter, next month…" /></Field>
            <Field label="GoHighLevel opportunity ID"><input value={form.ghl_opportunity_id} onChange={(event) => update("ghl_opportunity_id", event.target.value)} className={fieldClass} style={{ borderColor: "var(--as-border)", color: "var(--as-text)" }} placeholder="Optional until integration" /></Field>
            <Field label="GoHighLevel contact ID"><input value={form.ghl_contact_id} onChange={(event) => update("ghl_contact_id", event.target.value)} className={fieldClass} style={{ borderColor: "var(--as-border)", color: "var(--as-text)" }} placeholder="Optional until integration" /></Field>
            <label className="block sm:col-span-2"><span className="text-xs font-black" style={{ color: "var(--as-text)" }}>Integration, security, or operational requirements</span><textarea rows={4} value={form.requirements} onChange={(event) => update("requirements", event.target.value)} className="mt-2 w-full rounded-[10px] border bg-transparent px-3.5 py-3 text-sm font-semibold outline-none transition focus:border-[#A380F6] focus:ring-4 focus:ring-[#A380F6]/10" style={{ borderColor: "var(--as-border)", color: "var(--as-text)" }} placeholder="What will the executive team need to address?" /></label>
            <label className="block sm:col-span-2"><span className="text-xs font-black" style={{ color: "var(--as-text)" }}>Sales notes</span><textarea rows={3} value={form.notes} onChange={(event) => update("notes", event.target.value)} className="mt-2 w-full rounded-[10px] border bg-transparent px-3.5 py-3 text-sm font-semibold outline-none transition focus:border-[#A380F6] focus:ring-4 focus:ring-[#A380F6]/10" style={{ borderColor: "var(--as-border)", color: "var(--as-text)" }} placeholder="Decision makers, next step, or other useful context." /></label>
          </div>
          <div className="mt-6 flex justify-end border-t pt-5" style={{ borderColor: "var(--as-border)" }}><button type="submit" disabled={busy} className="inline-flex h-11 items-center gap-2 rounded-[10px] bg-[#A380F6] px-5 text-sm font-black text-white shadow-[0_10px_24px_rgba(163,128,246,0.24)] disabled:opacity-50">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUpRight className="h-4 w-4" />}{busy ? "Recording…" : "Record executive handoff"}</button></div>
        </form>

        <aside className="h-fit space-y-4 xl:sticky xl:top-[94px]">
          <div className="rounded-2xl border p-5" style={{ borderColor: "var(--as-border)", backgroundColor: "var(--as-surface)", boxShadow: "var(--as-shadow)" }}>
            <div className="flex items-center gap-2"><UsersRound className="h-4 w-4 text-[#A380F6]" /><h2 className="text-sm font-black" style={{ color: "var(--as-text)" }}>What happens next</h2></div>
            <ol className="mt-4 space-y-4">
              {["The executive owner reviews the opportunity.", "The buyer books or confirms a tailored demo.", "The executive team handles scope, pricing, agreement, and payment."].map((item, index) => <li key={item} className="flex gap-3"><span className="grid h-6 w-6 flex-none place-items-center rounded-[8px] bg-[#0A1547]/[0.06] text-[10px] font-black" style={{ color: "var(--as-text)" }}>{index + 1}</span><span className="pt-1 text-xs font-semibold leading-relaxed" style={{ color: "var(--as-text-muted)" }}>{item}</span></li>)}
            </ol>
            <a href="https://calendar.app.google/nRydP6gEQTGaHAq68" target="_blank" rel="noreferrer" className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-[9px] border px-3 py-2.5 text-xs font-black transition hover:border-[#A380F6] hover:text-[#A380F6]" style={{ borderColor: "var(--as-border)", color: "var(--as-text)" }}>Open demo calendar <ExternalLink className="h-3.5 w-3.5" /></a>
          </div>
          <div className="rounded-2xl border border-[#02ABE0]/20 bg-[#02ABE0]/[0.055] p-5"><ShieldCheck className="h-5 w-5 text-[#02ABE0]" /><h2 className="mt-3 text-sm font-black text-[#0A1547]">No commerce actions</h2><p className="mt-2 text-xs font-semibold leading-relaxed text-[#0A1547]/55">This handoff does not create a customer, agreement, payment session, or membership. The executive team owns those steps.</p></div>
        </aside>
      </div>
    </div>
  );
}
