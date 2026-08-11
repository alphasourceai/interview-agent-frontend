import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => fs.readFileSync(path.join(ROOT, relativePath), "utf8");

test("dashboard offers the approved Talk with Support browser voice control", () => {
  const dashboard = read("src/components/DashboardLayout.tsx");
  const voice = read("src/components/SupportVoicePopover.tsx");
  assert.match(dashboard, /<SupportVoicePopover \/>/);
  assert.match(voice, />Talk with Support</);
  assert.doesNotMatch(dashboard, /AI_SUPPORT_PHONE_URI|AI_SUPPORT_PHONE_DISPLAY/);
});

test("dashboard browser voice implementation requests microphone only from an explicit support action", () => {
  const voice = read("src/components/SupportVoicePopover.tsx");
  assert.match(voice, /getUserMedia/);
  assert.match(voice, /microphone/i);
  assert.match(voice, /View Help Center/);
  assert.match(voice, /PRODUCTION_API_ORIGIN = "https:\/\/api\.alphasourceai\.com"/);
  assert.doesNotMatch(voice, /ia-backend-qa\.onrender\.com/);
});

test("dashboard FAQ exposes deterministic support knowledge metadata", () => {
  const faq = read("src/pages/dashboard/FaqPage.tsx");
  assert.match(faq, /DASHBOARD_SUPPORT_KNOWLEDGE_VERSION/);
  assert.match(faq, /dashboardSupportContent/);
});
