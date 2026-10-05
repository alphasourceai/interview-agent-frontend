import { test } from 'node:test';
import assert from 'node:assert/strict';
import { homeCounts, salesSignature, formatBusinessPhone } from './salesHome.mjs';
test('metrics match deals status rules; linked imports and canceled deals are not wins', () => {
  const statuses = ['agreement_sent','signed_payment_needed','checkout_in_progress','setup_in_progress','activated','needs_attention','expired','canceled'];
  assert.deepEqual(homeCounts(statuses.map(status=>({status})), [{status:'ready'}, {status:'ready',purchase_intent_id:'linked'}, {status:'won'}]), {ready:1,open:4,payment:2,won:1,attention:2});
  assert.deepEqual(homeCounts([], []), {ready:0,open:0,payment:0,won:0,attention:0});
});
test('signature escapes markup and never supplies an owner or borrowed phone', () => {
  const signature = salesSignature({display_name:'A <img onerror="alert(1)">',email:'a&b@example.com',business_phone_e164:'+17205550123'});
  assert.ok(signature.html.includes('&lt;img onerror=&quot;alert(1)&quot;&gt;'));
  assert.ok(signature.html.includes('a&amp;b@example.com'));
  assert.ok(!signature.html.includes('<img onerror'));
  assert.ok(signature.html.includes('tel:+17205550123'));
  assert.ok(signature.text.includes('720.555.0123'));
  for (const value of [null, '', 'javascript:alert(1)', '+17205550123" onmouseover="evil']) {
    const none = salesSignature({display_name:'Unassigned',email:'rep@example.com',business_phone_e164:value});
    assert.equal(formatBusinessPhone(value), '');
    assert.ok(!none.html.includes('tel:'));
    assert.ok(!none.text.includes('720.766.7817'));
  }
});
