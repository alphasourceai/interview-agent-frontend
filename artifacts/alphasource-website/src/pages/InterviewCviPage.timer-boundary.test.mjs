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
  buildCandidateQuestionInvitationMessage,
  buildFinalClosingAnnouncementMessage,
  buildHiddenInterviewBoundaryMessage,
  buildReplicaInterruptMessage,
  classifyCandidateClosingTurn,
  createInterviewTimeBoundaryState,
  evaluateInterviewTimeBoundary,
  initializeInterviewTimerRuntime,
  markProviderEndConfirmed,
  markProviderEndRequested,
  preserveInterviewTimerRuntime,
  recordCandidateClosingTurn,
  recordCandidateQuestionResponseCompleted,
  recordCandidateQuestionResponseStarted,
  recordCandidateQuestionSilence,
  recordPostClosingInterruption,
  resetInterviewTimerRuntimeForTests,
  timerToneForRemaining,
} = timer;

beforeEach(() => resetInterviewTimerRuntimeForTests());

function evaluate(
  state,
  remainingSeconds,
  candidateSpeaking = false,
  replicaSpeaking = false,
  closingAnnouncementObserved = false,
  replicaSpeechIsApplicationControlled = false,
) {
  return evaluateInterviewTimeBoundary({
    state,
    remainingSeconds,
    candidateSpeaking,
    replicaSpeaking,
    closingAnnouncementObserved,
    replicaSpeechIsApplicationControlled,
  });
}

function questionLockedState() {
  return evaluate(createInterviewTimeBoundaryState(), 45).state;
}

function closingOnlyState() {
  return evaluate(questionLockedState(), 30, true).state;
}

test("countdown warning colors remain visual-only at two and one minutes", () => {
  assert.equal(timerToneForRemaining(121), "normal");
  assert.equal(timerToneForRemaining(120), "warning");
  assert.equal(timerToneForRemaining(61), "warning");
  assert.equal(timerToneForRemaining(60), "urgent");
  assert.equal(timerToneForRemaining(1), "urgent");
});

test("normal state progression is monotonic through ENDED", () => {
  const interviewing = createInterviewTimeBoundaryState();
  const locked = evaluate(interviewing, 45);
  const closing = evaluate(locked.state, 30, true);
  const terminating = evaluate(closing.state, 10);
  const ended = markProviderEndRequested(terminating.state);

  assert.equal(interviewing.phase, "INTERVIEWING");
  assert.equal(locked.state.phase, "QUESTION_LOCKED");
  assert.equal(closing.state.phase, "CLOSING_ONLY");
  assert.equal(terminating.state.phase, "TERMINATION_ONLY");
  assert.equal(ended.state.phase, "ENDED");
  assert.equal(ended.requested, true);
});

test("closing phases cannot regress", () => {
  const ended = advanceInterviewClosingPhase(
    advanceInterviewClosingPhase(createInterviewTimeBoundaryState(), "ENDED"),
    "INTERVIEWING",
  );
  assert.equal(ended.phase, "ENDED");
  assert.strictEqual(advanceInterviewClosingPhase(ended, "CLOSING_ONLY"), ended);
});

test("more than 45 seconds preserves ordinary rubric flow", () => {
  const result = evaluate(createInterviewTimeBoundaryState(), 46);
  assert.deepEqual(result.actions, []);
  assert.equal(result.state.phase, "INTERVIEWING");
});

test("45-second question lock supersedes coverage and fires once", () => {
  const first = evaluate(createInterviewTimeBoundaryState(), 45);
  const repeated = evaluate(first.state, 44);

  assert.deepEqual(first.actions, ["send_question_lock_control", "interrupt_replica"]);
  assert.deepEqual(repeated.actions, []);
  assert.equal(repeated.state.questionLockControlSent, true);

  const message = buildHiddenInterviewBoundaryMessage("synthetic-conversation", "QUESTION_LOCKED");
  const contract = JSON.parse(message.properties.context);
  assert.equal(contract.priority, "supersedes_rubric_coverage_followups_and_question_count");
  assert.equal(contract.new_rubric_questions, "blocked");
  assert.equal(contract.new_followup_questions, "blocked");
  assert.equal(contract.active_candidate_answer, "may_finish");
  assert.equal(contract.unfinished_coverage, "skip_for_bounded_duration");
});

test("active candidate answer may finish after question lock", () => {
  const locked = evaluate(createInterviewTimeBoundaryState(), 45, true);
  assert.deepEqual(locked.actions, ["send_question_lock_control", "interrupt_replica"]);
  assert.equal(locked.state.candidateQuestionInvitationSent, false);
});

test("closing-only begins once and waits for a natural candidate boundary", () => {
  const locked = questionLockedState();
  const active = evaluate(locked, 30, true, false);
  const natural = evaluate(active.state, 29, false, false);
  const duplicate = evaluate(natural.state, 28, false, false);

  assert.deepEqual(active.actions, ["send_closing_control"]);
  assert.equal(active.state.phase, "CLOSING_ONLY");
  assert.deepEqual(natural.actions, [
    "send_candidate_question_invitation",
    "start_candidate_question_silence_timer",
  ]);
  assert.deepEqual(duplicate.actions, []);
});

