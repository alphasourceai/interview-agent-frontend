import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, ArrowLeft, ArrowRight, CheckCircle, Clock3, RefreshCw, ShieldCheck } from "lucide-react";
import { getPublicBackendBase, joinUrl } from "@/lib/urlConfig";

type ReturnStatus = "ready" | "password_required" | "setup_email_sent" | "setup_pending" | "activation_pending" | "payment_pending" | "cancelled";

type CheckoutLookup = {
  sessionId: string;
  agreementId: string;
  clientId: string;
};

type CheckoutStatusResponse = {
  status?: unknown;
  set_password_url?: unknown;
  first_role_prepay_selected?: unknown;
  first_role_prepay?: unknown;
  selected_package?: unknown;
  package_snapshot?: unknown;
};

const POLLABLE_STATUSES = new Set<ReturnStatus>(["payment_pending", "activation_pending", "setup_pending"]);
const MAX_STATUS_POLLS = 12;
const STATUS_POLL_INTERVAL_MS = 4000;
const PASSWORD_SETUP_PREVIEW_PATH = "/checkout/password-setup-preview";
const CHECKOUT_BACK_LINK_CLASS =
  "inline-flex text-sm font-semibold text-[#A380F6] transition-colors hover:text-[#0A1547]";

function envText(key: string): string {
  const env = typeof import.meta !== "undefined" && import.meta.env
    ? import.meta.env as Record<string, unknown>
    : {};
  const value = env[key];
  return typeof value === "string" ? value.trim() : "";
}

function readStatus(): ReturnStatus {
  if (typeof window === "undefined") return "setup_pending";
  const status = String(new URLSearchParams(window.location.search || "").get("status") || "").trim().toLowerCase();
  return normalizeStatus(status);
}

function normalizeStatus(status: unknown): ReturnStatus {
  const normalized = String(status || "").trim().toLowerCase();
  if (normalized === "cancelled" || normalized === "canceled") return "cancelled";
  if (normalized === "pending") return "payment_pending";
  if (
    normalized === "ready" ||
    normalized === "password_required" ||
    normalized === "setup_email_sent" ||
    normalized === "setup_pending" ||
    normalized === "activation_pending" ||
    normalized === "payment_pending"
  ) return normalized;
  return "setup_pending";
}

function readCheckoutLookup(): CheckoutLookup {
  if (typeof window === "undefined") return { sessionId: "", agreementId: "", clientId: "" };
  const params = new URLSearchParams(window.location.search || "");
  return {
    sessionId: String(params.get("session_id") || "").trim(),
    agreementId: String(params.get("agreement_id") || "").trim(),
    clientId: String(params.get("client_id") || "").trim(),
  };
}

function checkoutStatusEndpoint(lookup: CheckoutLookup): string {
  const params = new URLSearchParams();
  if (lookup.sessionId) params.set("session_id", lookup.sessionId);
  if (lookup.agreementId) params.set("agreement_id", lookup.agreementId);
  if (lookup.clientId) params.set("client_id", lookup.clientId);
  const query = params.toString();
  if (!query) return "";
  return `${joinUrl(getPublicBackendBase(), "/api/alphascreen/checkout-status")}?${query}`;
}

function readSetPasswordUrl(): string {
  if (typeof window === "undefined") return "";
  const raw = String(new URLSearchParams(window.location.search || "").get("set_password_url") || "").trim();
  return normalizeSetPasswordUrl(raw);
}

function readInitialFirstRolePrepaySelected(): boolean | null {
  if (typeof window === "undefined") return null;
  return booleanOrNull(new URLSearchParams(window.location.search || "").get("first_role_prepay_selected"));
}

function booleanOrNull(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  const raw = String(value ?? "").trim().toLowerCase();
  if (raw === "true" || raw === "1" || raw === "yes") return true;
  if (raw === "false" || raw === "0" || raw === "no") return false;
  return null;
}

function objectOrNull(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? value as Record<string, unknown> : null;
}

