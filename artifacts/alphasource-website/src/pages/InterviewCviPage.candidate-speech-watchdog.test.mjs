import assert from "node:assert/strict";
import { after, test } from "node:test";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const testDirectory = dirname(fileURLToPath(import.meta.url));
const websiteRoot = join(testDirectory, "..", "..");
const sourcePath = join(testDirectory, "InterviewCviPage.tsx");

process.env.PORT ||= "4175";
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
const watchdog = await server.ssrLoadModule("/src/pages/InterviewCviPage.tsx");
after(async () => server.close());

const {
  beginCandidateSpeaking,
  CANDIDATE_SPEAKING_PROTECTION_MS,
  createCandidateSpeakingState,
  deriveCandidateSpeakingTransition,
  endCandidateSpeaking,
  evaluateProgressWatchdog,
} = watchdog;

function createFakeClock(startAt = 10_000) {
  let now = startAt;
  return {
    now: () => now,
    advance: (milliseconds) => {
      now += milliseconds;
      return now;
    },
  };
}

function evaluate({
  now,
  candidateSpeaking = createCandidateSpeakingState(),
  recoveryAttempted = false,
  recoveryActive = false,
  recoveryInFlight = false,
  progressObserved = true,
  lastProgressAt = 10_000,
  hasCall = true,
  lastAiSpeechStoppedAt = null,
} = {}) {
  return evaluateProgressWatchdog({
    now,
    candidateSpeaking,
    recoveryAttempted,
    recoveryActive,
    recoveryInFlight,
    progressObserved,
    lastProgressAt,
    hasCall,
    lastAiSpeechStoppedAt,
  });
}

test("pre-fix regression: a continuous 60-second candidate answer suppresses recovery", () => {
  const clock = createFakeClock();
  const speaking = beginCandidateSpeaking(createCandidateSpeakingState(), clock.now());
  const result = evaluate({
    now: clock.advance(60_000),
    candidateSpeaking: speaking.state,
  });

  assert.equal(speaking.started, true);
  assert.equal(result.action, "skip_candidate_speaking");
  assert.notEqual(result.action, "start_recovery");
  assert.notEqual(result.action, "terminal");
});

test("post-recovery long answer does not become post_recovery_progress_stale", () => {
  const clock = createFakeClock();
  const speaking = beginCandidateSpeaking(createCandidateSpeakingState(), clock.now());
  const result = evaluate({
    now: clock.advance(60_000),
    candidateSpeaking: speaking.state,
    recoveryAttempted: true,
  });

  assert.equal(result.action, "skip_candidate_speaking");
  assert.notEqual(result.action, "terminal");
});

test("candidate speech end establishes a fresh watchdog origin", () => {
  const clock = createFakeClock();
  const speaking = beginCandidateSpeaking(createCandidateSpeakingState(), clock.now());
  const speechEndedAt = clock.advance(60_000);
  const ended = endCandidateSpeaking(speaking.state);

  assert.equal(ended.ended, true);
  assert.equal(ended.state.active, false);
  assert.equal(evaluate({
    now: clock.advance(44_999),
    candidateSpeaking: ended.state,
    lastProgressAt: speechEndedAt,
  }).action, "none");
});

test("silence after speech end still reaches the existing recovery threshold", () => {
  const clock = createFakeClock();
  const endedAt = clock.now();
  assert.equal(evaluate({
    now: clock.advance(45_000),
    lastProgressAt: endedAt,
  }).action, "start_recovery");
});

test("stuck candidate-speaking state expires without immediately terminating", () => {
  const clock = createFakeClock();
  const speaking = beginCandidateSpeaking(createCandidateSpeakingState(), clock.now());
  const expired = evaluate({
    now: clock.advance(CANDIDATE_SPEAKING_PROTECTION_MS),
    candidateSpeaking: speaking.state,
  });

  assert.equal(expired.action, "candidate_speaking_expired");
  assert.equal(expired.candidateSpeaking.active, false);
  assert.notEqual(expired.action, "terminal");
  assert.equal(evaluate({
    now: clock.advance(5_000),
    candidateSpeaking: expired.candidateSpeaking,
  }).action, "start_recovery");
});