test("replica speech also defers the deterministic closing invitation", () => {
  const active = evaluate(questionLockedState(), 30, false, true);
  assert.deepEqual(active.actions, ["send_closing_control"]);
  assert.equal(active.state.candidateQuestionInvitationSent, false);
});

test("candidate-question invitation is deterministic, spoken once, and contains no timer language", () => {
  const message = buildCandidateQuestionInvitationMessage("synthetic-conversation");
  assert.equal(message.event_type, "conversation.echo");
  assert.equal(message.properties.done, true);
  assert.equal(message.properties.text, "Before we finish, do you have one question for me?");
  assert.doesNotMatch(message.properties.text, /\b(?:seconds?|minutes?|timer|remaining)\b/i);
});

test("insufficient invitation time goes directly to farewell and end", () => {
  const closing = closingOnlyState();
  const result = evaluate(closing, 17);
  assert.deepEqual(result.actions, ["send_closing_farewell", "ensure_provider_shutdown"]);
  assert.equal(result.state.candidateQuestionInvitationSent, false);
});

test("candidate decline or non-question answer triggers farewell and provider end", () => {
  const invited = evaluate(closingOnlyState(), 29).state;
  const result = recordCandidateClosingTurn(invited, "decline");
  assert.deepEqual(result.actions, ["send_closing_farewell", "ensure_provider_shutdown"]);
  assert.equal(result.state.candidateQuestionDeclined, true);
  assert.equal(result.state.closingFarewellSent, true);
});

test("candidate silence triggers farewell and provider end without restarting", () => {
  const invited = evaluate(closingOnlyState(), 29).state;
  const result = recordCandidateQuestionSilence(invited);
  const duplicate = recordCandidateQuestionSilence(result.state);
  assert.deepEqual(result.actions, ["send_closing_farewell", "ensure_provider_shutdown"]);
  assert.deepEqual(duplicate.actions, []);
});

test("one candidate question permits one response, then farewell and end", () => {
  const invited = evaluate(closingOnlyState(), 29).state;
  const question = recordCandidateClosingTurn(invited, "question");
  const started = recordCandidateQuestionResponseStarted(question.state);
  const completed = recordCandidateQuestionResponseCompleted(started);
  const duplicate = recordCandidateQuestionResponseCompleted(completed.state);

  assert.equal(question.state.candidateQuestionReceived, true);
  assert.equal(started.candidateQuestionResponseStarted, true);
  assert.deepEqual(completed.actions, ["send_closing_farewell", "ensure_provider_shutdown"]);
  assert.equal(completed.state.candidateQuestionResponseCompleted, true);
  assert.deepEqual(duplicate.actions, []);
});

test("candidate acknowledgment after farewell cannot restart interviewing", () => {
  const invited = evaluate(closingOnlyState(), 29).state;
  const declined = recordCandidateClosingTurn(invited, "decline");
  const acknowledgment = recordCandidateClosingTurn(declined.state, "question");
  assert.strictEqual(acknowledgment.state, declined.state);
  assert.deepEqual(acknowledgment.actions, []);
});

test("bounded local closing-turn classifier distinguishes direct questions from declines", () => {
  assert.equal(classifyCandidateClosingTurn("What happens next?"), "question");
  assert.equal(classifyCandidateClosingTurn("Can you explain the next step"), "question");
  assert.equal(classifyCandidateClosingTurn("No, thank you."), "decline");
});

test("10-second termination is absolute and application-controlled farewell is not interrupted", () => {
  const closing = closingOnlyState();
  const normal = evaluate(closing, 10, false, true, false, false);
  const echo = evaluate(closing, 10, false, true, false, true);

  assert.equal(normal.state.phase, "TERMINATION_ONLY");
  assert.deepEqual(normal.actions, [
    "send_termination_control",
    "interrupt_replica",
    "send_closing_farewell",
    "ensure_provider_shutdown",
  ]);
  assert.deepEqual(echo.actions, [
    "send_termination_control",
    "send_closing_farewell",
    "ensure_provider_shutdown",
  ]);
});

test("provider end request and confirmation are idempotent", () => {
  const terminating = evaluate(closingOnlyState(), 10).state;
  const first = markProviderEndRequested(terminating);
  const duplicate = markProviderEndRequested(first.state);
  const confirmed = markProviderEndConfirmed(first.state);
  const confirmedAgain = markProviderEndConfirmed(confirmed);

  assert.equal(first.requested, true);
  assert.equal(duplicate.requested, false);
  assert.equal(confirmed.providerEndConfirmed, true);
  assert.strictEqual(confirmedAgain, confirmed);
});

