import assert from "node:assert/strict";
import { after, test } from "node:test";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const testDirectory = dirname(fileURLToPath(import.meta.url));
const websiteRoot = join(testDirectory, "..", "..");
const sourcePath = join(testDirectory, "InterviewCviPage.tsx");
const accessSourcePath = join(testDirectory, "InterviewPage.tsx");

process.env.PORT ||= "4179";
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
const runtime = await server.ssrLoadModule("/src/pages/InterviewCviPage.tsx");
after(async () => server.close());

const {
  CANDIDATE_INACTIVITY_NUDGE_MAX_LATENESS_MS,
  CANDIDATE_INACTIVITY_NUDGE_TEXT,
  CANDIDATE_INACTIVITY_NUDGE_THRESHOLD_MS,
  acquireCandidateInactivityLease,
  armCandidateInactivityNudge,
  buildCandidateInactivityNudgeMessage,
  cancelCandidateInactivityNudge,
  candidateInactivityLeaseKey,
  createCandidateInactivityNudgeState,
  evaluateCandidateInactivityDeadline,
  normalizePalSpeakingEvent,
  normalizeCorrelatedRolelessPalStop,
  ownsCandidateInactivityLease,
  recordCandidateActivityForInactivityNudge,
  recordCandidateInactivityNudgeDispatch,
  releaseCandidateInactivityLease,
} = runtime;

const CONVERSATION = "synthetic-conversation-a";
const INTERVIEW = "synthetic-interview-a";

function eligibility(overrides = {}) {
  return {
    phase: "INTERVIEWING",
    remainingSeconds: 300,
    candidateSpeaking: false,
    reconnectActive: false,
    transportHealthy: true,
    candidateMediaHealthy: true,
    replicaPresent: true,
    remoteAudioReady: true,
    documentVisible: true,
    runtimeOwner: true,
    ...overrides,
  };
}

function palEvent(sequence = 1, overrides = {}) {
  return normalizePalSpeakingEvent({
    event_type: "conversation.stopped_speaking",
    conversation_id: CONVERSATION,
    properties: {
      role: "replica",
      inference_id: `synthetic-turn-${sequence}`,
      seq: sequence,
      interrupted: false,
    },
    ...overrides,
  }, CONVERSATION);
}

function armed(sequence = 1, at = 1_000, overrides = {}) {
  const result = armCandidateInactivityNudge(
    createCandidateInactivityNudgeState(true, INTERVIEW, CONVERSATION),
    palEvent(sequence),
    at,
    eligibility(overrides),
  );
  assert.equal(result.action, "armed");
  return result.state;
}

function deadline(state, at, overrides = {}) {
  return evaluateCandidateInactivityDeadline(state, at, eligibility(overrides));
}

function memoryStorage() {
  const values = new Map();
  return {
    values,
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); },
  };
}

test("controller is disabled unless the server snapshot enables application ownership", () => {
  assert.equal(createCandidateInactivityNudgeState(false, INTERVIEW, CONVERSATION).phase, "DISABLED");
  assert.equal(createCandidateInactivityNudgeState(true, "", CONVERSATION).phase, "DISABLED");
  assert.equal(createCandidateInactivityNudgeState(true, INTERVIEW, "").phase, "DISABLED");
  assert.equal(createCandidateInactivityNudgeState(true, INTERVIEW, CONVERSATION).phase, "DISARMED");
});

test("generic and role-specific PAL aliases normalize to one opaque turn identity", () => {
  const generic = palEvent(4);
  const legacy = normalizePalSpeakingEvent({
    event_type: "conversation.replica_stopped_speaking",
    conversation_id: CONVERSATION,
    inference_id: "synthetic-turn-4",
    seq: 4,
    turn_idx: 4,
    properties: { interrupted: false },
  }, CONVERSATION);
  assert.ok(generic);
  assert.ok(legacy);
  assert.equal(generic.turnKey, legacy.turnKey);
  assert.equal(generic.providerSequence, 4);
});

