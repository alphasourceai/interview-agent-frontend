import assert from "node:assert/strict";
import { after, test } from "node:test";
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

globalThis.MediaStream ||= class MediaStream {
  constructor(tracks = []) { this.tracks = tracks; }
  getTracks() { return this.tracks; }
};

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
  advanceSharedFinalClosingRuntime,
  attachRemotePalAudioTrack,
  claimSharedFinalClosingRuntime,
  finalClosingGraceDelayMs,
  finalClosingSharedStorageKey,
  readSharedFinalClosingRuntime,
  requestCandidateAudioUnpublish,
  sharedFinalClosingRecoveryPlan,
  sharedFinalClosingDispatchMayResume,
  sharedProviderEndAttemptAllowed,
  withFinalClosingRuntimeLock,
} = closing;

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
}

function mediaElement() {
  return {
    muted: false,
    volume: 1,
    srcObject: { existing: true },
    paused: false,
    pause() { this.paused = true; },
    play() { return Promise.resolve(); },
  };
}

test("one tab exclusively claims a conversation-bound closing", () => {
  const storage = memoryStorage();
  const first = claimSharedFinalClosingRuntime(storage, "conversation-a", "tab-a");
  const duplicate = claimSharedFinalClosingRuntime(storage, "conversation-a", "tab-a");
  const competing = claimSharedFinalClosingRuntime(storage, "conversation-a", "tab-b");
  const otherConversation = claimSharedFinalClosingRuntime(storage, "conversation-b", "tab-b");
  assert.equal(first.owned, true);
  assert.equal(duplicate.owned, true);
  assert.equal(competing.owned, false);
  assert.equal(otherConversation.owned, true);
  assert.notEqual(
    finalClosingSharedStorageKey("conversation-a"),
    finalClosingSharedStorageKey("conversation-b"),
  );
});

test("only the owner can monotonically advance through avatar Echo and request provider end once", () => {
  const storage = memoryStorage();
  claimSharedFinalClosingRuntime(storage, "conversation-a", "tab-a");
  assert.equal(
    advanceSharedFinalClosingRuntime(storage, "conversation-a", "tab-b", "CANDIDATE_AUDIO_REQUESTED").advanced,
    false,
  );
  for (const phase of [
    "CANDIDATE_AUDIO_REQUESTED",
    "DISPATCH_RESERVED",
    "INTERRUPT_SENT",
    "ECHO_DISPATCHED",
    "FAREWELL_AUDIBLE",
    "ECHO_COMPLETED",
  ]) {
    assert.equal(
      advanceSharedFinalClosingRuntime(storage, "conversation-a", "tab-a", phase).advanced,
      true,
    );
  }
  const provider = advanceSharedFinalClosingRuntime(
    storage,
    "conversation-a",
    "tab-a",
    "PROVIDER_END_REQUESTED",
  );
  const duplicate = advanceSharedFinalClosingRuntime(
    storage,
    "conversation-a",
    "tab-a",
    "PROVIDER_END_REQUESTED",
  );
  assert.equal(sharedProviderEndAttemptAllowed(provider), true);
  assert.equal(sharedProviderEndAttemptAllowed(duplicate), false);
  assert.equal(readSharedFinalClosingRuntime(storage, "conversation-a").phase, "PROVIDER_END_REQUESTED");
  assert.equal(
    advanceSharedFinalClosingRuntime(storage, "conversation-a", "tab-a", "RESERVED").advanced,
    false,
  );
});

