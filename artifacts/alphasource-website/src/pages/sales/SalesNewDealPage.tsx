import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useLocation } from "wouter";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Building2,
  Check,
  CheckCircle2,
  FileSearch,
  Gift,
  Info,
  ExternalLink,
  Loader2,
  Mail,
  ShieldCheck,
  Sparkles,
  Tag,
  UserRound,
} from "lucide-react";
import { SalesPageHeading } from "@/components/SalesLayout";
import { SalesApiError, salesApi, salesUsesMockApi } from "@/features/sales/salesApi";
import type {
  PromotionCodeSummary,
  GhlSalesImport,
  SalesAgreementPreview,
  SalesDealDraft,
  SalesPackage,
} from "@/features/sales/types";

const emptyDraft: SalesDealDraft = {
  company_legal_name: "",
  company_dba: "",
  buyer_first_name: "",
  buyer_last_name: "",
  buyer_email: "",
  buyer_phone: "",
  buyer_title: "",
  candidate_assistance_name: "",
  candidate_assistance_email: "",
  ghl_import_id: "",
  ghl_contact_id: "",
  ghl_opportunity_id: "",
  sales_note: "",
  plan_key: "basic",
  billing_cadence: "monthly",
  first_role_prepay_selected: false,
  promotion_code: "",
};

function formatMoney(cents: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: cents % 100 === 0 ? 0 : 2 }).format(cents / 100);
}

function formatAgreementDate(value: string): string {
  const parsed = new Date(`${value}T12:00:00`);
  if (!Number.isFinite(parsed.getTime())) return value;
  return parsed.toLocaleDateString([], { month: "long", day: "numeric", year: "numeric" });
}

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function normalizedPhone(value: string): string {
  const digits = value.replace(/\D/g, "");
  return digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
}

function normalizedText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function safePreviewUrl(value: string): string | null {
  try {
    const url = new URL(value, window.location.origin);
    if (url.protocol === "https:") return url.href;
    if (import.meta.env.DEV && ["http:", "blob:", "data:"].includes(url.protocol)) return url.href;
    return null;
  } catch {
    return null;
  }
}

function salesDraftFingerprint(draft: SalesDealDraft): string {
  return JSON.stringify({
    company_legal_name: normalizedText(draft.company_legal_name),
    company_dba: normalizedText(draft.company_dba),
    buyer_first_name: normalizedText(draft.buyer_first_name),
    buyer_last_name: normalizedText(draft.buyer_last_name),
    buyer_email: normalizedText(draft.buyer_email).toLowerCase(),
    buyer_phone: normalizedPhone(normalizedText(draft.buyer_phone)),
    buyer_title: normalizedText(draft.buyer_title),
    candidate_assistance_name: normalizedText(draft.candidate_assistance_name),
    candidate_assistance_email: normalizedText(draft.candidate_assistance_email).toLowerCase(),
    ghl_import_id: normalizedText(draft.ghl_import_id),
    ghl_contact_id: normalizedText(draft.ghl_contact_id),
    ghl_opportunity_id: normalizedText(draft.ghl_opportunity_id),
    sales_note: normalizedText(draft.sales_note),
    plan_key: draft.plan_key,
    billing_cadence: draft.billing_cadence,
    first_role_prepay_selected: draft.first_role_prepay_selected,
    promotion_code: normalizedText(draft.promotion_code).toUpperCase(),
  });
}

function promotionEligibilityFingerprint(draft: SalesDealDraft): string {
  return JSON.stringify({
    code: draft.promotion_code.trim().toUpperCase(),
    plan_key: draft.plan_key,
    billing_cadence: draft.billing_cadence,
    first_role_prepay_selected: draft.first_role_prepay_selected,
  });
}

function createPreviewSendKey(previewId: string): string {
  const random = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `sales-deal-create:${previewId}:${random}`;
}

