import { trackEvent } from "@/lib/analytics";

export type SelfServePlan = "basic" | "pro" | "unknown";
export type SelfServeStep =
  | "pricing"
  | "plan_selection"
  | "account_info"
  | "company_info"
  | "membership_info"
  | "billing"
  | "checkout"
  | "onboarding";

type SelfServeProperties = {
  plan?: SelfServePlan;
  step?: SelfServeStep;
  completion_percent?: number;
  error_type?: "validation" | "payment" | "network" | "backend" | "unknown";
};

export function trackSelfServeSignupEvent(
  eventName:
    | "pricing_page_viewed"
    | "plan_selected"
    | "signup_started"
    | "signup_step_viewed"
    | "signup_step_completed"
    | "checkout_started"
    | "checkout_completed"
    | "checkout_failed"
    | "checkout_abandoned"
    | "signup_completed",
  properties: SelfServeProperties = {},
) {
  trackEvent(eventName, properties);
}
