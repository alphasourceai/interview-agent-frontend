import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const page = await readFile(path.join(here, "AdminSmsMonitoringPage.tsx"), "utf8");
const app = await readFile(path.join(here, "../../App.tsx"), "utf8");
const layout = await readFile(path.join(here, "../../components/AdminLayout.tsx"), "utf8");

test("admin route and navigation include the read-only SMS Monitoring page", () => {
  assert.match(app, /AdminSmsMonitoringPage/);
  assert.match(app, /path="\/admin\/sms-monitoring"/);
  assert.match(layout, /label: "SMS Monitoring"/);
  assert.match(layout, /href: "\/admin\/sms-monitoring"/);
  assert.match(page, /SMS Monitoring &amp; Compliance/);
  assert.match(page, /Read only/);
});

test("page covers delivery, controls, consent, compliance, spend, line type, and inbound operations", () => {
  for (const label of [
    "Delivery trend",
    "Runtime and compliance readiness",
    "Consent and suppressions",
    "Inbound controls and line type",
    "Spend and breaker protection",
    "Data retention enforcement",
    "Recent bounded incidents",
    "Formal compliance review",
    "LEGAL_REVIEW_REQUIRED",
  ]) assert.match(page, new RegExp(label));
  for (const range of ["24h", "7d", "30d"]) assert.match(page, new RegExp(`value="${range}"`));
});

test("readiness copy distinguishes configured controls from pending owner review", () => {
  assert.match(page, /Signed STOP\/START\/HELP controls are active with Telnyx Ed25519 verification/);
  assert.match(page, /mobile, landline, and VoIP lookup is enabled and fails closed/);
  assert.match(page, /daily spend cap is configured/);
  assert.match(page, /Keyed abuse controls are configured/);
  assert.match(page, /Review packet is ready; formal owner approval remains pending/);
  assert.match(page, /Daily enforcement is scheduled/);
  assert.match(page, /Only aggregate deletion counts are displayed/);
});

test("typography reserves heavy emphasis for page identity and primary metrics", () => {
  assert.match(page, /text-xs font-normal leading-relaxed/);
  assert.match(page, /text-xs font-medium leading-relaxed/);
  assert.match(page, /text-\[10px\] font-semibold uppercase tracking-wide/);
  assert.match(page, /px-4 py-3 font-medium/);
  assert.doesNotMatch(page, /px-4 py-3 font-black/);
});

test("page fetches only the protected aggregate endpoint with client scope", () => {
  assert.match(page, /\/admin\/sms-monitoring\?/);
  assert.match(page, /params\.set\("client_id", selectedClientId\)/);
  assert.match(page, /Authorization: `Bearer \$\{token\}`/);
  assert.match(page, /credentials: "omit"/);
  assert.doesNotMatch(page, /private_auth/);
  assert.doesNotMatch(page, /destination_fingerprint/);
  assert.doesNotMatch(page, /provider_message_id/);
  assert.doesNotMatch(page, /phone_e164/);
});

test("incidents explicitly omit sensitive candidate and message data", () => {
  assert.match(page, /No phone numbers, candidate identities, message IDs, fingerprints, or OTPs are displayed/);
  assert.match(page, /failure_category/);
  assert.match(page, /delivery_status/);
  assert.doesNotMatch(page, /Send SMS|Resend SMS|Release suppression/);
});
