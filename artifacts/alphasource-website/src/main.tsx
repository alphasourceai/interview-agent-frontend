import { createRoot } from "react-dom/client";
import * as Sentry from "@sentry/react";
import App from "./App";
import { initSentry, isSentryEnabled } from "./lib/sentry";
import "./index.css";

initSentry();

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

const app = isSentryEnabled() ? (
  <Sentry.ErrorBoundary showDialog={false} fallback={<></>}>
    <App />
  </Sentry.ErrorBoundary>
) : (
  <App />
);

createRoot(document.getElementById("root")!).render(app);
