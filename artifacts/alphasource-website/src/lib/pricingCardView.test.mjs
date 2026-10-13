// Server-render the actual card JSX, without a browser or provider requests.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {membershipCardPricing,parseMembershipQuoteCatalog} from './membershipQuoteCatalog.ts';
import {membershipMoney} from './membershipTerms.ts';
const require=createRequire(import.meta.url),ts=require('typescript');
const source=fs.readFileSync(new URL('../pages/AlphaScreenPricingPage.tsx',import.meta.url),'utf8');
const ast=ts.createSourceFile('pricing.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const fragments=['PackageMetric','PlanCard'].map(name=>ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text===name).getText(ast)).join('\n');
const js=ts.transpileModule(fragments,{compilerOptions:{jsx:ts.JsxEmit.React,module:ts.ModuleKind.CommonJS}}).outputText;
const icon=()=>React.createElement('span');
const PlanCard=vm.runInNewContext(js+'\nPlanCard;',{
 React,membershipCardPricing,membershipMoney,formatUsd:n=>'$'+n,formatPlatformFee:()=>'$legacy',
 PLAN_ACCENTS:{basic:{color:'#02D99D'},pro:{color:'#A380F6'}},BEST_FOR:{basic:'Essential test',pro:'Pro test'},
 BriefcaseBusiness:icon,Layers3:icon,CheckCircle:icon,Clock3:icon,BadgeDollarSign:icon,ArrowRight:icon,
});
function fixture(){const refs={basic:{3:44900,6:39900,12:34900},pro:{3:74900,6:69900,12:64900}};
 const offers=['basic','pro'].flatMap(plan=>[3,6,12].map(months=>({schema_version:2,offer_version:'fixture',
 offer_key:`${plan}-${months}-prepaid`,plan_key:plan,display_name:plan==='basic'?'Essential':'Pro',currency:'usd',
 commitment_months:months,payment_option:'prepaid',platform_payment_cents:months*100000,platform_commitment_total_cents:months*100000,
 installment_count:1,initial_payment_cents:months*100000,term_start_basis:'first_payment_success',contract_timezone:'UTC',
 first_role_prepay:{selected:false,amount_cents:0},per_role_fee_cents:plan==='basic'?39900:69900,additional_interview_fee_cents:2500,
 included_interviews_per_role:20,max_interview_minutes:10,scored_question_count:5,billing_model:plan==='basic'?'fixed':'rollover',
 rollover_days:plan==='basic'?null:90,renewal:{default_auto_renew:true,retain_accepted_pricing:true,commitment_months:months,
 non_renewal_cutoff:'before_term_end',ends_installments_early:false}})));
 return parseMembershipQuoteCatalog({pricing_version:'fixture',offers,first_role_prepay_prices:{basic:35900,pro:62900},monthly_payment_references:refs},'public');}
test('actual card JSX displays only the selected term and both exact server prices, keeping role-fee styling',()=>{
 const catalog=fixture();
 for(const plan_key of ['basic','pro'])for(const months of [3,6,12]){
  const html=renderToStaticMarkup(React.createElement(PlanCard,{plan:{plan_key,display_name:catalog.plans[plan_key].display_name,
   per_role_fee:catalog.plans[plan_key].per_role_fee_cents/100,included_interviews_per_role:20,max_interview_minutes:10,additional_interview_fee:25},
   selected:false,billingCadence:'monthly',onStart:()=>{},catalog,available:true,commitmentMonths:months}));
  assert.match(html,new RegExp('>'+months+'</span>'));
  assert.ok(html.includes(membershipMoney(months*100000)+' prepay'));
  assert.ok(html.includes(membershipMoney(catalog.monthly_payment_references[plan_key][months])+' monthly'));
  assert.ok(html.includes('through sales'));assert.doesNotMatch(html,/3 \/ 6 \/ 12|Optional first-role prepay/);
  assert.match(html,new RegExp('class="mt-2 text-sm font-black text-\\[#0A1547\\]">\\+ \\$'+(plan_key==='basic'?399:699)+' / role'));
 }
});
test('saved intent returns before applying a new card selection and the shared toggle is accessible',()=>{
 const start=source.slice(source.indexOf('const startPurchase ='),source.indexOf('const closeCheckoutModal ='));
 assert.ok(start.indexOf('return;')<start.indexOf('const cardOffer ='));
 assert.match(source,/role="group" aria-label="Membership length"/);
 assert.match(source,/aria-pressed=\{cardCommitmentMonths === months\}/);
 assert.match(start,/offerKey: cardOffer\.offer_key/);
});
