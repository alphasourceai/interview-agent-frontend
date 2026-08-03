import assert from "node:assert/strict";
import { after, beforeEach, test } from "node:test";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const testDirectory = dirname(fileURLToPath(import.meta.url));
const websiteRoot = join(testDirectory, "..", "..");
const sourcePath = join(testDirectory, "InterviewCviPage.tsx");

process.env.PORT ||= "4183";
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
const closing = await server.ssrLoadModule("/src/pages/InterviewCviPage.tsx");
after(async () => server.close());

const {
  buildFinalClosingAnnouncementMessage,
  closingProviderEndAllowed,
  createInterviewTimeBoundaryState,
  evaluateInterviewTimeBoundary,
  initializeInterviewTimerRuntime,
  markClosingFarewellDispatched,
  markProviderEndRequested,
  normalizePalSpeakingEvent,
  preserveInterviewTimerRuntime,
  recordClosingFarewellSpeechEvent,
  remainingSecondsAtDeadline,
  reserveClosingFarewell,
  resetInterviewTimerRuntimeForTests,
} = closing;

beforeEach(() => resetInterviewTimerRuntimeForTests());

function farewellEvent(state, kind, overrides = {}) {
  return {
    kind,
    conversationId: "active-conversation",
    turnKey: "opaque-turn",
    providerSequence: 1,
    interrupted: false,
    applicationControl: true,
    inferenceId: state.farewellInferenceId,
    ...overrides,
  };
}

test("no closing behavior runs above the single 20-second boundary", () => {
  for (const remainingSeconds of [180, 46, 45, 30, 21, 20.001]) {
    const result = evaluateInterviewTimeBoundary({
      state: createInterviewTimeBoundaryState(),
      remainingSeconds,
      candidateSpeaking: true,
      replicaSpeaking: true,
    });
    assert.equal(result.state.phase, "INTERVIEWING");
    assert.deepEqual(result.actions, []);
  }
});

test("the exact 20-second boundary interrupts once and dispatches one closing utterance", () => {
  const result = evaluateInterviewTimeBoundary({
    state: createInterviewTimeBoundaryState(),
    remainingSeconds: 20,
    candidateSpeaking: true,
    replicaSpeaking: true,
  });
  assert.equal(result.state.phase, "FINAL_FAREWELL_ELIGIBLE");
  assert.equal(result.state.closingFarewellPhase, "RESERVED");
  assert.deepEqual(result.actions, [
    "interrupt_replica",
    "record_closing_farewell_reserved",
    "send_closing_farewell",
  ]);
});

test("the single boundary does not depend on who is speaking", () => {
  for (const [candidateSpeaking, replicaSpeaking] of [
    [false, false],
    [true, false],
    [false, true],
    [true, true],
  ]) {
    const result = evaluateInterviewTimeBoundary({
      state: createInterviewTimeBoundaryState(),
      remainingSeconds: 20,
      candidateSpeaking,
      replicaSpeaking,
    });
    assert.equal(result.actions.filter((action) => action === "interrupt_replica").length, 1);
    assert.equal(result.actions.filter((action) => action === "send_closing_farewell").length, 1);
  }
});

test("repeated evaluations below 20 seconds cannot replay interruption or speech", () => {
  const first = evaluateInterviewTimeBoundary({
    state: createInterviewTimeBoundaryState(),
    remainingSeconds: 20,
    candidateSpeaking: false,
    replicaSpeaking: false,
  });
  const second = evaluateInterviewTimeBoundary({
    state: markClosingFarewellDispatched(first.state),
    remainingSeconds: 19,
    candidateSpeaking: true,
    replicaSpeaking: true,
  });
  const third = evaluateInterviewTimeBoundary({
    state: second.state,
    remainingSeconds: 15,
    candidateSpeaking: false,
    replicaSpeaking: false,
  });
  assert.deepEqual(second.actions, []);
  assert.deepEqual(third.actions, []);
});

test("the only spoken closing text contains the complete operator-approved ending", () => {
  const message = buildFinalClosingAnnouncementMessage(
    "synthetic-conversation",
    "alphascreen-closing-farewell-stable",
  );
  assert.equal(message.event_type, "conversation.echo");
  assert.equal(message.properties.inference_id, "alphascreen-closing-farewell-stable");
  assert.equal(
    message.properties.text,
    "Time is winding down. Thank you for your time. I am ending the session now.",
  );
});

test("matching closing speech completion permits immediate provider end", () => {
  const reserved = reserveClosingFarewell(createInterviewTimeBoundaryState()).state;
  const dispatched = markClosingFarewellDispatched(reserved);
  const speaking = recordClosingFarewellSpeechEvent(
    dispatched,
    farewellEvent(dispatched, "started"),
    "active-conversation",
  ).state;
  assert.equal(closingProviderEndAllowed(speaking, 12), false);
  const completed = recordClosingFarewellSpeechEvent(
    speaking,
    farewellEvent(speaking, "stopped"),
    "active-conversation",
  ).state;
  assert.equal(closingProviderEndAllowed(completed, 11), true);
});

