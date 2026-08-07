import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

const app = read("src/App.tsx");
const access = read("src/pages/InterviewPage.tsx");
const cvi = read("src/pages/InterviewCviPage.tsx");
const adminRoles = read("src/pages/admin/AdminRolesPage.tsx");
const dashboardRoles = read("src/pages/dashboard/RolesPage.tsx");
const overviews = `${read("src/pages/admin/AdminOverviewPage.tsx")}\n${read("src/pages/dashboard/OverviewPage.tsx")}`;

test("candidate application, verification, and launch routes remain wired", () => {
  assert.match(app, /path=["']\/interview-access\/:role_token["']/);
  assert.match(app, /path=["']\/interview-access["']/);
  assert.match(app, /path=["']\/interview-cvi["']/);
  assert.match(access, /\/api\/candidate\/verify-otp/);
  assert.match(access, /\/create-tavus-interview/);
  assert.match(access, /Before you start your interview/);
  assert.doesNotMatch(access, /3 uninterrupted minutes to complete the interview/);
  assert.doesNotMatch(access, /preStartMaxInterviewMinutes/);
  assert.match(access, /data\?\.max_interview_minutes/);
  assert.match(access, /max_interview_minutes: maxInterviewMinutes/);
});

test("candidate readiness has no competing spoken introduction or fixed warm-up", () => {
  assert.doesNotMatch(access, /What’s your favorite season|What's your favorite season|Thanks for sharing\. Let’s begin\.|Thanks for sharing\. Let's begin\./);
  assert.doesNotMatch(access, /tell me about yourself/i);
});

test("Interview CVI retains timer, terminal closing, and provider end behavior", () => {
  assert.match(cvi, /max_interview_minutes/);
  assert.match(cvi, /STARTUP_REMOTE_TIMEOUT_MS = 12000/);
  assert.match(cvi, /startupRecoveryAttemptedRef/);
  assert.match(cvi, /reconnectRecoveryNotice/);
  assert.match(cvi, /tavus\/end-conversation/);
});

test("legacy role labels normalize on dashboard, admin, and overview reads", () => {
  for (const source of [dashboardRoles, adminRoles, overviews]) {
    assert.match(source, /getInterviewTypeLabel/);
  }
  assert.match(read("src/lib/interviewContract.ts"), /detailed:\s*["']leadership/);
});

test("membership and type remain separate on creation, detail, and edit surfaces", () => {
  for (const source of [dashboardRoles, adminRoles]) {
    assert.match(source, /<InterviewTypeField/);
    assert.match(source, /<MembershipTypeSummary/);
    assert.match(source, /<RubricGuidancePanel/);
  }
  assert.match(read("src/components/roles/EditRoleRubricModal.tsx"), /<MembershipTypeSummary/);
});

test("the implementation does not duplicate the backend spoken introduction", () => {
  const product = `${dashboardRoles}\n${adminRoles}\n${access}\n${cvi}`;
  assert.doesNotMatch(product, /Speaking with an AI can feel a little different at first/);
  assert.doesNotMatch(product, /What(?:’|')s your favorite season/);
});

test("public capacity display never surfaces internal synthetic override fields", () => {
  const summary = read("src/components/MembershipTypeSummary.tsx");
  assert.doesNotMatch(summary, /internal_synthetic_duration_override/);
  assert.match(read("src/lib/interviewContract.ts"), /isInternalOverride/);
});

test("package manager and lockfile remain the authoritative pnpm workspace", () => {
  const rootPackage = JSON.parse(fs.readFileSync(path.join(ROOT, "../../package.json"), "utf8"));
  const websitePackage = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
  assert.match(rootPackage.packageManager, /^pnpm@/);
  assert.ok(rootPackage.devDependencies.typescript);
  assert.ok(websitePackage.scripts.typecheck);
  assert.ok(websitePackage.scripts.build);
  assert.ok(fs.existsSync(path.join(ROOT, "../../pnpm-lock.yaml")));
  assert.equal(fs.existsSync(path.join(ROOT, "../../package-lock.json")), false);
});

test("security and reliability administration routes remain present", () => {
  assert.match(app, /admin\/interview-reliability/);
  assert.match(app, /AdminInterviewReliabilityPage/);
  assert.match(cvi, /recovery/);
});
