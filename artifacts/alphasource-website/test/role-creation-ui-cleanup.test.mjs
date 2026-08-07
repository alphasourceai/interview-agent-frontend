import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

function between(source, start, end) {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  assert.ok(startIndex >= 0, `missing section start: ${start}`);
  assert.ok(endIndex > startIndex, `missing section end: ${end}`);
  return source.slice(startIndex, endIndex);
}

const dashboardRoles = read("src/pages/dashboard/RolesPage.tsx");
const adminRoles = read("src/pages/admin/AdminRolesPage.tsx");
const dashboardCreate = between(dashboardRoles, "{canManageRoles && (", "{/* Search */}");
const adminCreate = between(adminRoles, "{/* ── Create role form", "{/* ── Search");
const guidance = read("src/components/RubricGuidancePanel.tsx");
const interviewTypeField = read("src/components/InterviewTypeField.tsx");
const contract = read("src/lib/interviewContract.ts");

test("role creation retains the four required controls", () => {
  for (const source of [dashboardCreate, adminCreate]) {
    assert.match(source, /Role Title|Role title/);
    assert.match(source, /<InterviewTypeField/);
    assert.match(source, /Job Description|JD file upload/);
    assert.match(source, /Creating\.\.\.|Create/);
    assert.match(source, /accept=["']\.pdf,\.docx["']/);
  }
});

test("the canonical selector contains exactly Core, Leadership, and Technical", () => {
  const optionBlock = between(contract, "export const INTERVIEW_TYPE_OPTIONS", "]);");
  assert.deepEqual(
    [...optionBlock.matchAll(/label:\s*["']([^"']+)["']/g)].map((match) => match[1]),
    ["Core", "Leadership", "Technical"],
  );
});

test("role creation uses the compact historical selector widths without inline prose", () => {
  assert.match(dashboardCreate, /className=["']w-44 flex-shrink-0["']/);
  assert.match(adminCreate, /className=["'](?:relative )?w-40 flex-shrink-0["']/);
  for (const source of [dashboardCreate, adminCreate]) {
    assert.match(source, /showDescription=\{false\}/);
    assert.doesNotMatch(source, /min-w-\[18rem\]/);
  }
  assert.match(interviewTypeField, /title=\{selected\.tooltip\}/);
});

test("role creation has no membership or interview-type summary-card row", () => {
  for (const source of [dashboardCreate, adminCreate]) {
    assert.doesNotMatch(source, /<MembershipTypeSummary/);
    assert.doesNotMatch(source, /aria-label=["']Membership and interview type["']/);
  }
});

test("the compact selection guide is guidance-only", () => {
  assert.match(guidance, />\s*Interview Type Selection Guide\s*</);
  assert.doesNotMatch(guidance, /and FAQ/i);
  assert.doesNotMatch(guidance, /RUBRIC_FAQ|rubric-faq-heading|>FAQ</);
  assert.match(guidance, /INTERVIEW_TYPE_SELECTION_GUIDE/);
  assert.match(guidance, /INTERVIEW_TYPE_CAUTIONS/);
});

test("approved FAQ content remains on both actual FAQ surfaces", () => {
  const dashboardFaq = read("src/pages/dashboard/FaqPage.tsx");
  const publicFaqContent = read("src/lib/publicContent.ts");
  assert.match(dashboardFaq, /RUBRIC_FAQ/);
  assert.match(dashboardFaq, /Interview types, membership, and warm-up/);
  assert.match(publicFaqContent, /RUBRIC_FAQ/);
  assert.match(publicFaqContent, /Interview Types, Membership & Warm-up/);
});

test("membership capacity, all nine combinations, and canonical compatibility remain intact", () => {
  assert.match(contract, /basic:[\s\S]*10[\s\S]*5/);
  assert.match(contract, /pro:[\s\S]*12[\s\S]*6/);
  assert.match(contract, /enterprise:[\s\S]*15[\s\S]*7/);
  assert.match(contract, /basic:\s*["']core/);
  assert.match(contract, /detailed:\s*["']leadership/);
  assert.deepEqual(
    ["basic", "pro", "enterprise"].flatMap((membership) =>
      ["core", "leadership", "technical"].map((type) => `${membership}:${type}`),
    ),
    [
      "basic:core", "basic:leadership", "basic:technical",
      "pro:core", "pro:leadership", "pro:technical",
      "enterprise:core", "enterprise:leadership", "enterprise:technical",
    ],
  );
});

test("role creation, editing, and non-regeneration contracts are unchanged", () => {
  assert.match(dashboardCreate, /onSubmit=\{handleCreate\}/);
  assert.match(dashboardRoles, /toCanonicalInterviewTypeWrite\(interviewType\)/);
  assert.match(adminRoles, /toCanonicalInterviewTypeWrite\(form\.type\)/);
  const editor = read("src/components/roles/EditRoleRubricModal.tsx");
  assert.match(editor, /method:\s*["']PATCH["']/);
  assert.match(editor, /does not regenerate the rubric/);
  assert.match(editor, /completed interview evidence and reports unchanged/);
});

test("compact form keeps responsive wrapping and usable fixed controls", () => {
  assert.match(dashboardCreate, /flex flex-col gap-3 items-start sm:flex-row sm:flex-wrap sm:items-end/);
  assert.match(adminCreate, /flex flex-col gap-3 items-start sm:flex-row sm:flex-wrap sm:items-stretch/);
  assert.match(dashboardCreate, /w-full sm:flex-1 sm:min-w-\[200px\]/);
  assert.match(adminCreate, /w-full sm:flex-1 sm:min-w-(?:36|48)/);
  for (const source of [dashboardCreate, adminCreate]) {
    assert.match(source, /max-w-\[calc\(100vw-2\.5rem\)\] lg:max-w-none/);
  }
  assert.match(dashboardCreate, /className=["']w-44 flex-shrink-0["']/);
  assert.match(adminCreate, /className=["']w-40 flex-shrink-0["']/);
});

test("narrow role pages contain search and wide tables instead of expanding the document", () => {
  const viewportCap = /min-w-0 max-w-\[calc\(100vw-2\.5rem\)\] lg:max-w-none/g;
  assert.equal([...dashboardRoles.matchAll(viewportCap)].length, 3);
  assert.equal([...adminRoles.matchAll(viewportCap)].length, 3);
  assert.match(dashboardRoles, /<div className=["']overflow-x-auto["']>\s*<table className=["']min-w-\[960px\]/);
  assert.match(adminRoles, /className=["']rounded-2xl overflow-x-auto min-w-0 max-w-\[calc\(100vw-2\.5rem\)\] lg:max-w-none["']/);
});
