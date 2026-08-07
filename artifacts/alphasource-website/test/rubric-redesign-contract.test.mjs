import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REPO_ROOT = path.resolve(ROOT, "../..");

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

const ROLE_SURFACES = [
  "src/pages/dashboard/RolesPage.tsx",
  "src/pages/admin/AdminRolesPage.tsx",
  "src/components/roles/EditRoleRubricModal.tsx",
].map(read).join("\n");
const SHARED_CONTRACT = [
  "src/lib/interviewContract.ts",
  "src/components/InterviewTypeField.tsx",
  "src/components/MembershipTypeSummary.tsx",
].map(read).join("\n");
const PRODUCT_SOURCES = `${ROLE_SURFACES}\n${SHARED_CONTRACT}`;

test("role creation exposes only Core, Leadership, and Technical in order", () => {
  assert.doesNotMatch(ROLE_SURFACES, /<option value=["'](?:BASIC|DETAILED|detailed)["']/);
  assert.doesNotMatch(ROLE_SURFACES, /<option[^>]*>\s*(?:Basic|Detailed|Entry)\s*<\/option>/);
  assert.match(SHARED_CONTRACT, /Core[\s\S]*Leadership[\s\S]*Technical/);
});

test("one canonical helper owns type aliases and write values", () => {
  const helper = read("src/lib/interviewContract.ts");
  assert.match(helper, /basic:\s*["']core/);
  assert.match(helper, /detailed:\s*["']leadership/);
  assert.match(helper, /CANONICAL_INTERVIEW_TYPES/);
  assert.doesNotMatch(ROLE_SURFACES, /\[\s*["']BASIC["'][\s\S]*["']DETAILED["'][\s\S]*["']TECHNICAL["']/);
});

test("membership independently owns exact duration and question quantity", () => {
  const helper = read("src/lib/interviewContract.ts");
  assert.match(helper, /basic:[\s\S]*10[\s\S]*5/);
  assert.match(helper, /pro:[\s\S]*12[\s\S]*6/);
  assert.match(helper, /enterprise:[\s\S]*15[\s\S]*7/);
  assert.match(PRODUCT_SOURCES, /Membership/);
  assert.match(PRODUCT_SOURCES, /scored questions/);
});

test("interview type does not imply quantity, duration, depth, or intensity", () => {
  assert.doesNotMatch(ROLE_SURFACES, /Basic:\s*shorter|Detailed:\s*deeper|interview depth|interview intensity/i);
});

test("all new role writes pass through the canonical type helper", () => {
  const helperCalls = ROLE_SURFACES.match(/toCanonicalInterviewTypeWrite\(/g) || [];
  assert.ok(helperCalls.length >= 2, `expected canonicalized writes on both role-creation surfaces, found ${helperCalls.length}`);
  assert.doesNotMatch(ROLE_SURFACES, /append\(["']interview_type["'],\s*String\([^)]*\)\.toUpperCase/);
  assert.doesNotMatch(ROLE_SURFACES, /interview_type:\s*["'](?:basic|detailed)["']/i);
});

test("FAQ and selection playbook explain the approved product model", () => {
  const content = `${read("src/content/rubricGuidance.ts")}\n${fs.readFileSync(path.join(REPO_ROOT, "docs/alphascreen-rubric-selection-guide.md"), "utf8")}`;
  assert.match(content, /Membership determines interview length/);
  assert.match(content, /Membership determines the number of scored questions/);
  assert.match(content, /Core does not mean entry-level/);
  assert.match(content, /Do not select Leadership based only on seniority/);
});

test("all approved client-facing type tooltips exist", () => {
  const content = `${read("src/lib/interviewContract.ts")}\n${read("src/content/rubricGuidance.ts")}`;
  assert.match(content, /Broad screening of relevant experience, judgment, ownership, communication, adaptability, and role readiness\./);
  assert.match(content, /Management and leadership screening focused on coaching, accountability, prioritization, conflict, change, and execution\./);
  assert.match(content, /Role-specific applied assessment of technical knowledge, troubleshooting, implementation, tradeoffs, risk, and quality\./);
});

test("role editing is explicit, capacity-aware, and never regenerates on open", () => {
  const editor = read("src/components/roles/EditRoleRubricModal.tsx");
  const loadStart = editor.indexOf("const loadCurrentConfig");
  const saveStart = editor.indexOf("const save = async");
  assert.ok(loadStart >= 0 && saveStart > loadStart);
  const loadBlock = editor.slice(loadStart, saveStart);
  assert.doesNotMatch(loadBlock, /PATCH|regenerat|generateRubric|rubric-request-changes/i);
  assert.match(editor.slice(saveStart), /method:\s*["']PATCH["']/);
  assert.match(editor.slice(saveStart), /tavus_prompt/);
  assert.match(editor.slice(saveStart), /rubric_questions/);
  assert.match(editor, /does not regenerate the rubric/);
  assert.match(editor, /completed interview evidence and reports unchanged/);
  assert.match(editor, /require exactly .* scored questions/);
});
