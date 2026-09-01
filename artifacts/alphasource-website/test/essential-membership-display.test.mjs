import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { getMembershipPlanLabel } from "../src/lib/membershipPlans.ts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

test("membership plan labels preserve canonical keys while displaying Essential", () => {
  assert.equal(getMembershipPlanLabel("basic"), "Essential");
  assert.equal(getMembershipPlanLabel("Basic"), "Essential");
  assert.equal(getMembershipPlanLabel("essential"), "Essential");
  assert.equal(getMembershipPlanLabel("pro"), "Pro");
  assert.equal(getMembershipPlanLabel("enterprise"), "Enterprise");
  assert.equal(getMembershipPlanLabel(""), "—");
  assert.equal(getMembershipPlanLabel("unknown"), "—");
});

test("agreement, billing, and admin client surfaces use the shared plan label", () => {
  const signer = read("src/pages/MembershipAgreementSignerPage.tsx");
  const billing = read("src/pages/dashboard/BillingPage.tsx");
  const adminClients = read("src/pages/admin/AdminClientsPage.tsx");
  const adminBilling = read("src/pages/admin/AdminBillingPage.tsx");

  assert.doesNotMatch(signer, /toDisplayText\(session\.membership_tier\)/);
  assert.match(signer, /getMembershipPlanLabel\(session\.membership_tier\)/);
  assert.match(billing, /planTier:\s*getMembershipPlanLabel\(billingSummary\?\.plan_tier\)/);
  assert.match(adminClients, /getMembershipPlanLabel\(tier\)/);
  assert.match(adminClients, /getMembershipPlanLabel\(client\.planTier\)/);
  assert.match(adminBilling, /<option value="basic">Essential<\/option>/);
  assert.match(adminBilling, /getMembershipPlanLabel\(agreementReplacementDetails\?\.membership_tier\)/);
});
