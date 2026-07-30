import assert from "node:assert/strict";
import { after, test } from "node:test";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const testDirectory = dirname(fileURLToPath(import.meta.url));
const websiteRoot = join(testDirectory, "..", "..");
const sourcePath = join(testDirectory, "InterviewCviPage.tsx");

process.env.PORT ||= "4174";
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
const module = await server.ssrLoadModule("/src/pages/InterviewCviPage.tsx");
after(async () => server.close());

const { deriveRemoteDiagnosticEvents } = module;

const absent = Object.freeze({
  remotePresent: false,
  remoteAudioReady: false,
  remoteVideoReady: false,
  remoteParticipantCount: 0,
});

const ready = Object.freeze({
  remotePresent: true,
  remoteAudioReady: true,
  remoteVideoReady: true,
  remoteParticipantCount: 1,
});

const idleContext = Object.freeze({
  recoveryActive: false,
  recoveryAttempt: 0,
  recoveryPhase: "idle",
});

const recoveryContext = Object.freeze({
  recoveryActive: true,
  recoveryAttempt: 1,
  recoveryPhase: "awaiting_practical_progress",
});

test("initial mocked Daily remote presence and playable tracks produce bounded evidence", () => {
  const events = deriveRemoteDiagnosticEvents(null, ready, idleContext);
  assert.deepEqual(events.map(({ event }) => event), [
    "daily_participant_joined",
    "daily_remote_track_started",
    "daily_remote_track_started",
  ]);
  assert.deepEqual(events[0].metadata, {
    participant_role: "replica",
    participant_count: 1,
    remote_participant_present: true,
  });
  assert.deepEqual(events.slice(1).map(({ metadata }) => metadata.track_kind), ["audio", "video"]);
});

test("unchanged mocked Daily state emits no duplicate transition", () => {
  assert.deepEqual(deriveRemoteDiagnosticEvents(ready, ready, idleContext), []);
});

test("participant departure and remote track loss are emitted once", () => {
  const events = deriveRemoteDiagnosticEvents(ready, absent, idleContext);
  assert.deepEqual(events.map(({ event }) => event), [
    "daily_participant_left",
    "daily_remote_track_stopped",
    "daily_remote_track_stopped",
  ]);
  assert.deepEqual(events.slice(1).map(({ metadata }) => metadata.track_kind), ["audio", "video"]);
  assert.deepEqual(deriveRemoteDiagnosticEvents(absent, absent, idleContext), []);
});

test("reconnect remote presence, audio readiness, and media state are ordered", () => {
  const events = deriveRemoteDiagnosticEvents(absent, ready, recoveryContext);
  assert.deepEqual(events.map(({ event }) => event), [
    "daily_participant_joined",
    "reconnect_remote_presence",
    "daily_remote_track_started",
    "reconnect_remote_audio_ready",
    "daily_remote_track_started",
    "reconnect_remote_media_changed",
  ]);
  for (const { metadata } of events) {
    assert.equal(metadata.recovery_attempt, 1);
    assert.equal(metadata.is_recovery_active, true);
    assert.equal("message" in metadata, false);
    assert.equal("participant_id" in metadata, false);
  }
});

test("audio-only loss remains distinguishable from participant departure", () => {
  const audioLost = {
    ...ready,
    remoteAudioReady: false,
  };
  const events = deriveRemoteDiagnosticEvents(ready, audioLost, idleContext);
  assert.deepEqual(events.map(({ event }) => event), ["daily_remote_track_stopped"]);
  assert.equal(events[0].metadata.track_kind, "audio");
  assert.equal(events[0].metadata.remote_participant_present, true);
});

test("source records bounded app-message receipt without message content", async () => {
  const source = await readFile(sourcePath, "utf8");
  const start = source.indexOf('sendLifecycleTelemetry("app_message_received"');
  const end = source.indexOf("let recoveryCompleted", start);
  assert.ok(start > 0 && end > start);
  const telemetryCall = source.slice(start, end);
  assert.match(telemetryCall, /progress_source/);
  assert.doesNotMatch(telemetryCall, /\bspeech\b|\btext\b|\bdata\b|\beventType\b/);
});

test("progress and reconnect diagnostics are emitted from the trusted checkpoint path", async () => {
  const source = await readFile(sourcePath, "utf8");
  for (const event of [
    "progress_checkpoint_updated",
    "reconnect_practical_progress",
    "reconnect_succeeded",
  ]) {
    assert.match(source, new RegExp(`sendLifecycleTelemetry\\(\\s*"${event}"`));
  }
  assert.match(source, /recordProgressCheckpoint\(source, progressAt, "reconnect_practical_progress"\)/);
});

test("a second stall records its evaluation before the terminal request", async () => {
  const source = await readFile(sourcePath, "utf8");
  const evaluation = source.indexOf('watchdog_evaluation: "post_recovery_progress_stale"');
  const terminal = source.indexOf('"interview_terminal_requested"');
  assert.ok(evaluation > 0);
  assert.ok(terminal > 0);
  assert.match(source.slice(evaluation, evaluation + 900), /markProgressStalled\("watchdog_timeout"\)/);
});

test("browser online, offline, and visibility listeners are bounded and cleaned up", async () => {
  const source = await readFile(sourcePath, "utf8");
  for (const event of ["browser_online", "browser_offline", "browser_visibility_changed"]) {
    assert.match(source, new RegExp(`sendLifecycleTelemetry\\("${event}"`));
  }
  assert.match(source, /removeEventListener\("online", onOnline\)/);
  assert.match(source, /removeEventListener\("offline", onOffline\)/);
  assert.match(source, /removeEventListener\("visibilitychange", onVisibilityChange\)/);
});

test("telemetry delivery is sequenced, bounded, asynchronous, and best effort", async () => {
  const source = await readFile(sourcePath, "utf8");
  assert.match(source, /MAX_PENDING_TELEMETRY_REQUESTS = 8/);
  assert.match(source, /event_sequence: eventSequence/);
  assert.match(source, /telemetryPendingRef\.current\.size >= pendingLimit/);
  assert.match(source, /\.catch\(\(\) => \{\}\)\.finally/);
  assert.match(source, /keepalive: true/);
  assert.match(source, /Authorization: `AlphaScreen-Telemetry \$\{authorization\}`/);
  const telemetryStart = source.indexOf("const sendLifecycleTelemetry");
  const telemetryEnd = source.indexOf("const sendTimeLimitMessage", telemetryStart);
  const telemetrySource = source.slice(telemetryStart, telemetryEnd);
  const payloadStart = telemetrySource.indexOf("const payload =");
  const payloadEnd = telemetrySource.indexOf("if (!backendBase", payloadStart);
  assert.doesNotMatch(telemetrySource.slice(payloadStart, payloadEnd), /conversation_id|role_token/);
});