test("owner remount resumes only before dispatch and requests provider end only after completion", () => {
  const reserved = {
    version: 2,
    ownerTabId: "tab-a",
    phase: "RESERVED",
    updatedAt: 1_000,
    leaseExpiresAt: 10_000,
    farewellStartDeadlineAt: null,
    farewellCompletionDeadlineAt: null,
  };
  const requested = { ...reserved, phase: "PROVIDER_END_REQUESTED" };
  const complete = { ...reserved, phase: "COMPLETE" };

  assert.deepEqual(sharedFinalClosingRecoveryPlan(reserved, "tab-a"), {
    owned: true,
    navigateImmediately: false,
    rearmCompletionFallback: false,
    requestProviderEnd: false,
    failClosedProviderEnd: false,
    farewellAudible: false,
    resumeDispatch: true,
  });
  const echoDispatched = {
    ...reserved,
    phase: "ECHO_DISPATCHED",
    farewellStartDeadlineAt: 6_000,
    farewellCompletionDeadlineAt: 13_000,
  };
  assert.deepEqual(sharedFinalClosingRecoveryPlan(echoDispatched, "tab-a"), {
    owned: true,
    navigateImmediately: false,
    rearmCompletionFallback: true,
    requestProviderEnd: false,
    failClosedProviderEnd: false,
    farewellAudible: true,
    resumeDispatch: false,
  });
  const echoCompleted = { ...reserved, phase: "ECHO_COMPLETED" };
  assert.deepEqual(sharedFinalClosingRecoveryPlan(echoCompleted, "tab-a"), {
    owned: true,
    navigateImmediately: false,
    rearmCompletionFallback: false,
    requestProviderEnd: true,
    failClosedProviderEnd: false,
    farewellAudible: false,
    resumeDispatch: false,
  });
  assert.deepEqual(sharedFinalClosingRecoveryPlan(requested, "tab-a"), {
    owned: true,
    navigateImmediately: false,
    rearmCompletionFallback: false,
    requestProviderEnd: false,
    failClosedProviderEnd: false,
    farewellAudible: false,
    resumeDispatch: false,
  });
  assert.deepEqual(sharedFinalClosingRecoveryPlan(requested, "tab-b"), {
    owned: false,
    navigateImmediately: false,
    rearmCompletionFallback: false,
    requestProviderEnd: false,
    failClosedProviderEnd: false,
    farewellAudible: false,
    resumeDispatch: false,
  });
  assert.deepEqual(sharedFinalClosingRecoveryPlan(complete, "tab-a"), {
    owned: true,
    navigateImmediately: true,
    rearmCompletionFallback: false,
    requestProviderEnd: false,
    failClosedProviderEnd: false,
    farewellAudible: false,
    resumeDispatch: false,
  });
});

test("a stale owner can be taken over once without reopening dispatch reservations", () => {
  const storage = memoryStorage();
  const first = claimSharedFinalClosingRuntime(storage, "conversation-a", "tab-a", 1_000);
  assert.equal(first.owned, true);
  assert.equal(
    claimSharedFinalClosingRuntime(storage, "conversation-a", "tab-b", first.state.leaseExpiresAt - 1).owned,
    false,
  );
  const takeover = claimSharedFinalClosingRuntime(
    storage,
    "conversation-a",
    "tab-b",
    first.state.leaseExpiresAt,
  );
  assert.equal(takeover.owned, true);
  assert.equal(takeover.reason, "stale_owner_takeover");
  assert.equal(takeover.state.ownerTabId, "tab-b");
  assert.equal(
    claimSharedFinalClosingRuntime(storage, "conversation-a", "tab-c", takeover.state.leaseExpiresAt - 1).owned,
    false,
  );
});

test("stale takeover resumes only before any provider dispatch reservation", () => {
  const storage = memoryStorage();
  const initial = claimSharedFinalClosingRuntime(storage, "conversation-resume", "tab-a", 100);
  assert.equal(initial.owned, true);
  assert.equal(sharedFinalClosingDispatchMayResume(initial.state), true);

  assert.equal(
    advanceSharedFinalClosingRuntime(
      storage,
      "conversation-resume",
      "tab-a",
      "CANDIDATE_AUDIO_REQUESTED",
      101,
    ).advanced,
    true,
  );
  const requested = readSharedFinalClosingRuntime(storage, "conversation-resume");
  assert.equal(sharedFinalClosingDispatchMayResume(requested), true);

  const takeover = claimSharedFinalClosingRuntime(
    storage,
    "conversation-resume",
    "tab-b",
    requested.leaseExpiresAt + 1,
  );
  assert.equal(takeover.owned, true);
  assert.equal(takeover.reason, "stale_owner_takeover");
  assert.equal(sharedFinalClosingRecoveryPlan(takeover.state, "tab-b").resumeDispatch, true);

  assert.equal(
    advanceSharedFinalClosingRuntime(
      storage,
      "conversation-resume",
      "tab-b",
      "DISPATCH_RESERVED",
      takeover.state.updatedAt + 1,
    ).advanced,
    true,
  );
  const dispatchReserved = readSharedFinalClosingRuntime(storage, "conversation-resume");
  assert.equal(sharedFinalClosingDispatchMayResume(dispatchReserved), false);
  assert.equal(
    sharedFinalClosingRecoveryPlan(dispatchReserved, "tab-b").failClosedProviderEnd,
    true,
  );
});

