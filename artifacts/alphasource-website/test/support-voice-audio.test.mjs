import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";
import { transform } from "esbuild";

const sourceUrl = new URL("../src/lib/supportVoiceAudio.ts", import.meta.url);
const source = await fs.readFile(sourceUrl, "utf8");
const compiled = await transform(source, { format: "esm", loader: "ts", target: "es2022" });
const audio = await import(`data:text/javascript;base64,${Buffer.from(compiled.code).toString("base64")}`);

globalThis.btoa ||= (value) => Buffer.from(value, "binary").toString("base64");
globalThis.atob ||= (value) => Buffer.from(value, "base64").toString("binary");

test("44.1 kHz and 48 kHz capture resample deterministically to 24 kHz PCM16", () => {
  const from48 = audio.resampleToPcm16(new Float32Array(480).fill(0.5), 48_000);
  const from441 = audio.resampleToPcm16(new Float32Array(441).fill(-0.5), 44_100);
  assert.equal(from48.length, 240);
  assert.equal(from441.length, 240);
  assert.equal(from48[0], 16_384);
  assert.equal(from441[0], -16_384);
});

test("PCM16 uses canonical standard padded base64 for every padding class", () => {
  const onePad = audio.pcm16ToStandardBase64(new Int16Array([0]));
  const twoPads = audio.pcm16ToStandardBase64(new Int16Array([0, 0]));
  const noPad = audio.pcm16ToStandardBase64(new Int16Array([0, 0, 0]));
  assert.equal(onePad, "AAA=");
  assert.equal(twoPads, "AAAAAA==");
  assert.equal(noPad, "AAAAAAAA");
  assert.deepEqual([...audio.standardBase64ToPcm16(onePad)], [0]);
  assert.deepEqual([...audio.standardBase64ToPcm16(twoPads)], [0, 0]);
  assert.deepEqual([...audio.standardBase64ToPcm16(noPad)], [0, 0, 0]);
});

test("alternate, whitespace, malformed, odd, empty, and oversize audio encodings fail closed", () => {
  for (const value of ["", "AAA", "AA-A", "AA_A", " AAA=", "AAA=\n", "A===", "AAAA=", "////_"]) {
    assert.equal(audio.standardBase64ToPcm16(value), null);
  }
  assert.equal(audio.standardBase64ToPcm16(Buffer.from([0]).toString("base64")), null);
  assert.equal(audio.standardBase64ToPcm16(Buffer.alloc(256 * 1024 + 2).toString("base64")), null);
});
