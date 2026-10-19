// Structural checks supplement, not replace, hosted browser acceptance.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('./SalesRenewalCommissionControl.tsx',import.meta.url),'utf8');
const page=readFileSync(new URL('./AdminSalesPayrollPage.tsx',import.meta.url),'utf8');
test('control stays in existing payroll Actions with accessible switch and explicit confirmation',()=>{
  assert.ok(page.indexOf('<SalesRenewalCommissionControl')>page.indexOf('Payroll actions</h2>'));
  for(const text of ['<Switch','aria-labelledby=','<AlertDialogContent>','<AlertDialogCancel','confirmed: true','expected_version: policy.version'])assert.ok(source.includes(text),text);
  assert.ok(source.includes('onCheckedChange={value => setPending(value)}'));
});
test('saved state is server-confirmed and errors require refresh, not automatic retry',()=>{
  assert.ok(source.includes('const saved = readPolicy(await request('));
  assert.ok(source.includes('setPolicy(saved); setPending(null);'));
  assert.ok(source.includes('setPolicy(null); setPending(null);'));
  assert.ok(source.includes('disabled={!policy || saving}'));
});
test('copy distinguishes initial installments, unchanged earned history and customer renewal',()=>{
  for(const text of ['including its monthly installments','Applies to new receipt approvals','locked statements stay unchanged',
    'Customer billing and auto-renewal are unaffected','original first-year'])assert.ok(source.includes(text),text);
});
