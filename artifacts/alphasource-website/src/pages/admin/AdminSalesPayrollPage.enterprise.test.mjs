// Structural source checks, not a signed-in browser/visual acceptance claim.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('./AdminSalesPayrollPage.tsx',import.meta.url),'utf8');
test('Enterprise manual receipts reuse Advanced form and same authenticated POST, no new money workflow',()=>{
 assert.ok(source.indexOf('Sale source<select')>source.indexOf('{advancedOpen &&'));
 assert.ok(source.includes('void submit("/receipts", {'));
 assert.ok(source.includes('enterprise_agreement_id: enterpriseAgreementId'));
 assert.ok(source.includes(': { purchase_intent_id: intentId }'));
 assert.ok(source.includes('Original attribution and the first-payment commission year stay fixed.'));
 assert.ok(source.includes('Exclude prepaid interview pools, usage charges and tax.'));
 assert.ok(source.includes('Stripe invoice ID (in_…)'));
});
test('existing Enterprise attribution is disabled and first attestation resets when source or agreement changes',()=>{
 assert.ok(source.includes('disabled={!!storedEnterpriseRep} value={storedEnterpriseRep || originalRepId}'));
 assert.ok(source.includes('original_rep_user_id: storedEnterpriseRep || originalRepId || null'));
 assert.ok(source.includes('setEnterpriseAgreementId(e.target.value); setOriginalRepId(""); setOriginalRepAttested(false);'));
 assert.ok(source.includes('setReceiptSource(next); setOriginalRepAttested(false);'));
 assert.ok(source.includes('Native receipt verification checks this again.'));
});
test('manual review and existing main summary, export, automation-off and ACH-already-sent remain',()=>{
 for(const text of ['<AdminSalesPayrollSummary','Record an ACH already sent','This does not send money.',
  'Off — not yet available','Approve receipt']){
  assert.ok(source.includes(text),text);
 }
 assert.ok(source.includes('Monthly platform payment'));assert.ok(source.includes('Prepaid or annual platform payment'));
});
