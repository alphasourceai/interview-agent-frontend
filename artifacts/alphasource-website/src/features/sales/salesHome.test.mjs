import { test } from 'node:test';
import assert from 'node:assert/strict';
import { homeCounts, salesSignature, signatureProfile, formatBusinessPhone } from './salesHome.mjs';
test('metrics match deals status rules; linked imports and canceled deals are not wins', () => {
  const statuses = ['agreement_sent','signed_payment_needed','checkout_in_progress','setup_in_progress','activated','needs_attention','expired','canceled'];
  assert.deepEqual(homeCounts(statuses.map(status=>({status})), [{status:'ready'}, {status:'ready',purchase_intent_id:'linked'}, {status:'won'}]), {ready:1,open:4,payment:2,won:1,attention:2});
  assert.deepEqual(homeCounts([], []), {ready:0,open:0,payment:0,won:0,attention:0});
});
test('admin signature uses only its matching account name, verified email and no borrowed phone', () => {
  const admin = {user_id:'admin-a',display_name:'Global Admin',email:'admin@example.com',access_role:'global_admin',business_phone_e164:'+17205550123'};
  const profile = signatureProfile(admin, {id:'admin-a', user_metadata:{full_name:'Admin <img onerror="evil">',email:'other@example.com',access_role:'sales_rep',business_phone_e164:'+17205550999'}});
  assert.equal(profile.access_role, 'global_admin');
  assert.equal(profile.email, 'admin@example.com');
  assert.equal(profile.business_phone_e164, null);
  const signature = salesSignature(profile);
  assert.ok(signature.html.includes('Admin &lt;img onerror=&quot;evil&quot;&gt;'));
  assert.ok(!signature.html.includes('<img onerror'));
  assert.ok(signature.text.includes('admin@example.com'));
  assert.ok(!signature.text.includes('other@example.com'));
  assert.ok(!signature.text.includes('Independent Sales Representative'));
  assert.ok(!signature.html.includes('tel:'));
  assert.equal(admin.business_phone_e164, '+17205550123');
  assert.ok(!salesSignature(admin).html.includes('tel:'));
  assert.ok(!salesSignature(admin).text.includes('720.555.0123'));
});
test('admin name has safe fallbacks and never borrows another account identity', () => {
  const admin = {user_id:'admin-a',display_name:'Global Admin',email:'admin@example.com',access_role:'global_admin'};
  for (const user of [null,{id:'admin-b',user_metadata:{full_name:'Someone else'}},{id:'admin-a',user_metadata:{full_name:123,name:' '}}]) {
    assert.equal(signatureProfile(admin,user).display_name,'Global Admin');
  }
  assert.equal(signatureProfile(admin,{id:'admin-a',user_metadata:{full_name:' ',name:'  Admin Name  '}}).display_name,'Admin Name');
  assert.equal(signatureProfile(admin,{id:'admin-a',user_metadata:{display_name:'A'.repeat(500)}}).display_name.length,120);
});
test('rep signature identity and independent-contractor wording are unchanged by account metadata', () => {
  const rep = {user_id:'rep-a',display_name:'Rep A',email:'rep@example.com',access_role:'sales_rep',business_phone_e164:'+17205550123'};
  assert.equal(signatureProfile(rep,{id:'rep-a',user_metadata:{full_name:'Override',access_role:'global_admin'}}), rep);
  const signature = salesSignature(signatureProfile(rep,null));
  assert.ok(signature.text.includes('Independent Sales Representative | alphaSource'));
  assert.ok(signature.html.includes('tel:+17205550123'));
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