test("the browser closing lock serializes simultaneous tab reservations", async () => {
  const storage = memoryStorage();
  let queue = Promise.resolve();
  let active = 0;
  let maximumActive = 0;
  const manager = {
    request(_name, _options, callback) {
      const result = queue.then(async () => {
        active += 1;
        maximumActive = Math.max(maximumActive, active);
        await Promise.resolve();
        const value = await callback({ name: "synthetic-lock" });
        active -= 1;
        return value;
      });
      queue = result.then(() => undefined, () => undefined);
      return result;
    },
  };
  const results = await Promise.all([
    withFinalClosingRuntimeLock(manager, "conversation-locked", () =>
      claimSharedFinalClosingRuntime(storage, "conversation-locked", "tab-a", 100)),
    withFinalClosingRuntimeLock(manager, "conversation-locked", () =>
      claimSharedFinalClosingRuntime(storage, "conversation-locked", "tab-b", 100)),
  ]);
  assert.equal(maximumActive, 1);
  assert.equal(results[0].acquired, true);
  assert.equal(results[0].value.owned, true);
  assert.equal(results[1].acquired, true);
  assert.equal(results[1].value.owned, false);
  assert.equal(results[1].value.reason, "owned_by_other_tab");
  assert.deepEqual(
    await withFinalClosingRuntimeLock(null, "conversation-locked", () => "unsafe"),
    { acquired: false, value: null },
  );
});

test("shared farewell deadlines survive later phases and cannot extend on remount", () => {
  const storage = memoryStorage();
  claimSharedFinalClosingRuntime(storage, "conversation-deadline", "tab-a", 100);
  advanceSharedFinalClosingRuntime(
    storage,
    "conversation-deadline",
    "tab-a",
    "CANDIDATE_AUDIO_REQUESTED",
    110,
  );
  advanceSharedFinalClosingRuntime(
    storage,
    "conversation-deadline",
    "tab-a",
    "ECHO_DISPATCHED",
    200,
  );
  const dispatched = readSharedFinalClosingRuntime(storage, "conversation-deadline");
  assert.equal(dispatched.farewellStartDeadlineAt, 5_200);
  assert.equal(dispatched.farewellCompletionDeadlineAt, 12_200);
  assert.ok(dispatched.leaseExpiresAt > dispatched.farewellCompletionDeadlineAt);
  assert.equal(finalClosingGraceDelayMs(dispatched, 200), 12_000);
  assert.equal(finalClosingGraceDelayMs(dispatched, 12_199), 1);
  assert.equal(finalClosingGraceDelayMs(dispatched, 12_200), 0);
  assert.equal(finalClosingGraceDelayMs(dispatched, 13_000), 0);
  assert.equal(finalClosingGraceDelayMs(null, 200), null);
  advanceSharedFinalClosingRuntime(
    storage,
    "conversation-deadline",
    "tab-a",
    "FAREWELL_AUDIBLE",
    2_500,
  );
  const audible = readSharedFinalClosingRuntime(storage, "conversation-deadline");
  assert.equal(audible.farewellStartDeadlineAt, 5_200);
  assert.equal(audible.farewellCompletionDeadlineAt, 12_200);
});

test("ambiguous shared state fails closed and never grants ownership", () => {
  const storage = memoryStorage();
  storage.setItem(finalClosingSharedStorageKey("conversation-a"), "{malformed");
  assert.equal(readSharedFinalClosingRuntime(storage, "conversation-a"), null);
  const claim = claimSharedFinalClosingRuntime(storage, "conversation-a", "tab-a");
  assert.equal(claim.owned, false);
  assert.equal(claim.reason, "ambiguous_shared_state");
});

test("remote PAL audio is muted before the single owner dispatches the direct Echo", () => {
  const element = mediaElement();
  const result = attachRemotePalAudioTrack(element, { kind: "audio" }, true);
  assert.equal(result, "muted_detached");
  assert.equal(element.muted, true);
  assert.equal(element.volume, 0);
  assert.equal(element.srcObject, null);
  assert.equal(element.paused, true);
});

test("remote PAL audio is attached before closing or after the owner has dispatched the direct Echo", () => {
  const ordinary = mediaElement();
  assert.equal(attachRemotePalAudioTrack(ordinary, { kind: "audio" }, false), "attached");
  assert.equal(ordinary.muted, false);
  assert.equal(ordinary.volume, 1);

  const farewell = mediaElement();
  assert.equal(attachRemotePalAudioTrack(farewell, { kind: "audio" }, true, true), "attached");
  assert.equal(farewell.muted, false);
  assert.equal(farewell.volume, 1);

  const recreated = mediaElement();
  assert.equal(attachRemotePalAudioTrack(recreated, { kind: "audio" }, true, false), "muted_detached");
  assert.equal(recreated.muted, true);
  assert.equal(recreated.srcObject, null);
});

test("candidate audio unpublish terminally discards the Daily track", () => {
  const calls = [];
  const result = requestCandidateAudioUnpublish({
    setLocalAudio(enabled, options) {
      calls.push([enabled, options]);
      return this;
    },
  });
  assert.equal(result, "requested");
  assert.deepEqual(calls, [[false, { forceDiscardTrack: true }]]);
  assert.equal(requestCandidateAudioUnpublish({}), "unsupported");
  assert.equal(requestCandidateAudioUnpublish({
    setLocalAudio() { throw new Error("synthetic"); },
  }), "failed");
});