test("post-closing replica violation interrupts once per inference", () => {
  const state = closingOnlyState();
  const first = recordPostClosingInterruption(state, "synthetic-inference");
  const duplicate = recordPostClosingInterruption(first.state, "synthetic-inference");
  const second = recordPostClosingInterruption(first.state, "synthetic-inference-two");

  assert.equal(first.shouldInterrupt, true);
  assert.equal(duplicate.shouldInterrupt, false);
  assert.equal(second.shouldInterrupt, true);
});

test("question-locked replica generation is interruptible without entering closing early", () => {
  const locked = questionLockedState();
  const violation = recordPostClosingInterruption(locked, "synthetic-inference");
  assert.equal(violation.shouldInterrupt, true);
  assert.equal(violation.state.phase, "QUESTION_LOCKED");
});

test("interrupt message follows the bounded Tavus interaction contract", () => {
  assert.deepEqual(buildReplicaInterruptMessage("synthetic-conversation"), {
    message_type: "conversation",
    event_type: "conversation.interrupt",
    conversation_id: "synthetic-conversation",
  });
});

test("same-conversation rerender and temporary remount preserve clock and state", () => {
  const initial = initializeInterviewTimerRuntime(null, "synthetic-conversation:3", 1_000);
  const locked = evaluate(initial.boundaryState, 45);
  const preserved = { ...initial, boundaryState: locked.state };
  preserveInterviewTimerRuntime(preserved);

  const rerender = initializeInterviewTimerRuntime(preserved, "synthetic-conversation:3", 99_000);
  const remount = initializeInterviewTimerRuntime(null, "synthetic-conversation:3", 100_000);
  assert.strictEqual(rerender, preserved);
  assert.strictEqual(remount, preserved);
  assert.equal(remount.startedAt, 1_000);
  assert.equal(remount.boundaryState.phase, "QUESTION_LOCKED");
});

test("reconnect preserves state while a genuinely new conversation resets it", () => {
  const first = initializeInterviewTimerRuntime(null, "conversation-a:3", 1_000);
  const closing = evaluate(evaluate(first.boundaryState, 45).state, 30, true);
  const preserved = { ...first, boundaryState: closing.state };
  preserveInterviewTimerRuntime(preserved);

  const reconnect = initializeInterviewTimerRuntime(null, "conversation-a:3", 2_000);
  const next = initializeInterviewTimerRuntime(null, "conversation-b:3", 3_000);
  assert.equal(reconnect.boundaryState.phase, "CLOSING_ONLY");
  assert.equal(next.boundaryState.phase, "INTERVIEWING");
  assert.equal(next.startedAt, 3_000);
});

test("hidden control messages are silent, bounded, and reveal no time thresholds", () => {
  for (const phase of ["QUESTION_LOCKED", "CLOSING_ONLY", "TERMINATION_ONLY"]) {
    const message = buildHiddenInterviewBoundaryMessage("synthetic-conversation", phase);
    assert.equal(message.message_type, "conversation");
    assert.equal(message.event_type, "conversation.append_llm_context");
    assert.equal("text" in message.properties, false);
    assert.equal("speech" in message.properties, false);
    assert.equal("audio" in message.properties, false);
    const contract = JSON.parse(message.properties.context);
    assert.equal(contract.visibility, "internal_only");
    assert.equal(contract.disclosure, "forbidden");
    assert.equal(contract.control_state, phase);
    assert.doesNotMatch(message.properties.context, /\b(?:10|30|45|60|120)\b/);
    assert.doesNotMatch(message.properties.context, /\b(?:seconds?|minutes?|timer)\b/i);
  }
});

test("the bounded farewell contains no timer or implementation language", () => {
  const message = buildFinalClosingAnnouncementMessage("synthetic-conversation");
  assert.equal(message.event_type, "conversation.echo");
  assert.equal(message.properties.done, true);
  assert.match(message.properties.text, /concludes the interview/i);
  assert.doesNotMatch(message.properties.text, /\b(?:seconds?|minutes?|timer|instruction|system)\b/i);
});

test("source statically proves hard boundaries, no legacy warning echo, and private violation handling", async () => {
  const source = await readFile(sourcePath, "utf8");
  assert.match(source, /QUESTION_LOCK_THRESHOLD_SECONDS = 45/);
  assert.match(source, /CLOSING_ONLY_THRESHOLD_SECONDS = 30/);
  assert.match(source, /TERMINATION_CONTROL_THRESHOLD_SECONDS = 10/);
  assert.match(source, /conversation\.interrupt/);
  assert.match(source, /post_closing_question_violation/);
  assert.match(source, /markProviderEndRequested/);
  assert.match(source, /closingRuntimeBySession/);
  assert.doesNotMatch(source, /conversation\.respond/);
  assert.doesNotMatch(source, /TIME_WARNING_(?:NOTICE|TEXT)/);
  assert.doesNotMatch(source, /GRACEFUL_WRAP_(?:NOTICE|TEXT)/);
  assert.doesNotMatch(source, /setTimeNotice/);
  assert.equal(source.match(/event_type: "conversation\.echo"/g)?.length || 0, 2);
  assert.doesNotMatch(
    source,
    /post_closing_question_violation[\s\S]{0,500}(?:speech|text)\s*:/,
  );
});
