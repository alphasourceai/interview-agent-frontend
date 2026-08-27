import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import CandidateHeader from "@/components/CandidateHeader";

type LiveSessionState = {
  conversation_url: string;
  conversation_id: string;
  interview_id: string;
  role_token: string;
  max_interview_minutes: number | null;
  silence_engagement_owner?: "prompt" | "tavus_patient" | "application_inactivity";
  application_inactivity_control_enabled?: boolean;
  email?: string;
  candidate_id?: string;
  role_id?: string;
  candidate_assistance_contact?: string;
  selectedCameraDeviceId?: string;
  selectedMicrophoneDeviceId?: string;
};

type DailyTrackSlot = {
  state?: string;
  subscribed?: boolean | "staged";
  off?: {
    byUser?: boolean;
  };
  track?: MediaStreamTrack | null;
  persistentTrack?: MediaStreamTrack | null;
};

type DailyParticipant = {
  local?: boolean;
  session_id?: string;
  tracks?: {
    video?: DailyTrackSlot;
    audio?: DailyTrackSlot;
  };
};

type RemoteParticipantEvidence = {
  remotePresent: boolean;
  remoteAudioReady: boolean;
  remoteVideoReady: boolean;
  remoteParticipantCount: number;
  remoteParticipantCountBucket: "zero" | "one" | "multiple";
  audioState: NormalizedRemoteTrackState;
  videoState: NormalizedRemoteTrackState;
  audioPersistentTrackPresent: boolean;
  videoPersistentTrackPresent: boolean;
  audioSubscriptionState: SubscriptionState;
  videoSubscriptionState: SubscriptionState;
  audioTrackPresent: boolean;
  videoTrackPresent: boolean;
};

export type NormalizedRemoteTrackState =
  | "absent"
  | "blocked"
  | "off"
  | "sendable"
  | "loading"
  | "interrupted"
  | "playable"
  | "unavailable"
  | "unknown";

export type SubscriptionState = "subscribed" | "staged" | "unsubscribed" | "unknown";

export type StartupReadinessState =
  | "waiting_for_remote_participant"
  | "remote_participant_present"
  | "remote_participant_audio_only"
  | "remote_video_loading"
  | "remote_video_playable"
  | "replica_progress_confirmed"
  | "startup_ready"
  | "startup_recovering"
  | "startup_failed";

type ReliabilityMetadata = Record<string, string | number | boolean>;

export type ReliabilityDiagnosticEvent = {
  event: string;
  metadata: ReliabilityMetadata;
};

type RemoteDiagnosticContext = {
  recoveryActive: boolean;
  recoveryAttempt: 0 | 1;
  recoveryPhase: ReconnectRecoveryPhase;
};

export type ReconnectRecoveryPhase =
  | "idle"
  | "reconnecting_transport"
  | "awaiting_remote_presence"
  | "awaiting_remote_media"
  | "awaiting_practical_progress"
  | "recovered"
  | "failed";

export type ReconnectProgressSource = "replica_started_speaking" | "replica_utterance";

export type ReconnectRecoveryState = {
  phase: ReconnectRecoveryPhase;
  attempt: 0 | 1;
  startedAt: number | null;
  localJoinedAt: number | null;
  remotePresent: boolean;
  remoteAudioReady: boolean;
  remoteVideoReady: boolean;
  progressAt: number | null;
  progressSource: ReconnectProgressSource | null;
  terminalAt: number | null;
};

export type ReconnectRecoveryEvent =
  | { type: "start"; at: number }
  | { type: "local_joined"; at: number }
  | ({ type: "remote_state"; at: number } & RemoteParticipantEvidence)
  | { type: "practical_progress"; at: number; source: ReconnectProgressSource }
  | { type: "deadline"; at: number }
  | { type: "join_failed"; at: number };

export type CandidateSpeakingState = {
  active: boolean;
  startedAt: number | null;
  expiresAt: number | null;
  lastWatchdogDiagnosticAt: number | null;
};

export type ProgressWatchdogAction =
  | "none"
  | "skip_candidate_speaking"
  | "candidate_speaking_expired"
  | "start_recovery"
  | "terminal";

export type ProgressWatchdogEvaluation = {
  action: ProgressWatchdogAction;
  candidateSpeaking: CandidateSpeakingState;
  emitDiagnostic: boolean;
};

export type ProgressWatchdogInput = {
  now: number;
  progressObserved: boolean;
  lastProgressAt: number | null;
  hasCall: boolean;
  recoveryInFlight: boolean;
  recoveryActive: boolean;
  recoveryAttempted: boolean;
  lastAiSpeechStoppedAt: number | null;
  candidateSpeaking: CandidateSpeakingState;
};

export type CandidateSpeakingTransition = "started" | "ended" | null;

export type CandidateInactivityNudgePhase =
  | "DISABLED"
  | "DISARMED"
  | "ARMED_AFTER_PAL_TURN"
  | "CANCELLED"
  | "NUDGE_DISPATCHED"
  | "WAITING_FOR_CANDIDATE_AFTER_NUDGE"
  | "SUPPRESSED"
  | "TERMINAL";

export type CandidateInactivityNudgeReason =
  | "candidate_speaking"
  | "candidate_utterance"
  | "pal_speaking"
  | "reconnect"
  | "transport_unhealthy"
  | "candidate_media_unavailable"
  | "replica_absent"
  | "remote_audio_unavailable"
  | "watchdog_recovery"
  | "question_lock"
  | "closing"
  | "termination"
  | "provider_end"
  | "conversation_changed"
  | "unmount"
  | "runtime_ownership_lost"
  | "hidden_document"
  | "interrupted_pal_turn"
  | "duplicate_turn"
  | "stale_sequence"
  | "wrong_conversation"
  | "application_control_turn"
  | "late_timer"
  | "ambiguous_state"
  | "dispatch_failed";

export type CandidateInactivityNudgeState = {
  phase: CandidateInactivityNudgePhase;
  enabled: boolean;
  interviewId: string;
  conversationId: string;
  activeTurnKey: string | null;
  activeTurnSequence: number | null;
  highestProviderSequence: number | null;
  processedTurnKeys: string[];
  armedAt: number | null;
  deadlineAt: number | null;
};

export type CandidateInactivityEligibility = {
  phase: InterviewClosingPhase;
  remainingSeconds: number | null;
  candidateSpeaking: boolean;
  reconnectActive: boolean;
  transportHealthy: boolean;
  candidateMediaHealthy: boolean;
  replicaPresent: boolean;
  remoteAudioReady: boolean;
  documentVisible: boolean;
  runtimeOwner: boolean;
};

export type NormalizedPalSpeakingEvent = {
  kind: "started" | "stopped";
  conversationId: string;
  turnKey: string;
  providerSequence: number | null;
  interrupted: boolean;
  applicationControl: boolean;
  inferenceId?: string;
  correlation: "provider" | "local";
};

export type CandidateInactivityTransition = {
  state: CandidateInactivityNudgeState;
  action: "none" | "armed" | "cancelled" | "suppressed" | "send" | "candidate_activity";
  reason?: CandidateInactivityNudgeReason;
  latenessBucket?: "on_time" | "within_2s" | "over_2s";
};

export type TimerTone = "normal" | "warning" | "urgent";

export type InterviewClosingPhase =
  | "INTERVIEWING"
  | "AVATAR_CLOSING"
  | "COMPLETE";

export type ClosingEchoPhase =
  | "IDLE"
  | "RESERVED"
  | "DISPATCHED"
  | "SPEAKING"
  | "COMPLETED"
  | "FALLBACK"
  | "DISPATCH_FAILED";

export type InterviewTimeBoundaryState = {
  phase: InterviewClosingPhase;
  closingReserved: boolean;
  candidateAudioUnpublishRequested: boolean;
  replicaInterruptRequested: boolean;
  closingEchoPhase: ClosingEchoPhase;
  farewellInferenceId: string | null;
  closingEchoStarted: boolean;
  farewellStartedSequence: number | null;
  closingEchoFallbackReason:
    | "start_timeout"
    | "completion_timeout"
    | "dispatch_failed"
    | "farewell_interrupted"
    | "foreign_inference_conflict"
    | "stale_owner_takeover"
    | null;
  providerEndRequested: boolean;
  providerEndConfirmed: boolean;
  navigationRequested: boolean;
};

export type InterviewTimeBoundaryAction =
  | "reserve_avatar_closing"
  | "request_candidate_audio_unpublish"
  | "interrupt_replica"
  | "send_closing_echo";

export type InterviewTimeBoundaryEvaluation = {
  state: InterviewTimeBoundaryState;
  actions: InterviewTimeBoundaryAction[];
};

// Retained for targeted Daily publication diagnostics. Terminal closing uses
// requestCandidateAudioUnpublish() as a best-effort privacy action and never
// waits on this asynchronous observation before dispatching the farewell.
export type CandidateAudioLockResult = {
  category: "confirmed_disabled" | "definite_failure" | "timed_out" | "ambiguous" | "cancelled_terminal";
  attempts: number;
  publicationEnabled: boolean | null;
  confirmationSource: "participant_updated" | "participant_snapshot" | "participant_snapshot_poll" | "none";
  observedPublicationState: "off" | "blocked" | "enabled" | "loading" | "interrupted" | "unavailable" | "unknown";
  elapsedMs: number;
};

export type CandidateAudioLockConfirmationOptions = {
  timeoutMs?: number;
  pollIntervalMs?: number;
  retryAfterMs?: number;
  signal?: AbortSignal;
  now?: () => number;
  setTimer?: (callback: () => void, delayMs: number) => unknown;
  clearTimer?: (timer: unknown) => void;
  allowRetry?: boolean;
};

export type InterviewTimerRuntimeState = {
  sessionKey: string;
  startedAt: number;
  deadlineAt: number | null;
  boundaryState: InterviewTimeBoundaryState;
};

type DailyEvent = {
  action?: string;
  error?: unknown;
  errorMsg?: string;
  data?: any;
  participant?: DailyParticipant;
  participants?: Record<string, DailyParticipant>;
  meetingState?: string;
  receiveSettings?: unknown;
};

type DailyCallObject = {
  join: (options: { url: string; userName?: string; startAudioOff?: boolean; startVideoOff?: boolean }) => Promise<unknown>;
  leave: () => Promise<unknown>;
  destroy: () => void;
  on: (event: string, handler: (event?: DailyEvent) => void) => void;
  off?: (event: string, handler: (event?: DailyEvent) => void) => void;
  participants?: () => Record<string, DailyParticipant>;
  getReceiveSettings?: () => Promise<unknown>;
  subscribeToTracksAutomatically?: () => boolean;
  sendAppMessage?: (message: unknown, recipients?: string | string[]) => void;
  startRecording?: () => Promise<unknown>;
  localAudio?: () => boolean;
  setLocalAudio?: (enabled: boolean, options?: { forceDiscardTrack?: boolean }) => DailyCallObject;
  setInputDevicesAsync?: (devices: { videoDeviceId?: string; audioDeviceId?: string }) => Promise<unknown>;
  setInputDevices?: (devices: { videoDeviceId?: string; audioDeviceId?: string }) => Promise<unknown> | unknown;
};

type DailySdk = {
  createCallObject: () => DailyCallObject;
};

declare global {
  interface Window {
    DailyIframe?: DailySdk;
  }
}

const DAILY_SCRIPT_ID = "alphasource-daily-sdk";
// Pin the audited Daily contract used by the final-closing publication lock.
const DAILY_SCRIPT_SRC = "https://unpkg.com/@daily-co/daily-js@0.91.0/dist/daily.js";
const LIVE_STATE_KEY = "alphasource_interview_live_state";
const STARTUP_REMOTE_TIMEOUT_MS = 12000;
// The Tavus prompt checks silence after 4-5 seconds; 45 seconds with no utterance is well beyond normal prompt progression.
const PROGRESS_STALL_MS = 45000;
const PROGRESS_WATCHDOG_INTERVAL_MS = 5000;
const RECOVERY_PROGRESS_TIMEOUT_MS = 30000;
const IDLE_ENGAGEMENT_GRACE_MS = 30000;
// The current interview design already uses a two-minute candidate warning.
// This guard protects ordinary long answers without allowing a missing stop
// event to suppress the watchdog for the remainder of the interview.
export const CANDIDATE_SPEAKING_PROTECTION_MS = 120000;
const CANDIDATE_SPEAKING_DIAGNOSTIC_INTERVAL_MS = 30000;
const TIME_WARNING_THRESHOLD_SECONDS = 120;
const URGENT_WARNING_THRESHOLD_SECONDS = 60;
export const CANDIDATE_INACTIVITY_NUDGE_THRESHOLD_MS = 10000;
export const CANDIDATE_INACTIVITY_NUDGE_MAX_LATENESS_MS = 2000;
export const CANDIDATE_INACTIVITY_NUDGE_TEXT =
  "Take your time. When you’re ready, you can continue.";
export const NORMAL_COMPLETION_FAREWELL_TEXT =
  "Thank you for your time. I am ending the session now.";
export const NORMAL_COMPLETION_END_DELAY_MS = 5500;
export const FINAL_CLOSING_ANNOUNCEMENT_TEXT =
  "We are out of time. Thank you for your time. I am ending the session now.";
const TERMINAL_INTERVIEW_TOOL_NAMES = new Set(["end_call", "end_interview"]);

export function isTerminalInterviewToolName(value: unknown): boolean {
  return TERMINAL_INTERVIEW_TOOL_NAMES.has(String(value ?? "").trim().toLowerCase());
}

function normalizeCompleteUtterance(value: unknown): string {
  return String(value ?? "").trim().replace(/\s+/g, " ").toLocaleLowerCase("en-US");
}

export function normalCompletionEndAllowed(input: {
  phase: InterviewClosingPhase | null | undefined;
  avatarClosingActive: boolean;
  endTriggered: boolean;
}): boolean {
  return input.phase === "INTERVIEWING" &&
    !input.avatarClosingActive &&
    !input.endTriggered;
}

export function isNormalCompletionFarewell(input: {
  eventType: unknown;
  role: unknown;
  speech: unknown;
  phase: InterviewClosingPhase | null | undefined;
  avatarClosingActive: boolean;
}): boolean {
  const eventType = String(input.eventType ?? "").trim().toLowerCase();
  const role = String(input.role ?? "").trim().toLowerCase();
  return eventType === "conversation.utterance" &&
    (role === "replica" || role === "assistant" || role === "agent") &&
    normalCompletionEndAllowed({
      phase: input.phase,
      avatarClosingActive: input.avatarClosingActive,
      endTriggered: false,
    }) &&
    normalizeCompleteUtterance(input.speech) ===
      normalizeCompleteUtterance(NORMAL_COMPLETION_FAREWELL_TEXT);
}

export const FINAL_CLOSING_START_TIMEOUT_MS = 5000;
// Tavus can emit one delayed inference after the terminal interrupt. Keep that
// stale turn inaudible, allow it to drain, then separate the final interrupt
// from the one authoritative Echo so the two commands cannot race.
export const FINAL_CLOSING_DRAIN_MS = 3500;
export const FINAL_CLOSING_INTERRUPT_ECHO_GAP_MS = 300;
// Tavus speaking-state events are useful diagnostics but are not reliable
// enough to authorize termination: they may be duplicated, out of order, or
// describe the PAL turn interrupted immediately before the terminal Echo.
// Keep the session alive for this entire interval after the Echo dispatch.
export const FINAL_CLOSING_MINIMUM_GRACE_MS = 12000;
export const FINAL_CLOSING_COMPLETION_FALLBACK_MS = FINAL_CLOSING_MINIMUM_GRACE_MS;
// Ownership must outlive the entire farewell grace so another tab cannot take
// over between Echo dispatch and the one provider-end reservation.
export const FINAL_CLOSING_OWNER_LEASE_MS = 30000;
const CANDIDATE_INACTIVITY_NUDGE_INFERENCE_PREFIX =
  "alphascreen-candidate-inactivity-nudge";
