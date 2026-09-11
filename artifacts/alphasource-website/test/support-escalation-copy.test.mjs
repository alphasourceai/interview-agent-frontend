import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { build } from "esbuild";

const root = new URL("../", import.meta.url);
const read = (file) => fs.readFileSync(new URL(file, root), "utf8");

test("generated support knowledge preserves the Help Center's approved escalation guidance", async () => {
  const compiled = await build({
    entryPoints: [new URL("src/content/dashboardSupportContent.ts", root).pathname],
    bundle: true, write: false, platform: "node", format: "esm",
  });
  const content = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString("base64")}`);
  const knowledge = JSON.parse(read("src/content/support-voice-knowledge.json"));
  const question = "What happens after I leave a support message?";
  const answerFor = (sections) => sections.flatMap((section) => section.items).find((item) => item.question === question)?.answer;
  const answer = answerFor(content.faqSections);
  assert.equal(typeof answer, "string");
  assert.equal(answerFor(knowledge.dashboard.faq_sections), answer);
  assert.equal(knowledge.knowledge_version, content.DASHBOARD_SUPPORT_KNOWLEDGE_VERSION);
  assert.match(answer, /confirmed name, reply email, and summary after you approve/);
  assert.match(answer, /If you decline, nothing is sent/);
  assert.match(answer, /unavailable or unconfirmed, email support@alphasourceai\.com/);
  assert.match(answer, /does not create a ticket, guarantee delivery, or promise a callback or response time/);
  assert.doesNotMatch(JSON.stringify(knowledge), /does not create a ticket, send a team message/);
  assert.match(JSON.stringify(knowledge.public.support_questions), /after you explicitly approve sending/);
  assert.match(read("src/components/SupportVoicePopover.tsx"), /confirm your name, reply email, and a brief issue summary/);
});
