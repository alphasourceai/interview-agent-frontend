import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
const require=createRequire(import.meta.url),ts=require('typescript');
const lib=fs.readFileSync(new URL('./guardedPricingDev.ts',import.meta.url),'utf8');
const ast=ts.createSourceFile('guard.ts',lib,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
const source=ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='pricingDevPresentation').getText(ast).replace(/^export /,'');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
const presentation=vm.runInNewContext(js+';pricingDevPresentation');
const dev='https://interview-agent-dev-backend.onrender.com';
test('actual presentation helper requires exact dev URL and exact build flag; not backend authority',()=>{
 for(const base of [dev,'https://ia-backend-qa.onrender.com','https://api.alphasourceai.com',dev+'.untrusted.invalid',dev+'/'])
  for(const flag of [undefined,false,true,'TRUE','false','true']){
   const p=presentation(base,flag),isDev=base===dev;
   assert.equal(p.dev,isDev);assert.equal(p.sandbox,isDev&&flag==='true');assert.equal(p.previewOnly,isDev&&flag!=='true');
  }
 assert.match(lib,/import\.meta\.env\.VITE_DEV_PRICING_SANDBOX_ENABLED/);
 assert.match(lib,/API still refuses them unless its own startup verification passed/);
 assert.match(lib,/Email, voice and CRM remain off/);
});
test('actual banner keeps preview warning and honestly labels only shown Sandbox controls',()=>{
 const text=fs.readFileSync(new URL('../components/GuardedPricingDevBanner.tsx',import.meta.url),'utf8');
 const a=ts.createSourceFile('banner.tsx',text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 const fn=a.statements.find(ts.isFunctionDeclaration).getText(a).replace('export default ','');
 const body=ts.transpileModule(fn,{compilerOptions:{jsx:ts.JsxEmit.React,module:ts.ModuleKind.CommonJS}}).outputText;
 for(const sandbox of [false,true]){
  const Banner=vm.runInNewContext(body+';GuardedPricingDevBanner',{React,isGuardedPricingDev:true,isDevBillingSandbox:sandbox,guardedPricingDevMessage:'API still refuses unless verified'});
  const html=renderToStaticMarkup(React.createElement(Banner));
  assert.match(html,sandbox?/Dev Sandbox billing test/:/Dev pricing preview/);assert.match(html,/no live payments/);assert.match(html,/API still refuses unless verified/);
 }
});
test('only reviewed existing controls lift; email, public signup, sales and scheduler presentation stays held',()=>{
 const read=p=>fs.readFileSync(new URL(p,import.meta.url),'utf8');
 const signer=read('../pages/MembershipAgreementSignerPage.tsx'),billing=read('../pages/dashboard/BillingPage.tsx'),roles=read('../pages/dashboard/RolesPage.tsx');
 assert.equal((signer.match(/disabled=\{isPricingPreviewOnly/g)||[]).length,3);
 assert.equal((roles.match(/disabled=\{isPricingPreviewOnly/g)||[]).length,2);
 assert.match(billing,/const canPurchase = !isPricingPreviewOnly/);assert.match(billing,/disabled=\{isPricingPreviewOnly \|\| !billingClientId/);
 const clients=read('../pages/admin/AdminClientsPage.tsx');
 assert.equal((clients.match(/disabled=\{isPricingPreviewOnly/g)||[]).length,4);
 assert.match(clients,/disabled=\{isGuardedPricingDev \|\| processRenewalsBusy/);
 assert.equal((clients.match(/disabled=\{isGuardedPricingDev \|\| accessOverrideBusy/g)||[]).length,2);
 for(const p of ['../pages/AlphaScreenPricingPage.tsx','../pages/sales/SalesNewDealPage.tsx','../pages/sales/SalesDealsPage.tsx','../pages/admin/AdminBillingPage.tsx']){
  const s=read(p);assert.match(s,/isGuardedPricingDev/);assert.doesNotMatch(s,/isPricingPreviewOnly|isDevBillingSandbox/);
 }
});
