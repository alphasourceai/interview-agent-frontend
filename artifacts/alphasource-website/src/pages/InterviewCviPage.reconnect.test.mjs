import assert from "node:assert/strict";
import { after, test } from "node:test";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const testDirectory = dirname(fileURLToPath(import.meta.url));
const websiteRoot = join(testDirectory, "..", "..");
const sourcePath = join(testDirectory, "InterviewCviPage.tsx");

process.env.PORT ||= "4173";
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
const recovery = await server.ssrLoadModule("/src/pages/InterviewCviPage.tsx");
after(async () => server.close());

const {
  advanceReconnectRecovery: advance,
  createReconnectRecoveryState: createState,
  isReconnectRecoveryActive: isActive,
  reconnectRecoveryNotice: notice,
} = recovery;

function start(at = 1000) {
  return advance(createState(), { type: "start", at });
}

function joinRecovery(state = start(), at = 1100) {
  return advance(state, { type: "local_joined", at });
}

function remote(
  state = joinRecovery(),
  {
    at = 1200,
    remotePresent = true,
    remoteAudioReady = true,
    remoteVideoReady = true,
  } = {},
) {
  return advance(state, {
    type: "remote_state",
    at,
    remotePresent,
    remoteAudioReady,
    remoteVideoReady,
  });
}

function progress(state, source = "replica_utterance", at = 1300) {
  return advance(state, { type: "practical_progress", at, source });
}

test("recovery starts exactly one transport attempt", () => {
  const first = start();
  assert.equal(first.phase, "reconnecting_transport");
  assert.equal(first.attempt, 1);
  assert.strictEqual(advance(first, { type: "start", at: 1001 }), first);
});

test("local join without remote presence does not report success", () => {
  const state = remote(joinRecovery(), {
    remotePresent: false,
    remoteAudioReady: false,
    remoteVideoReady: false,
  });
  assert.equal(state.phase, "awaiting_remote_presence");
  assert.equal(state.progressAt, null);
});

test("remote video alone is not sufficient recovery media", () => {
  const state = remote(joinRecovery(), {
    remoteAudioReady: false,
    remoteVideoReady: true,
  });
  assert.equal(state.phase, "awaiting_remote_media");
  assert.equal(progress(state).phase, "awaiting_remote_media");
});

test("playable remote audio permits waiting for practical progress", () => {
  const state = remote(joinRecovery(), {
    remoteAudioReady: true,
    remoteVideoReady: false,
  });
  assert.equal(state.phase, "awaiting_practical_progress");
  assert.equal(state.remoteAudioReady, true);
});

test("presence and media without progress fail at the deadline", () => {
  const state = remote();
  const failed = advance(state, { type: "deadline", at: 31000 });
  assert.equal(state.phase, "awaiting_practical_progress");
  assert.equal(failed.phase, "failed");
  assert.equal(failed.terminalAt, 31000);
});

test("progress before remote evidence is ignored", () => {
  const state = joinRecovery();
  assert.strictEqual(progress(state, "replica_started_speaking"), state);
});

test("candidate-only activity cannot satisfy recovery", () => {
  const state = remote();
  assert.strictEqual(progress(state, "candidate_utterance"), state);
});

test("first replica progress recovers using the real event clock", () => {
  const state = progress(remote(), "replica_started_speaking", 5678);
  assert.equal(state.phase, "recovered");
  assert.equal(state.progressAt, 5678);
  assert.equal(state.progressSource, "replica_started_speaking");
});

test("success is emitted by the state machine only once", () => {
  const first = progress(remote(), "replica_utterance", 1400);
  const second = progress(first, "replica_started_speaking", 1500);
  assert.strictEqual(second, first);
  assert.equal(second.progressAt, 1400);
});

test("ordinary watchdog remains suspended in every active phase", () => {
  const phases = [
    start(),
    joinRecovery(),
    remote(joinRecovery(), { remoteAudioReady: false }),
    remote(),
  ];
  assert.deepEqual(phases.map(isActive), [true, true, true, true]);
  assert.equal(isActive(progress(phases[3])), false);
});

test("late remote evidence cannot revive a terminal failure", () => {
  const failed = advance(joinRecovery(), { type: "deadline", at: 31000 });
  assert.strictEqual(remote(failed, { at: 32000 }), failed);
});

test("late progress cannot revive a terminal failure", () => {
  const failed = advance(remote(), { type: "deadline", at: 31000 });
  assert.strictEqual(progress(failed, "replica_utterance", 32000), failed);
});

test("a failed recovery cannot start attempt two", () => {
  const failed = advance(joinRecovery(), { type: "join_failed", at: 1500 });
  assert.strictEqual(advance(failed, { type: "start", at: 1600 }), failed);
  assert.equal(failed.attempt, 1);
});

test("candidate messaging reflects transport, waiting, and proven success", () => {
  assert.equal(notice(start()), "Reconnecting to the interview…");
  assert.equal(notice(joinRecovery()), "Reconnected. Waiting for the interviewer to resume…");
  assert.equal(notice(remote()), "Reconnected. Waiting for the interviewer to resume…");
  assert.equal(notice(progress(remote())), "Connection restored.");
});

test("Daily recovery listeners register once and use the shared cleanup", async () => {
  const source = await readFile(sourcePath, "utf8");
  for (const eventName of [
    "joined-meeting",
    "participant-joined",
    "participant-updated",
    "participant-left",
    "track-started",
    "track-stopped",
    "left-meeting",
    "app-message",
  ]) {
    assert.equal(source.split(`register("${eventName}"`).length - 1, 1, eventName);
  }
  assert.match(source, /call\.off\(eventName, handler\)/);
});

test("page wiring removes false success and preserves existing lifecycle paths", async () => {
  const source = await readFile(sourcePath, "utf8");
  assert.doesNotMatch(source, /Connection restored\. The interview is resuming\./);
  assert.doesNotMatch(
    source,
    /await call\.join\([\s\S]{0,500}lastProgressAtRef\.current = Date\.now\(\)/,
  );
  assert.equal(
    source.match(/sendLifecycleTelemetry\(\s*"reconnect_succeeded"/g)?.length || 0,
    1,
  );
  assert.equal(source.split("void endInterview(reason, true)").length - 1, 1);
  assert.match(source, /beginStartupWatchdog\(\)/);
  assert.doesNotMatch(source, /void endInterview\("completed_normally"\)/);
  assert.match(source, /endInterview\("time_limit_avatar_farewell_complete", true\)/);
  assert.doesNotMatch(source, /endInterview\("time_limit_hard_deadline", true\)/);
  assert.match(source, /sharedProviderEndAttemptAllowed/);
  assert.match(source, /sendLifecycleTelemetry\(\s*"browser_closed_or_navigation"/);
  assert.match(source, /clearProgressRecoveryDeadline\(\)/);
});
