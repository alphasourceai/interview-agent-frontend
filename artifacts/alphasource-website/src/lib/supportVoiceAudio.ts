export const SUPPORT_VOICE_SAMPLE_RATE = 24_000;
export const SUPPORT_VOICE_CHUNK_SAMPLES = 2_400;
export const SUPPORT_VOICE_MAX_AUDIO_BYTES = 32 * 1024;
export const SUPPORT_VOICE_MAX_FRAME_BYTES = 48 * 1024;

export function resampleToPcm16(input: Float32Array, inputRate: number): Int16Array {
  if (!Number.isFinite(inputRate) || inputRate <= 0 || input.length === 0) return new Int16Array(0);
  const outputLength = Math.max(1, Math.floor(input.length * SUPPORT_VOICE_SAMPLE_RATE / inputRate));
  const output = new Int16Array(outputLength);
  const ratio = inputRate / SUPPORT_VOICE_SAMPLE_RATE;
  for (let index = 0; index < outputLength; index += 1) {
    const sourcePosition = index * ratio;
    const leftIndex = Math.min(input.length - 1, Math.floor(sourcePosition));
    const rightIndex = Math.min(input.length - 1, leftIndex + 1);
    const fraction = sourcePosition - leftIndex;
    const sample = Math.max(-1, Math.min(1, input[leftIndex] + (input[rightIndex] - input[leftIndex]) * fraction));
    output[index] = sample < 0 ? Math.round(sample * 0x8000) : Math.round(sample * 0x7fff);
  }
  return output;
}

export function pcm16ToStandardBase64(samples: Int16Array): string {
  const bytes = new Uint8Array(samples.length * 2);
  const view = new DataView(bytes.buffer);
  for (let index = 0; index < samples.length; index += 1) {
    view.setInt16(index * 2, samples[index], true);
  }
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
}

export function standardBase64ToPcm16(value: unknown): Int16Array | null {
  const encoded = typeof value === "string" ? value : "";
  if (!encoded || encoded.length % 4 !== 0 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded)) {
    return null;
  }
  let binary = "";
  try {
    binary = atob(encoded);
  } catch {
    return null;
  }
  if (!binary || binary.length % 2 !== 0 || binary.length > 256 * 1024) return null;
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  if (pcm16ToStandardBase64(new Int16Array(bytes.buffer)) !== encoded) return null;
  const view = new DataView(bytes.buffer);
  const samples = new Int16Array(bytes.length / 2);
  for (let index = 0; index < samples.length; index += 1) samples[index] = view.getInt16(index * 2, true);
  bytes.fill(0);
  return samples;
}
