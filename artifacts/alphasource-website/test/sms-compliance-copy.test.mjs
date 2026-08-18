import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => readFileSync(path.join(root, relativePath), "utf8");

const smsContract = read("src/lib/smsOtp.ts");
const interview = read("src/pages/InterviewPage.tsx");
const evidence = read("src/pages/SmsConsentEvidencePage.tsx");
const candidateTerms = read("src/pages/CandidateTermsPage.tsx");
const terms = read("src/pages/TermsPage.tsx");
const privacy = read("src/pages/PrivacyPage.tsx");
const prerender = read("scripts/prerender-public-routes.mjs");

test("approved sms-consent-v2 disclosure is shared by the live and evidence flows", () => {
  assert.match(smsContract, /SMS_CONSENT_COPY_VERSION = "sms-consent-v2"/);
  assert.match(smsContract, /Message frequency varies based on your verification requests and resends/);
  assert.match(smsContract, /Text message consent is optional; you may choose Email instead/);
  assert.match(interview, /SMS_CONSENT_DISCLOSURE/);
  assert.match(evidence, /SMS_CONSENT_DISCLOSURE/);
  for (const source of [interview, evidence]) {
    assert.match(source, /href="\/terms\/"/);
    assert.match(source, /href="\/privacy\/"/);
  }
});

test("public and candidate terms include the approved optional transactional sms terms", () => {
  assert.match(terms, /Effective Date: 8\/18\/2026/);
  assert.match(terms, /OPTIONAL TRANSACTIONAL TEXT MESSAGES/);
  assert.match(terms, /Reply STOP to opt out or HELP for help/);
  assert.match(terms, /Email verification remains available/);
  assert.match(candidateTerms, /Effective date: August 18, 2026/);
  assert.match(candidateTerms, /Optional Text-Message Verification/);
  assert.match(candidateTerms, /Text-message consent is optional/);
  assert.match(prerender, /Optional transactional text messages/);
});

test("privacy policy contains the approved provider-neutral mobile-data notice", () => {
  assert.match(privacy, /Effective Date: 8\/18\/2026/);
  assert.match(privacy, /MOBILE INFORMATION AND TRANSACTIONAL VERIFICATION MESSAGES/);
  assert.match(privacy, /keyed destination fingerprint/);
  assert.match(privacy, /We do not sell mobile information or share it with third parties for their own promotional or marketing purposes/);
  assert.match(privacy, /contracted messaging, carrier, security, and infrastructure providers/);
  assert.doesNotMatch(privacy, /Telnyx/);
  assert.match(prerender, /Mobile information and transactional verification messages/);
});
