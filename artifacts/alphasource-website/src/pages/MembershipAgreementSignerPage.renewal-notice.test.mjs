import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const source=fs.readFileSync(new URL('./MembershipAgreementSignerPage.tsx',import.meta.url),'utf8');
test('signer reminder wording is selected only by the exact server-validated marker',()=>{
 assert.match(source,/renewal_notice_type: sessionPayload\.renewal_notice_type === "reminder_only" \? "reminder_only" : null/);
 assert.match(source,/session\.renewal_notice_type === "reminder_only"/);
 assert.match(source,/Renewal reminder:.*not a cancellation deadline/);
 assert.doesNotMatch(source,/Renewal reminder:.*before term end/);
});
test('signer preserves the existing notice deadline for legacy and customizable Enterprise sessions',()=>{
 assert.match(source,/: `Notice deadline: \$\{session\.notice_deadline_days \|\| 30\} days`/);
 assert.doesNotMatch(source,/membership_tier\s*===\s*["'](?:basic|pro)["']\s*\?\s*[`"']Renewal reminder/);
});
