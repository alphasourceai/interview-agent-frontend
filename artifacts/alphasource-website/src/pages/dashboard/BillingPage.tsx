import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ShoppingCart, CreditCard, ExternalLink, X } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { useClient } from "@/context/ClientContext";
import InfoTooltip from "@/components/InfoTooltip";
import { supabase } from "@/lib/supabaseClient";

interface BillingSummary {
  plan_tier: string;
  billing_status: string;
  billing_interval: string;
  auto_renew: boolean | null;
  current_term_end: string;
  contract_end_at: string;
  subscription_status: string;
  access_override_mode: string;
  has_stripe_customer: boolean;
}

interface BillingRole {
  id: string;
  title: string;
  purchased_interviews: number;
}

interface AdditionalInterviewsCheckoutResponse {
  url?: unknown;
  checkout_client_secret?: unknown;
}

interface EmbeddedCheckoutState {
  clientSecret: string;
  fallbackUrl: string;
}

interface LatestSignedAgreement {
  id: string;
  status: string;
  signed_at: string;
  signer_typed_name: string;
  client_legal_name: string;
  executed_pdf_url: string;
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

function firstText(...values: unknown[]): string {
  for (const value of values) {
    const normalized = String(value || "").trim();
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

const stripePublishableKey = firstText(
  (env as Record<string, unknown>).VITE_STRIPE_PUBLISHABLE_KEY,
  (env as Record<string, unknown>).VITE_STRIPE_PUBLIC_KEY,
  (env as Record<string, unknown>).STRIPE_PUBLISHABLE_KEY,
);

function openCheckoutUrl(checkoutUrl: string): void {
  const url = String(checkoutUrl || "").trim();
  if (!url) return;
  if (window?.parent && window.parent !== window) {
    try {
      if (window.top) {
        window.top.location.href = url;
        return;
      }
    } catch {
      // fallback below
    }
    window.open(url, "_blank", "noopener,noreferrer");
    return;
  }
  window.location.assign(url);
}

function extractErrorMessage(text: string): string {
  if (!text) return "Failed to load billing summary.";
  try {
    const data = JSON.parse(text) as { detail?: unknown; message?: unknown; error?: unknown };
    const candidate = data.detail ?? data.message ?? data.error;
    if (typeof candidate === "string" && candidate.trim()) return candidate;
  } catch {
    // ignore parse failure and fall back to raw text
  }
  return text;
}

function parseJsonSafe(text: string): unknown {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function formatDate(value: unknown): string {
  const raw = String(value || "").trim();
  if (!raw) return "—";
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function toDisplayText(value: unknown, fallback = "—"): string {
  const text = String(value || "").trim();
  if (!text) return fallback;
  return text
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function toWholeNonNegative(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.floor(n));
}

/* ── Status badge colors ── */
function statusStyle(value: string): { bg: string; text: string } {
  const v = value.toLowerCase();
  if (v === "active")   return { bg: "rgba(2,217,157,0.12)",   text: "#009E73" };
  if (v === "inactive") return { bg: "rgba(255,107,107,0.12)", text: "#CC3B3B" };
  if (v === "annual")   return { bg: "rgba(163,128,246,0.12)", text: "#7C5FCC" };
  if (v === "monthly")  return { bg: "rgba(2,171,224,0.12)",   text: "#0285B0" };
  if (v === "yes")      return { bg: "rgba(2,217,157,0.12)",   text: "#009E73" };
  if (v === "no")       return { bg: "rgba(255,107,107,0.12)", text: "#CC3B3B" };
  return { bg: "rgba(10,21,71,0.06)", text: "#0A1547" };
}

function ValueBadge({ value }: { value: string }) {
  const s = statusStyle(value);
  return (
    <span
      className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold"
      style={{ backgroundColor: s.bg, color: s.text }}
    >
      {value}
    </span>
  );
}

/* ── Info card matching Overview top-bar style ── */
function InfoCard({
  label,
  value,
  accent,
  badge,
  tooltip,
}: {
  label: string;
  value: string;
  accent: string;
  badge?: boolean;
  tooltip?: string;
}) {
  return (
    <div
      className="bg-white rounded-2xl p-5 relative overflow-hidden flex flex-col justify-between min-h-[90px]"
      style={{ border: "1px solid rgba(10,21,71,0.07)", boxShadow: "0 2px 12px rgba(10,21,71,0.04)" }}
    >
      {/* Top accent bar */}
      <div
        className="absolute top-0 left-0 right-0 h-[3px] rounded-t-2xl"
        style={{ backgroundColor: accent }}
      />
      <div className="flex items-start justify-between gap-2 mt-1">
        <p className="text-[10px] font-black uppercase tracking-widest text-[#0A1547]/40 flex items-center gap-1">
          {label}
          {tooltip && <InfoTooltip content={tooltip} side="bottom" />}
        </p>
      </div>
      <div className="mt-2">
        {badge ? (
          <ValueBadge value={value} />
        ) : (
          <p className="text-[15px] font-black text-[#0A1547] leading-snug">{value}</p>
        )}
      </div>
    </div>
  );
}

export default function BillingPage() {
  const { selectedClient, selectedClientId, loading: clientLoading, error: clientError, memberships, isGlobalAdmin } = useClient();
  const selectedMembershipRole = String(
    memberships.find((membership) => membership.client_id === selectedClientId)?.role ||
      selectedClient.role ||
      "",
  )
    .trim()
    .toLowerCase();
  const canManageBilling = isGlobalAdmin || selectedMembershipRole === "manager" || selectedMembershipRole === "admin";
  const clientName = selectedClient.id === "all" ? "All Clients" : selectedClient.name;
  const [billingSummary, setBillingSummary] = useState<BillingSummary | null>(null);
  const [billingLoading, setBillingLoading] = useState(false);
  const [billingError, setBillingError] = useState("");
  const [latestAgreement, setLatestAgreement] = useState<LatestSignedAgreement | null>(null);
  const [latestAgreementLoading, setLatestAgreementLoading] = useState(false);
  const [latestAgreementError, setLatestAgreementError] = useState("");
  const [roles, setRoles] = useState<BillingRole[]>([]);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [portalBusy, setPortalBusy] = useState(false);
  const [purchaseBusy, setPurchaseBusy] = useState(false);
  const [billingReloadNonce, setBillingReloadNonce] = useState(0);
  const [embeddedCheckout, setEmbeddedCheckout] = useState<EmbeddedCheckoutState | null>(null);
  const [embeddedCheckoutLoading, setEmbeddedCheckoutLoading] = useState(false);
  const [embeddedCheckoutError, setEmbeddedCheckoutError] = useState("");
  const [actionNotice, setActionNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const billingReturnHandledRef = useRef(false);
  const embeddedCheckoutContainerRef = useRef<HTMLDivElement>(null);
  const embeddedCheckoutInstanceRef = useRef<{ unmount?: () => void; destroy?: () => void } | null>(null);

  const [selectedRole, setSelectedRole] = useState("");
  const [quantity, setQuantity]         = useState(1);

  const canPurchase = canManageBilling && selectedRole !== "" && Number.isInteger(quantity) && quantity >= 1 && !rolesLoading && !purchaseBusy;

  useEffect(() => {
    let alive = true;

    const loadBillingSummary = async () => {
      if (clientLoading) return;
      if (clientError) {
        if (!alive) return;
        setBillingSummary(null);
        setBillingError(clientError);
        setBillingLoading(false);
        return;
      }
      if (!selectedClientId) {
        if (!alive) return;
        setBillingSummary(null);
        setBillingError("");
        setBillingLoading(false);
        return;
      }
      if (!backendBase) {
        if (!alive) return;
        setBillingSummary(null);
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

        const response = await fetch(
          `${backendBase}/clients/billing/summary?client_id=${encodeURIComponent(selectedClientId)}`,
          {
            method: "GET",
            headers: { Authorization: `Bearer ${token}` },
            credentials: "omit",
          },
        );

        const text = await response.text();
        if (!response.ok) {
          throw new Error(extractErrorMessage(text));
        }

        let payload: unknown = null;
        try {
          payload = text ? JSON.parse(text) : {};
        } catch {
          payload = {};
        }

        const items = payload && typeof payload === "object" && Array.isArray((payload as { items?: unknown }).items)
          ? (payload as { items: unknown[] }).items
          : [];
        const first = items.find((item) => Boolean(item && typeof item === "object")) as Record<string, unknown> | undefined;

        if (!alive) return;
        if (!first) {
          setBillingSummary(null);
          return;
        }

        setBillingSummary({
          plan_tier: String(first.plan_tier || "").trim(),
          billing_status: String(first.billing_status || "").trim(),
          billing_interval: String(first.billing_interval || "").trim(),
          auto_renew: typeof first.auto_renew === "boolean" ? first.auto_renew : null,
          current_term_end: String(first.current_term_end || "").trim(),
          contract_end_at: String(first.contract_end_at || "").trim(),
          subscription_status: String(first.subscription_status || "").trim(),
          access_override_mode: String(first.access_override_mode || "").trim(),
          has_stripe_customer: Boolean(first.has_stripe_customer),
        });
      } catch (error) {
        if (!alive) return;
        setBillingSummary(null);
        setBillingError(error instanceof Error ? error.message : "Failed to load billing summary.");
      } finally {
        if (alive) setBillingLoading(false);
      }
    };

    void loadBillingSummary();
    return () => {
      alive = false;
    };
  }, [selectedClientId, clientLoading, clientError, billingReloadNonce]);

  useEffect(() => {
    let alive = true;

    const loadLatestSignedAgreement = async () => {
      if (clientLoading) return;
      if (clientError) {
        if (!alive) return;
        setLatestAgreement(null);
        setLatestAgreementError(clientError);
        setLatestAgreementLoading(false);
        return;
      }
      if (!selectedClientId || selectedClientId === "all") {
        if (!alive) return;
        setLatestAgreement(null);
        setLatestAgreementError("");
        setLatestAgreementLoading(false);
        return;
      }
      if (!backendBase) {
        if (!alive) return;
        setLatestAgreement(null);
        setLatestAgreementError("Missing backend base URL configuration.");
        setLatestAgreementLoading(false);
        return;
      }

      if (!alive) return;
      setLatestAgreementLoading(true);
      setLatestAgreementError("");

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const token = String(session?.access_token || "").trim();
        if (!token) throw new Error("Missing session token.");

        const response = await fetch(
          `${backendBase}/membership-agreements/latest-signed?client_id=${encodeURIComponent(selectedClientId)}`,
          {
            method: "GET",
            headers: { Authorization: `Bearer ${token}` },
            credentials: "omit",
          },
        );

        const text = await response.text();
        if (!response.ok) {
          throw new Error(extractErrorMessage(text));
        }

        const payload = parseJsonSafe(text);
        const agreementPayload =
          payload &&
          typeof payload === "object" &&
          (payload as { agreement?: unknown }).agreement &&
          typeof (payload as { agreement?: unknown }).agreement === "object"
            ? ((payload as { agreement: Record<string, unknown> }).agreement || null)
            : null;

        if (!alive) return;
        if (!agreementPayload) {
          setLatestAgreement(null);
          return;
        }

        setLatestAgreement({
          id: String(agreementPayload.id || "").trim(),
          status: String(agreementPayload.status || "").trim(),
          signed_at: String(agreementPayload.signed_at || "").trim(),
          signer_typed_name: String(agreementPayload.signer_typed_name || "").trim(),
          client_legal_name: String(agreementPayload.client_legal_name || "").trim(),
          executed_pdf_url: String(agreementPayload.executed_pdf_url || "").trim(),
        });
      } catch (error) {
        if (!alive) return;
        setLatestAgreement(null);
        setLatestAgreementError(error instanceof Error ? error.message : "Failed to load latest signed agreement.");
      } finally {
        if (alive) setLatestAgreementLoading(false);
      }
    };

    void loadLatestSignedAgreement();
    return () => {
      alive = false;
    };
  }, [selectedClientId, clientLoading, clientError, billingReloadNonce]);

  useEffect(() => {
    let alive = true;

    const loadRoles = async () => {
      if (clientLoading) return;
      if (clientError) {
        if (!alive) return;
        setRoles([]);
        setRolesLoading(false);
        return;
      }
      if (!selectedClientId) {
        if (!alive) return;
        setRoles([]);
        setSelectedRole("");
        setRolesLoading(false);
        return;
      }
      if (!backendBase) {
        if (!alive) return;
        setRoles([]);
        setRolesLoading(false);
        return;
      }

      if (!alive) return;
      setRolesLoading(true);

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const token = String(session?.access_token || "").trim();
        if (!token) throw new Error("Missing session token.");

        const response = await fetch(
          `${backendBase}/roles?client_id=${encodeURIComponent(selectedClientId)}`,
          {
            method: "GET",
            headers: { Authorization: `Bearer ${token}` },
            credentials: "omit",
          },
        );

        const text = await response.text();
        if (!response.ok) throw new Error(extractErrorMessage(text));

        const payload = parseJsonSafe(text);
        const items = payload && typeof payload === "object" && Array.isArray((payload as { items?: unknown }).items)
          ? (payload as { items: unknown[] }).items
          : [];

        const mappedRoles = items
          .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"))
          .map((item) => ({
            id: String(item.id || "").trim(),
            title: String(item.title || "").trim() || "Untitled role",
            purchased_interviews: toWholeNonNegative(item.purchased_interviews),
          }))
          .filter((item) => Boolean(item.id));

        if (!alive) return;
        setRoles(mappedRoles);
        setSelectedRole((current) => (mappedRoles.some((role) => role.id === current) ? current : ""));
      } catch {
        if (!alive) return;
        setRoles([]);
        setSelectedRole("");
      } finally {
        if (alive) setRolesLoading(false);
      }
    };

    void loadRoles();
    return () => {
      alive = false;
    };
  }, [selectedClientId, clientLoading, clientError, billingReloadNonce]);

  useEffect(() => {
    setActionNotice(null);
    setPortalBusy(false);
    setPurchaseBusy(false);
    if (embeddedCheckoutInstanceRef.current) {
      try {
        embeddedCheckoutInstanceRef.current.unmount?.();
      } catch {
        // no-op
      }
      try {
        embeddedCheckoutInstanceRef.current.destroy?.();
      } catch {
        // no-op
      }
      embeddedCheckoutInstanceRef.current = null;
    }
    setEmbeddedCheckout(null);
    setEmbeddedCheckoutLoading(false);
    setEmbeddedCheckoutError("");
  }, [selectedClientId, clientLoading, clientError]);

  useEffect(() => {
    if (!actionNotice) return;
    const timer = setTimeout(() => setActionNotice(null), 3200);
    return () => clearTimeout(timer);
  }, [actionNotice]);

  useEffect(() => {
    if (billingReturnHandledRef.current) return;
    if (!selectedClientId) return;
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search || "");
    const tab = String(params.get("tab") || "").trim().toLowerCase();
    const returnClientId = String(params.get("client_id") || "").trim();
    const returnRoleId = String(params.get("role_id") || "").trim();
    const purchase = String(params.get("purchase") || "").trim().toLowerCase();
    const intent = String(params.get("intent") || "").trim().toLowerCase();

    const isBillingReturn =
      tab === "billing" ||
      intent === "role_capacity" ||
      purchase === "success" ||
      purchase === "cancel";

    if (!isBillingReturn) return;
    if (!returnClientId || returnClientId !== selectedClientId) return;

    if (returnRoleId) {
      const hasRole = roles.some((role) => role.id === returnRoleId);
      if (!hasRole && rolesLoading) return;
      if (hasRole) setSelectedRole(returnRoleId);
    }

    if (purchase === "success") {
      setActionNotice({ tone: "success", text: "Additional interviews checkout completed." });
    } else if (purchase === "cancel") {
      setActionNotice({ tone: "error", text: "Additional interviews checkout canceled." });
    }

    billingReturnHandledRef.current = true;
  }, [selectedClientId, roles, rolesLoading]);

  const closeEmbeddedCheckout = () => {
    if (embeddedCheckoutInstanceRef.current) {
      try {
        embeddedCheckoutInstanceRef.current.unmount?.();
      } catch {
        // no-op
      }
      try {
        embeddedCheckoutInstanceRef.current.destroy?.();
      } catch {
        // no-op
      }
      embeddedCheckoutInstanceRef.current = null;
    }
    setEmbeddedCheckout(null);
    setEmbeddedCheckoutLoading(false);
    setEmbeddedCheckoutError("");
  };

  useEffect(() => {
    const clientSecret = String(embeddedCheckout?.clientSecret || "").trim();
    if (!clientSecret) return;
    let alive = true;
    let embeddedInstance: { unmount?: () => void; destroy?: () => void } | null = null;

    const mountEmbeddedCheckout = async () => {
      setEmbeddedCheckoutLoading(true);
      setEmbeddedCheckoutError("");
      try {
        if (!stripePublishableKey) throw new Error("Missing Stripe publishable key.");
        const { loadStripe } = await import("@stripe/stripe-js");
        const stripe = await loadStripe(stripePublishableKey);
        if (!stripe) throw new Error("Could not initialize Stripe checkout.");
        if (!alive) return;

        const checkout = await stripe.initEmbeddedCheckout({
          clientSecret,
          onComplete: () => {
            setBillingReloadNonce((value) => value + 1);
            setActionNotice({ tone: "success", text: "Additional interviews checkout completed." });
            setEmbeddedCheckout(null);
            setEmbeddedCheckoutError("");
          },
        });
        if (!alive) {
          try {
            checkout.destroy?.();
          } catch {
            // no-op
          }
          return;
        }
        if (!embeddedCheckoutContainerRef.current) throw new Error("Checkout container unavailable.");
        checkout.mount(embeddedCheckoutContainerRef.current);
        embeddedInstance = checkout;
        embeddedCheckoutInstanceRef.current = checkout;
      } catch (error) {
        if (!alive) return;
        const message = error instanceof Error ? error.message : "Could not load embedded checkout.";
        setEmbeddedCheckoutError(message);
        const fallbackUrl = String(embeddedCheckout?.fallbackUrl || "").trim();
        if (fallbackUrl) {
          closeEmbeddedCheckout();
          openCheckoutUrl(fallbackUrl);
        }
      } finally {
        if (alive) setEmbeddedCheckoutLoading(false);
      }
    };

    void mountEmbeddedCheckout();
    return () => {
      alive = false;
      if (embeddedInstance) {
        try {
          embeddedInstance.unmount?.();
        } catch {
          // no-op
        }
        try {
          embeddedInstance.destroy?.();
        } catch {
          // no-op
        }
      }
      if (embeddedCheckoutInstanceRef.current) {
        try {
          embeddedCheckoutInstanceRef.current.unmount?.();
        } catch {
          // no-op
        }
        try {
          embeddedCheckoutInstanceRef.current.destroy?.();
        } catch {
          // no-op
        }
        embeddedCheckoutInstanceRef.current = null;
      }
    };
  }, [embeddedCheckout?.clientSecret, embeddedCheckout?.fallbackUrl]);

  const getSessionToken = async (): Promise<string> => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const token = String(session?.access_token || "").trim();
    if (!token) throw new Error("Missing session token.");
    return token;
  };

  const openBillingPortal = async () => {
    if (!canManageBilling || !selectedClientId || portalBusy) return;
    setActionNotice(null);
    setPortalBusy(true);
    try {
      if (!backendBase) throw new Error("Missing backend base URL configuration.");
      const token = await getSessionToken();
      const response = await fetch(`${backendBase}/clients/billing/portal-session`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        credentials: "omit",
        body: JSON.stringify({
          client_id: selectedClientId,
          tab: "billing",
        }),
      });
      const text = await response.text();
      if (!response.ok) throw new Error(extractErrorMessage(text));
      const data = parseJsonSafe(text) as { url?: unknown } | null;
      const url = typeof data?.url === "string" ? data.url.trim() : "";
      if (!url) throw new Error("No billing portal URL returned");

      if (window?.parent && window.parent !== window) {
        try {
          if (window.top) {
            window.top.location.href = url;
            return;
          }
        } catch {
          // fallback below
        }
        window.open(url, "_blank", "noopener,noreferrer");
        return;
      }
      window.location.assign(url);
    } catch (error) {
      setActionNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "Could not open billing portal.",
      });
    } finally {
      setPortalBusy(false);
    }
  };

  const startAdditionalInterviewsCheckout = async () => {
    if (!canManageBilling || !selectedClientId || !selectedRole || !Number.isInteger(quantity) || quantity <= 0 || purchaseBusy) return;
    setActionNotice(null);
    setPurchaseBusy(true);
    try {
      if (!backendBase) throw new Error("Missing backend base URL configuration.");
      const token = await getSessionToken();
      const response = await fetch(`${backendBase}/clients/billing/additional-interviews/checkout-session`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        credentials: "omit",
        body: JSON.stringify({
          client_id: selectedClientId,
          role_id: selectedRole,
          quantity,
          tab: "billing",
          embedded: true,
        }),
      });
      const text = await response.text();
      if (!response.ok) throw new Error(extractErrorMessage(text));
      const data = parseJsonSafe(text) as AdditionalInterviewsCheckoutResponse | null;
      const url = typeof data?.url === "string" ? data.url.trim() : "";
      const checkoutClientSecret =
        typeof data?.checkout_client_secret === "string" ? data.checkout_client_secret.trim() : "";

      if (checkoutClientSecret && stripePublishableKey) {
        setEmbeddedCheckout({
          clientSecret: checkoutClientSecret,
          fallbackUrl: url,
        });
        return;
      }

      if (!url) throw new Error("No checkout URL returned");
      openCheckoutUrl(url);
    } catch (error) {
      setActionNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "Could not start additional interview checkout.",
      });
    } finally {
      setPurchaseBusy(false);
    }
  };

  const openLatestSignedAgreement = async () => {
    if (!selectedClientId || selectedClientId === "all") return;
    try {
      if (!backendBase) throw new Error("Missing backend base URL configuration.");
      setLatestAgreementError("");
      const token = await getSessionToken();
      const response = await fetch(
        `${backendBase}/membership-agreements/latest-signed-url?client_id=${encodeURIComponent(selectedClientId)}`,
        {
          method: "GET",
          headers: { Authorization: `Bearer ${token}` },
          credentials: "omit",
        },
      );
      const text = await response.text();
      if (!response.ok) throw new Error(extractErrorMessage(text));
      const payload = parseJsonSafe(text) as { executed_pdf_url?: unknown } | null;
      const url = typeof payload?.executed_pdf_url === "string" ? payload.executed_pdf_url.trim() : "";
      if (!url) throw new Error("No signed agreement PDF is available.");
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (error) {
      setLatestAgreementError(error instanceof Error ? error.message : "Failed to open signed agreement.");
    }
  };

  const billing = useMemo(
    () => ({
      planTier: toDisplayText(billingSummary?.plan_tier),
      billingStatus: toDisplayText(billingSummary?.billing_status),
      billingCycle: toDisplayText(billingSummary?.billing_interval),
      autoRenew:
        billingSummary?.auto_renew === true
          ? "Yes"
          : billingSummary?.auto_renew === false
            ? "No"
            : "—",
      currentTermEnd: formatDate(billingSummary?.current_term_end),
      contractEndDate: formatDate(billingSummary?.contract_end_at),
      membershipStatus: toDisplayText(billingSummary?.subscription_status),
      accessStatus: toDisplayText(billingSummary?.access_override_mode),
    }),
    [billingSummary],
  );
  const purchasedInterviewRows = roles.filter((role) => role.purchased_interviews > 0);
  const purchasedInterviewsTotal = purchasedInterviewRows.reduce((sum, role) => sum + role.purchased_interviews, 0);

  return (
    <DashboardLayout title="Billing">

      {/* ── Section 1: Billing Info ───────────────────── */}
      <div
        className="bg-white rounded-2xl p-6 mb-6"
        style={{ border: "1px solid rgba(10,21,71,0.07)", boxShadow: "0 2px 12px rgba(10,21,71,0.05)" }}
      >
        <h2 className="text-base font-black text-[#0A1547] mb-5">
          Billing Info
          {selectedClient.id !== "all" && (
            <span className="ml-2 text-base font-semibold text-[#0A1547]/40">for {clientName}</span>
          )}
        </h2>

        {clientLoading || billingLoading ? (
          <p className="text-sm text-[#0A1547]/45 font-semibold">Loading billing summary...</p>
        ) : clientError || billingError ? (
          <p className="text-sm text-red-500 font-semibold">{clientError || billingError}</p>
        ) : !billingSummary ? (
          <p className="text-sm text-[#0A1547]/35 font-semibold">No billing summary available for this client.</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <InfoCard
              label="Plan Tier"
              value={billing.planTier}
              accent="#A380F6"
              tooltip="The membership tier that controls included interviews, role limits, and platform access."
            />
            <InfoCard
              label="Billing Status"
              value={billing.billingStatus}
              accent="#02D99D"
              badge
              tooltip="Shows whether this client currently has active platform access, a pending checkout, a cancellation state, or an inactive billing status."
            />
            <InfoCard
              label="Billing Cycle"
              value={billing.billingCycle}
              accent="#02ABE0"
              badge
              tooltip="The billing period cadence used for renewals and membership timing."
            />
            <InfoCard
              label="Auto-Renew"
              value={billing.autoRenew}
              accent="#A380F6"
              badge
              tooltip="Shows whether the current subscription is set to renew at the end of the billing period or cancel at term end."
            />
            <InfoCard
              label="Current Term End"
              value={billing.currentTermEnd}
              accent="#02ABE0"
              tooltip="The date the current billing period or membership term is scheduled to end or renew."
            />
            <InfoCard
              label="Contract End Date"
              value={billing.contractEndDate}
              accent="#02D99D"
              tooltip="The final date of the signed membership agreement terms associated with this client."
            />
            <InfoCard
              label="Membership Status"
              value={billing.membershipStatus}
              accent="#A380F6"
              badge
              tooltip="Overall membership standing tied to this client's access and billing setup."
            />
            <InfoCard
              label="Access Status"
              value={billing.accessStatus}
              accent="#02ABE0"
              tooltip="How dashboard access is granted; inherited access flows from the parent account."
            />
          </div>
        )}
      </div>

      {/* ── Section 2: Latest Signed Agreement ───────── */}
      <div
        className="bg-white rounded-2xl p-6 mb-6"
        style={{ border: "1px solid rgba(10,21,71,0.07)", boxShadow: "0 2px 12px rgba(10,21,71,0.05)" }}
      >
        <h2 className="text-base font-black text-[#0A1547] mb-4">Latest Signed Agreement</h2>
        {clientLoading || latestAgreementLoading ? (
          <p className="text-sm text-[#0A1547]/45 font-semibold">Loading latest agreement...</p>
        ) : latestAgreementError ? (
          <p className="text-sm text-red-500 font-semibold">{latestAgreementError}</p>
        ) : !latestAgreement ? (
          <p className="text-sm text-[#0A1547]/35 font-semibold">No signed agreement is available for this client yet.</p>
        ) : (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 flex-1">
              <InfoCard
                label="Status"
                value={toDisplayText(latestAgreement.status)}
                accent="#02D99D"
                badge
              />
              <InfoCard
                label="Signed Date"
                value={formatDate(latestAgreement.signed_at)}
                accent="#A380F6"
              />
              <InfoCard
                label="Signer"
                value={latestAgreement.signer_typed_name || "—"}
                accent="#02ABE0"
              />
            </div>
            <button
              type="button"
              onClick={() => {
                void openLatestSignedAgreement();
              }}
              disabled={!latestAgreement.executed_pdf_url}
              className="flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-bold text-white rounded-full transition-all hover:opacity-90 active:scale-[0.97] flex-shrink-0"
              style={{ backgroundColor: "#A380F6" }}
            >
              <ExternalLink className="w-4 h-4" />
              View / Export Agreement
            </button>
          </div>
        )}
      </div>

      {canManageBilling && (
        <div
          className="bg-white rounded-2xl p-6 mb-6"
          style={{ border: "1px solid rgba(10,21,71,0.07)", boxShadow: "0 2px 12px rgba(10,21,71,0.05)" }}
        >
          <div className="flex items-center gap-1.5 mb-5">
            <h2 className="text-base font-black text-[#0A1547]">Purchase Additional Interviews</h2>
            <InfoTooltip content="Extra interview capacity can be purchased for a selected role outside the base membership. Checkout is processed via Stripe." side="bottom" />
          </div>
          {actionNotice && (
            <div
              className={`mb-4 rounded-xl px-3.5 py-2 text-xs font-semibold ${
                actionNotice.tone === "success"
                  ? "text-[#009E73] bg-[#02D99D]/10 border border-[#02D99D]/25"
                  : "text-red-500 bg-red-50 border border-red-200"
              }`}
              role="status"
              aria-live="polite"
            >
              {actionNotice.text}
            </div>
          )}

          <div className="flex flex-wrap gap-3 items-end">
            {/* Role select */}
            <div className="flex-1 min-w-[220px]">
              <label className="text-[10px] font-black uppercase tracking-widest text-[#0A1547]/40 block mb-1.5">
                Role
              </label>
              <div className="relative">
                <select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value)}
                  className="w-full appearance-none px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-[#0A1547] text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#A380F6]/25 focus:border-[#A380F6] transition-all cursor-pointer pr-9"
                  disabled={rolesLoading}
                >
                  <option value="">
                    {rolesLoading ? "Loading roles…" : "Select a role…"}
                  </option>
                  {roles.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.title}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#0A1547]/40 pointer-events-none" />
              </div>
            </div>

            {/* Quantity */}
            <div className="w-32">
              <label className="text-[10px] font-black uppercase tracking-widest text-[#0A1547]/40 block mb-1.5">
                Quantity
              </label>
              <input
                type="number"
                min={1}
                max={500}
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-[#0A1547] text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#A380F6]/25 focus:border-[#A380F6] transition-all text-center"
              />
            </div>

            {/* Purchase button */}
            <button
              type="button"
              onClick={() => { void startAdditionalInterviewsCheckout(); }}
              disabled={!canPurchase}
              className="flex items-center gap-2 px-6 py-2.5 text-sm font-bold text-white rounded-full transition-all flex-shrink-0"
              style={{
                backgroundColor: canPurchase ? "#A380F6" : "rgba(163,128,246,0.35)",
                cursor: canPurchase ? "pointer" : "not-allowed",
              }}
            >
              <ShoppingCart className="w-4 h-4" />
              {purchaseBusy ? "Redirecting..." : "Purchase Additional Interviews"}
            </button>
          </div>
        </div>
      )}

      {/* ── Section 4: Purchased Interviews Table ────── */}
      <div
        className="bg-white rounded-2xl overflow-hidden mb-6"
        style={{ border: "1px solid rgba(10,21,71,0.07)", boxShadow: "0 2px 12px rgba(10,21,71,0.05)" }}
      >
        <div className="px-6 pt-5 pb-4 border-b border-gray-100 flex items-center gap-1.5">
          <h2 className="text-base font-black text-[#0A1547]">Additional Interviews Purchased</h2>
          <InfoTooltip content="Extra interview capacity purchased outside the base membership, broken down by role." side="bottom" />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-6 py-3.5 text-[10px] font-black uppercase tracking-widest text-[#0A1547]/40 whitespace-nowrap">
                  Role
                </th>
                <th className="text-right px-6 py-3.5 pr-8 text-[10px] font-black uppercase tracking-widest text-[#0A1547]/40 whitespace-nowrap">
                  Interviews Purchased
                </th>
              </tr>
            </thead>
            <tbody>
              {rolesLoading ? (
                <tr>
                  <td colSpan={2} className="px-6 py-4 text-sm text-[#0A1547]/45 font-semibold">
                    Loading roles...
                  </td>
                </tr>
              ) : purchasedInterviewRows.length === 0 ? (
                <tr>
                  <td colSpan={2} className="px-6 py-4 text-sm text-[#0A1547]/35 font-semibold">
                    No additional interview purchases yet.
                  </td>
                </tr>
              ) : (
                purchasedInterviewRows.map((row, idx) => (
                  <tr
                    key={row.id}
                    className="border-b border-gray-50 hover:bg-gray-50/60 transition-colors"
                    style={idx === purchasedInterviewRows.length - 1 ? { borderBottom: "none" } : {}}
                  >
                    <td className="px-6 py-4">
                      <span className="font-bold text-[#0A1547]">{row.title}</span>
                    </td>
                    <td className="px-6 py-4 pr-8 text-right">
                      <span
                        className="inline-flex items-center px-3 py-1 rounded-lg text-xs font-black"
                        style={{ backgroundColor: "rgba(163,128,246,0.10)", color: "#7C5FCC" }}
                      >
                        {row.purchased_interviews}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="px-6 py-3 border-t border-gray-100">
          <p className="text-[11px] text-[#0A1547]/35 font-semibold">
            {purchasedInterviewsTotal} additional interviews total
          </p>
        </div>
      </div>

      {/* ── Section 5: Manage Billing ─────────────────── */}
      <div
        className="bg-white rounded-2xl p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
        style={{ border: "1px solid rgba(10,21,71,0.07)", boxShadow: "0 2px 12px rgba(10,21,71,0.05)" }}
      >
        <div>
          <h2 className="text-base font-black text-[#0A1547] mb-1">Manage Billing</h2>
          <p className="text-xs text-[#0A1547]/45 leading-relaxed max-w-sm">
            Access your full billing dashboard to update payment methods, view invoices, and manage your subscription.
          </p>
        </div>
        {canManageBilling && (
          <button
            type="button"
            onClick={() => { void openBillingPortal(); }}
            disabled={!selectedClientId || portalBusy || billingSummary?.has_stripe_customer === false}
            className="flex items-center gap-2 px-6 py-2.5 text-sm font-bold text-white rounded-full transition-all hover:opacity-90 active:scale-[0.97] flex-shrink-0"
            style={{ backgroundColor: "#A380F6" }}
          >
            <CreditCard className="w-4 h-4" />
            {portalBusy ? "Opening..." : "Manage Billing"}
          </button>
        )}
      </div>
      {embeddedCheckout && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 sm:p-6">
          <button
            type="button"
            onClick={closeEmbeddedCheckout}
            className="absolute inset-0 bg-[#0A1547]/45"
            aria-label="Close checkout"
          />
          <div
            className="relative w-full max-w-5xl max-h-[92vh] bg-white rounded-2xl overflow-hidden"
            style={{ border: "1px solid rgba(10,21,71,0.10)", boxShadow: "0 20px 44px rgba(10,21,71,0.24)" }}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-[#0A1547]/40">Checkout</p>
                <h3 className="text-sm font-black text-[#0A1547] leading-snug">Purchase additional interviews</h3>
              </div>
              <button
                type="button"
                onClick={closeEmbeddedCheckout}
                className="w-8 h-8 rounded-lg inline-flex items-center justify-center text-[#0A1547]/40 hover:text-[#0A1547] hover:bg-gray-100 transition-colors"
                aria-label="Close checkout"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-5 py-4 overflow-y-auto max-h-[calc(92vh-72px)]">
              {embeddedCheckoutLoading && (
                <p className="mb-3 text-xs font-semibold text-[#0A1547]/45">Loading checkout…</p>
              )}
              {embeddedCheckoutError && (
                <p className="mb-3 text-xs font-semibold text-red-500">{embeddedCheckoutError}</p>
              )}
              <div ref={embeddedCheckoutContainerRef} className="min-h-[520px]" />
              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={closeEmbeddedCheckout}
                  className="px-4 py-2 text-xs font-bold rounded-full border border-gray-200 text-[#0A1547]/70 hover:bg-gray-50 transition-colors"
                >
                  Close
                </button>
                {embeddedCheckout.fallbackUrl ? (
                  <button
                    type="button"
                    onClick={() => {
                      const fallbackUrl = embeddedCheckout.fallbackUrl;
                      closeEmbeddedCheckout();
                      openCheckoutUrl(fallbackUrl);
                    }}
                    className="px-4 py-2 text-xs font-bold text-white rounded-full transition-all hover:opacity-90"
                    style={{ backgroundColor: "#A380F6" }}
                  >
                    Open hosted checkout
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      )}

    </DashboardLayout>
  );
}