function Field({ label, required, hint, children }: { label: string; required?: boolean; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-black" style={{ color: "var(--as-text)" }}>{label}{required ? <span className="ml-1 text-[#A380F6]">*</span> : null}</span>
      {children}
      {hint ? <span className="mt-1.5 block text-[11px] font-semibold leading-relaxed" style={{ color: "var(--as-text-subtle)" }}>{hint}</span> : null}
    </label>
  );
}

const fieldClass = "mt-2 h-11 w-full rounded-[10px] border bg-transparent px-3.5 text-sm font-semibold outline-none transition placeholder:opacity-45 focus:border-[#A380F6] focus:ring-4 focus:ring-[#A380F6]/10";

function StepButton({ number, label, active, complete, onClick }: { number: number; label: string; active: boolean; complete: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex min-w-0 items-center gap-2 text-left">
      <span className={`grid h-7 w-7 flex-none place-items-center rounded-[9px] text-[11px] font-black transition ${active ? "bg-[#A380F6] text-white" : complete ? "bg-emerald-500 text-white" : "bg-[#0A1547]/[0.06]"}`} style={!active && !complete ? { color: "var(--as-text-muted)" } : undefined}>
        {complete ? <Check className="h-3.5 w-3.5" /> : number}
      </span>
      <span className={`truncate text-xs font-black ${active ? "text-[#A380F6]" : ""}`} style={active ? undefined : { color: "var(--as-text-muted)" }}>{label}</span>
    </button>
  );
}

export default function SalesNewDealPage() {
  const [, setLocation] = useLocation();
  const [step, setStep] = useState(1);
  const [draft, setDraft] = useState<SalesDealDraft>(emptyDraft);
  const [ghlImport, setGhlImport] = useState<GhlSalesImport | null>(null);
  const [loadingGhlImport, setLoadingGhlImport] = useState(false);
  const [sameAssistanceContact, setSameAssistanceContact] = useState(true);
  const [packages, setPackages] = useState<SalesPackage[]>([]);
  const [loadingPackages, setLoadingPackages] = useState(true);
  const [promotion, setPromotion] = useState<PromotionCodeSummary | null>(null);
  const [promotionBusy, setPromotionBusy] = useState(false);
  const [preview, setPreview] = useState<SalesAgreementPreview | null>(null);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [sendBusy, setSendBusy] = useState(false);
  const [error, setError] = useState("");
  const draftFingerprintRef = useRef(salesDraftFingerprint(emptyDraft));
  const sendBusyRef = useRef(false);
  const sendAttemptRef = useRef<{ previewId: string; idempotencyKey: string } | null>(null);
  const promotionValidationRef = useRef(0);

  useEffect(() => {
    let active = true;
    void salesApi.getPackages()
      .then((items) => { if (active) setPackages(items.filter((item) => ["basic", "pro"].includes(item.plan_key))); })
      .catch((loadError) => { if (active) setError(loadError instanceof Error ? loadError.message : "Memberships could not be loaded."); })
      .finally(() => { if (active) setLoadingPackages(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const importId = new URLSearchParams(window.location.search).get("ghl_import")?.trim() || "";
    if (!importId) return;
    let active = true;
    setLoadingGhlImport(true);
    void salesApi.getImport(importId)
      .then((item) => {
        if (!active) return;
        if (item.status !== "ready" || item.purchase_intent_id) {
          throw new SalesApiError("This GHL opportunity is already linked or requires administrator review.", 409, "ghl_import_not_ready");
        }
        const next: SalesDealDraft = {
          ...emptyDraft,
          ghl_import_id: item.id,
          ghl_contact_id: item.ghl_contact_id,
          ghl_opportunity_id: item.ghl_opportunity_id,
          company_legal_name: item.company_name,
          buyer_first_name: item.buyer_first_name,
          buyer_last_name: item.buyer_last_name,
          buyer_email: item.buyer_email,
          buyer_phone: item.buyer_phone,
          buyer_title: item.buyer_title,
          candidate_assistance_name: `${item.buyer_first_name} ${item.buyer_last_name}`.trim(),
          candidate_assistance_email: item.buyer_email,
        };
        setGhlImport(item);
        setDraft(next);
        draftFingerprintRef.current = salesDraftFingerprint(next);
      })
      .catch((loadError) => {
        if (active) setError(loadError instanceof Error ? loadError.message : "The GHL sales draft could not be loaded.");
      })
      .finally(() => { if (active) setLoadingGhlImport(false); });
    return () => { active = false; };
  }, []);

  const selectedPackage = packages.find((item) => item.plan_key === draft.plan_key) || null;
  const previewUrl = preview ? safePreviewUrl(preview.preview_url) : null;

  const setValue = <K extends keyof SalesDealDraft>(key: K, value: SalesDealDraft[K]) => {
    setDraft((current) => {
      const next = { ...current, [key]: value };
      draftFingerprintRef.current = salesDraftFingerprint(next);
      return next;
    });
    setPreview(null);
    sendAttemptRef.current = null;
    setError("");
    if (["promotion_code", "plan_key", "billing_cadence", "first_role_prepay_selected"].includes(String(key))) {
      promotionValidationRef.current += 1;
      setPromotionBusy(false);
      setPromotion(null);
    }
  };

  const toggleSameAssistance = (checked: boolean) => {
    setSameAssistanceContact(checked);
    setDraft((current) => {
      const next = {
        ...current,
        candidate_assistance_name: checked ? `${current.buyer_first_name} ${current.buyer_last_name}`.trim() : current.candidate_assistance_name,
        candidate_assistance_email: checked ? current.buyer_email : current.candidate_assistance_email,
      };
      draftFingerprintRef.current = salesDraftFingerprint(next);
      return next;
    });
    setPreview(null);
    sendAttemptRef.current = null;
  };

  useEffect(() => {
    if (!sameAssistanceContact) return;
    setDraft((current) => {
      const next = {
        ...current,
        candidate_assistance_name: `${current.buyer_first_name} ${current.buyer_last_name}`.trim(),
        candidate_assistance_email: current.buyer_email,
      };
      draftFingerprintRef.current = salesDraftFingerprint(next);
      return next;
    });
    setPreview(null);
    sendAttemptRef.current = null;
  }, [draft.buyer_first_name, draft.buyer_last_name, draft.buyer_email, sameAssistanceContact]);

  const validateCustomer = (): string => {
    if (!draft.company_legal_name.trim()) return "Enter the customer's legal business name.";
    if (!draft.buyer_first_name.trim() || !draft.buyer_last_name.trim()) return "Enter the buyer's first and last name.";
    if (!isEmail(draft.buyer_email)) return "Enter a valid buyer email.";
    if (!draft.buyer_phone.trim()) return "Enter the buyer's phone number.";
    if (!draft.buyer_title.trim()) return "Enter the buyer's title.";
    if (!draft.candidate_assistance_name.trim()) return "Enter the candidate-assistance contact name.";
    if (!isEmail(draft.candidate_assistance_email)) return "Enter a valid candidate-assistance email.";
    return "";
  };

  const goToStep = (next: number) => {
    if (next > 1) {
      const customerError = validateCustomer();
      if (customerError) { setError(customerError); setStep(1); return; }
    }
    if (next > 2 && draft.promotion_code.trim() && !promotion) {
      setError("Validate the promotion code or remove it before continuing.");
      setStep(2);
      return;
    }
    setError("");
    setStep(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const validatePromotion = async () => {
    const code = draft.promotion_code.trim();
    if (!code) { setPromotion(null); return; }
    const requestId = ++promotionValidationRef.current;
    const eligibilityFingerprint = promotionEligibilityFingerprint(draft);
    setPromotionBusy(true);
    setError("");
    try {
      const nextPromotion = await salesApi.validatePromotionCode(code, draft);
      if (
        requestId !== promotionValidationRef.current ||
        promotionEligibilityFingerprint(draft) !== eligibilityFingerprint
      ) return;
      setPromotion(nextPromotion);
    } catch (validationError) {
      if (requestId !== promotionValidationRef.current) return;
      setPromotion(null);
      setError(validationError instanceof Error ? validationError.message : "The promotion code could not be validated.");
    } finally {
      if (requestId === promotionValidationRef.current) setPromotionBusy(false);
    }
  };

  const requestPreview = async () => {
    if (draft.promotion_code.trim() && !promotion) {
      setError("Validate the promotion code or remove it before generating the agreement.");
      return;
    }
    setPreviewBusy(true);
    setError("");
    const sourceFingerprint = draftFingerprintRef.current;
    try {
      const nextPreview = await salesApi.previewDeal(draft);
      if (
        draftFingerprintRef.current !== sourceFingerprint ||
        salesDraftFingerprint(nextPreview.normalized_draft) !== sourceFingerprint
      ) {
        setPreview(null);
        sendAttemptRef.current = null;
        setError("The agreement terms changed while the preview was created. Review them and generate a new preview.");
        return;
      }
      setPreview(nextPreview);
      sendAttemptRef.current = null;
    } catch (previewError) {
      setError(previewError instanceof Error ? previewError.message : "The agreement preview could not be created.");
    } finally {
      setPreviewBusy(false);
    }
  };

  const sendAgreement = async () => {
    if (sendBusyRef.current) return;
    if (!preview) { setError("Preview the agreement before sending it."); return; }
    if (Date.now() >= Date.parse(preview.expires_at)) {
      setPreview(null);
      sendAttemptRef.current = null;
      setError("The agreement preview expired. Generate a new preview before sending.");
      return;
    }
    if (salesDraftFingerprint(preview.normalized_draft) !== draftFingerprintRef.current) {
      setPreview(null);
      sendAttemptRef.current = null;
      setError("The sale details no longer match the preview. Generate a new preview before sending.");
      return;
    }
    const existingAttempt = sendAttemptRef.current;
    const attempt = existingAttempt?.previewId === preview.preview_id
      ? existingAttempt
      : { previewId: preview.preview_id, idempotencyKey: createPreviewSendKey(preview.preview_id) };
    sendAttemptRef.current = attempt;
    sendBusyRef.current = true;
    setSendBusy(true);
    setError("");
    try {
      await salesApi.createDeal(preview.normalized_draft, preview.preview_id, attempt.idempotencyKey);
      sendAttemptRef.current = null;
      setLocation("/sales?sent=1");
    } catch (sendError) {
      if (sendError instanceof SalesApiError && sendError.dealId) {
        sendAttemptRef.current = null;
        setLocation(`/sales?delivery=failed&deal=${encodeURIComponent(sendError.dealId)}`);
        return;
      }
      setError(sendError instanceof SalesApiError ? sendError.message : "The agreement could not be sent.");
    } finally {
      sendBusyRef.current = false;
      setSendBusy(false);
    }
  };

  const estimate = useMemo(() => {
    if (!selectedPackage) return null;
    if (preview) {
      return {
        platform: preview.pricing.platform_fee_cents,
        firstRole: preview.pricing.first_role_prepay_cents,
        discount: preview.pricing.promotion_discount_cents,
        total: preview.pricing.initial_payment_cents,
      };
    }
    const platform = draft.billing_cadence === "annual" ? selectedPackage.platform_annual_fee_cents : selectedPackage.platform_monthly_fee_cents;
    const firstRole = draft.first_role_prepay_selected ? selectedPackage.first_role_prepay.amount_cents : 0;
    return { platform, firstRole, discount: 0, total: platform + firstRole };
  }, [draft.billing_cadence, draft.first_role_prepay_selected, preview, selectedPackage]);

  return (
    <div>
      <SalesPageHeading eyebrow="Essential & Pro" title="Create a new sale" description="Prepare the buyer's agreement, confirm the exact terms, and send it for signature. Payment and account activation stay with the buyer." />

      <div className="mb-5 grid grid-cols-[1fr_auto_1fr_auto_1fr] items-center gap-2 rounded-2xl border p-4 sm:p-5" style={{ borderColor: "var(--as-border)", backgroundColor: "var(--as-surface)" }}>
        <StepButton number={1} label="Customer" active={step === 1} complete={step > 1} onClick={() => goToStep(1)} />
        <div className="h-px bg-[#0A1547]/10" />
        <StepButton number={2} label="Membership" active={step === 2} complete={step > 2} onClick={() => goToStep(2)} />
        <div className="h-px bg-[#0A1547]/10" />
        <StepButton number={3} label="Review & send" active={step === 3} complete={false} onClick={() => goToStep(3)} />
      </div>

      {error ? <div role="alert" className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</div> : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <section className="rounded-2xl border p-5 sm:p-6" style={{ borderColor: "var(--as-border)", backgroundColor: "var(--as-surface)", boxShadow: "var(--as-shadow)" }}>
          {step === 1 ? (
            <div>
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#A380F6]/10 text-[#A380F6]"><Building2 className="h-5 w-5" /></div>
                <div><h2 className="text-lg font-black" style={{ color: "var(--as-text)" }}>Customer details</h2><p className="text-xs font-semibold" style={{ color: "var(--as-text-muted)" }}>Use the legal information that belongs in the agreement.</p></div>
              </div>
              {loadingGhlImport ? <div className="mt-5 h-20 animate-pulse rounded-xl bg-[#0A1547]/[0.045]" /> : ghlImport ? (
                <div className="mt-5 flex flex-col gap-3 rounded-xl border border-[#02ABE0]/25 bg-[#02ABE0]/[0.055] p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div><p className="text-xs font-black text-[#0A1547]">Imported from GHL · Agreement/Checkout</p><p className="mt-1 text-xs font-semibold text-[#0A1547]/60">{ghlImport.opportunity_name || ghlImport.company_name} · CRM linkage is server-controlled.</p></div>
                  <a href={ghlImport.provider_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs font-black text-[#02ABE0]">Open in GHL <ExternalLink className="h-3.5 w-3.5" /></a>
                </div>
              ) : null}
              <div className="mt-6 grid gap-5 sm:grid-cols-2">
                <Field label="Legal business name" required><input className={fieldClass} style={{ borderColor: "var(--as-border)", color: "var(--as-text)" }} value={draft.company_legal_name} onChange={(event) => setValue("company_legal_name", event.target.value)} placeholder="Company LLC" /></Field>
                <Field label="DBA or trade name"><input className={fieldClass} style={{ borderColor: "var(--as-border)", color: "var(--as-text)" }} value={draft.company_dba} onChange={(event) => setValue("company_dba", event.target.value)} placeholder="Optional" /></Field>
                <Field label="Buyer first name" required><input className={fieldClass} style={{ borderColor: "var(--as-border)", color: "var(--as-text)" }} value={draft.buyer_first_name} onChange={(event) => setValue("buyer_first_name", event.target.value)} /></Field>
                <Field label="Buyer last name" required><input className={fieldClass} style={{ borderColor: "var(--as-border)", color: "var(--as-text)" }} value={draft.buyer_last_name} onChange={(event) => setValue("buyer_last_name", event.target.value)} /></Field>
                <Field label="Buyer email" required hint="The agreement will be sent to this address."><input type="email" className={fieldClass} style={{ borderColor: "var(--as-border)", color: "var(--as-text)" }} value={draft.buyer_email} onChange={(event) => setValue("buyer_email", event.target.value)} /></Field>
                <Field label="Buyer phone" required><input type="tel" className={fieldClass} style={{ borderColor: "var(--as-border)", color: "var(--as-text)" }} value={draft.buyer_phone} onChange={(event) => setValue("buyer_phone", event.target.value)} /></Field>
                <Field label="Buyer title" required><input className={fieldClass} style={{ borderColor: "var(--as-border)", color: "var(--as-text)" }} value={draft.buyer_title} onChange={(event) => setValue("buyer_title", event.target.value)} placeholder="Owner, COO, HR Director…" /></Field>
              </div>

              <div className="my-6 h-px" style={{ backgroundColor: "var(--as-border)" }} />
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div><h3 className="text-sm font-black" style={{ color: "var(--as-text)" }}>Candidate-assistance contact</h3><p className="mt-1 text-xs font-semibold" style={{ color: "var(--as-text-muted)" }}>Who should candidates contact when they need employer-side help?</p></div>
                <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-black" style={{ color: "var(--as-text)" }}><input type="checkbox" checked={sameAssistanceContact} onChange={(event) => toggleSameAssistance(event.target.checked)} className="h-4 w-4 accent-[#A380F6]" /> Same as buyer</label>
              </div>
              {!sameAssistanceContact ? (
                <div className="mt-4 grid gap-5 sm:grid-cols-2">
                  <Field label="Contact name" required><input className={fieldClass} style={{ borderColor: "var(--as-border)", color: "var(--as-text)" }} value={draft.candidate_assistance_name} onChange={(event) => setValue("candidate_assistance_name", event.target.value)} /></Field>
                  <Field label="Contact email" required><input type="email" className={fieldClass} style={{ borderColor: "var(--as-border)", color: "var(--as-text)" }} value={draft.candidate_assistance_email} onChange={(event) => setValue("candidate_assistance_email", event.target.value)} /></Field>
                </div>
              ) : null}

              <details className="mt-6 rounded-xl border px-4 py-3" style={{ borderColor: "var(--as-border)" }}>
                <summary className="cursor-pointer text-xs font-black" style={{ color: "var(--as-text)" }}>CRM attribution and internal note</summary>
                <div className="mt-4 grid gap-5 sm:grid-cols-2">
                  <div className="sm:col-span-2 rounded-[10px] bg-[#0A1547]/[0.04] px-3.5 py-3 text-xs font-semibold" style={{ color: "var(--as-text-muted)" }}>{ghlImport ? `Linked to ${ghlImport.opportunity_name || "the imported GHL opportunity"}. Contact and opportunity identifiers cannot be edited here.` : "This sale is not linked to a GHL opportunity. Start it from a Ready from GHL card to create an immutable CRM linkage."}</div>
                  <label className="block sm:col-span-2"><span className="text-xs font-black" style={{ color: "var(--as-text)" }}>Internal note</span><textarea rows={3} value={draft.sales_note} onChange={(event) => setValue("sales_note", event.target.value)} className="mt-2 w-full rounded-[10px] border bg-transparent px-3.5 py-3 text-sm font-semibold outline-none transition focus:border-[#A380F6] focus:ring-4 focus:ring-[#A380F6]/10" style={{ borderColor: "var(--as-border)", color: "var(--as-text)" }} placeholder="Keep notes brief and non-sensitive." /></label>
                </div>
              </details>
            </div>
          ) : null}

          {step === 2 ? (
            <div>
              <div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-[#02ABE0]/10 text-[#02ABE0]"><Sparkles className="h-5 w-5" /></div><div><h2 className="text-lg font-black" style={{ color: "var(--as-text)" }}>Membership</h2><p className="text-xs font-semibold" style={{ color: "var(--as-text-muted)" }}>Terms come from alphaScreen's server-controlled package catalog.</p></div></div>
              {loadingPackages ? <div className="mt-6 h-48 animate-pulse rounded-xl bg-[#0A1547]/[0.04]" /> : (
                <div className="mt-6 grid gap-4 md:grid-cols-2">
                  {packages.map((pkg) => {
                    const selected = draft.plan_key === pkg.plan_key;
                    return <button key={pkg.plan_key} type="button" onClick={() => setValue("plan_key", pkg.plan_key)} className={`rounded-2xl border-2 p-5 text-left transition ${selected ? "border-[#A380F6] bg-[#A380F6]/[0.045] shadow-[0_12px_30px_rgba(163,128,246,0.13)]" : "hover:border-[#A380F6]/40"}`} style={!selected ? { borderColor: "var(--as-border)" } : undefined}>
                      <div className="flex items-center justify-between"><span className="text-base font-black" style={{ color: "var(--as-text)" }}>{pkg.display_name}</span>{selected ? <span className="grid h-6 w-6 place-items-center rounded-lg bg-[#A380F6] text-white"><Check className="h-3.5 w-3.5" /></span> : null}</div>
                      <p className="mt-4 text-2xl font-black" style={{ color: "var(--as-text)" }}>{formatMoney(draft.billing_cadence === "annual" ? pkg.platform_annual_fee_cents : pkg.platform_monthly_fee_cents)}<span className="text-xs font-bold" style={{ color: "var(--as-text-muted)" }}>/{draft.billing_cadence === "annual" ? "year" : "month"}</span></p>
                      <ul className="mt-4 space-y-2 text-xs font-semibold" style={{ color: "var(--as-text-muted)" }}><li>{pkg.included_interviews_per_role} interviews per role</li><li>Up to {pkg.max_interview_minutes} minutes per interview</li><li>{formatMoney(pkg.per_role_fee_cents)} per role</li></ul>
                    </button>;
                  })}
                </div>
              )}

              <div className="mt-6"><p className="text-xs font-black" style={{ color: "var(--as-text)" }}>Billing cadence</p><div className="mt-2 inline-flex rounded-[11px] border p-1" style={{ borderColor: "var(--as-border)" }}>{(["monthly", "annual"] as const).map((cadence) => <button key={cadence} type="button" onClick={() => setValue("billing_cadence", cadence)} className={`rounded-[8px] px-5 py-2 text-xs font-black capitalize transition ${draft.billing_cadence === cadence ? "bg-[#0A1547] text-white" : ""}`} style={draft.billing_cadence === cadence ? undefined : { color: "var(--as-text-muted)" }}>{cadence}{cadence === "annual" ? " · Save" : ""}</button>)}</div></div>

              {selectedPackage?.first_role_prepay.enabled ? (
                <label className={`mt-6 flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition ${draft.first_role_prepay_selected ? "border-emerald-300 bg-emerald-50/70" : ""}`} style={!draft.first_role_prepay_selected ? { borderColor: "var(--as-border)" } : undefined}>
                  <input type="checkbox" checked={draft.first_role_prepay_selected} onChange={(event) => setValue("first_role_prepay_selected", event.target.checked)} className="mt-0.5 h-4 w-4 accent-emerald-500" />
                  <Gift className="h-5 w-5 flex-none text-emerald-600" />
                  <span className="flex-1"><span className="block text-sm font-black text-emerald-900">Add first-role prepayment · {formatMoney(selectedPackage.first_role_prepay.amount_cents)}</span><span className="mt-1 block text-xs font-semibold leading-relaxed text-emerald-800/65">A fixed, server-controlled savings on the first role. The credit is created only after successful payment and activation.</span></span>
                </label>
              ) : null}

              <div className="mt-6 rounded-xl border p-4" style={{ borderColor: "var(--as-border)" }}>
                <div className="flex items-center gap-2"><Tag className="h-4 w-4 text-[#A380F6]" /><h3 className="text-sm font-black" style={{ color: "var(--as-text)" }}>Promotion code</h3><span className="text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: "var(--as-text-subtle)" }}>Optional</span></div>
                <p className="mt-1 text-xs font-semibold leading-relaxed" style={{ color: "var(--as-text-muted)" }}>Use only a code created by an administrator. Need a new code? Request it through Slack.</p>
                <div className="mt-3 flex gap-2"><input aria-label="Promotion code" value={draft.promotion_code} onChange={(event) => setValue("promotion_code", event.target.value.toUpperCase())} className="h-10 min-w-0 flex-1 rounded-[9px] border bg-transparent px-3 text-sm font-black uppercase tracking-[0.08em] outline-none focus:border-[#A380F6] focus:ring-4 focus:ring-[#A380F6]/10" style={{ borderColor: "var(--as-border)", color: "var(--as-text)" }} placeholder={salesUsesMockApi ? "Try DEMO10" : "Enter code"} /><button type="button" onClick={() => void validatePromotion()} disabled={promotionBusy || !draft.promotion_code.trim()} className="rounded-[9px] bg-[#0A1547] px-4 text-xs font-black text-white disabled:opacity-45">{promotionBusy ? "Checking…" : "Validate"}</button></div>
                {promotion ? <div className="mt-3 flex items-center gap-2 rounded-[9px] bg-emerald-50 px-3 py-2.5 text-xs font-bold text-emerald-800"><BadgeCheck className="h-4 w-4" /> {promotion.label}</div> : null}
              </div>
            </div>
          ) : null}

          {step === 3 ? (
            <div>
              <div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-50 text-emerald-600"><ShieldCheck className="h-5 w-5" /></div><div><h2 className="text-lg font-black" style={{ color: "var(--as-text)" }}>Review and send</h2><p className="text-xs font-semibold" style={{ color: "var(--as-text-muted)" }}>Confirm the buyer, terms, and initial payment before sending.</p></div></div>
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <div className="rounded-xl border p-4" style={{ borderColor: "var(--as-border)" }}><div className="flex items-center gap-2"><UserRound className="h-4 w-4 text-[#A380F6]" /><h3 className="text-xs font-black uppercase tracking-[0.12em]" style={{ color: "var(--as-text-muted)" }}>Buyer</h3></div><p className="mt-3 text-sm font-black" style={{ color: "var(--as-text)" }}>{draft.buyer_first_name} {draft.buyer_last_name}</p><p className="mt-1 text-xs font-semibold" style={{ color: "var(--as-text-muted)" }}>{draft.company_legal_name}</p><p className="mt-1 text-xs font-semibold" style={{ color: "var(--as-text-muted)" }}>{draft.buyer_email}</p></div>
                <div className="rounded-xl border p-4" style={{ borderColor: "var(--as-border)" }}><div className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-[#02ABE0]" /><h3 className="text-xs font-black uppercase tracking-[0.12em]" style={{ color: "var(--as-text-muted)" }}>Membership</h3></div><p className="mt-3 text-sm font-black" style={{ color: "var(--as-text)" }}>{selectedPackage?.display_name} · <span className="capitalize">{draft.billing_cadence}</span></p><p className="mt-1 text-xs font-semibold" style={{ color: "var(--as-text-muted)" }}>{selectedPackage ? `${formatMoney(selectedPackage.per_role_fee_cents)} per role` : ""}</p><p className="mt-1 text-xs font-semibold" style={{ color: "var(--as-text-muted)" }}>{draft.first_role_prepay_selected ? "First-role prepayment included" : "First role billed when opened"}</p></div>
              </div>

              <div className="mt-4 rounded-xl border border-[#02ABE0]/20 bg-[#02ABE0]/[0.055] p-4"><div className="flex gap-3"><Info className="mt-0.5 h-4 w-4 flex-none text-[#02ABE0]" /><div><h3 className="text-sm font-black text-[#0A1547]">Agreement dates are fixed when you preview</h3><p className="mt-1 text-xs font-semibold leading-relaxed text-[#0A1547]/55">The preview and signable agreement show the actual membership start and renewal dates. The buyer must sign and pay by the end of that day; after expiration, Resend agreement creates a newly dated agreement that must be signed again.</p>{preview ? <p className="mt-2 text-xs font-black text-[#0A1547]">Start: {formatAgreementDate(preview.agreement_effective_date)} · Renewal: {formatAgreementDate(preview.agreement_renewal_date)}</p> : null}</div></div></div>

              <div className="mt-5 rounded-xl border p-4 sm:p-5" style={{ borderColor: "var(--as-border)", backgroundColor: "var(--as-surface-muted)" }}>
                <div className="flex items-center justify-between"><div><h3 className="text-sm font-black" style={{ color: "var(--as-text)" }}>Agreement preview</h3><p className="mt-1 text-xs font-semibold" style={{ color: "var(--as-text-muted)" }}>Preview must match the normalized terms used when sending.</p></div>{preview ? <CheckCircle2 className="h-5 w-5 text-emerald-500" /> : <FileSearch className="h-5 w-5 text-[#A380F6]" />}</div>
                {preview ? <div className="mt-4 flex flex-col gap-3 rounded-[10px] border border-emerald-200 bg-emerald-50 p-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-black text-emerald-900">Preview ready</p><p className="mt-1 text-[11px] font-semibold text-emerald-800/70">Preview link expires {new Date(preview.expires_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</p></div>{previewUrl ? <a href={previewUrl} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 rounded-[8px] border border-emerald-300 bg-white px-3 py-2 text-xs font-black text-emerald-800"><FileSearch className="h-3.5 w-3.5" /> Open preview</a> : <span className="text-xs font-bold text-red-700">Preview link unavailable</span>}</div> : null}
                <button type="button" onClick={() => void requestPreview()} disabled={previewBusy} className="mt-4 inline-flex h-10 items-center justify-center gap-2 rounded-[9px] border px-4 text-xs font-black transition hover:border-[#A380F6] hover:text-[#A380F6] disabled:opacity-50" style={{ borderColor: "var(--as-border)", color: "var(--as-text)" }}>{previewBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSearch className="h-4 w-4" />}{preview ? "Refresh preview" : "Generate preview"}</button>
              </div>
            </div>
          ) : null}

          <div className="mt-7 flex items-center justify-between border-t pt-5" style={{ borderColor: "var(--as-border)" }}>
            <button type="button" onClick={() => step === 1 ? setLocation("/sales") : goToStep(step - 1)} className="inline-flex h-10 items-center gap-2 rounded-[9px] px-3 text-xs font-black" style={{ color: "var(--as-text-muted)" }}><ArrowLeft className="h-4 w-4" /> {step === 1 ? "Back to deals" : "Back"}</button>
            {step < 3 ? <button type="button" onClick={() => goToStep(step + 1)} className="inline-flex h-10 items-center gap-2 rounded-[9px] bg-[#0A1547] px-4 text-xs font-black text-white">Continue <ArrowRight className="h-4 w-4" /></button> : <button type="button" onClick={() => void sendAgreement()} disabled={!preview || sendBusy} className="inline-flex h-11 items-center gap-2 rounded-[10px] bg-[#A380F6] px-5 text-sm font-black text-white shadow-[0_10px_24px_rgba(163,128,246,0.24)] disabled:cursor-not-allowed disabled:opacity-45">{sendBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}{sendBusy ? "Sending…" : "Send agreement"}</button>}
          </div>
        </section>

        <aside className="h-fit rounded-2xl border p-5 xl:sticky xl:top-[94px]" style={{ borderColor: "var(--as-border)", backgroundColor: "var(--as-surface)", boxShadow: "var(--as-shadow)" }}>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#A380F6]">Sale summary</p>
          <h2 className="mt-2 text-lg font-black" style={{ color: "var(--as-text)" }}>{selectedPackage?.display_name || "Select a membership"}</h2>
          <p className="mt-1 text-xs font-semibold capitalize" style={{ color: "var(--as-text-muted)" }}>{draft.billing_cadence} membership</p>
          <div className="my-5 h-px" style={{ backgroundColor: "var(--as-border)" }} />
          <div className="space-y-3 text-xs font-semibold">
            <div className="flex justify-between gap-4"><span style={{ color: "var(--as-text-muted)" }}>Platform fee</span><span className="font-black" style={{ color: "var(--as-text)" }}>{estimate ? formatMoney(estimate.platform) : "—"}</span></div>
            {estimate?.firstRole ? <div className="flex justify-between gap-4"><span style={{ color: "var(--as-text-muted)" }}>First-role prepay</span><span className="font-black" style={{ color: "var(--as-text)" }}>{formatMoney(estimate.firstRole)}</span></div> : null}
            {estimate?.discount ? <div className="flex justify-between gap-4 text-emerald-700"><span>Promotion</span><span className="font-black">−{formatMoney(estimate.discount)}</span></div> : promotion ? <div className="flex justify-between gap-4 text-emerald-700"><span>Promotion</span><span className="font-black">Applied in preview</span></div> : null}
          </div>
          <div className="my-4 h-px" style={{ backgroundColor: "var(--as-border)" }} />
          <div className="flex items-end justify-between gap-4"><div><p className="text-xs font-bold" style={{ color: "var(--as-text-muted)" }}>Expected initial payment</p><p className="mt-1 text-[10px] font-semibold" style={{ color: "var(--as-text-subtle)" }}>Confirmed by Stripe at checkout</p></div><p className="text-xl font-black" style={{ color: "var(--as-text)" }}>{estimate ? formatMoney(estimate.total) : "—"}</p></div>
          <div className="mt-5 rounded-[10px] bg-[#0A1547]/[0.045] p-3 text-[11px] font-semibold leading-relaxed" style={{ color: "var(--as-text-muted)" }}><ShieldCheck className="mr-1.5 inline h-3.5 w-3.5 text-[#A380F6]" />The buyer signs and enters payment details. Reps never handle card information or mark a sale won.</div>
        </aside>
      </div>
    </div>
  );
}
