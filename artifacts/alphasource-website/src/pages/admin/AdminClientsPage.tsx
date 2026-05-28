import { useEffect, useState } from "react";
import {
  ChevronRight, Trash2, RefreshCw, ChevronUp, ChevronDown, Plus,
} from "lucide-react";
import AdminLayout from "@/components/AdminLayout";
import { supabase } from "@/lib/supabaseClient";

/* ── Types ───────────────────────────────────────────────────── */
type PlanTier    = "basic" | "pro" | "enterprise" | null;
type BillingCycle = "Monthly" | "Annual" | null;
type BillingStatus = "active" | "inactive";
type AccessOverride = "Inherit" | "Force Active" | "Force Inactive";

interface Client {
  id: string;
  name: string;
  letter: string;
  color: string;
  createdDate: string;
  planTier: PlanTier;
  billingStatus: BillingStatus;
  billingCycle: BillingCycle;
  rawBillingStatus: string;
  rawSubscriptionStatus: string;
  rawHasStripeSubscription: boolean;
  autoRenew: boolean;
  accessOverrideMode: string;
  stripeMembership: string | null;
  contract: string | null;
  periodEnds: string | null;
  planSettingsPlanTier: PlanTier;
  planSettingsBillingCycle: BillingCycle;
  planSettingsPlatformFee: string | null;
  planSettingsPerRoleFee: string | null;
  planSettingsIncludedInterviewsPerRole: string | null;
  planSettingsAdditionalInterviewFee: string | null;
  parent_client_id?: string | null;
  entity_label?: string | null;
  billing_client_id?: string | null;
  is_parent_client?: boolean;
  is_child_client?: boolean;
  parent_client_name?: string | null;
  child_count?: number | null;
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

function extractErrorMessage(text: string, fallback = "Request failed."): string {
  if (!text) return fallback;
  try {
    const data = JSON.parse(text) as { detail?: unknown; message?: unknown; error?: unknown };
    const candidate = data.detail ?? data.message ?? data.error;
    if (typeof candidate === "string" && candidate.trim()) return candidate;
  } catch {
    // ignore parse failure and fall back to raw text
  }
  return text || fallback;
}

function parseJsonSafe(text: string): unknown {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function optionalText(value: unknown): string | null | undefined {
  if (value === null) return null;
  if (value === undefined) return undefined;
  const normalized = String(value || "").trim();
  return normalized || null;
}

function optionalBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function optionalNumber(value: unknown): number | null | undefined {
  if (value === null) return null;
  if (value === undefined || value === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function formatDateTime(value: unknown): string {
  const raw = String(value || "").trim();
  if (!raw) return "—";
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleString();
}

function formatDate(value: unknown): string {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleDateString();
}

function formatMoney(value: unknown): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "—";
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return "—";
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(parsed);
}

function formatWholeNumber(value: unknown): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "—";
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return "—";
  return String(Math.round(parsed));
}

function normalizePlanTier(value: unknown): PlanTier {
  const tier = String(value || "").trim().toLowerCase();
  if (tier === "basic" || tier === "pro" || tier === "enterprise") return tier;
  return null;
}

function normalizeBillingCycle(value: unknown): BillingCycle {
  const cycle = String(value || "").trim().toLowerCase();
  if (cycle === "monthly") return "Monthly";
  if (cycle === "annual") return "Annual";
  return null;
}

function normalizeBillingStatus(item: Record<string, unknown>): BillingStatus {
  const billing = String(item.billing_status || "").trim().toLowerCase();
  const subscription = String(item.subscription_status || "").trim().toLowerCase();
  if (billing === "inactive") return "inactive";
  if (subscription === "active" || subscription === "trialing") return "active";
  return "inactive";
}

function normalizeAccessOverride(value: unknown): AccessOverride {
  const mode = String(value || "").trim().toLowerCase();
  if (mode === "force_active") return "Force Active";
  if (mode === "force_inactive") return "Force Inactive";
  return "Inherit";
}

function toAccessOverrideMode(value: AccessOverride): "inherit" | "force_active" | "force_inactive" {
  if (value === "Force Active") return "force_active";
  if (value === "Force Inactive") return "force_inactive";
  return "inherit";
}

function getEffectiveAccessStatus(override: AccessOverride, baseline: BillingStatus): BillingStatus {
  if (override === "Force Active") return "active";
  if (override === "Force Inactive") return "inactive";
  return baseline;
}

function getBaselineAccessStatus(client: Pick<Client, "rawBillingStatus" | "rawSubscriptionStatus" | "rawHasStripeSubscription">): BillingStatus {
  const billing = String(client.rawBillingStatus || "").trim().toLowerCase();
  const subscription = String(client.rawSubscriptionStatus || "").trim().toLowerCase();
  const hasLiveSubscription = subscription === "active" || subscription === "trialing";
  if (billing === "inactive") return "inactive";
  if (hasLiveSubscription) return "active";
  if (client.rawHasStripeSubscription || subscription) return "inactive";
  return "inactive";
}

function getOverrideSubtext(override: AccessOverride): string {
  if (override === "Force Active") return "Forced Active";
  if (override === "Force Inactive") return "Forced Inactive";
  return "Inherited";
}

const isValidEmail = (value: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());

const isValidPhoneLike = (value: string) => {
  const raw = String(value || "").trim();
  if (!raw) return false;
  if (!/^[+\d()\s.\-]+$/.test(raw)) return false;
  const digits = raw.replace(/\D/g, "");
  return digits.length >= 10 && digits.length <= 15;
};

function pickClientColor(seed: string): string {
  const palette = ["#A380F6", "#02ABE0", "#02D99D", "#F0A500", "#FF6B6B", "#5B6FBB", "#0285B0"];
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  return palette[Math.abs(hash) % palette.length];
}

function isChildEntity(client: Pick<Client, "is_child_client" | "parent_client_id">): boolean {
  return client.is_child_client === true || Boolean(String(client.parent_client_id || "").trim());
}

function clientHierarchyLabel(client: Client): string {
  const entityLabel = String(client.entity_label || "").trim();
  const parentName = String(client.parent_client_name || "").trim();
  if (isChildEntity(client)) {
    if (entityLabel && parentName) return `${entityLabel} under ${parentName}`;
    return "Child entity";
  }
  const childCount = typeof client.child_count === "number" && client.child_count > 0 ? client.child_count : 0;
  return childCount ? `Parent client · ${childCount} ${childCount === 1 ? "entity" : "entities"}` : "Parent client";
}

function clientSearchText(client: Client): string {
  return [
    client.name,
    client.entity_label,
    client.parent_client_name,
    clientHierarchyLabel(client),
    isChildEntity(client) ? "child entity" : "parent client",
  ].join(" ").toLowerCase();
}

function displayEntityLabel(client: Pick<Client, "entity_label">): string {
  const label = String(client.entity_label || "").trim();
  if (!label) return "Child entity";
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/* ── Helpers ─────────────────────────────────────────────────── */
const planColors: Record<string, { bg: string; text: string }> = {
  basic:      { bg: "rgba(163,128,246,0.12)", text: "#7C5FCC" },
  pro:        { bg: "rgba(2,171,224,0.12)",   text: "#0285B0" },
  enterprise: { bg: "rgba(2,217,157,0.12)",   text: "#009E73" },
};

const surfaceCardStyle = {
  backgroundColor: "var(--as-surface)",
  border: "1px solid var(--as-border)",
  boxShadow: "var(--as-shadow)",
};
const modalSurfaceStyle = {
  backgroundColor: "var(--as-surface)",
  border: "1px solid var(--as-border)",
  boxShadow: "0 12px 30px rgba(10,21,71,0.18)",
};
const fieldSurfaceStyle =
  "text-[var(--as-text)] border-[var(--as-border)] bg-[var(--as-surface)]";
const mutedPanelStyle = {
  backgroundColor: "var(--as-surface-muted)",
  borderColor: "var(--as-border)",
};
const dividerStyle = { borderColor: "var(--as-border)" };
const primaryTextStyle = { color: "var(--as-text)" };
const mutedTextStyle = { color: "var(--as-text-muted)" };
const subtleTextStyle = { color: "var(--as-text-subtle)" };

function PlanBadge({ tier }: { tier: PlanTier }) {
  if (!tier) return <span className="text-sm" style={subtleTextStyle}>—</span>;
  const c = planColors[tier];
  return (
    <span
      className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold capitalize"
      style={{ backgroundColor: c.bg, color: c.text }}
    >
      {tier}
    </span>
  );
}

function StatusBadge({ status, subtext }: { status: BillingStatus; subtext: string }) {
  const active = status === "active";
  return (
    <div>
      <p
        className="text-[10px] font-bold uppercase tracking-wider mb-0.5"
        style={{ color: active ? "#02D99D" : "#FF6B6B" }}
      >
        {status}
      </p>
      <p className="text-xs font-semibold" style={mutedTextStyle}>{subtext}</p>
    </div>
  );
}

type SortKey = "name" | "planTier" | "billingStatus" | "billingCycle";
type SortDir = "asc" | "desc";

/* ── Input / Select helpers ──────────────────────────────────── */
const inputCls =
  `w-full px-3 py-2 rounded-xl text-sm font-medium border ${fieldSurfaceStyle} ` +
  "placeholder:text-[#0A1547]/30 dark:placeholder:text-slate-400/45 focus:outline-none focus:border-[#A380F6] transition-colors";

const selectCls =
  `w-full px-3 py-2 rounded-xl text-sm font-medium border ${fieldSurfaceStyle} appearance-none ` +
  "focus:outline-none focus:border-[#A380F6] transition-colors cursor-pointer";

/* ── Main component ──────────────────────────────────────────── */
export default function AdminClientsPage() {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [overrides, setOverrides] = useState<Record<string, AccessOverride>>({});
  const [checkoutPlan, setCheckoutPlan] = useState<Record<string, string>>({});
  const [checkoutCycle, setCheckoutCycle] = useState<Record<string, string>>({});
  const [clients, setClients] = useState<Client[]>([]);
  const [clientsLoading, setClientsLoading] = useState(false);
  const [clientsError, setClientsError] = useState("");
  const [clientSearch, setClientSearch] = useState("");
  const [autoRenewStates, setAutoRenewStates] = useState<Record<string, boolean>>({});
  const [actionNotice, setActionNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);
  const [createBusy, setCreateBusy] = useState(false);
  const [processRenewalsBusy, setProcessRenewalsBusy] = useState(false);
  const [autoRenewBusy, setAutoRenewBusy] = useState<Record<string, boolean>>({});
  const [accessOverrideBusy, setAccessOverrideBusy] = useState<Record<string, boolean>>({});
  const [subscriptionCheckoutBusy, setSubscriptionCheckoutBusy] = useState<Record<string, boolean>>({});
  const [cancelContractBusy, setCancelContractBusy] = useState<Record<string, boolean>>({});
  const [deleteBusy, setDeleteBusy] = useState<Record<string, boolean>>({});
  const [enterprisePlatformFees, setEnterprisePlatformFees] = useState<Record<string, string>>({});
  const [enterprisePerRoleFees, setEnterprisePerRoleFees] = useState<Record<string, string>>({});
  const [enterpriseIncludedInterviews, setEnterpriseIncludedInterviews] = useState<Record<string, string>>({});
  const [enterpriseAdditionalFees, setEnterpriseAdditionalFees] = useState<Record<string, string>>({});
  const [legacyCheckoutConfirmClientId, setLegacyCheckoutConfirmClientId] = useState<string | null>(null);
  const [entityModalParent, setEntityModalParent] = useState<Client | null>(null);
  const [entityCreateBusy, setEntityCreateBusy] = useState(false);
  const [entityForm, setEntityForm] = useState({ name: "", entityLabel: "" });

  /* form state */
  const [form, setForm] = useState({
    clientName: "", adminName: "", adminEmail: "",
    candidateContact: "",
  });

  useEffect(() => {
    if (!actionNotice) return;
    const timer = setTimeout(() => setActionNotice(null), 3200);
    return () => clearTimeout(timer);
  }, [actionNotice]);

  const getSessionToken = async (): Promise<string> => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const token = String(session?.access_token || "").trim();
    if (!token) throw new Error("Missing session token.");
    return token;
  };

  const requestReload = () => {
    setReloadNonce((value) => value + 1);
  };

  const createClient = async () => {
    const name = form.clientName.trim();
    const admin_name = form.adminName.trim();
    const admin_email = form.adminEmail.trim();
    const candidate_assistance_contact = form.candidateContact.trim();
    const admin_role = "super_admin";

    if (!name) {
      setActionNotice({ tone: "error", text: "Client name is required." });
      return;
    }
    if (!candidate_assistance_contact) {
      setActionNotice({ tone: "error", text: "Candidate assistance contact is required." });
      return;
    }
    if (!isValidEmail(candidate_assistance_contact) && !isValidPhoneLike(candidate_assistance_contact)) {
      setActionNotice({ tone: "error", text: "Candidate assistance contact must be a valid email or phone." });
      return;
    }
    if (admin_email && !isValidEmail(admin_email)) {
      setActionNotice({ tone: "error", text: "Admin email must be valid." });
      return;
    }

    setCreateBusy(true);
    setActionNotice(null);
    try {
      if (!backendBase) throw new Error("Missing backend base URL configuration.");
      const token = await getSessionToken();
      const response = await fetch(`${backendBase}/admin/clients`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        credentials: "omit",
        body: JSON.stringify({
          name,
          admin_name,
          admin_email,
          admin_role,
          candidate_assistance_contact,
        }),
      });

      const text = await response.text();
      if (!response.ok) throw new Error(extractErrorMessage(text, "Could not create client."));
      const payload = parseJsonSafe(text) as { item?: unknown } | null;
      if (!payload?.item || typeof payload.item !== "object") {
        throw new Error("Client created but response item was missing.");
      }

      setForm({
        clientName: "",
        adminName: "",
        adminEmail: "",
        candidateContact: "",
      });
      requestReload();
      setActionNotice({ tone: "success", text: "Client created." });
    } catch (error) {
      setActionNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "Could not create client.",
      });
    } finally {
      setCreateBusy(false);
    }
  };

  const openEntityModal = (parent: Client) => {
    setEntityModalParent(parent);
    setEntityForm({ name: "", entityLabel: "" });
  };

  const closeEntityModal = () => {
    if (entityCreateBusy) return;
    setEntityModalParent(null);
    setEntityForm({ name: "", entityLabel: "" });
  };

  const createChildEntity = async () => {
    const parent = entityModalParent;
    const name = entityForm.name.trim();
    const entity_label = entityForm.entityLabel.trim();

    if (!parent?.id) {
      setActionNotice({ tone: "error", text: "Parent client is required." });
      return;
    }
    if (isChildEntity(parent)) {
      setActionNotice({ tone: "error", text: "Child entities can only be created under parent clients." });
      return;
    }
    if (!name) {
      setActionNotice({ tone: "error", text: "Entity name is required." });
      return;
    }

    setEntityCreateBusy(true);
    setActionNotice(null);
    try {
      if (!backendBase) throw new Error("Missing backend base URL configuration.");
      const token = await getSessionToken();
      const response = await fetch(`${backendBase}/admin/clients/${encodeURIComponent(parent.id)}/entities`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        credentials: "omit",
        body: JSON.stringify({
          name,
          entity_label: entity_label || null,
        }),
      });

      const text = await response.text();
      if (!response.ok) throw new Error(extractErrorMessage(text, "Could not create entity."));

      setEntityModalParent(null);
      setEntityForm({ name: "", entityLabel: "" });
      requestReload();
      setActionNotice({ tone: "success", text: "Entity created." });
    } catch (error) {
      setActionNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "Could not create entity.",
      });
    } finally {
      setEntityCreateBusy(false);
    }
  };

  const processRenewals = async () => {
    if (processRenewalsBusy) return;
    setProcessRenewalsBusy(true);
    setActionNotice(null);
    try {
      if (!backendBase) throw new Error("Missing backend base URL configuration.");
      const token = await getSessionToken();
      const response = await fetch(`${backendBase}/admin/contracts/process-renewals`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        credentials: "omit",
        body: JSON.stringify({}),
      });
      const text = await response.text();
      if (!response.ok) throw new Error(extractErrorMessage(text, "Could not process renewals."));
      requestReload();
      setActionNotice({ tone: "success", text: "Renewals processed." });
    } catch (error) {
      setActionNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "Could not process renewals.",
      });
    } finally {
      setProcessRenewalsBusy(false);
    }
  };

  const updateAutoRenew = async (client: Client, nextValue: boolean) => {
    const clientId = client.id;
    if (!clientId || autoRenewBusy[clientId]) return;
    setActionNotice(null);
    setAutoRenewBusy((prev) => ({ ...prev, [clientId]: true }));
    try {
      if (!backendBase) throw new Error("Missing backend base URL configuration.");
      const token = await getSessionToken();
      const response = await fetch(`${backendBase}/admin/clients/${encodeURIComponent(clientId)}/auto-renew`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        credentials: "omit",
        body: JSON.stringify({ auto_renew: nextValue }),
      });
      const text = await response.text();
      if (!response.ok) throw new Error(extractErrorMessage(text, "Could not update auto-renew."));
      const payload = parseJsonSafe(text) as { item?: { auto_renew?: unknown } } | null;
      const updated = typeof payload?.item?.auto_renew === "boolean" ? payload.item.auto_renew : nextValue;
      setAutoRenewStates((prev) => ({ ...prev, [clientId]: updated }));
      setActionNotice({ tone: "success", text: "Auto-renew updated." });
      requestReload();
    } catch (error) {
      setActionNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "Could not update auto-renew.",
      });
    } finally {
      setAutoRenewBusy((prev) => ({ ...prev, [clientId]: false }));
    }
  };

  const updateAccessOverride = async (clientId: string, nextValue: AccessOverride, previousValue: AccessOverride) => {
    if (!clientId || accessOverrideBusy[clientId]) return;
    setActionNotice(null);
    setAccessOverrideBusy((prev) => ({ ...prev, [clientId]: true }));
    try {
      if (!backendBase) throw new Error("Missing backend base URL configuration.");
      const token = await getSessionToken();
      const response = await fetch(`${backendBase}/admin/clients/${encodeURIComponent(clientId)}/access-override`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        credentials: "omit",
        body: JSON.stringify({ access_override_mode: toAccessOverrideMode(nextValue) }),
      });
      const text = await response.text();
      if (!response.ok) throw new Error(extractErrorMessage(text, "Could not update access override."));
      const payload = parseJsonSafe(text) as { item?: { access_override_mode?: unknown } } | null;
      const updated = normalizeAccessOverride(payload?.item?.access_override_mode);
      setOverrides((prev) => ({ ...prev, [clientId]: updated }));
      setActionNotice({ tone: "success", text: "Access override updated." });
      requestReload();
    } catch (error) {
      setOverrides((prev) => ({ ...prev, [clientId]: previousValue }));
      setActionNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "Could not update access override.",
      });
    } finally {
      setAccessOverrideBusy((prev) => ({ ...prev, [clientId]: false }));
    }
  };

  const sendCheckoutLink = async (client: Client) => {
    const clientId = client.id;
    if (!clientId || subscriptionCheckoutBusy[clientId]) return;
    const plan_tier = String(checkoutPlan[clientId] || client.planTier || "basic").trim().toLowerCase();
    const billing_interval = String(checkoutCycle[clientId] || (client.billingCycle === "Annual" ? "Annual" : "Monthly")).toLowerCase() === "annual"
      ? "annual"
      : "monthly";
    if (!["basic", "pro", "enterprise"].includes(plan_tier)) {
      setActionNotice({ tone: "error", text: "Invalid plan tier." });
      return;
    }

    const payload: Record<string, unknown> = {
      plan_tier,
      billing_interval,
      tab: "clients",
    };

    if (plan_tier === "enterprise") {
      const platform_fee = String(enterprisePlatformFees[clientId] ?? "").trim();
      const per_role_fee = String(enterprisePerRoleFees[clientId] ?? "").trim();
      const included_interviews_per_role = String(enterpriseIncludedInterviews[clientId] ?? "").trim();
      const additional_interview_fee = String(enterpriseAdditionalFees[clientId] ?? "").trim();
      if (!platform_fee || !per_role_fee || !included_interviews_per_role || !additional_interview_fee) {
        setActionNotice({ tone: "error", text: "All enterprise fee fields are required." });
        return;
      }
      payload.platform_fee = platform_fee;
      payload.per_role_fee = per_role_fee;
      payload.included_interviews_per_role = included_interviews_per_role;
      payload.additional_interview_fee = additional_interview_fee;
    }

    setActionNotice(null);
    setSubscriptionCheckoutBusy((prev) => ({ ...prev, [clientId]: true }));
    try {
      if (!backendBase) throw new Error("Missing backend base URL configuration.");
      const token = await getSessionToken();
      const response = await fetch(`${backendBase}/admin/clients/${encodeURIComponent(clientId)}/subscription-checkout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        credentials: "omit",
        body: JSON.stringify(payload),
      });
      const text = await response.text();
      if (!response.ok) throw new Error(extractErrorMessage(text, "Could not create checkout link."));
      const data = parseJsonSafe(text) as { email_sent?: unknown; client_email?: unknown; email_error?: unknown } | null;
      if (data?.email_sent === true) {
        const clientEmail = String(data.client_email || "").trim();
        setActionNotice({
          tone: "success",
          text: clientEmail ? `Checkout link emailed to ${clientEmail}.` : "Checkout link emailed.",
        });
      } else {
        const detail = String(data?.email_error || "").trim();
        setActionNotice({
          tone: "success",
          text: detail ? `Checkout link created. Email not confirmed (${detail}).` : "Checkout link created.",
        });
      }
      requestReload();
    } catch (error) {
      setActionNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "Could not create checkout link.",
      });
    } finally {
      setSubscriptionCheckoutBusy((prev) => ({ ...prev, [clientId]: false }));
    }
  };

  const closeLegacyCheckoutConfirm = () => {
    setLegacyCheckoutConfirmClientId(null);
  };

  const continueLegacyCheckout = () => {
    if (!legacyCheckoutConfirmClientId) return;
    const targetClient = clients.find((item) => item.id === legacyCheckoutConfirmClientId) || null;
    setLegacyCheckoutConfirmClientId(null);
    if (targetClient) {
      void sendCheckoutLink(targetClient);
    }
  };

  const cancelContract = async (client: Client) => {
    const clientId = client.id;
    if (!clientId || cancelContractBusy[clientId]) return;
    setActionNotice(null);
    setCancelContractBusy((prev) => ({ ...prev, [clientId]: true }));
    try {
      if (!backendBase) throw new Error("Missing backend base URL configuration.");
      const token = await getSessionToken();
      const response = await fetch(`${backendBase}/admin/clients/${encodeURIComponent(clientId)}/cancel-contract`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        credentials: "omit",
        body: JSON.stringify({}),
      });
      const text = await response.text();
      if (!response.ok) throw new Error(extractErrorMessage(text, "Could not cancel contract."));
      setActionNotice({ tone: "success", text: "Contract canceled." });
      requestReload();
    } catch (error) {
      setActionNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "Could not cancel contract.",
      });
    } finally {
      setCancelContractBusy((prev) => ({ ...prev, [clientId]: false }));
    }
  };

  const deleteClient = async (client: Client) => {
    const clientId = client.id;
    if (!clientId || deleteBusy[clientId]) return;
    if (!window.confirm(`Remove ${client.name}? This cannot be undone.`)) return;
    setActionNotice(null);
    setDeleteBusy((prev) => ({ ...prev, [clientId]: true }));
    try {
      if (!backendBase) throw new Error("Missing backend base URL configuration.");
      const token = await getSessionToken();
      const response = await fetch(`${backendBase}/admin/clients/${encodeURIComponent(clientId)}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        credentials: "omit",
      });
      const text = await response.text();
      if (!response.ok) throw new Error(extractErrorMessage(text, "Could not delete client."));
      setActionNotice({ tone: "success", text: "Client deleted." });
      requestReload();
    } catch (error) {
      setActionNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "Could not delete client.",
      });
    } finally {
      setDeleteBusy((prev) => ({ ...prev, [clientId]: false }));
    }
  };

  /* sort */
  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  };

  const clientSearchTerm = clientSearch.trim().toLowerCase();
  const parentClients = clients.filter((client) => !isChildEntity(client));
  const childClients = clients.filter((client) => isChildEntity(client));
  const parentClientIds = new Set(parentClients.map((client) => client.id));
  const childrenByParentId = new Map<string, Client[]>();
  const childMatchesByParentId = new Map<string, Client[]>();
  const matchedParentIds = new Set<string>();

  childClients.forEach((child) => {
    const parentId = String(child.parent_client_id || "").trim();
    if (!parentId || !parentClientIds.has(parentId)) return;
    const children = childrenByParentId.get(parentId) || [];
    children.push(child);
    childrenByParentId.set(parentId, children);
    if (clientSearchTerm && clientSearchText(child).includes(clientSearchTerm)) {
      const matches = childMatchesByParentId.get(parentId) || [];
      matches.push(child);
      childMatchesByParentId.set(parentId, matches);
      matchedParentIds.add(parentId);
    }
  });

  childrenByParentId.forEach((children) => {
    children.sort((a, b) => a.name.localeCompare(b.name));
  });
  childMatchesByParentId.forEach((children) => {
    children.sort((a, b) => a.name.localeCompare(b.name));
  });

  const filteredClients = clientSearchTerm
    ? clients.filter((client) =>
        isChildEntity(client)
          ? (!parentClientIds.has(String(client.parent_client_id || "").trim()) && clientSearchText(client).includes(clientSearchTerm))
          : (clientSearchText(client).includes(clientSearchTerm) || matchedParentIds.has(client.id)),
      )
    : clients.filter((client) =>
        !isChildEntity(client) || !parentClientIds.has(String(client.parent_client_id || "").trim()),
      );

  const sorted = [...filteredClients].sort((a, b) => {
    let av = a[sortKey] ?? "";
    let bv = b[sortKey] ?? "";
    av = String(av).toLowerCase();
    bv = String(bv).toLowerCase();
    if (av < bv) return sortDir === "asc" ? -1 : 1;
    if (av > bv) return sortDir === "asc" ? 1  : -1;
    return 0;
  });

  const toggleExpand = (id: string) =>
    setExpandedId((cur) => (cur === id ? null : id));

  useEffect(() => {
    let alive = true;

    const loadClients = async () => {
      if (!backendBase) {
        if (!alive) return;
        setClients([]);
        setClientsError("Missing backend base URL configuration.");
        setClientsLoading(false);
        return;
      }

      if (!alive) return;
      setClientsLoading(true);
      setClientsError("");

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const token = String(session?.access_token || "").trim();
        if (!token) throw new Error("Missing session token.");

        const response = await fetch(`${backendBase}/admin/clients`, {
          method: "GET",
          headers: { Authorization: `Bearer ${token}` },
          credentials: "omit",
        });

        const text = await response.text();
        if (!response.ok) throw new Error(extractErrorMessage(text, "Failed to load clients."));

        const payload = parseJsonSafe(text);
        const items = payload && typeof payload === "object" && Array.isArray((payload as { items?: unknown }).items)
          ? (payload as { items: unknown[] }).items
          : [];

        const mappedClients = items
          .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"))
          .map((item) => {
            const id = String(item.id || "").trim();
            const name = String(item.name || "").trim() || "Unnamed client";
            const firstLetter = String(name.trim().charAt(0) || "?").toUpperCase();
            const contractStart = formatDate(item.contract_start_at);
            const contractEnd = formatDate(item.contract_end_at);
            return {
              id,
              name,
              letter: firstLetter,
              color: pickClientColor(id || name),
              createdDate: formatDateTime(item.created_at),
              planTier: normalizePlanTier(item.plan_tier),
              billingStatus: normalizeBillingStatus(item),
              billingCycle: normalizeBillingCycle(item.billing_interval),
              rawBillingStatus: String(item.billing_status || "").trim().toLowerCase(),
              rawSubscriptionStatus: String(item.subscription_status || "").trim().toLowerCase(),
              rawHasStripeSubscription: Boolean(String(item.stripe_subscription_id || "").trim()),
              autoRenew: Boolean(item.auto_renew),
              accessOverrideMode: String(item.access_override_mode || "").trim().toLowerCase() || "inherit",
              stripeMembership: String(item.subscription_status || "").trim() || null,
              contract: contractStart && contractEnd ? `${contractStart} – ${contractEnd}` : null,
              periodEnds: formatDate(item.current_term_end) || null,
              planSettingsPlanTier: normalizePlanTier(item.plan_settings_plan_tier),
              planSettingsBillingCycle: normalizeBillingCycle(item.plan_settings_billing_interval),
              planSettingsPlatformFee: String(item.plan_settings_platform_fee ?? "").trim() || null,
              planSettingsPerRoleFee: String(item.plan_settings_per_role_fee ?? "").trim() || null,
              planSettingsIncludedInterviewsPerRole: String(item.plan_settings_included_interviews_per_role ?? "").trim() || null,
              planSettingsAdditionalInterviewFee: String(item.plan_settings_additional_interview_fee ?? "").trim() || null,
              parent_client_id: optionalText(item.parent_client_id),
              entity_label: optionalText(item.entity_label),
              billing_client_id: optionalText(item.billing_client_id),
              is_parent_client: optionalBoolean(item.is_parent_client),
              is_child_client: optionalBoolean(item.is_child_client),
              parent_client_name: optionalText(item.parent_client_name),
              child_count: optionalNumber(item.child_count),
            };
          })
          .filter((item) => Boolean(item.id));

        if (!alive) return;
        setClients(mappedClients);
        setAutoRenewStates(Object.fromEntries(mappedClients.map((client) => [client.id, client.autoRenew])));
        setOverrides((prev) => Object.fromEntries(
          mappedClients.map((client) => [client.id, prev[client.id] ?? normalizeAccessOverride(client.accessOverrideMode)]),
        ));
        setCheckoutPlan((prev) => Object.fromEntries(
          mappedClients.map((client) => [client.id, prev[client.id] ?? (client.planTier || "basic")]),
        ));
        setCheckoutCycle((prev) => Object.fromEntries(
          mappedClients.map((client) => [client.id, prev[client.id] ?? (client.billingCycle || "Monthly")]),
        ));
        setExpandedId((current) => (current && mappedClients.some((client) => client.id === current) ? current : null));
      } catch (error) {
        if (!alive) return;
        setClients([]);
        setExpandedId(null);
        setClientsError(error instanceof Error ? error.message : "Failed to load clients.");
      } finally {
        if (alive) setClientsLoading(false);
      }
    };

    void loadClients();
    return () => {
      alive = false;
    };
  }, [reloadNonce]);

  /* sort indicator */
  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col)
      return <ChevronDown className="w-3 h-3 ml-0.5 flex-shrink-0" style={subtleTextStyle} />;
    return sortDir === "asc"
      ? <ChevronUp   className="w-3 h-3 text-[#A380F6] ml-0.5 flex-shrink-0" />
      : <ChevronDown className="w-3 h-3 text-[#A380F6] ml-0.5 flex-shrink-0" />;
  }

  return (
    <AdminLayout title="Clients">

      {/* ── Page header ──────────────────────────────────── */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-black text-[#0A1547]" style={{ color: "var(--as-text)" }}>Clients</h2>
        <button
          disabled={processRenewalsBusy}
          className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold text-white transition-opacity hover:opacity-90"
          style={{ backgroundColor: "#A380F6" }}
          onClick={() => {
            void processRenewals();
          }}
        >
          <RefreshCw className="w-3.5 h-3.5" />
          {processRenewalsBusy ? "Processing..." : "Process Renewals"}
        </button>
      </div>
      {actionNotice && (
        <div
          className="mb-4 px-4 py-2.5 rounded-xl text-sm font-semibold"
          style={{
            border: actionNotice.tone === "error" ? "1px solid rgba(239,68,68,0.25)" : "1px solid rgba(2,217,157,0.25)",
            backgroundColor: actionNotice.tone === "error" ? "rgba(239,68,68,0.08)" : "rgba(2,217,157,0.10)",
            color: actionNotice.tone === "error" ? "#DC2626" : "#047857",
          }}
        >
          {actionNotice.text}
        </div>
      )}

      {/* ── Create client form ────────────────────────────── */}
      <div
        className="rounded-2xl p-5 mb-5"
        style={surfaceCardStyle}
      >
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
          <input
            className={inputCls}
            placeholder="Client name"
            value={form.clientName}
            onChange={(e) => setForm({ ...form, clientName: e.target.value })}
          />
          <input
            className={inputCls}
            placeholder="Super Admin name"
            value={form.adminName}
            onChange={(e) => setForm({ ...form, adminName: e.target.value })}
          />
          <input
            className={inputCls}
            placeholder="Super Admin email"
            type="email"
            value={form.adminEmail}
            onChange={(e) => setForm({ ...form, adminEmail: e.target.value })}
          />
        </div>
        <div className="flex gap-3">
          <input
            className={inputCls}
            placeholder="Candidate assistance contact (email or phone)"
            type="text"
            value={form.candidateContact}
            onChange={(e) => setForm({ ...form, candidateContact: e.target.value })}
          />
          <button
            disabled={createBusy}
            className="flex-shrink-0 px-5 py-2 rounded-full text-sm font-bold text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: "#A380F6" }}
            onClick={() => {
              void createClient();
            }}
          >
            {createBusy ? "Creating..." : "Create"}
          </button>
        </div>
      </div>

      {/* ── Search ────────────────────────────────────────── */}
      <div
        className="rounded-2xl px-5 py-3.5 mb-5 flex flex-wrap items-center gap-3"
        style={surfaceCardStyle}
      >
        <input
          className={inputCls + " max-w-sm"}
          placeholder="Search clients or entities..."
          value={clientSearch}
          onChange={(e) => setClientSearch(e.target.value)}
        />
        {clientSearch && (
          <button
            type="button"
            className="px-3 py-2 rounded-full text-xs font-bold text-[#0A1547]/55 dark:text-slate-300/70 bg-[#0A1547]/5 dark:bg-white/5 hover:bg-[#0A1547]/10 dark:hover:bg-white/10 transition-colors"
            onClick={() => setClientSearch("")}
          >
            Clear
          </button>
        )}
        <p className="text-xs font-semibold ml-auto" style={subtleTextStyle}>
          {sorted.length} of {clients.length} client{clients.length !== 1 ? "s" : ""}
        </p>
      </div>

      {/* ── Clients table ─────────────────────────────────── */}
      <div
        className="rounded-2xl overflow-hidden"
        style={surfaceCardStyle}
      >
        {/* Table header */}
        <div className="grid grid-cols-[1fr_110px_130px_120px_90px_56px] items-center px-5 py-3 border-b" style={dividerStyle}>
          <button
            className="flex items-center text-[10px] font-black uppercase tracking-widest hover:text-[#A380F6] transition-colors text-left"
            style={mutedTextStyle}
            onClick={() => handleSort("name")}
          >
            Name <SortIcon col="name" />
          </button>
          <button
            className="flex items-center text-[10px] font-black uppercase tracking-widest hover:text-[#A380F6] transition-colors"
            style={mutedTextStyle}
            onClick={() => handleSort("planTier")}
          >
            Plan tier <SortIcon col="planTier" />
          </button>
          <button
            className="flex items-center text-[10px] font-black uppercase tracking-widest hover:text-[#A380F6] transition-colors"
            style={mutedTextStyle}
            onClick={() => handleSort("billingStatus")}
          >
            Billing status <SortIcon col="billingStatus" />
          </button>
          <button
            className="flex items-center text-[10px] font-black uppercase tracking-widest hover:text-[#A380F6] transition-colors"
            style={mutedTextStyle}
            onClick={() => handleSort("billingCycle")}
          >
            Billing cycle <SortIcon col="billingCycle" />
          </button>
          <p className="text-[10px] font-black uppercase tracking-widest" style={mutedTextStyle}>
            Auto-Renew
          </p>
          <p className="text-[10px] font-black uppercase tracking-widest" style={mutedTextStyle}>
            Remove
          </p>
        </div>

        {/* Rows */}
        <div>
          {clientsLoading ? (
            <div className="px-5 py-6 text-sm font-semibold" style={mutedTextStyle}>
              Loading clients...
            </div>
          ) : clientsError ? (
            <div className="px-5 py-6 text-sm font-semibold text-red-500">
              {clientsError}
            </div>
          ) : sorted.length === 0 ? (
            <div className="px-5 py-6 text-sm font-semibold" style={subtleTextStyle}>
              {clientSearchTerm && clients.length > 0 ? "No clients match your search." : "No clients found."}
            </div>
          ) : sorted.map((client) => {
            const expanded = expandedId === client.id;
            const override = overrides[client.id] ?? "Inherit";
            const cpPlan   = checkoutPlan[client.id]  ?? "basic";
            const cpCycle  = checkoutCycle[client.id] ?? "Monthly";
            const rowIsChildEntity = isChildEntity(client);
            const baselineStatus = getBaselineAccessStatus(client);
            const effectiveStatus = getEffectiveAccessStatus(override, baselineStatus);
            const hasLiveSubscription =
              client.rawSubscriptionStatus === "active" || client.rawSubscriptionStatus === "trialing";
            const canCancelContract =
              !rowIsChildEntity && client.rawBillingStatus === "active" && client.rawHasStripeSubscription && hasLiveSubscription;
            const showCheckout = !rowIsChildEntity && !hasLiveSubscription;
            const autoRenew  = autoRenewStates[client.id] ?? client.autoRenew;
            const isEnterpriseClient = !rowIsChildEntity && (client.planTier || client.planSettingsPlanTier) === "enterprise";
            const membershipFeeLabel = formatMoney(client.planSettingsPlatformFee);
            const perRoleFeeLabel = formatMoney(client.planSettingsPerRoleFee);
            const includedInterviewsLabel = formatWholeNumber(client.planSettingsIncludedInterviewsPerRole);
            const additionalInterviewFeeLabel = formatMoney(client.planSettingsAdditionalInterviewFee);
            const enterpriseBillingIntervalLabel = client.planSettingsBillingCycle || client.billingCycle || "—";
            const nestedChildren = rowIsChildEntity
              ? []
              : expanded
                ? (childrenByParentId.get(client.id) || [])
                : (childMatchesByParentId.get(client.id) || []);

            return (
              <div key={client.id}>
                {/* Main row */}
                <div
                  className={`grid grid-cols-[1fr_110px_130px_120px_90px_56px] items-center px-5 py-3.5
                    cursor-pointer transition-colors as-shell-dropdown-item border-b
                    ${expanded ? "bg-[rgba(163,128,246,0.04)]" : ""}`}
                  style={dividerStyle}
                  onClick={() => toggleExpand(client.id)}
                >
                  {/* Name + created date */}
                  <div className="flex items-center gap-2.5 min-w-0">
                    <ChevronRight
                      className="w-3.5 h-3.5 flex-shrink-0 transition-transform duration-200"
                      style={{
                        color: expanded ? "#A380F6" : "var(--as-text-subtle)",
                        transform: expanded ? "rotate(90deg)" : "rotate(0deg)",
                      }}
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-bold leading-snug truncate" style={primaryTextStyle}>
                        {client.name}
                      </p>
                      <p className="text-[10px] mt-0.5" style={subtleTextStyle}>
                        {clientHierarchyLabel(client)} · Created {client.createdDate}
                      </p>
                    </div>
                  </div>

                  <div>
                    {rowIsChildEntity ? <span className="text-sm" style={subtleTextStyle}>—</span> : <PlanBadge tier={client.planTier} />}
                  </div>

                  <div>
                    {rowIsChildEntity ? (
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider mb-0.5" style={subtleTextStyle}>entity</p>
                        <p className="text-xs font-semibold" style={mutedTextStyle}>Billed to parent</p>
                      </div>
                    ) : (
                      <StatusBadge status={effectiveStatus} subtext={getOverrideSubtext(override)} />
                    )}
                  </div>

                  <p className="text-sm font-semibold" style={mutedTextStyle}>
                    {rowIsChildEntity ? "—" : (client.billingCycle ?? "—")}
                  </p>

                  {/* Auto-renew checkbox */}
                  <div className="flex items-center">
                    {rowIsChildEntity ? (
                      <span className="text-sm" style={subtleTextStyle}>—</span>
                    ) : (
                      <button
                        disabled={autoRenewBusy[client.id] === true}
                        className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all cursor-pointer hover:scale-105 ${
                          autoRenew
                            ? "border-[#A380F6] bg-[#A380F6]"
                            : "border-[rgba(10,21,71,0.15)] dark:border-slate-500/40 bg-transparent hover:border-[#A380F6]/50"
                        }`}
                        onClick={(e) => {
                          e.stopPropagation();
                          void updateAutoRenew(client, !autoRenew);
                        }}
                        title={autoRenew ? "Disable auto-renew" : "Enable auto-renew"}
                      >
                        {autoRenew && (
                          <svg viewBox="0 0 10 8" className="w-2.5 h-2">
                            <path d="M1 4l2.5 2.5L9 1" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </button>
                      )}
                  </div>

                  {/* Remove */}
                  <div className="flex items-center justify-center">
                    <button
                      disabled={deleteBusy[client.id] === true}
                      className="p-1.5 rounded-lg text-[#0A1547]/25 dark:text-slate-400/45 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      title={`Remove ${client.name}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        void deleteClient(client);
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Expanded detail panel */}
                {expanded && (
                  <div
                    className="px-8 py-5 border-t"
                    style={{
                      backgroundColor: "var(--as-surface-muted)",
                      borderColor: "rgba(163,128,246,0.12)",
                      borderLeft: "3px solid #A380F6",
                    }}
                  >
                    <div className="flex flex-col lg:flex-row gap-6">

                      {/* Left: details */}
                      <div className="flex-1 min-w-0">
                        {rowIsChildEntity ? (
                          <>
                            <p className="text-xs font-black mb-2" style={primaryTextStyle}>Entity details</p>
                            <div className="space-y-1.5">
                              {[
                                ["Entity type", client.entity_label || "Child entity"],
                                ["Parent client", client.parent_client_name || "—"],
                                ["Billing owner", client.parent_client_name || client.billing_client_id || "Parent client"],
                                ["Created", client.createdDate],
                              ].map(([label, value]) => (
                                <div key={String(label)} className="flex items-baseline gap-1.5 text-xs">
                                  <span className="font-semibold flex-shrink-0" style={subtleTextStyle}>{String(label)}:</span>
                                  <span className="font-semibold" style={mutedTextStyle}>{String(value || "—")}</span>
                                </div>
                              ))}
                            </div>
                          </>
                        ) : (
                          <>
                            <p className="text-xs font-black mb-2" style={primaryTextStyle}>Membership details</p>
                            <div className="space-y-1.5">
                              {[
                                ["Membership tier",     client.planTier ?? "—"],
                                ["Billing status", <span className="font-bold" style={{ color: baselineStatus === "active" ? "#02D99D" : "#FF6B6B" }}>{baselineStatus}</span>],
                                ["Stripe membership", client.stripeMembership ?? "—"],
                                ["Billing cycle",      client.billingCycle ?? "—"],
                                ["Contract",           client.contract ?? "—"],
                                ["Current billing period ends", client.periodEnds ?? "—"],
                                ["Renewal",            autoRenew ? "Auto-renew on" : "Auto-renew off"],
                              ].map(([label, value]) => (
                                <div key={String(label)} className="flex items-baseline gap-1.5 text-xs">
                                  <span className="font-semibold flex-shrink-0" style={subtleTextStyle}>{String(label)}:</span>
                                  <span className="font-semibold" style={mutedTextStyle}>{value as React.ReactNode}</span>
                                </div>
                              ))}
                            </div>
                            {isEnterpriseClient && (
                              <div className="mt-4 rounded-xl px-3.5 py-3 border" style={mutedPanelStyle}>
                                <p className="text-[11px] font-black uppercase tracking-wider mb-2.5" style={mutedTextStyle}>Enterprise Membership</p>
                                <div className="space-y-1.5">
                                  {[
                                    ["Membership fee", membershipFeeLabel],
                                    ["Billing interval", enterpriseBillingIntervalLabel],
                                    ["Per-role fee", perRoleFeeLabel],
                                    ["Included interviews (per role)", includedInterviewsLabel],
                                    ["Additional interview fee", additionalInterviewFeeLabel],
                                  ].map(([label, value]) => (
                                    <div key={String(label)} className="flex items-baseline gap-1.5 text-xs">
                                      <span className="font-semibold flex-shrink-0" style={subtleTextStyle}>{String(label)}:</span>
                                      <span className="font-semibold" style={mutedTextStyle}>{String(value || "—")}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </>
                        )}
                      </div>

                      {/* Right: actions */}
                      <div className="flex flex-col gap-4 lg:w-80">

                        {!rowIsChildEntity && (
                          <button
                            type="button"
                            className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-full text-sm font-bold border hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                            style={{ backgroundColor: "var(--as-surface)", borderColor: "var(--as-border)", color: "var(--as-text)" }}
                            onClick={(e) => {
                              e.stopPropagation();
                              openEntityModal(client);
                            }}
                          >
                            <Plus className="w-3.5 h-3.5" />
                            Add entity
                          </button>
                        )}

                        {/* Active client actions */}
                        {canCancelContract && (
                          <div className="flex items-center gap-3">
                            <button
                              disabled={cancelContractBusy[client.id] === true}
                              className="px-4 py-2 rounded-full text-sm font-bold text-white transition-opacity hover:opacity-90 flex-shrink-0"
                              style={{ backgroundColor: "#A380F6" }}
                              onClick={(e) => {
                                e.stopPropagation();
                                void cancelContract(client);
                              }}
                            >
                              {cancelContractBusy[client.id] === true ? "Canceling..." : "Cancel Contract"}
                            </button>
                          </div>
                        )}

                        {/* Access override */}
                        <div>
                          <p className="text-xs font-black mb-2" style={primaryTextStyle}>Access override</p>
                          <div className="relative">
                            <select
                              className={selectCls}
                              value={override}
                              disabled={accessOverrideBusy[client.id] === true}
                              onChange={(e) => {
                                const nextValue = e.target.value as AccessOverride;
                                const previousValue = overrides[client.id] ?? normalizeAccessOverride(client.accessOverrideMode);
                                setOverrides((prev) => ({
                                  ...prev,
                                  [client.id]: nextValue,
                                }));
                                void updateAccessOverride(client.id, nextValue, previousValue);
                              }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <option>Inherit</option>
                              <option>Force Active</option>
                              <option>Force Inactive</option>
                            </select>
                            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none" style={subtleTextStyle} />
                          </div>
                        </div>

                        {/* Inactive-only: Membership Checkout Link */}
                        {showCheckout && (
                          <div>
                            <p className="text-xs font-black mb-1" style={primaryTextStyle}>Legacy Checkout Tools</p>
                            <p className="text-[11px] font-medium mb-2" style={mutedTextStyle}>
                              Primary onboarding now starts from the signed agreement flow. Use this only as a fallback.
                            </p>
                            <div className="flex gap-2 mb-2">
                              <div className="relative flex-1">
                                <select
                                  className={selectCls}
                                  value={cpPlan}
                                  onChange={(e) =>
                                    setCheckoutPlan((prev) => ({ ...prev, [client.id]: e.target.value }))
                                  }
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <option value="basic">Basic</option>
                                  <option value="pro">Pro</option>
                                  <option value="enterprise">Enterprise</option>
                                </select>
                                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none" style={subtleTextStyle} />
                              </div>
                              <div className="relative flex-1">
                                <select
                                  className={selectCls}
                                  value={cpCycle}
                                  onChange={(e) =>
                                    setCheckoutCycle((prev) => ({ ...prev, [client.id]: e.target.value }))
                                  }
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <option>Monthly</option>
                                  <option>Annual</option>
                                </select>
                                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none" style={subtleTextStyle} />
                              </div>
                            </div>

                            {/* Enterprise extra fields */}
                            {cpPlan === "enterprise" && (
                              <div className="grid grid-cols-2 gap-2 mb-2">
                                {["Membership ($)", "Per-role fee ($)", "Included interviews", "Add'l Interview Fee ($)"].map((ph) => (
                                  <input
                                    key={ph}
                                    className={inputCls}
                                    placeholder={ph}
                                    value={
                                      ph === "Membership ($)"
                                        ? (enterprisePlatformFees[client.id] ?? "")
                                        : ph === "Per-role fee ($)"
                                          ? (enterprisePerRoleFees[client.id] ?? "")
                                          : ph === "Included interviews"
                                            ? (enterpriseIncludedInterviews[client.id] ?? "")
                                            : (enterpriseAdditionalFees[client.id] ?? "")
                                    }
                                    onChange={(e) => {
                                      const value = e.target.value;
                                      if (ph === "Membership ($)") {
                                        setEnterprisePlatformFees((prev) => ({ ...prev, [client.id]: value }));
                                        return;
                                      }
                                      if (ph === "Per-role fee ($)") {
                                        setEnterprisePerRoleFees((prev) => ({ ...prev, [client.id]: value }));
                                        return;
                                      }
                                      if (ph === "Included interviews") {
                                        setEnterpriseIncludedInterviews((prev) => ({ ...prev, [client.id]: value }));
                                        return;
                                      }
                                      setEnterpriseAdditionalFees((prev) => ({ ...prev, [client.id]: value }));
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                ))}
                              </div>
                            )}

                            <button
                              disabled={subscriptionCheckoutBusy[client.id] === true}
                              className="w-full px-4 py-2 rounded-full text-sm font-bold text-white transition-opacity hover:opacity-90"
                              style={{ backgroundColor: "#A380F6" }}
                              onClick={(e) => {
                                e.stopPropagation();
                                setLegacyCheckoutConfirmClientId(client.id);
                              }}
                            >
                              {subscriptionCheckoutBusy[client.id] === true ? "Sending..." : "Send Checkout Link"}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
                {nestedChildren.length > 0 && (
                  <div
                    className="px-8 py-4 border-t"
                    style={{
                      backgroundColor: "var(--as-surface-muted)",
                      borderColor: "rgba(163,128,246,0.10)",
                      borderLeft: "3px solid #A380F6",
                    }}
                  >
                    <div className="rounded-xl border overflow-hidden" style={{ backgroundColor: "var(--as-surface)", borderColor: "var(--as-border)" }}>
                      <div className="px-4 py-3 border-b" style={dividerStyle}>
                        <p className="text-xs font-black" style={primaryTextStyle}>Child entities</p>
                        <p className="text-[11px] font-semibold" style={mutedTextStyle}>
                          Operational scopes under {client.name}
                        </p>
                      </div>
                      <div
                        className="hidden lg:grid grid-cols-[1fr_120px_140px_220px_44px] gap-3 px-4 py-2 text-[10px] font-black uppercase tracking-widest"
                        style={{ ...mutedPanelStyle, ...subtleTextStyle }}
                      >
                        <span>Name</span>
                        <span>Label</span>
                        <span>Billing</span>
                        <span>Access override</span>
                        <span>Remove</span>
                      </div>
                      <div>
                        {nestedChildren.map((child) => {
                          const childOverride = overrides[child.id] ?? "Inherit";
                          return (
                            <div
                              key={child.id}
                              className="grid grid-cols-1 lg:grid-cols-[1fr_120px_140px_220px_44px] gap-3 items-center px-4 py-3 border-b last:border-b-0 as-shell-dropdown-item transition-colors"
                              style={dividerStyle}
                            >
                              <div className="min-w-0">
                                <p className="text-sm font-bold truncate" style={primaryTextStyle}>{child.name}</p>
                                <p className="text-[11px] font-semibold" style={mutedTextStyle}>
                                  Under {child.parent_client_name || client.name}
                                </p>
                              </div>
                              <p className="text-xs font-bold" style={mutedTextStyle}>
                                {displayEntityLabel(child)}
                              </p>
                              <p className="text-xs font-bold" style={mutedTextStyle}>
                                Billed to parent
                              </p>
                              <div className="relative">
                                <select
                                  className={selectCls}
                                  value={childOverride}
                                  disabled={accessOverrideBusy[child.id] === true}
                                  onChange={(e) => {
                                    const nextValue = e.target.value as AccessOverride;
                                    const previousValue = overrides[child.id] ?? normalizeAccessOverride(child.accessOverrideMode);
                                    setOverrides((prev) => ({
                                      ...prev,
                                      [child.id]: nextValue,
                                    }));
                                    void updateAccessOverride(child.id, nextValue, previousValue);
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <option>Inherit</option>
                                  <option>Force Active</option>
                                  <option>Force Inactive</option>
                                </select>
                                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none" style={subtleTextStyle} />
                              </div>
                              <div className="flex items-center lg:justify-center">
                                <button
                                  disabled={deleteBusy[child.id] === true}
                                  className="p-1.5 rounded-lg text-[#0A1547]/25 dark:text-slate-400/45 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                  title={`Remove ${child.name}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    void deleteClient(child);
                                  }}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      {entityModalParent && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center px-4">
          <button
            type="button"
            className="absolute inset-0 bg-[#0A1547]/35"
            aria-label="Close entity creation"
            onClick={closeEntityModal}
          />
          <div
            className="relative w-full max-w-md rounded-2xl p-5"
            style={modalSurfaceStyle}
          >
            <h3 className="text-base font-black" style={primaryTextStyle}>Add entity</h3>
            <p className="mt-1 text-sm font-semibold" style={mutedTextStyle}>
              Under {entityModalParent.name}
            </p>
            <div className="mt-4 space-y-3">
              <input
                className={inputCls}
                placeholder="Entity name"
                value={entityForm.name}
                onChange={(e) => setEntityForm((prev) => ({ ...prev, name: e.target.value }))}
              />
              <input
                className={inputCls}
                placeholder="Entity label (office, location, entity)"
                value={entityForm.entityLabel}
                onChange={(e) => setEntityForm((prev) => ({ ...prev, entityLabel: e.target.value }))}
              />
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                disabled={entityCreateBusy}
                className="px-4 py-2 rounded-full text-sm font-bold text-[#0A1547]/70 dark:text-slate-300/80 bg-[#0A1547]/5 dark:bg-white/5 hover:bg-[#0A1547]/10 dark:hover:bg-white/10 transition-colors disabled:opacity-50"
                onClick={closeEntityModal}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={entityCreateBusy}
                className="px-4 py-2 rounded-full text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: "#A380F6" }}
                onClick={() => {
                  void createChildEntity();
                }}
              >
                {entityCreateBusy ? "Creating..." : "Create entity"}
              </button>
            </div>
          </div>
        </div>
      )}
      {legacyCheckoutConfirmClientId && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center px-4">
          <button
            type="button"
            className="absolute inset-0 bg-[#0A1547]/35"
            aria-label="Close legacy checkout confirmation"
            onClick={closeLegacyCheckoutConfirm}
          />
          <div
            className="relative w-full max-w-md rounded-2xl p-5"
            style={modalSurfaceStyle}
          >
            <h3 className="text-base font-black" style={primaryTextStyle}>Use legacy checkout?</h3>
            <p className="mt-2 text-sm font-medium" style={mutedTextStyle}>
              This is not the primary checkout flow. Are you sure you do not need to send an agreement first?
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                className="px-4 py-2 rounded-full text-sm font-bold text-[#0A1547]/70 dark:text-slate-300/80 bg-[#0A1547]/5 dark:bg-white/5 hover:bg-[#0A1547]/10 dark:hover:bg-white/10 transition-colors"
                onClick={closeLegacyCheckoutConfirm}
              >
                Cancel
              </button>
              <button
                type="button"
                className="px-4 py-2 rounded-full text-sm font-bold text-white transition-opacity hover:opacity-90"
                style={{ backgroundColor: "#A380F6" }}
                onClick={continueLegacyCheckout}
              >
                Continue anyway
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
