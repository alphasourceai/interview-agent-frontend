import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(testDir, "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");
const bundled = await build({
  entryPoints: [path.join(root, "src/lib/passkeyErrors.ts")],
  bundle: true,
  format: "esm",
  platform: "node",
  write: false,
});
const passkeyErrors = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString("base64")}`);

test("profile settings are routed outside sidebar navigation", () => {
  const app = read("src/App.tsx");
  const layout = read("src/components/DashboardLayout.tsx");
  assert.match(app, /path="\/dashboard\/profile"\s+component=\{ProfileSettingsPage\}/);
  assert.doesNotMatch(layout, /label:\s*"Profile Settings"/);
});

test("account menu owns Profile Settings and Sign Out while support and tour stay in the sidebar", () => {
  const layout = read("src/components/DashboardLayout.tsx");
  assert.match(layout, /aria-label="Open account menu"/);
  assert.match(layout, />\s*Profile Settings\s*</);
  assert.match(layout, />\s*Sign Out\s*</);
  assert.match(layout, /<SupportVoicePopover/);
  assert.match(layout, /Need a refresher\?/);
  assert.match(layout, /Start tour/);
  assert.doesNotMatch(layout, /Sign out and version/);
});

test("profile offers identity, System-default appearance, password fallback, and passkey management", () => {
  const page = read("src/pages/dashboard/ProfileSettingsPage.tsx");
  const appearance = read("src/context/AppearanceContext.tsx");
  assert.match(page, /Personal information/);
  assert.match(page, /Email address/);
  assert.match(page, /Send password reset email/);
  assert.match(page, /auth\.registerPasskey\(\)/);
  assert.match(page, /auth\.passkey\.list\(\)/);
  assert.match(page, /auth\.passkey\.update\(/);
  assert.match(page, /auth\.passkey\.delete\(/);
  assert.match(page, /syncMemberProfile\(\)\.catch/);
  assert.doesNotMatch(page, /split\("@"\)\[0\]/);
  assert.match(page, /both your current and new email addresses/);
  assert.match(appearance, /mode:\s*"system"/);
  assert.match(appearance, /return\s+"system"/);
});

test("client sign-in preserves password and adds feature-gated passkey sign-in", () => {
  const navbar = read("src/components/Navbar.tsx");
  const auth = read("src/context/AuthContext.tsx");
  const client = read("src/lib/supabaseClient.ts");
  assert.match(navbar, /Sign in with a passkey/);
  assert.match(auth, /signInWithPassword/);
  assert.match(auth, /signInWithPasskey/);
  assert.match(auth, /return \{ error: null, cancelled: true \}/);
  assert.match(navbar, /Passkey sign-in was cancelled\. You can try again or use your password\./);
  assert.match(client, /VITE_PASSKEYS_ENABLED/);
  assert.match(client, /experimental:\s*\{\s*passkey:\s*true\s*\}/);
});

test("passkey cancellation detection covers returned and thrown WebAuthn shapes without hiding real failures", () => {
  assert.equal(passkeyErrors.isPasskeyCancellation({ name: "NotAllowedError", message: "The operation was not allowed" }), true);
  assert.equal(passkeyErrors.isPasskeyCancellation({ code: "ERROR_CEREMONY_ABORTED", message: "Authentication ceremony was sent an abort signal" }), true);
  assert.equal(passkeyErrors.isPasskeyCancellation({
    name: "WebAuthnError",
    cause: { name: "AbortError", message: "The operation was aborted" },
  }), true);
  assert.equal(passkeyErrors.isPasskeyCancellation({ code: "bad_jwt", message: "Invalid authentication token" }), false);
  assert.equal(passkeyErrors.passkeyFailureMessage({ message: "Authenticator is unavailable" }, "Fallback"), "Authenticator is unavailable");
  assert.equal(passkeyErrors.passkeyFailureMessage(null, "Fallback"), "Fallback");
});
