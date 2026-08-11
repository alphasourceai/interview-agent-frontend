export const SUPPORT_VOICE_PLAYBACK_LOOKAHEAD_SOURCES = 3;
export const SUPPORT_VOICE_PLAYBACK_MAX_BYTES = 32 * 1024 * 1024;
export const SUPPORT_VOICE_PLAYBACK_MAX_PENDING_CHUNKS = 4096;

export type SupportVoicePlaybackAdmission = "queued" | "pressure" | "invalid";

export function nextSupportVoicePlaybackWindow(currentTime: number, nextPlaybackTime: number, duration: number): { startsAt: number; endsAt: number } | null {
  if (![currentTime, nextPlaybackTime, duration].every(Number.isFinite) || currentTime < 0 || nextPlaybackTime < 0 || duration <= 0) return null;
  const startsAt = Math.max(currentTime + 0.015, nextPlaybackTime);
  return { startsAt, endsAt: startsAt + duration };
}

export class SupportVoicePlaybackQueue {
  private readonly pending: Int16Array[] = [];
  private outstandingBytes = 0;

  enqueue(samples: Int16Array): SupportVoicePlaybackAdmission {
    if (!(samples instanceof Int16Array) || samples.byteLength === 0) return "invalid";
    if (this.pending.length >= SUPPORT_VOICE_PLAYBACK_MAX_PENDING_CHUNKS) return "pressure";
    if (samples.byteLength > SUPPORT_VOICE_PLAYBACK_MAX_BYTES - this.outstandingBytes) return "pressure";
    this.pending.push(samples);
    this.outstandingBytes += samples.byteLength;
    return "queued";
  }

  take(): Int16Array | null {
    return this.pending.shift() || null;
  }

  release(byteLength: number): void {
    if (!Number.isSafeInteger(byteLength) || byteLength <= 0) return;
    this.outstandingBytes = Math.max(0, this.outstandingBytes - byteLength);
  }

  clear(): void {
    for (const samples of this.pending) samples.fill(0);
    this.pending.length = 0;
    this.outstandingBytes = 0;
  }

  get pendingCount(): number {
    return this.pending.length;
  }

  get queuedBytes(): number {
    return this.outstandingBytes;
  }
}
