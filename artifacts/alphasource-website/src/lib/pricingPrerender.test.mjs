import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";

const script = readFileSync(new URL("../../scripts/prerender-public-routes.mjs", import.meta.url), "utf8");
test("static pricing offers use the six approved prepaid terms rather than retired public monthly/annual prices", () => {
  const schema = script.slice(script.indexOf("const pricingSchema ="), script.indexOf("function faqPageSchema"));
  const offers = [...schema.matchAll(/offer\("([^"]+)", "(\d+)", "([^"]+)"\)/g)].map(match => match.slice(1));
  assert.deepEqual(offers.filter(([name]) => /membership/.test(name)), [
    ["alphaScreen Essential 3-month prepaid membership", "1200", "3-month prepaid platform membership"],
    ["alphaScreen Essential 6-month prepaid membership", "1950", "6-month prepaid platform membership"],
    ["alphaScreen Essential 12-month prepaid membership", "3300", "12-month prepaid platform membership"],
    ["alphaScreen Pro 3-month prepaid membership", "2100", "3-month prepaid platform membership"],
    ["alphaScreen Pro 6-month prepaid membership", "3600", "6-month prepaid platform membership"],
    ["alphaScreen Pro 12-month prepaid membership", "6500", "12-month prepaid platform membership"],
  ]);
  assert.deepEqual(offers.filter(([name]) => !/membership/.test(name)).map(([name, cents]) => [name, cents]), [
    ["alphaScreen Essential role fee", "399"], ["alphaScreen Essential first-role prepay", "359"],
    ["alphaScreen Pro role fee", "699"], ["alphaScreen Pro first-role prepay", "629"],
  ]);
});
test("static human-readable copy matches prepaid terms and leaves monthly installments to sales", () => {
  const pricing = script.slice(script.indexOf('  "/alphascreen/pricing": {'), script.indexOf('  "/alphascreen/security": {'));
  assert.doesNotMatch(pricing, /\$299|\$3,299|\$599|\$6,499/);
  for (const price of ["$1,200", "$1,950", "$3,300", "$2,100", "$3,600", "$6,500"]) assert.ok(pricing.includes(price));
  assert.match(pricing, /Contact sales for monthly installments/);
  assert.match(pricing, /dedicated Client Support Agent/);
  assert.match(pricing, /platform fee and per-interview pricing/);
});
