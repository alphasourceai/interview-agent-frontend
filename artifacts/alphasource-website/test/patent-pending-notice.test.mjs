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

test("required product marketing placements keep one restrained notice per source surface", () => {
  for (const source of [home, pricing, retail]) {
    assert.match(source, /import PatentPendingBadge from "@\/components\/PatentPendingBadge"/);
    assert.equal((source.match(/<PatentPendingBadge\b/g) || []).length, 1);
  }
  assert.doesNotMatch(alphaScreen, /import PatentPendingBadge|<PatentPendingBadge\b|AI Interview Agent/);
  assert.match(alphaScreen, /data-testid="alphascreen-patent-subscript"[\s\S]*Patent Pending/);
  assert.match(home, /alphaScreen[\s\S]*<PatentPendingBadge className="min-h-6/);
  assert.match(pricing, /<AlphaScreenBreathingLockup[\s\S]*<PatentPendingBadge/);
  assert.match(retail, /\{eyebrow\}[\s\S]*<PatentPendingBadge/);
});

test("alphaScreen hero uses the approved larger top-aligned lockup", () => {
  assert.match(alphaScreen, /lg:items-start/);
  assert.match(alphaScreen, /markClassName="h-\[3\.125rem\] w-\[3\.125rem\][^"]*min-\[360px\]:h-\[3\.75rem\][^"]*lg:h-\[4\.625rem\] lg:w-\[4\.625rem\]"/);
  assert.match(alphaScreen, /wordmarkClassName="text-\[2\.275rem\] min-\[360px\]:text-\[2\.7rem\][^"]*lg:text-\[3\.975rem\]"/);
  assert.match(alphaScreen, /className="lg:mt-4"/);
  assert.match(alphaScreen, /absolute bottom-0 right-0[^"]*lg:static/);
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
