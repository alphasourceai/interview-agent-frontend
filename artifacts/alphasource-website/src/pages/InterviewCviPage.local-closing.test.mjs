import assert from "node:assert/strict";
import { after, test } from "node:test";
import { access, readFile } from "node:fs/promises";
import { constants } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const testDirectory = dirname(fileURLToPath(import.meta.url));
const websiteRoot = join(testDirectory, "..", "..");
const sourcePath = join(testDirectory, "InterviewCviPage.tsx");
const assetPath = join(websiteRoot, "public", "media", "interview-closing-final.mp3");

process.env.PORT ||= "4191";
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

test("zero sends one interrupt and one exact avatar Echo without a provider end", () => {
  assert.equal(closing.FINAL_CLOSING_START_TIMEOUT_MS, 5000);
  assert.equal(closing.FINAL_CLOSING_DRAIN_MS, 3500);
  assert.equal(closing.FINAL_CLOSING_INTERRUPT_ECHO_GAP_MS, 300);
  assert.equal(closing.FINAL_CLOSING_COMPLETION_FALLBACK_MS, 12000);
  const state = closing.createInterviewTimeBoundaryState("synthetic");
  for (const remainingSeconds of [180, 60, 20, 1, 0.001]) {
    const result = closing.evaluateInterviewTimeBoundary({ state, remainingSeconds });
    assert.equal(result.state.phase, "INTERVIEWING");
    assert.deepEqual(result.actions, []);
  }
  const result = closing.evaluateInterviewTimeBoundary({ state, remainingSeconds: 0 });
  assert.equal(result.state.phase, "AVATAR_CLOSING");
  assert.deepEqual(result.actions, [
    "reserve_avatar_closing",
    "request_candidate_audio_unpublish",
    "interrupt_replica",
    "send_closing_echo",
  ]);
  assert.equal(closing.closingProviderEndAllowed(result.state), false);

  const conversationId = "synthetic-conversation";
  const inferenceId = closing.closingApplicationInferenceId(conversationId);
  assert.deepEqual(closing.buildReplicaInterruptMessage(conversationId), {
    message_type: "conversation",
    event_type: "conversation.interrupt",
    conversation_id: conversationId,
  });
  assert.deepEqual(closing.buildFinalClosingAnnouncementMessage(conversationId, inferenceId), {
    message_type: "conversation",
    event_type: "conversation.echo",
    conversation_id: conversationId,
    properties: {
      modality: "text",
      text: "We are out of time. Thank you for your time. I am ending the session now.",
      done: true,
      inference_id: inferenceId,
    },
  });
});

test("completion requires a correlated start and ignores stale, foreign-conversation, duplicate, and late events", () => {
  const conversationId = "synthetic-conversation";
  const dispatched = closing.markClosingEchoDispatched(closing.evaluateInterviewTimeBoundary({
    state: closing.createInterviewTimeBoundaryState(conversationId),
    remainingSeconds: 0,
  }).state);
  const inferenceId = dispatched.farewellInferenceId;
  const stopBeforeStart = closing.recordClosingEchoSpeechEvent(dispatched, {
    kind: "stopped", conversationId, turnKey: "early-stop", providerSequence: 20,
    interrupted: false, applicationControl: true, inferenceId, correlation: "provider",
  }, conversationId);
  assert.equal(stopBeforeStart.transition, "none");

  const wrongConversation = closing.recordClosingEchoSpeechEvent(dispatched, {
    kind: "started", conversationId: "another-conversation", turnKey: "wrong-conversation",
    providerSequence: 21, interrupted: false, applicationControl: true,
    inferenceId, correlation: "provider",
  }, conversationId);
  assert.equal(wrongConversation.transition, "none");

  const started = closing.recordClosingEchoSpeechEvent(dispatched, {
    kind: "started", conversationId, turnKey: "farewell", providerSequence: 22,
    interrupted: false, applicationControl: true, inferenceId, correlation: "provider",
  }, conversationId);
  const staleStop = closing.recordClosingEchoSpeechEvent(started.state, {
    kind: "stopped", conversationId, turnKey: "farewell", providerSequence: 21,
    interrupted: false, applicationControl: true, inferenceId, correlation: "provider",
  }, conversationId);
  assert.equal(staleStop.transition, "none");
  const completed = closing.recordClosingEchoSpeechEvent(started.state, {
    kind: "stopped", conversationId, turnKey: "farewell", providerSequence: 23,
    interrupted: false, applicationControl: true, inferenceId, correlation: "provider",
  }, conversationId);
  assert.equal(completed.transition, "completed");
  const duplicate = closing.recordClosingEchoSpeechEvent(completed.state, {
    kind: "stopped", conversationId, turnKey: "farewell", providerSequence: 23,
    interrupted: false, applicationControl: true, inferenceId, correlation: "provider",
  }, conversationId);
  assert.equal(duplicate.transition, "none");
  const ended = closing.markProviderEndRequested(completed.state).state;
  const late = closing.recordClosingEchoSpeechEvent(ended, {
    kind: "started", conversationId, turnKey: "late", providerSequence: 24,
    interrupted: false, applicationControl: true, inferenceId, correlation: "provider",
  }, conversationId);
  assert.equal(late.transition, "none");
});

