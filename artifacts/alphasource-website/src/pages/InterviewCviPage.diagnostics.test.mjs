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

const {
  attachRemoteVideoTrack,
  classifyRemoteVideoAttachment,
  deriveMissingProgressReason,
  deriveRemoteDiagnosticEvents,
  deriveStartupReadiness,
  deriveTrackStateTransition,
  normalizeDailyReceiveSettings,
  readDailyReceiveSettingsSnapshot,
  snapshotRemoteParticipants,
  transitionStartupReadiness,
} = module;

const originalMediaStream = globalThis.MediaStream;
class FakeMediaStream {
  constructor(tracks = []) { this.tracks = tracks; }
  getTracks() { return this.tracks; }
}
globalThis.MediaStream = FakeMediaStream;
after(() => { globalThis.MediaStream = originalMediaStream; });

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

test("startup readiness distinguishes absent, audio-only, loading, playable, and progress states", () => {
  const noRemote = snapshotRemoteParticipants([]);
  const audioOnly = snapshotRemoteParticipants([{ local: false, tracks: { audio: { state: "playable", subscribed: true, track: { readyState: "live" } } } }]);
  const loadingVideo = snapshotRemoteParticipants([{ local: false, tracks: {
    audio: { state: "playable", subscribed: true, track: { readyState: "live" } },
    video: { state: "loading", subscribed: "staged", persistentTrack: { readyState: "live" } },
  } }]);
  const playableVideo = snapshotRemoteParticipants([{ local: false, tracks: {
    audio: { state: "playable", subscribed: true, track: { readyState: "live" } },
    video: { state: "playable", subscribed: true, track: { readyState: "live" } },
  } }]);

  assert.equal(deriveStartupReadiness(noRemote, false, false), "waiting_for_remote_participant");
  assert.equal(deriveStartupReadiness(audioOnly, false, false), "remote_participant_audio_only");
  assert.equal(deriveStartupReadiness(loadingVideo, false, false), "remote_video_loading");
  assert.equal(deriveStartupReadiness(playableVideo, false, false), "remote_video_playable");
  assert.equal(deriveStartupReadiness(audioOnly, true, false), "replica_progress_confirmed");
});

test("startup failure is terminal until an explicit new-conversation reset", () => {
  assert.equal(transitionStartupReadiness("remote_video_playable", "startup_recovering", false), "startup_recovering");
  assert.equal(transitionStartupReadiness("startup_recovering", "replica_progress_confirmed", false), "replica_progress_confirmed");
  const failed = transitionStartupReadiness("startup_recovering", "startup_failed", false);
  assert.equal(failed, "startup_failed");
  assert.equal(transitionStartupReadiness("remote_video_playable", "startup_failed", false), "startup_failed");
  assert.equal(transitionStartupReadiness(failed, "remote_video_playable", false), "startup_failed");
  assert.equal(transitionStartupReadiness(failed, "waiting_for_remote_participant", true), "waiting_for_remote_participant");
});

test("participant snapshots and track transitions are bounded, identity-free, and stateful", () => {
  const track = { readyState: "live", id: "SECRET_TRACK_ID" };
  const snapshot = snapshotRemoteParticipants([{ local: false, session_id: "SECRET_PARTICIPANT_ID", tracks: {
    audio: { state: "playable", subscribed: true, persistentTrack: track },
    video: { state: "loading", subscribed: "staged", persistentTrack: track },
  } }]);
  assert.deepEqual(snapshot, {
    remotePresent: true,
    remoteAudioReady: true,
    remoteVideoReady: false,
    remoteParticipantCount: 1,
    remoteParticipantCountBucket: "one",
    audioState: "playable",
    videoState: "loading",
    audioPersistentTrackPresent: true,
    videoPersistentTrackPresent: true,
    audioSubscriptionState: "subscribed",
    videoSubscriptionState: "staged",
    audioTrackPresent: true,
    videoTrackPresent: true,
  });
  assert.equal(JSON.stringify(snapshot).includes("SECRET_"), false);

  assert.deepEqual(
    deriveTrackStateTransition("video", "loading", "playable", snapshot, "participant_updated", "under_15_seconds", "remote_video_playable", "idle"),
    {
      event: "daily_remote_track_state_changed",
      metadata: {
        track_kind: "video",
        previous_track_state: "loading",
        next_track_state: "playable",
        track_present: true,
        persistent_track_present: true,
        subscription_state: "staged",
        startup_readiness_state: "remote_video_playable",
        reconnect_phase: "idle",
        elapsed_since_join_bucket: "under_15_seconds",
        transition_source: "participant_updated",
      },
    },
  );
});