function resolveFirstRolePrepaySelected(source: Record<string, unknown>): boolean | null {
  const direct = booleanOrNull(source.first_role_prepay_selected);
  if (direct !== null) return direct;
  const firstRolePrepay = objectOrNull(source.first_role_prepay);
  const fromFirstRolePrepay = firstRolePrepay ? booleanOrNull(firstRolePrepay.selected) : null;
  if (fromFirstRolePrepay !== null) return fromFirstRolePrepay;
  const selectedPackage = objectOrNull(source.selected_package);
  const selectedPackagePrepay = selectedPackage ? objectOrNull(selectedPackage.first_role_prepay) : null;
  const fromSelectedPackage = selectedPackagePrepay ? booleanOrNull(selectedPackagePrepay.selected) : null;
  if (fromSelectedPackage !== null) return fromSelectedPackage;
  const packageSnapshot = objectOrNull(source.package_snapshot);
  const packageSnapshotPrepay = packageSnapshot ? objectOrNull(packageSnapshot.first_role_prepay) : null;
  return packageSnapshotPrepay ? booleanOrNull(packageSnapshotPrepay.selected) : null;
}

function firstRoleCheckoutSuccessCopy(selected: boolean | null): string {
  if (selected === true) {
    return "Your first role is prepaid. After setup, you can open your first role without another role charge.";
  }
  if (selected === false) {
    return "You can open roles after setup. Role fees are billed when roles are opened.";
  }
  return "";
}

function normalizeSetPasswordUrl(rawValue: unknown): string {
  if (typeof window === "undefined") return "";
  const raw = String(rawValue || "").trim();
  if (!raw) return "";
  try {
    const parsed = new URL(raw, window.location.origin);
    if (!["http:", "https:"].includes(parsed.protocol)) return "";
    if (isPlaceholderSetupUrl(parsed)) return passwordSetupPreviewUrl();
    return isTrustedSetupUrl(parsed) ? parsed.href : "";
  } catch (_) {
    return "";
  }
}

function isLocalDevelopmentHost(host: string): boolean {
  return host === "localhost" || host === "127.0.0.1" || host === "::1";
}

function isAlphaSourceHost(host: string): boolean {
  return host === "alphasourceai.com" || host.endsWith(".alphasourceai.com");
}

function isPasswordSetupPath(pathname: string): boolean {
  return pathname === "/pwreset" || pathname.startsWith("/pwreset/");
}

function configuredSupabaseAuthHost(): string {
  const configuredUrl = envText("VITE_SUPABASE_URL");
  if (!configuredUrl) return "";
  try {
    return new URL(configuredUrl).hostname.toLowerCase();
  } catch (_) {
    return "";
  }
}

function isTrustedPasswordSetupDestination(url: URL): boolean {
  const host = url.hostname.toLowerCase();
  return isPasswordSetupPath(url.pathname) && (
    host === window.location.hostname.toLowerCase() ||
    isAlphaSourceHost(host) ||
    isLocalDevelopmentHost(host)
  );
}

function isTrustedSupabaseAuthActionUrl(url: URL): boolean {
  const supabaseHost = configuredSupabaseAuthHost();
  if (!supabaseHost || url.hostname.toLowerCase() !== supabaseHost) return false;
  if (!url.pathname.startsWith("/auth/v1/")) return false;

  const redirectTo = url.searchParams.get("redirect_to");
  if (!redirectTo) return true;
  try {
    return isTrustedPasswordSetupDestination(new URL(redirectTo, window.location.origin));
  } catch (_) {
    return false;
  }
}

function isTrustedSetupUrl(url: URL): boolean {
  return isTrustedPasswordSetupDestination(url) || isTrustedSupabaseAuthActionUrl(url);
}

function isPlaceholderSetupUrl(url: URL): boolean {
  const host = url.hostname.toLowerCase();
  return host === "example.com" ||
    host === "www.example.com" ||
    host === "example.org" ||
    host === "example.net" ||
    host.includes("placeholder") ||
    host.endsWith(".invalid");
}

function passwordSetupPreviewUrl(): string {
  if (typeof window === "undefined") return PASSWORD_SETUP_PREVIEW_PATH;
  const currentPath = `${window.location.pathname}${window.location.search}`;
  const params = new URLSearchParams();
  params.set("return_to", currentPath || "/checkout/subscription-success?status=password_required");
  return `${PASSWORD_SETUP_PREVIEW_PATH}?${params.toString()}`;
}