test("matching or inference-less farewell events can complete closing while conflicting ids fail closed", () => {
  const conversationId = "synthetic-conversation";
  const reserved = closing.evaluateInterviewTimeBoundary({
    state: closing.createInterviewTimeBoundaryState(conversationId),
    remainingSeconds: 0,
  }).state;
  const dispatched = closing.markClosingEchoDispatched(reserved);
  const inferenceId = dispatched.farewellInferenceId;

  const uncorrelatedStopBeforeStart = closing.recordClosingEchoSpeechEvent(dispatched, {
    kind: "stopped",
    conversationId,
    turnKey: "interrupted-prior-turn",
    providerSequence: null,
    interrupted: false,
    applicationControl: false,
    correlation: "local",
  }, conversationId);
  assert.equal(uncorrelatedStopBeforeStart.transition, "none");
  assert.strictEqual(uncorrelatedStopBeforeStart.state, dispatched);

  const strongStart = closing.recordClosingEchoSpeechEvent(dispatched, {
    kind: "started",
    conversationId,
    turnKey: "strong-turn",
    providerSequence: 8,
    interrupted: false,
    applicationControl: true,
    inferenceId,
    correlation: "provider",
  }, conversationId);
  assert.equal(strongStart.transition, "speaking");
  const duplicateStart = closing.recordClosingEchoSpeechEvent(strongStart.state, {
    kind: "started",
    conversationId,
    turnKey: "strong-turn-duplicate",
    providerSequence: 9,
    interrupted: false,
    applicationControl: true,
    inferenceId,
    correlation: "provider",
  }, conversationId);
  assert.equal(duplicateStart.transition, "none");
  assert.strictEqual(duplicateStart.state, strongStart.state);
  const strong = closing.recordClosingEchoSpeechEvent(strongStart.state, {
    kind: "stopped",
    conversationId,
    turnKey: "strong-turn",
    providerSequence: 8,
    interrupted: false,
    applicationControl: true,
    inferenceId,
    correlation: "provider",
  }, conversationId);
  assert.equal(strong.transition, "completed");
  assert.equal(closing.closingProviderEndAllowed(strong.state), true);

  const missingInferenceStart = closing.recordClosingEchoSpeechEvent(dispatched, {
    kind: "started",
    conversationId,
    turnKey: "missing-inference-start",
    providerSequence: null,
    interrupted: false,
    applicationControl: false,
    correlation: "local",
  }, conversationId);
  assert.equal(missingInferenceStart.transition, "speaking");
  assert.equal(missingInferenceStart.state.closingEchoStarted, true);
  const missingInferenceStop = closing.recordClosingEchoSpeechEvent(missingInferenceStart.state, {
    kind: "stopped",
    conversationId,
    turnKey: "missing-inference-stop",
    providerSequence: null,
    interrupted: false,
    applicationControl: false,
    correlation: "local",
  }, conversationId);
  assert.equal(missingInferenceStop.transition, "completed");
  assert.equal(closing.closingProviderEndAllowed(missingInferenceStop.state), true);

  const wrongInference = closing.recordClosingEchoSpeechEvent(dispatched, {
    kind: "stopped",
    conversationId,
    turnKey: "wrong-inference",
    providerSequence: 9,
    interrupted: false,
    applicationControl: false,
    inferenceId: "another-turn",
    correlation: "provider",
  }, conversationId);
  assert.equal(wrongInference.transition, "none");

  const interruptedStart = closing.recordClosingEchoSpeechEvent(dispatched, {
    kind: "started",
    conversationId,
    turnKey: "interrupted-farewell",
    providerSequence: 10,
    interrupted: false,
    applicationControl: true,
    inferenceId,
    correlation: "provider",
  }, conversationId);
  const interruptedFarewell = closing.recordClosingEchoSpeechEvent(interruptedStart.state, {
    kind: "stopped",
    conversationId,
    turnKey: "interrupted-farewell",
    providerSequence: 10,
    interrupted: true,
    applicationControl: true,
    inferenceId,
    correlation: "provider",
  }, conversationId);
  assert.equal(interruptedFarewell.transition, "farewell_interrupted");
  assert.equal(interruptedFarewell.state.closingEchoPhase, "FALLBACK");
});

