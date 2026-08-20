import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => readFileSync(resolve(root, file), "utf8");

const badge = read("src/components/PatentPendingBadge.tsx");
const alphaScreen = read("src/pages/AlphaScreenPage.tsx");
const home = read("src/pages/HomePage.tsx");
const pricing = read("src/pages/AlphaScreenPricingPage.tsx");
const retail = read("src/pages/AlphaScreenRetailPages.tsx");
const footer = read("src/components/Footer.tsx");
const shippedSources = [badge, alphaScreen, home, pricing, retail, footer].join("\n");

test("one restrained reusable badge carries the approved visible claim", () => {
  assert.match(badge, />\s*Patent Pending\s*</);
  assert.doesNotMatch(badge, /tooltip|patent number|application number|href=/i);
  assert.match(badge, /whitespace-nowrap/);
  assert.match(badge, /dark:text-\[#C9B8FF\]/);
});

test("required product marketing placements reuse the badge exactly once per source surface", () => {
  for (const source of [alphaScreen, home, pricing, retail]) {
    assert.match(source, /import PatentPendingBadge from "@\/components\/PatentPendingBadge"/);
    assert.equal((source.match(/<PatentPendingBadge\b/g) || []).length, 1);
  }
  assert.match(alphaScreen, /AI Interview Agent[\s\S]*<PatentPendingBadge/);
  assert.match(home, /alphaScreen[\s\S]*<PatentPendingBadge className="min-h-6/);
  assert.match(pricing, /alphaScreen memberships[\s\S]*<PatentPendingBadge/);
  assert.match(retail, /\{eyebrow\}[\s\S]*<PatentPendingBadge/);
});

test("the scoped footer notice is limited away from home and account workflows", () => {
  assert.match(footer, /alphaScreen technology — Patent Pending/);
  assert.match(footer, /normalizedPath !== "\/"/);
  assert.match(footer, /!normalizedPath\.startsWith\("\/checkout"\)/);
  assert.match(footer, /!normalizedPath\.startsWith\("\/membership-agreement"\)/);
});

test("shipped patent-notice sources contain no prohibited legal claim", () => {
  assert.doesNotMatch(shippedSources, /patent protected|USPTO approved|patent granted|proprietary patented technology/i);
  assert.doesNotMatch(shippedSources, /\b(?:application|receipt|patent)\s*(?:no\.?|number|#)\s*[:#-]?\s*[A-Z0-9]/i);
  assert.doesNotMatch(shippedSources, /[™®]/);
});
