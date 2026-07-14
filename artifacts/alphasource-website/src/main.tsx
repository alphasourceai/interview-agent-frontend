import { createRoot } from "react-dom/client";
import { Component, useEffect, type ErrorInfo, type ReactNode } from "react";
import * as Sentry from "@sentry/react";
import App from "./App";
import { initSentry, isSentryEnabled } from "./lib/sentry";
import "./index.css";

type AlphaSourceBootState = {
  htmlLoadedAt: number;
  moduleStarted: boolean;
  reactCommitted: boolean;
  recoveryAttempted: boolean;
};

declare global {
  interface Window {
    __ALPHASOURCE_BOOT__?: AlphaSourceBootState;
  }
}

const BOOT_RECOVERY_GUARD_KEY = "alphasource:boot-recovery-attempted:v1";
const BOOT_RECOVERY_PARAM = "__boot_retry";

if (typeof window !== "undefined" && window.__ALPHASOURCE_BOOT__) {
  window.__ALPHASOURCE_BOOT__.moduleStarted = true;
}

initSentry();

function markReactCommitted() {
  if (typeof window === "undefined") return;

  if (window.__ALPHASOURCE_BOOT__) {
    window.__ALPHASOURCE_BOOT__.reactCommitted = true;
  }

  try {
    window.sessionStorage.removeItem(BOOT_RECOVERY_GUARD_KEY);
  } catch {
    // Storage can be unavailable in privacy-restricted browser contexts.
  }

  try {
    const url = new URL(window.location.href);
    if (url.searchParams.has(BOOT_RECOVERY_PARAM)) {
      url.searchParams.delete(BOOT_RECOVERY_PARAM);
      window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
    }
  } catch {
    // The app is already running; a failed URL cleanup should not affect it.
  }
}

function removePublicCheckoutStaticFallback() {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-react-route-ready", "true");
  document.getElementById("public-checkout-static-fallback")?.remove();
}

function AppCrashFallback() {
  return (
    <section className="min-h-screen bg-[#F8F9FD] px-6 py-16 text-[#0A1547]">
      <div className="mx-auto max-w-xl rounded-lg border border-[#0A1547]/10 bg-white p-6 shadow-sm">
        <p className="text-sm font-black uppercase tracking-[0.18em] text-[#A380F6]">alphaScreen</p>
        <h1 className="mt-3 text-2xl font-black leading-tight">We could not load this step.</h1>
        <p className="mt-3 text-sm font-semibold leading-relaxed text-[#0A1547]/60">
          Please refresh or contact support.
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="inline-flex items-center justify-center rounded-full bg-[#0A1547] px-5 py-2.5 text-sm font-black text-white transition-opacity hover:opacity-90"
          >
            Refresh
          </button>
          <a
            href="/support/"
            className="inline-flex items-center justify-center rounded-full border border-[#0A1547]/12 bg-white px-5 py-2.5 text-sm font-black text-[#0A1547] transition-colors hover:border-[#A380F6] hover:text-[#A380F6]"
          >
            Contact support
          </a>
        </div>
      </div>
    </section>
  );
}

class RootErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error("[root] render_failed", {
      route: typeof window !== "undefined" ? window.location.pathname : "",
      error_name: error instanceof Error ? error.name : "unknown",
      component_stack_present: Boolean(info.componentStack),
    });
  }

  render() {
    if (this.state.hasError) return <AppCrashFallback />;
    return this.props.children;
  }
}

function ReactReadyMarker() {
  useEffect(() => {
    markReactCommitted();
    const frame = window.requestAnimationFrame(removePublicCheckoutStaticFallback);
    return () => window.cancelAnimationFrame(frame);
  }, []);

  return null;
}

if (import.meta.env.DEV && typeof window !== "undefined") {
  const prevOnError = window.onerror;
  const prevOnUnhandledRejection = window.onunhandledrejection;

  window.onerror = function onGlobalError(message, source, lineno, colno, error) {
    const timestamp = new Date().toISOString();
    const pathname = window.location.pathname;
    const url = window.location.href;
    const msg = typeof message === "string" ? message : String(message);
    const stack = error instanceof Error ? error.stack : undefined;

    console.error("[dev-runtime-error]", {
      timestamp,
      pathname,
      url,
      message: msg,
      source,
      lineno,
      colno,
      stack,
    });

    if (typeof prevOnError === "function") {
      return prevOnError.call(this, message, source, lineno, colno, error);
    }
    return false;
  };

  window.onunhandledrejection = function onGlobalUnhandledRejection(event) {
    const timestamp = new Date().toISOString();
    const pathname = window.location.pathname;
    const url = window.location.href;
    const reason = event.reason;
    const message =
      reason instanceof Error ? reason.message : typeof reason === "string" ? reason : String(reason);
    const stack = reason instanceof Error ? reason.stack : undefined;

    console.error("[dev-unhandled-rejection]", {
      timestamp,
      pathname,
      url,
      message,
      stack,
      reason,
    });

    if (typeof prevOnUnhandledRejection === "function") {
      return prevOnUnhandledRejection.call(this, event);
    }
  };
}

const app = (
  <RootErrorBoundary>
    <ReactReadyMarker />
    {isSentryEnabled() ? (
      <Sentry.ErrorBoundary showDialog={false} fallback={<AppCrashFallback />}>
        <App />
      </Sentry.ErrorBoundary>
    ) : (
      <App />
    )}
  </RootErrorBoundary>
);

createRoot(document.getElementById("root")!).render(app);
