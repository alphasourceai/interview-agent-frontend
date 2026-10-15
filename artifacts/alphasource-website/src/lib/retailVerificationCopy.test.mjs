import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),ts=require('typescript');
const source=fs.readFileSync(new URL('../pages/AlphaScreenPricingPage.tsx',import.meta.url),'utf8');
const ast=ts.createSourceFile('pricing.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const fn=ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='retailVerificationErrorMessage');
const js=ts.transpileModule(fn.getText(ast),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
const message=vm.runInNewContext(js+';retailVerificationErrorMessage');
test('dev recipient policy has a fixed actionable message, not a misleading transient-send error',()=>{
 assert.equal(message('DEV_PRICING_TEST_MAIL_DENIED','fallback','send'),
  'Dev email delivery is limited to approved test addresses. Use an approved address or ask the admin to add this alias.');
 assert.equal(message('RETAIL_EMAIL_VERIFICATION_SEND_FAILED','fallback','send'),
  "We couldn't send the verification code. Try again in a moment.");
 assert.equal(message('unknown-untrusted-value','safe fallback','send'),'safe fallback');
});
test('disabled dev SMS is explained without changing its availability or turning on a sender',()=>{
 assert.match(source,/const smsVerificationAvailable = !isGuardedPricingDev &&/);
 assert.match(source,/isGuardedPricingDev \? "Disabled in dev — use email" : "U\.S\. mobile numbers only"/);
 assert.match(source,/disabled=\{!choice\.enabled\}/);
});
