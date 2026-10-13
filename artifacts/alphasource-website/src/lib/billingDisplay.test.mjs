import assert from "node:assert/strict";
import { test, after } from "node:test";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";
const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
process.env.PORT ||= "4182";
process.env.BASE_PATH ||= "/";
process.env.NODE_ENV = "test";
const server = await createServer({
  root,
  configFile: join(root, "vite.config.ts"),
  appType: "custom",
  logLevel: "silent",
  optimizeDeps: { include: [], noDiscovery: true },
  server: { hmr: false, middlewareMode: true },
});
after(() => server.close());
const display = await server.ssrLoadModule("/src/lib/billingDisplay.ts");
const origin = await server.ssrLoadModule("/src/lib/supportVoiceOrigin.ts");
const enterprise = await server.ssrLoadModule(
  "/src/components/EnterpriseModelPreparation.tsx",
);
const enterpriseFields = await server.ssrLoadModule("/src/lib/enterpriseAgreementFields.ts");
test("unknown/null is never zero; explicit zero and cents remain accurate", () => {
  for (const value of [
    null,
    undefined,
    "",
    " ",
    true,
    -1,
    "bad",
    1.2,
    Infinity,
    [],
    {},
  ])
    assert.equal(display.nonNegativeCount(value), null);
  assert.equal(display.moneyCents(null), "Not configured");
  assert.equal(display.moneyCents(0), "$0.00");
  assert.equal(display.moneyCents(29900), "$299.00");
  for (const value of [null, undefined, "", " ", true, [], {}, -1, "bad"])
    assert.equal(display.moneyDollars(value), "Not configured");
  assert.equal(display.moneyDollars(0), "$0.00");
  assert.equal(display.moneyDollars("299.25"), "$299.25");
});
test("exact server models only; metered is not depleted or unlimited", () => {
  assert.equal(display.billingModel("enterprise"), null);
  assert.equal(display.billingModel("Usage"), null);
  assert.equal(display.billingModel("usage"), "usage");
  assert.match(
    display.capacityLabel(
      display.roleCapacity({ billing_model: "usage", used_interviews: 4 }),
    ),
    /Metered.*4 used/,
  );
  assert.doesNotMatch(
    display.capacityLabel(display.roleCapacity({ billing_model: "usage" })),
    /unlimited|0 left/i,
  );
});
test("shared balance is not counted per role, mixed/unknown aggregates are explicit", () => {
  const a = display.roleCapacity({
    billing_model: "rollover",
    own_remaining_interviews: 4,
    credit_interviews: 50,
  });
  assert.equal(display.summarizeRoleCapacity([a, a]).value, "8");
  const u = display.roleCapacity({
    billing_model: "usage",
    pool_remaining_interviews: 200,
  });
  assert.equal(display.summarizeRoleCapacity([u, u]).value, "Metered");
  assert.match(
    display.summarizeRoleCapacity([a, u]).detail,
    /metered.*separate/,
  );
  assert.equal(
    display.summarizeRoleCapacity([a, display.roleCapacity({})]).value,
    "—",
  );
});
test("unpriced empty usage is not a free offer; explicitly priced zero is valid", () => {
  assert.equal(display.hasPricedUsage([]), false);
  assert.equal(
    display.hasPricedUsage([{ quantity: 3, amount_cents: 0 }]),
    false,
  );
  assert.equal(
    display.hasPricedUsage([
      { quantity: 3, unit_price_cents: 0, amount_cents: 0 },
    ]),
    true,
  );
  assert.equal(
    display.hasPricedUsage([
      { quantity: 3, unit_price_cents: 2500, amount_cents: 7500 },
      { quantity: 1, unit_price_cents: null, amount_cents: 0 },
    ]),
    false,
  );
});
test("dev/staging support origins cannot be cross-wired, relaxed or authenticated URLs", () => {
  const dev = "https://interview-agent-backend-qa.onrender.com";
  const qa = "https://ia-backend-qa.onrender.com";
  assert.equal(origin.supportVoiceOrigin(dev, "development"), dev);
  assert.equal(origin.supportVoiceOrigin(qa, "staging"), qa);
  assert.equal(origin.supportVoiceOrigin(qa, "development"), null);
  assert.equal(origin.supportVoiceOrigin(dev, "staging"), null);
  for (const bad of [
    dev + "/",
    dev + "?token=x",
    dev + ".evil.invalid",
    "https://user@interview-agent-backend-qa.onrender.com",
  ])
    assert.equal(origin.supportVoiceOrigin(bad, "development"), null);
});
test("existing controlled Enterprise form retains Standard usage and rollover settings without payment actions", () => {
  // The controlled form already existed at94eb187. The old preparation-only
  // fixture omitted required props and described the retired read-only stub.
  for (const billingModel of ["fixed", "rollover", "usage"]) {
    const value = { ...enterpriseFields.defaultEnterpriseAgreementFields(), billingModel };
    const html = renderToStaticMarkup(React.createElement(enterprise.default, { value, onChange: () => {} }));
    assert.match(html, new RegExp(`<option value="${billingModel}" selected="">`));
    assert.match(html, /Interview length \(minutes\)/); assert.match(html, /Scored questions/);
    assert.match(html, /included in the generated agreement/); assert.match(html, /dedicated Client Support Agent/);
    assert.equal(html.includes("Optional prepaid interview pool"), billingModel === "usage");
    assert.equal(html.includes("Unused interview credit validity"), billingModel === "rollover");
    assert.doesNotMatch(html, /<button[^>]*>.*(?:Save|Checkout)/);
  }
});