// Recognize callbacks from historically deployed PAL-farewell turns so they
// remain excluded from candidate-inactivity arming. The new runtime never
// creates or sends this inference type.
const CLOSING_FAREWELL_INFERENCE_PREFIX = "alphascreen-closing-farewell";
const CANDIDATE_INACTIVITY_LEASE_PREFIX = "alphascreen-inactivity-owner";
const CANDIDATE_INACTIVITY_LEASE_MS = 6000;
const CANDIDATE_INACTIVITY_LEASE_RENEW_MS = 2000;
const MAX_PROCESSED_INACTIVITY_TURNS = 24;
const MAX_PENDING_TELEMETRY_REQUESTS = 8;
const closingRuntimeBySession = new Map<string, InterviewTimerRuntimeState>();
const FINAL_CLOSING_STORAGE_PREFIX = "alphascreen-final-closing";
const FINAL_CLOSING_TAB_RUNTIME_ID = boundedOpaqueHash(
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`,
);

export type SharedFinalClosingPhase =
  | "RESERVED"
  | "CANDIDATE_AUDIO_REQUESTED"
  | "DISPATCH_RESERVED"
  | "INTERRUPT_SENT"
  | "ECHO_DISPATCHED"
  | "FAREWELL_AUDIBLE"
  | "ECHO_COMPLETED"
  | "PROVIDER_END_REQUESTED"
  | "COMPLETE";

type SharedFinalClosingState = {
  version: 2;
  ownerTabId: string;
  phase: SharedFinalClosingPhase;
  updatedAt: number;
  leaseExpiresAt: number;
  farewellStartDeadlineAt: number | null;
  farewellCompletionDeadlineAt: number | null;
};

type FinalClosingStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

type FinalClosingLockManager = {
  request<T>(
    name: string,
    options: { mode: "exclusive" },
    callback: (lock: object | null) => T | Promise<T>,
  ): Promise<T>;
};

const SHARED_FINAL_CLOSING_PHASE_ORDER: Record<SharedFinalClosingPhase, number> = {
  RESERVED: 0,
  CANDIDATE_AUDIO_REQUESTED: 1,
  DISPATCH_RESERVED: 2,
  INTERRUPT_SENT: 3,
  ECHO_DISPATCHED: 4,
  FAREWELL_AUDIBLE: 5,
  ECHO_COMPLETED: 6,
  PROVIDER_END_REQUESTED: 7,
  COMPLETE: 8,
};

const CLOSING_PHASE_ORDER: Record<InterviewClosingPhase, number> = {
  INTERVIEWING: 0,
  AVATAR_CLOSING: 1,
  COMPLETE: 2,
};

export function createInterviewTimeBoundaryState(sessionKey = "unbound"): InterviewTimeBoundaryState {
  return {
    phase: "INTERVIEWING",
    closingReserved: false,
    candidateAudioUnpublishRequested: false,
    replicaInterruptRequested: false,
    closingEchoPhase: "IDLE",
    farewellInferenceId: closingApplicationInferenceId(sessionKey),
    closingEchoStarted: false,
    farewellStartedSequence: null,
    closingEchoFallbackReason: null,
    providerEndRequested: false,
    providerEndConfirmed: false,
    navigationRequested: false,
  };
}

export function advanceInterviewClosingPhase(
  state: InterviewTimeBoundaryState,
  target: InterviewClosingPhase,
): InterviewTimeBoundaryState {
  if (CLOSING_PHASE_ORDER[target] <= CLOSING_PHASE_ORDER[state.phase]) return state;
  return { ...state, phase: target };
}

export function initializeInterviewTimerRuntime(
  previous: InterviewTimerRuntimeState | null,
  sessionKey: string,
  startedAt: number,
  durationMs?: number,
): InterviewTimerRuntimeState {
  if (previous?.sessionKey === sessionKey) return previous;
  const preserved = closingRuntimeBySession.get(sessionKey);
  if (preserved) return preserved;
  const runtime = {
    sessionKey,
    startedAt,
    deadlineAt:
      typeof durationMs === "number" && Number.isFinite(durationMs) && durationMs > 0
        ? startedAt + durationMs
        : null,
    boundaryState: createInterviewTimeBoundaryState(sessionKey),
  };
  closingRuntimeBySession.set(sessionKey, runtime);
  while (closingRuntimeBySession.size > 8) {
    const oldest = closingRuntimeBySession.keys().next().value;
    if (!oldest) break;
    closingRuntimeBySession.delete(oldest);
  }
  return runtime;
}

export function remainingSecondsAtDeadline(
  deadlineAt: number | null,
  now: number,
): number | null {
  if (
    typeof deadlineAt !== "number" ||
    !Number.isFinite(deadlineAt) ||
    !Number.isFinite(now)
  ) return null;
  return Math.max(0, Math.ceil((deadlineAt - now) / 1000));
}

export function preserveInterviewTimerRuntime(runtime: InterviewTimerRuntimeState): void {
  closingRuntimeBySession.set(runtime.sessionKey, runtime);
}

export function resetInterviewTimerRuntimeForTests(): void {
  closingRuntimeBySession.clear();
}

export function finalClosingSharedStorageKey(conversationId: string): string {
  return `${FINAL_CLOSING_STORAGE_PREFIX}:${boundedOpaqueHash(conversationId)}`;
}

export function finalClosingRuntimeLockName(conversationId: string): string {
  return `${FINAL_CLOSING_STORAGE_PREFIX}-lock:${boundedOpaqueHash(conversationId)}`;
}

export async function withFinalClosingRuntimeLock<T>(
  lockManager: FinalClosingLockManager | null | undefined,
  conversationId: string,
  task: () => T | Promise<T>,
): Promise<{ acquired: boolean; value: T | null }> {
  if (!lockManager || typeof lockManager.request !== "function" || !conversationId) {
    return { acquired: false, value: null };
  }
  try {
    return await lockManager.request(
      finalClosingRuntimeLockName(conversationId),
      { mode: "exclusive" },
      async (lock) => {
        if (!lock) return { acquired: false, value: null };
        return { acquired: true, value: await task() };
      },
    );
  } catch {
    return { acquired: false, value: null };
  }
}

function browserFinalClosingLockManager(): FinalClosingLockManager | null {
  if (typeof navigator === "undefined") return null;
  const locks = (navigator as Navigator & { locks?: FinalClosingLockManager }).locks;
  return locks && typeof locks.request === "function" ? locks : null;
}

function parseSharedFinalClosingState(value: string | null): SharedFinalClosingState | null | "ambiguous" {
  if (value === null) return null;
  try {
    const parsed = JSON.parse(value) as Partial<SharedFinalClosingState>;
    const validStartDeadline = parsed.farewellStartDeadlineAt === null || (
      typeof parsed.farewellStartDeadlineAt === "number" &&
      Number.isFinite(parsed.farewellStartDeadlineAt) &&
      parsed.farewellStartDeadlineAt >= 0
    );
    const validCompletionDeadline = parsed.farewellCompletionDeadlineAt === null || (
      typeof parsed.farewellCompletionDeadlineAt === "number" &&
      Number.isFinite(parsed.farewellCompletionDeadlineAt) &&
      parsed.farewellCompletionDeadlineAt >= 0
    );
    const phaseOrder = parsed.phase && parsed.phase in SHARED_FINAL_CLOSING_PHASE_ORDER
      ? SHARED_FINAL_CLOSING_PHASE_ORDER[parsed.phase as SharedFinalClosingPhase]
      : -1;
    const dispatchDeadlinesCoherent = phaseOrder < SHARED_FINAL_CLOSING_PHASE_ORDER.ECHO_DISPATCHED
      ? parsed.farewellStartDeadlineAt === null && parsed.farewellCompletionDeadlineAt === null
      : typeof parsed.farewellStartDeadlineAt === "number" &&
        typeof parsed.farewellCompletionDeadlineAt === "number" &&
        parsed.farewellCompletionDeadlineAt >= parsed.farewellStartDeadlineAt;
    if (
      parsed?.version !== 2 ||
      typeof parsed.ownerTabId !== "string" ||
      !parsed.ownerTabId ||
      typeof parsed.updatedAt !== "number" ||
      !Number.isFinite(parsed.updatedAt) ||
      parsed.updatedAt < 0 ||
      typeof parsed.leaseExpiresAt !== "number" ||
      !Number.isFinite(parsed.leaseExpiresAt) ||
      parsed.leaseExpiresAt < parsed.updatedAt ||
      phaseOrder < 0 ||
      !validStartDeadline ||
      !validCompletionDeadline ||
      !dispatchDeadlinesCoherent
    ) return "ambiguous";
    return parsed as SharedFinalClosingState;
  } catch {
    return "ambiguous";
  }
}

export function readSharedFinalClosingRuntime(
  storage: FinalClosingStorage,
  conversationId: string,
): SharedFinalClosingState | null {
  const parsed = parseSharedFinalClosingState(
    storage.getItem(finalClosingSharedStorageKey(conversationId)),
  );
  return parsed === "ambiguous" ? null : parsed;
}

export function claimSharedFinalClosingRuntime(
  storage: FinalClosingStorage,
  conversationId: string,
  tabId: string,
  now = Date.now(),
): { state: SharedFinalClosingState | null; owned: boolean; reason: string } {
  const key = finalClosingSharedStorageKey(conversationId);
  let parsed: ReturnType<typeof parseSharedFinalClosingState>;
  try {
    parsed = parseSharedFinalClosingState(storage.getItem(key));
  } catch {
    return { state: null, owned: false, reason: "shared_storage_unavailable" };
  }
  if (parsed === "ambiguous") {
    return { state: null, owned: false, reason: "ambiguous_shared_state" };
  }
  if (parsed) {
    if (
      parsed.ownerTabId !== tabId &&
      parsed.leaseExpiresAt <= now &&
      parsed.phase !== "PROVIDER_END_REQUESTED" &&
      parsed.phase !== "COMPLETE"
    ) {
      const takeover: SharedFinalClosingState = {
        ...parsed,
        ownerTabId: tabId,
        updatedAt: now,
        leaseExpiresAt: now + FINAL_CLOSING_OWNER_LEASE_MS,
      };
      try {
        storage.setItem(key, JSON.stringify(takeover));
        const confirmed = parseSharedFinalClosingState(storage.getItem(key));
        if (confirmed !== "ambiguous" && confirmed?.ownerTabId === tabId) {
          return { state: confirmed, owned: true, reason: "stale_owner_takeover" };
        }
      } catch {}
      return { state: parsed, owned: false, reason: "stale_owner_takeover_failed" };
    }
    return {
      state: parsed,
      owned: parsed.ownerTabId === tabId,
      reason: parsed.ownerTabId === tabId ? "already_owned" : "owned_by_other_tab",
    };
  }
  const created: SharedFinalClosingState = {
    version: 2,
    ownerTabId: tabId,
    phase: "RESERVED",
    updatedAt: now,
    leaseExpiresAt: now + FINAL_CLOSING_OWNER_LEASE_MS,
    farewellStartDeadlineAt: null,
    farewellCompletionDeadlineAt: null,
  };
  try {
    storage.setItem(key, JSON.stringify(created));
    const confirmed = parseSharedFinalClosingState(storage.getItem(key));
    if (confirmed === "ambiguous" || !confirmed) {
      return { state: null, owned: false, reason: "ambiguous_shared_state" };
    }
    return {
      state: confirmed,
      owned: confirmed.ownerTabId === tabId,
      reason: confirmed.ownerTabId === tabId ? "claimed" : "owned_by_other_tab",
    };
  } catch {
    return { state: null, owned: false, reason: "shared_storage_unavailable" };
  }
}

export function advanceSharedFinalClosingRuntime(
  storage: FinalClosingStorage,
  conversationId: string,
  tabId: string,
  target: SharedFinalClosingPhase,
  now = Date.now(),
): { state: SharedFinalClosingState | null; advanced: boolean; reason: string } {
  const key = finalClosingSharedStorageKey(conversationId);
  try {
    const parsed = parseSharedFinalClosingState(storage.getItem(key));
    if (parsed === "ambiguous" || !parsed) {
      return { state: null, advanced: false, reason: "ambiguous_shared_state" };
    }
    if (parsed.ownerTabId !== tabId) {
      return { state: parsed, advanced: false, reason: "owned_by_other_tab" };
    }
    if (SHARED_FINAL_CLOSING_PHASE_ORDER[target] <= SHARED_FINAL_CLOSING_PHASE_ORDER[parsed.phase]) {
      return { state: parsed, advanced: false, reason: "already_advanced" };
    }
    const next = {
      ...parsed,
      phase: target,
      updatedAt: now,
      leaseExpiresAt: now + FINAL_CLOSING_OWNER_LEASE_MS,
      farewellStartDeadlineAt: target === "ECHO_DISPATCHED" && parsed.farewellStartDeadlineAt === null
        ? now + FINAL_CLOSING_START_TIMEOUT_MS
        : parsed.farewellStartDeadlineAt,
      farewellCompletionDeadlineAt:
        target === "ECHO_DISPATCHED" && parsed.farewellCompletionDeadlineAt === null
          ? now + FINAL_CLOSING_COMPLETION_FALLBACK_MS
          : parsed.farewellCompletionDeadlineAt,
    };
    storage.setItem(key, JSON.stringify(next));
    const confirmed = parseSharedFinalClosingState(storage.getItem(key));
    if (confirmed === "ambiguous" || !confirmed || confirmed.phase !== target) {
      return { state: null, advanced: false, reason: "ambiguous_shared_state" };
    }
    return { state: confirmed, advanced: true, reason: "advanced" };
  } catch {
    return { state: null, advanced: false, reason: "shared_storage_unavailable" };
  }
}

export function sharedProviderEndAttemptAllowed(
  transition: { state: SharedFinalClosingState | null; advanced: boolean },
): boolean {
  return transition.advanced;
}

export function finalClosingGraceDelayMs(
  state: SharedFinalClosingState | null,
  now = Date.now(),
): number | null {
  if (
    !state ||
    SHARED_FINAL_CLOSING_PHASE_ORDER[state.phase] < SHARED_FINAL_CLOSING_PHASE_ORDER.ECHO_DISPATCHED ||
    typeof state.farewellCompletionDeadlineAt !== "number" ||
    !Number.isFinite(state.farewellCompletionDeadlineAt)
  ) return null;
  return Math.max(0, state.farewellCompletionDeadlineAt - now);
}

export function sharedFinalClosingDispatchMayResume(
  state: SharedFinalClosingState,
): boolean {
  return state.phase === "RESERVED" || state.phase === "CANDIDATE_AUDIO_REQUESTED";
}

export function sharedFinalClosingRecoveryPlan(
  state: SharedFinalClosingState,
  tabId: string,
): {
  owned: boolean;
  navigateImmediately: boolean;
  rearmCompletionFallback: boolean;
  requestProviderEnd: boolean;
  failClosedProviderEnd: boolean;
  farewellAudible: boolean;
  resumeDispatch: boolean;
} {
  const owned = state.ownerTabId === tabId;
  const navigateImmediately = state.phase === "COMPLETE";
  const echoCompleted =
    SHARED_FINAL_CLOSING_PHASE_ORDER[state.phase] >=
    SHARED_FINAL_CLOSING_PHASE_ORDER.ECHO_COMPLETED;
  const providerEndReserved =
    SHARED_FINAL_CLOSING_PHASE_ORDER[state.phase] >=
    SHARED_FINAL_CLOSING_PHASE_ORDER.PROVIDER_END_REQUESTED;
  // Once the single owner has dispatched the direct Echo, its existing Tavus
  // audio must stay open. Provider speaking events are useful completion
  // evidence, but cannot be an audio gate because inference_id is optional.
  const farewellAudible =
    state.phase === "ECHO_DISPATCHED" || state.phase === "FAREWELL_AUDIBLE";
  const fallbackCanBeRearmed =
    state.phase === "ECHO_DISPATCHED" || farewellAudible;
  const resumeDispatch = owned && sharedFinalClosingDispatchMayResume(state);
  const dispatchStateUncertain =
    state.phase === "DISPATCH_RESERVED" ||
    state.phase === "INTERRUPT_SENT";
  return {
    owned,
    navigateImmediately,
    rearmCompletionFallback: owned && fallbackCanBeRearmed,
    requestProviderEnd: owned && echoCompleted && !providerEndReserved,
    failClosedProviderEnd: owned && dispatchStateUncertain,
    farewellAudible: owned && farewellAudible,
    resumeDispatch,
  };
}

const CANDIDATE_AUDIO_LOCK_TIMEOUT_MS = 1800;
const CANDIDATE_AUDIO_LOCK_POLL_INTERVAL_MS = 50;
const CANDIDATE_AUDIO_LOCK_RETRY_AFTER_MS = 600;

type CandidateAudioPublicationObservation = Pick<
  CandidateAudioLockResult,
  "publicationEnabled" | "observedPublicationState"
>;

function localDailyParticipant(call: Partial<DailyCallObject>): DailyParticipant | null {
  if (typeof call.participants !== "function") return null;
  try {
    const participants = call.participants();
    return Object.values(participants || {}).find((participant) => participant?.local === true) || null;
  } catch {
    return null;
  }
}

function observeCandidateAudioPublication(
  call: Partial<DailyCallObject>,
  participant?: DailyParticipant | null,
): CandidateAudioPublicationObservation {
  const local = participant?.local === true ? participant : localDailyParticipant(call);
  const rawState = typeof local?.tracks?.audio?.state === "string"
    ? local.tracks.audio.state.toLowerCase()
    : "";
  if (rawState === "off") {
    return { publicationEnabled: false, observedPublicationState: "off" };
  }
  if (rawState === "blocked") {
    return { publicationEnabled: false, observedPublicationState: "blocked" };
  }
  if (rawState === "sendable" || rawState === "playable") {
    return { publicationEnabled: true, observedPublicationState: "enabled" };
  }
  if (rawState === "loading") {
    return { publicationEnabled: null, observedPublicationState: "loading" };
  }
  if (rawState === "interrupted") {
    return { publicationEnabled: null, observedPublicationState: "interrupted" };
  }
  if (!local || !local.tracks?.audio) {
    return { publicationEnabled: null, observedPublicationState: "unavailable" };
  }
  return { publicationEnabled: null, observedPublicationState: "unknown" };
}

export function confirmCandidateAudioPublicationDisabled(
  call: Partial<DailyCallObject>,
  options: CandidateAudioLockConfirmationOptions = {},
): Promise<CandidateAudioLockResult> {
  const timeoutMs = Math.max(1, Math.min(5000, options.timeoutMs ?? CANDIDATE_AUDIO_LOCK_TIMEOUT_MS));
  const pollIntervalMs = Math.max(1, Math.min(timeoutMs, options.pollIntervalMs ?? CANDIDATE_AUDIO_LOCK_POLL_INTERVAL_MS));
  const retryAfterMs = Math.max(1, Math.min(timeoutMs, options.retryAfterMs ?? CANDIDATE_AUDIO_LOCK_RETRY_AFTER_MS));
  const allowRetry = options.allowRetry !== false;
  const now = options.now || (() => Date.now());
  const setTimer = options.setTimer || ((callback, delayMs) => globalThis.setTimeout(callback, delayMs));
  const clearTimer = options.clearTimer || ((timer) => globalThis.clearTimeout(timer as ReturnType<typeof setTimeout>));
  const startedAt = now();
  let attempts = 0;
  let settled = false;
  let pollTimer: unknown = null;
  let retryTimer: unknown = null;
  let timeoutTimer: unknown = null;
  let lastObservation = observeCandidateAudioPublication(call);
  let resolveResult: (result: CandidateAudioLockResult) => void = () => {};

  const elapsedMs = () => Math.max(0, Math.min(3_600_000, Math.round(now() - startedAt)));
  const result = new Promise<CandidateAudioLockResult>((resolve) => {
    resolveResult = resolve;
  });
  const cleanup = () => {
    if (pollTimer !== null) clearTimer(pollTimer);
    if (retryTimer !== null) clearTimer(retryTimer);
    if (timeoutTimer !== null) clearTimer(timeoutTimer);
    pollTimer = null;
    retryTimer = null;
    timeoutTimer = null;
    try {
      call.off?.("participant-updated", onParticipantUpdated);
    } catch {}
    options.signal?.removeEventListener("abort", onAbort);
  };
  const settle = (
    category: CandidateAudioLockResult["category"],
    confirmationSource: CandidateAudioLockResult["confirmationSource"],
    observation = lastObservation,
  ) => {
    if (settled) return;
    settled = true;
    lastObservation = observation;
    cleanup();
    resolveResult({
      category,
      attempts,
      publicationEnabled: observation.publicationEnabled,
      confirmationSource,
      observedPublicationState: observation.observedPublicationState,
      elapsedMs: elapsedMs(),
    });
  };
  const confirmFromObservation = (
    observation: CandidateAudioPublicationObservation,
    source: CandidateAudioLockResult["confirmationSource"],
  ): boolean => {
    lastObservation = observation;
    if (observation.publicationEnabled !== false) return false;
    settle("confirmed_disabled", source, observation);
    return true;
  };
  function onParticipantUpdated(event?: DailyEvent) {
    if (settled || options.signal?.aborted) return;
    if (event?.participant?.local !== true) return;
    confirmFromObservation(
      observeCandidateAudioPublication(call, event.participant),
      "participant_updated",
    );
  }
  function onAbort() {
    settle("cancelled_terminal", "none", lastObservation);
  }
  const requestAudioOff = (): boolean => {
    if (settled || options.signal?.aborted || typeof call.setLocalAudio !== "function") return false;
    attempts += 1;
    try {
      call.setLocalAudio(false, { forceDiscardTrack: true });
      return true;
    } catch {
      return false;
    }
  };
  const poll = () => {
    if (settled || options.signal?.aborted) return;
    const observation = observeCandidateAudioPublication(call);
    if (confirmFromObservation(observation, "participant_snapshot_poll")) return;
    pollTimer = setTimer(poll, pollIntervalMs);
  };

  if (
    typeof call.setLocalAudio !== "function" ||
    typeof call.on !== "function" ||
    typeof call.off !== "function"
  ) {
    settle("ambiguous", "none", lastObservation);
    return result;
  }
  if (options.signal?.aborted) {
    settle("cancelled_terminal", "none", lastObservation);
    return result;
  }

  options.signal?.addEventListener("abort", onAbort, { once: true });
  try {
    call.on("participant-updated", onParticipantUpdated);
  } catch {
    settle("ambiguous", "none", lastObservation);
    return result;
  }

  const applied = requestAudioOff();
  if (!applied && (!allowRetry || !requestAudioOff())) {
    settle("definite_failure", "none", observeCandidateAudioPublication(call));
    return result;
  }
  if (settled) return result;
  if (confirmFromObservation(observeCandidateAudioPublication(call), "participant_snapshot")) {
    return result;
  }

  pollTimer = setTimer(poll, pollIntervalMs);
  if (attempts === 1 && allowRetry) {
    retryTimer = setTimer(() => {
      retryTimer = null;
      if (settled || options.signal?.aborted) return;
      const observation = observeCandidateAudioPublication(call);
      lastObservation = observation;
      if (observation.publicationEnabled === true) {
        requestAudioOff();
        if (!settled) confirmFromObservation(
          observeCandidateAudioPublication(call),
          "participant_snapshot_poll",
        );
      }
    }, retryAfterMs);
  }
  timeoutTimer = setTimer(() => {
    timeoutTimer = null;
    if (settled || options.signal?.aborted) return;
    const observation = observeCandidateAudioPublication(call);
    if (confirmFromObservation(observation, "participant_snapshot_poll")) return;
    if (observation.publicationEnabled === true) {
      settle("definite_failure", "none", observation);
      return;
    }
    settle(
      observation.observedPublicationState === "unknown" ? "ambiguous" : "timed_out",
      "none",
      observation,
    );
  }, timeoutMs);
  return result;
}

export function candidateTurnSuppressedDuringFinalClosing(state: InterviewTimeBoundaryState): boolean {
  return state.phase !== "INTERVIEWING";
}

export type RemotePalAudioMuteResult =
  | "muted_detached"
  | "already_muted"
  | "unavailable"
  | "failed";

export function suppressRemotePalAudio(
  element: HTMLMediaElement | null,
): RemotePalAudioMuteResult {
  if (!element) return "unavailable";
  const alreadyMuted = element.muted && element.volume === 0 && !element.srcObject;
  try {
    element.muted = true;
    element.volume = 0;
    element.pause();
    element.srcObject = null;
    return alreadyMuted ? "already_muted" : "muted_detached";
  } catch {
    return "failed";
  }
}

export function attachRemotePalAudioTrack(
  element: HTMLMediaElement | null,
  track: MediaStreamTrack | null,
  avatarClosingActive: boolean,
  farewellAudible = false,
): RemotePalAudioMuteResult | "attached" {
  if (!element) return "unavailable";
  if (avatarClosingActive && !farewellAudible) {
    return suppressRemotePalAudio(element);
  }
  element.muted = false;
  element.volume = 1;
  setElementTrack(element, track);
  return "attached";
}

export function requestCandidateAudioUnpublish(
  call: Partial<DailyCallObject> | null,
): "requested" | "unsupported" | "failed" {
  if (typeof call?.setLocalAudio !== "function") return "unsupported";
  try {
    call.setLocalAudio(false, { forceDiscardTrack: true });
    return "requested";
  } catch {
    return "failed";
  }
}

export function evaluateInterviewTimeBoundary(input: {
  state: InterviewTimeBoundaryState;
  remainingSeconds: number;
  candidateSpeaking?: boolean;
  replicaSpeaking?: boolean;
}): InterviewTimeBoundaryEvaluation {
  const remaining = Number.isFinite(input.remainingSeconds)
    ? Math.max(0, input.remainingSeconds)
    : Number.POSITIVE_INFINITY;
  if (input.state.phase !== "INTERVIEWING" || remaining > 0) {
    return { state: input.state, actions: [] };
  }
  return {
    state: {
      ...input.state,
      phase: "AVATAR_CLOSING",
      closingReserved: true,
      candidateAudioUnpublishRequested: true,
      replicaInterruptRequested: true,
      closingEchoPhase: "RESERVED",
    },
    actions: [
      "reserve_avatar_closing",
      "request_candidate_audio_unpublish",
      "interrupt_replica",
      "send_closing_echo",
    ],
  };
}

export function timerToneForRemaining(seconds: number | null): TimerTone {
  if (typeof seconds !== "number") return "normal";
  if (seconds <= URGENT_WARNING_THRESHOLD_SECONDS) return "urgent";
  if (seconds <= TIME_WARNING_THRESHOLD_SECONDS) return "warning";
  return "normal";
}

export function markProviderEndConfirmed(
  state: InterviewTimeBoundaryState,
): InterviewTimeBoundaryState {
  if (!state.providerEndRequested || state.providerEndConfirmed) return state;
  return { ...state, providerEndConfirmed: true };
}

export function closingProviderEndAllowed(state: InterviewTimeBoundaryState): boolean {
  return (
    state.phase === "AVATAR_CLOSING" &&
    (state.closingEchoPhase === "COMPLETED" || state.closingEchoPhase === "FALLBACK") &&
    !state.providerEndRequested
  );
}

export function markClosingEchoDispatched(
  state: InterviewTimeBoundaryState,
  farewellInferenceId = state.farewellInferenceId,
): InterviewTimeBoundaryState {
  if (state.phase !== "AVATAR_CLOSING" || state.closingEchoPhase !== "RESERVED") return state;
  return {
    ...state,
    closingEchoPhase: "DISPATCHED",
    farewellInferenceId,
  };
}

export function markClosingEchoCompleted(
  state: InterviewTimeBoundaryState,
): InterviewTimeBoundaryState {
  if (
    state.phase !== "AVATAR_CLOSING" ||
    state.closingEchoPhase === "COMPLETED" ||
    state.closingEchoPhase === "FALLBACK"
  ) return state;
  return { ...state, closingEchoPhase: "COMPLETED" };
}

export function markClosingEchoFallback(
  state: InterviewTimeBoundaryState,
  reason: NonNullable<InterviewTimeBoundaryState["closingEchoFallbackReason"]>,
): InterviewTimeBoundaryState {
  if (state.phase !== "AVATAR_CLOSING" || closingProviderEndAllowed(state)) return state;
  return {
    ...state,
    closingEchoPhase: "FALLBACK",
    closingEchoFallbackReason: reason,
  };
}

export function markProviderEndRequested(
  state: InterviewTimeBoundaryState,
): { state: InterviewTimeBoundaryState; requested: boolean } {
  if (!closingProviderEndAllowed(state)) return { state, requested: false };
  return { state: { ...state, providerEndRequested: true }, requested: true };
}

export function markClosingComplete(
  state: InterviewTimeBoundaryState,
): InterviewTimeBoundaryState {
  if (state.phase === "COMPLETE" && state.navigationRequested) return state;
  return {
    ...advanceInterviewClosingPhase(state, "COMPLETE"),
    navigationRequested: true,
  };
}

// Compatibility alias retained for the existing boundary regression suite.
export const markLocalClosingComplete = markClosingComplete;

function monotonicNow(): number {
  return typeof performance !== "undefined" && typeof performance.now === "function"
    ? performance.now()
    : Date.now();
}

function boundedOpaqueHash(value: unknown): string {
  const text = String(value || "").slice(0, 512);
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36).padStart(7, "0").slice(0, 10);
}

function primitiveNonNegativeInteger(...values: unknown[]): number | null {
  for (const value of values) {
    if (typeof value === "number" && Number.isInteger(value) && value >= 0) return value;
  }
  return null;
}

function boundedPrimitiveString(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value !== "string") continue;
    const normalized = value.trim();
    if (normalized && normalized.length <= 200) return normalized;
  }
  return "";
}

export function normalizePalSpeakingEvent(
  payload: unknown,
  activeConversationId: string,
  localOrdinal = 1,
): NormalizedPalSpeakingEvent | null {
  const data = payload && typeof payload === "object" ? payload as Record<string, any> : {};
  const properties = data.properties && typeof data.properties === "object" && !Array.isArray(data.properties)
    ? data.properties as Record<string, unknown>
    : {};
  const eventType = String(data.event_type || data.eventType || "").trim().toLowerCase();
  const explicitRole = String(properties.role || data.role || "").trim().toLowerCase();
  const roleSpecificReplica = /(?:^|[._-])(?:replica|pal|assistant|agent)[._-](?:started|stopped)[._-]speaking$/.test(eventType);
  const replicaRole = ["replica", "pal", "assistant", "agent"].includes(explicitRole) || roleSpecificReplica;
  if (!replicaRole) return null;

  const kind = /(?:^|[._-])stopped[._-]speaking$/.test(eventType)
    ? "stopped"
    : /(?:^|[._-])started[._-]speaking$/.test(eventType)
      ? "started"
      : null;
  if (!kind) return null;

  const conversationId = boundedPrimitiveString(
    properties.conversation_id,
    data.conversation_id,
    data.conversationId,
    activeConversationId,
  );
  const providerSequence = primitiveNonNegativeInteger(
    properties.seq,
    properties.sequence,
    properties.event_sequence,
    properties.turn_sequence,
    properties.turn_index,
    data.seq,
    data.sequence,
    data.event_sequence,
    data.turn_sequence,
    data.turn_index,
    data.turn_idx,
  );
  const inferenceId = boundedPrimitiveString(properties.inference_id, data.inference_id);
  const turnIndex = primitiveNonNegativeInteger(
    properties.turn_index,
    properties.turn_idx,
    data.turn_index,
    data.turn_idx,
  );
  const providerCorrelation = Boolean(inferenceId) || providerSequence !== null || turnIndex !== null;
  const safeLocalOrdinal =
    typeof localOrdinal === "number" && Number.isInteger(localOrdinal) && localOrdinal >= 0
      ? localOrdinal
      : 0;
  const turnIdentity = inferenceId ||
    (providerCorrelation
      ? `sequence:${providerSequence ?? turnIndex}`
      : `local:${conversationId}:${kind}:${safeLocalOrdinal}`);
  const interruptedValue = properties.interrupted ?? data.interrupted;
  const interrupted = interruptedValue === true || String(interruptedValue || "").toLowerCase() === "true";
  const applicationControl =
    inferenceId.startsWith(`${CANDIDATE_INACTIVITY_NUDGE_INFERENCE_PREFIX}-`) ||
    inferenceId.startsWith(`${CLOSING_FAREWELL_INFERENCE_PREFIX}-`);

  return {
    kind,
    conversationId,
    turnKey: boundedOpaqueHash(`replica:${turnIdentity}`),
    providerSequence,
    interrupted,
    applicationControl,
    inferenceId,
    correlation: providerCorrelation ? "provider" : "local",
  };
}

export function normalizeCorrelatedRolelessPalStop(
  payload: unknown,
  activeConversationId: string,
  localOrdinal: number,
  replicaSpeechOpen: boolean,
  candidateSpeaking: boolean,
): NormalizedPalSpeakingEvent | null {
  if (!replicaSpeechOpen || candidateSpeaking) return null;
  const data = payload && typeof payload === "object" ? payload as Record<string, any> : {};
  const properties = data.properties && typeof data.properties === "object" && !Array.isArray(data.properties)
    ? data.properties as Record<string, unknown>
    : {};
  const eventType = String(data.event_type || data.eventType || "").trim().toLowerCase();
  const explicitRole = String(properties.role || data.role || "").trim();
  // Tavus occasionally omits the documented role on the generic stop event.
  // Treat it as the end of the replica span only when a qualified replica
  // start is already open and candidate speech is not active. An unattributed
  // event can never open a replica span by itself.
  if (eventType !== "conversation.stopped_speaking" || explicitRole) return null;
  return normalizePalSpeakingEvent({
    ...data,
    properties: { ...properties, role: "replica" },
  }, activeConversationId, localOrdinal);
}

export function createCandidateInactivityNudgeState(
  enabled: boolean,
  interviewId: string,
  conversationId: string,
): CandidateInactivityNudgeState {
  const normalizedInterviewId = String(interviewId || "").trim();
  const normalizedConversationId = String(conversationId || "").trim();
  const active = enabled === true && Boolean(normalizedInterviewId) && Boolean(normalizedConversationId);
  return {
    phase: active ? "DISARMED" : "DISABLED",
    enabled: active,
    interviewId: normalizedInterviewId,
    conversationId: normalizedConversationId,
    activeTurnKey: null,
    activeTurnSequence: null,
    highestProviderSequence: null,
    processedTurnKeys: [],
    armedAt: null,
    deadlineAt: null,
  };
}

function inactivityEligibilityFailure(
  eligibility: CandidateInactivityEligibility,
): CandidateInactivityNudgeReason | null {
  if (
    eligibility.phase === "AVATAR_CLOSING" ||
    String(eligibility.phase) === "LOCAL_CLOSING"
  ) return "closing";
  if (eligibility.phase === "COMPLETE") return "termination";
  if (
    typeof eligibility.remainingSeconds === "number" &&
    eligibility.remainingSeconds <= 0
  ) return "closing";
  if (eligibility.candidateSpeaking) return "candidate_speaking";
  if (eligibility.reconnectActive) return "reconnect";
  if (!eligibility.transportHealthy) return "transport_unhealthy";
  if (!eligibility.candidateMediaHealthy) return "candidate_media_unavailable";
  if (!eligibility.replicaPresent) return "replica_absent";
  if (!eligibility.remoteAudioReady) return "remote_audio_unavailable";
  if (!eligibility.documentVisible) return "hidden_document";
  if (!eligibility.runtimeOwner) return "runtime_ownership_lost";
  return null;
}

export function armCandidateInactivityNudge(
  state: CandidateInactivityNudgeState,
  event: NormalizedPalSpeakingEvent,
  now: number,
  eligibility: CandidateInactivityEligibility,
): CandidateInactivityTransition {
  if (!state.enabled || state.phase === "DISABLED" || state.phase === "TERMINAL") {
    return { state, action: "none" };
  }
  if (event.kind !== "stopped") return { state, action: "none" };
  if (state.phase === "WAITING_FOR_CANDIDATE_AFTER_NUDGE" || state.phase === "NUDGE_DISPATCHED") {
    return { state, action: "none" };
  }
  if (event.conversationId !== state.conversationId) {
    return {
      state: {
        ...state,
        phase: "SUPPRESSED",
        activeTurnKey: null,
        activeTurnSequence: null,
        armedAt: null,
        deadlineAt: null,
      },
      action: "suppressed",
      reason: "wrong_conversation",
    };
  }
  if (event.applicationControl) {
    return {
      state: {
        ...state,
        phase: "SUPPRESSED",
        activeTurnKey: null,
        activeTurnSequence: null,
        armedAt: null,
        deadlineAt: null,
      },
      action: "suppressed",
      reason: "application_control_turn",
    };
  }
  if (event.interrupted) {
    return {
      state: {
        ...state,
        phase: "SUPPRESSED",
        activeTurnKey: null,
        activeTurnSequence: null,
        armedAt: null,
        deadlineAt: null,
      },
      action: "suppressed",
      reason: "interrupted_pal_turn",
    };
  }
  if (state.processedTurnKeys.includes(event.turnKey)) {
    return { state, action: "suppressed", reason: "duplicate_turn" };
  }
  if (
    event.providerSequence !== null &&
    state.highestProviderSequence !== null &&
    event.providerSequence <= state.highestProviderSequence
  ) {
    return { state, action: "suppressed", reason: "stale_sequence" };
  }
  // Multiple provider schemas may describe the same stop. Once a quiet
  // window is armed, another stop cannot extend it; a new PAL start cancels
  // the window before a later genuine turn may arm a fresh one.
  if (state.phase === "ARMED_AFTER_PAL_TURN") {
    return { state, action: "suppressed", reason: "duplicate_turn" };
  }

  const highestProviderSequence = event.providerSequence === null
    ? state.highestProviderSequence
    : Math.max(state.highestProviderSequence ?? -1, event.providerSequence);
  const processedTurnKeys = [...state.processedTurnKeys, event.turnKey].slice(-MAX_PROCESSED_INACTIVITY_TURNS);
  const reason = inactivityEligibilityFailure(eligibility);
  if (reason) {
    return {
      state: {
        ...state,
        phase: "SUPPRESSED",
        activeTurnKey: null,
        activeTurnSequence: null,
        highestProviderSequence,
        processedTurnKeys,
        armedAt: null,
        deadlineAt: null,
      },
      action: "suppressed",
      reason,
    };
  }

  return {
    state: {
      ...state,
      phase: "ARMED_AFTER_PAL_TURN",
      activeTurnKey: event.turnKey,
      activeTurnSequence: event.providerSequence,
      highestProviderSequence,
      processedTurnKeys,
      armedAt: now,
      deadlineAt: now + CANDIDATE_INACTIVITY_NUDGE_THRESHOLD_MS,
    },
    action: "armed",
  };
}

export function cancelCandidateInactivityNudge(
  state: CandidateInactivityNudgeState,
  reason: CandidateInactivityNudgeReason,
  terminal = false,
): CandidateInactivityTransition {
  if (!state.enabled || state.phase === "DISABLED" || state.phase === "TERMINAL") {
    return { state, action: "none" };
  }
  if (state.phase !== "ARMED_AFTER_PAL_TURN") {
    if (terminal) {
      return {
        state: {
          ...state,
          phase: "TERMINAL",
          activeTurnKey: null,
          activeTurnSequence: null,
          armedAt: null,
          deadlineAt: null,
        },
        action: "cancelled",
        reason,
      };
    }
    return { state, action: "none" };
  }
  return {
    state: {
      ...state,
      phase: terminal ? "TERMINAL" : "CANCELLED",
      activeTurnKey: null,
      activeTurnSequence: null,
      armedAt: null,
      deadlineAt: null,
    },
    action: "cancelled",
    reason,
  };
}

export function recordCandidateActivityForInactivityNudge(
  state: CandidateInactivityNudgeState,
  reason: "candidate_speaking" | "candidate_utterance",
): CandidateInactivityTransition {
  if (!state.enabled || state.phase === "DISABLED" || state.phase === "TERMINAL") {
    return { state, action: "none" };
  }
  const action = state.phase === "ARMED_AFTER_PAL_TURN" ? "cancelled" : "candidate_activity";
  return {
    state: {
      ...state,
      phase: "DISARMED",
      activeTurnKey: null,
      activeTurnSequence: null,
      armedAt: null,
      deadlineAt: null,
    },
    action,
    reason,
  };
}

export function evaluateCandidateInactivityDeadline(
  state: CandidateInactivityNudgeState,
  now: number,
  eligibility: CandidateInactivityEligibility,
): CandidateInactivityTransition {
  if (state.phase !== "ARMED_AFTER_PAL_TURN" || state.deadlineAt === null) {
    return { state, action: "none" };
  }
  if (now < state.deadlineAt) return { state, action: "none" };
  const lateness = Math.max(0, now - state.deadlineAt);
  const latenessBucket = lateness === 0 ? "on_time" : lateness <= CANDIDATE_INACTIVITY_NUDGE_MAX_LATENESS_MS ? "within_2s" : "over_2s";
  if (lateness > CANDIDATE_INACTIVITY_NUDGE_MAX_LATENESS_MS) {
    return {
      state: {
        ...state,
        phase: "SUPPRESSED",
        activeTurnKey: null,
        activeTurnSequence: null,
        armedAt: null,
        deadlineAt: null,
      },
      action: "suppressed",
      reason: "late_timer",
      latenessBucket,
    };
  }
  const reason = inactivityEligibilityFailure(eligibility);
  if (reason) {
    return {
      state: {
        ...state,
        phase: "SUPPRESSED",
        activeTurnKey: null,
        activeTurnSequence: null,
        armedAt: null,
        deadlineAt: null,
      },
      action: "suppressed",
      reason,
      latenessBucket,
    };
  }
  if (!state.activeTurnKey) {
    return {
      state: {
        ...state,
        phase: "SUPPRESSED",
        activeTurnKey: null,
        activeTurnSequence: null,
        armedAt: null,
        deadlineAt: null,
      },
      action: "suppressed",
      reason: "ambiguous_state",
      latenessBucket,
    };
  }
  return {
    state: { ...state, phase: "NUDGE_DISPATCHED", armedAt: null, deadlineAt: null },
    action: "send",
    latenessBucket,
  };
}

export function recordCandidateInactivityNudgeDispatch(
  state: CandidateInactivityNudgeState,
  sent: boolean,
): CandidateInactivityTransition {
  if (state.phase !== "NUDGE_DISPATCHED") return { state, action: "none" };
  if (!sent) {
    return {
      state: {
        ...state,
        phase: "SUPPRESSED",
        activeTurnKey: null,
        activeTurnSequence: null,
      },
      action: "suppressed",
      reason: "dispatch_failed",
    };
  }
  return {
    state: { ...state, phase: "WAITING_FOR_CANDIDATE_AFTER_NUDGE" },
    action: "none",
  };
}

export function buildCandidateInactivityNudgeMessage(
  conversationId: string,
  turnKey: string,
) {
  return {
    message_type: "conversation",
    event_type: "conversation.echo",
    conversation_id: conversationId,
    properties: {
      modality: "text",
      text: CANDIDATE_INACTIVITY_NUDGE_TEXT,
      done: true,
      inference_id: `${CANDIDATE_INACTIVITY_NUDGE_INFERENCE_PREFIX}-${boundedOpaqueHash(turnKey)}`,
    },
  };
}

export function closingApplicationInferenceId(conversationId: string): string {
  return `${CLOSING_FAREWELL_INFERENCE_PREFIX}-${boundedOpaqueHash(conversationId)}`;
}

export function buildReplicaInterruptMessage(conversationId: string) {
  return {
    message_type: "conversation",
    event_type: "conversation.interrupt",
    conversation_id: conversationId,
  };
}

export function buildFinalClosingAnnouncementMessage(
  conversationId: string,
  inferenceId = closingApplicationInferenceId(conversationId),
) {
  return {
    message_type: "conversation",
    event_type: "conversation.echo",
    conversation_id: conversationId,
    properties: {
      modality: "text",
      text: FINAL_CLOSING_ANNOUNCEMENT_TEXT,
      done: true,
      inference_id: inferenceId,
    },
  };
}

export function recordClosingEchoSpeechEvent(
  state: InterviewTimeBoundaryState,
  event: NormalizedPalSpeakingEvent,
  activeConversationId: string,
): {
  state: InterviewTimeBoundaryState;
  transition:
    | "none"
    | "speaking"
    | "completed"
    | "farewell_interrupted";
} {
  if (
    state.phase !== "AVATAR_CLOSING" ||
    (state.closingEchoPhase !== "DISPATCHED" && state.closingEchoPhase !== "SPEAKING") ||
    event.conversationId !== activeConversationId
  ) return { state, transition: "none" };

  if (event.kind === "started") {
    // The ordered interrupt + Echo owns the terminal turn. Tavus may emit a
    // provider-generated inference id instead of echoing the caller-supplied
    // id, so inference identity cannot be used to mute the only permitted
    // post-Echo replica span.
    if (event.interrupted || state.closingEchoPhase === "SPEAKING") {
      return { state, transition: "none" };
    }
    return {
      state: {
        ...state,
        closingEchoPhase: "SPEAKING",
        closingEchoStarted: true,
        farewellStartedSequence: event.providerSequence,
      },
      transition: "speaking",
    };
  }

  if (
    event.kind === "stopped" &&
    state.closingEchoPhase === "SPEAKING" &&
    state.closingEchoStarted &&
    state.farewellStartedSequence !== null &&
    event.providerSequence !== null &&
    event.providerSequence < state.farewellStartedSequence
  ) {
    return { state, transition: "none" };
  }
  if (event.kind === "stopped" && state.closingEchoStarted && event.interrupted) {
    return {
      state: markClosingEchoFallback(state, "farewell_interrupted"),
      transition: "farewell_interrupted",
    };
  }
  if (event.kind === "stopped" && state.closingEchoStarted && !event.interrupted) {
    return { state: markClosingEchoCompleted(state), transition: "completed" };
  }
  return { state, transition: "none" };
}

type CandidateInactivityLeaseStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function candidateInactivityLeaseKey(conversationId: string): string {
  return `${CANDIDATE_INACTIVITY_LEASE_PREFIX}:${boundedOpaqueHash(conversationId)}`;
}

function readCandidateInactivityLease(
  storage: CandidateInactivityLeaseStorage,
  conversationId: string,
): { owner: string; expiresAt: number } | null {
  try {
    const parsed = JSON.parse(storage.getItem(candidateInactivityLeaseKey(conversationId)) || "null");
    if (
      !parsed ||
      typeof parsed.owner !== "string" ||
      !parsed.owner ||
      !Number.isFinite(parsed.expiresAt)
    ) return null;
    return { owner: parsed.owner.slice(0, 80), expiresAt: Number(parsed.expiresAt) };
  } catch {
    return null;
  }
}

export function acquireCandidateInactivityLease(
  storage: CandidateInactivityLeaseStorage,
  conversationId: string,
  tabId: string,
  now: number,
  visible: boolean,
): boolean {
  if (!conversationId || !tabId || !visible) return false;
  const current = readCandidateInactivityLease(storage, conversationId);
  if (current && current.owner !== tabId && current.expiresAt > now) return false;
  try {
    storage.setItem(
      candidateInactivityLeaseKey(conversationId),
      JSON.stringify({ owner: tabId.slice(0, 80), expiresAt: now + CANDIDATE_INACTIVITY_LEASE_MS }),
    );
    return readCandidateInactivityLease(storage, conversationId)?.owner === tabId;
  } catch {
    return false;
  }
}

export function ownsCandidateInactivityLease(
  storage: CandidateInactivityLeaseStorage,
  conversationId: string,
  tabId: string,
  now: number,
): boolean {
  const current = readCandidateInactivityLease(storage, conversationId);
  return Boolean(current && current.owner === tabId && current.expiresAt > now);
}

export function releaseCandidateInactivityLease(
  storage: CandidateInactivityLeaseStorage,
  conversationId: string,
  tabId: string,
): void {
  try {
    if (readCandidateInactivityLease(storage, conversationId)?.owner === tabId) {
      storage.removeItem(candidateInactivityLeaseKey(conversationId));
    }
  } catch {}
}

export function remainingTimeBucket(remaining: number | null): "over_45" | "31_45" | "11_30" | "0_10" {
  if (typeof remaining !== "number" || remaining > 45) return "over_45";
  if (remaining > 30) return "31_45";
  if (remaining > 10) return "11_30";
  return "0_10";
}

export function remainingTimeBucketAtDeadline(
  deadlineAt: number | null,
  now: number,
): "over_45" | "31_45" | "11_30" | "0_10" {
  return remainingTimeBucket(remainingSecondsAtDeadline(deadlineAt, now));
}

export function audioLockElapsedBucket(
  elapsedMs: number,
): "under_250" | "250_749" | "750_1499" | "1500_1999" | "2000_plus" {
  if (!Number.isFinite(elapsedMs) || elapsedMs < 250) return "under_250";
  if (elapsedMs < 750) return "250_749";
  if (elapsedMs < 1500) return "750_1499";
  if (elapsedMs < 2000) return "1500_1999";
  return "2000_plus";
}

export function createCandidateSpeakingState(): CandidateSpeakingState {
  return {
    active: false,
    startedAt: null,
    expiresAt: null,
    lastWatchdogDiagnosticAt: null,
  };
}

export function beginCandidateSpeaking(
  state: CandidateSpeakingState,
  at: number,
): { state: CandidateSpeakingState; started: boolean } {
  if (state.active) return { state, started: false };
  return {
    started: true,
    state: {
      active: true,
      startedAt: at,
      expiresAt: at + CANDIDATE_SPEAKING_PROTECTION_MS,
      lastWatchdogDiagnosticAt: null,
    },
  };
}

export function endCandidateSpeaking(
  state: CandidateSpeakingState,
): { state: CandidateSpeakingState; ended: boolean } {
  if (!state.active) return { state, ended: false };
  return { state: createCandidateSpeakingState(), ended: true };
}

export function deriveCandidateSpeakingTransition(
  eventType: unknown,
  participantRole: unknown,
): CandidateSpeakingTransition {
  const normalizedEvent = String(eventType || "").trim().toLowerCase();
  const normalizedRole = String(participantRole || "").trim().toLowerCase();
  const isCandidate =
    normalizedRole === "candidate" ||
    normalizedRole === "user" ||
    normalizedRole === "participant";
  if (!isCandidate) return null;
  if (normalizedEvent === "conversation.started_speaking") return "started";
  if (normalizedEvent === "conversation.stopped_speaking") return "ended";
  return null;
}

export function evaluateProgressWatchdog(
  input: ProgressWatchdogInput,
): ProgressWatchdogEvaluation {
  const unchanged = (action: ProgressWatchdogAction = "none"): ProgressWatchdogEvaluation => ({
    action,
    candidateSpeaking: input.candidateSpeaking,
    emitDiagnostic: false,
  });

  if (
    !input.progressObserved ||
    input.recoveryInFlight ||
    input.recoveryActive ||
    !input.hasCall ||
    input.lastProgressAt === null
  ) {
    return unchanged();
  }

  if (input.now - input.lastProgressAt < PROGRESS_STALL_MS) return unchanged();

  if (input.candidateSpeaking.active) {
    const expiresAt = input.candidateSpeaking.expiresAt;
    if (expiresAt !== null && input.now < expiresAt) {
      const lastDiagnosticAt = input.candidateSpeaking.lastWatchdogDiagnosticAt;
      const emitDiagnostic =
        lastDiagnosticAt === null ||
        input.now - lastDiagnosticAt >= CANDIDATE_SPEAKING_DIAGNOSTIC_INTERVAL_MS;
      return {
        action: "skip_candidate_speaking",
        candidateSpeaking: emitDiagnostic
          ? { ...input.candidateSpeaking, lastWatchdogDiagnosticAt: input.now }
          : input.candidateSpeaking,
        emitDiagnostic,
      };
    }
    return {
      action: "candidate_speaking_expired",
      candidateSpeaking: createCandidateSpeakingState(),
      emitDiagnostic: true,
    };
  }

  if (
    input.lastAiSpeechStoppedAt !== null &&
    input.now - input.lastAiSpeechStoppedAt < IDLE_ENGAGEMENT_GRACE_MS
  ) {
    return unchanged();
  }

  return unchanged(input.recoveryAttempted ? "terminal" : "start_recovery");
}

const env = (
  typeof import.meta !== "undefined" && import.meta.env ? import.meta.env : {}
) as Record<string, string | undefined>;

function trimTrailingSlashes(value: string): string {
  return String(value || "").trim().replace(/\/+$/, "");
}

function firstBase(...values: Array<string | undefined>): string {
  for (const value of values) {
    const normalized = trimTrailingSlashes(value || "");
    if (normalized) return normalized;
  }
  return "";
}

const backendBase = firstBase(
  env.VITE_BACKEND_URL,
  env.VITE_API_URL,
  env.VITE_PUBLIC_BACKEND_URL,
  env.PUBLIC_BACKEND_URL,
  env.BACKEND_URL,
);

function joinUrl(base: string, path: string): string {
  if (!base) return path;
  if (base.endsWith("/") && path.startsWith("/")) return `${base.slice(0, -1)}${path}`;
  if (!base.endsWith("/") && !path.startsWith("/")) return `${base}/${path}`;
  return `${base}${path}`;
}

function readLiveState(): LiveSessionState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(LIVE_STATE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<LiveSessionState>;
    const conversationUrl = String(parsed?.conversation_url || "").trim();
    if (!conversationUrl) return null;
    const maxRaw = Number(parsed?.max_interview_minutes);
    return {
      conversation_url: conversationUrl,
      conversation_id: String(parsed?.conversation_id || "").trim(),
      interview_id: String(parsed?.interview_id || "").trim(),
      role_token: String(parsed?.role_token || "").trim(),
      max_interview_minutes: Number.isFinite(maxRaw) && maxRaw > 0 ? Math.floor(maxRaw) : null,
      silence_engagement_owner:
        parsed?.silence_engagement_owner === "application_inactivity" ||
        parsed?.silence_engagement_owner === "tavus_patient"
          ? parsed.silence_engagement_owner
          : "prompt",
      application_inactivity_control_enabled:
        parsed?.application_inactivity_control_enabled === true &&
        parsed?.silence_engagement_owner === "application_inactivity",
      email: parsed?.email ? String(parsed.email) : undefined,
      candidate_id: parsed?.candidate_id ? String(parsed.candidate_id) : undefined,
      role_id: parsed?.role_id ? String(parsed.role_id) : undefined,
      candidate_assistance_contact: parsed?.candidate_assistance_contact ? String(parsed.candidate_assistance_contact) : undefined,
      selectedCameraDeviceId: parsed?.selectedCameraDeviceId ? String(parsed.selectedCameraDeviceId) : undefined,
      selectedMicrophoneDeviceId: parsed?.selectedMicrophoneDeviceId ? String(parsed.selectedMicrophoneDeviceId) : undefined,
    };
  } catch {
    return null;
  }
}

function loadDailySdk(): Promise<DailySdk> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Daily SDK can only run in the browser."));
  }
  if (window.DailyIframe?.createCallObject) return Promise.resolve(window.DailyIframe);

  return new Promise((resolve, reject) => {
    const existing = document.getElementById(DAILY_SCRIPT_ID) as HTMLScriptElement | null;
    if (existing) {
      const onLoad = () => {
        if (window.DailyIframe?.createCallObject) resolve(window.DailyIframe);
        else reject(new Error("Daily SDK failed to initialize."));
      };
      const onError = () => reject(new Error("Failed to load Daily SDK."));
      existing.addEventListener("load", onLoad, { once: true });
      existing.addEventListener("error", onError, { once: true });
      return;
    }

    const script = document.createElement("script");
    script.id = DAILY_SCRIPT_ID;
    script.src = DAILY_SCRIPT_SRC;
    script.async = true;
    script.onload = () => {
      if (window.DailyIframe?.createCallObject) resolve(window.DailyIframe);
      else reject(new Error("Daily SDK failed to initialize."));
    };
    script.onerror = () => reject(new Error("Failed to load Daily SDK."));
    document.head.appendChild(script);
  });
}

function remoteCountBucket(count: number): "zero" | "one" | "multiple" {
  if (count <= 0) return "zero";
  return count === 1 ? "one" : "multiple";
}

function normalizeSubscription(slot?: DailyTrackSlot): SubscriptionState {
  if (!slot || !("subscribed" in slot)) return "unknown";
  if (slot.subscribed === "staged") return "staged";
  if (slot.subscribed === true) return "subscribed";
  if (slot.subscribed === false) return "unsubscribed";
  return "unknown";
}

function liveTrack(slot?: DailyTrackSlot): MediaStreamTrack | null {
  const track = slot?.track || slot?.persistentTrack || null;
  return track && track.readyState !== "ended" ? track : null;
}

export function normalizeRemoteTrackState(slot?: DailyTrackSlot): NormalizedRemoteTrackState {
  if (!slot) return "absent";
  const raw = String(slot.state || "").toLowerCase();
  if (["blocked", "off", "sendable", "loading", "interrupted"].includes(raw)) {
    return raw as NormalizedRemoteTrackState;
  }
  if (raw === "playable") return liveTrack(slot) ? "playable" : "unavailable";
  if (!raw) return liveTrack(slot) ? "unknown" : "unavailable";
  return "unknown";
}

function preferredRemoteSlot(
  participants: DailyParticipant[],
  kind: "audio" | "video",
): DailyTrackSlot | undefined {
  const slots = participants.map((participant) => participant?.tracks?.[kind]).filter(Boolean) as DailyTrackSlot[];
  return slots.find((slot) => normalizeRemoteTrackState(slot) === "playable")
    || slots.find((slot) => normalizeRemoteTrackState(slot) === "loading")
    || slots[0];
}

export function snapshotRemoteParticipants(participants: DailyParticipant[]): RemoteParticipantEvidence {
  const remotes = participants.filter((participant) => participant?.local !== true);
  const audio = preferredRemoteSlot(remotes, "audio");
  const video = preferredRemoteSlot(remotes, "video");
  const audioState = normalizeRemoteTrackState(audio);
  const videoState = normalizeRemoteTrackState(video);
  return {
    remotePresent: remotes.length > 0,
    remoteAudioReady: audioState === "playable",
    remoteVideoReady: videoState === "playable",
    remoteParticipantCount: Math.min(16, remotes.length),
    remoteParticipantCountBucket: remoteCountBucket(remotes.length),
    audioState,
    videoState,
    audioPersistentTrackPresent: Boolean(audio?.persistentTrack),
    videoPersistentTrackPresent: Boolean(video?.persistentTrack),
    audioSubscriptionState: normalizeSubscription(audio),
    videoSubscriptionState: normalizeSubscription(video),
    audioTrackPresent: Boolean(liveTrack(audio)),
    videoTrackPresent: Boolean(liveTrack(video)),
  };
}

function emptyRemoteEvidence(): RemoteParticipantEvidence {
  return snapshotRemoteParticipants([]);
}

export function deriveStartupReadiness(
  evidence: RemoteParticipantEvidence,
  replicaProgressConfirmed: boolean,
  recovering: boolean,
): StartupReadinessState {
  if (recovering) return "startup_recovering";
  if (replicaProgressConfirmed) return "replica_progress_confirmed";
  if (evidence.remoteVideoReady) return "remote_video_playable";
  if (!evidence.remotePresent) return "waiting_for_remote_participant";
  if (evidence.videoState === "loading") return "remote_video_loading";
  if (evidence.remoteAudioReady && !evidence.remoteVideoReady) return "remote_participant_audio_only";
  return "remote_participant_present";
}

export function transitionStartupReadiness(
  current: StartupReadinessState,
  next: StartupReadinessState,
  newConversation: boolean,
): StartupReadinessState {
  if (newConversation) return next;
  if (current === "startup_failed") return current;
  if (next === "startup_failed" || next === "startup_recovering") return next;
  if (
    current === "remote_video_playable"
    || current === "replica_progress_confirmed"
    || current === "startup_ready"
  ) {
    return current;
  }
  return next;
}

export function deriveTrackStateTransition(
  kind: "audio" | "video",
  previous: NormalizedRemoteTrackState,
  next: NormalizedRemoteTrackState,
  evidence: RemoteParticipantEvidence,
  source: "participant_joined" | "participant_updated" | "participant_left" | "track_started" | "track_stopped" | "reconnect_enumeration" | "watchdog_snapshot",
  elapsedBucket: string,
  startupState: StartupReadinessState,
  reconnectPhase: ReconnectRecoveryPhase,
): ReliabilityDiagnosticEvent | null {
  if (previous === next) return null;
  return {
    event: "daily_remote_track_state_changed",
    metadata: {
      track_kind: kind,
      previous_track_state: previous,
      next_track_state: next,
      track_present: kind === "audio" ? evidence.audioTrackPresent : evidence.videoTrackPresent,
      persistent_track_present: kind === "audio"
        ? evidence.audioPersistentTrackPresent
        : evidence.videoPersistentTrackPresent,
      subscription_state: kind === "audio"
        ? evidence.audioSubscriptionState
        : evidence.videoSubscriptionState,
      startup_readiness_state: startupState,
      reconnect_phase: reconnectPhase,
      elapsed_since_join_bucket: elapsedBucket,
      transition_source: source,
    },
  };
}

function normalizeReceiveValue(value: unknown, kind: "audio" | "video"): string {
  if (value === false || value === "off") return "off";
  if (value === true || value === "full") return "full";
  if (value === "base") return "base";
  if (kind === "video" && value === "thumbnail") return "thumbnail";
  if (kind === "video" && value && typeof value === "object" && !Array.isArray(value)) {
    const layer = (value as { layer?: unknown }).layer;
    if (layer === 0) return "thumbnail";
    if (layer === 1) return "base";
    if (typeof layer === "number" && Number.isInteger(layer) && layer >= 2) return "full";
  }
  return "unknown";
}

export function normalizeDailyReceiveSettings(
  settings: unknown,
  reconnect: boolean,
  explicit = false,
): ReliabilityMetadata {
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) {
    return {
      audio_receive_state: "automatic",
      video_receive_state: "automatic",
      settings_source: "inherited_default",
      reconnect_active: reconnect,
    };
  }
  const source = settings as Record<string, unknown>;
  const base = source.base && typeof source.base === "object" && !Array.isArray(source.base)
    ? source.base as Record<string, unknown>
    : source;
  return {
    audio_receive_state: base.audio === undefined ? "automatic" : normalizeReceiveValue(base.audio, "audio"),
    video_receive_state: base.video === undefined ? "automatic" : normalizeReceiveValue(base.video, "video"),
    settings_source: explicit ? "explicit" : "inherited_default",
    reconnect_active: reconnect,
  };
}

export async function readDailyReceiveSettingsSnapshot(
  call: Pick<DailyCallObject, "getReceiveSettings"> | null,
  reconnect: boolean,
  explicitSettings?: unknown,
  explicit = false,
): Promise<ReliabilityMetadata> {
  let settings = explicitSettings;
  if (settings === undefined && call?.getReceiveSettings) {
    try {
      settings = await call.getReceiveSettings();
    } catch {
      return {
        audio_receive_state: "unavailable",
        video_receive_state: "unavailable",
        settings_source: "unavailable",
        reconnect_active: reconnect,
      };
    }
  }
  return normalizeDailyReceiveSettings(settings, reconnect, explicit);
}

export function classifyRemoteVideoAttachment(error: unknown):
  | "play_rejected_policy"
  | "play_rejected_media"
  | "play_rejected_unknown" {
  const name = error && typeof error === "object" && "name" in error
    ? String((error as { name?: unknown }).name || "")
    : "";
  if (["NotAllowedError", "SecurityError", "AbortError"].includes(name)) return "play_rejected_policy";
  if (["NotSupportedError", "EncodingError", "MediaError"].includes(name)) return "play_rejected_media";
  return "play_rejected_unknown";
}

function elapsedSinceJoinBucket(joinedAt: number | null, now = Date.now()): string {
  if (joinedAt === null) return "unavailable";
  const elapsed = Math.max(0, now - joinedAt);
  if (elapsed < 15000) return "under_15_seconds";
  if (elapsed <= 45000) return "15_45_seconds";
  if (elapsed <= 75000) return "46_75_seconds";
  return "over_75_seconds";
}

function recoveryAgeBucket(startedAt: number | null, now = Date.now()): string {
  if (startedAt === null) return "unavailable";
  const elapsed = Math.max(0, now - startedAt);
  if (elapsed < 5000) return "under_5_seconds";
  if (elapsed <= 15000) return "5_15_seconds";
  if (elapsed <= 30000) return "16_30_seconds";
  return "over_30_seconds";
}

export function deriveMissingProgressReason(
  evidence: RemoteParticipantEvidence,
  attachmentResult: string,
): string {
  if (!evidence.remotePresent) return "no_remote_participant";
  const missingAudio = !evidence.remoteAudioReady;
  const loadingVideo = evidence.videoState === "loading";
  const missingVideo = !evidence.remoteVideoReady;
  if (missingAudio && missingVideo) return "multiple_conditions";
  if (loadingVideo) return "video_loading";
  if (evidence.remoteAudioReady && missingVideo && evidence.videoState === "absent") return "audio_only";
  if (missingVideo) return "video_unavailable";
  if (!["play_resolved", "src_object_attached"].includes(attachmentResult)) return "media_attachment_unconfirmed";
  return "no_replica_speech";
}

function extractTrack(slot?: DailyTrackSlot): MediaStreamTrack | null {
  if (!slot) return null;
  const state = String(slot.state || "").toLowerCase();
  if (state && state !== "playable" && state !== "sendable") return null;
  return slot.persistentTrack || slot.track || null;
}

function isRemoteTrackReady(slot?: DailyTrackSlot): boolean {
  if (!slot) return false;
  const state = String(slot.state || "").toLowerCase();
  const track = slot.persistentTrack || slot.track || null;
  return Boolean(track && track.readyState !== "ended" && state === "playable");
}

export function createReconnectRecoveryState(): ReconnectRecoveryState {
  return {
    phase: "idle",
    attempt: 0,
    startedAt: null,
    localJoinedAt: null,
    remotePresent: false,
    remoteAudioReady: false,
    remoteVideoReady: false,
    progressAt: null,
    progressSource: null,
    terminalAt: null,
  };
}

export function isReconnectRecoveryActive(state: ReconnectRecoveryState): boolean {
  return (
    state.phase === "reconnecting_transport" ||
    state.phase === "awaiting_remote_presence" ||
    state.phase === "awaiting_remote_media" ||
    state.phase === "awaiting_practical_progress"
  );
}

export function reconnectRecoveryNotice(state: ReconnectRecoveryState): string {
  if (state.phase === "reconnecting_transport") return "Reconnecting to the interview…";
  if (
    state.phase === "awaiting_remote_presence" ||
    state.phase === "awaiting_remote_media" ||
    state.phase === "awaiting_practical_progress"
  ) {
    return "Reconnected. Waiting for the interviewer to resume…";
  }
  if (state.phase === "recovered") return "Connection restored.";
  return "";
}

function isReconnectProgressSource(value: unknown): value is ReconnectProgressSource {
  return value === "replica_started_speaking" || value === "replica_utterance";
}

export function advanceReconnectRecovery(
  state: ReconnectRecoveryState,
  event: ReconnectRecoveryEvent,
): ReconnectRecoveryState {
  if (state.phase === "recovered" || state.phase === "failed") return state;

  if (event.type === "start") {
    if (state.phase !== "idle" || state.attempt !== 0) return state;
    return {
      ...createReconnectRecoveryState(),
      phase: "reconnecting_transport",
      attempt: 1,
      startedAt: event.at,
    };
  }

  if (state.phase === "idle") return state;

  if (event.type === "join_failed" || event.type === "deadline") {
    return {
      ...state,
      phase: "failed",
      terminalAt: event.at,
    };
  }

  if (event.type === "local_joined") {
    if (state.phase !== "reconnecting_transport") return state;
    return {
      ...state,
      phase: "awaiting_remote_presence",
      localJoinedAt: event.at,
    };
  }

  if (event.type === "remote_state") {
    if (state.localJoinedAt === null) return state;
    const remotePresent = Boolean(event.remotePresent);
    const remoteAudioReady = remotePresent && Boolean(event.remoteAudioReady);
    const remoteVideoReady = remotePresent && Boolean(event.remoteVideoReady);
    return {
      ...state,
      phase: !remotePresent
        ? "awaiting_remote_presence"
        : !remoteAudioReady
          ? "awaiting_remote_media"
          : "awaiting_practical_progress",
      remotePresent,
      remoteAudioReady,
      remoteVideoReady,
    };
  }

  if (
    event.type === "practical_progress" &&
    isReconnectProgressSource(event.source) &&
    state.phase === "awaiting_practical_progress" &&
    state.remotePresent &&
    state.remoteAudioReady
  ) {
    return {
      ...state,
      phase: "recovered",
      progressAt: event.at,
      progressSource: event.source,
      terminalAt: event.at,
    };
  }

  return state;
}

function remoteMediaState(ready: boolean, present: boolean): "playable" | "unavailable" | "absent" {
  if (!present) return "absent";
  return ready ? "playable" : "unavailable";
}

export function deriveRemoteDiagnosticEvents(
  previous: RemoteParticipantEvidence | null,
  current: RemoteParticipantEvidence,
  context: RemoteDiagnosticContext,
): ReliabilityDiagnosticEvent[] {
  const prior = previous || emptyRemoteEvidence();
  const events: ReliabilityDiagnosticEvent[] = [];
  const recoveryMetadata: ReliabilityMetadata = context.recoveryActive
    ? {
        recovery_attempt: context.recoveryAttempt,
        recovery_phase: context.recoveryPhase,
        is_recovery_active: true,
      }
    : {};
  const participantMetadata = {
    participant_role: "replica",
    participant_count: current.remoteParticipantCount,
    remote_participant_present: current.remotePresent,
    ...recoveryMetadata,
  };

  if (!prior.remotePresent && current.remotePresent) {
    events.push({ event: "daily_participant_joined", metadata: participantMetadata });
    if (context.recoveryActive) {
      events.push({ event: "reconnect_remote_presence", metadata: participantMetadata });
    }
  } else if (prior.remotePresent && !current.remotePresent) {
    events.push({
      event: "daily_participant_left",
      metadata: participantMetadata,
    });
  }

  for (const [kind, previousReady, currentReady] of [
    ["audio", prior.remoteAudioReady, current.remoteAudioReady],
    ["video", prior.remoteVideoReady, current.remoteVideoReady],
  ] as const) {
    if (!previousReady && currentReady) {
      events.push({
        event: "daily_remote_track_started",
        metadata: {
          track_kind: kind,
          track_state: "playable",
          ...participantMetadata,
        },
      });
      if (kind === "audio" && context.recoveryActive) {
        events.push({
          event: "reconnect_remote_audio_ready",
          metadata: {
            remote_audio_state: "playable",
            ...participantMetadata,
          },
        });
      }
    } else if (previousReady && !currentReady) {
      events.push({
        event: "daily_remote_track_stopped",
        metadata: {
          track_kind: kind,
          track_state: "unavailable",
          ...participantMetadata,
        },
      });
    }
  }

  if (
    context.recoveryActive &&
    (
      prior.remotePresent !== current.remotePresent ||
      prior.remoteAudioReady !== current.remoteAudioReady ||
      prior.remoteVideoReady !== current.remoteVideoReady
    )
  ) {
    events.push({
      event: "reconnect_remote_media_changed",
      metadata: {
        remote_audio_state: remoteMediaState(current.remoteAudioReady, current.remotePresent),
        remote_video_state: remoteMediaState(current.remoteVideoReady, current.remotePresent),
        ...participantMetadata,
      },
    });
  }

  return events;
}

function setElementTrack(element: HTMLMediaElement | null, track: MediaStreamTrack | null): void {
  if (!element) return;
  if (!track) {
    if (element.srcObject) element.srcObject = null;
    return;
  }

  const current = element.srcObject instanceof MediaStream ? element.srcObject : null;
  const currentTrack = current?.getTracks?.()[0] || null;
  if (currentTrack !== track) {
    element.srcObject = new MediaStream([track]);
  }
  void element.play().catch(() => {});
}

function mediaElementReadyStateBucket(element: HTMLMediaElement | null): string {
  if (!element) return "unavailable";
  if (element.readyState <= 0) return "empty";
  if (element.readyState === 1) return "metadata";
  if (element.readyState === 2) return "current_data";
  if (element.readyState === 3) return "future_data";
  return "enough_data";
}

function mediaElementSizeBucket(element: HTMLMediaElement | null): string {
  if (!element) return "unavailable";
  return element.clientWidth > 0 && element.clientHeight > 0 ? "nonzero" : "zero";
}

export async function attachRemoteVideoTrack(
  element: HTMLVideoElement | null,
  track: MediaStreamTrack | null,
  trackState: NormalizedRemoteTrackState,
  reconnect: boolean,
): Promise<string[]> {
  if (!element) return ["element_not_ready"];
  if (!track) {
    try {
      if (element.srcObject) element.srcObject = null;
    } catch {
      return ["element_not_ready"];
    }
    return [trackState === "loading" ? "track_loading" : "no_track"];
  }
  if (track.readyState === "ended") {
    try {
      if (element.srcObject) element.srcObject = null;
    } catch {
      return ["element_not_ready"];
    }
    return ["track_ended"];
  }
  const outcomes: string[] = [];
  let currentTrack: MediaStreamTrack | null = null;
  try {
    const current = element.srcObject instanceof MediaStream ? element.srcObject : null;
    currentTrack = current?.getTracks?.()[0] || null;
    if (currentTrack !== track) {
      element.srcObject = new MediaStream([track]);
      outcomes.push(reconnect && currentTrack ? "replaced_after_reconnect" : "src_object_attached");
    }
  } catch {
    return ["element_not_ready"];
  }
  try {
    await element.play();
    outcomes.push("play_resolved");
  } catch (error) {
    outcomes.push(classifyRemoteVideoAttachment(error));
  }
  return outcomes;
}

function formatCountdown(seconds: number | null): string {
  if (seconds === null || seconds <= 0) return "";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function isCandidateAnswerProgress(text: string): boolean {
  const normalized = String(text || "").trim();
  const words = normalized.split(/\s+/).filter(Boolean);
  if (words.length < 5 || /\?\s*$/.test(normalized)) return false;
  return /\b(i|my|we|because|example|python|javascript|typescript|sql|project|team|built|led|managed|implemented|designed)\b/i.test(normalized);
}

export default function InterviewCviPage() {
  const [, setLocation] = useLocation();
  const [session] = useState<LiveSessionState | null>(() => readLiveState());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [finishBusy, setFinishBusy] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState<number | null>(null);
  const [connectionNotice, setConnectionNotice] = useState("");
  const [progressStalled, setProgressStalled] = useState(false);
  const [hasRemoteVideo, setHasRemoteVideo] = useState(false);
  const [hasLocalVideo, setHasLocalVideo] = useState(false);

  const callRef = useRef<DailyCallObject | null>(null);
  const leavingRef = useRef(false);
  const reconnectingRef = useRef(false);
  const endTriggeredRef = useRef(false);
  // This fallback belongs only to a normal conversational close. It is kept
  // separate from every timer-owned 0:00 ref and state transition below.
  const normalCompletionEndTimerRef = useRef<number | null>(null);
  const timerRuntimeRef = useRef<InterviewTimerRuntimeState | null>(null);
  const finalTerminationTimerRef = useRef<number | null>(null);
  const closingStartTimerRef = useRef<number | null>(null);
  const closingCompletionTimerRef = useRef<number | null>(null);
  const closingCallReadyTimerRef = useRef<number | null>(null);
  const closingOwnershipTakeoverTimerRef = useRef<number | null>(null);
  const closingDrainTimerRef = useRef<number | null>(null);
  const closingEchoGapTimerRef = useRef<number | null>(null);
  const avatarClosingActiveRef = useRef(false);
  const avatarClosingOwnedRef = useRef(false);
  const farewellAudioAudibleRef = useRef(false);
  const closingNavigationRef = useRef(false);
  const candidateAudioUnpublishRequestedRef = useRef(false);
  const replicaInterruptRequestedRef = useRef(false);
  const closingFinalInterruptRequestedRef = useRef(false);
  const closingEchoDispatchRequestedRef = useRef(false);
  const candidateAudioLockAbortRef = useRef<AbortController | null>(null);
  const startupReadyRef = useRef(false);
  const startupReadinessRef = useRef<StartupReadinessState>("waiting_for_remote_participant");
  const replicaProgressConfirmedRef = useRef(false);
  const startupRecoveryAttemptedRef = useRef(false);
  const startupTimerRef = useRef<number | null>(null);
  const roomJoinedAtRef = useRef<number | null>(null);
  const remoteSnapshotSignatureRef = useRef("");
  const reconnectBindingSignaturesRef = useRef<Record<string, string>>({});
  const remoteVideoAttachmentSignatureRef = useRef("");
  const remoteVideoAttachmentResultRef = useRef("no_track");
  const previousRemoteParticipantRef = useRef<DailyParticipant | null>(null);
  const previousRemoteAudioTrackRef = useRef<MediaStreamTrack | null>(null);
  const previousRemoteVideoTrackRef = useRef<MediaStreamTrack | null>(null);
  const telemetryEmitterRef = useRef<((event: string, metadata: ReliabilityMetadata) => void) | null>(null);
  const secondsRemainingRef = useRef<number | null>(null);
  const recordingStartRequestedRef = useRef(false);
  const progressObservedRef = useRef(false);
  const lastProgressAtRef = useRef<number | null>(null);
  const progressRecoveryAttemptedRef = useRef(false);
  const progressRecoveryInFlightRef = useRef(false);
  const progressRecoveryStateRef = useRef<ReconnectRecoveryState>(createReconnectRecoveryState());
  const lastAiSpeechAtRef = useRef<number | null>(null);
  const lastAiSpeechStoppedAtRef = useRef<number | null>(null);
  const replicaSpeakingRef = useRef(false);
  const candidateSpeakingStateRef = useRef<CandidateSpeakingState>(createCandidateSpeakingState());
  const inactivityStateRef = useRef<CandidateInactivityNudgeState>(
    createCandidateInactivityNudgeState(
      session?.application_inactivity_control_enabled === true,
      String(session?.interview_id || ""),
      String(session?.conversation_id || ""),
    ),
  );
  const inactivityTimerRef = useRef<number | null>(null);
  const inactivityLeaseTimerRef = useRef<number | null>(null);
  const inactivityRuntimeOwnerRef = useRef(false);
  const inactivityDocumentVisibleRef = useRef(
    typeof document !== "undefined" ? document.visibilityState === "visible" : false,
  );
  const inactivityTransportHealthyRef = useRef(false);
  const inactivityCandidateMediaHealthyRef = useRef(false);
  const inactivityRemoteEvidenceRef = useRef<RemoteParticipantEvidence | null>(null);
  const inactivityTabIdRef = useRef("");
  const finalClosingTabIdRef = useRef("");
  const palSpeechEventOrdinalRef = useRef(0);
  const telemetrySequenceRef = useRef(0);
  const telemetryPendingRef = useRef<Set<Promise<unknown>>>(new Set());
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  if (!finalClosingTabIdRef.current) {
    // Module lifetime is stable across React remounts but isolated per tab.
    // A full reload becomes a non-owner observer: it cannot replay the local
    // clip or provider mutation, and it remains terminal until completion.
    finalClosingTabIdRef.current = FINAL_CLOSING_TAB_RUNTIME_ID;
  }

  const clearStartupTimer = useCallback(() => {
    if (startupTimerRef.current) {
      window.clearTimeout(startupTimerRef.current);
      startupTimerRef.current = null;
    }
  }, []);

  const clearInactivityTimer = useCallback(() => {
    if (inactivityTimerRef.current) {
      window.clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = null;
    }
  }, []);

  const clearNormalCompletionEndTimer = useCallback(() => {
    if (normalCompletionEndTimerRef.current) {
      window.clearTimeout(normalCompletionEndTimerRef.current);
      normalCompletionEndTimerRef.current = null;
    }
  }, []);

  const clearAutoEndTimers = useCallback(() => {
    if (finalTerminationTimerRef.current) {
      window.clearTimeout(finalTerminationTimerRef.current);
      finalTerminationTimerRef.current = null;
    }
    if (closingStartTimerRef.current) {
      window.clearTimeout(closingStartTimerRef.current);
      closingStartTimerRef.current = null;
    }
    if (closingCompletionTimerRef.current) {
      window.clearTimeout(closingCompletionTimerRef.current);
      closingCompletionTimerRef.current = null;
    }
    if (closingCallReadyTimerRef.current) {
      window.clearTimeout(closingCallReadyTimerRef.current);
      closingCallReadyTimerRef.current = null;
    }
    if (closingOwnershipTakeoverTimerRef.current) {
      window.clearTimeout(closingOwnershipTakeoverTimerRef.current);
      closingOwnershipTakeoverTimerRef.current = null;
    }
    if (closingDrainTimerRef.current) {
      window.clearTimeout(closingDrainTimerRef.current);
      closingDrainTimerRef.current = null;
    }
    if (closingEchoGapTimerRef.current) {
      window.clearTimeout(closingEchoGapTimerRef.current);
      closingEchoGapTimerRef.current = null;
    }
  }, []);

  const persistBoundaryState = useCallback((state: InterviewTimeBoundaryState) => {
    const runtime = timerRuntimeRef.current;
    if (!runtime) return;
    const nextRuntime = { ...runtime, boundaryState: state };
    timerRuntimeRef.current = nextRuntime;
    preserveInterviewTimerRuntime(nextRuntime);
  }, []);

  const syncParticipants = useCallback((participants?: Record<string, DailyParticipant>): RemoteParticipantEvidence => {
    const map = participants || callRef.current?.participants?.() || {};
    const list = Object.values(map);
    const local = list.find((p) => Boolean(p?.local));
    const remotes = list.filter((p) => !p?.local);
    const evidence = snapshotRemoteParticipants(remotes);

    // A terminal-state remount can construct a fresh Daily runtime. Reassert
    // the best-effort discard once for that runtime without waiting for or
    // conditioning any farewell transition on provider confirmation.
    if (avatarClosingActiveRef.current && !candidateAudioUnpublishRequestedRef.current) {
      candidateAudioUnpublishRequestedRef.current = true;
      requestCandidateAudioUnpublish(callRef.current);
    }

    const localVideoTrack = extractTrack(local?.tracks?.video);
    const remoteVideoSlot = preferredRemoteSlot(remotes, "video");
    const remoteAudioSlot = preferredRemoteSlot(remotes, "audio");
    const remoteVideoTrack = extractTrack(remoteVideoSlot);
    const remoteAudioTrack = extractTrack(remoteAudioSlot);
    const localAudioTrack = extractTrack(local?.tracks?.audio);

    setElementTrack(localVideoRef.current, localVideoTrack);
    void attachRemoteVideoTrack(
      remoteVideoRef.current,
      remoteVideoTrack,
      evidence.videoState,
      reconnectingRef.current || isReconnectRecoveryActive(progressRecoveryStateRef.current),
    ).then((outcomes) => {
      if (endTriggeredRef.current) return;
      for (const outcome of outcomes) {
        remoteVideoAttachmentResultRef.current = outcome;
        const metadata = {
          video_attachment_result: outcome,
          video_track_state: evidence.videoState,
          element_ready_state_bucket: mediaElementReadyStateBucket(remoteVideoRef.current),
          element_visible: Boolean(remoteVideoRef.current && !remoteVideoRef.current.hidden),
          element_size_bucket: mediaElementSizeBucket(remoteVideoRef.current),
          reconnect_active: reconnectingRef.current || isReconnectRecoveryActive(progressRecoveryStateRef.current),
          elapsed_since_join_bucket: elapsedSinceJoinBucket(roomJoinedAtRef.current),
          startup_readiness_state: startupReadinessRef.current,
        };
        const signature = JSON.stringify(metadata);
        if (remoteVideoAttachmentSignatureRef.current === signature) continue;
        remoteVideoAttachmentSignatureRef.current = signature;
        telemetryEmitterRef.current?.("remote_video_attachment_result", metadata);
      }
    }).catch(() => {
      if (endTriggeredRef.current) return;
      remoteVideoAttachmentResultRef.current = "play_rejected_unknown";
      telemetryEmitterRef.current?.("remote_video_attachment_result", {
        video_attachment_result: "play_rejected_unknown",
        video_track_state: evidence.videoState,
        element_ready_state_bucket: mediaElementReadyStateBucket(remoteVideoRef.current),
        element_visible: Boolean(remoteVideoRef.current && !remoteVideoRef.current.hidden),
        element_size_bucket: mediaElementSizeBucket(remoteVideoRef.current),
        reconnect_active: reconnectingRef.current || isReconnectRecoveryActive(progressRecoveryStateRef.current),
        elapsed_since_join_bucket: elapsedSinceJoinBucket(roomJoinedAtRef.current),
        startup_readiness_state: startupReadinessRef.current,
      });
    });
    attachRemotePalAudioTrack(
      remoteAudioRef.current,
      remoteAudioTrack,
      avatarClosingActiveRef.current,
      farewellAudioAudibleRef.current,
    );

    const hasRemote = evidence.remoteVideoReady;
    setHasRemoteVideo(hasRemote);
    setHasLocalVideo(Boolean(localVideoTrack));
    inactivityCandidateMediaHealthyRef.current = Boolean(
      localAudioTrack && localAudioTrack.readyState !== "ended" && localAudioTrack.enabled,
    );
    const proposedReadiness = deriveStartupReadiness(
      evidence,
      replicaProgressConfirmedRef.current,
      reconnectingRef.current || isReconnectRecoveryActive(progressRecoveryStateRef.current),
    );
    const previousReadiness = startupReadinessRef.current;
    const nextReadiness = transitionStartupReadiness(previousReadiness, proposedReadiness, false);
    startupReadinessRef.current = nextReadiness;
    if (nextReadiness !== previousReadiness) {
      telemetryEmitterRef.current?.("startup_readiness_changed", {
        startup_readiness_state: nextReadiness,
        audio_track_state: evidence.audioState,
        video_track_state: evidence.videoState,
        remote_participant_count_bucket: evidence.remoteParticipantCountBucket,
        reconnect_phase: progressRecoveryStateRef.current.phase,
      });
    }
    if (["remote_video_playable", "replica_progress_confirmed", "startup_ready"].includes(nextReadiness)) {
      startupReadyRef.current = true;
      clearStartupTimer();
      setLoading(false);
      setError("");
    }
    inactivityRemoteEvidenceRef.current = evidence;
    return evidence;
  }, [clearStartupTimer]);

  const teardownCall = useCallback(async () => {
    clearStartupTimer();
    clearInactivityTimer();
    candidateAudioLockAbortRef.current?.abort();
    candidateAudioLockAbortRef.current = null;
    inactivityTransportHealthyRef.current = false;
    const call = callRef.current;
    callRef.current = null;
    if (!call) return;

    try {
      await call.leave().catch(() => {});
    } catch {}
    try {
      call.destroy();
    } catch {}

    setElementTrack(localVideoRef.current, null);
    setElementTrack(remoteVideoRef.current, null);
    suppressRemotePalAudio(remoteAudioRef.current);
  }, [clearInactivityTimer, clearStartupTimer]);

  const leaveLiveRoute = useCallback(async () => {
    if (leavingRef.current) return;
    leavingRef.current = true;
    await teardownCall();
    try {
      window.sessionStorage.removeItem(LIVE_STATE_KEY);
    } catch {}
    setLocation("/interview/complete");
  }, [setLocation, teardownCall]);

  const endInterview = useCallback(async (reason: string, stayOnPage = false): Promise<boolean> => {
    if (endTriggeredRef.current) {
      setFinishBusy(false);
      return false;
    }
    endTriggeredRef.current = true;
    if (stayOnPage) leavingRef.current = true;
    if (!stayOnPage) clearAutoEndTimers();
    let providerConfirmed = false;
    try {
      const conversationId = String(session?.conversation_id || "").trim();
      const interviewId = String(session?.interview_id || "").trim();
      const roleToken = String(session?.role_token || "").trim();
      if (backendBase && conversationId && interviewId && roleToken) {
        const response = await fetch(joinUrl(backendBase, "/tavus/end-conversation"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            conversation_id: conversationId,
            interview_id: interviewId,
            role_token: roleToken,
            reason,
          }),
          // Preserve the one reserved provider-end request across a route
          // remount or page teardown instead of issuing a second request.
          keepalive: true,
        });
        if (!response.ok) {
          console.warn("[InterviewCviPage] End interview request failed.", { reason, status: response.status });
        } else {
          providerConfirmed = true;
        }
      }
    } catch (error) {
      console.warn("[InterviewCviPage] Could not end interview cleanly. Closing this session now.", { reason, error });
      if (!stayOnPage) setError("Could not end interview cleanly. Closing this session now.");
    } finally {
      setFinishBusy(false);
      if (stayOnPage) await teardownCall();
      else await leaveLiveRoute();
    }
    return providerConfirmed;
  }, [clearAutoEndTimers, leaveLiveRoute, session, teardownCall]);

  const sendLifecycleTelemetry = useCallback((
    event: string,
    metadata: ReliabilityMetadata = {},
    options: { reason?: string; terminal?: boolean } = {},
  ) => {
    const eventSequence = telemetrySequenceRef.current + 1;
    const conversationId = String(session?.conversation_id || "").trim();
    const roleToken = String(session?.role_token || "").trim();
    const payload = {
      interview_id: String(session?.interview_id || "").trim(),
      event,
      event_sequence: eventSequence,
      observed_at: new Date().toISOString(),
      reason: options.reason,
      metadata,
    };
    if (!backendBase || !payload.interview_id || !conversationId || !roleToken) return;
    telemetrySequenceRef.current = eventSequence;
    const url = joinUrl(backendBase, "/tavus/client-telemetry");
    try {
      const pendingLimit = options.terminal
        ? MAX_PENDING_TELEMETRY_REQUESTS
        : MAX_PENDING_TELEMETRY_REQUESTS - 1;
      if (telemetryPendingRef.current.size >= pendingLimit) return;
      const authorization = btoa(JSON.stringify([roleToken, conversationId]));
      const request = fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `AlphaScreen-Telemetry ${authorization}`,
        },
        body: JSON.stringify(payload),
        keepalive: true,
      }).catch(() => {}).finally(() => {
        telemetryPendingRef.current.delete(request);
      });
      telemetryPendingRef.current.add(request);
    } catch {}
  }, [session]);

  useEffect(() => {
    telemetryEmitterRef.current = (event, metadata) => sendLifecycleTelemetry(event, metadata);
    return () => {
      telemetryEmitterRef.current = null;
    };
  }, [sendLifecycleTelemetry]);

  const currentInactivityEligibility = useCallback((): CandidateInactivityEligibility => {
    const remote = inactivityRemoteEvidenceRef.current;
    return {
      phase: timerRuntimeRef.current?.boundaryState.phase || "INTERVIEWING",
      remainingSeconds: secondsRemainingRef.current,
      candidateSpeaking: candidateSpeakingStateRef.current.active,
      reconnectActive:
        reconnectingRef.current ||
        progressRecoveryInFlightRef.current ||
        isReconnectRecoveryActive(progressRecoveryStateRef.current),
      transportHealthy: inactivityTransportHealthyRef.current,
      candidateMediaHealthy: inactivityCandidateMediaHealthyRef.current,
      replicaPresent: remote?.remotePresent === true,
      remoteAudioReady: remote?.remoteAudioReady === true,
      documentVisible: inactivityDocumentVisibleRef.current,
      runtimeOwner: inactivityRuntimeOwnerRef.current,
    };
  }, []);

  const inactivityTelemetryMetadata = useCallback((
    state: CandidateInactivityNudgeState,
    eligibility: CandidateInactivityEligibility,
    transition: CandidateInactivityTransition,
  ): ReliabilityMetadata => ({
    threshold_ms: CANDIDATE_INACTIVITY_NUDGE_THRESHOLD_MS,
    ...(state.activeTurnSequence !== null ? { turn_sequence: state.activeTurnSequence } : {}),
    inactivity_state: state.phase,
    ...(transition.reason ? { inactivity_reason: transition.reason } : {}),
    ...(transition.latenessBucket ? { timer_lateness_bucket: transition.latenessBucket } : {}),
    ownership_mode: "application_inactivity",
    candidate_speaking: eligibility.candidateSpeaking,
    reconnect_active: eligibility.reconnectActive,
    transport_healthy: eligibility.transportHealthy,
    replica_present: eligibility.replicaPresent,
    remote_audio_ready: eligibility.remoteAudioReady,
    runtime_owner: eligibility.runtimeOwner,
  }), []);

  const commitInactivityTransition = useCallback((
    transition: CandidateInactivityTransition,
    eligibility = currentInactivityEligibility(),
  ) => {
    inactivityStateRef.current = transition.state;
    if (
      transition.action === "cancelled" ||
      (transition.action === "suppressed" && transition.state.phase !== "ARMED_AFTER_PAL_TURN") ||
      transition.action === "candidate_activity"
    ) clearInactivityTimer();

    const event = transition.action === "armed"
      ? "candidate_inactivity_nudge_armed"
      : transition.action === "cancelled"
        ? "candidate_inactivity_nudge_cancelled"
        : transition.action === "suppressed"
          ? "candidate_inactivity_nudge_suppressed"
          : null;
    if (event) {
      sendLifecycleTelemetry(
        event,
        inactivityTelemetryMetadata(transition.state, eligibility, transition),
      );
    }
  }, [clearInactivityTimer, currentInactivityEligibility, inactivityTelemetryMetadata, sendLifecycleTelemetry]);

  const cancelInactivityRuntime = useCallback((
    reason: CandidateInactivityNudgeReason,
    terminal = false,
  ) => {
    const transition = cancelCandidateInactivityNudge(
      inactivityStateRef.current,
      reason,
      terminal,
    );
    commitInactivityTransition(transition);
  }, [commitInactivityTransition]);

  const recordInactivityCandidateActivity = useCallback((
    reason: "candidate_speaking" | "candidate_utterance",
  ) => {
    const transition = recordCandidateActivityForInactivityNudge(
      inactivityStateRef.current,
      reason,
    );
    commitInactivityTransition(transition);
  }, [commitInactivityTransition]);

  const armInactivityRuntime = useCallback((event: NormalizedPalSpeakingEvent) => {
    const eligibility = currentInactivityEligibility();
    const transition = armCandidateInactivityNudge(
      inactivityStateRef.current,
      event,
      monotonicNow(),
      eligibility,
    );
    commitInactivityTransition(transition, eligibility);
    if (transition.action !== "armed" || transition.state.deadlineAt === null) return;

    clearInactivityTimer();
    inactivityTimerRef.current = window.setTimeout(() => {
      inactivityTimerRef.current = null;
      const conversationId = String(session?.conversation_id || "").trim();
      if (
        conversationId &&
        inactivityTabIdRef.current &&
        typeof window !== "undefined"
      ) {
        inactivityRuntimeOwnerRef.current = ownsCandidateInactivityLease(
          window.localStorage,
          conversationId,
          inactivityTabIdRef.current,
          Date.now(),
        );
      }
      const deadlineEligibility = currentInactivityEligibility();
      const deadline = evaluateCandidateInactivityDeadline(
        inactivityStateRef.current,
        monotonicNow(),
        deadlineEligibility,
      );
      inactivityStateRef.current = deadline.state;
      if (deadline.action !== "send") {
        commitInactivityTransition(deadline, deadlineEligibility);
        return;
      }

      const activeTurnKey = deadline.state.activeTurnKey;
      const call = callRef.current;
      let sent = false;
      if (conversationId && activeTurnKey && call?.sendAppMessage) {
        try {
          call.sendAppMessage(
            buildCandidateInactivityNudgeMessage(conversationId, activeTurnKey),
            "*",
          );
          sent = true;
        } catch {}
      }
      const dispatched = recordCandidateInactivityNudgeDispatch(deadline.state, sent);
      inactivityStateRef.current = dispatched.state;
      if (sent) {
        sendLifecycleTelemetry(
          "candidate_inactivity_nudge_sent",
          inactivityTelemetryMetadata(dispatched.state, deadlineEligibility, deadline),
        );
      } else {
        commitInactivityTransition(dispatched, deadlineEligibility);
      }
    }, CANDIDATE_INACTIVITY_NUDGE_THRESHOLD_MS);
  }, [
    clearInactivityTimer,
    commitInactivityTransition,
    currentInactivityEligibility,
    inactivityTelemetryMetadata,
    sendLifecycleTelemetry,
    session?.conversation_id,
  ]);


  const completeClosingNavigation = useCallback((
    _fallbackReason?: NonNullable<InterviewTimeBoundaryState["closingEchoFallbackReason"]> | "observer_reload",
  ) => {
    if (closingNavigationRef.current) return;
    closingNavigationRef.current = true;
    clearAutoEndTimers();
    const current = timerRuntimeRef.current?.boundaryState || createInterviewTimeBoundaryState();
    const completed = markClosingComplete(current);
    persistBoundaryState(completed);
    const conversationId = String(session?.conversation_id || "").trim();
    if (avatarClosingOwnedRef.current && conversationId && typeof window !== "undefined") {
      advanceSharedFinalClosingRuntime(
        window.localStorage,
        conversationId,
        finalClosingTabIdRef.current,
        "COMPLETE",
      );
    }
    try {
      window.sessionStorage.removeItem(LIVE_STATE_KEY);
    } catch {}
    setLocation("/interview/complete");
  }, [clearAutoEndTimers, persistBoundaryState, session?.conversation_id, setLocation]);

  const requestClosingProviderEnd = useCallback(async (
    terminalReason: NonNullable<InterviewTimeBoundaryState["closingEchoFallbackReason"]> | "farewell_completed" | "observer_reload",
  ) => {
    if (!avatarClosingOwnedRef.current) {
      completeClosingNavigation("observer_reload");
      return false;
    }
    const conversationId = String(session?.conversation_id || "").trim();
    if (!conversationId || typeof window === "undefined") {
      completeClosingNavigation("observer_reload");
      return false;
    }
    const current = timerRuntimeRef.current?.boundaryState || createInterviewTimeBoundaryState();
    const requested = markProviderEndRequested(current);
    if (!requested.requested) return false;
    const claim = advanceSharedFinalClosingRuntime(
      window.localStorage,
      conversationId,
      finalClosingTabIdRef.current,
      "PROVIDER_END_REQUESTED",
    );
    if (!sharedProviderEndAttemptAllowed(claim)) {
      avatarClosingOwnedRef.current = false;
      completeClosingNavigation("observer_reload");
      return false;
    }
    persistBoundaryState(requested.state);
    sendLifecycleTelemetry("provider_end_requested", {
      closing_state: "PROVIDER_END_REQUESTED",
      remaining_time_bucket: "0_10",
      provider_end_result_category: "requested",
      provider_end_reason: terminalReason,
    });
    const confirmed = await endInterview("time_limit_avatar_farewell_complete", true);
    if (confirmed) {
      const latest = timerRuntimeRef.current?.boundaryState || requested.state;
      persistBoundaryState(markProviderEndConfirmed(latest));
    }
    sendLifecycleTelemetry("provider_end_confirmed", {
      closing_state: "PROVIDER_END_REQUESTED",
      remaining_time_bucket: "0_10",
      provider_end_result_category: confirmed ? "confirmed" : "unconfirmed",
      provider_end_reason: terminalReason,
    }, { terminal: true });
    completeClosingNavigation(terminalReason === "farewell_completed" ? undefined : terminalReason);
    return confirmed;
  }, [completeClosingNavigation, endInterview, persistBoundaryState, sendLifecycleTelemetry, session?.conversation_id]);

  const finishAvatarClosingSpeech = useCallback((
    state: InterviewTimeBoundaryState,
    terminalReason: NonNullable<InterviewTimeBoundaryState["closingEchoFallbackReason"]> | "farewell_completed" | "observer_reload",
  ) => {
    if (!avatarClosingOwnedRef.current) return;
    if (closingStartTimerRef.current) {
      window.clearTimeout(closingStartTimerRef.current);
      closingStartTimerRef.current = null;
    }
    if (closingCompletionTimerRef.current) {
      window.clearTimeout(closingCompletionTimerRef.current);
      closingCompletionTimerRef.current = null;
    }
    farewellAudioAudibleRef.current = false;
    suppressRemotePalAudio(remoteAudioRef.current);
    persistBoundaryState(state);
    const conversationId = String(session?.conversation_id || "").trim();
    if (conversationId && typeof window !== "undefined") {
      if (state.closingEchoPhase === "COMPLETED") {
        advanceSharedFinalClosingRuntime(
          window.localStorage,
          conversationId,
          finalClosingTabIdRef.current,
          "ECHO_COMPLETED",
        );
      }
    }
    void requestClosingProviderEnd(terminalReason);
  }, [persistBoundaryState, requestClosingProviderEnd, session?.conversation_id]);

  const armClosingFallbacks = useCallback(() => {
    if (!avatarClosingOwnedRef.current) return;
    const conversationId = String(session?.conversation_id || "").trim();
    const shared = conversationId && typeof window !== "undefined"
      ? readSharedFinalClosingRuntime(window.localStorage, conversationId)
      : null;
    const now = Date.now();
    const startDelay = Math.max(
      0,
      (shared?.farewellStartDeadlineAt ?? now + FINAL_CLOSING_START_TIMEOUT_MS) - now,
    );
    const completionDelay = finalClosingGraceDelayMs(shared, now) ?? FINAL_CLOSING_COMPLETION_FALLBACK_MS;
    if (!closingStartTimerRef.current) {
      closingStartTimerRef.current = window.setTimeout(() => {
        closingStartTimerRef.current = null;
        const current = timerRuntimeRef.current?.boundaryState || createInterviewTimeBoundaryState();
        if (current.phase !== "AVATAR_CLOSING" || current.closingEchoPhase !== "DISPATCHED") return;
        // Missing speaking-start metadata is diagnostic only. The Tavus Echo
        // may already be rendering, so keep its audio open and let the single
        // completion deadline provide the bounded provider-end fail-safe.
        sendLifecycleTelemetry("closing_farewell_start_timed_out", {
          closing_state: "FAREWELL_DISPATCHED",
          timeout_category: "farewell_start",
          remaining_time_bucket: "0_10",
        });
      }, startDelay);
    }
    if (closingCompletionTimerRef.current) return;
    closingCompletionTimerRef.current = window.setTimeout(() => {
      closingCompletionTimerRef.current = null;
      const current = timerRuntimeRef.current?.boundaryState || createInterviewTimeBoundaryState();
      if (current.phase !== "AVATAR_CLOSING" || closingProviderEndAllowed(current)) return;
      farewellAudioAudibleRef.current = false;
      suppressRemotePalAudio(remoteAudioRef.current);
      const fallback = markClosingEchoFallback(current, "completion_timeout");
      // This is the fixed post-Echo grace floor, not a provider speaking-event
      // decision. No Tavus event can reach provider end before this callback.
      sendLifecycleTelemetry("closing_farewell_completion_timed_out", {
        closing_state: current.closingEchoStarted ? "FAREWELL_AUDIBLE" : "FAREWELL_DISPATCHED",
        timeout_category: "farewell_completion",
        remaining_time_bucket: "0_10",
      });
      finishAvatarClosingSpeech(fallback, "completion_timeout");
    }, completionDelay);
  }, [finishAvatarClosingSpeech, sendLifecycleTelemetry, session?.conversation_id]);

  const dispatchTerminalClosing = useCallback((
    nextState: InterviewTimeBoundaryState,
    conversationId: string,
  ) => {
    if (!avatarClosingOwnedRef.current || typeof window === "undefined") return;
    const closingDrainMs = FINAL_CLOSING_DRAIN_MS;
    const closingEchoGapMs = FINAL_CLOSING_INTERRUPT_ECHO_GAP_MS;
    if (
      closingDrainTimerRef.current ||
      closingEchoGapTimerRef.current ||
      closingEchoDispatchRequestedRef.current
    ) return;
    const dispatchReservation = advanceSharedFinalClosingRuntime(
      window.localStorage,
      conversationId,
      finalClosingTabIdRef.current,
      "DISPATCH_RESERVED",
    );
    if (!dispatchReservation.advanced) {
      if (
        dispatchReservation.reason === "owned_by_other_tab" ||
        dispatchReservation.reason === "ambiguous_shared_state" ||
        dispatchReservation.reason === "shared_storage_unavailable"
      ) {
        avatarClosingOwnedRef.current = false;
        farewellAudioAudibleRef.current = false;
        suppressRemotePalAudio(remoteAudioRef.current);
        sendLifecycleTelemetry("closing_terminal_reserved", {
          closing_state: "CLOSING_RESERVED",
          duplicate_suppression_category:
            dispatchReservation.reason === "owned_by_other_tab"
              ? "tab_observer"
              : "ownership_uncertain",
          remaining_time_bucket: "0_10",
        });
        return;
      }
      const failed = markClosingEchoFallback(
        timerRuntimeRef.current?.boundaryState || nextState,
        "stale_owner_takeover",
      );
      finishAvatarClosingSpeech(failed, "stale_owner_takeover");
      return;
    }

    if (!replicaInterruptRequestedRef.current) {
      replicaInterruptRequestedRef.current = true;
      try {
        const call = callRef.current;
        if (!call?.sendAppMessage) throw new Error("closing_interrupt_unavailable");
        call.sendAppMessage(buildReplicaInterruptMessage(conversationId), "*");
        advanceSharedFinalClosingRuntime(
          window.localStorage,
          conversationId,
          finalClosingTabIdRef.current,
          "INTERRUPT_SENT",
        );
        sendLifecycleTelemetry("closing_interrupt_dispatched", {
          closing_state: "FOREIGN_PAL_AUDIO_MUTED",
          dispatch_result_category: "sent",
          remaining_time_bucket: "0_10",
        });
      } catch {
        sendLifecycleTelemetry("closing_interrupt_dispatched", {
          closing_state: "FOREIGN_PAL_AUDIO_MUTED",
          dispatch_result_category: "failed",
          remaining_time_bucket: "0_10",
        });
      }
    }

    closingDrainTimerRef.current = window.setTimeout(() => {
      closingDrainTimerRef.current = null;
      if (!avatarClosingOwnedRef.current || closingEchoDispatchRequestedRef.current) return;

      if (!closingFinalInterruptRequestedRef.current) {
        closingFinalInterruptRequestedRef.current = true;
        try {
          const call = callRef.current;
          if (!call?.sendAppMessage) throw new Error("closing_final_interrupt_unavailable");
          call.sendAppMessage(buildReplicaInterruptMessage(conversationId), "*");
          sendLifecycleTelemetry("closing_interrupt_dispatched", {
            closing_state: "FOREIGN_PAL_AUDIO_MUTED",
            dispatch_result_category: "final_sent",
            remaining_time_bucket: "0_10",
          });
        } catch {
          sendLifecycleTelemetry("closing_interrupt_dispatched", {
            closing_state: "FOREIGN_PAL_AUDIO_MUTED",
            dispatch_result_category: "final_failed",
            remaining_time_bucket: "0_10",
          });
        }
      }

      closingEchoGapTimerRef.current = window.setTimeout(() => {
        closingEchoGapTimerRef.current = null;
        if (!avatarClosingOwnedRef.current || closingEchoDispatchRequestedRef.current) return;
        closingEchoDispatchRequestedRef.current = true;
        const inferenceId = closingApplicationInferenceId(conversationId);
        try {
          const call = callRef.current;
          if (!call?.sendAppMessage) throw new Error("closing_echo_unavailable");
          call.sendAppMessage(
            buildFinalClosingAnnouncementMessage(conversationId, inferenceId),
            "*",
          );
          const dispatched = markClosingEchoDispatched(
            timerRuntimeRef.current?.boundaryState || nextState,
            inferenceId,
          );
          persistBoundaryState(dispatched);
          advanceSharedFinalClosingRuntime(
            window.localStorage,
            conversationId,
            finalClosingTabIdRef.current,
            "ECHO_DISPATCHED",
          );
          // Only the authoritative terminal Echo may be heard after the drain.
          farewellAudioAudibleRef.current = true;
          syncParticipants();
          sendLifecycleTelemetry("closing_farewell_dispatched", {
            closing_state: "FAREWELL_DISPATCHED",
            dispatch_result_category: "sent",
            remaining_time_bucket: "0_10",
          });
          armClosingFallbacks();
        } catch {
          const failed = markClosingEchoFallback(
            timerRuntimeRef.current?.boundaryState || nextState,
            "dispatch_failed",
          );
          sendLifecycleTelemetry("closing_farewell_dispatch_failed", {
            closing_state: "FOREIGN_PAL_AUDIO_MUTED",
            dispatch_result_category: "failed",
            remaining_time_bucket: "0_10",
          });
          finishAvatarClosingSpeech(failed, "dispatch_failed");
        }
      }, closingEchoGapMs);
    }, closingDrainMs);
  }, [
    armClosingFallbacks,
    finishAvatarClosingSpeech,
    persistBoundaryState,
    sendLifecycleTelemetry,
    syncParticipants,
  ]);

  const dispatchTerminalClosingWhenReady = useCallback((
    nextState: InterviewTimeBoundaryState,
    conversationId: string,
  ) => {
    if (!avatarClosingOwnedRef.current || closingCallReadyTimerRef.current) return;
    const deadlineAt = Date.now() + FINAL_CLOSING_START_TIMEOUT_MS;
    const attempt = () => {
      closingCallReadyTimerRef.current = null;
      if (!avatarClosingOwnedRef.current) return;
      const call = callRef.current;
      if (call?.sendAppMessage) {
        if (!candidateAudioUnpublishRequestedRef.current) {
          candidateAudioUnpublishRequestedRef.current = true;
          requestCandidateAudioUnpublish(call);
        }
        farewellAudioAudibleRef.current = false;
        suppressRemotePalAudio(remoteAudioRef.current);
        dispatchTerminalClosing(nextState, conversationId);
        return;
      }
      if (Date.now() >= deadlineAt) {
        const failed = markClosingEchoFallback(
          timerRuntimeRef.current?.boundaryState || nextState,
          "dispatch_failed",
        );
        sendLifecycleTelemetry("closing_farewell_dispatch_failed", {
          closing_state: "FOREIGN_PAL_AUDIO_MUTED",
          dispatch_result_category: "failed",
          remaining_time_bucket: "0_10",
        });
        finishAvatarClosingSpeech(failed, "dispatch_failed");
        return;
      }
      closingCallReadyTimerRef.current = window.setTimeout(attempt, 50);
    };
    attempt();
  }, [dispatchTerminalClosing, finishAvatarClosingSpeech, sendLifecycleTelemetry]);

  const scheduleClosingOwnershipTakeover = useCallback((
    observedState: SharedFinalClosingState,
    nextState: InterviewTimeBoundaryState,
    conversationId: string,
  ) => {
    if (closingOwnershipTakeoverTimerRef.current || typeof window === "undefined") return;
    const scheduleAttempt = (state: SharedFinalClosingState) => {
      const delay = Math.max(1, state.leaseExpiresAt - Date.now() + 1);
      closingOwnershipTakeoverTimerRef.current = window.setTimeout(() => {
        closingOwnershipTakeoverTimerRef.current = null;
        void withFinalClosingRuntimeLock(
          browserFinalClosingLockManager(),
          conversationId,
          () => {
            const takeover = claimSharedFinalClosingRuntime(
              window.localStorage,
              conversationId,
              finalClosingTabIdRef.current,
            );
            if (!takeover.owned || takeover.reason !== "stale_owner_takeover") {
              if (takeover.state && takeover.reason === "owned_by_other_tab") {
                scheduleAttempt(takeover.state);
              }
              return takeover;
            }
            avatarClosingOwnedRef.current = true;
            if (!candidateAudioUnpublishRequestedRef.current && callRef.current) {
              candidateAudioUnpublishRequestedRef.current = true;
              requestCandidateAudioUnpublish(callRef.current);
            }
            farewellAudioAudibleRef.current = false;
            suppressRemotePalAudio(remoteAudioRef.current);
            sendLifecycleTelemetry("closing_terminal_reserved", {
              closing_state: "CLOSING_RESERVED",
              duplicate_suppression_category: "stale_owner_takeover",
              remaining_time_bucket: "0_10",
            });
            if (takeover.state && sharedFinalClosingDispatchMayResume(takeover.state)) {
              dispatchTerminalClosingWhenReady(
                timerRuntimeRef.current?.boundaryState || nextState,
                conversationId,
              );
              return takeover;
            }
            const failed = markClosingEchoFallback(
              timerRuntimeRef.current?.boundaryState || nextState,
              "stale_owner_takeover",
            );
            finishAvatarClosingSpeech(failed, "stale_owner_takeover");
            return takeover;
          },
        );
      }, delay);
    };
    scheduleAttempt(observedState);
  }, [dispatchTerminalClosingWhenReady, finishAvatarClosingSpeech, sendLifecycleTelemetry]);

  const beginAvatarClosing = useCallback((nextState: InterviewTimeBoundaryState) => {
    if (avatarClosingActiveRef.current) return;
    avatarClosingActiveRef.current = true;
    persistBoundaryState(nextState);
    setHelpOpen(false);
    setConnectionNotice("");
    cancelInactivityRuntime("closing", true);
    reconnectingRef.current = false;
    progressRecoveryInFlightRef.current = false;
    farewellAudioAudibleRef.current = false;

    const conversationId = String(session?.conversation_id || "").trim();
    const call = callRef.current;
    const candidateUnpublishResult = call
      ? (() => {
          candidateAudioUnpublishRequestedRef.current = true;
          return requestCandidateAudioUnpublish(call);
        })()
      : "unsupported";
    sendLifecycleTelemetry("closing_candidate_audio_unpublish_requested", {
      closing_state: "CLOSING_RESERVED",
      candidate_unpublish_result_category: candidateUnpublishResult,
      remaining_time_bucket: "0_10",
    });
    const muteResult = suppressRemotePalAudio(remoteAudioRef.current);
    sendLifecycleTelemetry("closing_foreign_pal_audio_muted", {
      closing_state: "FOREIGN_PAL_AUDIO_MUTED",
      mute_result_category: muteResult,
      remaining_time_bucket: "0_10",
    });

    if (!conversationId || typeof window === "undefined") {
      sendLifecycleTelemetry("closing_terminal_reserved", {
        closing_state: "CLOSING_RESERVED",
        duplicate_suppression_category: "ownership_uncertain",
        remaining_time_bucket: "0_10",
      });
      return;
    }

    void withFinalClosingRuntimeLock(
      browserFinalClosingLockManager(),
      conversationId,
      () => {
        const sharedClaim = claimSharedFinalClosingRuntime(
          window.localStorage,
          conversationId,
          finalClosingTabIdRef.current,
        );
        avatarClosingOwnedRef.current = sharedClaim.owned;
        sendLifecycleTelemetry("closing_terminal_reserved", {
          closing_state: "CLOSING_RESERVED",
          duplicate_suppression_category: sharedClaim.reason === "owned_by_other_tab"
            ? "tab_observer"
            : sharedClaim.reason === "stale_owner_takeover"
              ? "stale_owner_takeover"
              : sharedClaim.owned
                ? "none"
                : "ownership_uncertain",
          remaining_time_bucket: "0_10",
        });
        if (!sharedClaim.owned) {
          if (sharedClaim.state && sharedClaim.reason === "owned_by_other_tab") {
            scheduleClosingOwnershipTakeover(sharedClaim.state, nextState, conversationId);
          }
          return sharedClaim;
        }
        advanceSharedFinalClosingRuntime(
          window.localStorage,
          conversationId,
          finalClosingTabIdRef.current,
          "CANDIDATE_AUDIO_REQUESTED",
        );
        dispatchTerminalClosingWhenReady(nextState, conversationId);
        return sharedClaim;
      },
    ).then((coordination) => {
      if (coordination.acquired) return;
      avatarClosingOwnedRef.current = false;
      farewellAudioAudibleRef.current = false;
      suppressRemotePalAudio(remoteAudioRef.current);
      sendLifecycleTelemetry("closing_terminal_reserved", {
        closing_state: "CLOSING_RESERVED",
        duplicate_suppression_category: "ownership_uncertain",
        remaining_time_bucket: "0_10",
      });
    });
  }, [
    cancelInactivityRuntime,
    dispatchTerminalClosingWhenReady,
    persistBoundaryState,
    scheduleClosingOwnershipTakeover,
    sendLifecycleTelemetry,
    session?.conversation_id,
  ]);

  const processTimeBoundary = useCallback((remaining: number) => {
    if (avatarClosingActiveRef.current) return;
    const runtime = timerRuntimeRef.current;
    const previousState = runtime?.boundaryState || createInterviewTimeBoundaryState();
    const evaluation = evaluateInterviewTimeBoundary({
      state: previousState,
      remainingSeconds: remaining,
      candidateSpeaking: candidateSpeakingStateRef.current.active,
      replicaSpeaking: replicaSpeakingRef.current,
    });
    if (!evaluation.actions.length) return;
    beginAvatarClosing(evaluation.state);
  }, [beginAvatarClosing]);

  useEffect(() => () => clearAutoEndTimers(), [clearAutoEndTimers]);
  useEffect(
    () => () => clearNormalCompletionEndTimer(),
    [clearNormalCompletionEndTimer],
  );

  useEffect(() => {
    const conversationId = String(session?.conversation_id || "").trim();
    if (!conversationId || typeof window === "undefined") return;
    const key = finalClosingSharedStorageKey(conversationId);
    const enforceFromSharedState = (event?: StorageEvent) => {
      if (event && event.key !== key) return;
      const state = readSharedFinalClosingRuntime(window.localStorage, conversationId);
      if (!state) return;
      const recoveryPlan = sharedFinalClosingRecoveryPlan(
        state,
        finalClosingTabIdRef.current,
      );
      avatarClosingActiveRef.current = true;
      avatarClosingOwnedRef.current = recoveryPlan.owned;
      farewellAudioAudibleRef.current = recoveryPlan.farewellAudible;
      if (!recoveryPlan.owned) {
        candidateAudioLockAbortRef.current?.abort();
        candidateAudioLockAbortRef.current = null;
      }
      if (!candidateAudioUnpublishRequestedRef.current && callRef.current) {
        candidateAudioUnpublishRequestedRef.current = true;
        requestCandidateAudioUnpublish(callRef.current);
      }
      if (!recoveryPlan.farewellAudible) {
        suppressRemotePalAudio(remoteAudioRef.current);
      } else {
        syncParticipants();
      }
      setHelpOpen(false);
      setConnectionNotice("");
      cancelInactivityRuntime("closing", true);
      const current = timerRuntimeRef.current?.boundaryState || createInterviewTimeBoundaryState();
      let recoveredCurrent = current;
      if (current.phase === "INTERVIEWING") {
        recoveredCurrent = {
          ...current,
          phase: "AVATAR_CLOSING",
          closingReserved: true,
          candidateAudioUnpublishRequested:
            SHARED_FINAL_CLOSING_PHASE_ORDER[state.phase] >=
            SHARED_FINAL_CLOSING_PHASE_ORDER.CANDIDATE_AUDIO_REQUESTED,
          replicaInterruptRequested:
            SHARED_FINAL_CLOSING_PHASE_ORDER[state.phase] >=
            SHARED_FINAL_CLOSING_PHASE_ORDER.INTERRUPT_SENT,
          closingEchoPhase:
            SHARED_FINAL_CLOSING_PHASE_ORDER[state.phase] >=
            SHARED_FINAL_CLOSING_PHASE_ORDER.ECHO_COMPLETED
              ? "COMPLETED"
              : state.phase === "FAREWELL_AUDIBLE"
                ? "SPEAKING"
                : SHARED_FINAL_CLOSING_PHASE_ORDER[state.phase] >=
                  SHARED_FINAL_CLOSING_PHASE_ORDER.ECHO_DISPATCHED
                ? "DISPATCHED"
                : "RESERVED",
          closingEchoStarted: state.phase === "FAREWELL_AUDIBLE",
        };
        persistBoundaryState(recoveredCurrent);
      }
      if (recoveryPlan.navigateImmediately) {
        completeClosingNavigation("observer_reload");
        return;
      }
      if (recoveryPlan.resumeDispatch) {
        void withFinalClosingRuntimeLock(
          browserFinalClosingLockManager(),
          conversationId,
          () => {
            const latest = readSharedFinalClosingRuntime(window.localStorage, conversationId);
            if (
              !latest ||
              latest.ownerTabId !== finalClosingTabIdRef.current ||
              !sharedFinalClosingDispatchMayResume(latest)
            ) return false;
            dispatchTerminalClosingWhenReady(recoveredCurrent, conversationId);
            return true;
          },
        );
        return;
      }
      // A remount never replays the Echo. The owner restores only the
      // completion fallback or the single provider-end transition.
      if (recoveryPlan.rearmCompletionFallback) armClosingFallbacks();
      if (recoveryPlan.requestProviderEnd) void requestClosingProviderEnd("observer_reload");
      if (recoveryPlan.failClosedProviderEnd) {
        const failed = markClosingEchoFallback(
          timerRuntimeRef.current?.boundaryState || recoveredCurrent,
          "stale_owner_takeover",
        );
        finishAvatarClosingSpeech(failed, "stale_owner_takeover");
      }
      if (!recoveryPlan.owned && !closingOwnershipTakeoverTimerRef.current) {
        scheduleClosingOwnershipTakeover(state, recoveredCurrent, conversationId);
      }
    };
    window.addEventListener("storage", enforceFromSharedState);
    enforceFromSharedState();
    return () => window.removeEventListener("storage", enforceFromSharedState);
  }, [
    armClosingFallbacks,
    cancelInactivityRuntime,
    completeClosingNavigation,
    dispatchTerminalClosingWhenReady,
    finishAvatarClosingSpeech,
    persistBoundaryState,
    requestClosingProviderEnd,
    scheduleClosingOwnershipTakeover,
    session?.conversation_id,
    syncParticipants,
  ]);

  useEffect(() => {
    const onPageHide = () => {
      if (!endTriggeredRef.current) {
        sendLifecycleTelemetry(
          "browser_closed_or_navigation",
          { terminal_reason: "browser_closed_or_navigation" },
          { reason: "browser_closed_or_navigation", terminal: true },
        );
      }
    };
    const onOnline = () => {
      inactivityTransportHealthyRef.current = Boolean(callRef.current);
      sendLifecycleTelemetry("browser_online", { network_state: "online" });
    };
    const onOffline = () => {
      inactivityTransportHealthyRef.current = false;
      cancelInactivityRuntime("transport_unhealthy");
      sendLifecycleTelemetry("browser_offline", { network_state: "offline" });
    };
    const onVisibilityChange = () => {
      inactivityDocumentVisibleRef.current = document.visibilityState === "visible";
      if (!inactivityDocumentVisibleRef.current) cancelInactivityRuntime("hidden_document");
      sendLifecycleTelemetry("browser_visibility_changed", {
        visibility_state:
          document.visibilityState === "visible" ||
          document.visibilityState === "hidden" ||
          document.visibilityState === "prerender"
            ? document.visibilityState
            : "unknown",
      });
    };
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [cancelInactivityRuntime, sendLifecycleTelemetry]);

  useEffect(() => {
    const conversationId = String(session?.conversation_id || "").trim();
    const interviewId = String(session?.interview_id || "").trim();
    const enabled = session?.application_inactivity_control_enabled === true &&
      session?.silence_engagement_owner === "application_inactivity" &&
      Boolean(interviewId) &&
      Boolean(conversationId);
    inactivityStateRef.current = createCandidateInactivityNudgeState(
      enabled,
      interviewId,
      conversationId,
    );
    clearInactivityTimer();
    inactivityRuntimeOwnerRef.current = false;
    if (!enabled || typeof window === "undefined" || typeof document === "undefined") return;

    if (!inactivityTabIdRef.current) {
      inactivityTabIdRef.current = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `tab-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    }
    const tabId = inactivityTabIdRef.current;
    const leaseKey = candidateInactivityLeaseKey(conversationId);
    const refreshLease = () => {
      const visible = document.visibilityState === "visible";
      inactivityDocumentVisibleRef.current = visible;
      if (!visible) {
        releaseCandidateInactivityLease(window.localStorage, conversationId, tabId);
        const hadOwnership = inactivityRuntimeOwnerRef.current;
        inactivityRuntimeOwnerRef.current = false;
        if (hadOwnership) cancelInactivityRuntime("hidden_document");
        return;
      }
      const hadOwnership = inactivityRuntimeOwnerRef.current;
      const owns = acquireCandidateInactivityLease(
        window.localStorage,
        conversationId,
        tabId,
        Date.now(),
        true,
      );
      inactivityRuntimeOwnerRef.current = owns;
      if (hadOwnership && !owns) cancelInactivityRuntime("runtime_ownership_lost");
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key !== leaseKey) return;
      const owns = ownsCandidateInactivityLease(
        window.localStorage,
        conversationId,
        tabId,
        Date.now(),
      );
      const hadOwnership = inactivityRuntimeOwnerRef.current;
      inactivityRuntimeOwnerRef.current = owns;
      if (hadOwnership && !owns) cancelInactivityRuntime("runtime_ownership_lost");
    };

    refreshLease();
    inactivityLeaseTimerRef.current = window.setInterval(refreshLease, CANDIDATE_INACTIVITY_LEASE_RENEW_MS);
    window.addEventListener("storage", onStorage);
    return () => {
      if (inactivityLeaseTimerRef.current) {
        window.clearInterval(inactivityLeaseTimerRef.current);
        inactivityLeaseTimerRef.current = null;
      }
      window.removeEventListener("storage", onStorage);
      clearInactivityTimer();
      releaseCandidateInactivityLease(window.localStorage, conversationId, tabId);
      inactivityRuntimeOwnerRef.current = false;
      cancelInactivityRuntime("unmount", true);
    };
  }, [
    cancelInactivityRuntime,
    clearInactivityTimer,
    session?.application_inactivity_control_enabled,
    session?.conversation_id,
    session?.interview_id,
    session?.silence_engagement_owner,
  ]);

  useEffect(() => {
    if (!session?.conversation_url) {
      setLocation("/interview");
    }
  }, [session, setLocation]);

  useEffect(() => {
    if (!session?.conversation_url) return;

    let alive = true;
    let call: DailyCallObject | null = null;
    let handlers: Array<[string, (event?: DailyEvent) => void]> = [];
    let progressWatchdogTimer: number | null = null;
    let progressRecoveryDeadlineTimer: number | null = null;
    let previousRemoteEvidence: RemoteParticipantEvidence | null = null;

    const register = (event: string, handler: (payload?: DailyEvent) => void) => {
      call?.on(event, handler);
      handlers.push([event, handler]);
    };
    const requestRecordingStart = async () => {
      if (!alive || recordingStartRequestedRef.current) return;
      recordingStartRequestedRef.current = true;
      const logContext = {
        conversation_id: session.conversation_id || null,
        interview_id: session.interview_id || null,
      };
      if (!call || typeof call.startRecording !== "function") {
        console.warn("[daily-recording] start_unavailable", logContext);
        return;
      }
      console.log("[daily-recording] start_requested", logContext);
      try {
        await call.startRecording();
        console.log("[daily-recording] start_success", logContext);
      } catch (error) {
        console.warn("[daily-recording] start_failed", { ...logContext, error });
      }
    };
    const applySelectedDevices = async () => {
      if (!call) return;
      const devices: { videoDeviceId?: string; audioDeviceId?: string } = {};
      if (session.selectedCameraDeviceId) devices.videoDeviceId = session.selectedCameraDeviceId;
      if (session.selectedMicrophoneDeviceId) devices.audioDeviceId = session.selectedMicrophoneDeviceId;
      if (!devices.videoDeviceId && !devices.audioDeviceId) return;

      try {
        if (typeof call.setInputDevicesAsync === "function") {
          await call.setInputDevicesAsync(devices);
          return;
        }
        if (typeof call.setInputDevices === "function") {
          await call.setInputDevices(devices);
          return;
        }
        console.warn("[InterviewCviPage] Daily input device selection unsupported; using defaults.");
      } catch (error) {
        console.warn("[InterviewCviPage] Could not apply selected input devices; using defaults.", error);
      }
    };

    type ReconnectBindingPhase = "initiation" | "post_leave" | "rejoin_success" | "participant_rediscovery" | "track_rebinding" | "recovery_deadline";
    const emitReconnectBindingMetadata = (phase: ReconnectBindingPhase, metadata: ReliabilityMetadata) => {
      const boundedMetadata = { reconnect_binding_phase: phase, ...metadata };
      const signature = JSON.stringify(boundedMetadata);
      if (reconnectBindingSignaturesRef.current[phase] === signature) return;
      reconnectBindingSignaturesRef.current[phase] = signature;
      sendLifecycleTelemetry("reconnect_media_binding_snapshot", boundedMetadata);
    };
    const emitReconnectBindingSnapshot = (
      phase: ReconnectBindingPhase,
      evidence = previousRemoteEvidence || emptyRemoteEvidence(),
    ) => {
      const metadata: ReliabilityMetadata = {
        remote_participant_count_bucket: evidence.remoteParticipantCountBucket,
        audio_track_state: evidence.audioState,
        video_track_state: evidence.videoState,
        audio_attached: Boolean(remoteAudioRef.current?.srcObject),
        video_attached: Boolean(remoteVideoRef.current?.srcObject),
        participant_continuity: evidence.remotePresent ? "unknown" : "absent",
        audio_track_continuity: evidence.audioTrackPresent ? "unknown" : "absent",
        video_track_continuity: evidence.videoTrackPresent ? "unknown" : "absent",
        startup_readiness_state: startupReadinessRef.current,
        recovery_age_bucket: recoveryAgeBucket(progressRecoveryStateRef.current.startedAt),
      };
      emitReconnectBindingMetadata(phase, metadata);
    };
    let syncParticipantsWithDiagnostics: (
      participants?: Record<string, DailyParticipant>,
      snapshotReason?: "initial_discovery" | "participant_joined" | "participant_updated" | "participant_left"
        | "track_started" | "track_stopped" | "reconnect_rediscovery" | "recovery_deadline"
        | "terminal_failure" | "watchdog_snapshot",
      transitionSource?: "participant_joined" | "participant_updated" | "participant_left" | "track_started"
        | "track_stopped" | "reconnect_enumeration" | "watchdog_snapshot",
    ) => RemoteParticipantEvidence = (participants) => syncParticipants(participants);

    const beginStartupWatchdog = () => {
      clearStartupTimer();
      startupTimerRef.current = window.setTimeout(async () => {
        if (!alive || startupReadyRef.current || !call) return;
        if (!startupRecoveryAttemptedRef.current) {
          startupRecoveryAttemptedRef.current = true;
          reconnectingRef.current = true;
          const previousReadiness = startupReadinessRef.current;
          startupReadinessRef.current = transitionStartupReadiness(previousReadiness, "startup_recovering", false);
          if (startupReadinessRef.current !== previousReadiness) {
            sendLifecycleTelemetry("startup_readiness_changed", {
              startup_readiness_state: startupReadinessRef.current,
              reconnect_phase: "reconnecting_transport",
            });
          }
          emitReconnectBindingSnapshot("initiation");
          cancelInactivityRuntime("reconnect");
          try {
            await call.leave().catch(() => {});
            if (remoteVideoRef.current?.srcObject) remoteVideoRef.current.srcObject = null;
            remoteVideoAttachmentResultRef.current = "detached_for_reconnect";
            sendLifecycleTelemetry("remote_video_attachment_result", {
              video_attachment_result: "detached_for_reconnect",
              video_track_state: previousRemoteEvidence?.videoState || "absent",
              element_ready_state_bucket: mediaElementReadyStateBucket(remoteVideoRef.current),
              element_visible: Boolean(remoteVideoRef.current && !remoteVideoRef.current.hidden),
              element_size_bucket: mediaElementSizeBucket(remoteVideoRef.current),
              reconnect_active: true,
              elapsed_since_join_bucket: elapsedSinceJoinBucket(roomJoinedAtRef.current),
              startup_readiness_state: startupReadinessRef.current,
            });
            emitReconnectBindingSnapshot("post_leave", emptyRemoteEvidence());
            if (!alive || endTriggeredRef.current) return;
            await call.join({
              url: session.conversation_url,
              userName: "Candidate",
              startAudioOff: avatarClosingActiveRef.current,
              startVideoOff: false,
            });
            if (!alive || endTriggeredRef.current) return;
            emitReconnectBindingSnapshot("rejoin_success");
            void emitReceiveSettingsSnapshot();
            // The startup reconnect has completed. Clear its transport guard
            // before rediscovery so playable media can satisfy readiness
            // immediately instead of remaining stuck in startup_recovering.
            reconnectingRef.current = false;
            syncParticipantsWithDiagnostics(undefined, "reconnect_rediscovery", "reconnect_enumeration");
            beginStartupWatchdog();
            return;
          } catch {
          } finally {
            reconnectingRef.current = false;
          }
        }
        const previousReadiness = startupReadinessRef.current;
        startupReadinessRef.current = transitionStartupReadiness(previousReadiness, "startup_failed", false);
        if (startupReadinessRef.current !== previousReadiness) {
          sendLifecycleTelemetry("startup_readiness_changed", {
            startup_readiness_state: startupReadinessRef.current,
            reconnect_phase: "failed",
          });
        }
        syncParticipantsWithDiagnostics(undefined, "terminal_failure", "watchdog_snapshot");
        setLoading(false);
        setError("Interview did not start correctly. Please relaunch and try again.");
      }, STARTUP_REMOTE_TIMEOUT_MS);
    };

    const stopProgressWatchdog = () => {
      if (progressWatchdogTimer) {
        window.clearInterval(progressWatchdogTimer);
        progressWatchdogTimer = null;
      }
    };

    const clearProgressRecoveryDeadline = () => {
      if (progressRecoveryDeadlineTimer) {
        window.clearTimeout(progressRecoveryDeadlineTimer);
        progressRecoveryDeadlineTimer = null;
      }
    };

    const transitionRecovery = (event: ReconnectRecoveryEvent) => {
      const previous = progressRecoveryStateRef.current;
      const next = advanceReconnectRecovery(previous, event);
      progressRecoveryStateRef.current = next;
      if (next !== previous && (isReconnectRecoveryActive(next) || next.phase === "recovered")) {
        setConnectionNotice(reconnectRecoveryNotice(next));
      }
      return { previous, next };
    };

    const boundedElapsed = (startAt: number | null, endAt: number) => (
      startAt === null ? 0 : Math.min(3_600_000, Math.max(0, Math.round(endAt - startAt)))
    );

    const recoveryMetadata = (state = progressRecoveryStateRef.current): ReliabilityMetadata => ({
      recovery_attempt: state.attempt,
      recovery_phase: state.phase,
      is_recovery_active: isReconnectRecoveryActive(state),
    });

    const emitReceiveSettingsSnapshot = async (explicitSettings?: unknown, explicit = false) => {
      const metadata = await readDailyReceiveSettingsSnapshot(
        call,
        reconnectingRef.current || isReconnectRecoveryActive(progressRecoveryStateRef.current),
        explicitSettings,
        explicit,
      );
      if (!alive || endTriggeredRef.current) return;
      sendLifecycleTelemetry("daily_receive_settings_snapshot", {
        ...metadata,
        startup_readiness_state: startupReadinessRef.current,
      });
    };

    const remoteStateMetadata = (): ReliabilityMetadata => {
      const evidence = previousRemoteEvidence || emptyRemoteEvidence();
      return {
        participant_count: evidence.remoteParticipantCount,
        remote_participant_present: evidence.remotePresent,
        remote_audio_state: evidence.audioState,
        remote_video_state: evidence.videoState,
        audio_track_present: evidence.audioTrackPresent,
        video_track_present: evidence.videoTrackPresent,
        audio_persistent_track_present: evidence.audioPersistentTrackPresent,
        video_persistent_track_present: evidence.videoPersistentTrackPresent,
        video_attachment_result: remoteVideoAttachmentResultRef.current,
        missing_progress_reason: deriveMissingProgressReason(
          evidence,
          remoteVideoAttachmentResultRef.current,
        ),
        startup_readiness_state: startupReadinessRef.current,
        video_unavailable_duration_bucket: evidence.remoteVideoReady
          ? "under_15_seconds"
          : elapsedSinceJoinBucket(roomJoinedAtRef.current),
        reconnect_phase: progressRecoveryStateRef.current.phase,
      };
    };

    const recordProgressCheckpoint = (
      source:
        | "replica_started_speaking"
        | "replica_utterance"
        | "candidate_utterance"
        | "candidate_speaking_started"
        | "candidate_speaking_ended",
      progressAt: number,
      resetSource: "progress_checkpoint" | "reconnect_practical_progress" = "progress_checkpoint",
    ) => {
      const priorProgressAt = lastProgressAtRef.current;
      lastProgressAtRef.current = progressAt;
      sendLifecycleTelemetry("progress_checkpoint_updated", {
        progress_source: source,
        elapsed_ms: boundedElapsed(priorProgressAt, progressAt),
        watchdog_reset_source: resetSource,
        ...recoveryMetadata(),
      });
    };

    const recordReconnectLocalJoin = (at: number) => {
      const { previous, next } = transitionRecovery({ type: "local_joined", at });
      if (previous === next || next.phase !== "awaiting_remote_presence") return;
      sendLifecycleTelemetry("reconnect_local_joined", {
        meeting_state: "joined",
        recovery_age_ms: boundedElapsed(next.startedAt, at),
        ...recoveryMetadata(next),
      });
    };

    const markProgressStalled = (reason: "watchdog_timeout" | "reconnect_failed") => {
      if (!alive || endTriggeredRef.current) return;
      clearProgressRecoveryDeadline();
      progressRecoveryInFlightRef.current = false;
      reconnectingRef.current = false;
      stopProgressWatchdog();
      setLoading(false);
      setConnectionNotice("");
      setProgressStalled(true);
      cancelInactivityRuntime("watchdog_recovery", true);
      setError("The interview stopped progressing and cannot continue. Please contact support before trying again.");
      const at = Date.now();
      const previousReadiness = startupReadinessRef.current;
      startupReadinessRef.current = transitionStartupReadiness(previousReadiness, "startup_failed", false);
      if (startupReadinessRef.current !== previousReadiness) {
        sendLifecycleTelemetry("startup_readiness_changed", {
          startup_readiness_state: startupReadinessRef.current,
          reconnect_phase: "failed",
        });
      }
      syncParticipantsWithDiagnostics(undefined, "terminal_failure", "watchdog_snapshot");
      sendLifecycleTelemetry(
        "interview_terminal_requested",
        {
          terminal_reason: reason,
          progress_age_ms: boundedElapsed(lastProgressAtRef.current, at),
          recovery_age_ms: boundedElapsed(progressRecoveryStateRef.current.startedAt, at),
          ...remoteStateMetadata(),
          ...recoveryMetadata(),
        },
        { reason, terminal: true },
      );
      sendLifecycleTelemetry(
        reason === "watchdog_timeout" ? "watchdog_timeout" : "reconnect_failed",
        {
          terminal_reason: reason,
          progress_age_ms: boundedElapsed(lastProgressAtRef.current, at),
          ...remoteStateMetadata(),
          ...recoveryMetadata(),
        },
        { reason },
      );
      void endInterview(reason, true);
    };

    const failProgressRecovery = (event: Extract<ReconnectRecoveryEvent, { type: "deadline" | "join_failed" }>) => {
      const { previous, next } = transitionRecovery(event);
      if (previous === next || next.phase !== "failed") return;
      markProgressStalled("reconnect_failed");
    };

    const beginProgressRecoveryDeadline = () => {
      if (progressRecoveryDeadlineTimer) return;
      progressRecoveryDeadlineTimer = window.setTimeout(() => {
        progressRecoveryDeadlineTimer = null;
        if (!alive || endTriggeredRef.current) return;
        const at = Date.now();
        sendLifecycleTelemetry("watchdog_deadline_evaluated", {
          watchdog_evaluation: "recovery_deadline_expired",
          progress_age_ms: boundedElapsed(lastProgressAtRef.current, at),
          recovery_age_ms: boundedElapsed(progressRecoveryStateRef.current.startedAt, at),
          ...remoteStateMetadata(),
          ...recoveryMetadata(),
        });
        emitReconnectBindingSnapshot("recovery_deadline");
        syncParticipantsWithDiagnostics(undefined, "recovery_deadline", "watchdog_snapshot");
        failProgressRecovery({ type: "deadline", at });
      }, RECOVERY_PROGRESS_TIMEOUT_MS);
    };

    const observeRecoveryRemoteState = (evidence: RemoteParticipantEvidence) => {
      if (!isReconnectRecoveryActive(progressRecoveryStateRef.current)) return;
      transitionRecovery({
        type: "remote_state",
        at: Date.now(),
        ...evidence,
      });
    };

    syncParticipantsWithDiagnostics = (
      participants?: Record<string, DailyParticipant>,
      snapshotReason:
        | "initial_discovery" | "participant_joined" | "participant_updated" | "participant_left"
        | "track_started" | "track_stopped" | "reconnect_rediscovery" | "recovery_deadline"
        | "terminal_failure" | "watchdog_snapshot" = "watchdog_snapshot",
      transitionSource:
        | "participant_joined" | "participant_updated" | "participant_left" | "track_started"
        | "track_stopped" | "reconnect_enumeration" | "watchdog_snapshot" = "watchdog_snapshot",
    ) => {
      const map = participants || call?.participants?.() || {};
      const remoteParticipants = Object.values(map).filter((participant) => participant?.local !== true);
      const remoteParticipant = remoteParticipants[0] || null;
      const currentAudioTrack = liveTrack(preferredRemoteSlot(remoteParticipants, "audio"));
      const currentVideoTrack = liveTrack(preferredRemoteSlot(remoteParticipants, "video"));
      const priorEvidence = previousRemoteEvidence || emptyRemoteEvidence();
      const evidence = syncParticipants(participants);
      observeRecoveryRemoteState(evidence);
      const state = progressRecoveryStateRef.current;
      const events = deriveRemoteDiagnosticEvents(previousRemoteEvidence, evidence, {
        recoveryActive: isReconnectRecoveryActive(state),
        recoveryAttempt: state.attempt,
        recoveryPhase: state.phase,
      });
      previousRemoteEvidence = evidence;
      for (const diagnostic of events) {
        sendLifecycleTelemetry(diagnostic.event, diagnostic.metadata);
      }
      const snapshotMetadata: ReliabilityMetadata = {
        remote_participant_count_bucket: evidence.remoteParticipantCountBucket,
        local_remote_classification: evidence.remotePresent ? "all_non_local_as_replica" : "none",
        audio_track_state: evidence.audioState,
        video_track_state: evidence.videoState,
        audio_persistent_track_present: evidence.audioPersistentTrackPresent,
        video_persistent_track_present: evidence.videoPersistentTrackPresent,
        audio_subscription_state: evidence.audioSubscriptionState,
        video_subscription_state: evidence.videoSubscriptionState,
        startup_readiness_state: startupReadinessRef.current,
        reconnect_phase: state.phase,
        snapshot_reason: snapshotReason,
      };
      const snapshotSignature = JSON.stringify(snapshotMetadata);
      if (remoteSnapshotSignatureRef.current !== snapshotSignature) {
        remoteSnapshotSignatureRef.current = snapshotSignature;
        sendLifecycleTelemetry("daily_remote_participant_snapshot", snapshotMetadata);
      }
      for (const [kind, previousTrackState, nextTrackState] of [
        ["audio", priorEvidence.audioState, evidence.audioState],
        ["video", priorEvidence.videoState, evidence.videoState],
      ] as const) {
        const transition = deriveTrackStateTransition(
          kind,
          previousTrackState,
          nextTrackState,
          evidence,
          transitionSource,
          elapsedSinceJoinBucket(roomJoinedAtRef.current),
          startupReadinessRef.current,
          state.phase,
        );
        if (transition) sendLifecycleTelemetry(transition.event, transition.metadata);
      }
      if (isReconnectRecoveryActive(state)) {
        const participantContinuity = !remoteParticipant
          ? "absent"
          : !previousRemoteParticipantRef.current
            ? "unknown"
            : previousRemoteParticipantRef.current === remoteParticipant
              ? "same_runtime_reference"
              : "replacement_reference";
        const continuity = (previous: MediaStreamTrack | null, current: MediaStreamTrack | null) => (
          !current ? "absent" : !previous ? "unknown" : previous === current ? "retained" : "replaced"
        );
        const reconnectBindingMetadata: ReliabilityMetadata = {
          remote_participant_count_bucket: evidence.remoteParticipantCountBucket,
          audio_track_state: evidence.audioState,
          video_track_state: evidence.videoState,
          audio_attached: Boolean(remoteAudioRef.current?.srcObject),
          video_attached: Boolean(remoteVideoRef.current?.srcObject),
          participant_continuity: participantContinuity,
          audio_track_continuity: continuity(previousRemoteAudioTrackRef.current, currentAudioTrack),
          video_track_continuity: continuity(previousRemoteVideoTrackRef.current, currentVideoTrack),
          startup_readiness_state: startupReadinessRef.current,
          recovery_age_bucket: recoveryAgeBucket(state.startedAt),
        };
        emitReconnectBindingMetadata("participant_rediscovery", reconnectBindingMetadata);
        if (currentAudioTrack || currentVideoTrack) {
          emitReconnectBindingMetadata("track_rebinding", reconnectBindingMetadata);
        }
      }
      previousRemoteParticipantRef.current = remoteParticipant;
      previousRemoteAudioTrackRef.current = currentAudioTrack;
      previousRemoteVideoTrackRef.current = currentVideoTrack;
      if (!evidence.remotePresent) cancelInactivityRuntime("replica_absent");
      else if (!evidence.remoteAudioReady) cancelInactivityRuntime("remote_audio_unavailable");
      if (!inactivityCandidateMediaHealthyRef.current) {
        cancelInactivityRuntime("candidate_media_unavailable");
      }
      return evidence;
    };

    const completeProgressRecovery = (source: ReconnectProgressSource, progressAt: number) => {
      const { previous, next } = transitionRecovery({
        type: "practical_progress",
        at: progressAt,
        source,
      });
      if (previous === next || next.phase !== "recovered") return false;
      clearProgressRecoveryDeadline();
      progressRecoveryInFlightRef.current = false;
      reconnectingRef.current = false;
      sendLifecycleTelemetry("reconnect_practical_progress", {
        progress_source: source,
        recovery_age_ms: boundedElapsed(next.startedAt, progressAt),
        ...recoveryMetadata(next),
      });
      recordProgressCheckpoint(source, progressAt, "reconnect_practical_progress");
      sendLifecycleTelemetry("reconnect_succeeded", {
        progress_source: source,
        recovery_age_ms: boundedElapsed(next.startedAt, progressAt),
        remote_participant_present: next.remotePresent,
        remote_audio_state: next.remoteAudioReady ? "playable" : "unavailable",
        remote_video_state: next.remoteVideoReady ? "playable" : "unavailable",
        ...recoveryMetadata(next),
      });
      return true;
    };

    const beginProgressWatchdog = () => {
      stopProgressWatchdog();
      sendLifecycleTelemetry("watchdog_started", {
        recovery_attempt: progressRecoveryStateRef.current.attempt,
        recovery_phase: progressRecoveryStateRef.current.phase,
        is_recovery_active: false,
      });
      progressWatchdogTimer = window.setInterval(async () => {
        if (!alive || endTriggeredRef.current) {
          stopProgressWatchdog();
          return;
        }
        if (avatarClosingActiveRef.current) {
          stopProgressWatchdog();
          return;
        }

        const evaluationAt = Date.now();
        const evaluation = evaluateProgressWatchdog({
          now: evaluationAt,
          progressObserved: progressObservedRef.current,
          lastProgressAt: lastProgressAtRef.current,
          hasCall: Boolean(call),
          recoveryInFlight: progressRecoveryInFlightRef.current,
          recoveryActive: isReconnectRecoveryActive(progressRecoveryStateRef.current),
          recoveryAttempted: progressRecoveryAttemptedRef.current,
          lastAiSpeechStoppedAt: lastAiSpeechStoppedAtRef.current,
          candidateSpeaking: candidateSpeakingStateRef.current,
        });
        candidateSpeakingStateRef.current = evaluation.candidateSpeaking;

        if (evaluation.action === "skip_candidate_speaking") {
          if (evaluation.emitDiagnostic) {
            sendLifecycleTelemetry("watchdog_deadline_evaluated", {
              watchdog_evaluation: "candidate_speaking_active",
              progress_age_ms: boundedElapsed(lastProgressAtRef.current, evaluationAt),
              ...remoteStateMetadata(),
              ...recoveryMetadata(),
            });
          }
          return;
        }

        if (evaluation.action === "candidate_speaking_expired") {
          sendLifecycleTelemetry("watchdog_deadline_evaluated", {
            watchdog_evaluation: "candidate_speaking_protection_expired",
            progress_age_ms: boundedElapsed(lastProgressAtRef.current, evaluationAt),
            ...remoteStateMetadata(),
            ...recoveryMetadata(),
          });
          // Expiry only removes the temporary protection. Ordinary watchdog
          // handling resumes on the next bounded evaluation.
          return;
        }

        if (evaluation.action === "none") {
          return;
        }

        if (evaluation.action === "terminal") {
          sendLifecycleTelemetry("watchdog_deadline_evaluated", {
            watchdog_evaluation: "post_recovery_progress_stale",
            progress_age_ms: boundedElapsed(lastProgressAtRef.current, evaluationAt),
            recovery_age_ms: boundedElapsed(progressRecoveryStateRef.current.startedAt, evaluationAt),
            ...remoteStateMetadata(),
            ...recoveryMetadata(),
          });
          markProgressStalled("watchdog_timeout");
          return;
        }

        const recoveryCall = call;
        if (!recoveryCall) return;
        const recoveryStartedAt = evaluationAt;
        sendLifecycleTelemetry("watchdog_deadline_evaluated", {
          watchdog_evaluation: "recovery_threshold_reached",
          progress_age_ms: boundedElapsed(lastProgressAtRef.current, recoveryStartedAt),
          ...remoteStateMetadata(),
          recovery_attempt: 0,
          recovery_phase: "idle",
          is_recovery_active: false,
        });
        progressRecoveryAttemptedRef.current = true;
        progressRecoveryInFlightRef.current = true;
        reconnectingRef.current = true;
        cancelInactivityRuntime("watchdog_recovery");
        transitionRecovery({ type: "start", at: recoveryStartedAt });
        const previousReadiness = startupReadinessRef.current;
        startupReadinessRef.current = transitionStartupReadiness(previousReadiness, "startup_recovering", false);
        if (startupReadinessRef.current !== previousReadiness) {
          sendLifecycleTelemetry("startup_readiness_changed", {
            startup_readiness_state: startupReadinessRef.current,
            reconnect_phase: "reconnecting_transport",
          });
        }
        emitReconnectBindingSnapshot("initiation");
        previousRemoteEvidence = emptyRemoteEvidence();
        beginProgressRecoveryDeadline();
        sendLifecycleTelemetry("reconnect_started", {
          progress_age_ms: boundedElapsed(lastProgressAtRef.current, recoveryStartedAt),
          meeting_state: "reconnecting",
          ...recoveryMetadata(),
        }, { reason: "watchdog_timeout" });
        sendLifecycleTelemetry("reconnect_attempted", {
          progress_age_ms: boundedElapsed(lastProgressAtRef.current, recoveryStartedAt),
          ...recoveryMetadata(),
        }, { reason: "watchdog_timeout" });
        if (avatarClosingActiveRef.current) {
          stopProgressWatchdog();
          return;
        }
        try {
          await recoveryCall.leave().catch(() => {});
          if (remoteVideoRef.current?.srcObject) remoteVideoRef.current.srcObject = null;
          remoteVideoAttachmentResultRef.current = "detached_for_reconnect";
          emitReconnectBindingSnapshot("post_leave", emptyRemoteEvidence());
          if (!alive || endTriggeredRef.current) return;
          await recoveryCall.join({
            url: session.conversation_url,
            userName: "Candidate",
            startAudioOff: avatarClosingActiveRef.current,
            startVideoOff: false,
          });
          if (!alive || endTriggeredRef.current) return;
          recordReconnectLocalJoin(Date.now());
          emitReconnectBindingSnapshot("rejoin_success");
          void emitReceiveSettingsSnapshot();
          syncParticipantsWithDiagnostics(undefined, "reconnect_rediscovery", "reconnect_enumeration");
        } catch {
          failProgressRecovery({ type: "join_failed", at: Date.now() });
        } finally {
          reconnectingRef.current = false;
          if (!isReconnectRecoveryActive(progressRecoveryStateRef.current)) {
            progressRecoveryInFlightRef.current = false;
          }
        }
      }, PROGRESS_WATCHDOG_INTERVAL_MS);
    };

    (async () => {
      try {
        setLoading(true);
        setError("");
        startupReadyRef.current = false;
        startupReadinessRef.current = transitionStartupReadiness(
          startupReadinessRef.current,
          "waiting_for_remote_participant",
          true,
        );
        replicaProgressConfirmedRef.current = false;
        startupRecoveryAttemptedRef.current = false;
        roomJoinedAtRef.current = null;
        remoteSnapshotSignatureRef.current = "";
        reconnectBindingSignaturesRef.current = {};
        remoteVideoAttachmentSignatureRef.current = "";
        remoteVideoAttachmentResultRef.current = "no_track";
        previousRemoteParticipantRef.current = null;
        previousRemoteAudioTrackRef.current = null;
        previousRemoteVideoTrackRef.current = null;
        recordingStartRequestedRef.current = false;
        reconnectingRef.current = false;
        progressObservedRef.current = false;
        lastProgressAtRef.current = null;
        progressRecoveryAttemptedRef.current = false;
        progressRecoveryInFlightRef.current = false;
        progressRecoveryStateRef.current = createReconnectRecoveryState();
        lastAiSpeechAtRef.current = null;
        lastAiSpeechStoppedAtRef.current = null;
        candidateSpeakingStateRef.current = createCandidateSpeakingState();
        inactivityTransportHealthyRef.current = false;
        inactivityCandidateMediaHealthyRef.current = false;
        inactivityRemoteEvidenceRef.current = null;

        const daily = await loadDailySdk();
        if (!alive) return;

        call = daily.createCallObject();
        callRef.current = call;

        register("joined-meeting", () => {
          if (!alive || endTriggeredRef.current) return;
          const initialJoin = roomJoinedAtRef.current === null;
          if (initialJoin) roomJoinedAtRef.current = Date.now();
          inactivityTransportHealthyRef.current = true;
          if (progressRecoveryStateRef.current.phase === "reconnecting_transport") {
            recordReconnectLocalJoin(Date.now());
          }
          sendLifecycleTelemetry("daily_participant_joined", {
            participant_role: "candidate",
            meeting_state: "joined",
            ...recoveryMetadata(),
          });
          if (initialJoin) {
            sendLifecycleTelemetry("startup_readiness_changed", {
              startup_readiness_state: startupReadinessRef.current,
              reconnect_phase: progressRecoveryStateRef.current.phase,
            });
          }
          void emitReceiveSettingsSnapshot();
          syncParticipantsWithDiagnostics(
            undefined,
            initialJoin ? "initial_discovery" : "reconnect_rediscovery",
            initialJoin ? "participant_joined" : "reconnect_enumeration",
          );
          void requestRecordingStart();
        });
        register("participant-joined", (event) => {
          if (!alive || endTriggeredRef.current) return;
          syncParticipantsWithDiagnostics(event?.participants, "participant_joined", "participant_joined");
        });
        register("participant-updated", (event) => {
          if (!alive || endTriggeredRef.current) return;
          syncParticipantsWithDiagnostics(event?.participants, "participant_updated", "participant_updated");
        });
        register("participant-left", (event) => {
          if (!alive || endTriggeredRef.current) return;
          syncParticipantsWithDiagnostics(event?.participants, "participant_left", "participant_left");
        });
        register("track-started", (event) => {
          if (!alive || endTriggeredRef.current) return;
          syncParticipantsWithDiagnostics(event?.participants, "track_started", "track_started");
        });
        register("track-stopped", (event) => {
          if (!alive || endTriggeredRef.current) return;
          syncParticipantsWithDiagnostics(event?.participants, "track_stopped", "track_stopped");
        });
        register("receive-settings-updated", (event) => {
          if (!alive || endTriggeredRef.current) return;
          void emitReceiveSettingsSnapshot(event?.receiveSettings ?? event?.data, true);
        });
        register("left-meeting", () => {
          if (!alive || leavingRef.current || reconnectingRef.current) return;
          inactivityTransportHealthyRef.current = false;
          cancelInactivityRuntime("transport_unhealthy");
          sendLifecycleTelemetry("daily_participant_left", {
            participant_role: "candidate",
            meeting_state: "left",
            ...recoveryMetadata(),
          });
          if (isReconnectRecoveryActive(progressRecoveryStateRef.current)) {
            failProgressRecovery({ type: "join_failed", at: Date.now() });
            return;
          }
          void leaveLiveRoute();
        });
        register("error", () => {
          if (!alive || endTriggeredRef.current) return;
          inactivityTransportHealthyRef.current = false;
          cancelInactivityRuntime("transport_unhealthy");
          if (isReconnectRecoveryActive(progressRecoveryStateRef.current)) {
            failProgressRecovery({ type: "join_failed", at: Date.now() });
            return;
          }
          setError("Interview encountered an issue. Please finish and relaunch.");
        });
        register("camera-error", () => {
          if (!alive || endTriggeredRef.current) return;
          inactivityCandidateMediaHealthyRef.current = false;
          cancelInactivityRuntime("candidate_media_unavailable");
          setError("Camera or microphone access failed. Please allow permissions and relaunch.");
        });
        register("app-message", (event) => {
          if (!alive || endTriggeredRef.current) return;
          const data = event?.data ?? event ?? {};
          const eventType = String(data?.event_type || data?.eventType || "").toLowerCase();
          const utteranceRole = String(data?.properties?.role || data?.role || "").toLowerCase();
          const nextPalSpeechOrdinal = palSpeechEventOrdinalRef.current + 1;
          const normalizedExplicitPalSpeaking = normalizePalSpeakingEvent(
            data,
            String(session.conversation_id || "").trim(),
            nextPalSpeechOrdinal,
          );
          const correlatedRolelessPalStop = normalizeCorrelatedRolelessPalStop(
            data,
            String(session.conversation_id || "").trim(),
            nextPalSpeechOrdinal,
            replicaSpeakingRef.current,
            candidateSpeakingStateRef.current.active,
          );
          const normalizedPalSpeaking = normalizedExplicitPalSpeaking || correlatedRolelessPalStop;
          if (normalizedPalSpeaking) palSpeechEventOrdinalRef.current = nextPalSpeechOrdinal;

          // Closing blocks ordinary turn-taking. Provider speaking events are
          // diagnostic-only here: duplicated, role-less, delayed, or
          // interrupted events must never authorize an early provider end.
          // The one owner keeps Tavus audio open and the fixed post-Echo grace
          // timer is the sole authority for terminal provider shutdown.
          if (avatarClosingActiveRef.current) {
            if (!normalizedPalSpeaking) return;
            if (!avatarClosingOwnedRef.current) {
              farewellAudioAudibleRef.current = false;
              suppressRemotePalAudio(remoteAudioRef.current);
              return;
            }
            if (!closingEchoDispatchRequestedRef.current) {
              farewellAudioAudibleRef.current = false;
              suppressRemotePalAudio(remoteAudioRef.current);
              return;
            }
            const current = timerRuntimeRef.current?.boundaryState || createInterviewTimeBoundaryState();
            const inferenceMatch = Boolean(normalizedPalSpeaking.inferenceId) &&
              normalizedPalSpeaking.inferenceId === current.farewellInferenceId;
            farewellAudioAudibleRef.current = true;
            syncParticipantsWithDiagnostics();
            if (normalizedPalSpeaking.kind === "started") {
              if (closingStartTimerRef.current) {
                window.clearTimeout(closingStartTimerRef.current);
                closingStartTimerRef.current = null;
              }
              sendLifecycleTelemetry("closing_farewell_started", {
                closing_state: "FAREWELL_AUDIBLE",
                speech_result_category: "started",
                inference_match: inferenceMatch,
                remote_audio_state_category: "audible",
                remaining_time_bucket: "0_10",
              });
              return;
            }
            if (normalizedPalSpeaking.interrupted) {
              sendLifecycleTelemetry("closing_farewell_interrupted", {
                closing_state: "FAREWELL_AUDIBLE",
                inference_match: inferenceMatch,
                speech_interrupted: true,
                remote_audio_state_category: "audible",
                remaining_time_bucket: "0_10",
              });
              return;
            }
            sendLifecycleTelemetry("closing_farewell_completed", {
              closing_state: "FAREWELL_AUDIBLE",
              speech_result_category: "completed",
              inference_match: inferenceMatch,
              speech_interrupted: false,
              remaining_time_bucket: "0_10",
            });
            return;
          }
          const speech = String(data?.properties?.speech || data?.properties?.text || data?.speech || data?.text || "");
          const isReplicaUtterance =
            eventType === "conversation.utterance" &&
            (utteranceRole === "replica" || utteranceRole === "assistant" || utteranceRole === "agent");
          const isCandidateUtterance =
            eventType === "conversation.utterance" &&
            (utteranceRole === "candidate" || utteranceRole === "user" || utteranceRole === "participant");
          const isReplicaSpeaking =
            (eventType === "conversation.started_speaking" &&
              (utteranceRole === "replica" || utteranceRole === "pal" || utteranceRole === "assistant" || utteranceRole === "agent")) ||
            normalizedPalSpeaking?.kind === "started";
          const isReplicaStoppedSpeaking =
            (eventType === "conversation.stopped_speaking" &&
              (utteranceRole === "replica" || utteranceRole === "pal" || utteranceRole === "assistant" || utteranceRole === "agent")) ||
            normalizedPalSpeaking?.kind === "stopped";
          const candidateSpeakingTransition =
            deriveCandidateSpeakingTransition(eventType, utteranceRole);
          const isCandidateSpeaking = candidateSpeakingTransition === "started";
          const isCandidateStoppedSpeaking = candidateSpeakingTransition === "ended";
          if (isCandidateSpeaking) {
            recordInactivityCandidateActivity("candidate_speaking");
          }
          if (normalizedPalSpeaking?.kind === "started") {
            cancelInactivityRuntime("pal_speaking");
          }

          const recoveryWasActive = isReconnectRecoveryActive(progressRecoveryStateRef.current);
          if (recoveryWasActive) {
            syncParticipantsWithDiagnostics();
          }
          const progressAt = Date.now();
          if (isReplicaSpeaking || isReplicaUtterance) {
            replicaProgressConfirmedRef.current = true;
            const previousReadiness = startupReadinessRef.current;
            const nextReadiness = transitionStartupReadiness(
              previousReadiness,
              "replica_progress_confirmed",
              false,
            );
            startupReadinessRef.current = nextReadiness;
            if (nextReadiness !== previousReadiness) {
              sendLifecycleTelemetry("startup_readiness_changed", {
                startup_readiness_state: nextReadiness,
                reconnect_phase: progressRecoveryStateRef.current.phase,
              });
            }
            if (nextReadiness !== "startup_failed") {
              startupReadyRef.current = true;
              clearStartupTimer();
              setLoading(false);
              setError("");
            }
          }
          const progressSource = isReplicaSpeaking
            ? "replica_started_speaking"
            : isReplicaUtterance
              ? "replica_utterance"
              : isCandidateUtterance
                ? "candidate_utterance"
                : isCandidateSpeaking
                  ? "candidate_speaking_started"
                  : isCandidateStoppedSpeaking
                    ? "candidate_speaking_ended"
                    : null;
          if (
            eventType === "conversation.started_speaking" ||
            eventType === "conversation.stopped_speaking" ||
            eventType === "conversation.utterance" ||
            eventType === "conversation.tool_call" ||
            eventType === "conversation.toolcall"
          ) {
            sendLifecycleTelemetry("app_message_received", {
              participant_role:
                isReplicaSpeaking || isReplicaUtterance
                  ? "replica"
                  : isCandidateSpeaking || isCandidateStoppedSpeaking || isCandidateUtterance
                    ? "candidate"
                    : "unknown",
              ...(progressSource ? { progress_source: progressSource } : {}),
              ...recoveryMetadata(),
            });
          }
          let recoveryCompleted = false;
          if (isReplicaSpeaking) {
            replicaSpeakingRef.current = true;
            lastAiSpeechAtRef.current = progressAt;
            recoveryCompleted = completeProgressRecovery("replica_started_speaking", progressAt);
            if (!recoveryWasActive) recordProgressCheckpoint("replica_started_speaking", progressAt);
          }
          if (isReplicaStoppedSpeaking) {
            replicaSpeakingRef.current = false;
            lastAiSpeechStoppedAtRef.current = progressAt;
            if (normalizedPalSpeaking) {
              armInactivityRuntime(normalizedPalSpeaking);
            }
          }
          if (isCandidateSpeaking) {
            const started = beginCandidateSpeaking(candidateSpeakingStateRef.current, progressAt);
            candidateSpeakingStateRef.current = started.state;
            if (started.started) {
              progressObservedRef.current = true;
              recordProgressCheckpoint("candidate_speaking_started", progressAt);
              if (!recoveryWasActive) setConnectionNotice("");
            }
          }
          if (isCandidateStoppedSpeaking) {
            const stopped = endCandidateSpeaking(candidateSpeakingStateRef.current);
            candidateSpeakingStateRef.current = stopped.state;
            if (stopped.ended) {
              progressObservedRef.current = true;
              recordProgressCheckpoint("candidate_speaking_ended", progressAt);
              if (!recoveryWasActive) setConnectionNotice("");
            }
          }
          if (eventType === "conversation.utterance") {
            if (isCandidateUtterance) {
              recordInactivityCandidateActivity("candidate_utterance");
              candidateSpeakingStateRef.current =
                endCandidateSpeaking(candidateSpeakingStateRef.current).state;
            }
            if (isReplicaUtterance || (isCandidateUtterance && isCandidateAnswerProgress(speech))) {
              progressObservedRef.current = true;
              if (isReplicaUtterance && !recoveryCompleted) {
                recoveryCompleted = completeProgressRecovery("replica_utterance", progressAt);
              }
              if (!recoveryWasActive) {
                recordProgressCheckpoint(
                  isReplicaUtterance ? "replica_utterance" : "candidate_utterance",
                  progressAt,
                );
              }
              if (!recoveryWasActive) setConnectionNotice("");
            }
          }
          if (isCandidateStoppedSpeaking ||
              isCandidateUtterance ||
              isReplicaStoppedSpeaking) {
            const remaining = secondsRemainingRef.current;
            if (typeof remaining === "number") processTimeBoundary(remaining);
          }
          if (eventType === "conversation.tool_call" || eventType === "conversation.toolcall") {
            const toolName = String(
              data?.name ??
              data?.tool?.name ??
              data?.tool_name ??
              data?.tool?.function?.name ??
              data?.function?.name ??
              "",
            ).trim().toLowerCase();
            if (isTerminalInterviewToolName(toolName)) {
              void endInterview("closing_utterance");
              return;
            }
          }
          if (isNormalCompletionFarewell({
            eventType,
            role: utteranceRole,
            speech,
            phase: timerRuntimeRef.current?.boundaryState.phase,
            avatarClosingActive: avatarClosingActiveRef.current,
          })) {
            if (!normalCompletionEndTimerRef.current) {
              normalCompletionEndTimerRef.current = window.setTimeout(() => {
                normalCompletionEndTimerRef.current = null;
                if (!normalCompletionEndAllowed({
                  phase: timerRuntimeRef.current?.boundaryState.phase,
                  avatarClosingActive: avatarClosingActiveRef.current,
                  endTriggered: endTriggeredRef.current,
                })) return;
                void endInterview("completed_normally");
              }, NORMAL_COMPLETION_END_DELAY_MS);
            }
            return;
          }
          const payloadText = JSON.stringify(data || {}).toLowerCase();
          if (/call_ended|call-ended|meeting-ended|meeting_ended|room_left|room-left|session_ended|session-ended|conversation_ended|conversation-ended|interview_ended|interview-ended/.test(payloadText)) {
            void endInterview("vendor_end_event");
          }
        });

        await applySelectedDevices();
        beginStartupWatchdog();
        await call.join({
          url: session.conversation_url,
          userName: "Candidate",
          startAudioOff: avatarClosingActiveRef.current,
          startVideoOff: false,
        });
        if (!alive) return;
        syncParticipantsWithDiagnostics();
        beginProgressWatchdog();
      } catch {
        if (!alive) return;
        setLoading(false);
        setError("Interview did not start correctly. Please relaunch and try again.");
      }
    })();

    return () => {
      alive = false;
      clearStartupTimer();
      stopProgressWatchdog();
      clearProgressRecoveryDeadline();
      reconnectingRef.current = false;
      progressRecoveryInFlightRef.current = false;
      inactivityTransportHealthyRef.current = false;
      cancelInactivityRuntime("unmount", true);
      candidateSpeakingStateRef.current = createCandidateSpeakingState();
      replicaSpeakingRef.current = false;
      if (call?.off) {
        for (const [eventName, handler] of handlers) {
          try {
            call.off(eventName, handler);
          } catch {}
        }
      }
      handlers = [];
      void teardownCall();
    };
  }, [
    armInactivityRuntime,
    cancelInactivityRuntime,
    clearStartupTimer,
    endInterview,
    finishAvatarClosingSpeech,
    leaveLiveRoute,
    persistBoundaryState,
    processTimeBoundary,
    recordInactivityCandidateActivity,
    sendLifecycleTelemetry,
    session,
    syncParticipants,
    teardownCall,
  ]);

  useEffect(() => {
    const maxMinutes = session?.max_interview_minutes;
    if (!maxMinutes || maxMinutes <= 0) {
      setSecondsRemaining(null);
      secondsRemainingRef.current = null;
      return;
    }

    const timerSessionKey = `${String(session?.conversation_id || "")}:${maxMinutes}`;
    const previousRuntime = timerRuntimeRef.current;
    const runtime = initializeInterviewTimerRuntime(
      previousRuntime,
      timerSessionKey,
      monotonicNow(),
      maxMinutes * 60 * 1000,
    );
    timerRuntimeRef.current = runtime;
    if (!finalTerminationTimerRef.current && typeof runtime.deadlineAt === "number") {
      finalTerminationTimerRef.current = window.setTimeout(() => {
        finalTerminationTimerRef.current = null;
        secondsRemainingRef.current = 0;
        setSecondsRemaining(0);
        processTimeBoundary(0);
      }, Math.max(0, runtime.deadlineAt - monotonicNow()));
    }
    let timer: number | null = null;
    const tick = () => {
      const remaining = remainingSecondsAtDeadline(runtime.deadlineAt, monotonicNow()) ?? 0;
      secondsRemainingRef.current = remaining;
      setSecondsRemaining(remaining);
      if (endTriggeredRef.current) {
        if (timer) {
          window.clearInterval(timer);
          timer = null;
        }
        return;
      }
      processTimeBoundary(remaining);
      if (remaining <= 0) {
        if (timer) {
          window.clearInterval(timer);
          timer = null;
        }
      }
    };

    tick();
    timer = window.setInterval(tick, 1000);
    return () => {
      if (timer) window.clearInterval(timer);
    };
  }, [
    processTimeBoundary,
    session?.conversation_id,
    session?.max_interview_minutes,
  ]);

  useEffect(() => {
    if (!backendBase || !session?.interview_id || !session?.role_token) return;

    let alive = true;
    const poll = async () => {
      try {
        const qs = new URLSearchParams({
          interview_id: String(session.interview_id),
          role_token: String(session.role_token),
        });
        const resp = await fetch(joinUrl(backendBase, `/public/interview-status?${qs.toString()}`));
        const data = await resp.json().catch(() => ({}));
        if (!alive || !resp.ok) return;
        const status = String(data?.status || "");
        if (status === "ending_requested" || status === "Ended") {
          if (avatarClosingActiveRef.current) return;
          await leaveLiveRoute();
        }
      } catch {}
    };

    poll();
    const timer = window.setInterval(poll, 2500);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [leaveLiveRoute, session]);

  const finishInterview = useCallback(async () => {
    if (finishBusy || !session) return;
    setFinishBusy(true);
    setError("");
    await endInterview("manual");
  }, [endInterview, finishBusy, session]);

  const exitFailedInterview = useCallback(() => {
    try {
      window.sessionStorage.removeItem(LIVE_STATE_KEY);
    } catch {}
    const roleToken = String(session?.role_token || "").trim();
    setLocation(roleToken ? `/interview/${encodeURIComponent(roleToken)}` : "/interview");
  }, [session?.role_token, setLocation]);

  const timerLabel = useMemo(() => formatCountdown(secondsRemaining), [secondsRemaining]);
  const timerToneClass = useMemo(() => {
    const tone = timerToneForRemaining(secondsRemaining);
    if (tone === "urgent") return "bg-[#EF4444]/90 border-[#DC2626] text-white";
    if (tone === "warning") return "bg-[#FBBF24]/90 border-[#F59E0B] text-[#3A2600]";
    return "bg-black/60 border-white/20 text-white";
  }, [secondsRemaining]);
  const candidateAssistanceContact = useMemo(
    () => String(session?.candidate_assistance_contact || "").trim(),
    [session?.candidate_assistance_contact],
  );
  const candidateAssistanceHref = useMemo(() => {
    if (!candidateAssistanceContact) return "";
    if (candidateAssistanceContact.includes("@")) return `mailto:${candidateAssistanceContact}`;
    const digits = candidateAssistanceContact.replace(/[^\d]/g, "");
    if (digits.length >= 7) return `tel:${candidateAssistanceContact}`;
    return "";
  }, [candidateAssistanceContact]);

  if (!session) return null;

  return (
    <div className="min-h-screen bg-[#F8F9FD] flex flex-col" style={{ fontFamily: "'Raleway', sans-serif" }}>
      <CandidateHeader />

      <main className="flex-1 flex flex-col items-center justify-center px-4 py-8 sm:py-12">
        <div
          className="w-full max-w-6xl bg-white rounded-2xl p-4 sm:p-5"
          style={{
            border: "1px solid rgba(10,21,71,0.07)",
            boxShadow: "0 4px 24px rgba(10,21,71,0.08)",
          }}
        >
          <div
            className="relative w-full rounded-2xl border border-[rgba(10,21,71,0.10)] bg-black overflow-hidden"
            style={{ aspectRatio: "16 / 9" }}
          >
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="absolute inset-0 w-full h-full object-cover bg-black"
            />
            <audio ref={remoteAudioRef} autoPlay />

            <div
              className={`absolute bottom-4 right-4 w-40 h-28 rounded-lg overflow-hidden border border-white/20 bg-[#0A1547] ${
                hasLocalVideo ? "opacity-100" : "opacity-0 pointer-events-none"
              }`}
            >
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
            </div>

            {(!hasRemoteVideo || loading) && (
              <div className="absolute inset-0 flex items-center justify-center text-white/70 text-sm font-semibold">
                Connecting interview…
              </div>
            )}

            {!loading && error && (
              <div className="absolute inset-0 flex items-center justify-center text-center px-6 bg-black/35">
                <p className="text-red-200 text-sm font-semibold">{error}</p>
              </div>
            )}

            {timerLabel && (
              <div className={`absolute top-3 right-3 px-3 py-1 rounded-full border text-[11px] font-bold tracking-wide ${timerToneClass}`}>
                {timerLabel}
              </div>
            )}

            {connectionNotice && (
              <div className="absolute top-3 left-3 max-w-[calc(100%-8rem)] px-3 py-2 rounded-xl border border-[#F59E0B]/40 bg-[#FFFBEB]/95 text-[#3A2600] text-[11px] sm:text-xs font-bold shadow-sm pointer-events-none">
                {connectionNotice}
              </div>
            )}
          </div>

          <div className="mt-3 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setHelpOpen(true)}
              className="px-4 py-2 rounded-full text-xs sm:text-sm font-bold transition-colors border border-[rgba(10,21,71,0.14)] text-[#0A1547] hover:bg-white"
            >
              Need help?
            </button>
            {progressStalled ? (
              <button
                type="button"
                onClick={exitFailedInterview}
                className="px-6 py-2.5 rounded-full text-sm font-bold text-white transition-all hover:opacity-90 active:scale-[0.97]"
                style={{ backgroundColor: "#A380F6" }}
              >
                Exit interview
              </button>
            ) : (
              <button
                type="button"
                onClick={finishInterview}
                disabled={finishBusy}
                className="flex items-center gap-2.5 px-6 py-2.5 rounded-full text-sm font-bold text-white transition-all hover:opacity-90 active:scale-[0.97]"
                style={{ backgroundColor: "#A380F6" }}
              >
                {finishBusy ? "Finishing..." : "Finish Interview"}
              </button>
            )}
          </div>

          {!loading && error && (
            <p className="mt-3 text-center text-xs font-semibold text-red-500">{error}</p>
          )}
        </div>
      </main>

      {helpOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/35 backdrop-blur-[1px]">
          <div
            className="w-full max-w-md bg-white rounded-2xl p-5 sm:p-6"
            style={{
              border: "1px solid rgba(10,21,71,0.10)",
              boxShadow: "0 12px 40px rgba(10,21,71,0.16)",
            }}
          >
            <h2 className="text-base sm:text-lg font-black text-[#0A1547] mb-3">Need help?</h2>
            <div className="space-y-3">
              <p className="text-xs sm:text-sm text-[#0A1547]/75 leading-relaxed">
                <span className="font-bold text-[#0A1547]">Technical issues with the platform:</span>{" "}
                <a href="mailto:info@alphasourceai.com" className="text-[#A380F6] hover:underline font-semibold">
                  info@alphasourceai.com
                </a>
              </p>
              <p className="text-xs sm:text-sm text-[#0A1547]/75 leading-relaxed">
                <span className="font-bold text-[#0A1547]">Questions about the role or interview process:</span>{" "}
                {candidateAssistanceContact ? (
                  candidateAssistanceHref ? (
                    <a href={candidateAssistanceHref} className="text-[#A380F6] hover:underline font-semibold">
                      {candidateAssistanceContact}
                    </a>
                  ) : (
                    <span className="font-semibold text-[#0A1547]">{candidateAssistanceContact}</span>
                  )
                ) : (
                  <span className="text-[#0A1547]/60">Please contact your hiring team.</span>
                )}
              </p>
            </div>
            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setHelpOpen(false)}
                className="px-4 py-2 rounded-full text-xs sm:text-sm font-bold text-white transition-opacity hover:opacity-90"
                style={{ backgroundColor: "#A380F6" }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
