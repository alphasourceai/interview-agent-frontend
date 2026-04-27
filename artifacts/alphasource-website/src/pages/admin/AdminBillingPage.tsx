import { useCallback, useEffect, useMemo, useState } from "react";
import { Trash2, Plus, ChevronDown, RefreshCw, X } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import AdminLayout from "@/components/AdminLayout";
import { useAdminClient } from "@/context/AdminClientContext";
import { supabase } from "@/lib/supabaseClient";

/* ── Types ───────────────────────────────────────────────────── */
interface LineItem {
  id:          number;
  description: string;
  qty:         number;
  unit:        string;
}

interface Invoice {
  id:        string;
  customerId: string;
  createdAt: string;
  created:   string;
  customer:  string;
  email:     string;
  title:     string;
  amount:    string;
  amountCents: number;
  status:    "open" | "paid" | "void";
  hostedInvoiceUrl: string;
}

interface BillingCustomer {
  id: string;
  clientId: string;
  name: string;
  primaryContactName: string;
  primaryContactEmail: string;
}

interface StoredClientRow {
  id: string;
  name: string;
  email: string;
  clientAdminName: string;
}

interface ExistingAgreementSummary {
  id: string;
  membership_tier: string;
  initial_term_start: string;
  initial_renewal_date: string;
  signed_at: string;
}

interface PendingAgreement {
  id: string;
  client_id: string;
  status: string;
  checkout_status: string;
  client_legal_name: string;
  admin_email: string;
  sent_at: string;
  opened_at: string;
  signed_at: string;
  checkout_created_at: string;
  checkout_session_id: string;
  is_current: boolean;
  voided_at: string;
  voided_by_email: string;
  void_reason: string;
}

interface AgreementFormValues {
  clientLegalName: string;
  dbaTradeName: string;
  primaryAdmin: string;
  adminEmail: string;
  candidateAssistanceContact: string;
  membershipTier: "basic" | "pro" | "enterprise";
  platformFee: string;
  perRoleFee: string;
  additionalInterviewFee: string;
  includedInterviewsPerRole: string;
  initialTermStart: string;
  initialRenewalDate: string;
  billingOption: "monthly" | "annual";
  autoRenew: "yes" | "no";
  noticeDeadlineDays: string;
}

type AgreementClientMode = "attach_existing_client" | "add_new_client";
type InvoiceTrendSeriesKey = "total" | "paid" | "open" | "void";
type AgreementFieldErrorKey =
  | "attachedClientId"
  | "clientLegalName"
  | "primaryAdmin"
  | "adminEmail"
  | "candidateAssistanceContact"
  | "platformFee"
  | "perRoleFee"
  | "additionalInterviewFee"
  | "includedInterviewsPerRole"
  | "initialTermStart"
  | "initialRenewalDate";
type AgreementFieldErrors = Partial<Record<AgreementFieldErrorKey, string>>;

interface InvoiceTrendPoint {
  monthKey: string;
  monthLabel: string;
  total: number;
  paid: number;
  open: number;
  void: number;
  invoices: number;
}

const env =
  typeof import.meta !== "undefined" && import.meta.env ? import.meta.env : {};

function trimTrailingSlashes(value: unknown): string {
  return String(value || "").trim().replace(/\/+$/, "");
}

function firstBase(...values: unknown[]): string {
  for (const value of values) {
    const normalized = trimTrailingSlashes(value);
    if (normalized) return normalized;
  }
  return "";
}

const backendBase = firstBase(
  (env as Record<string, unknown>).VITE_BACKEND_URL,
  (env as Record<string, unknown>).VITE_API_URL,
  (env as Record<string, unknown>).VITE_PUBLIC_BACKEND_URL,
  (env as Record<string, unknown>).PUBLIC_BACKEND_URL,
  (env as Record<string, unknown>).BACKEND_URL,
);

function parseJsonSafe(text: string): unknown {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function extractErrorMessage(text: string): string {
  if (!text) return "Failed to load billing data.";
  const data = parseJsonSafe(text);
  const detail =
    data && typeof data === "object"
      ? (data as { detail?: unknown }).detail ??
        (data as { message?: unknown }).message ??
        (data as { error?: unknown }).error
      : null;
  if (typeof detail === "string" && detail.trim()) return detail;
  return text;
}

function parseAgreementReplacementResponse(
  text: string,
): { required: true; agreement: ExistingAgreementSummary | null } | { required: false } {
  const parsed = parseJsonSafe(text);
  if (!parsed || typeof parsed !== "object") return { required: false };
  const code = String((parsed as { code?: unknown }).code || "").trim();
  if (code !== "agreement_replacement_confirmation_required") return { required: false };
  const existingRaw = (parsed as { existing_agreement?: unknown }).existing_agreement;
  if (!existingRaw || typeof existingRaw !== "object") return { required: true, agreement: null };
  const existing = existingRaw as Record<string, unknown>;
  return {
    required: true,
    agreement: {
      id: String(existing.id || "").trim(),
      membership_tier: String(existing.membership_tier || "").trim(),
      initial_term_start: String(existing.initial_term_start || "").trim(),
      initial_renewal_date: String(existing.initial_renewal_date || "").trim(),
      signed_at: String(existing.signed_at || "").trim(),
    },
  };
}

function parseAgreementOpenResponse(text: string): { open: true; id: string; status: string } | { open: false } {
  const parsed = parseJsonSafe(text);
  if (!parsed || typeof parsed !== "object") return { open: false };
  const code = String((parsed as { code?: unknown }).code || "").trim();
  if (code !== "agreement_already_open") return { open: false };
  return {
    open: true,
    id: String((parsed as { open_agreement_id?: unknown }).open_agreement_id || "").trim(),
    status: String((parsed as { open_agreement_status?: unknown }).open_agreement_status || "pending").trim(),
  };
}

function mapPendingAgreement(raw: Record<string, unknown>): PendingAgreement {
  return {
    id: String(raw.id || "").trim(),
    client_id: String(raw.client_id || "").trim(),
    status: String(raw.status || "").trim(),
    checkout_status: String(raw.checkout_status || "").trim(),
    client_legal_name: String(raw.client_legal_name || "").trim(),
    admin_email: String(raw.admin_email || "").trim(),
    sent_at: String(raw.sent_at || "").trim(),
    opened_at: String(raw.opened_at || "").trim(),
    signed_at: String(raw.signed_at || "").trim(),
    checkout_created_at: String(raw.checkout_created_at || "").trim(),
    checkout_session_id: String(raw.checkout_session_id || "").trim(),
    is_current: Boolean(raw.is_current),
    voided_at: String(raw.voided_at || "").trim(),
    voided_by_email: String(raw.voided_by_email || "").trim(),
    void_reason: String(raw.void_reason || "").trim(),
  };
}

function normalizeInvoiceStatus(value: unknown): "open" | "paid" | "void" {
  const status = String(value || "").trim().toLowerCase();
  if (status === "paid") return "paid";
  if (status === "void" || status === "uncollectible") return "void";
  return "open";
}

function formatDateTime(value: unknown): string {
  const raw = String(value || "").trim();
  if (!raw) return "—";
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleString();
}

function formatAmountFromCents(cents: unknown, currency: unknown): string {
  const amount = Number(cents);
  if (!Number.isFinite(amount)) return "$0.00";
  const code = String(currency || "usd").trim().toUpperCase() || "USD";
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: code }).format(amount / 100);
  } catch {
    return `$${(amount / 100).toFixed(2)}`;
  }
}

/* ── Helpers ─────────────────────────────────────────────────── */
const inputCls =
  "w-full px-3 py-2.5 rounded-xl text-sm text-[#0A1547] font-medium bg-white " +
  "border border-[rgba(10,21,71,0.10)] placeholder:text-[#0A1547]/25 " +
  "focus:outline-none focus:border-[#A380F6] transition-colors";

const selectCls = inputCls + " appearance-none cursor-pointer pr-8";
const fieldLabelCls = "px-1 text-[10px] font-black uppercase tracking-widest text-[#0A1547]/40";
const fieldErrorCls = "px-1 text-[11px] font-semibold text-red-500";
const REQUIRED_MARK = " *";
const AGREEMENT_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

let _lineId = 10;

function toLocalIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function todayIsoDate(): string {
  return toLocalIsoDate(new Date());
}

function addOneYearIsoDate(isoDate: string): string {
  const match = String(isoDate || "").trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return "";
  const parsed = new Date(Number(match[1]) + 1, Number(match[2]) - 1, Number(match[3]));
  if (Number.isNaN(parsed.getTime())) return "";
  return toLocalIsoDate(parsed);
}

function isoToAgreementDateInput(isoDate: string): string {
  const match = String(isoDate || "").trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return "";
  return `${match[2]}/${match[3]}/${match[1]}`;
}

