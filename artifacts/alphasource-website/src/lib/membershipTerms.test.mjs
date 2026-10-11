import {test} from 'node:test';import assert from 'node:assert/strict';import {createRequire} from 'node:module';
import {parseMembershipOffers,membershipSelectionPayload,selectedMembershipOffer,membershipObligationCopy,membershipMoney} from './membershipTerms.ts';
// Portable dummy-price fixtures; optionally cross-check the exact backend
// catalog through an explicitly selected local source. No FE price catalog.
const require=createRequire(import.meta.url);
const fixture=(plan,months,option)=>({schema_version:2,offer_version:'dummy-v2',offer_key:`${plan}-${months}-${option}`,
  plan_key:plan,display_name:plan==='basic'?'Essential':'Pro',currency:'usd',commitment_months:months,
  payment_option:option,platform_payment_cents:120000,platform_commitment_total_cents:120000*(option==='prepaid'?1:months),
  installment_count:option==='prepaid'?1:months,initial_payment_cents:120000,term_start_basis:'first_payment_success',
  contract_timezone:'UTC',first_role_prepay:{selected:false,amount_cents:0},renewal:{default_auto_renew:true,
    retain_accepted_pricing:true,commitment_months:months,non_renewal_cutoff:'before_term_end',ends_installments_early:false}});
const raw=process.env.MEMBERSHIP_BACKEND_SOURCE
  ? require(process.env.MEMBERSHIP_BACKEND_SOURCE).listRetailOffers({channel:'sales'})
  : ['basic','pro'].flatMap(plan=>[3,6,12].flatMap(months=>['prepaid','monthly_installments'].map(option=>fixture(plan,months,option))));
test('public gets six prepaid offers; authenticated sales/admin get twelve',()=>{
  assert.equal(parseMembershipOffers(raw,'public').length,6);
  assert.equal(parseMembershipOffers(raw,'sales').length,12);
  assert.equal(parseMembershipOffers(raw,'admin').length,12);
  assert.ok(parseMembershipOffers(raw,'public').every(offer=>offer.payment_option==='prepaid'));
});
test('selection is version-locked and plan-specific; stale selection is not repriced',()=>{
  const offers=parseMembershipOffers(raw,'sales'),offer=offers[0];
  assert.equal(selectedMembershipOffer(offers,{offerKey:offer.offer_key,offerVersion:offer.offer_version},'basic')?.offer_key,offer.offer_key);
  assert.equal(selectedMembershipOffer(offers,{offerKey:offer.offer_key,offerVersion:'older'},'basic'),null);
  assert.equal(selectedMembershipOffer(offers,{offerKey:offer.offer_key,offerVersion:offer.offer_version},'pro'),null);
  assert.equal(selectedMembershipOffer(offers,null,'basic'),null);
});
test('request sends selection keys, never client prices or legacy cadence',()=>{
  for(const offer of parseMembershipOffers(raw,'sales')) {
    assert.deepEqual(membershipSelectionPayload(offer),{offer_version:offer.offer_version,plan_key:offer.plan_key,
      commitment_months:offer.commitment_months,payment_option:offer.payment_option});
    assert.equal(Object.hasOwn(membershipSelectionPayload(offer),'billing_cadence'),false);
    assert.equal(Object.hasOwn(membershipSelectionPayload(offer),'platform_payment_cents'),false);
  }
});
test('unknown server fields are not projected into display state or checkout input',()=>{
  const offers=parseMembershipOffers([{...raw[0],stripe_secret:'not-a-secret',internal_context:{customer:'foreign'}}],'sales');
  assert.equal(Object.hasOwn(offers[0],'stripe_secret'),false);assert.equal(Object.hasOwn(offers[0],'internal_context'),false);
});
test('obligation copy distinguishes prepaid from current-term monthly payments without notice cutoff',()=>{
  const offers=parseMembershipOffers(raw,'sales');
  assert.match(membershipObligationCopy(offers[0]),/full prepaid term/);
  assert.match(membershipObligationCopy(offers[1]),/All 3 monthly payments remain due/);
  assert.doesNotMatch(membershipObligationCopy(offers[1]),/30.days|cancel.*at any time/i);
  assert.equal(membershipMoney(650000),'$6,500.00');
  assert.equal(membershipMoney(Number.MAX_SAFE_INTEGER),'$90,071,992,547,409.91');
});
test('malformed amounts/currency/versions/policy/totals and duplicate identity fail closed',()=>{
  for(const change of [{schema_version:1},{currency:'eur'},{offer_version:''},{payment_option:'annual'},
    {platform_payment_cents:-1},{platform_payment_cents:120000.5},{initial_payment_cents:1},
    {commitment_months:'3'},{plan_key:['basic']},{payment_option:['prepaid']},{platform_commitment_total_cents:9007199254740992},
    {renewal:{...raw[0].renewal,default_auto_renew:false}},{first_role_prepay:{selected:true,amount_cents:0}}]) {
    assert.throws(()=>parseMembershipOffers([{...raw[0],...change}],'sales'));
  }
  assert.throws(()=>parseMembershipOffers([raw[0],raw[0]],'sales'));
  assert.throws(()=>parseMembershipOffers([raw[0],{...raw[0],offer_key:'different-key'}],'sales'));
  assert.throws(()=>parseMembershipOffers([raw[0],{...raw[1],offer_version:'other-version'}],'sales'));
  assert.throws(()=>parseMembershipOffers({},'sales'));
  assert.throws(()=>parseMembershipOffers(raw,'unknown'));
  assert.throws(()=>membershipMoney(1.5));
});