test("the first post-Echo PAL span stays audible even when Tavus assigns a different inference id", () => {
  const conversationId = "synthetic-conversation";
  const reserved = closing.evaluateInterviewTimeBoundary({
    state: closing.createInterviewTimeBoundaryState(conversationId),
    remainingSeconds: 0,
  }).state;
  const dispatched = closing.markClosingEchoDispatched(reserved);
  const foreignStart = closing.recordClosingEchoSpeechEvent(dispatched, {
    kind: "started",
    conversationId,
    turnKey: "foreign-turn",
    providerSequence: 11,
    interrupted: false,
    applicationControl: false,
    inferenceId: "foreign-inference",
    correlation: "provider",
  }, conversationId);
  assert.equal(foreignStart.transition, "speaking");
  assert.equal(foreignStart.state.closingEchoPhase, "SPEAKING");

  const duplicateStart = closing.recordClosingEchoSpeechEvent(foreignStart.state, {
    kind: "started",
    conversationId,
    turnKey: "foreign-overlap",
    providerSequence: 13,
    interrupted: false,
    applicationControl: false,
    inferenceId: "foreign-inference-2",
    correlation: "provider",
  }, conversationId);
  assert.equal(duplicateStart.transition, "none");
  assert.strictEqual(duplicateStart.state, foreignStart.state);

  const completed = closing.recordClosingEchoSpeechEvent(foreignStart.state, {
    kind: "stopped",
    conversationId,
    turnKey: "foreign-turn",
    providerSequence: 13,
    interrupted: false,
    applicationControl: false,
    inferenceId: "foreign-inference",
    correlation: "provider",
  }, conversationId);
  assert.equal(completed.transition, "completed");
  assert.equal(closing.closingProviderEndAllowed(completed.state), true);
});

test("terminal provider speech is diagnostic-only and cannot authorize an early provider end", async () => {
  const source = await readFile(sourcePath, "utf8");
  const closingComment = source.indexOf("Closing blocks ordinary turn-taking");
  const closingBranchStart = source.indexOf("if (avatarClosingActiveRef.current)", closingComment);
  const ordinaryBranchStart = source.indexOf("const speech =", closingBranchStart);
  const closingBranch = source.slice(closingBranchStart, ordinaryBranchStart);
  assert.ok(closingBranchStart >= 0);
  assert.ok(ordinaryBranchStart > closingBranchStart);
  assert.doesNotMatch(closingBranch, /recordClosingEchoSpeechEvent/);
  assert.doesNotMatch(closingBranch, /finishAvatarClosingSpeech/);
  assert.doesNotMatch(closingBranch, /persistBoundaryState/);
  assert.doesNotMatch(closingBranch, /requestClosingProviderEnd/);
  assert.match(closingBranch, /!closingEchoDispatchRequestedRef\.current/);
  assert.match(closingBranch, /suppressRemotePalAudio/);
  assert.doesNotMatch(closingBranch, /foreign_suppressed|foreign_conflict/);
  assert.doesNotMatch(closingBranch, /closing_foreign_inference_suppressed/);
});

