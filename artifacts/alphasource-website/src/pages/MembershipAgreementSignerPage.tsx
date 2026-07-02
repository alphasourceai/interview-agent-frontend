import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, ArrowLeft, CheckCircle2, RefreshCw, X } from "lucide-react";

interface SignerPageProps {
  params?: {
    token?: string;
  };
}

interface SignerSession {
  agreement_id: string;
  state: string;
  status: string;
  is_current: boolean;
  checkout_status: string | null;
  client_legal_name: string;
  dba_trade_name: string;
  primary_admin_name: string;
  admin_email: string;
  membership_tier: string;
  billing_option: string;
  auto_renew: boolean;
  notice_deadline_days: number;
  first_role_prepay_selected: boolean | null;
  initial_term_start: string;
  initial_renewal_date: string;
  expires_at: string;
  sent_at: string;
  signed_at: string;
  opened_at: string;
  draft_pdf_url: string | null;
  executed_pdf_url: string | null;
}

interface EmbeddedCheckoutState {
  clientSecret: string;
  fallbackUrl: string;
  sessionId: string;
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
const CHECKOUT_RECOVERY_STORAGE_KEY = "alphascreen:retail_checkout_recovery:v1";
const CHECKOUT_BACK_LINK_CLASS =
  "inline-flex text-sm font-semibold text-[#A380F6] transition-colors hover:text-[#0A1547]";
const AGREEMENT_SLOW_LOAD_MS = 8000;

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

function parseJsonSafe(text: string): unknown {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function extractErrorMessage(text: string, fallback: string): string {
  if (!text) return fallback;
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

function toDisplayText(value: unknown): string {
  const raw = String(value || "").trim();
  if (!raw) return "—";
  return raw
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
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
  const fromPackageSnapshot = packageSnapshotPrepay ? booleanOrNull(packageSnapshotPrepay.selected) : null;
  if (fromPackageSnapshot !== null) return fromPackageSnapshot;
  const templateSnapshot = objectOrNull(source.template_snapshot);
  if (templateSnapshot) return resolveFirstRolePrepaySelected(templateSnapshot);
  return null;
}

function firstRolePrepayAgreementCopy(selected: boolean | null): string {
  if (selected === true) {
    return "Your first role is prepaid at the discounted website signup rate. You will not be charged again when you open your first role. Additional roles are billed at the standard role fee.";
  }
  if (selected === false) {
    return "You did not prepay your first role. Role fees are charged when roles are opened.";
  }
  return "";
}

function hasAgreementCreatedRecovery(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = window.sessionStorage.getItem(CHECKOUT_RECOVERY_STORAGE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return parsed.version === 1 && Boolean(parsed.purchase_result) && Boolean(parsed.agreement_result);
  } catch (_) {
    return false;
  }
}

function agreementBackHref(): string {
  return hasAgreementCreatedRecovery()
    ? "/alphascreen/pricing?checkout_recovery=agreement_created#signup-modal"
    : "/alphascreen/pricing#pricing-demo";
}

export default function MembershipAgreementSignerPage({ params }: SignerPageProps) {
  const token = useMemo(() => {
    const raw = String(params?.token || "").trim();
    if (!raw) return "";
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw;
    }
  }, [params?.token]);
  const checkoutReturnState = useMemo(() => {
    if (typeof window === "undefined") return "";
    return String(new URLSearchParams(window.location.search || "").get("checkout") || "").trim().toLowerCase();
  }, []);

  const [session, setSession] = useState<SignerSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [slowLoading, setSlowLoading] = useState(false);
  const [sessionError, setSessionError] = useState("");

  const [typedName, setTypedName] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitBusy, setSubmitBusy] = useState(false);
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [checkoutError, setCheckoutError] = useState("");
  const [embeddedCheckout, setEmbeddedCheckout] = useState<EmbeddedCheckoutState | null>(null);
  const [embeddedCheckoutLoading, setEmbeddedCheckoutLoading] = useState(false);
  const [embeddedCheckoutError, setEmbeddedCheckoutError] = useState("");

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const hasStrokeRef = useRef(false);
  const [hasSignature, setHasSignature] = useState(false);
  const embeddedCheckoutContainerRef = useRef<HTMLDivElement | null>(null);
  const embeddedCheckoutInstanceRef = useRef<{ unmount?: () => void; destroy?: () => void } | null>(null);
  const backHref = useMemo(() => agreementBackHref(), []);

  const prepareCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    canvas.width = Math.floor(rect.width * ratio);
    canvas.height = Math.floor(rect.height * ratio);

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(ratio, ratio);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, rect.width, rect.height);
    ctx.strokeStyle = "#0A1547";
    ctx.lineWidth = 2.4;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    prepareCanvas();
    const onResize = () => {
      prepareCanvas();
      hasStrokeRef.current = false;
      setHasSignature(false);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [prepareCanvas]);