const STATUS_COPY: Record<ReturnStatus, {
  eyebrow: string;
  title: string;
  body: string;
  tone: "success" | "pending" | "cancelled";
  primaryLabel: string;
  primaryHref?: string;
  secondaryLabel: string;
}> = {
  ready: {
    eyebrow: "Payment confirmed",
    title: "Your alphaScreen membership is ready.",
    body: "Your payment is confirmed and your account is active. Open the dashboard if you are already signed in, or sign in to continue.",
    tone: "success",
    primaryLabel: "Open dashboard",
    primaryHref: "/dashboard",
    secondaryLabel: "Sign in to continue",
  },
  password_required: {
    eyebrow: "Payment confirmed",
    title: "Set your password to continue.",
    body: "Your payment is confirmed. Set your password to finish account setup and access your alphaScreen dashboard.",
    tone: "success",
    primaryLabel: "Set your password",
    secondaryLabel: "Refresh status",
  },
  setup_email_sent: {
    eyebrow: "Payment confirmed",
    title: "Check your email to set your password.",
    body: "Check your email to set your password. If it does not arrive, refresh this page or contact alphaSource support.",
    tone: "success",
    primaryLabel: "Check your email to set password",
    secondaryLabel: "Refresh status",
  },
  setup_pending: {
    eyebrow: "Payment received",
    title: "We are setting up your account.",
    body: "We are confirming payment and preparing account setup. Refresh this page shortly for the next step.",
    tone: "pending",
    primaryLabel: "Refresh status",
    secondaryLabel: "Refresh status",
  },
  activation_pending: {
    eyebrow: "Setting up your account",
    title: "Your membership is almost ready.",
    body: "Your payment was received and account setup is still finishing. Dashboard access becomes available after setup is complete.",
    tone: "pending",
    primaryLabel: "Refresh status",
    secondaryLabel: "Refresh status",
  },
  payment_pending: {
    eyebrow: "Payment finalizing",
    title: "We are waiting for payment confirmation.",
    body: "Secure checkout may take a moment to confirm. Refresh this page shortly, or resume signup if checkout was not completed.",
    tone: "pending",
    primaryLabel: "Refresh status",
    secondaryLabel: "Resume signup",
  },
  cancelled: {
    eyebrow: "Payment not completed",
    title: "Checkout was not completed.",
    body: "No alphaScreen payment was completed from this return. You can resume membership signup when you are ready.",
    tone: "cancelled",
    primaryLabel: "Resume signup",
    primaryHref: "/alphascreen/pricing",
    secondaryLabel: "Talk to sales",
  },
};

