import assert from "node:assert/strict";
import { after, test } from "node:test";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const testDirectory = dirname(fileURLToPath(import.meta.url));
const websiteRoot = join(testDirectory, "..", "..");
const sourcePath = join(testDirectory, "InterviewCviPage.tsx");

process.env.PORT ||= "4194";
process.env.BASE_PATH ||= "/";
process.env.NODE_ENV = "test";

const server = await createServer({
  appType: "custom",
  configFile: join(websiteRoot, "vite.config.ts"),
  logLevel: "silent",
  optimizeDeps: { include: [], noDiscovery: true },
  root: websiteRoot,
  server: { hmr: false, middlewareMode: true },
});
const interview = await server.ssrLoadModule("/src/pages/InterviewCviPage.tsx");
after(async () => server.close());

function farewell(overrides = {}) {
  return {
    eventType: "conversation.utterance",
    role: "replica",
    speech: interview.NORMAL_COMPLETION_FAREWELL_TEXT,
    phase: "INTERVIEWING",
    avatarClosingActive: false,
    ...overrides,
  };
}

test("normal completion restores the proven exact farewell delay", () => {
  assert.equal(
    interview.NORMAL_COMPLETION_FAREWELL_TEXT,
    "Thank you for your time. I am ending the session now.",
  );
  assert.equal(interview.NORMAL_COMPLETION_END_DELAY_MS, 5500);
  assert.equal(interview.isNormalCompletionFarewell(farewell()), true);
  assert.equal(interview.isNormalCompletionFarewell(farewell({
    role: " ASSISTANT ",
    speech: "  THANK YOU FOR YOUR TIME.\nI AM ENDING THE SESSION NOW.  ",
  })), true);
});

test("extra or paraphrased closing language cannot arm normal completion", () => {
  assert.equal(interview.isNormalCompletionFarewell(farewell({
    speech: "Thank you for your time. I am ending the session now. Goodbye.",
  })), false);
  assert.equal(interview.isNormalCompletionFarewell(farewell({
    speech: "I’m concluding the interview now.",
  })), false);
  assert.equal(interview.isNormalCompletionFarewell(farewell({
    speech: "We will be in touch soon.",
  })), false);
});

test("only an explicit replica utterance in INTERVIEWING is eligible", () => {
  for (const role of ["candidate", "user", "participant", "pal", ""]) {
    assert.equal(interview.isNormalCompletionFarewell(farewell({ role })), false);
  }
  for (const eventType of [
    "conversation.started_speaking",
    "conversation.stopped_speaking",
    "conversation.tool_call",
    "",
  ]) {
    assert.equal(interview.isNormalCompletionFarewell(farewell({ eventType })), false);
  }
  for (const phase of ["AVATAR_CLOSING", "COMPLETE", null, undefined]) {
    assert.equal(interview.isNormalCompletionFarewell(farewell({ phase })), false);
  }
  assert.equal(interview.isNormalCompletionFarewell(farewell({
    avatarClosingActive: true,
  })), false);
});

test("the distinct 0:00 announcement is never a normal-completion match", () => {
  assert.notEqual(
    interview.FINAL_CLOSING_ANNOUNCEMENT_TEXT,
    interview.NORMAL_COMPLETION_FAREWELL_TEXT,
  );
  assert.equal(interview.isNormalCompletionFarewell(farewell({
    speech: interview.FINAL_CLOSING_ANNOUNCEMENT_TEXT,
  })), false);
  assert.equal(interview.isNormalCompletionFarewell(farewell({
    speech: interview.NORMAL_COMPLETION_FAREWELL_TEXT,
    phase: "AVATAR_CLOSING",
    avatarClosingActive: true,
  })), false);
});

test("callback re-check fails closed when timer ownership or another end wins the race", () => {
  assert.equal(interview.normalCompletionEndAllowed({
    phase: "INTERVIEWING",
    avatarClosingActive: false,
    endTriggered: false,
  }), true);
  assert.equal(interview.normalCompletionEndAllowed({
    phase: "AVATAR_CLOSING",
    avatarClosingActive: true,
    endTriggered: false,
  }), false);
  assert.equal(interview.normalCompletionEndAllowed({
    phase: "INTERVIEWING",
    avatarClosingActive: false,
    endTriggered: true,
  }), false);
  assert.equal(interview.normalCompletionEndAllowed({
    phase: undefined,
    avatarClosingActive: false,
    endTriggered: false,
  }), false);
});

test("runtime wiring is normal-only, deduplicated, and single-flight", async () => {
  const source = await readFile(sourcePath, "utf8");
  assert.match(source, /if \(!normalCompletionEndTimerRef\.current\)/);
  assert.match(source, /normalCompletionEndAllowed\(\{[\s\S]{0,300}endTriggered: endTriggeredRef\.current/);
  assert.match(source, /endInterview\("completed_normally"\)/);
  assert.match(source, /const endTriggeredRef = useRef\(false\)/);
  assert.doesNotMatch(
    source,
    /FINAL_CLOSING_ANNOUNCEMENT_TEXT[\s\S]{0,150}NORMAL_COMPLETION_FAREWELL_TEXT/,
  );
});
