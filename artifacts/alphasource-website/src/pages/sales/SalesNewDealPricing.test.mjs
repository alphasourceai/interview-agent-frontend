import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import ts from 'typescript';
const file=new URL('./SalesNewDealPage.tsx',import.meta.url),source=fs.readFileSync(file,'utf8');
const ast=ts.createSourceFile(file.pathname,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const names=['normalizedText','normalizedPhone','salesDraftFingerprint','promotionEligibilityFingerprint'];
const functions=ast.statements.filter(node=>ts.isFunctionDeclaration(node)&&names.includes(node.name?.text)).map(node=>node.getFullText(ast)).join('\n');
const js=ts.transpileModule(functions,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
const c=vm.createContext({});vm.runInContext(js,c);
const legacy={plan_key:'basic',billing_cadence:'monthly',promotion_code:'',first_role_prepay_selected:false};
test('actual draft and promotion fingerprints include selected term payment and version',()=>{
  for(const name of ['salesDraftFingerprint','promotionEligibilityFingerprint']){
    const baseline=c[name](legacy);
    for(const override of [{commitment_months:3},{payment_option:'monthly_installments'},{offer_version:'version'}])
      assert.notEqual(c[name]({...legacy,...override}),baseline);
    assert.notEqual(c[name]({...legacy,commitment_months:3}),c[name]({...legacy,commitment_months:6}));
    assert.equal(c[name]({...legacy,buyer_email:'buyer@example.invalid'}),name==='promotionEligibilityFingerprint'?baseline:c[name]({...legacy,buyer_email:'buyer@example.invalid'}));
  }
});
test('existing quote UX keeps preview and idempotent-send race guards and requires validated catalog',()=>{
  assert.match(source,/salesApi\.getMembershipCatalog\(\)/);
  assert.match(source,/draftFingerprintRef\.current !== sourceFingerprint/);
  assert.match(source,/salesDraftFingerprint\(nextPreview\.normalized_draft\) !== sourceFingerprint/);
  assert.match(source,/existingAttempt\?\.previewId === preview\.preview_id/);
  assert.match(source,/catalog && !selectedOffer/);
  assert.match(source,/delete next\.commitment_months; delete next\.payment_option; delete next\.offer_version/);
  assert.match(source,/Prepaid prices cannot be combined with a promotion/);
  assert.match(source,/The term starts on successful payment/);
  assert.match(source,/Platform commitment total/);
  assert.doesNotMatch(source,/signUp\(|inviteUserByEmail\(|auth\.admin|resetPasswordForEmail/);
});
