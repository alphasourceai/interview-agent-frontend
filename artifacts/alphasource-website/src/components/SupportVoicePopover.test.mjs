import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./SupportVoicePopover.tsx", import.meta.url), "utf8");
const sentry = readFileSync(new URL("../lib/sentry.ts", import.meta.url), "utf8");
const admin = readFileSync(new URL("../pages/admin/AdminInterviewReliabilityPage.tsx", import.meta.url), "utf8");

test("support voice checks cached backend provider readiness before requesting microphone access", () => {
  assert.match(source, /\/api\/support\/voice\/health/);
  const start = source.indexOf("const startConversation");
  const preflight = source.indexOf("await checkProviderReadiness", start);
  const microphone = source.indexOf("getUserMedia", start);
  assert.ok(start >= 0 && preflight > start && microphone > preflight);
  assert.match(source, /providerReadiness === "ready"/);
  assert.match(source, /startPendingRef\.current/);
  assert.match(source, /finally \{\s*startPendingRef\.current = false;/);
});

test("support voice failure diagnostics use bounded stages and categories without identity or provider payloads", () => {
  assert.match(source, /captureSupportVoiceFailure\("microphone", denied \? "permission_denied" : "device_unavailable"\)/);
  assert.match(source, /captureSupportVoiceFailure\("authentication", "missing_session"\)/);
  assert.match(source, /captureSupportVoiceFailure\("session_create", category\)/);
  assert.match(source, /captureSupportVoiceFailure\("websocket", "closed_before_ready"\)/);
  const helper = sentry.slice(sentry.indexOf("export function captureSupportVoiceFailure"));
  assert.doesNotMatch(helper, /email|phone|user_id|access_token|credential|session_id/);
});

test("admin interview reliability displays only bounded cached support contract health", () => {
  assert.match(admin, /Dashboard support voice/);
  assert.match(admin, /provider_contract_ok/);
  assert.match(admin, /provider_last_success_at/);
  assert.match(admin, /provider_last_failure_category/);
  assert.match(admin, /SUPPORT_VOICE_FAILURE_CATEGORIES\.has\(failureCategory\)/);
  assert.match(admin, /Number\.isSafeInteger\(failureCount\)/);
  assert.match(admin, /setSupportVoiceHealth\(\{/);
  assert.doesNotMatch(admin, /XAI_API_KEY|instructions|provider_message|audio_payload/);
});
