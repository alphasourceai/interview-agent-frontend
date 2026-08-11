export type VoiceState = "idle" | "requesting" | "connecting" | "listening" | "speaking" | "muted" | "ended" | "conflict" | "error";

type SupportVoiceEndReason = "ended" | "idle_timeout" | "max_duration";

const NORMAL_SUPPORT_VOICE_CLOSE_REASONS = new Set([
  "ended",
  "user_end",
  "popover_closed",
  "signed_out",
  "component_unmounted",
  "server_ended",
  "client_cancelled",
]);

export type SupportVoiceServerMessage =
  | { type: "ready" }
  | { type: "listening"; active: boolean }
  | { type: "speaking"; active: boolean }
  | { type: "audio_delta"; audio: string }
  | { type: "ended"; reason: SupportVoiceEndReason }
  | { type: "error"; code: "support_voice_unavailable" };

function exactKeys(value: Record<string, unknown>, expected: string[]): boolean {
  return Object.keys(value).sort().join("\u001f") === [...expected].sort().join("\u001f");
}

function isEndReason(value: unknown): value is SupportVoiceEndReason {
  return value === "ended" || value === "idle_timeout" || value === "max_duration";
}

export function parseSupportVoiceServerMessage(value: unknown): SupportVoiceServerMessage | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const message = value as Record<string, unknown>;
  if (message.type === "ready" && exactKeys(message, ["type"])) return { type: "ready" };
  if ((message.type === "listening" || message.type === "speaking") &&
      typeof message.active === "boolean" && exactKeys(message, ["type", "active"])) {
    return { type: message.type, active: message.active };
  }
  if (message.type === "audio_delta" && typeof message.audio === "string" &&
      message.audio.length > 0 && exactKeys(message, ["type", "audio"])) {
    return { type: "audio_delta", audio: message.audio };
  }
  if (message.type === "ended" && isEndReason(message.reason) &&
      exactKeys(message, ["type", "reason"])) {
    return { type: "ended", reason: message.reason };
  }
  if (message.type === "error" && message.code === "support_voice_unavailable" && exactKeys(message, ["type", "code"])) {
    return { type: "error", code: "support_voice_unavailable" };
  }
  return null;
}

export function nextSupportVoiceState(current: VoiceState, message: SupportVoiceServerMessage, muted: boolean): VoiceState {
  if (message.type === "ended") return "ended";
  if (message.type === "error") return "error";
  if (message.type === "ready" || message.type === "listening") return muted ? "muted" : "listening";
  if (message.type === "speaking") return muted ? "muted" : message.active ? "speaking" : "listening";
  return current;
}

export function nextSupportVoiceStateAfterClose(current: VoiceState, code: number, reason: string): VoiceState {
  if (current === "error") return "error";
  if (current === "ended") return "ended";
  return code === 1000 && NORMAL_SUPPORT_VOICE_CLOSE_REASONS.has(reason) ? "ended" : "error";
}
