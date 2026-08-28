import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pricing = fs.readFileSync(path.join(projectRoot, "src/pages/AlphaScreenPricingPage.tsx"), "utf8");
const product = fs.readFileSync(path.join(projectRoot, "src/pages/AlphaScreenPage.tsx"), "utf8");
const contract = fs.readFileSync(path.join(projectRoot, "src/lib/smsOtp.ts"), "utf8");
const source = `${pricing}\n${contract}`;

const required = [
  "VITE_SMS_RETAIL_OTP_UI_ENABLED",
  "sms-consent-v2",
  "Text Message",
  "Message frequency varies based on your verification requests and resends",
  "Reply STOP to opt out or HELP for help",
  "Text message consent is optional; you may choose Email instead",
  'channel === "sms" ? "sms" : "email"',
  "-verification",
  "consent_copy_version",
  "U.S. mobile numbers only",
  "Verify the buyer by email or text message",
  "Text taking longer than expected?",
  "Use email instead",
  "SMS_VERIFICATION_RESEND_COOLDOWN_SECONDS = 120",
  "SMS_EMAIL_FALLBACK_REVEAL_SECONDS = 60",
];

const missing = required.filter((value) => !source.includes(value));
if (missing.length > 0) {
  throw new Error(`Retail SMS UI contract is missing: ${missing.join(", ")}`);
}

if (!/String\(env\.VITE_SMS_RETAIL_OTP_UI_ENABLED \|\| ""\).*=== "true"/s.test(contract)) {
  throw new Error("Retail SMS UI must be disabled unless explicitly set to true");
}
if (/provider_message_id|TELNYX_API_KEY|phone_e164/.test(pricing)) {
  throw new Error("Retail UI must not expose provider bindings, credentials, or canonical E.164");
}
if (!pricing.includes('const [verificationChannel, setVerificationChannel] = useState<OtpDeliveryChannel>("email")')) {
  throw new Error("Retail verification must preserve email as the default fallback");
}
if (!/verificationChannel === "sms"[\s\S]{0,160}body: JSON\.stringify\(\{ consent_copy_version: SMS_CONSENT_COPY_VERSION \}\)/.test(pricing)) {
  throw new Error("Retail SMS send must submit the approved consent-copy version");
}
if (!product.includes('markClassName="h-[3.125rem] w-[3.125rem] min-[360px]:h-[3.75rem] min-[360px]:w-[3.75rem] sm:h-[4rem] sm:w-[4rem] lg:h-[4.625rem] lg:w-[4.625rem]"')
  || !product.includes('wordmarkClassName="text-[2.275rem] min-[360px]:text-[2.7rem] sm:text-[2.975rem] lg:text-[3.975rem]"')) {
  throw new Error("Main alphaScreen hero lockup must retain the requested 15 percent size increase");
}

console.log("Verified feature-gated retail SMS selection, consent, email fallback, privacy, and hero-logo sizing contracts.");
