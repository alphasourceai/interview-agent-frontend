export type OtpDeliveryChannel = "email" | "sms";

export const SMS_CONSENT_COPY_VERSION = "sms-consent-v2";
export const SMS_CONSENT_DISCLOSURE =
  "By selecting Text Message, you agree to receive transactional verification-code text messages you request from alphaScreen at the number shown above. Message frequency varies based on your verification requests and resends. Message and data rates may apply. Reply STOP to opt out or HELP for help. Text message consent is optional; you may choose Email instead.";

export function isCandidateSmsUiEnabled(env: Record<string, unknown>): boolean {
  return String(env.VITE_SMS_OTP_UI_ENABLED || "").trim().toLowerCase() === "true";
}

export function maskSmsDestination(value: string): string {
  const digits = String(value || "").replace(/\D/g, "");
  const suffix = digits.slice(-4);
  return suffix.length === 4 ? `(***) ***-${suffix}` : "your mobile number";
}

export function acceptedDeliveryOutcome(value: unknown): boolean {
  return String(value || "").trim().toLowerCase() === "accepted";
}
