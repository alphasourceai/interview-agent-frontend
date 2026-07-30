import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = await readFile(path.join(root, "src/pages/admin/AdminCandidatesPage.tsx"), "utf8");

assert.match(source, /interview_recovery_core_email\?: unknown/);
assert.match(source, /setRecoveryCoreEmailEnabled\(featurePayload\?\.interview_recovery_core_email === true\)/);
assert.match(source, /\{recoveryCoreEmailEnabled && \([\s\S]*submitReset\("reset_and_send"\)[\s\S]*Reset and send[\s\S]*\)\}/);
assert.match(source, /submitReset\("reset_only"\)/);
assert.match(source, /Manual review required\. No additional vendor conversation will be created automatically\./);
assert.match(source, /Run read-only vendor reconciliation/);
assert.match(source, /Recover stored vendor binding/);
assert.match(source, /One vendor conversation found — resolved/);
assert.match(source, /No vendor conversation visible — manual review/);
assert.match(source, /Multiple vendor conversations found — manual review/);
assert.match(source, /Manual review required — the Tavus account contains more conversations than can be verified safely in one response/);
assert.match(source, /Provider succeeded; database binding requires recovery/);
assert.match(source, /max-h-\[85vh\] overflow-y-auto/);
assert.doesNotMatch(source, />\s*Retry vendor create\s*</i);

console.log("Recovery Core UI verification passed: manual-review states, protected reconciliation, email gating, and modal height safety are present without a vendor-create retry control.");