export default function CheckoutSubscriptionSuccessPage() {
  const initialStatus = useMemo(() => readStatus(), []);
  const lookup = useMemo(() => readCheckoutLookup(), []);
  const statusEndpoint = useMemo(() => checkoutStatusEndpoint(lookup), [lookup]);
  const [status, setStatus] = useState<ReturnStatus>(initialStatus);
  const [statusError, setStatusError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [setPasswordUrl, setSetPasswordUrl] = useState(() => readSetPasswordUrl());
  const [firstRolePrepaySelected, setFirstRolePrepaySelected] = useState<boolean | null>(() => readInitialFirstRolePrepaySelected());
  const copy = STATUS_COPY[status];
  const Icon = copy.tone === "success" ? CheckCircle : copy.tone === "cancelled" ? AlertCircle : Clock3;
  const firstRoleCopy = firstRoleCheckoutSuccessCopy(firstRolePrepaySelected);

  const shouldPoll = useCallback((nextStatus: ReturnStatus) => {
    return POLLABLE_STATUSES.has(nextStatus) || (nextStatus === "password_required" && !setPasswordUrl);
  }, [setPasswordUrl]);

  const loadCheckoutStatus = useCallback(async (manual = false): Promise<ReturnStatus | null> => {
    if (!statusEndpoint) {
      if (manual && typeof window !== "undefined") window.location.reload();
      return null;
    }

    if (manual) setRefreshing(true);
    try {
      const response = await fetch(statusEndpoint, {
        method: "GET",
        headers: { Accept: "application/json" },
        credentials: "omit",
        cache: "no-store",
      });
      const data = await response.json().catch(() => null) as CheckoutStatusResponse | null;
      if (!response.ok) throw new Error("Status refresh failed.");
      const nextStatus = normalizeStatus(data?.status);
      const nextSetPasswordUrl = normalizeSetPasswordUrl(data?.set_password_url);
      const nextFirstRolePrepaySelected = data && typeof data === "object" ? resolveFirstRolePrepaySelected(data as Record<string, unknown>) : null;
      if (nextSetPasswordUrl) setSetPasswordUrl(nextSetPasswordUrl);
      if (nextFirstRolePrepaySelected !== null) setFirstRolePrepaySelected(nextFirstRolePrepaySelected);
      setStatus(nextStatus);
      setStatusError("");
      return nextStatus;
    } catch (_) {
      setStatusError("Status refresh is temporarily unavailable. Try again in a moment.");
      return null;
    } finally {
      if (manual) setRefreshing(false);
    }
  }, [statusEndpoint]);

  useEffect(() => {
    if (!statusEndpoint || !shouldPoll(status)) return undefined;

    let cancelled = false;
    let attempts = 0;
    let timer: number | undefined;

    const poll = async () => {
      attempts += 1;
      const nextStatus = await loadCheckoutStatus(false);
      if (cancelled) return;
      const currentStatus = nextStatus || status;
      if (attempts < MAX_STATUS_POLLS && shouldPoll(currentStatus)) {
        timer = window.setTimeout(poll, STATUS_POLL_INTERVAL_MS);
      }
    };

    timer = window.setTimeout(poll, 2000);
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [loadCheckoutStatus, shouldPoll, status, statusEndpoint]);

  const refresh = () => {
    void loadCheckoutStatus(true);
  };

  const isPasswordSetupStatus = status === "password_required" || status === "setup_email_sent";
  const primaryHref = status === "password_required" && setPasswordUrl ? setPasswordUrl : copy.primaryHref;
  const primaryIsGuidance = isPasswordSetupStatus && !primaryHref;
  const primaryIsRefresh = !primaryHref && !primaryIsGuidance;
  const secondaryHref = status === "cancelled"
    ? "/alphascreen/pricing#pricing-demo"
    : status === "payment_pending"
      ? "/alphascreen/pricing"
      : status === "ready"
        ? "/"
        : "";
  const backHref = status === "ready" ? "/dashboard" : "/alphascreen/pricing#pricing-demo";
  const backLabel = status === "ready" ? "Back to dashboard" : "Back to pricing";
  const nextStepCopy = isPasswordSetupStatus
    ? status === "password_required" && setPasswordUrl
      ? "Set your password to continue to account access."
      : "Check your email for the secure setup link, or refresh this page."
    : status === "ready"
      ? "Open the dashboard or sign in when you are ready."
      : statusEndpoint && POLLABLE_STATUSES.has(status)
        ? "We are checking for the next step automatically."
        : "Refresh this page shortly for the next step.";

  return (
    <section className="min-h-[calc(100vh-160px)] bg-[#F8F9FD] px-6 py-16 lg:py-20">
      <div className="mx-auto max-w-4xl">
        <div className="rounded-lg border border-[#0A1547]/10 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
            <div
              className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full ${
                copy.tone === "success"
                  ? "bg-[#02D99D]/10 text-[#02D99D]"
                  : copy.tone === "cancelled"
                    ? "bg-red-50 text-red-600"
                    : "bg-[#A380F6]/10 text-[#A380F6]"
              }`}
            >
              <Icon className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-black uppercase tracking-[0.18em] text-[#A380F6]">{copy.eyebrow}</p>
              <h1 className="mt-3 max-w-2xl text-3xl font-black leading-tight text-[#0A1547] sm:text-4xl">
                {copy.title}
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-relaxed text-[#0A1547]/60">{copy.body}</p>
            </div>
          </div>

          <div className="mt-8 grid gap-3 rounded-lg border border-[#0A1547]/10 bg-[#F8F9FD] p-4 sm:grid-cols-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.14em] text-[#02D99D]">Secure payment</p>
              <p className="mt-1 text-sm font-semibold leading-relaxed text-[#0A1547]/60">
                Payment details stay protected inside Stripe Checkout.
              </p>
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.14em] text-[#A380F6]">Account setup</p>
              <p className="mt-1 text-sm font-semibold leading-relaxed text-[#0A1547]/60">
                Setup may take a moment after payment confirmation.
              </p>
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.14em] text-[#02ABE0]">Next step</p>
              <p className="mt-1 text-sm font-semibold leading-relaxed text-[#0A1547]/60">
                {nextStepCopy}
              </p>
            </div>
          </div>
          {firstRoleCopy ? (
            <div className="mt-4 rounded-lg border border-[#02D99D]/25 bg-[#02D99D]/5 px-4 py-3">
              <p className="text-sm font-semibold leading-relaxed text-[#0A1547]/70">{firstRoleCopy}</p>
            </div>
          ) : null}

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            {primaryIsGuidance ? (
              <div className="inline-flex items-center justify-center gap-2 rounded-full bg-[#0A1547] px-6 py-3.5 text-sm font-black text-white">
                <ShieldCheck className="h-4 w-4" />
                {copy.primaryLabel}
              </div>
            ) : primaryIsRefresh ? (
              <button
                type="button"
                onClick={refresh}
                disabled={refreshing}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-[#0A1547] px-6 py-3.5 text-sm font-black text-white transition-opacity hover:opacity-90"
              >
                <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
                {refreshing ? "Refreshing..." : copy.primaryLabel}
              </button>
            ) : (
              <a
                href={primaryHref}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-[#0A1547] px-6 py-3.5 text-sm font-black text-white transition-opacity hover:opacity-90"
              >
                {copy.primaryLabel}
                <ArrowRight className="h-4 w-4" />
              </a>
            )}
            {secondaryHref ? (
              <a
                href={secondaryHref}
                className="inline-flex items-center justify-center gap-2 rounded-full border border-[#0A1547]/12 bg-white px-6 py-3.5 text-sm font-black text-[#0A1547] transition-colors hover:border-[#A380F6] hover:text-[#A380F6]"
              >
                {copy.secondaryLabel}
              </a>
            ) : (
              <button
                type="button"
                onClick={refresh}
                disabled={refreshing}
                className="inline-flex items-center justify-center gap-2 rounded-full border border-[#0A1547]/12 bg-white px-6 py-3.5 text-sm font-black text-[#0A1547] transition-colors hover:border-[#A380F6] hover:text-[#A380F6]"
              >
                <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
                {refreshing ? "Refreshing..." : copy.secondaryLabel}
              </button>
            )}
            {secondaryHref && !primaryIsRefresh ? (
              <button
                type="button"
                onClick={refresh}
                disabled={refreshing}
                className="inline-flex items-center justify-center gap-2 rounded-full border border-[#0A1547]/12 bg-white px-6 py-3.5 text-sm font-black text-[#0A1547]/65 transition-colors hover:border-[#02ABE0] hover:text-[#02ABE0]"
              >
                <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
                {refreshing ? "Refreshing..." : "Refresh status"}
              </button>
            ) : null}
          </div>

          {statusError ? (
            <p className="mt-4 text-sm font-semibold text-red-600">{statusError}</p>
          ) : null}

          <div className="mt-8 flex items-start gap-3 border-t border-[#0A1547]/10 pt-5 text-sm font-semibold leading-relaxed text-[#0A1547]/55">
            <ShieldCheck className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#02D99D]" />
            <p>
              For security, account access is completed only after payment confirmation and account setup are finished.
            </p>
          </div>
        </div>
        <div className="mt-5 flex justify-start">
          <a href={backHref} className={CHECKOUT_BACK_LINK_CLASS}>
            <ArrowLeft className="mr-1 mt-0.5 h-3.5 w-3.5" />
            {backLabel}
          </a>
        </div>
      </div>
    </section>
  );
}
