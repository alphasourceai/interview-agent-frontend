import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

// Pure copy assertions, not browser/provider/email acceptance. No new endpoint
// or account workflow: the existing Sign In / Forgot password action is reused.
const source = fs.readFileSync(new URL('./CheckoutSubscriptionSuccessPage.tsx', import.meta.url), 'utf8');
const ast = ts.createSourceFile('CheckoutSubscriptionSuccessPage.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
function declaration(name, node = ast) {
  let found;
  function visit(n) {
    if (ts.isVariableDeclaration(n) && n.name.getText(ast) === name) found = n;
    ts.forEachChild(n, visit);
  }
  visit(node);
  assert.ok(found?.initializer, `missing ${name}`);
  return found.initializer.getText(ast);
}
function expression(text, values = {}) {
  const code = ts.transpileModule(`result = (${text});`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const context = vm.createContext({ ...values });
  vm.runInContext(code, context);
  return context.result;
}
const copy = expression(declaration('STATUS_COPY'));
const nextStep = status => expression(declaration('nextStepCopy'), {
  status, statusEndpoint: '/synthetic-status-only',
  POLLABLE_STATUSES: new Set(['payment_pending', 'activation_pending', 'setup_pending']),
});

test('password required never claims an email was sent; existing sign-in/recovery is offered', () => {
  assert.equal(copy.password_required.eyebrow, 'Payment confirmed');
  assert.equal(copy.password_required.title, 'Finish setting up your account.');
  assert.match(copy.password_required.body, /already have a password, sign in/);
  assert.match(copy.password_required.body, /Forgot password\? to request a secure setup link/);
  assert.doesNotMatch(JSON.stringify(copy.password_required), /sent to your email|Check your email/);
  assert.equal(copy.password_required.primaryHref, '/');
  assert.match(nextStep('password_required'), /request a secure setup link/);
  assert.doesNotMatch(nextStep('password_required'), /emailed|sent/);
});

test('explicit email-sent, ready, pending and cancelled states retain their distinct copy', () => {
  assert.equal(copy.setup_email_sent.title, 'Check your email to set your password.');
  assert.match(nextStep('setup_email_sent'), /emailed setup link/);
  assert.equal(copy.ready.primaryHref, '/dashboard');
  assert.equal(nextStep('ready'), 'Open the dashboard or sign in when you are ready.');
  for (const status of ['payment_pending', 'activation_pending', 'setup_pending']) {
    assert.equal(copy[status].tone, 'pending');
    assert.equal(nextStep(status), 'We are checking for the next step automatically.');
  }
  assert.equal(copy.cancelled.primaryHref, '/alphascreen/pricing');
  assert.doesNotMatch(source, /auth\.admin|generateLink\(|inviteUserByEmail|resetPasswordForEmail/);
});
