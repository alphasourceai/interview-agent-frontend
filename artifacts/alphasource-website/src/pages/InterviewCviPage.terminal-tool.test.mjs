import assert from "node:assert/strict";
import { after, test } from "node:test";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const testDirectory = dirname(fileURLToPath(import.meta.url));
const websiteRoot = join(testDirectory, "..", "..");
const sourcePath = join(testDirectory, "InterviewCviPage.tsx");

process.env.PORT ||= "4193";
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

test("current Tavus end_call and legacy end_interview both terminate the interview", () => {
  assert.equal(interview.isTerminalInterviewToolName("end_call"), true);
  assert.equal(interview.isTerminalInterviewToolName(" END_CALL "), true);
  assert.equal(interview.isTerminalInterviewToolName("end_interview"), true);
  assert.equal(interview.isTerminalInterviewToolName("unknown_tool"), false);
  assert.equal(interview.isTerminalInterviewToolName(null), false);
});

test("terminal tool wiring records a normal closing instead of candidate manual exit", async () => {
  const source = await readFile(sourcePath, "utf8");
  assert.match(source, /if \(isTerminalInterviewToolName\(toolName\)\)/);
  assert.match(source, /endInterview\("closing_utterance"\)/);
  assert.doesNotMatch(source, /toolName === "end_interview"/);
});

test("the separate zero-time farewell contract remains unchanged", () => {
  assert.equal(
    interview.FINAL_CLOSING_ANNOUNCEMENT_TEXT,
    "We are out of time. Thank you for your time. I am ending the session now.",
  );
});
