import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
import ts from 'typescript';import {execFileSync} from 'node:child_process';
import {enterpriseAgreementSettingsPayload} from '../../lib/enterpriseAgreementFields.ts';
const file=new URL('./AdminBillingPage.tsx',import.meta.url),current=fs.readFileSync(file,'utf8');
const old=execFileSync('git',['show','a7e15f65017a7560befe76aecc9483503e16e773:artifacts/alphasource-website/src/pages/admin/AdminBillingPage.tsx'],{encoding:'utf8',cwd:new URL('../../../../../',import.meta.url)});
function builder(source,context){
  const ast=ts.createSourceFile(file.pathname,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);let declaration;
  function visit(node){if(ts.isVariableDeclaration(node)&&node.name.getText(ast)==='buildAgreementPayload')declaration=node;ts.forEachChild(node,visit)}visit(ast);
  assert.ok(declaration,'actual admin payload builder present');
  const js=ts.transpileModule(`const ${declaration.getText(ast)};globalThis.build=buildAgreementPayload;`,
    {compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
  const c=vm.createContext({...context});vm.runInContext(js,c);return confirmed=>JSON.parse(JSON.stringify(c.build(confirmed)));
}
const base={clientLegalName:'Synthetic',dbaTradeName:'Synthetic DBA',primaryAdmin:'QA Buyer',adminEmail:'buyer@example.invalid',
  candidateAssistanceContact:'qa@example.invalid',platformFee:'1200',perRoleFee:'300',additionalInterviewFee:'20',includedInterviewsPerRole:'10',
  initialTermStart:'2026-10-13',initialRenewalDate:'2027-10-13',autoRenew:'yes',noticeDeadlineDays:'30'};
test('actual admin legacy and Enterprise payloads equal exact prior working builder',()=>{
  let count=0;
  for(const membershipTier of ['basic','pro','enterprise'])for(const billingOption of ['monthly','annual'])
  for(const agreementClientMode of ['attach_existing_client','add_new_client'])for(const confirmed of [false,true])
  for(const billingModel of membershipTier==='enterprise'?['fixed','rollover','usage']:['fixed']){
    const context={retailQuote:false,retailCatalog:null,retailSelection:null,retailFirstRoleSelected:false,
      agreementForm:{...base,membershipTier,billingOption},agreementClientMode,scopedAgreementClientId:'synthetic-parent',
      enterpriseFields:{billingModel,rolloverDays:'120',maxInterviewMinutes:'15',scoredQuestionCount:'7',usageInterviewFee:'25.50',poolQuantity:'30'},
      enterpriseAgreementSettingsPayload};
    assert.deepEqual(builder(current,context)(confirmed),builder(old,context)(confirmed));count++;
  }
  assert.equal(count,40);
});
test('admin source binds catalog authority existing parent guard and async-preview invalidation',()=>{
  assert.match(current,/parseMembershipQuoteCatalog\(await response\.json\(\), "admin"\)/);
  assert.match(current,/if \(agreementClientMode === "attach_existing_client" && selectedClientIsChild\)/);
  assert.match(current,/!retailQuote && !agreementForm\.initialTermStart\.trim\(\)/);
  assert.match(current,/!retailQuote && !agreementForm\.initialRenewalDate\.trim\(\)/);
  assert.match(current,/if \(previewInFlight\.current \|\| sendInFlight\.current\) return/);
  assert.match(current,/const requestPayload = buildAgreementPayload\(confirmReplaceExisting\)/);
  assert.match(current,/body: JSON\.stringify\(requestPayload\)/);
  assert.match(current,/revision !== agreementRevisionRef\.current/);
  assert.match(current,/\}, \[agreementRevision\]\)/);
  assert.match(current,/role="alert"/);assert.match(current,/aria-label="Membership tier"/);
  assert.doesNotMatch(current,/auth\.admin|inviteUserByEmail|createUser\(|signUp\(/);
});