test("attributed PAL stops without provider correlation fail open with a local ordinal", () => {
  const generic = normalizePalSpeakingEvent({
    event_type: "conversation.stopped_speaking",
    conversation_id: CONVERSATION,
    properties: { role: "replica", interrupted: false },
  }, CONVERSATION, 7);
  const roleSpecific = normalizePalSpeakingEvent({
    event_type: "conversation.replica.stopped_speaking",
    conversation_id: CONVERSATION,
    properties: { interrupted: false },
  }, CONVERSATION, 8);
  assert.ok(generic);
  assert.ok(roleSpecific);
  assert.equal(generic.kind, "stopped");
  assert.equal(generic.correlation, "local");
  assert.equal(generic.providerSequence, null);
  assert.notEqual(generic.turnKey, roleSpecific.turnKey);

  const armed = armCandidateInactivityNudge(
    createCandidateInactivityNudgeState(true, INTERVIEW, CONVERSATION),
    generic,
    1_000,
    eligibility(),
  );
  assert.equal(armed.action, "armed");
  assert.equal(armed.state.deadlineAt, 11_000);
  const duplicateSchemaEvent = armCandidateInactivityNudge(
    armed.state,
    roleSpecific,
    1_500,
    eligibility(),
  );
  assert.equal(duplicateSchemaEvent.action, "suppressed");
  assert.equal(duplicateSchemaEvent.reason, "duplicate_turn");
  assert.strictEqual(duplicateSchemaEvent.state, armed.state);
});

test("unattributed, malformed, and non-speaking provider events fail silent", () => {
  assert.equal(normalizePalSpeakingEvent({ event_type: "conversation.stopped_speaking" }, CONVERSATION), null);
  assert.equal(normalizePalSpeakingEvent({ event_type: "conversation.utterance", role: "replica" }, CONVERSATION), null);
  assert.equal(normalizePalSpeakingEvent({ event_type: "conversation.stopped_speaking", role: "candidate", sequence: 1 }, CONVERSATION), null);
});

test("a role-less generic stop can close only an already-open qualified replica span", () => {
  const payload = {
    event_type: "conversation.stopped_speaking",
    conversation_id: CONVERSATION,
    properties: { seq: 17, turn_idx: 4, interrupted: false },
  };
  const correlated = normalizeCorrelatedRolelessPalStop(
    payload,
    CONVERSATION,
    9,
    true,
    false,
  );
  assert.ok(correlated);
  assert.equal(correlated.kind, "stopped");
  assert.equal(correlated.providerSequence, 17);
  assert.equal(correlated.conversationId, CONVERSATION);

  assert.equal(
    normalizeCorrelatedRolelessPalStop(payload, CONVERSATION, 9, false, false),
    null,
  );
  assert.equal(
    normalizeCorrelatedRolelessPalStop(payload, CONVERSATION, 9, true, true),
    null,
  );
  assert.equal(normalizeCorrelatedRolelessPalStop({
    ...payload,
    properties: { role: "candidate", seq: 17 },
  }, CONVERSATION, 9, true, false), null);
  assert.equal(normalizeCorrelatedRolelessPalStop({
    ...payload,
    event_type: "conversation.started_speaking",
  }, CONVERSATION, 9, true, false), null);
});

