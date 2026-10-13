import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { execFileSync } from 'node:child_process';
import { publicRetailQuotePayload } from '../lib/publicMembershipQuote.ts';
const file = new URL('./AlphaScreenPricingPage.tsx', import.meta.url);
const current = fs.readFileSync(file, 'utf8');
const old = execFileSync('git', ['show', '9761a72c71376308c78ff507910f59d2d740ca39:artifacts/alphasource-website/src/pages/AlphaScreenPricingPage.tsx'],
  { encoding: 'utf8', cwd: new URL('../../../../', import.meta.url) });
function builder(source) {
  const ast = ts.createSourceFile(file.pathname, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const declaration = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'buildPurchasePayload');
  assert.ok(declaration);
  const code = ts.transpileModule(`${declaration.getText(ast)};globalThis.build = buildPurchasePayload;`,
    { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  const context = vm.createContext({ publicRetailQuotePayload, cleanText: (value, max) => String(value || '').trim().slice(0, max),
    defaultCadence: () => 'monthly', window: { location: { pathname: '/alphascreen/pricing' } } });
  vm.runInContext(code, context);
  return (form, plan) => JSON.parse(JSON.stringify(context.build(form, plan)));
}
test('actual legacy public purchase payload equals exact prior working builder', () => {
  let count = 0;
  for (const plan_key of ['basic', 'pro']) for (const billing_cadence of ['monthly', 'annual', ''])
    for (const first_role_prepay_selected of [false, true]) {
      const form = { company_legal_name: ' Synthetic ', company_dba: '', buyer_first_name: 'QA', buyer_last_name: 'Buyer',
        buyer_email: 'buyer@example.invalid', buyer_phone: 'synthetic-no-phone', buyer_title: 'QA', billing_cadence,
        first_role_prepay_selected, agreement_acknowledged: true, contact_acknowledged: true };
      assert.deepEqual(builder(current)(form, { plan_key }), builder(old)(form, { plan_key })); count++;
    }
  assert.equal(count, 12);
});
test('public source preserves endpoints, OTP and saved intent while binding fail-closed terms', () => {
  assert.match(current, /const verified = verifiedPublicCatalog\(body\)/);
  assert.match(current, /loadState !== "ready"/);
  assert.match(current, /buildPurchasePayload\(purchaseForm, selectedPlan, retailCatalog, retailSelection\)/);
  assert.match(current, /agreementResult\?\.agreement\?\.selected_package \?\? result\?\.selected_package/);
  assert.match(current, /disabled=\{savedQuoteLocked \|\| status === "submitting"\}/);
  assert.match(current, /if \(purchaseResult\?\.purchase_intent_id\) \{\s*setPurchaseStatus\("success"\);\s*setPurchaseError\(""\);\s*return;/);
  assert.match(current, /audience="public"/);
  for (const marker of ['agreementSigningHref', 'SMS_CONSENT_COPY_VERSION', 'EMAIL_VERIFICATION_RESEND_COOLDOWN_SECONDS',
    'SIGNUP_ALREADY_EXISTS_MESSAGE', 'loadCheckoutRecoveryState', 'purchaseIntentVerificationEndpoint', 'purchaseIntentAgreementEndpoint'])
    assert.ok(current.includes(marker));
  assert.doesNotMatch(current, /auth\.admin|inviteUserByEmail|createUser\(|signUp\(/);
});