test("unrelated and duplicate speech events cannot complete or replay the closing", () => {
  const dispatched = markClosingFarewellDispatched(
    reserveClosingFarewell(createInterviewTimeBoundaryState()).state,
  );
  const wrong = recordClosingFarewellSpeechEvent(
    dispatched,
    farewellEvent(dispatched, "started", { inferenceId: "wrong" }),
    "active-conversation",
  );
  const started = recordClosingFarewellSpeechEvent(
    dispatched,
    farewellEvent(dispatched, "started"),
    "active-conversation",
  );
  const completed = recordClosingFarewellSpeechEvent(
    started.state,
    farewellEvent(started.state, "stopped"),
    "active-conversation",
  );
  const duplicate = recordClosingFarewellSpeechEvent(
    completed.state,
    farewellEvent(completed.state, "stopped"),
    "active-conversation",
  );
  assert.equal(wrong.matched, false);
  assert.equal(started.transition, "speaking");
  assert.equal(completed.transition, "completed");
  assert.equal(duplicate.transition, "none");
});

test("a missing speech-stop remains single-flight and uses only the hard deadline fallback", () => {
  const initial = evaluateInterviewTimeBoundary({
    state: createInterviewTimeBoundaryState(),
    remainingSeconds: 20,
    candidateSpeaking: false,
    replicaSpeaking: false,
  });
  const dispatched = markClosingFarewellDispatched(initial.state);
  const repeated = evaluateInterviewTimeBoundary({
    state: dispatched,
    remainingSeconds: 5,
    candidateSpeaking: false,
    replicaSpeaking: false,
  });
  assert.deepEqual(repeated.actions, []);
  assert.equal(reserveClosingFarewell(repeated.state).reserved, false);
  assert.equal(closingProviderEndAllowed(repeated.state, 5), false);
  assert.equal(closingProviderEndAllowed(repeated.state, 0, { hardDeadline: true }), true);
});

test("provider-end requests remain exactly once under completion/deadline races", () => {
  const completed = {
    ...createInterviewTimeBoundaryState(),
    closingFarewellSent: true,
    closingFarewellPhase: "COMPLETED",
  };
  const first = markProviderEndRequested(completed);
  const duplicate = markProviderEndRequested(first.state);
  assert.equal(first.requested, true);
  assert.equal(duplicate.requested, false);
  assert.equal(closingProviderEndAllowed(first.state, 0, { hardDeadline: true }), false);
});

test("provider speaking aliases correlate to the one application closing turn", () => {
  const dispatched = markClosingFarewellDispatched(
    reserveClosingFarewell(createInterviewTimeBoundaryState()).state,
  );
  const start = normalizePalSpeakingEvent({
    event_type: "conversation.replica.started_speaking",
    properties: { role: "replica", conversation_id: "active-conversation", sequence: 71 },
  }, "active-conversation");
  const stop = normalizePalSpeakingEvent({
    event_type: "conversation.replica.stopped_speaking",
    properties: { role: "replica", conversation_id: "active-conversation", sequence: 71 },
  }, "active-conversation");
  assert.ok(start);
  assert.ok(stop);
  const speaking = recordClosingFarewellSpeechEvent(
    dispatched,
    start,
    "active-conversation",
    dispatched.farewellInferenceId,
  );
  const completed = recordClosingFarewellSpeechEvent(
    speaking.state,
    stop,
    "active-conversation",
    speaking.state.farewellInferenceId,
  );
  assert.equal(speaking.transition, "speaking");
  assert.equal(completed.transition, "completed");
});

test("reconnect, rerender, and remount preserve the single reservation and absolute clock", () => {
  const runtime = initializeInterviewTimerRuntime(null, "active-conversation:single", 1_000, 180_000);
  const evaluated = evaluateInterviewTimeBoundary({
    state: runtime.boundaryState,
    remainingSeconds: 20,
    candidateSpeaking: false,
    replicaSpeaking: false,
  });
  const preserved = { ...runtime, boundaryState: evaluated.state };
  preserveInterviewTimerRuntime(preserved);
  const reconnect = initializeInterviewTimerRuntime(preserved, "active-conversation:single", 12_000, 180_000);
  const remount = initializeInterviewTimerRuntime(null, "active-conversation:single", 22_000, 180_000);
  assert.strictEqual(reconnect, preserved);
  assert.strictEqual(remount, preserved);
  assert.equal(remount.deadlineAt, 181_000);
  assert.equal(reserveClosingFarewell(remount.boundaryState).reserved, false);
});

test("the absolute clock is deterministic at the only closing boundary and deadline", () => {
  const deadline = 100_000;
  assert.equal(remainingSecondsAtDeadline(deadline, 79_999), 21);
  assert.equal(remainingSecondsAtDeadline(deadline, 80_000), 20);
  assert.equal(remainingSecondsAtDeadline(deadline, 100_000), 0);
});

test("source contains no staged question lock, wind-down invitation, or 15-second farewell flow", async () => {
  const source = await readFile(sourcePath, "utf8");
  assert.doesNotMatch(source, /QUESTION_LOCK_THRESHOLD_SECONDS/);
  assert.doesNotMatch(source, /WIND_DOWN_THRESHOLD_SECONDS/);
  assert.doesNotMatch(source, /FINAL_FAREWELL_THRESHOLD_SECONDS/);
  assert.doesNotMatch(source, /CANDIDATE_QUESTION_INVITATION/);
  assert.doesNotMatch(source, /send_candidate_question_invitation/);
  assert.doesNotMatch(source, /candidate_question_invitation_sent/);
});

test("source retains no fixed post-closing shutdown delay", async () => {
  const source = await readFile(sourcePath, "utf8");
  assert.doesNotMatch(source, /CLOSING_UTTERANCE_END_DELAY_MS/);
  assert.doesNotMatch(source, /FAREWELL_COMPLETION_TIMEOUT_MS/);
  assert.doesNotMatch(
    source,
    /closing_farewell_started[\s\S]{0,1800}setTimeout[\s\S]{0,800}requestClosingProviderEnd/,
  );
});
