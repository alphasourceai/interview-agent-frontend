import assert from "node:assert/strict";
import { after, test } from "node:test";
import { access, readFile } from "node:fs/promises";
import { constants } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const testDirectory = dirname(fileURLToPath(import.meta.url));
const websiteRoot = join(testDirectory, "..", "..");
const pageSourcePath = join(testDirectory, "InterviewCviPage.tsx");
const startSourcePath = join(testDirectory, "InterviewPage.tsx");
const helperPath = join(websiteRoot, "src", "lib", "interviewLocalClosingAudio.ts");
const assetPath = join(websiteRoot, "public", "media", "interview-closing-final.mp3");

process.env.PORT ||= "4187";
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

test("candidate publication terminally discards the track", () => {
  const calls = [];
  const result = runtime.requestCandidateAudioUnpublish({
    setLocalAudio(enabled, options) {
      calls.push([enabled, options]);
      return this;
    },
  });
  assert.equal(result, "requested");
  assert.deepEqual(calls, [[false, { forceDiscardTrack: true }]]);
});

test("candidate publication confirmation waits for Daily to report audio off", async () => {
  const calls = [];
  const handlers = new Map();
  const local = {
    local: true,
    tracks: { audio: { state: "sendable" } },
  };
  const call = {
    setLocalAudio(enabled, options) {
      calls.push([enabled, options]);
      return this;
    },
    participants() { return { local }; },
    on(event, handler) { handlers.set(event, handler); },
    off(event, handler) {
      if (handlers.get(event) === handler) handlers.delete(event);
    },
  };

  const pending = runtime.confirmCandidateAudioPublicationDisabled(call, {
    timeoutMs: 100,
    pollIntervalMs: 50,
    allowRetry: false,
  });
  assert.deepEqual(calls, [[false, { forceDiscardTrack: true }]]);
  local.tracks.audio.state = "off";
  handlers.get("participant-updated")?.({ participant: local });
  const result = await pending;
  assert.equal(result.category, "confirmed_disabled");
  assert.equal(result.confirmationSource, "participant_updated");
  assert.equal(handlers.size, 0);
});

test("candidate publication confirmation fails closed while audio remains enabled", async () => {
  const calls = [];
  const handlers = new Map();
  const local = {
    local: true,
    tracks: { audio: { state: "sendable" } },
  };
  const result = await runtime.confirmCandidateAudioPublicationDisabled({
    setLocalAudio(enabled, options) {
      calls.push([enabled, options]);
      return this;
    },
    participants() { return { local }; },
    on(event, handler) { handlers.set(event, handler); },
    off(event, handler) {
      if (handlers.get(event) === handler) handlers.delete(event);
    },
  }, {
    timeoutMs: 5,
    pollIntervalMs: 2,
    allowRetry: false,
  });
  assert.equal(result.category, "definite_failure");
  assert.equal(result.publicationEnabled, true);
  assert.deepEqual(calls, [[false, { forceDiscardTrack: true }]]);
  assert.equal(handlers.size, 0);
});

test("Start Interview no longer primes or persists local farewell audio", async () => {
  const source = await readFile(startSourcePath, "utf8");
  assert.doesNotMatch(source, /interviewLocalClosingAudio/);
  assert.doesNotMatch(source, /preloadLocalClosingAudio/);
  assert.doesNotMatch(source, /primeLocalClosingAudio/);
  assert.doesNotMatch(source, /local_closing_audio_prime_result/);
  await assert.rejects(access(helperPath, constants.F_OK));
  await assert.rejects(access(assetPath, constants.F_OK));
});

test("the live page makes candidate audio best effort and gates PAL audio until farewell correlation", async () => {
  const source = await readFile(pageSourcePath, "utf8");
  assert.match(source, /remoteAudioRef/);
  const begin = source.slice(source.indexOf("const beginAvatarClosing"));
  assert.match(begin, /requestCandidateAudioUnpublish\(call\)/);
  assert.match(begin, /suppressRemotePalAudio\(remoteAudioRef\.current\)/);
  assert.doesNotMatch(begin, /await confirmCandidateAudioPublicationDisabled/);
  assert.match(source, /farewellAudioAudibleRef\.current = true;[\s\S]{0,120}syncParticipantsWithDiagnostics/);
  assert.doesNotMatch(source, /playLocalClosingAudioOnce/);
});
