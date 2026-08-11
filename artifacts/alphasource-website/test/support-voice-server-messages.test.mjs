import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";
import { transform } from "esbuild";

const sourceUrl = new URL("../src/lib/supportVoiceServerMessages.ts", import.meta.url);
const source = await fs.readFile(sourceUrl, "utf8");
const compiled = await transform(source, { format: "esm", loader: "ts", target: "es2022" });
const protocol = await import(`data:text/javascript;base64,${Buffer.from(compiled.code).toString("base64")}`);

test("listening false is a valid connected-state transition rather than a terminal error", () => {
  const message = protocol.parseSupportVoiceServerMessage({ type: "listening", active: false });
  assert.deepEqual(message, { type: "listening", active: false });
  assert.equal(protocol.nextSupportVoiceState("listening", message, false), "listening");
  assert.equal(protocol.nextSupportVoiceState("muted", message, true), "muted");
});

test("normal ready, speech, reply, and playback sequence stays open", () => {
  const rawSequence = [
    { type: "ready" },
    { type: "listening", active: true },
    { type: "listening", active: false },
    { type: "speaking", active: true },
    { type: "audio_delta", audio: "AAA=" },
    { type: "speaking", active: false },
  ];
  let state = "connecting";
  for (const raw of rawSequence) {
    const message = protocol.parseSupportVoiceServerMessage(raw);
    assert.ok(message, `message must be accepted: ${raw.type}`);
    state = protocol.nextSupportVoiceState(state, message, false);
    assert.notEqual(state, "error");
    assert.notEqual(state, "ended");
  }
  assert.equal(state, "listening");
});

test("server message envelope rejects unknown fields and unsupported terminal codes", () => {
  for (const value of [
    { type: "listening", active: false, transcript: "must not pass" },
    { type: "audio_delta", audio: "AAA=", text: "must not pass" },
    { type: "ended", reason: "unknown" },
    { type: "error", code: "provider_detail" },
  ]) assert.equal(protocol.parseSupportVoiceServerMessage(value), null);
});

test("a WebSocket error prelude cannot overwrite an intentional or clean server end", () => {
  assert.equal(protocol.nextSupportVoiceStateAfterClose("ended", 1006, ""), "ended");
  assert.equal(protocol.nextSupportVoiceStateAfterClose("listening", 1000, "ended"), "ended");
  assert.equal(protocol.nextSupportVoiceStateAfterClose("listening", 1000, "server_ended"), "ended");
  assert.equal(protocol.nextSupportVoiceStateAfterClose("listening", 1000, "user_end"), "ended");
  assert.equal(protocol.nextSupportVoiceStateAfterClose("listening", 1006, ""), "error");
  assert.equal(protocol.nextSupportVoiceStateAfterClose("listening", 1000, "arbitrary"), "error");
});