  useEffect(() => {
    if (loading || sessionError || !session || String(session.state || "").toLowerCase() !== "signable") return;
    if (typeof window === "undefined") return;
    const rafId = window.requestAnimationFrame(() => {
      prepareCanvas();
      hasStrokeRef.current = false;
      setHasSignature(false);
    });
    return () => window.cancelAnimationFrame(rafId);
  }, [loading, sessionError, session, prepareCanvas]);

  useEffect(() => {
    if (!loading) {
      setSlowLoading(false);
      return undefined;
    }
    if (typeof window === "undefined") return undefined;
    const timer = window.setTimeout(() => setSlowLoading(true), AGREEMENT_SLOW_LOAD_MS);
    return () => window.clearTimeout(timer);
  }, [loading]);

  const getPoint = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const point = getPoint(event);
    drawingRef.current = true;
    canvas.setPointerCapture(event.pointerId);
    ctx.beginPath();
    ctx.moveTo(point.x, point.y);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const point = getPoint(event);
    ctx.lineTo(point.x, point.y);
    ctx.stroke();

    if (!hasStrokeRef.current) {
      hasStrokeRef.current = true;
      setHasSignature(true);
    }
  };

  const stopDrawing = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (canvas.hasPointerCapture(event.pointerId)) {
      canvas.releasePointerCapture(event.pointerId);
    }
    drawingRef.current = false;
  };

  const clearSignature = () => {
    prepareCanvas();
    hasStrokeRef.current = false;
    setHasSignature(false);
  };

  const loadSession = useCallback(async () => {
    if (!token) {
      setSession(null);
      setSessionError("This signing link is invalid.");
      setLoading(false);
      return;
    }

    if (!backendBase) {
      setSession(null);
      setSessionError("Missing backend base URL configuration.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setSlowLoading(false);
    setSessionError("");
    console.info("[agreement-signer] session_load_started", {
      route_present: true,
      token_present: Boolean(token),
      backend_configured: Boolean(backendBase),
    });

    try {
      const response = await fetch(`${backendBase}/membership-agreements/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "omit",
        body: JSON.stringify({ token }),
      });
      const text = await response.text();
      console.info("[agreement-signer] session_load_response", {
        ok: response.ok,
        status: response.status,
        body_present: Boolean(text),
      });
      if (!response.ok) {
        throw new Error(extractErrorMessage(text, "Could not load agreement session."));
      }

      const payload = parseJsonSafe(text);
      const sessionPayload =
        payload &&
        typeof payload === "object" &&
        (payload as { session?: unknown }).session &&
        typeof (payload as { session?: unknown }).session === "object"
          ? ((payload as { session: Record<string, unknown> }).session || null)
          : null;

      if (!sessionPayload) throw new Error("Could not load agreement session.");

      const resolvedState = String(sessionPayload.state || "").trim();
      const agreementId = String(sessionPayload.agreement_id || "").trim();
      if (!agreementId || !resolvedState) {
        throw new Error("Agreement session response was incomplete. Please refresh or contact support.");
      }
      setSession({
        agreement_id: agreementId,
        state: resolvedState,
        status: String(sessionPayload.status || "").trim(),
        is_current: Boolean(sessionPayload.is_current),
        checkout_status:
          String(sessionPayload.checkout_status || "").trim() || null,
        client_legal_name: String(sessionPayload.client_legal_name || "").trim(),
        dba_trade_name: String(sessionPayload.dba_trade_name || "").trim(),
        primary_admin_name: String(sessionPayload.primary_admin_name || "").trim(),
        admin_email: String(sessionPayload.admin_email || "").trim(),
        membership_tier: String(sessionPayload.membership_tier || "").trim(),
        billing_option: String(sessionPayload.billing_option || "").trim(),
        auto_renew: Boolean(sessionPayload.auto_renew),
        notice_deadline_days: Number(sessionPayload.notice_deadline_days || 0) || 0,
        first_role_prepay_selected: resolveFirstRolePrepaySelected(sessionPayload),
        initial_term_start: String(sessionPayload.initial_term_start || "").trim(),
        initial_renewal_date: String(sessionPayload.initial_renewal_date || "").trim(),
        expires_at: String(sessionPayload.expires_at || "").trim(),
        sent_at: String(sessionPayload.sent_at || "").trim(),
        signed_at: String(sessionPayload.signed_at || "").trim(),
        opened_at: String(sessionPayload.opened_at || "").trim(),
        draft_pdf_url: String(sessionPayload.draft_pdf_url || "").trim() || null,
        executed_pdf_url: String(sessionPayload.executed_pdf_url || "").trim() || null,
      });
      if (resolvedState.toLowerCase() === "signable") {
        setTypedName(String(sessionPayload.primary_admin_name || "").trim());
        setAccepted(false);
        clearSignature();
      }
      setSubmitError("");
      setCheckoutError("");
      setCheckoutBusy(false);
      setEmbeddedCheckout(null);
      setEmbeddedCheckoutLoading(false);
      setEmbeddedCheckoutError("");
    } catch (error) {
      setSession(null);
      setSessionError(error instanceof Error ? error.message : "Could not load agreement session.");
      console.info("[agreement-signer] session_load_failed", {
        token_present: Boolean(token),
        error_name: error instanceof Error ? error.name : "unknown",
      });
    } finally {
      setLoading(false);
    }
  }, [token, prepareCanvas]);

  useEffect(() => {
    void loadSession();
  }, [loadSession]);

  const sessionState = String(session?.state || "").trim().toLowerCase();
  const isSignableSession = sessionState === "signable";
  const isActivationPendingSession = sessionState === "activation_pending";
  const isActivationCompleteSession = sessionState === "activation_complete";
  const isAgreementSignedPendingPaymentSetupSession = sessionState === "agreement_signed_pending_payment_setup";
  const checkoutCanceled = checkoutReturnState === "cancel";
  const firstRolePrepayCopy = firstRolePrepayAgreementCopy(session?.first_role_prepay_selected ?? null);

  const handleSubmit = async () => {
    if (submitBusy) return;
    setSubmitError("");

    if (!backendBase) {
      setSubmitError("Missing backend base URL configuration.");
      return;
    }
    if (!token) {
      setSubmitError("Invalid signing token.");
      return;
    }
    if (!typedName.trim()) {
      setSubmitError("Typed name is required.");
      return;
    }
    if (!accepted) {
      setSubmitError("You must accept the agreement before signing.");
      return;
    }
    if (!hasSignature) {
      setSubmitError("A drawn signature is required.");
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) {
      setSubmitError("Signature pad is not available.");
      return;
    }

    const signatureDataUrl = canvas.toDataURL("image/png");

    setSubmitBusy(true);
    try {
      const response = await fetch(`${backendBase}/membership-agreements/sign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "omit",
        body: JSON.stringify({
          token,
          typed_name: typedName.trim(),
          accepted,
          signature_image_data_url: signatureDataUrl,
        }),
      });
      const text = await response.text();
      if (!response.ok) {
        throw new Error(extractErrorMessage(text, "Could not complete signature."));
      }

      setSubmitError("");
      await loadSession();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Could not complete signature.");
    } finally {
      setSubmitBusy(false);
    }
  };

  const handleContinueToCheckout = async () => {
    if (checkoutBusy) return;
    setCheckoutError("");
    if (!backendBase) {
      setCheckoutError("Missing backend base URL configuration.");
      return;
    }
    if (!token) {
      setCheckoutError("Invalid signing token.");
      return;
    }

    setCheckoutBusy(true);
    try {
      const response = await fetch(`${backendBase}/membership-agreements/checkout-session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "omit",
        body: JSON.stringify({ token }),
      });
      const text = await response.text();
      const payload = parseJsonSafe(text) as {
        url?: unknown;
        session_id?: unknown;
        checkout_client_secret?: unknown;
        detail?: unknown;
        message?: unknown;
        error?: unknown;
      } | null;
      if (!response.ok) {
        throw new Error(
          (payload && typeof payload === "object" && (
            (typeof payload.detail === "string" && payload.detail.trim()) ||
            (typeof payload.message === "string" && payload.message.trim()) ||
            (typeof payload.error === "string" && payload.error.trim())
          )) || "Could not start checkout."
        );
      }
      const checkoutUrl = String(payload?.url || "").trim();
      const checkoutClientSecret = String(payload?.checkout_client_secret || "").trim();
      const checkoutSessionId = String(payload?.session_id || "").trim();

      if (checkoutClientSecret && stripePublishableKey) {
        setEmbeddedCheckout({
          clientSecret: checkoutClientSecret,
          fallbackUrl: checkoutUrl,
          sessionId: checkoutSessionId,
        });
        return;
      }

      if (!checkoutUrl) {
        if (checkoutClientSecret && !stripePublishableKey) {
          throw new Error("Missing Stripe publishable key.");
        }
        throw new Error("Checkout URL is missing.");
      }
      openCheckoutUrl(checkoutUrl);
    } catch (error) {
      setCheckoutError(error instanceof Error ? error.message : "Could not start checkout.");
    } finally {
      setCheckoutBusy(false);
    }
  };

  const closeEmbeddedCheckout = useCallback(() => {
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
  }, []);

  useEffect(() => {
    const clientSecret = String(embeddedCheckout?.clientSecret || "").trim();
    const sessionId = String(embeddedCheckout?.sessionId || "").trim();
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
            closeEmbeddedCheckout();
            if (backendBase && sessionId) {
              window.location.assign(
                `${backendBase}/checkout/subscription-success?session_id=${encodeURIComponent(sessionId)}`
              );
              return;
            }
            void loadSession();
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
  }, [embeddedCheckout?.clientSecret, embeddedCheckout?.fallbackUrl, embeddedCheckout?.sessionId, closeEmbeddedCheckout, loadSession]);

  return (
    <div
      className="min-h-screen bg-[#F6F8FF] px-4 py-8 sm:px-6 sm:py-10"
      style={{ fontFamily: "'Raleway', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}
    >
      <div className="mx-auto w-full max-w-5xl space-y-4">
        <div
          className="rounded-2xl bg-white px-5 py-4 sm:px-6"
          style={{ border: "1px solid rgba(10,21,71,0.08)", boxShadow: "0 8px 26px rgba(10,21,71,0.08)" }}
        >
          <p className="text-[10px] font-black uppercase tracking-widest text-[#0A1547]/40">alphaScreen</p>
          <h1 className="mt-1 text-lg sm:text-xl font-black text-[#0A1547]">
            {isActivationPendingSession
              ? "Membership Activation"
              : isActivationCompleteSession
                ? "Membership Activated"
                : isAgreementSignedPendingPaymentSetupSession
                  ? "Agreement Signed"
                  : "Membership Agreement Signature"}
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-[#0A1547]/60">
            {isActivationPendingSession
              ? "Your agreement is signed. Continue to secure payment to activate billing and account setup."
              : isActivationCompleteSession
                ? "Checkout is complete. Continue to account setup if needed."
                : isAgreementSignedPendingPaymentSetupSession
                  ? "Your agreement is signed. Continue to secure payment to activate billing and account setup."
                  : "Review the agreement draft, then type your name, confirm acceptance, and draw your signature."}
          </p>
        </div>

        <div
          className="rounded-2xl bg-white px-5 py-5 sm:px-6"
          style={{ border: "1px solid rgba(10,21,71,0.08)", boxShadow: "0 8px 26px rgba(10,21,71,0.08)" }}
        >
          {loading ? (
            <div className="rounded-xl border border-[#0A1547]/10 bg-[#F8F9FD] px-4 py-3">
              <p className="text-sm font-semibold text-[#0A1547]/65">Loading agreement session...</p>
              {slowLoading ? (
                <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                  <p className="text-xs font-semibold leading-relaxed text-amber-700">
                    Still loading agreement. Refresh this page, or contact support if it does not continue.
                  </p>
                  <div className="mt-2 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        void loadSession();
                      }}
                      className={CHECKOUT_BACK_LINK_CLASS}
                    >
                      Refresh
                    </button>
                    <a href="/support/" className={CHECKOUT_BACK_LINK_CLASS}>Contact support</a>
                  </div>
                </div>
              ) : null}
            </div>
          ) : sessionError ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
              <p className="flex items-start gap-2 text-sm font-semibold text-red-600">
                <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                {sessionError}
              </p>
              <button
                type="button"
                onClick={() => {
                  void loadSession();
                }}
                className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-[#A380F6] px-4 py-2 text-xs font-bold text-white hover:opacity-90"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Retry
              </button>
            </div>
          ) : !session ? (
            <p className="text-sm font-semibold text-[#0A1547]/55">No agreement session available.</p>
          ) : isAgreementSignedPendingPaymentSetupSession ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-4">
              <p className="flex items-start gap-2 text-sm font-semibold text-emerald-700">
                <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0" />
                Your agreement is signed. Continue to secure payment to activate billing and account setup.
              </p>
              {checkoutCanceled ? (
                <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700">
                  Checkout was canceled. Your signed agreement is saved, and you can resume secure payment when ready.
                </p>
              ) : null}
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-emerald-200 bg-white/70 px-3.5 py-3">
                  <p className="text-[10px] font-black uppercase tracking-widest text-emerald-700/70">Client</p>
                  <p className="mt-1 text-sm font-bold text-emerald-800">{session.client_legal_name || "—"}</p>
                  <p className="text-[11px] text-emerald-800/75">{session.dba_trade_name || "No DBA"}</p>
                </div>
                <div className="rounded-xl border border-emerald-200 bg-white/70 px-3.5 py-3">
                  <p className="text-[10px] font-black uppercase tracking-widest text-emerald-700/70">Membership</p>
                  <p className="mt-1 text-sm font-bold text-emerald-800">{toDisplayText(session.membership_tier)}</p>
                  <p className="text-[11px] text-emerald-800/75">Billing: {toDisplayText(session.billing_option)}</p>
                </div>
              </div>
              {firstRolePrepayCopy ? (
                <p className="mt-3 rounded-xl border border-emerald-200 bg-white/70 px-3.5 py-3 text-xs font-semibold leading-relaxed text-emerald-800">
                  {firstRolePrepayCopy}
                </p>
              ) : null}
              <div className="mt-3 flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    void handleContinueToCheckout();
                  }}
                  disabled={checkoutBusy}
                  className="rounded-full px-5 py-2.5 text-sm font-bold text-white transition-all"
                  style={{
                    backgroundColor: checkoutBusy ? "rgba(10,21,71,0.25)" : "#A380F6",
                    cursor: checkoutBusy ? "not-allowed" : "pointer",
                  }}
                >
                  {checkoutBusy ? "Opening checkout..." : "Continue to secure checkout"}
                </button>
                {session.executed_pdf_url ? (
                  <a
                    href={session.executed_pdf_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-full border border-emerald-300 bg-white px-4 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-100/70"
                  >
                    View signed agreement
                  </a>
                ) : null}
                {checkoutError ? <p className="text-xs font-semibold text-red-500">{checkoutError}</p> : null}
              </div>
            </div>
          ) : isActivationPendingSession ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-4">
              <p className="flex items-start gap-2 text-sm font-semibold text-emerald-700">
                <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0" />
                Your agreement is signed. Continue to secure payment to activate billing and account setup.
              </p>
              {checkoutCanceled ? (
                <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700">
                  Checkout was canceled. Your signed agreement is saved, and you can resume secure payment when ready.
                </p>
              ) : null}
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-emerald-200 bg-white/70 px-3.5 py-3">
                  <p className="text-[10px] font-black uppercase tracking-widest text-emerald-700/70">Client</p>
                  <p className="mt-1 text-sm font-bold text-emerald-800">{session.client_legal_name || "—"}</p>
                  <p className="text-[11px] text-emerald-800/75">{session.dba_trade_name || "No DBA"}</p>
                </div>
                <div className="rounded-xl border border-emerald-200 bg-white/70 px-3.5 py-3">
                  <p className="text-[10px] font-black uppercase tracking-widest text-emerald-700/70">Membership</p>
                  <p className="mt-1 text-sm font-bold text-emerald-800">{toDisplayText(session.membership_tier)}</p>
                  <p className="text-[11px] text-emerald-800/75">Billing: {toDisplayText(session.billing_option)}</p>
                </div>
              </div>
              {firstRolePrepayCopy ? (
                <p className="mt-3 rounded-xl border border-emerald-200 bg-white/70 px-3.5 py-3 text-xs font-semibold leading-relaxed text-emerald-800">
                  {firstRolePrepayCopy}
                </p>
              ) : null}
              <div className="mt-3 flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    void handleContinueToCheckout();
                  }}
                  disabled={checkoutBusy}
                  className="rounded-full px-5 py-2.5 text-sm font-bold text-white transition-all"
                  style={{
                    backgroundColor: checkoutBusy ? "rgba(10,21,71,0.25)" : "#A380F6",
                    cursor: checkoutBusy ? "not-allowed" : "pointer",
                  }}
                >
                  {checkoutBusy ? "Opening checkout..." : "Continue to secure checkout"}
                </button>
                {session.executed_pdf_url ? (
                  <a
                    href={session.executed_pdf_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-full border border-emerald-300 bg-white px-4 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-100/70"
                  >
                    View signed agreement
                  </a>
                ) : null}
                {checkoutError ? <p className="text-xs font-semibold text-red-500">{checkoutError}</p> : null}
              </div>
            </div>
          ) : isActivationCompleteSession ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-4">
              <p className="flex items-start gap-2 text-sm font-semibold text-emerald-700">
                <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0" />
                Membership checkout is complete.
              </p>
              <p className="mt-2 text-xs text-emerald-700/90">
                If you are a new user, continue from your set-password email or refresh your login flow.
              </p>
              {firstRolePrepayCopy ? (
                <p className="mt-3 rounded-xl border border-emerald-200 bg-white/70 px-3.5 py-3 text-xs font-semibold leading-relaxed text-emerald-800">
                  {firstRolePrepayCopy}
                </p>
              ) : null}
              {session.executed_pdf_url ? (
                <div className="mt-3">
                  <a
                    href={session.executed_pdf_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-full border border-emerald-300 bg-white px-4 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-100/70"
                  >
                    View signed agreement
                  </a>
                </div>
              ) : null}
            </div>
          ) : isSignableSession ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-gray-200 px-3.5 py-3">
                  <p className="text-[10px] font-black uppercase tracking-widest text-[#0A1547]/40">Client</p>
                  <p className="mt-1 text-sm font-bold text-[#0A1547]">{session.client_legal_name || "—"}</p>
                  <p className="text-[11px] text-[#0A1547]/55">{session.dba_trade_name || "No DBA"}</p>
                </div>
                <div className="rounded-xl border border-gray-200 px-3.5 py-3">
                  <p className="text-[10px] font-black uppercase tracking-widest text-[#0A1547]/40">Membership</p>
                  <p className="mt-1 text-sm font-bold text-[#0A1547]">{toDisplayText(session.membership_tier)}</p>
                  <p className="text-[11px] text-[#0A1547]/55">Billing: {toDisplayText(session.billing_option)}</p>
                </div>
                <div className="rounded-xl border border-gray-200 px-3.5 py-3">
                  <p className="text-[10px] font-black uppercase tracking-widest text-[#0A1547]/40">Primary Admin</p>
                  <p className="mt-1 text-sm font-bold text-[#0A1547]">{session.primary_admin_name || "—"}</p>
                  <p className="text-[11px] text-[#0A1547]/55">{session.admin_email || "—"}</p>
                </div>
                <div className="rounded-xl border border-gray-200 px-3.5 py-3">
                  <p className="text-[10px] font-black uppercase tracking-widest text-[#0A1547]/40">Link Expires</p>
                  <p className="mt-1 text-sm font-bold text-[#0A1547]">{formatDate(session.expires_at)}</p>
                  <p className="text-[11px] text-[#0A1547]/55">Notice deadline: {session.notice_deadline_days || 30} days</p>
                </div>
              </div>
              {firstRolePrepayCopy ? (
                <p className="rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-3 text-xs font-semibold leading-relaxed text-[#0A1547]/65">
                  {firstRolePrepayCopy}
                </p>
              ) : null}

              <div>
                <p className="mb-2 text-xs font-black uppercase tracking-widest text-[#0A1547]/40">Agreement Preview</p>
                {session.draft_pdf_url ? (
                  <iframe
                    title="Membership Agreement Draft Preview"
                    src={session.draft_pdf_url}
                    className="min-h-[420px] w-full rounded-xl border border-gray-200"
                  />
                ) : (
                  <p className="rounded-xl border border-gray-200 px-3.5 py-3 text-xs font-semibold text-[#0A1547]/55">
                    Preview is unavailable, but you can still complete the signature flow.
                  </p>
                )}
              </div>

              <div className="space-y-3 rounded-xl border border-gray-200 px-3.5 py-3.5">
                <label className="block text-[10px] font-black uppercase tracking-widest text-[#0A1547]/40">
                  Typed Name
                  <input
                    type="text"
                    value={typedName}
                    onChange={(event) => setTypedName(event.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-[rgba(10,21,71,0.12)] bg-white px-3 py-2.5 text-sm font-semibold text-[#0A1547] outline-none transition-colors focus:border-[#A380F6]"
                    placeholder="Type your legal name"
                  />
                </label>

                <label className="flex items-start gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-xs font-semibold text-[#0A1547]/75">
                  <input
                    type="checkbox"
                    checked={accepted}
                    onChange={(event) => setAccepted(event.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-gray-300 accent-[#A380F6]"
                  />
                  I have read and agree to the alphaScreen Membership Agreement.
                </label>

                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <p className="text-[10px] font-black uppercase tracking-widest text-[#0A1547]/40">Draw Signature</p>
                    <button
                      type="button"
                      onClick={clearSignature}
                      className="rounded-full border border-gray-200 px-3 py-1 text-[11px] font-bold text-[#0A1547]/65 hover:bg-gray-50"
                    >
                      Clear
                    </button>
                  </div>
                  <canvas
                    ref={canvasRef}
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={stopDrawing}
                    onPointerLeave={stopDrawing}
                    onPointerCancel={stopDrawing}
                    className="h-[190px] w-full rounded-xl border border-[rgba(10,21,71,0.14)] bg-[#FCFCFF]"
                    style={{ touchAction: "none" }}
                  />
                </div>

                {submitError ? <p className="text-xs font-semibold text-red-500">{submitError}</p> : null}

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      void handleSubmit();
                    }}
                    disabled={submitBusy}
                    className="rounded-full px-5 py-2.5 text-sm font-bold text-white transition-all"
                    style={{
                      backgroundColor: submitBusy ? "rgba(10,21,71,0.25)" : "#A380F6",
                      cursor: submitBusy ? "not-allowed" : "pointer",
                    }}
                  >
                    {submitBusy ? "Submitting..." : "Sign Agreement"}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm font-semibold text-[#0A1547]/55">This agreement is no longer available.</p>
          )}
        </div>
        <div className="flex justify-start">
          <a href={backHref} className={CHECKOUT_BACK_LINK_CLASS}>
            <ArrowLeft className="mr-1 mt-0.5 h-3.5 w-3.5" />
            Back
          </a>
        </div>
        {embeddedCheckout ? (
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
                  <h3 className="text-sm font-black text-[#0A1547] leading-snug">Complete membership activation</h3>
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
                {embeddedCheckoutLoading ? (
                  <p className="mb-3 text-xs font-semibold text-[#0A1547]/45">Loading checkout…</p>
                ) : null}
                {embeddedCheckoutError ? (
                  <p className="mb-3 text-xs font-semibold text-red-500">{embeddedCheckoutError}</p>
                ) : null}
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
        ) : null}
      </div>
    </div>
  );
}
