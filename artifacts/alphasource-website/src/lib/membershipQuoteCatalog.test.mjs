import {test} from 'node:test';import assert from 'node:assert/strict';import {createRequire} from 'node:module';
import {parseMembershipQuoteCatalog,membershipInitialAmount,adminRetailQuotePayload} from './membershipQuoteCatalog.ts';
const require=createRequire(import.meta.url);
const backend=process.env.MEMBERSHIP_BACKEND_SOURCE ? require(process.env.MEMBERSHIP_BACKEND_SOURCE) : null;
function fixture(plan,months,payment){return {schema_version:2,offer_version:'synthetic',offer_key:`${plan}-${months}-${payment}`,
  plan_key:plan,display_name:plan==='basic'?'Essential':'Pro',currency:'usd',commitment_months:months,payment_option:payment,
  platform_payment_cents:100000,platform_commitment_total_cents:100000*(payment==='prepaid'?1:months),installment_count:payment==='prepaid'?1:months,
  initial_payment_cents:100000,term_start_basis:'first_payment_success',contract_timezone:'UTC',first_role_prepay:{selected:false,amount_cents:0},
  per_role_fee_cents:10000,additional_interview_fee_cents:1000,included_interviews_per_role:20,max_interview_minutes:10,scored_question_count:5,
  billing_model:plan==='basic'?'fixed':'rollover',rollover_days:plan==='basic'?null:90,
  renewal:{default_auto_renew:true,retain_accepted_pricing:true,commitment_months:months,non_renewal_cutoff:'before_term_end',ends_installments_early:false}}}
function catalog(audience){const offers=backend?backend.listRetailOffers({channel:audience}):['basic','pro'].flatMap(plan=>[3,6,12].flatMap(months=>
  (audience==='public'?['prepaid']:['prepaid','monthly_installments']).map(payment=>fixture(plan,months,payment))));
  const role=Object.fromEntries(['basic','pro'].map(plan=>[plan,backend?backend.buildRetailOffer({channel:audience,planKey:plan,
    commitmentMonths:3,paymentOption:'prepaid',offerVersion:offers[0].offer_version,firstRolePrepaySelected:true}).first_role_prepay.amount_cents:9000]));
  return {pricing_version:offers[0].offer_version,offers,first_role_prepay_prices:role}}
test('absence selects existing legacy shape; malformed explicit catalog refuses instead of cheap fallback',()=>{
  assert.equal(parseMembershipQuoteCatalog({packages:[{plan_key:'basic'}]},'public'),null);
  assert.equal(parseMembershipQuoteCatalog({items:[{plan_key:'basic'}]},'sales'),null);
  for(const value of [null,{pricing_version:'v2'}, {offers:[]},{first_role_prepay_prices:{}},{items:[{schema_version:2}]}])
    assert.throws(()=>parseMembershipQuoteCatalog(value,'sales'));
});
test('complete public and staff server catalogs supply role amounts and accepted features',()=>{
  for(const audience of ['public','sales','admin']){
    const c=parseMembershipQuoteCatalog(catalog(audience),audience);
    assert.equal(c.offers.length,audience==='public'?6:12);assert.equal(c.plans.basic.scored_question_count,5);
    for(const offer of c.offers){assert.equal(membershipInitialAmount(offer,c.plans[offer.plan_key],true),
      offer.platform_payment_cents+c.plans[offer.plan_key].first_role_prepay_price_cents)}
    assert.equal(c.plans.basic.rollover_days,null);assert.equal(c.plans.pro.rollover_days,90);
  }
});
test('partial mixed-version inconsistent-cap amount and role catalogs fail closed',()=>{
  const base=catalog('sales');
  for(const alter of [c=>c.offers.pop(),c=>c.pricing_version='old',c=>c.offers[1].scored_question_count=7,
    c=>c.first_role_prepay_prices.basic=0,c=>c.offers[0].offer_key='wrong',c=>c.offers[0].rollover_days=90,
    c=>c.offers[0].included_interviews_per_role=null,c=>c.offers[0].additional_interview_fee_cents=-1]){
    const c=structuredClone(base);alter(c);assert.throws(()=>parseMembershipQuoteCatalog(c,'sales'));
  }
  assert.throws(()=>parseMembershipQuoteCatalog(base,'public'));
});
test('admin retail matrix sends identity and current selection keys only, never old term or money fields',()=>{
  const c=parseMembershipQuoteCatalog(catalog('admin'),'admin');
  const identity={client_id:'synthetic-parent',attached_client_id:'synthetic-parent',client_mode:'attach_existing_client',
    confirm_replace_existing:true,client_legal_name:'Synthetic',dba_trade_name:'Synthetic',primary_admin_name:'QA',
    admin_email:'buyer@example.invalid',candidate_assistance_contact:null,
    platform_fee:1,per_role_fee:1,additional_interview_fee:1,included_interviews_per_role:99,
    initial_term_start:'wrong-date',initial_renewal_date:'wrong-date',billing_option:'annual',auto_renew:false,notice_deadline_days:999};
  let count=0;
  for(const offer of c.offers)for(const role of [false,true]){
    const payload=adminRetailQuotePayload(identity,c,{offerKey:offer.offer_key,offerVersion:offer.offer_version},offer.plan_key,role);
    assert.equal(payload.commitment_months,offer.commitment_months);assert.equal(payload.payment_option,offer.payment_option);
    assert.equal(payload.offer_version,offer.offer_version);assert.equal(payload.first_role_prepay_selected,role);
    assert.equal(payload.client_id,identity.client_id);assert.equal(payload.confirm_replace_existing,true);
    for(const key of ['platform_fee','per_role_fee','additional_interview_fee','included_interviews_per_role','initial_term_start',
      'initial_renewal_date','billing_option','auto_renew','notice_deadline_days','package_snapshot','stripe_price_id'])assert.equal(Object.hasOwn(payload,key),false);
    count++;
  }
  assert.equal(count,24);
  assert.throws(()=>adminRetailQuotePayload(identity,c,null,'basic',false));
  assert.throws(()=>adminRetailQuotePayload(identity,c,{offerKey:c.offers[0].offer_key,offerVersion:'old'},'basic',false));
});
