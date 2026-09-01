import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const pricing = readFileSync(resolve(root, "src/pages/AlphaScreenPricingPage.tsx"), "utf8");

test("pricing hero preview uses the approved navy and duotone treatment", () => {
  assert.match(pricing, /border-white\/10 bg-\[#0A1547\][\s\S]*AlphaScreenMark geometry="08" treatment="duotone"/);
  assert.match(pricing, /alphaScreen memberships[\s\S]*Included interview volume/);
});

test("pricing hero preview preserves plan volume and interview time caps", () => {
  assert.match(pricing, /\["Essential", "20 interviews, 10-minute cap"\]/);
  assert.match(pricing, /\["Pro", "30 interviews, 12-minute cap"\]/);
});

test("pricing hero preview keeps uniform rows and approved Enterprise copy", () => {
  assert.match(pricing, /\["Enterprise", "Talk to sales for a custom plan"\]/);
  assert.match(pricing, /grid min-h-16 grid-cols-\[1fr_auto\] items-center/);
  assert.doesNotMatch(pricing, /Custom membership/);
});
