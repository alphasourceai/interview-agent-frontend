import { publicBackendBase } from "@/lib/urlConfig";

// Presentation only. This build flag is NOT proof of backend verification.
// The API's mandatory dev startup/HTTP/SDK fences remain authoritative.
export function pricingDevPresentation(backend: string, sandboxFlag: unknown, mailFlag?: unknown) {
  const dev = backend === "https://interview-agent-dev-backend.onrender.com";
  const sandbox = dev && sandboxFlag === "true";
  return { dev, sandbox, previewOnly: dev && !sandbox, ownerMail: sandbox && mailFlag === "true" };
}
const presentation = pricingDevPresentation(publicBackendBase, import.meta.env.VITE_DEV_PRICING_SANDBOX_ENABLED, import.meta.env.VITE_DEV_PRICING_TEST_MAIL_ENABLED);
export const isGuardedPricingDev = presentation.dev;
export const isDevBillingSandbox = presentation.sandbox;
export const isPricingPreviewOnly = presentation.previewOnly;
export const isPricingEmailHeld = presentation.dev && !presentation.ownerMail;
export const guardedPricingDevMessage = isDevBillingSandbox
  ? `Billing test controls are shown for dev Sandbox acct_1UPtmNHC5VkATVoE. The API still refuses them unless its own startup verification passed. ${presentation.ownerMail ? "Test email is restricted to configured Jason pricing-dev aliases. Voice and CRM remain off." : "Email, voice and CRM remain off."} No live payments.`
  : "This dev build supports pricing and agreement previews. Payments, renewals, usage collection, sending and signing are not available yet.";