test("duplicate start events cannot extend the bounded protection deadline", () => {
  const clock = createFakeClock();
  const first = beginCandidateSpeaking(createCandidateSpeakingState(), clock.now());
  const duplicate = beginCandidateSpeaking(first.state, clock.advance(30_000));

  assert.equal(duplicate.started, false);
  assert.strictEqual(duplicate.state, first.state);
  assert.equal(duplicate.state.expiresAt, 10_000 + CANDIDATE_SPEAKING_PROTECTION_MS);
});

test("candidate speech cannot alter an active reconnect or its deadline", () => {
  const clock = createFakeClock();
  const speaking = beginCandidateSpeaking(createCandidateSpeakingState(), clock.now());
  const result = evaluate({
    now: clock.advance(60_000),
    candidateSpeaking: speaking.state,
    recoveryActive: true,
    recoveryInFlight: true,
  });

  assert.equal(result.action, "none");
  assert.strictEqual(result.candidateSpeaking, speaking.state);
});

test("candidate-speaking skip diagnostics are rate-limited", () => {
  const clock = createFakeClock();
  const speaking = beginCandidateSpeaking(createCandidateSpeakingState(), clock.now());
  const first = evaluate({
    now: clock.advance(60_000),
    candidateSpeaking: speaking.state,
  });
  const repeated = evaluate({
    now: clock.advance(5_000),
    candidateSpeaking: first.candidateSpeaking,
  });

  assert.equal(first.action, "skip_candidate_speaking");
  assert.equal(first.emitDiagnostic, true);
  assert.equal(repeated.action, "skip_candidate_speaking");
  assert.equal(repeated.emitDiagnostic, false);
});

test("ordinary post-recovery staleness still produces one terminal decision", () => {
  const result = evaluate({
    now: 55_000,
    recoveryAttempted: true,
  });
  assert.equal(result.action, "terminal");
});

test("remote presence or playable audio alone cannot count as watchdog progress", () => {
  const result = evaluate({
    now: 55_000,
  });
  assert.equal(result.action, "start_recovery");
});

test("candidate app-message wiring uses only role-attributed speech transitions", async () => {
  const source = await readFile(sourcePath, "utf8");
  const mockedTrustedEvents = [
    { event_type: "conversation.started_speaking", role: "candidate", expected: "started" },
    { event_type: "conversation.started_speaking", role: "user", expected: "started" },
    { event_type: "conversation.stopped_speaking", role: "participant", expected: "ended" },
  ];
  for (const event of mockedTrustedEvents) {
    assert.equal(
      deriveCandidateSpeakingTransition(event.event_type, event.role),
      event.expected,
    );
  }
  assert.equal(deriveCandidateSpeakingTransition("conversation.tool_call", "candidate"), null);
  assert.equal(deriveCandidateSpeakingTransition("conversation.started_speaking", "replica"), null);
  assert.equal(deriveCandidateSpeakingTransition("arbitrary.app_message", "candidate"), null);
  assert.match(source, /deriveCandidateSpeakingTransition\(eventType, utteranceRole\)/);
});

test("candidate speech is never a reconnect practical-progress source", async () => {
  const source = await readFile(sourcePath, "utf8");
  const sourceType = source.match(/export type ReconnectProgressSource = ([^;]+);/)?.[1] || "";
  assert.doesNotMatch(sourceType, /candidate/);
  assert.match(source, /candidate_speaking_started/);
  assert.doesNotMatch(source, /completeProgressRecovery\("candidate_/);
});

test("bounded diagnostics contain transitions and no speech content", async () => {
  const source = await readFile(sourcePath, "utf8");
  assert.match(source, /watchdog_evaluation: "candidate_speaking_active"/);
  assert.match(source, /watchdog_evaluation: "candidate_speaking_protection_expired"/);
  assert.match(source, /recordProgressCheckpoint\("candidate_speaking_started", progressAt\)/);
  assert.match(source, /recordProgressCheckpoint\("candidate_speaking_ended", progressAt\)/);
  const checkpointStart = source.indexOf("const recordProgressCheckpoint");
  const checkpointEnd = source.indexOf("const recordReconnectLocalJoin", checkpointStart);
  assert.ok(checkpointStart > 0 && checkpointEnd > checkpointStart);
  assert.doesNotMatch(source.slice(checkpointStart, checkpointEnd), /\bspeech\b|\btext\b|conversation_id|interview_id/);
});
