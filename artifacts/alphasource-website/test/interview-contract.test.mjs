import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import {
  BACKEND_CONTRACT_COMMIT,
  CANONICAL_INTERVIEW_TYPES,
  formatMembershipCapacity,
  getInterviewTypeLabel,
  getInterviewTypeOption,
  INTERVIEW_TYPE_OPTIONS,
  MEMBERSHIP_CAPACITY,
  normalizeInterviewTypeForRead,
  normalizeMembershipLevel,
  resolveMembershipCapacity,
  toCanonicalInterviewTypeWrite,
} from "../src/lib/interviewContract.ts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("canonical interview types stay ordered and use exact approved tooltips", () => {
  assert.deepEqual(CANONICAL_INTERVIEW_TYPES, ["core", "leadership", "technical"]);
  assert.deepEqual(INTERVIEW_TYPE_OPTIONS.map((option) => option.label), ["Core", "Leadership", "Technical"]);
  assert.deepEqual(INTERVIEW_TYPE_OPTIONS.map((option) => option.tooltip), [
    "Broad screening of relevant experience, judgment, ownership, communication, adaptability, and role readiness.",
    "Management and leadership screening focused on coaching, accountability, prioritization, conflict, change, and execution.",
    "Role-specific applied assessment of technical knowledge, troubleshooting, implementation, tradeoffs, risk, and quality.",
  ]);
  assert.match(INTERVIEW_TYPE_OPTIONS[0].supporting, /does not mean entry-level/);
});

test("legacy reads normalize without changing membership terminology", () => {
  assert.equal(normalizeInterviewTypeForRead("basic"), "core");
  assert.equal(normalizeInterviewTypeForRead("BASIC"), "core");
  assert.equal(normalizeInterviewTypeForRead("detailed"), "leadership");
  assert.equal(normalizeInterviewTypeForRead("technical"), "technical");
  assert.equal(getInterviewTypeLabel("basic"), "Core");
  assert.equal(getInterviewTypeLabel("detailed"), "Leadership");
  assert.equal(normalizeMembershipLevel("Essential"), "basic");
  assert.equal(normalizeMembershipLevel("Basic"), "basic");
  assert.equal(MEMBERSHIP_CAPACITY.basic.label, "Essential");
});

test("new writes emit only canonical lowercase values", () => {
  assert.equal(toCanonicalInterviewTypeWrite("Core"), "core");
  assert.equal(toCanonicalInterviewTypeWrite("leadership"), "leadership");
  assert.equal(toCanonicalInterviewTypeWrite("Technical"), "technical");
  assert.equal(toCanonicalInterviewTypeWrite("basic"), "core");
  assert.equal(toCanonicalInterviewTypeWrite("detailed"), "leadership");
  assert.throws(() => toCanonicalInterviewTypeWrite("entry"), /Core, Leadership, or Technical/);
});

test("membership owns the exact duration and scored-question count", () => {
  assert.deepEqual(MEMBERSHIP_CAPACITY.basic, { membership_level: "basic", label: "Essential", duration_minutes: 10, scored_question_count: 5 });
  assert.deepEqual(MEMBERSHIP_CAPACITY.pro, { membership_level: "pro", label: "Pro", duration_minutes: 12, scored_question_count: 6 });
  assert.deepEqual(MEMBERSHIP_CAPACITY.enterprise, { membership_level: "enterprise", label: "Enterprise", duration_minutes: 15, scored_question_count: 7 });
  assert.equal(formatMembershipCapacity("basic"), "Essential — 10 minutes, 5 scored questions");
  assert.equal(formatMembershipCapacity("pro"), "Pro — 12 minutes, 6 scored questions");
  assert.equal(formatMembershipCapacity("enterprise"), "Enterprise — 15 minutes, 7 scored questions");
});

for (const membership of ["basic", "pro", "enterprise"]) {
  for (const interviewType of CANONICAL_INTERVIEW_TYPES) {
    test(`matrix: ${membership} + ${interviewType} keeps membership capacity`, () => {
      const capacity = resolveMembershipCapacity(membership);
      assert.deepEqual(capacity, MEMBERSHIP_CAPACITY[membership]);
      assert.equal(getInterviewTypeOption(interviewType)?.value, interviewType);
    });
  }
}

test("backend fixture is pinned to the approved commit and matches the shared contract", () => {
  const fixture = JSON.parse(fs.readFileSync(path.join(ROOT, "test/fixtures/backend-plan-capacity-8d4963d.json"), "utf8"));
  assert.equal(fixture.backend_contract_commit, BACKEND_CONTRACT_COMMIT);
  for (const [membership, backend] of Object.entries(fixture.memberships)) {
    assert.equal(backend.interview_duration_minutes, MEMBERSHIP_CAPACITY[membership].duration_minutes);
    assert.equal(backend.max_interview_minutes, MEMBERSHIP_CAPACITY[membership].duration_minutes);
    assert.equal(backend.scored_question_count, MEMBERSHIP_CAPACITY[membership].scored_question_count);
  }
});

test("public backend fields are preferred while internal synthetic duration never leaks", () => {
  assert.deepEqual(
    resolveMembershipCapacity("pro", { max_interview_minutes: 12, scored_question_count: 6 }),
    MEMBERSHIP_CAPACITY.pro,
  );
  assert.equal(
    resolveMembershipCapacity("basic", { max_interview_minutes: 3, internal_synthetic_duration_override: true })?.duration_minutes,
    10,
  );
});