test("terminal closing drains a stale inference before its one exact Echo", async () => {
  const source = await readFile(sourcePath, "utf8");
  const start = source.indexOf("const dispatchTerminalClosing = useCallback");
  const end = source.indexOf("const dispatchTerminalClosingWhenReady", start);
  const dispatch = source.slice(start, end);
  assert.ok(start >= 0);
  assert.ok(end > start);
  assert.match(dispatch, /closingDrainTimerRef\.current = window\.setTimeout/);
  assert.match(dispatch, /FINAL_CLOSING_DRAIN_MS/);
  assert.match(dispatch, /closingEchoGapTimerRef\.current = window\.setTimeout/);
  assert.match(dispatch, /FINAL_CLOSING_INTERRUPT_ECHO_GAP_MS/);
  assert.ok(
    dispatch.indexOf("FINAL_CLOSING_DRAIN_MS") <
      dispatch.indexOf("buildFinalClosingAnnouncementMessage"),
  );
  assert.ok(
    dispatch.indexOf("FINAL_CLOSING_INTERRUPT_ECHO_GAP_MS") <
      dispatch.indexOf("buildFinalClosingAnnouncementMessage"),
  );
});

test("candidate audio publication failure does not become a farewell fallback", async () => {
  const source = await readFile(sourcePath, "utf8");
  const begin = source.slice(source.indexOf("const beginAvatarClosing"));
  assert.match(begin, /requestCandidateAudioUnpublish\(call\)/);
  assert.doesNotMatch(begin, /confirmCandidateAudioPublicationDisabled/);
  assert.doesNotMatch(begin, /audio_lock_failed/);
});

test("the owner opens Tavus audio after Echo dispatch and a missing start signal cannot end early", async () => {
  const source = await readFile(sourcePath, "utf8");
  const dispatchBegin = source.indexOf("const dispatchTerminalClosing");
  const dispatchEnd = source.indexOf("const dispatchTerminalClosingWhenReady", dispatchBegin);
  const dispatch = source.slice(dispatchBegin, dispatchEnd);
  const echoSend = dispatch.indexOf("buildFinalClosingAnnouncementMessage");
  const audioOpen = dispatch.indexOf("farewellAudioAudibleRef.current = true", echoSend);
  const participantSync = dispatch.indexOf("syncParticipants()", audioOpen);
  assert.ok(echoSend >= 0);
  assert.ok(audioOpen > echoSend);
  assert.ok(participantSync > audioOpen);

  const fallbackBegin = source.indexOf("const armClosingFallbacks");
  const fallbackEnd = source.indexOf("const dispatchTerminalClosing", fallbackBegin);
  const fallbacks = source.slice(fallbackBegin, fallbackEnd);
  const startTimeoutBegin = fallbacks.indexOf("closing_farewell_start_timed_out");
  const completionTimerBegin = fallbacks.indexOf("if (closingCompletionTimerRef.current)");
  const startTimeout = fallbacks.slice(startTimeoutBegin, completionTimerBegin);
  assert.ok(startTimeoutBegin >= 0);
  assert.doesNotMatch(startTimeout, /finishAvatarClosingSpeech/);
  assert.doesNotMatch(startTimeout, /markClosingEchoFallback/);
  assert.doesNotMatch(startTimeout, /suppressRemotePalAudio/);
  assert.match(fallbacks, /FINAL_CLOSING_COMPLETION_FALLBACK_MS/);
  assert.match(fallbacks, /finishAvatarClosingSpeech\(fallback, "completion_timeout"\)/);
});

test("the runtime keeps normal video UI and contains no local closing asset or splash", async () => {
  const source = await readFile(sourcePath, "utf8");
  await assert.rejects(access(assetPath, constants.F_OK));
  assert.equal(source.match(/event_type: "conversation\.echo"/g)?.length || 0, 2);
  assert.match(source, /CANDIDATE_INACTIVITY_NUDGE_TEXT/);
  assert.match(source, /buildFinalClosingAnnouncementMessage/);
  assert.match(source, /conversation\.interrupt/);
  assert.match(source, /closing_farewell_started/);
  assert.doesNotMatch(source, /playLocalClosingAudioOnce/);
  assert.doesNotMatch(source, /INTERVIEW_LOCAL_CLOSING_TEXT/);
  assert.doesNotMatch(source, /localClosingVisible/);
  assert.doesNotMatch(source, /role="status"/);
  assert.doesNotMatch(source, /remote_pal_audio_muted/);
  assert.doesNotMatch(source, /FINAL_CLOSING_THRESHOLD_SECONDS\s*=\s*20/);
});
