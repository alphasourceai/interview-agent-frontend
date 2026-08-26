import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(testDir, "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

test("client Help Center documents profile security, passkeys, candidate verification, and recent releases", () => {
  const content = read("src/content/dashboardSupportContent.ts");
  const page = read("src/pages/dashboard/FaqPage.tsx");

  assert.match(content, /DASHBOARD_SUPPORT_KNOWLEDGE_VERSION = "2026-08-26\.1"/);
  assert.match(content, /Profile and account security/);
  assert.match(content, /How do I add and use a passkey\?/);
  assert.match(content, /What verification choices are available to candidates\?/);
  assert.match(content, /alphaScreen v2\.0/);
  assert.match(content, /alphaScreen v1\.9/);
  assert.match(content, /alphaScreen v1\.8/);
  assert.match(content, /Open profile & security/);
  assert.match(page, /card\.href && card\.linkLabel/);
});

test("public FAQ and Support publish only plain-language product updates", () => {
  const content = read("src/lib/publicContent.ts");
  const support = read("src/pages/SupportPage.tsx");
  const prerender = read("scripts/prerender-public-routes.mjs");
  const seo = read("src/lib/seo.ts");
  const sitemap = read("public/sitemap.xml");
  const managerQuestionMatches = content.match(/Can managers use alphaScreen across multiple locations or entities\?/g) || [];

  assert.match(content, /PUBLIC_CONTENT_LAST_UPDATED = "August 26, 2026"/);
  assert.match(content, /Can client users sign in with a passkey\?/);
  assert.match(content, /What interview-access verification options can candidates use\?/);
  assert.match(content, /publicProductUpdates/);
  assert.equal(managerQuestionMatches.length, 1);
  assert.match(support, /What&apos;s new in alphaScreen/);
  assert.match(support, /publicProductUpdates\.map/);
  assert.doesNotMatch(support, /SMS Monitoring|signed webhook|retention enforcement|provider delivery/i);
  assert.match(prerender, /const LAST_UPDATED = "August 26, 2026"/);
  assert.match(prerender, /section\("What's new in alphaScreen"/);
  assert.match(prerender, /section\("Account, password, and passkey setup"/);
  assert.match(prerender, /Public alphaScreen FAQ covering pricing, memberships, passkeys, candidate verification, screening, security, accommodations, and human review\./);
  assert.match(prerender, /Get alphaScreen public support guidance for account setup, passkeys, candidate verification, memberships, billing, product updates, recovery, and security questions\./);
  assert.match(seo, /Public alphaScreen FAQ covering pricing, memberships, passkeys, candidate verification, screening, security, accommodations, and human review\./);
  assert.match(seo, /Get alphaScreen public support guidance for account setup, passkeys, candidate verification, memberships, billing, product updates, recovery, and security questions\./);
  assert.match(sitemap, /<loc>https:\/\/www\.alphasourceai\.com\/faq\/<\/loc>\s*<lastmod>2026-08-26<\/lastmod>/);
  assert.match(sitemap, /<loc>https:\/\/www\.alphasourceai\.com\/support\/<\/loc>\s*<lastmod>2026-08-26<\/lastmod>/);
});
