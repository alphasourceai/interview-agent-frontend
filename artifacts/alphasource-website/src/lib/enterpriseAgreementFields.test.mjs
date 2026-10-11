import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultEnterpriseAgreementFields, enterpriseAgreementFieldError, enterpriseAgreementSettingsPayload } from './enterpriseAgreementFields.ts';

const standard = { ...defaultEnterpriseAgreementFields(), maxInterviewMinutes: '30', scoredQuestionCount: '4' };
test('Enterprise must explicitly configure interview capacity', () => {
  assert.match(enterpriseAgreementFieldError(defaultEnterpriseAgreementFields()), /length/);
  assert.equal(enterpriseAgreementFieldError(standard), null);
  assert.equal(enterpriseAgreementSettingsPayload(standard).billing_model, 'fixed');
});
test('rollover validity is only sent for the rollover model', () => {
  assert.equal(enterpriseAgreementSettingsPayload(standard).rollover_days, null);
  assert.equal(enterpriseAgreementSettingsPayload({ ...standard, billingModel: 'rollover' }).rollover_days, 90);
  assert.match(enterpriseAgreementFieldError({ ...standard, billingModel: 'rollover', rolloverDays: '366' }), /rollover/);
});
test('usage sends exact cents and a custom pool, without browser discount fields', () => {
  const value = { ...standard, billingModel: 'usage', usageInterviewFee: '23.49', poolQuantity: '37' };
  assert.deepEqual(enterpriseAgreementSettingsPayload(value), {
    billing_model: 'usage', rollover_days: null, max_interview_minutes: 30,
    scored_question_count: 4, usage_interview_fee_cents: 2349, pool_quantity: 37,
  });
  assert.equal(enterpriseAgreementSettingsPayload({ ...value, poolQuantity: '' }).pool_quantity, null);
  assert.equal(enterpriseAgreementSettingsPayload({ ...value, poolQuantity: '0' }).pool_quantity, null);
});
test('model changes exclude stale usage fields from Standard', () => {
  const payload = enterpriseAgreementSettingsPayload({ ...standard, usageInterviewFee: '25', poolQuantity: '50' });
  assert.equal(payload.usage_interview_fee_cents, null);
  assert.equal(payload.pool_quantity, null);
});
test('invalid money, scientific notation, excessive decimals and invalid counts fail closed', () => {
  const usage = { ...standard, billingModel: 'usage', usageInterviewFee: '25', poolQuantity: '20' };
  for (const usageInterviewFee of ['0', '-1', '1e3', '0.001', '25usd', '9007199254740992']) {
    assert.match(enterpriseAgreementFieldError({ ...usage, usageInterviewFee }), /price/);
    assert.throws(() => enterpriseAgreementSettingsPayload({ ...usage, usageInterviewFee }));
  }
  for (const poolQuantity of ['2.5', '-1', '1e2', '9007199254740992']) {
    assert.match(enterpriseAgreementFieldError({ ...usage, poolQuantity }), /whole/);
  }
  assert.match(enterpriseAgreementFieldError({ ...standard, scoredQuestionCount: '8' }), /question/);
  assert.match(enterpriseAgreementFieldError({ ...standard, maxInterviewMinutes: '60' }), /length/);
  assert.match(enterpriseAgreementFieldError({ ...standard, billingModel: 'other' }), /model/);
});
