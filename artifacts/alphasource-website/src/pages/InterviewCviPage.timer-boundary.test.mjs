import assert from "node:assert/strict";
import { after, beforeEach, test } from "node:test";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const testDirectory = dirname(fileURLToPath(import.meta.url));
const websiteRoot = join(testDirectory, "..", "..");
const sourcePath = join(testDirectory, "InterviewCviPage.tsx");

process.env.PORT ||= "4176";
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
const timer = await server.ssrLoadModule("/src/pages/InterviewCviPage.tsx");
after(async () => server.close());

const {
  advanceInterviewClosingPhase,
  closingProviderEndAllowed,
  createInterviewTimeBoundaryState,
  evaluateInterviewTimeBoundary,
  initializeInterviewTimerRuntime,
  markClosingEchoCompleted,
  markClosingEchoDispatched,
  markClosingEchoFallback,
  markClosingComplete,
  markProviderEndRequested,
  markProviderEndConfirmed,
  preserveInterviewTimerRuntime,
  remainingSecondsAtDeadline,
  resetInterviewTimerRuntimeForTests,
  timerToneForRemaining,
} = timer;

beforeEach(() => resetInterviewTimerRuntimeForTests());

test("countdown warning colors remain visual-only at two and one minutes", () => {
  assert.equal(timerToneForRemaining(121), "normal");
  assert.equal(timerToneForRemaining(120), "warning");
  assert.equal(timerToneForRemaining(61), "warning");
  assert.equal(timerToneForRemaining(60), "urgent");
  assert.equal(timerToneForRemaining(1), "urgent");
});

test("no application closing action occurs above the exact zero deadline", () => {
  for (const remainingSeconds of [180, 120, 60, 45, 30, 20, 1, 0.001]) {
    for (const [candidateSpeaking, replicaSpeaking] of [[false, false], [true, false], [false, true], [true, true]]) {
      const result = evaluateInterviewTimeBoundary({
        state: createInterviewTimeBoundaryState(),
        remainingSeconds,
        candidateSpeaking,
        replicaSpeaking,
      });
      assert.equal(result.state.phase, "INTERVIEWING");
      assert.deepEqual(result.actions, []);
    }
  }
});

test("zero reserves avatar closing without ending or local playback regardless of speaker state", () => {
  for (const [candidateSpeaking, replicaSpeaking] of [[false, false], [true, false], [false, true], [true, true]]) {
    const result = evaluateInterviewTimeBoundary({
      state: createInterviewTimeBoundaryState(),
      remainingSeconds: 0,
      candidateSpeaking,
      replicaSpeaking,
    });
    assert.equal(result.state.phase, "AVATAR_CLOSING");
    assert.equal(result.state.closingReserved, true);
    assert.equal(result.state.candidateAudioUnpublishRequested, true);
    assert.equal(result.state.replicaInterruptRequested, true);
    assert.equal(result.state.closingEchoPhase, "RESERVED");
    assert.equal(result.state.providerEndRequested, false);
    assert.deepEqual(result.actions, [
      "reserve_avatar_closing",
      "request_candidate_audio_unpublish",
      "interrupt_replica",
      "send_closing_echo",
    ]);
  }
});

test("terminal evaluation and completion cannot replay or regress", () => {
  const first = evaluateInterviewTimeBoundary({
    state: createInterviewTimeBoundaryState(),
    remainingSeconds: 0,
  });
  assert.deepEqual(evaluateInterviewTimeBoundary({
    state: first.state,
    remainingSeconds: 0,
  }).actions, []);
  const complete = markClosingComplete(first.state);
  assert.equal(complete.phase, "COMPLETE");
  assert.equal(complete.navigationRequested, true);
  assert.strictEqual(markClosingComplete(complete), complete);
  assert.strictEqual(advanceInterviewClosingPhase(complete, "INTERVIEWING"), complete);
});

test("provider end is forbidden at zero until avatar completion or bounded fallback", () => {
  const initial = createInterviewTimeBoundaryState();
  assert.strictEqual(markProviderEndConfirmed(initial), initial);
  const closing = evaluateInterviewTimeBoundary({ state: initial, remainingSeconds: 0 }).state;
  assert.equal(closingProviderEndAllowed(closing), false);
  const dispatched = markClosingEchoDispatched(closing);
  assert.equal(closingProviderEndAllowed(dispatched), false);
  const completed = markClosingEchoCompleted(dispatched);
  assert.equal(closingProviderEndAllowed(completed), true);
  const requested = markProviderEndRequested(completed);
  assert.equal(requested.requested, true);
  assert.equal(closingProviderEndAllowed(requested.state), false);
  const confirmed = markProviderEndConfirmed(requested.state);
  assert.equal(confirmed.providerEndConfirmed, true);
  assert.strictEqual(markProviderEndConfirmed(confirmed), confirmed);

  const fallback = markClosingEchoFallback(dispatched, "completion_timeout");
  assert.equal(closingProviderEndAllowed(fallback), true);
});

test("same-conversation remount preserves the absolute clock and terminal state", () => {
  const initial = initializeInterviewTimerRuntime(null, "conversation-a:3", 1_000, 180_000);
  const closing = evaluateInterviewTimeBoundary({
    state: initial.boundaryState,
    remainingSeconds: 0,
  }).state;
  const preserved = { ...initial, boundaryState: closing };
  preserveInterviewTimerRuntime(preserved);
  assert.strictEqual(
    initializeInterviewTimerRuntime(preserved, "conversation-a:3", 50_000, 180_000),
    preserved,
  );
  assert.strictEqual(
    initializeInterviewTimerRuntime(null, "conversation-a:3", 60_000, 180_000),
    preserved,
  );
  const next = initializeInterviewTimerRuntime(null, "conversation-b:3", 70_000, 180_000);
  assert.equal(next.boundaryState.phase, "INTERVIEWING");
});

test("the monotonic deadline reaches zero exactly and never becomes negative", () => {
  const deadline = 100_000;
  assert.equal(remainingSecondsAtDeadline(deadline, 99_000), 1);
  assert.equal(remainingSecondsAtDeadline(deadline, 100_000), 0);
  assert.equal(remainingSecondsAtDeadline(deadline, 101_000), 0);
});

test("source has one zero-deadline avatar path and no local closing media or splash", async () => {
  const source = await readFile(sourcePath, "utf8");
  assert.match(source, /processTimeBoundary\(0\)/);
  assert.match(source, /buildFinalClosingAnnouncementMessage/);
  assert.match(source, /buildReplicaInterruptMessage/);
  assert.match(source, /closing_farewell_started/);
  assert.doesNotMatch(source, /playLocalClosingAudioOnce/);
  assert.doesNotMatch(source, /localClosingVisible/);
  assert.doesNotMatch(source, /INTERVIEW_LOCAL_CLOSING_TEXT/);
  assert.doesNotMatch(source, /FINAL_CLOSING_THRESHOLD_SECONDS/);
});
