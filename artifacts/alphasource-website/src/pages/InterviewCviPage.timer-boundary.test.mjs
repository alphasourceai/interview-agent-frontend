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
  buildFinalClosingAnnouncementMessage,
  buildReplicaInterruptMessage,
  createInterviewTimeBoundaryState,
  evaluateInterviewTimeBoundary,
  initializeInterviewTimerRuntime,
  markProviderEndConfirmed,
  markProviderEndRequested,
  preserveInterviewTimerRuntime,
  resetInterviewTimerRuntimeForTests,
  timerToneForRemaining,
} = timer;

beforeEach(() => resetInterviewTimerRuntimeForTests());

function evaluate(state, remainingSeconds, candidateSpeaking = false, replicaSpeaking = false) {
  return evaluateInterviewTimeBoundary({
    state,
    remainingSeconds,
    candidateSpeaking,
    replicaSpeaking,
  });
}

test("countdown warning colors remain visual-only at two and one minutes", () => {
  assert.equal(timerToneForRemaining(121), "normal");
  assert.equal(timerToneForRemaining(120), "warning");
  assert.equal(timerToneForRemaining(61), "warning");
  assert.equal(timerToneForRemaining(60), "urgent");
  assert.equal(timerToneForRemaining(1), "urgent");
});

test("ordinary rubric flow is unchanged through 20.001 seconds", () => {
  for (const remaining of [180, 120, 60, 45, 30, 21, 20.001]) {
    const result = evaluate(createInterviewTimeBoundaryState(), remaining, true, true);
    assert.equal(result.state.phase, "INTERVIEWING");
    assert.deepEqual(result.actions, []);
  }
});

test("the only transition is the exact 20-second final closing", () => {
  const initial = createInterviewTimeBoundaryState();
  const closing = evaluate(initial, 20, true, true);
  assert.equal(closing.state.phase, "FINAL_FAREWELL_ELIGIBLE");
  assert.deepEqual(closing.actions, [
    "interrupt_replica",
    "record_closing_farewell_reserved",
    "send_closing_farewell",
  ]);
});

test("closing phases cannot regress", () => {
  const ended = advanceInterviewClosingPhase(
    advanceInterviewClosingPhase(createInterviewTimeBoundaryState(), "ENDED"),
    "INTERVIEWING",
  );
  assert.equal(ended.phase, "ENDED");
  assert.strictEqual(advanceInterviewClosingPhase(ended, "FINAL_FAREWELL_ELIGIBLE"), ended);
});

test("provider end request and confirmation remain idempotent", () => {
  const closing = evaluate(createInterviewTimeBoundaryState(), 20).state;
  const first = markProviderEndRequested(closing);
  const duplicate = markProviderEndRequested(first.state);
  const confirmed = markProviderEndConfirmed(first.state);
  const confirmedAgain = markProviderEndConfirmed(confirmed);
  assert.equal(first.requested, true);
  assert.equal(duplicate.requested, false);
  assert.equal(confirmed.providerEndConfirmed, true);
  assert.strictEqual(confirmedAgain, confirmed);
});

test("interrupt message follows the bounded Tavus interaction contract", () => {
  assert.deepEqual(buildReplicaInterruptMessage("synthetic-conversation"), {
    message_type: "conversation",
    event_type: "conversation.interrupt",
    conversation_id: "synthetic-conversation",
  });
});

test("the one closing Echo contains no timer implementation language", () => {
  const message = buildFinalClosingAnnouncementMessage("synthetic-conversation");
  assert.equal(message.event_type, "conversation.echo");
  assert.equal(message.properties.done, true);
  assert.equal(
    message.properties.text,
    "Time is winding down. Thank you for your time. I am ending the session now.",
  );
  assert.doesNotMatch(message.properties.text, /\b(?:seconds?|minutes?|timer|instruction|system)\b/i);
});

test("same-conversation rerender and remount preserve the clock and one closing state", () => {
  const initial = initializeInterviewTimerRuntime(null, "synthetic-conversation:3", 1_000, 180_000);
  const closing = evaluate(initial.boundaryState, 20);
  const preserved = { ...initial, boundaryState: closing.state };
  preserveInterviewTimerRuntime(preserved);
  const rerender = initializeInterviewTimerRuntime(preserved, "synthetic-conversation:3", 99_000, 180_000);
  const remount = initializeInterviewTimerRuntime(null, "synthetic-conversation:3", 100_000, 180_000);
  assert.strictEqual(rerender, preserved);
  assert.strictEqual(remount, preserved);
  assert.equal(remount.startedAt, 1_000);
  assert.equal(remount.boundaryState.phase, "FINAL_FAREWELL_ELIGIBLE");
});

test("a genuinely new conversation receives a fresh interviewing state", () => {
  const first = initializeInterviewTimerRuntime(null, "conversation-a:3", 1_000, 180_000);
  const closing = evaluate(first.boundaryState, 20);
  preserveInterviewTimerRuntime({ ...first, boundaryState: closing.state });
  const reconnect = initializeInterviewTimerRuntime(null, "conversation-a:3", 2_000, 180_000);
  const next = initializeInterviewTimerRuntime(null, "conversation-b:3", 3_000, 180_000);
  assert.equal(reconnect.boundaryState.phase, "FINAL_FAREWELL_ELIGIBLE");
  assert.equal(next.boundaryState.phase, "INTERVIEWING");
});

test("source statically proves one 20-second controller with no staged closing controls", async () => {
  const source = await readFile(sourcePath, "utf8");
  assert.match(source, /FINAL_CLOSING_THRESHOLD_SECONDS = 20/);
  assert.match(source, /conversation\.interrupt/);
  assert.match(source, /markProviderEndRequested/);
  assert.match(source, /closingRuntimeBySession/);
  assert.doesNotMatch(source, /QUESTION_LOCK_THRESHOLD_SECONDS/);
  assert.doesNotMatch(source, /WIND_DOWN_THRESHOLD_SECONDS/);
  assert.doesNotMatch(source, /FINAL_FAREWELL_THRESHOLD_SECONDS/);
  assert.doesNotMatch(source, /send_candidate_question_invitation/);
  assert.doesNotMatch(source, /conversation\.append_llm_context/);
  assert.doesNotMatch(source, /conversation\.respond/);
  assert.doesNotMatch(source, /TIME_WARNING_(?:NOTICE|TEXT)/);
  assert.doesNotMatch(source, /GRACEFUL_WRAP_(?:NOTICE|TEXT)/);
  assert.doesNotMatch(source, /setTimeNotice/);
  assert.equal(source.match(/event_type: "conversation\.echo"/g)?.length || 0, 2);
  assert.match(source, /CANDIDATE_INACTIVITY_NUDGE_TEXT/);
});
