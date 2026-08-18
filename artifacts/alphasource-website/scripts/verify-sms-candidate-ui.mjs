import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const page = fs.readFileSync(path.join(projectRoot, "src/pages/InterviewPage.tsx"), "utf8");
const contract = fs.readFileSync(path.join(projectRoot, "src/lib/smsOtp.ts"), "utf8");

const required = [
  "VITE_SMS_OTP_UI_ENABLED",
  "sms-consent-v2",
  "Message frequency varies based on your verification requests and resends",
  "Text message consent is optional; you may choose Email instead",
  "Text Message",
  "Message and data rates may apply",
  "Reply STOP to opt out or HELP for help",
  "otp_channel",
  "consent_copy_version",
  "email_fallback_available",
  "We will not retry automatically",
  "Use email instead",
  "phoneCountry === \"US\"",
];

const source = `${page}\n${contract}`;
const missing = required.filter((value) => !source.includes(value));
if (missing.length > 0) {
  throw new Error(`Candidate SMS UI contract is missing: ${missing.join(", ")}`);
}

if (!/String\(env\.VITE_SMS_OTP_UI_ENABLED \|\| ""\).*=== "true"/s.test(contract)) {
  throw new Error("Candidate SMS UI must be disabled unless explicitly set to true");
}
if (/provider_message_id|TELNYX_API_KEY|phone_e164/.test(page)) {
  throw new Error("Candidate UI must not expose provider bindings, credentials, or canonical E.164");
}
if (!page.includes('setOtpChannel("email")')) {
  throw new Error("Candidate UI must preserve explicit email fallback");
}
const challengeAdoption = page.indexOf("if (nextChallengeId) {\n        setInterviewAuth");
const smsResendFallback = page.indexOf('if (channel === "sms" && !accepted)');
if (challengeAdoption < 0 || smsResendFallback < 0 || challengeAdoption > smsResendFallback) {
  throw new Error("Candidate UI must adopt a replacement SMS challenge before handling non-accepted delivery");
}

console.log("Verified feature-gated candidate SMS selection, consent, privacy, and explicit email fallback contracts.");
