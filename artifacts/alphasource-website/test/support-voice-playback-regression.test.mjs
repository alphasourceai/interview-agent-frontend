import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => fs.readFileSync(path.join(ROOT, relativePath), "utf8");
const bundled = await build({
  entryPoints: [path.join(ROOT, "src/lib/supportVoicePlaybackQueue.ts")],
  bundle: true,
  format: "esm",
  platform: "node",
  write: false,
});
const playback = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString("base64")}`);

test("bursty provider audio is not treated as fatal merely because 12 sources are scheduled", () => {
  const voice = read("src/components/SupportVoicePopover.tsx");
  assert.doesNotMatch(voice, /scheduledRef\.current\.size\s*>=\s*12/);
  assert.match(voice, /scheduledRef\.current\.size < SUPPORT_VOICE_PLAYBACK_LOOKAHEAD_SOURCES/);
});

test("bursty small deltas remain queued and drain without an arbitrary source-count failure", () => {
  const queue = new playback.SupportVoicePlaybackQueue();
  const chunks = Array.from({ length: 400 }, () => new Int16Array(240));
  for (const chunk of chunks) assert.equal(queue.enqueue(chunk), "queued");
  assert.equal(queue.pendingCount, 400);
  assert.equal(queue.queuedBytes, 400 * 240 * 2);
  let drained = 0;
  for (let chunk = queue.take(); chunk; chunk = queue.take()) {
    drained += 1;
    queue.release(chunk.byteLength);
    chunk.fill(0);
  }
  assert.equal(drained, 400);
  assert.equal(queue.queuedBytes, 0);
});

test("long multi-sentence audio remains inside a bounded queue", () => {
  const queue = new playback.SupportVoicePlaybackQueue();
  const oneSecond = new Int16Array(24_000);
  for (let second = 0; second < 60; second += 1) assert.equal(queue.enqueue(oneSecond.slice()), "queued");
  assert.equal(queue.queuedBytes, 60 * 24_000 * 2);
  assert.ok(queue.queuedBytes < playback.SUPPORT_VOICE_PLAYBACK_MAX_BYTES);
  queue.clear();
  assert.equal(queue.queuedBytes, 0);
});

test("the bounded queue covers ten minutes of 24 kHz mono PCM16 without truncation", () => {
  const queue = new playback.SupportVoicePlaybackQueue();
  const fiveSeconds = new Int16Array(5 * 24_000);
  for (let chunk = 0; chunk < 120; chunk += 1) assert.equal(queue.enqueue(fiveSeconds.slice()), "queued");
  assert.equal(queue.queuedBytes, 10 * 60 * 24_000 * 2);
  assert.equal(playback.SUPPORT_VOICE_PLAYBACK_MAX_BYTES, 32 * 1024 * 1024);
  assert.ok(queue.queuedBytes < playback.SUPPORT_VOICE_PLAYBACK_MAX_BYTES);
  queue.clear();
});

test("playback windows remain gapless across a long answer", () => {
  let next = 0;
  for (let index = 0; index < 400; index += 1) {
    const window = playback.nextSupportVoicePlaybackWindow(1, next, 0.05);
    assert.ok(window);
    if (index > 0) assert.equal(window.startsAt, next);
    next = window.endsAt;
  }
  assert.ok(next > 20);
});

test("byte pressure is soft and leaves existing queued audio intact", () => {
  const queue = new playback.SupportVoicePlaybackQueue();
  const half = new Int16Array(playback.SUPPORT_VOICE_PLAYBACK_MAX_BYTES / 4);
  assert.equal(queue.enqueue(half), "queued");
  assert.equal(queue.enqueue(half.slice()), "queued");
  const bytesBeforePressure = queue.queuedBytes;
  assert.equal(queue.enqueue(new Int16Array(1)), "pressure");
  assert.equal(queue.queuedBytes, bytesBeforePressure);
  assert.equal(queue.pendingCount, 2);
  queue.clear();
});

test("tiny-delta overhead is bounded without making pressure terminal", () => {
  const queue = new playback.SupportVoicePlaybackQueue();
  for (let index = 0; index < playback.SUPPORT_VOICE_PLAYBACK_MAX_PENDING_CHUNKS; index += 1) {
    assert.equal(queue.enqueue(new Int16Array(1)), "queued");
  }
  assert.equal(queue.enqueue(new Int16Array(1)), "pressure");
  assert.equal(queue.pendingCount, playback.SUPPORT_VOICE_PLAYBACK_MAX_PENDING_CHUNKS);
  queue.clear();
});

test("ending remains user-controlled or server-controlled and close reasons are bounded enums", () => {
  const voice = read("src/components/SupportVoicePopover.tsx");
  assert.match(voice, /endConversation\("ended", "user_end"\)/);
  assert.match(voice, /endConversation\("ended", "server_ended"\)/);
  assert.match(voice, /two minutes without voice activity/);
  assert.match(voice, /Ends after two minutes without voice activity, or when you choose End\./);
  assert.doesNotMatch(voice, /socket\.close\([^)]*,\s*(?:event|decoded|message|encoded|audio)/);
  assert.doesNotMatch(voice, /console\.(?:log|warn|error)\([^)]*(?:encoded|samples|audio|transcript)/);
  assert.match(voice, /socket\.addEventListener\("error", \(\) => \{\s*credential = "";\s*\}, \{ once: true \}\);/);
});

test("assistant playback owns the microphone and speaking state until the queue drains", () => {
  const voice = read("src/components/SupportVoicePopover.tsx");
  assert.match(voice, /assistantPlaybackActiveRef\.current/);
  assert.match(voice, /assistantPlaybackActiveRef\.current\s*=\s*true/);
  assert.match(voice, /assistantPlaybackActiveRef\.current\s*\|\|\s*socket\.readyState\s*!==\s*WebSocket\.OPEN/);
  assert.match(voice, /playbackQueueRef\.current\.pendingCount\s*===\s*0/);
  assert.match(voice, /scheduledRef\.current\.size\s*===\s*0/);
});
