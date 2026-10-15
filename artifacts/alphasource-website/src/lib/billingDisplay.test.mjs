import assert from "node:assert/strict";
import { test, after } from "node:test";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
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
test("existing billing action status is rendered once outside role-dependent purchase card", () => {
  // Structural placement assertion, not an interactive browser acceptance test.
  const source = readFileSync(join(root, "src/pages/dashboard/BillingPage.tsx"), "utf8");
  assert.equal(source.split("{actionNotice && (").length - 1, 1);
  const notice = source.indexOf("{actionNotice && (");
  assert.ok(notice > source.indexOf("<CurrentScopeBanner client={selectedClient} />"));
  assert.ok(notice < source.indexOf("<BillingModelPanel clientId={selectedClientId} />"));
  assert.ok(notice < source.indexOf("Purchase Additional Interviews</h2>"));
  assert.match(source.slice(notice, source.indexOf("<BillingModelPanel clientId={selectedClientId} />")), /role="status"[\s\S]*aria-live="polite"/);
});
test("usage history distinguishes reserved, invoiced and recorded paid; unknown is not paid", () => {
  assert.equal(display.usageInvoiceStatusLabel("reserved"), "Reserved · not invoiced");
  assert.equal(display.usageInvoiceStatusLabel("invoiced_open"), "Invoiced · awaiting payment");
  assert.equal(display.usageInvoiceStatusLabel("paid"), "Paid");
  assert.equal(display.usageInvoiceStatusLabel(undefined), "Invoiced");
  assert.equal(display.usageInvoiceStatusLabel("processing"), "Status unavailable");
});
test("accepted client term projection keeps historical cents and refuses malformed obligations", () => {
  for (const months of [3, 6, 12]) for (const payment of ["prepaid", "monthly_installments"]) {
    const count = payment === "prepaid" ? 1 : months;
    const value = { commitment_months: months, payment_option: payment, currency: "usd",
      platform_payment_cents: 110017, platform_commitment_total_cents: 110017 * count, installment_count: count,
      current_term_start_at: "2026-01-31T12:13:14Z", current_term_end_at: "2027-01-31T12:13:14Z", auto_renew: false };
    assert.deepEqual(display.readClientMembershipTerms(value), value);
    assert.equal(display.moneyCents(display.readClientMembershipTerms(value).platform_payment_cents), "$1,100.17");
    for (const patch of [{ commitment_months: "3" }, { commitment_months: 9 }, { platform_payment_cents: null },
      { platform_commitment_total_cents: 1 }, { installment_count: 0 }, { payment_option: "annual" },
      { current_term_end_at: "bad" }, { current_term_end_at: "2020-01-01" }, { auto_renew: "false" }]) {
      assert.throws(() => display.readClientMembershipTerms({ ...value, ...patch }), /could not be verified/);
    }
  }
  assert.equal(display.readClientMembershipTerms(null), null);
  assert.equal(display.readClientMembershipTerms(undefined), null);
});
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
test("optional accepted date basis is explicit; missing legacy stays compatible and bad values fail closed", () => {
  const terms = { commitment_months: 6, payment_option: "prepaid", currency: "usd", platform_payment_cents: 195000,
    platform_commitment_total_cents: 195000, installment_count: 1, current_term_start_at: "2026-10-15T00:00:00Z",
    current_term_end_at: "2027-04-15T00:00:00Z", auto_renew: true };
  assert.deepEqual(display.readClientMembershipTerms(terms), terms);
  for (const basis of ["generation_date", "first_payment_success"]) {
    assert.equal(display.readClientMembershipTerms({ ...terms, term_start_basis: basis }).term_start_basis, basis);
  }
  for (const basis of [null, "", "signature_date", "GENERATION_DATE", false, 3, {}])
    assert.throws(() => display.readClientMembershipTerms({ ...terms, term_start_basis: basis }), /could not be verified/);
});
test("generation calendar dates never shift; first-payment and legacy keep local day", () => {
  const zones = ["UTC", "America/Denver", "America/Los_Angeles", "Asia/Tokyo"];
  const values = ["2027-04-15T00:00:00Z", "2028-02-29T00:00:00Z", "2027-01-31T00:00:00Z",
    "2027-03-14T10:00:00Z", "2027-11-07T09:00:00Z", "2027-04-15T20:00:00Z"];
  for (const zone of zones) for (const value of values) {
    const options = { month: "short", day: "numeric", year: "numeric" };
    assert.equal(display.membershipTermEndDate(value, "generation_date", zone),
      new Intl.DateTimeFormat("en-US", { ...options, timeZone: "UTC" }).format(new Date(value)));
    for (const basis of [undefined, "first_payment_success"])
      assert.equal(display.membershipTermEndDate(value, basis, zone),
        new Intl.DateTimeFormat("en-US", { ...options, timeZone: zone }).format(new Date(value)));
  }
  assert.equal(display.membershipTermEndDate(values[0], "generation_date", "America/Denver"), "Apr 15, 2027");
  assert.equal(display.membershipTermEndDate(values[0], "first_payment_success", "America/Denver"), "Apr 14, 2027");
  assert.equal(display.membershipTermEndDate(values[5], "first_payment_success", "Asia/Tokyo"), "Apr 16, 2027");
  for (const invalid of [null, undefined, "", "bad"])
    assert.equal(display.membershipTermEndDate(invalid, "generation_date"), "—");
});
test("Stripe cutoff displays the unchanged instant with local time and timezone", () => {
  for (const zone of ["UTC", "America/Denver", "America/Los_Angeles", "Asia/Tokyo"])
    for (const value of ["2027-04-15T00:00:00Z", "2027-03-14T10:00:00Z", "2027-11-07T09:00:00Z", "2028-02-29T00:00:00Z"]) {
      const parts = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric",
        hour: "numeric", minute: "2-digit", timeZoneName: "short", timeZone: zone }).formatToParts(new Date(value));
      const result = display.stripeRenewalCutoffDate(value, zone);
      for (const type of ["day", "hour", "minute", "timeZoneName"])
        assert.ok(result.includes(parts.find(p => p.type === type).value));
    }
  assert.match(display.stripeRenewalCutoffDate("2027-04-15T00:00:00Z", "America/Denver"), /Apr 14, 2027.*6:00.*PM.*MDT/);
  for (const invalid of [null, undefined, "", "bad"]) assert.equal(display.stripeRenewalCutoffDate(invalid), "—");
});
test("renewal request and full Stripe cutoff stay separate from contractual end and confirmed preference", () => {
  const value = { commitment_months: 3, payment_option: "monthly_installments", currency: "usd",
    platform_payment_cents: 44900, platform_commitment_total_cents: 134700, installment_count: 3,
    current_term_start_at: "2026-01-31T12:13:14Z", current_term_end_at: "2026-04-30T12:13:14Z", auto_renew: true,
    stripe_renewal_billing_cutoff_at: "2026-04-30T11:59:59Z", renewal_request_status: "waiting",
    requested_auto_renew: false, renewal_requested_at: "2026-02-15T10:00:00Z" };
  assert.deepEqual(display.readClientMembershipTerms(value), value);
  for (const patch of [{ stripe_renewal_billing_cutoff_at: "bad" }, { renewal_request_status: "successful" },
    { requested_auto_renew: "false" }, { renewal_requested_at: "bad" }]) {
    assert.throws(() => display.readClientMembershipTerms({ ...value, ...patch }), /could not be verified/);
  }
});
test("existing admin toggle never calls a scheduled, uncertain or retained-opposite request confirmed", () => {
  const result = status => ({ renewal: { status, requested_auto_renew: false,
    stripe_renewal_billing_cutoff_at: "2026-12-31T12:13:14Z" } });
  for (const status of ["waiting", "claimed", "unknown", "held", "busy"]) {
    const value = display.readAutoRenewUpdate(result(status), false);
    assert.equal(value.confirmed, null); assert.match(value.notice, /unchanged/);
  }
  assert.equal(display.readAutoRenewUpdate(result("applied"), false).confirmed, false);
  assert.equal(display.readAutoRenewUpdate(result("unknown"), true).confirmed, null);
  assert.equal(display.readAutoRenewUpdate({ item: { auto_renew: true } }, false).confirmed, true);
  for (const value of [null, { renewal: null }, result("fake"), { renewal: { status: "applied" } }])
    assert.throws(() => display.readAutoRenewUpdate(value, false), /could not be verified/);
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
