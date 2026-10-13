import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
const require=createRequire(import.meta.url),ts=require('typescript');
const src=fs.readFileSync(new URL('../components/LeadCaptureForm.tsx',import.meta.url),'utf8');
const js=ts.transpileModule(src,{compilerOptions:{jsx:ts.JsxEmit.React,module:ts.ModuleKind.CommonJS}}).outputText;
const exports={};
vm.runInNewContext(js,{exports,React,require:name=>{
 if(name==='react')return React;
 if(name==='lucide-react')return{CheckCircle:()=>null};
 if(name==='@/lib/leadCapture')return{getLeadDraftId:()=> 'synthetic-local',hasUsableContact:()=>false,saveLeadDraft:()=>{throw Error('No send allowed')}};
 if(name==='@/lib/analytics')return{trackEvent:()=>{throw Error('No analytics allowed')}};
 throw Error('Unexpected import '+name);
}});
const props={formId:'synthetic',formType:'demo',formTestId:'synthetic-form',productInterest:'alphascreen',successTitle:'Done',successBody:'Done'};
test('actual shared form preserves its default heading for existing callers',()=>{
 const html=renderToStaticMarkup(React.createElement(exports.default,props));
 assert.match(html,/>Request a Demo<\/h3>/);assert.match(html,/>Submit<\/button>/);
});
test('pricing form supports Contact Sales heading and submit label without a form pipeline change',()=>{
 const html=renderToStaticMarkup(React.createElement(exports.default,{...props,heading:'Contact Sales',ctaLabel:'Contact Sales'}));
 assert.match(html,/>Contact Sales<\/h3>/);assert.match(html,/>Contact Sales<\/button>/);
 assert.doesNotMatch(html,/Request a Demo/);
 const page=fs.readFileSync(new URL('../pages/AlphaScreenPricingPage.tsx',import.meta.url),'utf8');
 const contact=page.slice(page.indexOf('<section id="pricing-demo"'));
 assert.match(contact,/heading="Contact Sales"/);assert.match(contact,/ctaLabel="Contact Sales"/);
 assert.match(contact,/formId="alphascreen-pricing-demo"/);assert.match(contact,/formType="demo"/);
});
test('custom headings are ordinary escaped text, never interpreted as HTML',()=>{
 const html=renderToStaticMarkup(React.createElement(exports.default,{...props,heading:'<img src=x>'}));
 assert.match(html,/&lt;img src=x&gt;/);assert.doesNotMatch(html,/<img src=x>/);
});