test("participant count buckets and normalized Daily states cover absence, multiplicity, interruption, and blocking", () => {
  assert.equal(snapshotRemoteParticipants([]).remoteParticipantCountBucket, "zero");
  assert.equal(snapshotRemoteParticipants([{ local: false }]).remoteParticipantCountBucket, "one");
  assert.equal(snapshotRemoteParticipants([{ local: false }, { local: false }]).remoteParticipantCountBucket, "multiple");
  assert.equal(snapshotRemoteParticipants([{ local: false, tracks: { video: { state: "blocked" } } }]).videoState, "blocked");
  assert.equal(snapshotRemoteParticipants([{ local: false, tracks: { video: { state: "interrupted" } } }]).videoState, "interrupted");
  assert.equal(snapshotRemoteParticipants([{ local: false, tracks: { video: { state: "playable" } } }]).videoState, "unavailable");
});

test("receive settings resolve the async Daily contract and exclude raw objects", async () => {
  assert.deepEqual(normalizeDailyReceiveSettings(undefined, false), {
    audio_receive_state: "automatic",
    video_receive_state: "automatic",
    settings_source: "inherited_default",
    reconnect_active: false,
  });
  assert.deepEqual(normalizeDailyReceiveSettings({ base: { audio: "off", video: "full" } }, true, true), {
    audio_receive_state: "off",
    video_receive_state: "full",
    settings_source: "explicit",
    reconnect_active: true,
  });
  assert.deepEqual(await readDailyReceiveSettingsSnapshot({
    async getReceiveSettings() {
      return { base: { video: { layer: 2 } }, SECRET_PARTICIPANT_ID: { video: { layer: 0 } } };
    },
  }, false), {
    audio_receive_state: "automatic",
    video_receive_state: "full",
    settings_source: "inherited_default",
    reconnect_active: false,
  });
  assert.deepEqual(await readDailyReceiveSettingsSnapshot({
    async getReceiveSettings() { throw new Error("SECRET_RECEIVE_SETTINGS_ERROR"); },
  }, true), {
    audio_receive_state: "unavailable",
    video_receive_state: "unavailable",
    settings_source: "unavailable",
    reconnect_active: true,
  });
  assert.equal(classifyRemoteVideoAttachment({ name: "NotAllowedError", message: "SECRET" }), "play_rejected_policy");
  assert.equal(classifyRemoteVideoAttachment({ name: "NotSupportedError", message: "SECRET" }), "play_rejected_media");
  assert.equal(classifyRemoteVideoAttachment({ name: "SomethingElse", message: "SECRET" }), "play_rejected_unknown");
  assert.equal(JSON.stringify(classifyRemoteVideoAttachment({ name: "SomethingElse", message: "SECRET" })).includes("SECRET"), false);
});

