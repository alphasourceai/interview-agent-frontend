import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import {
  INTERVIEW_TYPE_CAUTIONS,
  INTERVIEW_TYPE_SELECTION_GUIDE,
  RUBRIC_FAQ,
} from "../src/content/rubricGuidance.ts";
import { getInterviewTypeLabel } from "../src/lib/interviewContract.ts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REPO_ROOT = path.resolve(ROOT, "../..");

test("FAQ contains every approved concise answer", () => {
  assert.equal(RUBRIC_FAQ.length, 8);
  const faq = Object.fromEntries(RUBRIC_FAQ.map((item) => [item.question, item.answer]));
  assert.equal(faq["What determines interview length?"], "Membership determines interview length. Basic interviews are 10 minutes, Pro interviews are 12 minutes, and Enterprise interviews are 15 minutes.");
  assert.equal(faq["What determines the number of questions?"], "Membership determines the number of scored questions. Basic includes 5, Pro includes 6, and Enterprise includes 7.");
  assert.match(faq["What does interview type control?"], /Core, Leadership, or Technical/);
  assert.match(faq["What is a Core interview?"], /not limited to entry-level roles/);
  assert.match(faq["Why does the interview begin with a warm-up?"], /not scored and is not used in hiring recommendations/);
  assert.match(faq["Does the warm-up count as an interview question?"], /separate from the membership-level scored-question count/);
});

test("selection guide includes all approved guides and cautions", () => {
  assert.deepEqual(INTERVIEW_TYPE_SELECTION_GUIDE.map((guide) => guide.value), ["core", "leadership", "technical"]);
  assert.ok(INTERVIEW_TYPE_SELECTION_GUIDE.every((guide) => guide.bullets.length === 3));
  assert.deepEqual(INTERVIEW_TYPE_CAUTIONS, [
    "Core does not mean entry-level.",
    "Do not select Leadership based only on seniority.",
    "Do not select Technical merely because the role uses software or tools.",
    "Membership determines interview time and question quantity.",
    "Interview type determines question substance.",
  ]);
});

test("sanitized product-review fixtures cover creation and legacy rendering without client data", () => {
  const fixtures = JSON.parse(fs.readFileSync(path.join(ROOT, "test/fixtures/sanitized-rubric-product-review.json"), "utf8"));
  const review = fs.readFileSync(path.join(REPO_ROOT, "docs/alphascreen-rubric-product-review.md"), "utf8");
  assert.deepEqual(fixtures.roles.map((role) => role.interview_type), ["core", "leadership", "technical"]);
  assert.match(review, /Operations Coordinator[\s\S]*Submitted value: `core`/);
  assert.match(review, /Regional Operations Manager[\s\S]*Submitted value: `leadership`/);
  assert.match(review, /Full-Stack Engineer[\s\S]*Submitted value: `technical`/);
  assert.match(review, /membership and interview-type cards are separate/i);
  assert.match(review, /Stored value[\s\S]*`basic`[\s\S]*Core[\s\S]*`detailed`[\s\S]*Leadership/);
  assert.match(review, /Review status: PASS/);
  for (const role of fixtures.legacy_roles) {
    assert.equal(getInterviewTypeLabel(role.interview_type), role.expected_type_label);
    assert.doesNotMatch(role.title, /@|client|candidate/i);
  }
});

test("dashboard and public FAQ surfaces reuse the approved content", () => {
  const dashboardFaq = fs.readFileSync(path.join(ROOT, "src/pages/dashboard/FaqPage.tsx"), "utf8");
  const publicContent = fs.readFileSync(path.join(ROOT, "src/lib/publicContent.ts"), "utf8");
  assert.match(dashboardFaq, /RUBRIC_FAQ/);
  assert.match(dashboardFaq, /Interview types, membership, and warm-up/);
  assert.match(publicContent, /RUBRIC_FAQ/);
  assert.match(publicContent, /Interview Types, Membership & Warm-up/);
});
