import { publicBackendBase } from "@/lib/urlConfig";

// Presentation only. The API's mandatory dev fence remains authoritative.
export const isGuardedPricingDev = publicBackendBase === "https://interview-agent-dev-backend.onrender.com";
export const guardedPricingDevMessage = "This dev build supports pricing and agreement previews. Payments, renewals, usage collection, sending and signing are not available yet.";