test("remote video attachment records attach, play, replacement, no-track, and bounded rejection outcomes", async () => {
  const firstTrack = { readyState: "live" };
  const secondTrack = { readyState: "live" };
  const element = {
    srcObject: null,
    readyState: 0,
    clientWidth: 640,
    clientHeight: 360,
    hidden: false,
    async play() {},
  };
  assert.deepEqual(await attachRemoteVideoTrack(element, null, "loading", false), ["track_loading"]);
  assert.deepEqual(await attachRemoteVideoTrack(element, firstTrack, "playable", false), ["src_object_attached", "play_resolved"]);
  assert.deepEqual(await attachRemoteVideoTrack(element, secondTrack, "playable", true), ["replaced_after_reconnect", "play_resolved"]);
  element.play = async () => { const error = new Error("SECRET_PLAYBACK_MARKER"); error.name = "NotAllowedError"; throw error; };
  const rejected = await attachRemoteVideoTrack(element, secondTrack, "playable", false);
  assert.deepEqual(rejected, ["play_rejected_policy"]);
  assert.equal(JSON.stringify(rejected).includes("SECRET_"), false);

  const attachmentRejected = {
    get srcObject() { return null; },
    set srcObject(_value) { throw new Error("SECRET_ATTACHMENT_MARKER"); },
    async play() {},
  };
  const bounded = await attachRemoteVideoTrack(attachmentRejected, firstTrack, "playable", false);
  assert.deepEqual(bounded, ["element_not_ready"]);
  assert.equal(JSON.stringify(bounded).includes("SECRET_"), false);
});

test("watchdog missing-progress reason is precise and bounded", () => {
  assert.equal(deriveMissingProgressReason(snapshotRemoteParticipants([]), "no_track"), "no_remote_participant");
  assert.equal(deriveMissingProgressReason(snapshotRemoteParticipants([{ local: false, tracks: { audio: { state: "playable", track: { readyState: "live" } } } }]), "no_track"), "audio_only");
  assert.equal(deriveMissingProgressReason(snapshotRemoteParticipants([{ local: false, tracks: { video: { state: "loading", track: { readyState: "live" } } } }]), "track_loading"), "multiple_conditions");
});

test("runtime source persists transition-only diagnostics and bounded reconnect continuity without identifiers", async () => {
  const source = await readFile(sourcePath, "utf8");
  assert.match(source, /remoteSnapshotSignatureRef\.current !== snapshotSignature/);
  assert.match(source, /reconnectBindingSignaturesRef\.current\[phase\] === signature/);
  assert.match(source, /previousRemoteParticipantRef\.current === remoteParticipant/);
  assert.match(source, /previous === current \? "retained" : "replaced"/);
  assert.match(source, /register\("receive-settings-updated"/);
  const reconnectStart = source.indexOf('sendLifecycleTelemetry("reconnect_media_binding_snapshot"');
  const reconnectEnd = source.indexOf('previousRemoteParticipantRef.current = remoteParticipant', reconnectStart);
  const reconnectTelemetry = source.slice(reconnectStart, reconnectEnd);
  assert.doesNotMatch(reconnectTelemetry, /session_id|participant_id|track_id|conversation_id|room_url/);
});

test("startup and recovery observability preserves the established bounded timing contract", async () => {
  const source = await readFile(sourcePath, "utf8");
  assert.match(source, /const STARTUP_REMOTE_TIMEOUT_MS = 12000;/);
  assert.match(source, /const PROGRESS_STALL_MS = 45000;/);
  assert.match(source, /const PROGRESS_WATCHDOG_INTERVAL_MS = 5000;/);
  assert.match(source, /const RECOVERY_PROGRESS_TIMEOUT_MS = 30000;/);
  assert.equal(source.match(/startupRecoveryAttemptedRef\.current = true;/g)?.length, 1);
  assert.equal(source.match(/startupRecoveryAttemptedRef\.current = false;/g)?.length, 1);
});

test("successful startup reconnect exits recovery before rediscovering playable media", async () => {
  const source = await readFile(sourcePath, "utf8");
  const watchdogStart = source.indexOf("const beginStartupWatchdog");
  const watchdogEnd = source.indexOf("const stopProgressWatchdog", watchdogStart);
  assert.ok(watchdogStart > 0 && watchdogEnd > watchdogStart);
  const watchdogSource = source.slice(watchdogStart, watchdogEnd);
  const rejoin = watchdogSource.indexOf("await call.join");
  const recoveryExit = watchdogSource.indexOf("reconnectingRef.current = false", rejoin);
  const rediscovery = watchdogSource.indexOf("syncParticipantsWithDiagnostics", rejoin);
  assert.ok(rejoin >= 0 && recoveryExit > rejoin && rediscovery > recoveryExit);
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
