import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { verifiedPublicCatalog, publicRetailQuotePayload, savedPublicMembershipTerms } from './publicMembershipQuote.ts';
const require = createRequire(import.meta.url);
const backend = process.env.MEMBERSHIP_PRICING_BACKEND_ROOT || fileURLToPath(new URL('../../../../../backend-dev-20261010/', import.meta.url));
const { retailQuoteCatalog, retailAgreementTerms } = require(`${backend}/src/services/retailQuoteSelection.js`);
const { listPublicAlphaScreenPackages, buildAlphaScreenPackageSnapshot } = require(`${backend}/src/services/alphaScreenPackages.js`);
const { buildRetailPackageSnapshot } = require(`${backend}/src/services/membershipPackageCompatibility.js`);
const rawCatalog = () => retailQuoteCatalog('public', { MEMBERSHIP_PRICING_TERMS_ENABLED: 'true' });
const summarySource = fs.readFileSync(`${backend}/src/services/alphaScreen/index.js`, 'utf8');
const ast = ts.createSourceFile('index.js', summarySource, ts.ScriptTarget.Latest, true);
const declaration = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'safePackageSummary');
assert.ok(declaration, 'actual backend safe summary exists');
const context = vm.createContext({ retailAgreementTerms });
vm.runInContext(`${declaration.getText(ast)};globalThis.project = safePackageSummary;`, context);
const safeSummary = snapshot => JSON.parse(JSON.stringify(context.project(snapshot)));

test('public payload matrix uses actual backend factory and twelve keys-only selections', () => {
  const { catalog } = verifiedPublicCatalog(rawCatalog());
  const identity = { company_legal_name: 'Synthetic', company_dba: '', buyer_first_name: 'QA', buyer_last_name: 'Buyer',
    buyer_email: 'buyer@example.invalid', buyer_phone: 'synthetic-no-phone', buyer_title: 'QA', source_path: '/alphascreen/pricing',
    agreement_acknowledged: true, contact_acknowledged: true,
    billing_cadence: 'annual', platform_fee: 1, included_interviews: 999, auto_renew: false, stripe_price_id: 'bad' };
  let count = 0;
  for (const offer of catalog.offers) for (const selected of [false, true]) {
    const body = publicRetailQuotePayload({ ...identity, first_role_prepay_selected: selected }, catalog,
      { offerKey: offer.offer_key, offerVersion: offer.offer_version }, offer.plan_key);
    assert.equal(body.commitment_months, offer.commitment_months);
    assert.equal(body.payment_option, 'prepaid'); assert.equal(body.offer_version, catalog.pricing_version);
    assert.equal(body.first_role_prepay_selected, selected); assert.equal(body.buyer_email, identity.buyer_email);
    for (const key of ['billing_cadence', 'platform_fee', 'included_interviews', 'auto_renew', 'stripe_price_id'])
      assert.equal(Object.hasOwn(body, key), false);
    assert.equal(Object.keys(body).length, 15); count++;
  }
  assert.equal(count, 12);
  assert.throws(() => publicRetailQuotePayload(identity, catalog, null, 'basic'));
  assert.throws(() => publicRetailQuotePayload(identity, catalog, { offerKey: catalog.offers[0].offer_key, offerVersion: 'old' }, 'basic'));
});
test('only complete actual legacy server packages permit the legacy form; no fallback', () => {
  const raw = { packages: listPublicAlphaScreenPackages({}) };
  assert.equal(verifiedPublicCatalog(raw).catalog, null);
  assert.deepEqual(verifiedPublicCatalog(raw).packages, raw.packages);
  for (const input of [null, {}, [], { packages: [] }, { packages: raw.packages.slice(0, 1) },
    { packages: [raw.packages[0], raw.packages[0]] }, { packages: raw.packages, offers: [] }])
    assert.throws(() => verifiedPublicCatalog(input));
  for (const alter of [x => delete x.packages[0].platform_monthly_fee_cents, x => x.packages[0].per_role_fee = 0,
    x => delete x.packages[0].first_role_prepay, x => x.packages[0].billing_cadences = [{ key: 'monthly' }],
    x => x.packages[0].platform_monthly_fee = 1, x => x.packages[0].commitment_months = 3]) {
    const rawCopy = structuredClone(raw); alter(rawCopy); assert.throws(() => verifiedPublicCatalog(rawCopy));
  }
});
test('all new server saved summaries, selected or no role, remain independent of live catalog', () => {
  const { catalog } = verifiedPublicCatalog(rawCatalog());
  let count = 0;
  for (const offer of catalog.offers) for (const selected of [false, true]) {
    const snapshot = buildRetailPackageSnapshot({ channel: 'public', planKey: offer.plan_key, commitmentMonths: offer.commitment_months,
      paymentOption: 'prepaid', offerVersion: offer.offer_version, firstRolePrepaySelected: selected });
    const summary = savedPublicMembershipTerms(safeSummary(snapshot));
    assert.equal(summary.platform_fee_cents, snapshot.platform_fee_cents);
    assert.equal(summary.first_role_selected, selected); assert.equal(summary.first_role_price_cents, snapshot.first_role_prepay.discounted_credit_amount_cents);
    assert.equal(summary.scored_question_count, snapshot.scored_question_count); count++;
    const historical = safeSummary(snapshot);
    historical.pricing_version = 'accepted-historical'; historical.platform_fee_cents += 17;
    historical.platform_commitment_total_cents = historical.platform_fee_cents;
    assert.equal(savedPublicMembershipTerms(historical).platform_fee_cents, snapshot.platform_fee_cents + 17);
    assert.equal(savedPublicMembershipTerms(historical).pricing_version, 'accepted-historical');
  }
  assert.equal(count, 12);
  for (const plan of ['basic', 'pro']) for (const billing of ['monthly', 'annual'])
    assert.equal(savedPublicMembershipTerms(safeSummary(buildAlphaScreenPackageSnapshot(plan, billing))), null);
  const saved = safeSummary(buildRetailPackageSnapshot({ channel: 'public', planKey: 'basic', commitmentMonths: 3,
    paymentOption: 'prepaid', offerVersion: catalog.pricing_version, firstRolePrepaySelected: true }));
  for (const alter of [x => delete x.platform_fee_cents, x => x.platform_commitment_total_cents += 1,
    x => x.first_role_prepay.discounted_credit_amount_cents = 0, x => x.payment_option = 'monthly_installments',
    x => x.billing_cadence = 'annual', x => delete x.scored_question_count]) {
    const copy = structuredClone(saved); alter(copy); assert.throws(() => savedPublicMembershipTerms(copy));
  }
});