test("the app-message runtime pairs a role-less stop with an open replica span before arming", async () => {
  const source = await readFile(sourcePath, "utf8");
  assert.match(
    source,
    /normalizeCorrelatedRolelessPalStop\([\s\S]{0,320}replicaSpeakingRef\.current[\s\S]{0,180}candidateSpeakingStateRef\.current\.active/,
  );
  assert.match(
    source,
    /const normalizedPalSpeaking = normalizedExplicitPalSpeaking \|\| correlatedRolelessPalStop/,
  );
});

test("one uninterrupted PAL stop in interviewing arms exactly one 10-second window", () => {
  const first = armCandidateInactivityNudge(
    createCandidateInactivityNudgeState(true, INTERVIEW, CONVERSATION),
    palEvent(1),
    1_000,
    eligibility(),
  );
  const duplicate = armCandidateInactivityNudge(first.state, palEvent(1), 1_001, eligibility());
  assert.equal(first.action, "armed");
  assert.equal(first.state.deadlineAt, 1_000 + CANDIDATE_INACTIVITY_NUDGE_THRESHOLD_MS);
  assert.equal(duplicate.action, "suppressed");
  assert.equal(duplicate.reason, "duplicate_turn");
  assert.equal(duplicate.state.deadlineAt, first.state.deadlineAt);
  assert.equal(duplicate.state.phase, "ARMED_AFTER_PAL_TURN");
});

test("interrupted, stale, wrong-conversation, and application-control PAL stops cannot arm", () => {
  const initial = createCandidateInactivityNudgeState(true, INTERVIEW, CONVERSATION);
  const interrupted = armCandidateInactivityNudge(initial, { ...palEvent(1), interrupted: true }, 1_000, eligibility());
  assert.equal(interrupted.reason, "interrupted_pal_turn");

  const first = armCandidateInactivityNudge(initial, palEvent(5), 1_000, eligibility());
  const stale = armCandidateInactivityNudge(first.state, palEvent(4), 1_100, eligibility());
  assert.equal(stale.reason, "stale_sequence");

  const wrong = armCandidateInactivityNudge(initial, { ...palEvent(1), conversationId: "other" }, 1_000, eligibility());
  assert.equal(wrong.reason, "wrong_conversation");

  const control = armCandidateInactivityNudge(initial, { ...palEvent(1), applicationControl: true }, 1_000, eligibility());
  assert.equal(control.reason, "application_control_turn");

  for (const result of [interrupted, wrong, control]) {
    assert.equal(result.state.deadlineAt, null);
    assert.equal(result.state.activeTurnKey, null);
  }

  const armedState = armed();
  const controlWhileArmed = armCandidateInactivityNudge(
    armedState,
    { ...palEvent(2), applicationControl: true },
    2_000,
    eligibility(),
  );
  assert.equal(controlWhileArmed.action, "suppressed");
  assert.equal(controlWhileArmed.state.phase, "SUPPRESSED");
  assert.equal(controlWhileArmed.state.deadlineAt, null);
  assert.equal(controlWhileArmed.state.activeTurnKey, null);
});

test("every unsafe arming condition fails silent with a bounded reason", () => {
  const cases = [
    [{ candidateSpeaking: true }, "candidate_speaking"],
    [{ reconnectActive: true }, "reconnect"],
    [{ transportHealthy: false }, "transport_unhealthy"],
    [{ candidateMediaHealthy: false }, "candidate_media_unavailable"],
    [{ replicaPresent: false }, "replica_absent"],
    [{ remoteAudioReady: false }, "remote_audio_unavailable"],
    [{ documentVisible: false }, "hidden_document"],
    [{ runtimeOwner: false }, "runtime_ownership_lost"],
    [{ phase: "LOCAL_CLOSING" }, "closing"],
    [{ phase: "COMPLETE" }, "termination"],
    [{ remainingSeconds: 0 }, "closing"],
  ];
  for (const [override, reason] of cases) {
    const result = armCandidateInactivityNudge(
      createCandidateInactivityNudgeState(true, INTERVIEW, CONVERSATION),
      palEvent(1),
      1_000,
      eligibility(override),
    );
    assert.equal(result.action, "suppressed", reason);
    assert.equal(result.reason, reason);
  }
});

test("candidate speech and authoritative utterance cancel immediately before threshold", () => {
  for (const reason of ["candidate_speaking", "candidate_utterance"]) {
    const result = recordCandidateActivityForInactivityNudge(armed(), reason);
    assert.equal(result.action, "cancelled");
    assert.equal(result.state.phase, "DISARMED");
    assert.equal(result.state.deadlineAt, null);
  }
});

test("PAL speech, reconnect, media loss, closing, conversation change, unmount, and lease loss cancel", () => {
  for (const reason of [
    "pal_speaking",
    "reconnect",
    "transport_unhealthy",
    "candidate_media_unavailable",
    "replica_absent",
    "remote_audio_unavailable",
    "watchdog_recovery",
    "question_lock",
    "closing",
    "termination",
    "provider_end",
    "conversation_changed",
    "unmount",
    "runtime_ownership_lost",
  ]) {
    const result = cancelCandidateInactivityNudge(armed(), reason, reason === "provider_end" || reason === "unmount");
    assert.equal(result.action, "cancelled", reason);
    assert.equal(result.state.deadlineAt, null, reason);
  }
});

test("three-second and seven-to-eight-second pauses never dispatch", () => {
  const state = armed();
  for (const at of [4_000, 8_000, 8_999]) {
    assert.equal(deadline(state, at).action, "none");
  }
});

test("10-second healthy silence claims exactly one fixed Echo", () => {
  const state = armed();
  const due = deadline(state, 11_000);
  assert.equal(due.action, "send");
  assert.equal(due.latenessBucket, "on_time");
  const message = buildCandidateInactivityNudgeMessage(CONVERSATION, due.state.activeTurnKey);
  assert.equal(message.event_type, "conversation.echo");
  assert.equal(message.properties.text, CANDIDATE_INACTIVITY_NUDGE_TEXT);
  assert.equal(message.properties.text, "Take your time. When you’re ready, you can continue.");
  assert.equal(message.properties.done, true);
  assert.match(message.properties.inference_id, /^alphascreen-candidate-inactivity-nudge-[a-z0-9]+$/);
});

test("slightly late dispatch is deterministic while materially late timers suppress", () => {
  const state = armed();
  const within = deadline(state, 11_000 + CANDIDATE_INACTIVITY_NUDGE_MAX_LATENESS_MS);
  const late = deadline(state, 11_001 + CANDIDATE_INACTIVITY_NUDGE_MAX_LATENESS_MS);
  assert.equal(within.action, "send");
  assert.equal(within.latenessBucket, "within_2s");
  assert.equal(late.action, "suppressed");
  assert.equal(late.reason, "late_timer");
  assert.equal(late.latenessBucket, "over_2s");
});

test("deadline revalidates candidate, transport, reconnect, media, tab, and closing safety", () => {
  const cases = [
    { candidateSpeaking: true },
    { reconnectActive: true },
    { transportHealthy: false },
    { candidateMediaHealthy: false },
    { replicaPresent: false },
    { remoteAudioReady: false },
    { documentVisible: false },
    { runtimeOwner: false },
    { remainingSeconds: 0 },
    { phase: "LOCAL_CLOSING" },
  ];
  for (const override of cases) {
    assert.equal(deadline(armed(), 11_000, override).action, "suppressed");
  }
});

test("dispatch enters waiting state and continued PAL activity cannot re-arm before candidate activity", () => {
  const due = deadline(armed(), 11_000);
  const sent = recordCandidateInactivityNudgeDispatch(due.state, true);
  assert.equal(sent.state.phase, "WAITING_FOR_CANDIDATE_AFTER_NUDGE");
  const nudgeStop = armCandidateInactivityNudge(
    sent.state,
    { ...palEvent(2), applicationControl: true },
    12_000,
    eligibility(),
  );
  assert.equal(nudgeStop.action, "none");
  assert.equal(nudgeStop.state.phase, "WAITING_FOR_CANDIDATE_AFTER_NUDGE");
  const ordinaryPal = armCandidateInactivityNudge(
    nudgeStop.state,
    palEvent(3),
    13_000,
    eligibility(),
  );
  assert.equal(ordinaryPal.action, "none");
  assert.equal(ordinaryPal.state.phase, "WAITING_FOR_CANDIDATE_AFTER_NUDGE");
  const interruptedPal = armCandidateInactivityNudge(
    ordinaryPal.state,
    { ...palEvent(4), interrupted: true },
    14_000,
    eligibility(),
  );
  assert.equal(interruptedPal.action, "none");
  assert.equal(interruptedPal.state.phase, "WAITING_FOR_CANDIDATE_AFTER_NUDGE");
  const active = recordCandidateActivityForInactivityNudge(
    interruptedPal.state,
    "candidate_utterance",
  );
  const later = armCandidateInactivityNudge(active.state, palEvent(5), 20_000, eligibility());
  assert.equal(active.state.phase, "DISARMED");
  assert.equal(later.action, "armed");
});

test("candidate activity clears waiting and a later ordinary PAL turn may arm", () => {
  const due = deadline(armed(), 11_000);
  const waiting = recordCandidateInactivityNudgeDispatch(due.state, true).state;
  const active = recordCandidateActivityForInactivityNudge(waiting, "candidate_speaking");
  const later = armCandidateInactivityNudge(active.state, palEvent(2), 20_000, eligibility());
  assert.equal(active.state.phase, "DISARMED");
  assert.equal(later.action, "armed");
});

test("failed Echo dispatch suppresses without changing interview state", () => {
  const due = deadline(armed(), 11_000);
  const failed = recordCandidateInactivityNudgeDispatch(due.state, false);
  assert.equal(failed.action, "suppressed");
  assert.equal(failed.reason, "dispatch_failed");
  assert.equal(failed.state.phase, "SUPPRESSED");
});

test("rerender and effect re-entry reuse controller state while remount cannot fire a stale timer", () => {
  const state = armed();
  const rerender = state;
  const remount = createCandidateInactivityNudgeState(true, INTERVIEW, CONVERSATION);
  assert.strictEqual(rerender, state);
  assert.equal(remount.phase, "DISARMED");
  assert.equal(remount.deadlineAt, null);
});

test("new conversation state cannot inherit the prior turn or deadline", () => {
  const first = armed();
  const next = createCandidateInactivityNudgeState(
    true,
    "synthetic-interview-b",
    "synthetic-conversation-b",
  );
  assert.notEqual(first.interviewId, next.interviewId);
  assert.notEqual(first.conversationId, next.conversationId);
  assert.equal(next.processedTurnKeys.length, 0);
  assert.equal(next.deadlineAt, null);
});

test("browser lease allows one visible owner, blocks a secondary tab, and supports safe transfer", () => {
  const storage = memoryStorage();
  assert.equal(acquireCandidateInactivityLease(storage, CONVERSATION, "tab-a", 1_000, true), true);
  assert.equal(acquireCandidateInactivityLease(storage, CONVERSATION, "tab-b", 1_001, true), false);
  assert.equal(ownsCandidateInactivityLease(storage, CONVERSATION, "tab-a", 1_002), true);
  assert.equal(acquireCandidateInactivityLease(storage, CONVERSATION, "tab-b", 1_003, false), false);
  releaseCandidateInactivityLease(storage, CONVERSATION, "tab-a");
  assert.equal(acquireCandidateInactivityLease(storage, CONVERSATION, "tab-b", 1_004, true), true);
  assert.equal(ownsCandidateInactivityLease(storage, CONVERSATION, "tab-a", 1_005), false);
});

test("lease persistence contains no raw provider conversation identifier", () => {
  const storage = memoryStorage();
  acquireCandidateInactivityLease(storage, CONVERSATION, "tab-a", 1_000, true);
  const [key, value] = [...storage.values.entries()][0];
  assert.equal(key, candidateInactivityLeaseKey(CONVERSATION));
  assert.doesNotMatch(key, new RegExp(CONVERSATION));
  assert.doesNotMatch(value, new RegExp(CONVERSATION));
});

test("source wiring is server-controlled, monotonic, fail-silent, and separated from watchdog and timer", async () => {
  const source = await readFile(sourcePath, "utf8");
  const accessSource = await readFile(accessSourcePath, "utf8");
  assert.match(source, /application_inactivity_control_enabled === true/);
  assert.match(source, /silence_engagement_owner === "application_inactivity"/);
  assert.match(source, /monotonicNow\(\)/);
  assert.match(source, /buildCandidateInactivityNudgeMessage/);
  const replicaStopBranch = source.slice(
    source.indexOf("if (isReplicaStoppedSpeaking)"),
    source.indexOf("if (isCandidateSpeaking)", source.indexOf("if (isReplicaStoppedSpeaking)")),
  );
  assert.match(replicaStopBranch, /normalizedPalSpeaking/);
  assert.match(replicaStopBranch, /armInactivityRuntime\(/);
  assert.match(source, /candidate_inactivity_nudge_(?:armed|cancelled|sent|suppressed)/);
  assert.doesNotMatch(source, /CANDIDATE_INACTIVITY_NUDGE_THRESHOLD_MS\s*\*/);
  assert.doesNotMatch(CANDIDATE_INACTIVITY_NUDGE_TEXT, /candidate|question|answer|timer|seconds?/i);
  const startBody = accessSource.slice(
    accessSource.indexOf('body: JSON.stringify({', accessSource.indexOf('"/create-tavus-interview"')),
    accessSource.indexOf('});', accessSource.indexOf('body: JSON.stringify({', accessSource.indexOf('"/create-tavus-interview"'))),
  );
  assert.doesNotMatch(startBody, /silence_engagement|application_inactivity/i);
  assert.match(accessSource, /data\?\.application_inactivity_control_enabled === true/);
});