function formatAgreementDateInput(value: string): string {
  const raw = String(value || "").trim();
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 8) return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4, 8)}`;
  return raw;
}

function parseAgreementDateInput(value: string): string {
  const match = String(value || "").trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return "";
  const month = Number(match[1]);
  const day = Number(match[2]);
  const year = Number(match[3]);
  if (!Number.isInteger(month) || month < 1 || month > 12) return "";
  if (!Number.isInteger(day) || day < 1 || day > 31) return "";
  if (!Number.isInteger(year) || year < 1900 || year > 9999) return "";
  const parsed = new Date(year, month - 1, day);
  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return "";
  }
  return toLocalIsoDate(parsed);
}

function defaultAgreementDates() {
  const initialTermStart = todayIsoDate();
  return {
    initialTermStart,
    initialRenewalDate: addOneYearIsoDate(initialTermStart),
  };
}

function defaultAgreementFormValues(): AgreementFormValues {
  const agreementDates = defaultAgreementDates();
  return {
    clientLegalName: "",
    dbaTradeName: "",
    primaryAdmin: "",
    adminEmail: "",
    candidateAssistanceContact: "",
    membershipTier: "basic",
    platformFee: "",
    perRoleFee: "",
    additionalInterviewFee: "",
    includedInterviewsPerRole: "",
    initialTermStart: agreementDates.initialTermStart,
    initialRenewalDate: agreementDates.initialRenewalDate,
    billingOption: "monthly",
    autoRenew: "yes",
    noticeDeadlineDays: "30",
  };
}

/* ── Component ───────────────────────────────────────────────── */
export default function AdminBillingPage() {
  const {
    clients: adminClients,
    selectedClient,
    selectedClientId,
    loading: adminClientsLoading,
    error: adminClientsError,
  } = useAdminClient();
  const [billingCustomers, setBillingCustomers] = useState<BillingCustomer[]>([]);
  const [storedClientsById, setStoredClientsById] = useState<Record<string, StoredClientRow>>({});
  const [invoiceHistory, setInvoiceHistory] = useState<Invoice[]>([]);
  const [billingLoading, setBillingLoading] = useState<boolean>(false);
  const [billingError, setBillingError] = useState<string>("");
  const [refreshNonce, setRefreshNonce] = useState(0);

  /* Send invoice */
  const [invCustomer, setInvCustomer]       = useState("");
  const [invTitle, setInvTitle]             = useState("");
  const [invDesc, setInvDesc]               = useState("");
  const [invDays, setInvDays]               = useState("7");
  const [invoiceSendBusy, setInvoiceSendBusy] = useState(false);
  const [invoiceSendError, setInvoiceSendError] = useState("");
  const [invoiceSendSuccess, setInvoiceSendSuccess] = useState("");
  const [invoiceTrendVisible, setInvoiceTrendVisible] = useState<Record<InvoiceTrendSeriesKey, boolean>>({
    total: true,
    paid: true,
    open: true,
    void: false,
  });
  const [lineItems, setLineItems]           = useState<LineItem[]>([
    { id: 1, description: "", qty: 1, unit: "" },
  ]);

  /* Agreement generator */
  const [agreementClientMode, setAgreementClientMode] = useState<AgreementClientMode>("attach_existing_client");
  const [agreementAttachedClientId, setAgreementAttachedClientId] = useState("");
  const [agreementForm, setAgreementForm] = useState<AgreementFormValues>(defaultAgreementFormValues);
  const [agreementFieldErrors, setAgreementFieldErrors] = useState<AgreementFieldErrors>({});
  const [agreementError, setAgreementError] = useState("");
  const [agreementSuccess, setAgreementSuccess] = useState("");
  const [agreementPreviewBusy, setAgreementPreviewBusy] = useState(false);
  const [agreementSendBusy, setAgreementSendBusy] = useState(false);
  const [agreementPreviewOpen, setAgreementPreviewOpen] = useState(false);
  const [agreementPreviewPdfUrl, setAgreementPreviewPdfUrl] = useState("");
  const [agreementReplacementModalOpen, setAgreementReplacementModalOpen] = useState(false);
  const [agreementReplacementDetails, setAgreementReplacementDetails] = useState<ExistingAgreementSummary | null>(null);
  const [agreementReplacementPendingAction, setAgreementReplacementPendingAction] = useState<"preview" | "send" | null>(null);
  const [agreementDateInputs, setAgreementDateInputs] = useState(() => ({
    initialTermStart: isoToAgreementDateInput(defaultAgreementFormValues().initialTermStart),
    initialRenewalDate: isoToAgreementDateInput(defaultAgreementFormValues().initialRenewalDate),
  }));
  const [pendingAgreements, setPendingAgreements] = useState<PendingAgreement[]>([]);
  const [pendingAgreementLoading, setPendingAgreementLoading] = useState(false);
  const [pendingAgreementError, setPendingAgreementError] = useState("");
  const [voidingAgreement, setVoidingAgreement] = useState(false);
  const [voidAgreementModalOpen, setVoidAgreementModalOpen] = useState(false);
  const [voidAgreementTarget, setVoidAgreementTarget] = useState<PendingAgreement | null>(null);
  const [voidAgreementReason, setVoidAgreementReason] = useState("");

  const agreementClientOptions = useMemo(
    () => adminClients.filter((client) => client.id !== "all"),
    [adminClients],
  );
  const scopedAgreementClientId =
    selectedClientId === "all" ? agreementAttachedClientId : selectedClientId;

  const addLineItem = () =>
    setLineItems((prev) => [...prev, { id: _lineId++, description: "", qty: 1, unit: "" }]);

  const removeLineItem = (id: number) =>
    setLineItems((prev) => prev.filter((li) => li.id !== id));

  const updateLineItem = (id: number, field: keyof LineItem, value: string | number) =>
    setLineItems((prev) => prev.map((li) => (li.id === id ? { ...li, [field]: value } : li)));

  const filledItems   = lineItems.filter((li) => li.description.trim() && li.unit.trim());
  const canSendInvoice = invCustomer && invTitle.trim() && filledItems.length > 0;

  const updateAgreementField = <K extends keyof AgreementFormValues>(
    key: K,
    value: AgreementFormValues[K],
  ) => {
    setAgreementForm((prev) => ({ ...prev, [key]: value }));
    const errorKeyByField: Partial<Record<keyof AgreementFormValues, AgreementFieldErrorKey>> = {
      clientLegalName: "clientLegalName",
      primaryAdmin: "primaryAdmin",
      adminEmail: "adminEmail",
      candidateAssistanceContact: "candidateAssistanceContact",
      platformFee: "platformFee",
      perRoleFee: "perRoleFee",
      additionalInterviewFee: "additionalInterviewFee",
      includedInterviewsPerRole: "includedInterviewsPerRole",
      initialTermStart: "initialTermStart",
      initialRenewalDate: "initialRenewalDate",
    };
    const errorKey = errorKeyByField[key];
    if (errorKey) {
      setAgreementFieldErrors((prev) => {
        if (!prev[errorKey]) return prev;
        const next = { ...prev };
        delete next[errorKey];
        return next;
      });
    }
  };

  const clearAgreementDateErrors = (...keys: AgreementFieldErrorKey[]) => {
    setAgreementFieldErrors((prev) => {
      const next = { ...prev };
      keys.forEach((key) => {
        delete next[key];
      });
      return next;
    });
  };

  const updateAgreementDateInput = (
    field: "initialTermStart" | "initialRenewalDate",
    rawValue: string,
  ) => {
    const display = formatAgreementDateInput(rawValue);
    const iso = parseAgreementDateInput(display);

    if (field === "initialTermStart") {
      if (iso) {
        const renewalIso = addOneYearIsoDate(iso);
        setAgreementDateInputs({
          initialTermStart: display,
          initialRenewalDate: isoToAgreementDateInput(renewalIso),
        });
        setAgreementForm((prev) => ({
          ...prev,
          initialTermStart: iso,
          initialRenewalDate: renewalIso,
        }));
        clearAgreementDateErrors("initialTermStart", "initialRenewalDate");
        return;
      }
      setAgreementDateInputs((prev) => ({ ...prev, initialTermStart: display }));
      updateAgreementField("initialTermStart", "");
      return;
    }

    setAgreementDateInputs((prev) => ({ ...prev, initialRenewalDate: display }));
    updateAgreementField("initialRenewalDate", iso);
  };

  useEffect(() => {
    if (selectedClientId !== "all") {
      setAgreementAttachedClientId(selectedClientId);
      return;
    }
    setAgreementAttachedClientId((previous) => {
      if (!previous) return "";
      if (agreementClientOptions.some((client) => client.id === previous)) return previous;
      return "";
    });
  }, [selectedClientId, agreementClientOptions]);

  useEffect(() => {
    if (agreementClientMode !== "attach_existing_client") return;
    const clientId = String(scopedAgreementClientId || "").trim();
    if (!clientId) return;

    const matchedStoredClient = storedClientsById[clientId] || null;
    const matchedOption = agreementClientOptions.find((client) => client.id === clientId);
    const matchedCustomer = billingCustomers.find((customer) => customer.clientId === clientId);

    setAgreementForm((previous) => ({
      ...previous,
      clientLegalName: String(
        matchedStoredClient?.name || matchedCustomer?.name || matchedOption?.name || "",
      ).trim(),
      primaryAdmin: String(
        matchedStoredClient?.clientAdminName || matchedCustomer?.primaryContactName || "",
      ).trim(),
      adminEmail: String(
        matchedStoredClient?.email || matchedCustomer?.primaryContactEmail || "",
      ).trim(),
    }));

    setAgreementFieldErrors((prev) => {
      const next = { ...prev };
      delete next.attachedClientId;
      if (matchedStoredClient?.name || matchedCustomer?.name || matchedOption?.name) delete next.clientLegalName;
      if (matchedStoredClient?.clientAdminName || matchedCustomer?.primaryContactName) delete next.primaryAdmin;
      if (matchedStoredClient?.email || matchedCustomer?.primaryContactEmail) delete next.adminEmail;
      return next;
    });
  }, [agreementClientMode, scopedAgreementClientId, agreementClientOptions, billingCustomers, storedClientsById]);

  useEffect(() => {
    if (agreementClientMode === "add_new_client") {
      setAgreementAttachedClientId("");
      setAgreementForm((prev) => ({
        ...prev,
        clientLegalName: "",
        dbaTradeName: "",
        primaryAdmin: "",
        adminEmail: "",
      }));
    }
    setAgreementFieldErrors((prev) => {
      const next = { ...prev };
      if (agreementClientMode === "attach_existing_client") delete next.candidateAssistanceContact;
      if (agreementClientMode === "add_new_client") delete next.attachedClientId;
      return next;
    });
  }, [agreementClientMode]);

  const loadPendingAgreements = useCallback(async () => {
    const clientId = String(selectedClientId || "all").trim() || "all";
    if (!backendBase) {
      setPendingAgreements([]);
      setPendingAgreementError("Missing backend base URL configuration.");
      setPendingAgreementLoading(false);
      return;
    }

    setPendingAgreementLoading(true);
    setPendingAgreementError("");
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = String(session?.access_token || "").trim();
      if (!token) throw new Error("Missing session token.");

      const response = await fetch(
        `${backendBase}/admin/billing/agreements/pending?client_id=${encodeURIComponent(clientId)}`,
        {
          method: "GET",
          headers: { Authorization: `Bearer ${token}` },
          credentials: "omit",
        },
      );
      const text = await response.text();
      if (!response.ok) throw new Error(extractErrorMessage(text));

      const payload = parseJsonSafe(text);
      const rawItems =
        payload &&
        typeof payload === "object" &&
        Array.isArray((payload as { items?: unknown }).items)
          ? ((payload as { items: unknown[] }).items || [])
          : [];
      const fallbackRaw =
        payload &&
        typeof payload === "object" &&
        (payload as { agreement?: unknown }).agreement &&
        typeof (payload as { agreement?: unknown }).agreement === "object"
          ? [(payload as { agreement: Record<string, unknown> }).agreement]
          : [];
      const sourceItems = rawItems.length ? rawItems : fallbackRaw;
      setPendingAgreements(
        sourceItems
          .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"))
          .map(mapPendingAgreement),
      );
    } catch (error) {
      setPendingAgreements([]);
      setPendingAgreementError(error instanceof Error ? error.message : "Could not load pending agreement.");
    } finally {
      setPendingAgreementLoading(false);
    }
  }, [selectedClientId]);

  useEffect(() => {
    void loadPendingAgreements();
  }, [loadPendingAgreements, refreshNonce]);

  const buildAgreementPayload = (confirmReplaceExisting = false) => ({
    client_mode: agreementClientMode,
    attached_client_id: agreementClientMode === "attach_existing_client" ? scopedAgreementClientId || null : null,
    client_id: agreementClientMode === "attach_existing_client" ? scopedAgreementClientId || null : null,
    confirm_replace_existing:
      agreementClientMode === "attach_existing_client" ? confirmReplaceExisting : false,
    client_legal_name: agreementForm.clientLegalName.trim(),
    dba_trade_name: agreementForm.dbaTradeName.trim() || agreementForm.clientLegalName.trim(),
    primary_admin_name: agreementForm.primaryAdmin.trim(),
    admin_email: agreementForm.adminEmail.trim(),
    candidate_assistance_contact:
      agreementClientMode === "add_new_client"
        ? agreementForm.candidateAssistanceContact.trim()
        : null,
    membership_tier: agreementForm.membershipTier,
    platform_fee:
      agreementForm.membershipTier === "enterprise"
        ? agreementForm.platformFee.trim()
        : null,
    per_role_fee:
      agreementForm.membershipTier === "enterprise"
        ? agreementForm.perRoleFee.trim()
        : null,
    additional_interview_fee:
      agreementForm.membershipTier === "enterprise"
        ? agreementForm.additionalInterviewFee.trim()
        : null,
    included_interviews_per_role:
      agreementForm.membershipTier === "enterprise"
        ? agreementForm.includedInterviewsPerRole.trim()
        : null,
    initial_term_start: agreementForm.initialTermStart.trim(),
    initial_renewal_date: agreementForm.initialRenewalDate.trim(),
    billing_option: agreementForm.billingOption,
    auto_renew: agreementForm.autoRenew === "yes",
    notice_deadline_days: Number.parseInt(agreementForm.noticeDeadlineDays, 10) || 30,
  });

  const validateAgreementForm = (): boolean => {
    const errors: AgreementFieldErrors = {};
    const adminEmail = String(agreementForm.adminEmail || "").trim();
    const hasInitialTermInput = Boolean(agreementDateInputs.initialTermStart.trim());
    const hasInitialRenewalInput = Boolean(agreementDateInputs.initialRenewalDate.trim());

    if (agreementClientMode === "attach_existing_client" && !String(scopedAgreementClientId || "").trim()) {
      errors.attachedClientId = "Select an existing client.";
    }
    if (!agreementForm.clientLegalName.trim()) errors.clientLegalName = "Client legal name is required.";
    if (!agreementForm.primaryAdmin.trim()) errors.primaryAdmin = "Primary admin is required.";
    if (!adminEmail) errors.adminEmail = "Admin email is required.";
    else if (!AGREEMENT_EMAIL_RE.test(adminEmail)) errors.adminEmail = "Enter a valid admin email.";
    if (!agreementForm.initialTermStart.trim()) {
      errors.initialTermStart = hasInitialTermInput
        ? "Enter a real date in MM / DD / YYYY."
        : "Initial term start is required.";
    }
    if (!agreementForm.initialRenewalDate.trim()) {
      errors.initialRenewalDate = hasInitialRenewalInput
        ? "Enter a real date in MM / DD / YYYY."
        : "Initial renewal date is required.";
    }
    if (agreementClientMode === "add_new_client" && !agreementForm.candidateAssistanceContact.trim()) {
      errors.candidateAssistanceContact = "Candidate assistance contact is required.";
    }
    if (agreementForm.membershipTier === "enterprise") {
      const platformFee = String(agreementForm.platformFee || "").trim();
      const perRoleFee = String(agreementForm.perRoleFee || "").trim();
      const additionalInterviewFee = String(agreementForm.additionalInterviewFee || "").trim();
      const includedInterviews = String(agreementForm.includedInterviewsPerRole || "").trim();
      if (!platformFee) errors.platformFee = "Membership fee is required for enterprise tier.";
      else if (!Number.isFinite(Number(platformFee)) || Number(platformFee) < 0) {
        errors.platformFee = "Enter a valid membership fee.";
      }
      if (!perRoleFee) errors.perRoleFee = "Per-role fee is required for enterprise tier.";
      else if (!Number.isFinite(Number(perRoleFee)) || Number(perRoleFee) < 0) {
        errors.perRoleFee = "Enter a valid per-role fee.";
      }
      if (!additionalInterviewFee) {
        errors.additionalInterviewFee = "Additional interview fee is required for enterprise tier.";
      } else if (!Number.isFinite(Number(additionalInterviewFee)) || Number(additionalInterviewFee) < 0) {
        errors.additionalInterviewFee = "Enter a valid additional interview fee.";
      }
      if (!includedInterviews) {
        errors.includedInterviewsPerRole = "Included interviews is required for enterprise tier.";
      } else if (!Number.isInteger(Number(includedInterviews)) || Number(includedInterviews) < 1) {
        errors.includedInterviewsPerRole = "Enter a whole number of included interviews.";
      }
    }

    setAgreementFieldErrors(errors);
    if (Object.keys(errors).length) {
      setAgreementError("Please fix the highlighted agreement fields.");
      return false;
    }

    return true;
  };

  const closeAgreementPreview = () => {
    setAgreementPreviewOpen(false);
    if (agreementPreviewPdfUrl) {
      URL.revokeObjectURL(agreementPreviewPdfUrl);
      setAgreementPreviewPdfUrl("");
    }
  };

  const handleOpenAgreementResponse = async (text: string) => {
    const open = parseAgreementOpenResponse(text);
    if (!open.open) return false;
    setAgreementError(
      `This client already has an open ${open.status} agreement${open.id ? ` (${open.id})` : ""}. Void the pending agreement before sending a new one.`,
    );
    await loadPendingAgreements();
    return true;
  };

  const openVoidAgreementModal = (agreement: PendingAgreement) => {
    setVoidAgreementTarget(agreement);
    setVoidAgreementReason("");
    setVoidAgreementModalOpen(true);
  };

  const closeVoidAgreementModal = () => {
    if (voidingAgreement) return;
    setVoidAgreementModalOpen(false);
    setVoidAgreementTarget(null);
    setVoidAgreementReason("");
  };

  const handleConfirmVoidAgreement = async () => {
    if (!voidAgreementTarget || voidingAgreement) return;
    if (!backendBase) {
      setAgreementError("Missing backend base URL configuration.");
      return;
    }

    setVoidingAgreement(true);
    setAgreementError("");
    setAgreementSuccess("");
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = String(session?.access_token || "").trim();
      if (!token) throw new Error("Missing session token.");

      const response = await fetch(`${backendBase}/admin/billing/agreements/${encodeURIComponent(voidAgreementTarget.id)}/void`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        credentials: "omit",
        body: JSON.stringify({ void_reason: voidAgreementReason.trim() || null }),
      });
      const text = await response.text();
      if (!response.ok) throw new Error(extractErrorMessage(text));

      setAgreementSuccess("Pending agreement voided.");
      setVoidAgreementModalOpen(false);
      setVoidAgreementTarget(null);
      setVoidAgreementReason("");
      await loadPendingAgreements();
    } catch (error) {
      setAgreementError(error instanceof Error ? error.message : "Could not void pending agreement.");
    } finally {
      setVoidingAgreement(false);
    }
  };

  const handleGenerateAgreementPreview = async (confirmReplaceExisting = false) => {
    if (!backendBase) {
      setAgreementSuccess("");
      setAgreementError("Missing backend base URL configuration.");
      return;
    }

    if (!validateAgreementForm()) {
      setAgreementSuccess("");
      return;
    }

    setAgreementError("");
    setAgreementSuccess("");
    setAgreementPreviewBusy(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = String(session?.access_token || "").trim();
      if (!token) throw new Error("Missing session token.");

      const response = await fetch(`${backendBase}/admin/billing/agreements/preview-pdf`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(buildAgreementPayload(confirmReplaceExisting)),
        credentials: "omit",
      });

      if (!response.ok) {
        const text = await response.text();
        const replacement = parseAgreementReplacementResponse(text);
        if (replacement.required) {
          setAgreementReplacementDetails(replacement.agreement);
          setAgreementReplacementPendingAction("preview");
          setAgreementReplacementModalOpen(true);
          return;
        }
        if (await handleOpenAgreementResponse(text)) return;
        throw new Error(extractErrorMessage(text));
      }

      const blob = await response.blob();
      const nextUrl = URL.createObjectURL(blob);
      if (agreementPreviewPdfUrl) URL.revokeObjectURL(agreementPreviewPdfUrl);
      setAgreementPreviewPdfUrl(nextUrl);
      setAgreementPreviewOpen(true);
    } catch (error) {
      setAgreementError(error instanceof Error ? error.message : "Could not generate agreement preview.");
    } finally {
      setAgreementPreviewBusy(false);
    }
  };

  const handleSendAgreement = async (confirmReplaceExisting = false) => {
    if (!backendBase) {
      setAgreementSuccess("");
      setAgreementError("Missing backend base URL configuration.");
      return;
    }

    if (!validateAgreementForm()) {
      setAgreementSuccess("");
      return;
    }

    setAgreementSendBusy(true);
    setAgreementError("");
    setAgreementSuccess("");

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = String(session?.access_token || "").trim();
      if (!token) throw new Error("Missing session token.");

      const response = await fetch(`${backendBase}/admin/billing/agreements/send`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(buildAgreementPayload(confirmReplaceExisting)),
        credentials: "omit",
      });

      const text = await response.text();
      if (!response.ok) {
        const replacement = parseAgreementReplacementResponse(text);
        if (replacement.required) {
          setAgreementReplacementDetails(replacement.agreement);
          setAgreementReplacementPendingAction("send");
          setAgreementReplacementModalOpen(true);
          return;
        }
        if (await handleOpenAgreementResponse(text)) return;
        throw new Error(extractErrorMessage(text));
      }

      const parsed = parseJsonSafe(text);
      const agreementId =
        parsed && typeof parsed === "object"
          ? String((parsed as { agreement?: { id?: unknown } }).agreement?.id || "").trim()
          : "";
      setAgreementSuccess(
        agreementId
          ? `Agreement sent successfully (ID: ${agreementId}).`
          : "Agreement sent successfully.",
      );
      closeAgreementPreview();
      await loadPendingAgreements();
    } catch (error) {
      setAgreementError(error instanceof Error ? error.message : "Could not send agreement.");
    } finally {
      setAgreementSendBusy(false);
    }
  };

  const handleSendInvoice = async () => {
    if (!backendBase) {
      setInvoiceSendSuccess("");
      setInvoiceSendError("Missing backend base URL configuration.");
      return;
    }

    const invoiceTitle = String(invTitle || "").trim();
    const selectedClientId = String(invCustomer || "").trim();
    const invoiceItems = lineItems
      .map((li) => ({
        description: String(li.description || "").trim(),
        quantity: Number.isFinite(Number(li.qty)) && Number(li.qty) > 0 ? Number(li.qty) : 1,
        unit_amount: Number(li.unit),
      }))
      .filter((li) => li.description && Number.isFinite(li.unit_amount) && li.unit_amount > 0);

    if (!selectedClientId || !invoiceTitle || !invoiceItems.length) {
      setInvoiceSendSuccess("");
      setInvoiceSendError("Select a client, add an invoice title, and include at least one valid line item.");
      return;
    }

    setInvoiceSendBusy(true);
    setInvoiceSendError("");
    setInvoiceSendSuccess("");

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = String(session?.access_token || "").trim();
      if (!token) throw new Error("Missing session token.");

      const response = await fetch(`${backendBase}/admin/billing/invoices/send`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          client_id: selectedClientId,
          invoice_title: invoiceTitle,
          invoice_description: String(invDesc || "").trim() || null,
          days_until_due: Number.isFinite(parseInt(invDays, 10)) ? parseInt(invDays, 10) : 7,
          line_items: invoiceItems,
        }),
        credentials: "omit",
      });

      const text = await response.text();
      if (!response.ok) throw new Error(extractErrorMessage(text));

      setInvoiceSendSuccess("Invoice sent successfully.");
      setInvTitle("");
      setInvDesc("");
      setInvDays("7");
      setLineItems([{ id: _lineId++, description: "", qty: 1, unit: "" }]);
      setRefreshNonce((value) => value + 1);
    } catch (error) {
      setInvoiceSendError(error instanceof Error ? error.message : "Could not send invoice.");
    } finally {
      setInvoiceSendBusy(false);
    }
  };

  useEffect(() => {
    let alive = true;

    const loadBilling = async () => {
      if (adminClientsLoading) return;
      if (adminClientsError) {
        if (!alive) return;
        setBillingCustomers([]);
        setStoredClientsById({});
        setInvoiceHistory([]);
        setBillingError(adminClientsError);
        setBillingLoading(false);
        return;
      }
      if (!backendBase) {
        if (!alive) return;
        setBillingCustomers([]);
        setStoredClientsById({});
        setInvoiceHistory([]);
        setBillingError("Missing backend base URL configuration.");
        setBillingLoading(false);
        return;
      }

      if (!alive) return;
      setBillingLoading(true);
      setBillingError("");

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const token = String(session?.access_token || "").trim();
        if (!token) throw new Error("Missing session token.");

        const [customersResponse, invoicesResponse, clientsResponse] = await Promise.all([
          fetch(`${backendBase}/admin/billing/customers`, {
            method: "GET",
            headers: { Authorization: `Bearer ${token}` },
            credentials: "omit",
          }),
          fetch(`${backendBase}/admin/billing/invoices`, {
            method: "GET",
            headers: { Authorization: `Bearer ${token}` },
            credentials: "omit",
          }),
          fetch(`${backendBase}/admin/clients`, {
            method: "GET",
            headers: { Authorization: `Bearer ${token}` },
            credentials: "omit",
          }),
        ]);

        const [customersText, invoicesText, clientsText] = await Promise.all([
          customersResponse.text(),
          invoicesResponse.text(),
          clientsResponse.text(),
        ]);

        if (!customersResponse.ok) throw new Error(extractErrorMessage(customersText));
        if (!invoicesResponse.ok) throw new Error(extractErrorMessage(invoicesText));
        if (!clientsResponse.ok) throw new Error(extractErrorMessage(clientsText));

        const customersPayload = parseJsonSafe(customersText);
        const invoicesPayload = parseJsonSafe(invoicesText);
        const clientsPayload = parseJsonSafe(clientsText);
        const customerItems =
          customersPayload &&
          typeof customersPayload === "object" &&
          Array.isArray((customersPayload as { items?: unknown }).items)
            ? ((customersPayload as { items: unknown[] }).items || [])
            : [];
        const invoiceItems =
          invoicesPayload &&
          typeof invoicesPayload === "object" &&
          Array.isArray((invoicesPayload as { items?: unknown }).items)
            ? ((invoicesPayload as { items: unknown[] }).items || [])
            : [];
        const clientItems =
          clientsPayload &&
          typeof clientsPayload === "object" &&
          Array.isArray((clientsPayload as { items?: unknown }).items)
            ? ((clientsPayload as { items: unknown[] }).items || [])
            : [];

        const mappedCustomers = customerItems
          .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"))
          .map((item) => ({
            id: String(item.id || "").trim(),
            clientId: String(item.client_id || "").trim(),
            name: String(item.name || "").trim() || "—",
            primaryContactName: String(item.primary_contact_name || "").trim(),
            primaryContactEmail: String(item.primary_contact_email || "").trim(),
          }))
          .filter((item) => Boolean(item.id));

        const customerById = Object.fromEntries(mappedCustomers.map((customer) => [customer.id, customer]));
        const storedClients = Object.fromEntries(
          clientItems
            .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"))
            .map((item) => {
              const id = String(item.id || "").trim();
              const row: StoredClientRow = {
                id,
                name: String(item.name || "").trim(),
                email: String(item.email || "").trim(),
                clientAdminName: String(item.client_admin_name || "").trim(),
              };
              return [id, row] as const;
            })
            .filter(([id]) => Boolean(id)),
        );

        const mappedInvoices = invoiceItems
          .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"))
          .map((item, index) => {
            const customerId = String(item.billing_customer_id || "").trim();
            const customer = customerById[customerId];
            const customerName = String(item.customer_name || "").trim() || customer?.name || customerId || "—";
            const customerEmail =
              String(item.customer_email || "").trim() || customer?.primaryContactEmail || "";
            const createdAt = String(item.created_at || "").trim();
            const amountCentsRaw = Number(item.amount_total_cents);
            const amountCents = Number.isFinite(amountCentsRaw) ? amountCentsRaw : 0;
            return {
              id: String(item.id || `invoice-${index}`),
              customerId,
              createdAt,
              created: formatDateTime(createdAt),
              customer: customerName,
              email: customerEmail,
              title: String(item.title || item.invoice_title || "").trim() || "—",
              amount: formatAmountFromCents(amountCents, item.currency),
              amountCents,
              status: normalizeInvoiceStatus(item.status),
              hostedInvoiceUrl: String(item.hosted_invoice_url || "").trim(),
            };
          })
          .filter((item) => Boolean(item.id));

        if (!alive) return;
        setBillingCustomers(mappedCustomers);
        setStoredClientsById(storedClients);
        setInvoiceHistory(mappedInvoices);
      } catch (error) {
        if (!alive) return;
        setBillingCustomers([]);
        setStoredClientsById({});
        setInvoiceHistory([]);
        setBillingError(error instanceof Error ? error.message : "Failed to load billing data.");
      } finally {
        if (alive) setBillingLoading(false);
      }
    };

    void loadBilling();
    return () => {
      alive = false;
    };
  }, [selectedClientId, adminClientsLoading, adminClientsError, refreshNonce]);

  const scopedCustomers =
    selectedClientId === "all"
      ? billingCustomers
      : billingCustomers.filter((customer) => customer.clientId === selectedClientId);
  const scopedCustomerIdSet = new Set(scopedCustomers.map((customer) => customer.id));
  const filteredInvoices =
    selectedClientId === "all"
      ? invoiceHistory
      : invoiceHistory.filter((invoice) => scopedCustomerIdSet.has(invoice.customerId));
  const invoiceTrendSummary = useMemo(() => {
    return filteredInvoices.reduce(
      (acc, invoice) => {
        const cents = Number.isFinite(invoice.amountCents) ? invoice.amountCents : 0;
        acc.totalCents += cents;
        acc.count += 1;
        if (invoice.status === "paid") acc.paidCents += cents;
        if (invoice.status === "open") acc.openCents += cents;
        if (invoice.status === "void") acc.voidCents += cents;
        return acc;
      },
      { totalCents: 0, paidCents: 0, openCents: 0, voidCents: 0, count: 0 },
    );
  }, [filteredInvoices]);
  const invoiceTrendData = useMemo<InvoiceTrendPoint[]>(() => {
    const byMonth = new Map<string, InvoiceTrendPoint>();
    filteredInvoices.forEach((invoice) => {
      const parsedDate = new Date(invoice.createdAt || invoice.created);
      if (Number.isNaN(parsedDate.getTime())) return;
      const monthIndex = parsedDate.getMonth();
      const monthKey = `${parsedDate.getFullYear()}-${String(monthIndex + 1).padStart(2, "0")}`;
      const monthLabel = parsedDate.toLocaleDateString(undefined, { month: "short", year: "numeric" });
      const existing = byMonth.get(monthKey) || {
        monthKey,
        monthLabel,
        total: 0,
        paid: 0,
        open: 0,
        void: 0,
        invoices: 0,
      };
      const dollars = (Number.isFinite(invoice.amountCents) ? invoice.amountCents : 0) / 100;
      existing.total += dollars;
      existing.invoices += 1;
      if (invoice.status === "paid") existing.paid += dollars;
      else if (invoice.status === "open") existing.open += dollars;
      else if (invoice.status === "void") existing.void += dollars;
      byMonth.set(monthKey, existing);
    });
    return Array.from(byMonth.values()).sort((a, b) => a.monthKey.localeCompare(b.monthKey));
  }, [filteredInvoices]);
  const invoiceClientOptions =
    selectedClientId === "all"
      ? adminClients.filter((client) => client.id !== "all")
      : adminClients.filter((client) => client.id === selectedClientId);

  useEffect(() => {
    if (selectedClientId !== "all") {
      setInvCustomer(selectedClientId);
      return;
    }
    if (!invCustomer) return;
    if (invoiceClientOptions.some((client) => client.id === invCustomer)) return;
    setInvCustomer("");
  }, [selectedClientId, invCustomer, invoiceClientOptions]);

  useEffect(() => {
    return () => {
      if (agreementPreviewPdfUrl) URL.revokeObjectURL(agreementPreviewPdfUrl);
    };
  }, [agreementPreviewPdfUrl]);

  useEffect(() => {
    setAgreementReplacementModalOpen(false);
    setAgreementReplacementPendingAction(null);
    setAgreementReplacementDetails(null);
  }, [agreementClientMode, scopedAgreementClientId]);

  const card = "bg-white rounded-2xl mb-5 overflow-hidden";
  const cardStyle = { border: "1px solid rgba(10,21,71,0.07)", boxShadow: "0 2px 12px rgba(10,21,71,0.04)" };
  const enterpriseFeePeriod = agreementForm.billingOption === "annual" ? "per year" : "per month";

  const handleClearAgreementTextFields = () => {
    const defaults = defaultAgreementFormValues();
    if (agreementClientMode === "attach_existing_client") {
      setAgreementAttachedClientId("");
    }
    setAgreementForm((prev) => ({
      ...prev,
      clientLegalName: "",
      dbaTradeName: "",
      primaryAdmin: "",
      adminEmail: "",
      candidateAssistanceContact: "",
      platformFee: "",
      perRoleFee: "",
      additionalInterviewFee: "",
      includedInterviewsPerRole: "",
      initialTermStart: defaults.initialTermStart,
      initialRenewalDate: defaults.initialRenewalDate,
      noticeDeadlineDays: "",
    }));
    setAgreementDateInputs({
      initialTermStart: isoToAgreementDateInput(defaults.initialTermStart),
      initialRenewalDate: isoToAgreementDateInput(defaults.initialRenewalDate),
    });
    setAgreementError("");
    setAgreementSuccess("");
    setAgreementFieldErrors({});
  };

  return (
    <AdminLayout title="Billing">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-black text-[#0A1547]">Billing</h2>
        <span className="text-xs text-[#0A1547]/35 font-medium italic">
          {selectedClientId === "all" ? "Global — not scoped to selected client" : `Scoped to ${selectedClient.name}`}
        </span>
      </div>

      {/* ── Agreement Generator ───────────────────────────── */}
      <div className={card} style={cardStyle}>
        <div className="px-5 py-4 border-b border-gray-100">
          <p className="text-sm font-black text-[#0A1547]">Agreement Generator</p>
          <p className="text-[11px] text-[#0A1547]/45 mt-1">
            Generate a membership agreement draft PDF and send a tokenized signing link.
          </p>
        </div>
        <div className="px-5 py-4 space-y-3">
          {agreementError ? (
            <p className="text-xs font-semibold text-red-500">{agreementError}</p>
          ) : null}
          {agreementSuccess ? (
            <p className="text-xs font-semibold text-emerald-600">{agreementSuccess}</p>
          ) : null}
          <p className="text-[11px] font-semibold text-[#0A1547]/45 px-1">
            Fields marked<span className="text-red-500">{REQUIRED_MARK}</span> are required.
          </p>
          <div className="flex items-center justify-between gap-3">
            <div className="inline-flex rounded-full border border-[rgba(10,21,71,0.12)] bg-white p-1">
              <button
                type="button"
                onClick={() => setAgreementClientMode("attach_existing_client")}
                className="px-3 py-1.5 text-xs font-bold rounded-full transition-colors"
                style={{
                  backgroundColor: agreementClientMode === "attach_existing_client" ? "#A380F6" : "transparent",
                  color: agreementClientMode === "attach_existing_client" ? "white" : "rgba(10,21,71,0.65)",
                }}
              >
                Attach Existing Client
              </button>
              <button
                type="button"
                onClick={() => setAgreementClientMode("add_new_client")}
                className="px-3 py-1.5 text-xs font-bold rounded-full transition-colors"
                style={{
                  backgroundColor: agreementClientMode === "add_new_client" ? "#A380F6" : "transparent",
                  color: agreementClientMode === "add_new_client" ? "white" : "rgba(10,21,71,0.65)",
                }}
              >
                Add New Client
              </button>
            </div>
            <button
              type="button"
              onClick={handleClearAgreementTextFields}
              className="px-3 py-1.5 text-xs font-bold rounded-full border border-[rgba(10,21,71,0.14)] text-[#0A1547]/70 hover:bg-gray-50 transition-colors"
            >
              Clear All
            </button>
          </div>

          {agreementClientMode === "attach_existing_client" ? (
            selectedClientId === "all" ? (
              <div className="max-w-md space-y-1">
                <p className={fieldLabelCls}>
                  Attached Client<span className="text-red-500">{REQUIRED_MARK}</span>
                </p>
                <div className="relative">
                  <select
                    className={selectCls}
                    value={agreementAttachedClientId}
                    onChange={(e) => {
                      setAgreementAttachedClientId(e.target.value);
                      setAgreementFieldErrors((prev) => {
                        if (!prev.attachedClientId) return prev;
                        const next = { ...prev };
                        delete next.attachedClientId;
                        return next;
                      });
                    }}
                  >
                    <option value="">Select existing client…</option>
                    {agreementClientOptions.map((client) => (
                      <option key={client.id} value={client.id}>
                        {client.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#0A1547]/30 pointer-events-none" />
                </div>
                {agreementFieldErrors.attachedClientId ? (
                  <p className={fieldErrorCls}>{agreementFieldErrors.attachedClientId}</p>
                ) : null}
              </div>
            ) : (
              <p className="text-xs font-semibold text-[#0A1547]/55">
                Attached client: <span className="font-black text-[#0A1547]">{selectedClient.name}</span>
              </p>
            )
          ) : (
            <p className="text-xs font-semibold text-[#0A1547]/55">
              A new client will be created from this form before the agreement is sent.
            </p>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <p className={fieldLabelCls}>
                Client Legal Name<span className="text-red-500">{REQUIRED_MARK}</span>
              </p>
              <input
                className={inputCls}
                placeholder="Client Legal Name"
                value={agreementForm.clientLegalName}
                onChange={(e) => updateAgreementField("clientLegalName", e.target.value)}
              />
              {agreementFieldErrors.clientLegalName ? (
                <p className={fieldErrorCls}>{agreementFieldErrors.clientLegalName}</p>
              ) : null}
            </div>
            <div className="space-y-1">
              <p className={fieldLabelCls}>DBA / Trade Name</p>
              <input
                className={inputCls}
                placeholder="DBA / Trade Name"
                value={agreementForm.dbaTradeName}
                onChange={(e) => updateAgreementField("dbaTradeName", e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <p className={fieldLabelCls}>
                Primary Admin<span className="text-red-500">{REQUIRED_MARK}</span>
              </p>
              <input
                className={inputCls}
                placeholder="Primary Admin"
                value={agreementForm.primaryAdmin}
                onChange={(e) => updateAgreementField("primaryAdmin", e.target.value)}
              />
              {agreementFieldErrors.primaryAdmin ? (
                <p className={fieldErrorCls}>{agreementFieldErrors.primaryAdmin}</p>
              ) : null}
            </div>
            <div className="space-y-1">
              <p className={fieldLabelCls}>
                Admin Email<span className="text-red-500">{REQUIRED_MARK}</span>
              </p>
              <input
                className={inputCls}
                type="email"
                placeholder="Admin Email"
                value={agreementForm.adminEmail}
                onChange={(e) => updateAgreementField("adminEmail", e.target.value)}
              />
              {agreementFieldErrors.adminEmail ? (
                <p className={fieldErrorCls}>{agreementFieldErrors.adminEmail}</p>
              ) : null}
            </div>
            {agreementClientMode === "add_new_client" ? (
              <div className="space-y-1">
                <p className={fieldLabelCls}>
                  Candidate Assistance Contact<span className="text-red-500">{REQUIRED_MARK}</span>
                </p>
                <input
                  className={inputCls}
                  placeholder="Candidate Assistance Contact"
                  value={agreementForm.candidateAssistanceContact}
                  onChange={(e) => updateAgreementField("candidateAssistanceContact", e.target.value)}
                />
                {agreementFieldErrors.candidateAssistanceContact ? (
                  <p className={fieldErrorCls}>{agreementFieldErrors.candidateAssistanceContact}</p>
                ) : null}
              </div>
            ) : null}
            <div className="space-y-1">
              <p className={fieldLabelCls}>Membership Tier</p>
              <div className="relative">
                <select
                  className={selectCls}
                  value={agreementForm.membershipTier}
                  onChange={(e) => updateAgreementField("membershipTier", e.target.value as AgreementFormValues["membershipTier"])}
                >
                  <option value="basic">basic</option>
                  <option value="pro">pro</option>
                  <option value="enterprise">enterprise</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#0A1547]/30 pointer-events-none" />
              </div>
            </div>
            <div className="space-y-1">
              <p className={fieldLabelCls}>Billing Option</p>
              <div className="relative">
                <select
                  className={selectCls}
                  value={agreementForm.billingOption}
                  onChange={(e) => updateAgreementField("billingOption", e.target.value as AgreementFormValues["billingOption"])}
                >
                  <option value="monthly">monthly</option>
                  <option value="annual">annual</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#0A1547]/30 pointer-events-none" />
              </div>
            </div>
            <div className="space-y-1">
              <p className={fieldLabelCls}>
                Initial Term Start<span className="text-red-500">{REQUIRED_MARK}</span>
              </p>
              <input
                className={inputCls}
                inputMode="numeric"
                placeholder="MM/DD/YYYY"
                value={agreementDateInputs.initialTermStart}
                onChange={(e) => updateAgreementDateInput("initialTermStart", e.target.value)}
              />
              <p className="text-[10px] text-[#0A1547]/35 px-1">MM/DD/YYYY</p>
              {agreementFieldErrors.initialTermStart ? (
                <p className={fieldErrorCls}>{agreementFieldErrors.initialTermStart}</p>
              ) : null}
            </div>
            <div className="space-y-1">
              <p className={fieldLabelCls}>
                Initial Renewal Date<span className="text-red-500">{REQUIRED_MARK}</span>
              </p>
              <input
                className={inputCls}
                inputMode="numeric"
                placeholder="MM/DD/YYYY"
                value={agreementDateInputs.initialRenewalDate}
                onChange={(e) => updateAgreementDateInput("initialRenewalDate", e.target.value)}
              />
              <p className="text-[10px] text-[#0A1547]/35 px-1">MM/DD/YYYY</p>
              {agreementFieldErrors.initialRenewalDate ? (
                <p className={fieldErrorCls}>{agreementFieldErrors.initialRenewalDate}</p>
              ) : null}
            </div>
            <div className="space-y-1">
              <p className={fieldLabelCls}>Auto-Renew</p>
              <div className="relative">
                <select
                  className={selectCls}
                  value={agreementForm.autoRenew}
                  onChange={(e) => updateAgreementField("autoRenew", e.target.value as AgreementFormValues["autoRenew"])}
                >
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#0A1547]/30 pointer-events-none" />
              </div>
            </div>
            <div className="space-y-1">
              <p className={fieldLabelCls}>Notice Deadline (Days)</p>
              <input
                className={inputCls}
                type="number"
                min="1"
                placeholder="Notice Deadline (days)"
                value={agreementForm.noticeDeadlineDays}
                onChange={(e) => updateAgreementField("noticeDeadlineDays", e.target.value)}
              />
            </div>
          </div>
          {agreementForm.membershipTier === "enterprise" ? (
            <div className="space-y-3 pt-1">
              <p className="px-1 text-[10px] font-black uppercase tracking-widest text-[#0A1547]/45">
                Enterprise Pricing Configuration
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <p className={fieldLabelCls}>
                    Membership Fee ({enterpriseFeePeriod})<span className="text-red-500">{REQUIRED_MARK}</span>
                  </p>
                  <input
                    className={inputCls}
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={agreementForm.platformFee}
                    onChange={(e) => updateAgreementField("platformFee", e.target.value)}
                  />
                  {agreementFieldErrors.platformFee ? (
                    <p className={fieldErrorCls}>{agreementFieldErrors.platformFee}</p>
                  ) : null}
                </div>
                <div className="space-y-1">
                  <p className={fieldLabelCls}>
                    Per-Role Fee<span className="text-red-500">{REQUIRED_MARK}</span>
                  </p>
                  <input
                    className={inputCls}
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={agreementForm.perRoleFee}
                    onChange={(e) => updateAgreementField("perRoleFee", e.target.value)}
                  />
                  {agreementFieldErrors.perRoleFee ? (
                    <p className={fieldErrorCls}>{agreementFieldErrors.perRoleFee}</p>
                  ) : null}
                </div>
                <div className="space-y-1">
                  <p className={fieldLabelCls}>
                    Included Interviews (Per Role)<span className="text-red-500">{REQUIRED_MARK}</span>
                  </p>
                  <input
                    className={inputCls}
                    type="number"
                    min="1"
                    step="1"
                    placeholder="0"
                    value={agreementForm.includedInterviewsPerRole}
                    onChange={(e) => updateAgreementField("includedInterviewsPerRole", e.target.value)}
                  />
                  {agreementFieldErrors.includedInterviewsPerRole ? (
                    <p className={fieldErrorCls}>{agreementFieldErrors.includedInterviewsPerRole}</p>
                  ) : null}
                </div>
                <div className="space-y-1">
                  <p className={fieldLabelCls}>
                    Additional Interview Fee ($)<span className="text-red-500">{REQUIRED_MARK}</span>
                  </p>
                  <input
                    className={inputCls}
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={agreementForm.additionalInterviewFee}
                    onChange={(e) => updateAgreementField("additionalInterviewFee", e.target.value)}
                  />
                  {agreementFieldErrors.additionalInterviewFee ? (
                    <p className={fieldErrorCls}>{agreementFieldErrors.additionalInterviewFee}</p>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}

          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => { void handleGenerateAgreementPreview(); }}
              disabled={agreementPreviewBusy}
              className="px-6 py-2.5 rounded-full text-sm font-bold text-white transition-all"
              style={{
                backgroundColor: agreementPreviewBusy ? "rgba(10,21,71,0.2)" : "#A380F6",
                cursor: agreementPreviewBusy ? "not-allowed" : "pointer",
              }}
            >
              {agreementPreviewBusy ? "Generating..." : "Generate Agreement"}
            </button>
          </div>
        </div>
      </div>

      {/* ── Pending Agreements ───────────────────────────── */}
      <div className={card} style={cardStyle}>
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-black text-[#0A1547]">Pending Agreements</p>
            <p className="text-[11px] text-[#0A1547]/45 mt-1">
              {selectedClientId === "all" ? "Showing all clients with pending agreements." : `Showing pending agreements for ${selectedClient.name}.`}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              void loadPendingAgreements();
            }}
            disabled={pendingAgreementLoading}
            className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(10,21,71,0.12)] bg-white px-3 py-1.5 text-xs font-bold text-[#0A1547]/65 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </button>
        </div>
        <div className="px-5 py-4 space-y-3">
          {pendingAgreementError ? (
            <p className="text-xs font-semibold text-red-500">{pendingAgreementError}</p>
          ) : null}
          {pendingAgreementLoading ? (
            <p className="text-xs font-semibold text-[#0A1547]/40">Checking pending agreements...</p>
          ) : pendingAgreements.length === 0 ? (
            <p className="text-sm font-semibold text-[#0A1547]/35">No pending agreements.</p>
          ) : (
            <div className="space-y-2.5">
              {pendingAgreements.map((agreement) => (
                <div key={agreement.id} className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
                  <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(180px,1.15fr)_minmax(420px,2fr)_140px] lg:items-center">
                    <div className="min-w-0 overflow-hidden">
                      <p className="text-[10px] font-black uppercase tracking-widest text-amber-700/70">
                        {agreement.client_legal_name || "Pending Agreement"}
                      </p>
                      <p className="mt-1 text-sm font-black text-[#0A1547]">
                        {agreement.status || "pending"}
                        {agreement.checkout_status ? ` · checkout ${agreement.checkout_status}` : ""}
                      </p>
                      <p className="mt-1 text-xs font-semibold text-[#0A1547]/55">
                        {agreement.admin_email || "No admin email"}
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[10px] font-semibold text-[#0A1547]/60 sm:grid-cols-4">
                      <span className="min-w-0">
                        <span className="block font-black uppercase tracking-widest text-[#0A1547]/35">Sent</span>
                        <span className="block truncate">{formatDateTime(agreement.sent_at)}</span>
                      </span>
                      <span className="min-w-0">
                        <span className="block font-black uppercase tracking-widest text-[#0A1547]/35">Opened</span>
                        <span className="block truncate">{formatDateTime(agreement.opened_at)}</span>
                      </span>
                      <span className="min-w-0">
                        <span className="block font-black uppercase tracking-widest text-[#0A1547]/35">Signed</span>
                        <span className="block truncate">{formatDateTime(agreement.signed_at)}</span>
                      </span>
                      <span className="min-w-0">
                        <span className="block font-black uppercase tracking-widest text-[#0A1547]/35">Checkout</span>
                        <span className="block truncate">{formatDateTime(agreement.checkout_created_at)}</span>
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => openVoidAgreementModal(agreement)}
                      disabled={voidingAgreement}
                      className="w-fit whitespace-nowrap rounded-full border border-amber-300 bg-white px-4 py-2 text-xs font-bold text-amber-700 transition-colors hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60 lg:justify-self-end"
                    >
                      Void Agreement
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Send Invoice ────────────────────────────────────── */}
      <div className={card} style={cardStyle}>
        <div className="px-5 py-4 border-b border-gray-100">
          <p className="text-sm font-black text-[#0A1547]">Send Invoice</p>
        </div>
        <div className="px-5 py-4 space-y-4">
          {invoiceSendError ? (
            <p className="text-xs font-semibold text-red-500">{invoiceSendError}</p>
          ) : null}
          {invoiceSendSuccess ? (
            <p className="text-xs font-semibold text-emerald-600">{invoiceSendSuccess}</p>
          ) : null}
          {/* Row 1 */}
          <div className="grid grid-cols-2 gap-3">
            <div className="relative">
              <select
                className={selectCls}
                value={invCustomer}
                onChange={(e) => setInvCustomer(e.target.value)}
                disabled={selectedClientId !== "all"}
              >
                <option value="">{selectedClientId === "all" ? "Select client…" : "Selected client"}</option>
                {invoiceClientOptions.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#0A1547]/30 pointer-events-none" />
            </div>
            <input
              className={inputCls}
              placeholder="Invoice title"
              value={invTitle}
              onChange={(e) => setInvTitle(e.target.value)}
            />
          </div>

          {/* Row 2 */}
          <div className="grid grid-cols-2 gap-3 items-start">
            <input
              className={inputCls}
              placeholder="Invoice description (optional)"
              value={invDesc}
              onChange={(e) => setInvDesc(e.target.value)}
            />
            <div>
              <input
                type="number"
                min="1"
                className={inputCls}
                value={invDays}
                onChange={(e) => setInvDays(e.target.value)}
              />
              <p className="text-[10px] text-[#0A1547]/35 mt-1 px-1">
                Number of days the customer has to pay after the invoice is sent.
              </p>
            </div>
          </div>

          {/* Line items */}
          <div>
            <div className="grid grid-cols-[1fr_80px_120px_44px] gap-2 mb-2">
              {["Description", "Qty", "Unit ($)", "Remove"].map((h) => (
                <p key={h} className="text-[10px] font-black uppercase tracking-widest text-[#0A1547]/40 px-1">{h}</p>
              ))}
            </div>
            <div className="space-y-2">
              {lineItems.map((li) => (
                <div key={li.id} className="grid grid-cols-[1fr_80px_120px_44px] gap-2 items-center">
                  <input
                    className={inputCls}
                    placeholder="Line item description"
                    value={li.description}
                    onChange={(e) => updateLineItem(li.id, "description", e.target.value)}
                  />
                  <input
                    type="number"
                    min="1"
                    className={inputCls + " text-center"}
                    value={li.qty}
                    onChange={(e) => updateLineItem(li.id, "qty", parseInt(e.target.value) || 1)}
                  />
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className={inputCls}
                    placeholder="0.00"
                    value={li.unit}
                    onChange={(e) => updateLineItem(li.id, "unit", e.target.value)}
                  />
                  <button
                    className="flex items-center justify-center p-2 rounded-xl text-[#0A1547]/25 hover:text-red-500 hover:bg-red-50 transition-all"
                    onClick={() => removeLineItem(li.id)}
                    disabled={lineItems.length === 1}
                    style={{ opacity: lineItems.length === 1 ? 0.3 : 1 }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-1">
            <button
              className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold text-white transition-opacity hover:opacity-90"
              style={{ backgroundColor: "#A380F6" }}
              onClick={addLineItem}
            >
              <Plus className="w-3.5 h-3.5" />
              Add line item
            </button>

            <button
              disabled={!canSendInvoice || invoiceSendBusy}
              onClick={() => { void handleSendInvoice(); }}
              className="px-6 py-2.5 rounded-full text-sm font-bold text-white transition-all"
              style={{
                backgroundColor: canSendInvoice && !invoiceSendBusy ? "#A380F6" : "rgba(10,21,71,0.08)",
                color:           canSendInvoice && !invoiceSendBusy ? "white"   : "rgba(10,21,71,0.25)",
                cursor:          canSendInvoice && !invoiceSendBusy ? "pointer" : "not-allowed",
              }}
            >
              {invoiceSendBusy ? "Sending..." : "Send Invoice"}
            </button>
          </div>
        </div>
      </div>

      {/* ── Billed Revenue Trend ───────────────────────────── */}
      <div className={card} style={cardStyle}>
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <p className="text-sm font-black text-[#0A1547]">Billed Revenue Trend</p>
            <p className="text-[11px] text-[#0A1547]/45 mt-1">Invoice-based billed revenue trend (not MRR / ARR).</p>
          </div>
          <button
            onClick={() => setRefreshNonce((value) => value + 1)}
            disabled={billingLoading}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: "#A380F6" }}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${billingLoading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
        <div className="px-5 py-4 space-y-4">
          {billingLoading ? (
            <p className="text-sm text-[#0A1547]/35 font-semibold">Loading billing trend...</p>
          ) : billingError ? (
            <p className="text-sm text-red-500 font-semibold">{billingError}</p>
          ) : filteredInvoices.length === 0 ? (
            <p className="text-sm text-[#0A1547]/35 font-semibold">No invoice data is available yet.</p>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="rounded-xl border border-[rgba(10,21,71,0.08)] bg-white px-3 py-2.5">
                  <p className="text-[10px] font-black uppercase tracking-widest text-[#0A1547]/40">Total Billed</p>
                  <p className="text-base font-black text-[#0A1547] mt-1">{formatAmountFromCents(invoiceTrendSummary.totalCents, "usd")}</p>
                </div>
                <div className="rounded-xl border border-[rgba(10,21,71,0.08)] bg-white px-3 py-2.5">
                  <p className="text-[10px] font-black uppercase tracking-widest text-[#0A1547]/40">Paid Billed</p>
                  <p className="text-base font-black text-[#00886A] mt-1">{formatAmountFromCents(invoiceTrendSummary.paidCents, "usd")}</p>
                </div>
                <div className="rounded-xl border border-[rgba(10,21,71,0.08)] bg-white px-3 py-2.5">
                  <p className="text-[10px] font-black uppercase tracking-widest text-[#0A1547]/40">Open Billed</p>
                  <p className="text-base font-black text-[#C07800] mt-1">{formatAmountFromCents(invoiceTrendSummary.openCents, "usd")}</p>
                </div>
                <div className="rounded-xl border border-[rgba(10,21,71,0.08)] bg-white px-3 py-2.5">
                  <p className="text-[10px] font-black uppercase tracking-widest text-[#0A1547]/40">Invoices</p>
                  <p className="text-base font-black text-[#0A1547] mt-1">{invoiceTrendSummary.count}</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {([
                  { key: "total", label: "Total Billed", color: "#0A1547" },
                  { key: "paid", label: "Paid", color: "#02B289" },
                  { key: "open", label: "Open", color: "#F0A500" },
                  { key: "void", label: "Void", color: "#7B819B" },
                ] as const).map((series) => (
                  <button
                    key={series.key}
                    type="button"
                    onClick={() => {
                      setInvoiceTrendVisible((prev) => ({
                        ...prev,
                        [series.key]: !prev[series.key],
                      }));
                    }}
                    className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-full text-xs font-bold border transition-colors"
                    style={{
                      borderColor: invoiceTrendVisible[series.key] ? "rgba(10,21,71,0.2)" : "rgba(10,21,71,0.08)",
                      color: invoiceTrendVisible[series.key] ? "#0A1547" : "rgba(10,21,71,0.45)",
                      backgroundColor: invoiceTrendVisible[series.key] ? "rgba(10,21,71,0.04)" : "white",
                    }}
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-sm"
                      style={{ backgroundColor: series.color, opacity: invoiceTrendVisible[series.key] ? 1 : 0.35 }}
                    />
                    {series.label}
                  </button>
                ))}
              </div>

              <div className="w-full h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={invoiceTrendData} margin={{ top: 8, right: 12, left: 8, bottom: 6 }}>
                    <defs>
                      <linearGradient id="invoice-total-fill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#0A1547" stopOpacity={0.24} />
                        <stop offset="100%" stopColor="#0A1547" stopOpacity={0.02} />
                      </linearGradient>
                      <linearGradient id="invoice-paid-fill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#02B289" stopOpacity={0.22} />
                        <stop offset="100%" stopColor="#02B289" stopOpacity={0.02} />
                      </linearGradient>
                      <linearGradient id="invoice-open-fill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#F0A500" stopOpacity={0.2} />
                        <stop offset="100%" stopColor="#F0A500" stopOpacity={0.02} />
                      </linearGradient>
                      <linearGradient id="invoice-void-fill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#7B819B" stopOpacity={0.18} />
                        <stop offset="100%" stopColor="#7B819B" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(10,21,71,0.10)" />
                    <XAxis
                      dataKey="monthLabel"
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: "rgba(10,21,71,0.55)", fontSize: 11, fontWeight: 600 }}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: "rgba(10,21,71,0.45)", fontSize: 11, fontWeight: 600 }}
                      tickFormatter={(value: number) => `$${Math.round(Number(value || 0)).toLocaleString()}`}
                      width={68}
                    />
                    <Tooltip
                      contentStyle={{
                        border: "1px solid rgba(10,21,71,0.12)",
                        borderRadius: 12,
                        boxShadow: "0 12px 24px rgba(10,21,71,0.16)",
                      }}
                      formatter={(value: number, name: string) => {
                        const numeric = Number.isFinite(Number(value)) ? Number(value) : 0;
                        const labelMap: Record<string, string> = {
                          total: "Total Billed",
                          paid: "Paid",
                          open: "Open",
                          void: "Void",
                        };
                        return [formatAmountFromCents(Math.round(numeric * 100), "usd"), labelMap[name] || name];
                      }}
                    />
                    {invoiceTrendVisible.total ? (
                      <Area
                        type="monotone"
                        dataKey="total"
                        name="total"
                        stroke="#0A1547"
                        fill="url(#invoice-total-fill)"
                        strokeWidth={2.4}
                        activeDot={{ r: 5, strokeWidth: 0, fill: "#0A1547" }}
                        animationDuration={320}
                      />
                    ) : null}
                    {invoiceTrendVisible.paid ? (
                      <Area
                        type="monotone"
                        dataKey="paid"
                        name="paid"
                        stroke="#02B289"
                        fill="url(#invoice-paid-fill)"
                        strokeWidth={2}
                        activeDot={{ r: 4, strokeWidth: 0, fill: "#02B289" }}
                        animationDuration={320}
                      />
                    ) : null}
                    {invoiceTrendVisible.open ? (
                      <Area
                        type="monotone"
                        dataKey="open"
                        name="open"
                        stroke="#F0A500"
                        fill="url(#invoice-open-fill)"
                        strokeWidth={1.8}
                        activeDot={{ r: 4, strokeWidth: 0, fill: "#F0A500" }}
                        animationDuration={320}
                      />
                    ) : null}
                    {invoiceTrendVisible.void ? (
                      <Area
                        type="monotone"
                        dataKey="void"
                        name="void"
                        stroke="#7B819B"
                        fill="url(#invoice-void-fill)"
                        strokeWidth={1.8}
                        activeDot={{ r: 4, strokeWidth: 0, fill: "#7B819B" }}
                        animationDuration={320}
                      />
                    ) : null}
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </>
          )}
        </div>
      </div>

      {agreementPreviewOpen ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 sm:p-6">
          <button
            type="button"
            onClick={closeAgreementPreview}
            className="absolute inset-0 bg-[#0A1547]/45"
            aria-label="Close agreement preview"
          />
          <div
            className="relative w-full max-w-6xl max-h-[92vh] bg-white rounded-2xl overflow-hidden"
            style={{ border: "1px solid rgba(10,21,71,0.10)", boxShadow: "0 20px 44px rgba(10,21,71,0.24)" }}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-[#0A1547]/40">Agreement Preview</p>
                <h3 className="text-sm font-black text-[#0A1547] leading-snug">alphaScreen Membership Agreement (Draft)</h3>
              </div>
              <button
                type="button"
                onClick={closeAgreementPreview}
                className="w-8 h-8 rounded-lg inline-flex items-center justify-center text-[#0A1547]/40 hover:text-[#0A1547] hover:bg-gray-100 transition-colors"
                aria-label="Close agreement preview"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-5 py-4 overflow-y-auto max-h-[calc(92vh-72px)] space-y-4">
              {!agreementPreviewPdfUrl ? (
                <p className="text-xs font-semibold text-[#0A1547]/45">Preparing agreement preview…</p>
              ) : (
                <iframe
                  title="Agreement Preview PDF"
                  src={agreementPreviewPdfUrl}
                  className="w-full min-h-[72vh] rounded-xl border border-gray-200"
                />
              )}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={closeAgreementPreview}
                  className="px-4 py-2 text-xs font-bold rounded-full border border-gray-200 text-[#0A1547]/70 hover:bg-gray-50 transition-colors"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => { void handleSendAgreement(); }}
                  disabled={agreementSendBusy}
                  className="px-4 py-2 text-xs font-bold text-white rounded-full transition-colors"
                  style={{
                    backgroundColor: agreementSendBusy ? "#8F73D1" : "#A380F6",
                    cursor: agreementSendBusy ? "wait" : "pointer",
                  }}
                >
                  {agreementSendBusy ? "Sending..." : "Send Agreement"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {voidAgreementModalOpen && voidAgreementTarget ? (
        <div className="fixed inset-0 z-[84] flex items-center justify-center p-4 sm:p-6">
          <button
            type="button"
            onClick={closeVoidAgreementModal}
            className="absolute inset-0 bg-[#0A1547]/45"
            aria-label="Close void agreement confirmation"
          />
          <div
            className="relative w-full max-w-lg bg-white rounded-2xl overflow-hidden"
            style={{ border: "1px solid rgba(10,21,71,0.10)", boxShadow: "0 20px 44px rgba(10,21,71,0.24)" }}
          >
            <div className="px-5 py-4 border-b border-gray-100">
              <p className="text-[10px] font-black uppercase tracking-widest text-[#0A1547]/40">Pending Agreement</p>
              <h3 className="text-sm font-black text-[#0A1547] leading-snug mt-1">Void agreement?</h3>
            </div>
            <div className="px-5 py-4 space-y-3">
              <p className="text-sm text-[#0A1547]/75">
                This will not change Stripe subscriptions or client billing.
              </p>
              <div className="rounded-xl bg-amber-50 border border-amber-200 px-3.5 py-3">
                <p className="text-xs font-black text-[#0A1547]">{voidAgreementTarget.client_legal_name || "Pending agreement"}</p>
                <p className="mt-1 text-[11px] font-semibold text-[#0A1547]/55">
                  {voidAgreementTarget.status || "pending"}
                  {voidAgreementTarget.checkout_status ? ` · checkout ${voidAgreementTarget.checkout_status}` : ""}
                </p>
                <p className="mt-1 text-[11px] font-semibold text-[#0A1547]/55">
                  {voidAgreementTarget.admin_email || "No admin email"}
                </p>
              </div>
              <label className="block space-y-1">
                <span className={fieldLabelCls}>Void Reason (Optional)</span>
                <textarea
                  className={inputCls + " min-h-[88px] resize-none"}
                  placeholder="Reason for voiding this agreement"
                  value={voidAgreementReason}
                  onChange={(e) => setVoidAgreementReason(e.target.value)}
                />
              </label>
            </div>
            <div className="px-5 py-4 border-t border-gray-100 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeVoidAgreementModal}
                disabled={voidingAgreement}
                className="px-4 py-2 text-xs font-bold rounded-full border border-gray-200 text-[#0A1547]/70 hover:bg-gray-50 transition-colors disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  void handleConfirmVoidAgreement();
                }}
                disabled={voidingAgreement}
                className="px-4 py-2 text-xs font-bold text-white rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-60"
                style={{ backgroundColor: voidingAgreement ? "#8F73D1" : "#A380F6" }}
              >
                {voidingAgreement ? "Voiding..." : "Void Agreement"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {agreementReplacementModalOpen ? (
        <div className="fixed inset-0 z-[85] flex items-center justify-center p-4 sm:p-6">
          <button
            type="button"
            onClick={() => {
              setAgreementReplacementModalOpen(false);
              setAgreementReplacementPendingAction(null);
              setAgreementReplacementDetails(null);
            }}
            className="absolute inset-0 bg-[#0A1547]/45"
            aria-label="Close replacement confirmation"
          />
          <div
            className="relative w-full max-w-xl bg-white rounded-2xl overflow-hidden"
            style={{ border: "1px solid rgba(10,21,71,0.10)", boxShadow: "0 20px 44px rgba(10,21,71,0.24)" }}
          >
            <div className="px-5 py-4 border-b border-gray-100">
              <p className="text-[10px] font-black uppercase tracking-widest text-[#0A1547]/40">Confirm Replacement</p>
              <h3 className="text-sm font-black text-[#0A1547] leading-snug mt-1">Existing Agreement Found</h3>
            </div>
            <div className="px-5 py-4 space-y-3">
              <p className="text-sm text-[#0A1547]/75">
                This client already has an active signed agreement. Sending and signing a new agreement will replace the current agreement, and only one agreement can be current at a time.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <p className="text-[#0A1547]/70">
                  <span className="font-black text-[#0A1547]">Current Tier:</span>{" "}
                  {agreementReplacementDetails?.membership_tier || "—"}
                </p>
                <p className="text-[#0A1547]/70">
                  <span className="font-black text-[#0A1547]">Initial Term Start:</span>{" "}
                  {agreementReplacementDetails?.initial_term_start || "—"}
                </p>
                <p className="text-[#0A1547]/70">
                  <span className="font-black text-[#0A1547]">Renewal Date:</span>{" "}
                  {agreementReplacementDetails?.initial_renewal_date || "—"}
                </p>
                <p className="text-[#0A1547]/70">
                  <span className="font-black text-[#0A1547]">Signed Date:</span>{" "}
                  {agreementReplacementDetails?.signed_at ? formatDateTime(agreementReplacementDetails.signed_at) : "—"}
                </p>
              </div>
            </div>
            <div className="px-5 py-4 border-t border-gray-100 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setAgreementReplacementModalOpen(false);
                  setAgreementReplacementPendingAction(null);
                  setAgreementReplacementDetails(null);
                }}
                className="px-4 py-2 text-xs font-bold rounded-full border border-gray-200 text-[#0A1547]/70 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const pendingAction = agreementReplacementPendingAction;
                  setAgreementReplacementModalOpen(false);
                  setAgreementReplacementPendingAction(null);
                  setAgreementReplacementDetails(null);
                  if (pendingAction === "preview") {
                    void handleGenerateAgreementPreview(true);
                    return;
                  }
                  if (pendingAction === "send") {
                    void handleSendAgreement(true);
                  }
                }}
                className="px-4 py-2 text-xs font-bold text-white rounded-full transition-colors"
                style={{ backgroundColor: "#A380F6" }}
              >
                Continue and Replace
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </AdminLayout>
  );
}