test("runtime makes candidate unpublish best effort and gates PAL audio before interrupt and Echo", async () => {
  const source = await readFile(sourcePath, "utf8");
  const begin = source.slice(source.indexOf("const beginAvatarClosing"));
  const dispatch = source.slice(
    source.indexOf("const dispatchTerminalClosing"),
    source.indexOf("const beginAvatarClosing"),
  );
  const unpublish = begin.indexOf("requestCandidateAudioUnpublish(call)");
  const mute = begin.indexOf("suppressRemotePalAudio(remoteAudioRef.current)");
  const dispatchCall = begin.indexOf("dispatchTerminalClosingWhenReady(nextState, conversationId)");
  const interrupt = dispatch.indexOf("buildReplicaInterruptMessage");
  const echo = dispatch.indexOf("buildFinalClosingAnnouncementMessage", interrupt);
  assert.ok(unpublish >= 0);
  assert.ok(mute > unpublish);
  assert.ok(dispatchCall > mute);
  assert.ok(interrupt >= 0);
  assert.ok(echo > interrupt);
  assert.match(
    source,
    /avatarClosingActiveRef\.current\s*&&\s*!candidateAudioUnpublishRequestedRef\.current[\s\S]{0,300}requestCandidateAudioUnpublish\(callRef\.current\)/,
    "a reconstructed terminal Daily runtime must reassert audio discard once",
  );
  assert.doesNotMatch(begin, /await confirmCandidateAudioPublicationDisabled/);
  assert.doesNotMatch(source, /FINAL_CLOSING_INTERRUPT_SETTLE_MS/);
  assert.match(source, /end-conversation[\s\S]{0,700}keepalive:\s*true/);
  assert.match(source, /rearmCompletionFallback\) armClosingFallbacks\(\)/);
  const coordination = begin.indexOf("withFinalClosingRuntimeLock(");
  const sharedClaim = begin.indexOf("claimSharedFinalClosingRuntime(", coordination);
  const coordinatedDispatch = begin.indexOf("dispatchTerminalClosingWhenReady(nextState, conversationId)", sharedClaim);
  assert.ok(coordination >= 0, "closing must enter the exclusive browser lock");
  assert.ok(sharedClaim > coordination, "shared ownership must be claimed inside the browser lock");
  assert.ok(coordinatedDispatch > sharedClaim, "provider dispatch must remain inside the browser lock");
  assert.match(
    source,
    /if \(!avatarClosingOwnedRef\.current\) \{[\s\S]{0,180}suppressRemotePalAudio\(remoteAudioRef\.current\)/,
    "a secondary tab must never expose the correlated farewell audio",
  );
});

test("post-zero provider speech is diagnostic-only while ordinary turns are blocked", async () => {
  const source = await readFile(sourcePath, "utf8");
  const closingComment = source.indexOf("Closing blocks ordinary turn-taking");
  const closingBranchStart = source.indexOf("if (avatarClosingActiveRef.current)", closingComment);
  const ordinaryBranchStart = source.indexOf("const speech =", closingBranchStart);
  const closingBranch = source.slice(closingBranchStart, ordinaryBranchStart);
  assert.ok(closingBranchStart >= 0);
  assert.ok(ordinaryBranchStart > closingBranchStart);
  assert.doesNotMatch(closingBranch, /recordClosingEchoSpeechEvent/);
  assert.doesNotMatch(closingBranch, /finishAvatarClosingSpeech/);
  assert.doesNotMatch(closingBranch, /requestClosingProviderEnd/);
  assert.match(closingBranch, /!closingEchoDispatchRequestedRef\.current/);
  assert.doesNotMatch(source, /register\("app-message"[\s\S]{0,500}if \(avatarClosingActiveRef\.current\) return;/);
  assert.match(
    source,
    /progressWatchdogTimer = window\.setInterval[\s\S]{0,450}avatarClosingActiveRef\.current[\s\S]{0,120}stopProgressWatchdog\(\)/,
  );
});

test("single-flight closing clears both pre-Echo drain timers", async () => {
  const source = await readFile(sourcePath, "utf8");
  const start = source.indexOf("const clearAutoEndTimers = useCallback");
  const end = source.indexOf("const persistBoundaryState", start);
  const cleanup = source.slice(start, end);
  assert.match(cleanup, /closingDrainTimerRef\.current/);
  assert.match(cleanup, /closingEchoGapTimerRef\.current/);
  assert.match(cleanup, /window\.clearTimeout\(closingDrainTimerRef\.current\)/);
  assert.match(cleanup, /window\.clearTimeout\(closingEchoGapTimerRef\.current\)/);
});
