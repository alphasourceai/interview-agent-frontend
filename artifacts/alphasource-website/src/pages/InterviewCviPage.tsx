import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { alphaSourceLogo } from "@/assets/branding";

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
};

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
  | "FINAL_FAREWELL_ELIGIBLE"
  | "ENDED";

export type ClosingFarewellPhase =
  | "IDLE"
  | "RESERVED"
  | "DISPATCHED"
  | "SPEAKING"
  | "COMPLETED"
  | "INTERRUPTED";

export type InterviewTimeBoundaryState = {
  phase: InterviewClosingPhase;
  closingFarewellSent: boolean;
  closingFarewellPhase: ClosingFarewellPhase;
  farewellInferenceId: string;
  farewellProviderTurnKey: string | null;
  closingInterruptRequested: boolean;
  providerEndRequested: boolean;
  providerEndConfirmed: boolean;
  turnIndex: number;
};

export type InterviewTimeBoundaryAction =
  | "record_closing_farewell_reserved"
  | "send_closing_farewell"
  | "request_provider_end"
  | "interrupt_replica";

export type InterviewTimeBoundaryEvaluation = {
  state: InterviewTimeBoundaryState;
  actions: InterviewTimeBoundaryAction[];
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
};

type DailyCallObject = {
  join: (options: { url: string; userName?: string; startAudioOff?: boolean; startVideoOff?: boolean }) => Promise<unknown>;
  leave: () => Promise<unknown>;
  destroy: () => void;
  on: (event: string, handler: (event?: DailyEvent) => void) => void;
  off?: (event: string, handler: (event?: DailyEvent) => void) => void;
  participants?: () => Record<string, DailyParticipant>;
  sendAppMessage?: (message: unknown, recipients?: string | string[]) => void;
  startRecording?: () => Promise<unknown>;
  setInputDevicesAsync?: (devices: { videoDeviceId?: string; audioDeviceId?: string }) => Promise<unknown>;
  setInputDevices?: (devices: { videoDeviceId?: string; audioDeviceId?: string }) => Promise<unknown> | unknown;
};

type DailySdk = {
  createCallObject: () => DailyCallObject;
};

type DirectClosingSpeech = {
  kind: "farewell";
  inferenceId: string;
} | null;

declare global {
  interface Window {
    DailyIframe?: DailySdk;
  }
}

const DAILY_SCRIPT_ID = "alphasource-daily-sdk";
const DAILY_SCRIPT_SRC = "https://unpkg.com/@daily-co/daily-js";
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
const FINAL_CLOSING_THRESHOLD_SECONDS = 20;
export const CANDIDATE_INACTIVITY_NUDGE_THRESHOLD_MS = 10000;
export const CANDIDATE_INACTIVITY_NUDGE_MAX_LATENESS_MS = 2000;
export const CANDIDATE_INACTIVITY_NUDGE_TEXT =
  "Take your time. When you’re ready, you can continue.";
const CANDIDATE_INACTIVITY_NUDGE_INFERENCE_PREFIX =
  "alphascreen-candidate-inactivity-nudge";
const CLOSING_FAREWELL_INFERENCE_PREFIX = "alphascreen-closing-farewell";
const CANDIDATE_INACTIVITY_LEASE_PREFIX = "alphascreen-inactivity-owner";
const CANDIDATE_INACTIVITY_LEASE_MS = 6000;
const CANDIDATE_INACTIVITY_LEASE_RENEW_MS = 2000;
const MAX_PROCESSED_INACTIVITY_TURNS = 24;
const FINAL_CLOSING_UTTERANCE =
  "Time is winding down. Thank you for your time. I am ending the session now.";
const MAX_PENDING_TELEMETRY_REQUESTS = 8;
const closingRuntimeBySession = new Map<string, InterviewTimerRuntimeState>();

const CLOSING_PHASE_ORDER: Record<InterviewClosingPhase, number> = {
  INTERVIEWING: 0,
  FINAL_FAREWELL_ELIGIBLE: 1,
  ENDED: 2,
};

export function closingApplicationInferenceId(
  sessionKey: string,
): string {
  return `${CLOSING_FAREWELL_INFERENCE_PREFIX}-${boundedOpaqueHash(sessionKey)}`;
}

export function createInterviewTimeBoundaryState(sessionKey = "unbound"): InterviewTimeBoundaryState {
  return {
    phase: "INTERVIEWING",
    closingFarewellSent: false,
    closingFarewellPhase: "IDLE",
    farewellInferenceId: closingApplicationInferenceId(sessionKey),
    farewellProviderTurnKey: null,
    closingInterruptRequested: false,
    providerEndRequested: false,
    providerEndConfirmed: false,
    turnIndex: 0,
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

export function reserveClosingFarewell(
  state: InterviewTimeBoundaryState,
): { state: InterviewTimeBoundaryState; reserved: boolean } {
  if (
    state.providerEndRequested ||
    state.closingFarewellPhase !== "IDLE" ||
    state.closingFarewellSent
  ) {
    return { state, reserved: false };
  }
  return {
    state: {
      ...state,
      closingFarewellSent: true,
      closingFarewellPhase: "RESERVED",
    },
    reserved: true,
  };
}

export function markClosingFarewellDispatched(
  state: InterviewTimeBoundaryState,
): InterviewTimeBoundaryState {
  if (state.closingFarewellPhase !== "RESERVED" || state.providerEndRequested) return state;
  return { ...state, closingFarewellPhase: "DISPATCHED" };
}

export function markClosingFarewellDispatchFailed(
  state: InterviewTimeBoundaryState,
): InterviewTimeBoundaryState {
  if (state.closingFarewellPhase !== "RESERVED") return state;
  return { ...state, closingFarewellPhase: "INTERRUPTED" };
}

export function recordClosingFarewellSpeechEvent(
  state: InterviewTimeBoundaryState,
  event: NormalizedPalSpeakingEvent,
  activeConversationId: string,
  expectedApplicationInferenceId = "",
): {
  state: InterviewTimeBoundaryState;
  matched: boolean;
  transition: "none" | "speaking" | "completed" | "interrupted";
} {
  if (
    state.providerEndRequested ||
    !activeConversationId ||
    event.conversationId !== activeConversationId
  ) {
    return { state, matched: false, transition: "none" };
  }
  const explicitInferenceMatches = event.inferenceId === state.farewellInferenceId;
  const directApplicationFallback =
    !event.inferenceId &&
    expectedApplicationInferenceId === state.farewellInferenceId;
  if (!explicitInferenceMatches && !directApplicationFallback) {
    return { state, matched: false, transition: "none" };
  }
  if (event.kind === "started") {
    if (state.closingFarewellPhase !== "DISPATCHED") {
      return { state, matched: true, transition: "none" };
    }
    return {
      state: {
        ...state,
        closingFarewellPhase: "SPEAKING",
        farewellProviderTurnKey: event.turnKey,
      },
      matched: true,
      transition: "speaking",
    };
  }
  if (state.closingFarewellPhase !== "SPEAKING") {
    return { state, matched: true, transition: "none" };
  }
  if (
    !state.farewellProviderTurnKey ||
    state.farewellProviderTurnKey !== event.turnKey
  ) {
    return { state, matched: false, transition: "none" };
  }
  const transition = event.interrupted ? "interrupted" : "completed";
  return {
    state: {
      ...state,
      closingFarewellPhase: event.interrupted ? "INTERRUPTED" : "COMPLETED",
    },
    matched: true,
    transition,
  };
}

export function closingProviderEndAllowed(
  state: InterviewTimeBoundaryState,
  remainingSeconds: number,
  options: { hardDeadline?: boolean } = {},
): boolean {
  if (state.providerEndRequested) return false;
  if (options.hardDeadline || remainingSeconds <= 0) return true;
  return state.closingFarewellPhase === "COMPLETED";
}

export function evaluateInterviewTimeBoundary(input: {
  state: InterviewTimeBoundaryState;
  remainingSeconds: number;
  candidateSpeaking: boolean;
  replicaSpeaking: boolean;
  replicaSpeechIsApplicationControlled?: boolean;
  closingAnnouncementObserved?: boolean;
}): InterviewTimeBoundaryEvaluation {
  const remaining = Number.isFinite(input.remainingSeconds)
    ? Math.max(0, input.remainingSeconds)
    : Number.POSITIVE_INFINITY;
  if (input.state.phase === "ENDED") return { state: input.state, actions: [] };
  let state = input.state;
  const actions: InterviewTimeBoundaryAction[] = [];
  if (remaining <= FINAL_CLOSING_THRESHOLD_SECONDS) {
    state = advanceInterviewClosingPhase(state, "FINAL_FAREWELL_ELIGIBLE");
    if (!state.closingInterruptRequested) {
      actions.push("interrupt_replica");
      state = { ...state, closingInterruptRequested: true };
    }
    const reservation = reserveClosingFarewell(state);
    state = reservation.state;
    if (reservation.reserved) {
      actions.push("record_closing_farewell_reserved");
    }
    if (state.closingFarewellPhase === "RESERVED") {
      actions.push("send_closing_farewell");
    }
  }

  if (
    closingProviderEndAllowed(state, remaining, { hardDeadline: remaining <= 0 }) &&
    !actions.includes("request_provider_end")
  ) {
    actions.push("request_provider_end");
  }

  return { state, actions };
}

export function timerToneForRemaining(seconds: number | null): TimerTone {
  if (typeof seconds !== "number") return "normal";
  if (seconds <= URGENT_WARNING_THRESHOLD_SECONDS) return "urgent";
  if (seconds <= TIME_WARNING_THRESHOLD_SECONDS) return "warning";
  return "normal";
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
      text: FINAL_CLOSING_UTTERANCE,
      done: true,
      inference_id: inferenceId,
    },
  };
}

export function buildReplicaInterruptMessage(conversationId: string) {
  return {
    message_type: "conversation",
    event_type: "conversation.interrupt",
    conversation_id: conversationId,
  };
}

export function markProviderEndRequested(
  state: InterviewTimeBoundaryState,
): { state: InterviewTimeBoundaryState; requested: boolean } {
  if (state.providerEndRequested) return { state, requested: false };
  return {
    state: {
      ...advanceInterviewClosingPhase(state, "ENDED"),
      providerEndRequested: true,
    },
    requested: true,
  };
}

export function markProviderEndConfirmed(
  state: InterviewTimeBoundaryState,
): InterviewTimeBoundaryState {
  if (!state.providerEndRequested || state.providerEndConfirmed) return state;
  return { ...state, providerEndConfirmed: true };
}

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
  if (!inferenceId && providerSequence === null && turnIndex === null) return null;
  const turnIdentity = inferenceId || `sequence:${providerSequence ?? turnIndex}`;
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
  };
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
  if (eligibility.phase === "FINAL_FAREWELL_ELIGIBLE") return "closing";
  if (eligibility.phase === "ENDED") return "termination";
  if (
    typeof eligibility.remainingSeconds === "number" &&
    eligibility.remainingSeconds <= FINAL_CLOSING_THRESHOLD_SECONDS
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

function extractTrack(slot?: DailyTrackSlot): MediaStreamTrack | null {
  if (!slot) return null;
  const state = String(slot.state || "").toLowerCase();
  if (state && state !== "playable" && state !== "sendable" && state !== "loading") return null;
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
  const prior = previous || {
    remotePresent: false,
    remoteAudioReady: false,
    remoteVideoReady: false,
    remoteParticipantCount: 0,
  };
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
  const timerRuntimeRef = useRef<InterviewTimerRuntimeState | null>(null);
  const finalTerminationTimerRef = useRef<number | null>(null);
  const directClosingSpeechRef = useRef<DirectClosingSpeech>(null);
  const startupRemoteSeenRef = useRef(false);
  const startupRecoveryAttemptedRef = useRef(false);
  const startupTimerRef = useRef<number | null>(null);
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
  const telemetrySequenceRef = useRef(0);
  const telemetryPendingRef = useRef<Set<Promise<unknown>>>(new Set());
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);

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

  const clearAutoEndTimers = useCallback(() => {
    if (finalTerminationTimerRef.current) {
      window.clearTimeout(finalTerminationTimerRef.current);
      finalTerminationTimerRef.current = null;
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

    const localVideoTrack = extractTrack(local?.tracks?.video);
    const remoteVideoTrack = remotes.map((remote) => extractTrack(remote?.tracks?.video)).find(Boolean) || null;
    const remoteAudioTrack = remotes.map((remote) => extractTrack(remote?.tracks?.audio)).find(Boolean) || null;
    const localAudioTrack = extractTrack(local?.tracks?.audio);

    setElementTrack(localVideoRef.current, localVideoTrack);
    setElementTrack(remoteVideoRef.current, remoteVideoTrack);
    setElementTrack(remoteAudioRef.current, remoteAudioTrack);

    const hasRemote = Boolean(remoteVideoTrack);
    setHasRemoteVideo(hasRemote);
    setHasLocalVideo(Boolean(localVideoTrack));
    inactivityCandidateMediaHealthyRef.current = Boolean(
      localAudioTrack && localAudioTrack.readyState !== "ended" && localAudioTrack.enabled,
    );
    if (hasRemote) {
      startupRemoteSeenRef.current = true;
      clearStartupTimer();
      setLoading(false);
      setError("");
    }
    const evidence = {
      remotePresent: remotes.length > 0,
      remoteAudioReady: remotes.some((remote) => isRemoteTrackReady(remote?.tracks?.audio)),
      remoteVideoReady: remotes.some((remote) => isRemoteTrackReady(remote?.tracks?.video)),
      remoteParticipantCount: Math.min(16, remotes.length),
    };
    inactivityRemoteEvidenceRef.current = evidence;
    return evidence;
  }, [clearStartupTimer]);

  const teardownCall = useCallback(async () => {
    clearStartupTimer();
    clearInactivityTimer();
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
    setElementTrack(remoteAudioRef.current, null);
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
    clearAutoEndTimers();
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

  const currentClosingRemainingSeconds = useCallback((): number => {
    const runtime = timerRuntimeRef.current;
    const fromDeadline = remainingSecondsAtDeadline(runtime?.deadlineAt ?? null, monotonicNow());
    if (typeof fromDeadline === "number") return fromDeadline;
    return typeof secondsRemainingRef.current === "number" ? secondsRemainingRef.current : 0;
  }, []);

  const requestClosingProviderEnd = useCallback(async (
    reason: string,
    options: { hardDeadline?: boolean } = {},
  ) => {
    cancelInactivityRuntime("provider_end", true);
    const current = timerRuntimeRef.current?.boundaryState || createInterviewTimeBoundaryState();
    const remaining = currentClosingRemainingSeconds();
    if (!closingProviderEndAllowed(current, remaining, options)) return false;
    const marked = markProviderEndRequested(current);
    if (!marked.requested) return false;
    persistBoundaryState(marked.state);
    sendLifecycleTelemetry("provider_end_requested", {
      closing_state: marked.state.phase,
      remaining_time_bucket: remainingTimeBucket(remaining),
      turn_index: marked.state.turnIndex,
      hard_deadline: options.hardDeadline === true,
    });
    const confirmed = await endInterview(reason);
    if (confirmed) {
      const latest = timerRuntimeRef.current?.boundaryState || marked.state;
      const confirmedState = markProviderEndConfirmed(latest);
      persistBoundaryState(confirmedState);
      sendLifecycleTelemetry("provider_end_confirmed", {
        closing_state: confirmedState.phase,
        remaining_time_bucket: remainingTimeBucket(currentClosingRemainingSeconds()),
        turn_index: confirmedState.turnIndex,
        hard_deadline: options.hardDeadline === true,
      }, { terminal: true });
    }
    return confirmed;
  }, [
    cancelInactivityRuntime,
    currentClosingRemainingSeconds,
    endInterview,
    persistBoundaryState,
    sendLifecycleTelemetry,
  ]);

  const scheduleZeroDeadlineFallback = useCallback(() => {
    if (finalTerminationTimerRef.current || endTriggeredRef.current) return;
    const deadlineAt = timerRuntimeRef.current?.deadlineAt;
    if (typeof deadlineAt !== "number") return;
    const delayMs = Math.max(0, deadlineAt - monotonicNow());
    finalTerminationTimerRef.current = window.setTimeout(() => {
      finalTerminationTimerRef.current = null;
      void requestClosingProviderEnd("time_limit_hard_deadline", { hardDeadline: true });
    }, delayMs);
  }, [requestClosingProviderEnd]);

  const sendFinalClosingAnnouncement = useCallback((inferenceId: string): boolean => {
    const conversationId = String(session?.conversation_id || "").trim();
    const call = callRef.current;
    if (!conversationId || !call?.sendAppMessage) return false;
    try {
      directClosingSpeechRef.current = {
        kind: "farewell",
        inferenceId,
      };
      call.sendAppMessage(
        buildFinalClosingAnnouncementMessage(conversationId, inferenceId),
        "*",
      );
      return true;
    } catch {
      directClosingSpeechRef.current = null;
      return false;
    }
  }, [session?.conversation_id]);

  const interruptReplica = useCallback((): boolean => {
    const conversationId = String(session?.conversation_id || "").trim();
    const call = callRef.current;
    if (!conversationId || !call?.sendAppMessage) return false;
    try {
      call.sendAppMessage(buildReplicaInterruptMessage(conversationId), "*");
      return true;
    } catch {
      return false;
    }
  }, [session?.conversation_id]);

  const applyClosingActions = useCallback((
    actions: InterviewTimeBoundaryAction[],
    _previousState: InterviewTimeBoundaryState,
    evaluatedState: InterviewTimeBoundaryState,
    _remaining: number,
  ) => {
    let nextState = evaluatedState;
    for (const action of actions) {
      if (action === "interrupt_replica") {
        sendLifecycleTelemetry("closing_forced_interrupt", {
          closing_state: nextState.phase,
          remaining_time_bucket: remainingTimeBucket(currentClosingRemainingSeconds()),
          turn_index: nextState.turnIndex,
          speech_interrupted: interruptReplica(),
        });
      }
      if (action === "record_closing_farewell_reserved") {
        sendLifecycleTelemetry("closing_farewell_reserved", {
          closing_state: nextState.phase,
          remaining_time_bucket: remainingTimeBucket(currentClosingRemainingSeconds()),
          turn_index: nextState.turnIndex,
        });
      }
      if (action === "send_closing_farewell") {
        if (nextState.closingFarewellPhase !== "RESERVED") {
          continue;
        }
        if (!sendFinalClosingAnnouncement(nextState.farewellInferenceId)) {
          nextState = markClosingFarewellDispatchFailed(nextState);
          sendLifecycleTelemetry("closing_farewell_interrupted", {
            closing_state: nextState.phase,
            remaining_time_bucket: remainingTimeBucket(currentClosingRemainingSeconds()),
            turn_index: nextState.turnIndex,
            speech_interrupted: true,
          });
          continue;
        }
        nextState = markClosingFarewellDispatched(nextState);
        sendLifecycleTelemetry("closing_farewell_started", {
          closing_state: nextState.phase,
          remaining_time_bucket: remainingTimeBucket(currentClosingRemainingSeconds()),
          turn_index: nextState.turnIndex,
        });
      }
      if (action === "request_provider_end") {
        const currentRemaining = currentClosingRemainingSeconds();
        void requestClosingProviderEnd(
          currentRemaining <= 0 ? "time_limit_hard_deadline" : "farewell_completed",
          { hardDeadline: currentRemaining <= 0 },
        );
      }
    }
    persistBoundaryState(nextState);
  }, [
    interruptReplica,
    currentClosingRemainingSeconds,
    persistBoundaryState,
    requestClosingProviderEnd,
    sendFinalClosingAnnouncement,
    sendLifecycleTelemetry,
  ]);

  const processTimeBoundary = useCallback((remaining: number) => {
    if (endTriggeredRef.current) return;
    const runtime = timerRuntimeRef.current;
    const previousState = runtime?.boundaryState || createInterviewTimeBoundaryState();
    const evaluation = evaluateInterviewTimeBoundary({
      state: previousState,
      remainingSeconds: remaining,
      candidateSpeaking: candidateSpeakingStateRef.current.active,
      replicaSpeaking: replicaSpeakingRef.current,
      replicaSpeechIsApplicationControlled:
        Boolean(directClosingSpeechRef.current) ||
        previousState.closingFarewellPhase === "DISPATCHED" ||
        previousState.closingFarewellPhase === "SPEAKING",
      closingAnnouncementObserved: false,
    });
    if (previousState.phase === "INTERVIEWING" && evaluation.state.phase !== "INTERVIEWING") {
      cancelInactivityRuntime("closing");
    }
    if (!evaluation.actions.length) return;

    applyClosingActions(evaluation.actions, previousState, evaluation.state, remaining);
  }, [applyClosingActions, cancelInactivityRuntime]);

  useEffect(() => () => clearAutoEndTimers(), [clearAutoEndTimers]);

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

    const beginStartupWatchdog = () => {
      clearStartupTimer();
      startupTimerRef.current = window.setTimeout(async () => {
        if (!alive || startupRemoteSeenRef.current || !call) return;
        if (!startupRecoveryAttemptedRef.current) {
          startupRecoveryAttemptedRef.current = true;
          reconnectingRef.current = true;
          cancelInactivityRuntime("reconnect");
          try {
            await call.leave().catch(() => {});
            if (!alive || endTriggeredRef.current) return;
            await call.join({
              url: session.conversation_url,
              userName: "Candidate",
              startAudioOff: false,
              startVideoOff: false,
            });
            if (!alive || endTriggeredRef.current) return;
            beginStartupWatchdog();
            return;
          } catch {
          } finally {
            reconnectingRef.current = false;
          }
        }
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

    const remoteStateMetadata = (): ReliabilityMetadata => {
      const evidence = previousRemoteEvidence || {
        remotePresent: false,
        remoteAudioReady: false,
        remoteVideoReady: false,
        remoteParticipantCount: 0,
      };
      return {
        participant_count: evidence.remoteParticipantCount,
        remote_participant_present: evidence.remotePresent,
        remote_audio_state: remoteMediaState(evidence.remoteAudioReady, evidence.remotePresent),
        remote_video_state: remoteMediaState(evidence.remoteVideoReady, evidence.remotePresent),
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

    const syncParticipantsWithDiagnostics = (participants?: Record<string, DailyParticipant>) => {
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
        previousRemoteEvidence = {
          remotePresent: false,
          remoteAudioReady: false,
          remoteVideoReady: false,
          remoteParticipantCount: 0,
        };
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
        try {
          await recoveryCall.leave().catch(() => {});
          if (!alive || endTriggeredRef.current) return;
          await recoveryCall.join({
            url: session.conversation_url,
            userName: "Candidate",
            startAudioOff: false,
            startVideoOff: false,
          });
          if (!alive || endTriggeredRef.current) return;
          recordReconnectLocalJoin(Date.now());
          syncParticipantsWithDiagnostics();
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
        startupRemoteSeenRef.current = false;
        startupRecoveryAttemptedRef.current = false;
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
          setLoading(false);
          inactivityTransportHealthyRef.current = true;
          if (progressRecoveryStateRef.current.phase === "reconnecting_transport") {
            recordReconnectLocalJoin(Date.now());
          }
          sendLifecycleTelemetry("daily_participant_joined", {
            participant_role: "candidate",
            meeting_state: "joined",
            ...recoveryMetadata(),
          });
          syncParticipantsWithDiagnostics();
          void requestRecordingStart();
        });
        const syncParticipantEvent = (event?: DailyEvent) => {
          if (!alive || endTriggeredRef.current) return;
          syncParticipantsWithDiagnostics(event?.participants);
        };
        register("participant-joined", syncParticipantEvent);
        register("participant-updated", syncParticipantEvent);
        register("participant-left", syncParticipantEvent);
        register("track-started", syncParticipantEvent);
        register("track-stopped", syncParticipantEvent);
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
          const normalizedPalSpeaking = normalizePalSpeakingEvent(
            data,
            String(session.conversation_id || "").trim(),
          );
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
          const explicitInferenceId = String(
            data?.properties?.inference_id ?? data?.inference_id ?? "",
          ).trim();
          const inferenceKey = explicitInferenceId ||
            `replica-turn-${timerRuntimeRef.current?.boundaryState.turnIndex || 0}`;
          const activeConversationId = String(session.conversation_id || "").trim();
          const currentInferenceState = timerRuntimeRef.current?.boundaryState;
          const directSpeechKind = inferenceKey === currentInferenceState?.farewellInferenceId
            ? "farewell"
            : directClosingSpeechRef.current?.inferenceId === inferenceKey
              ? directClosingSpeechRef.current.kind
              : !explicitInferenceId &&
                  normalizedPalSpeaking?.conversationId === activeConversationId &&
                  directClosingSpeechRef.current
                ? directClosingSpeechRef.current.kind
                : null;

          if (isCandidateSpeaking) recordInactivityCandidateActivity("candidate_speaking");
          if (normalizedPalSpeaking?.kind === "started") {
            cancelInactivityRuntime("pal_speaking");
          }

          const recoveryWasActive = isReconnectRecoveryActive(progressRecoveryStateRef.current);
          if (recoveryWasActive) {
            syncParticipantsWithDiagnostics();
          }
          const progressAt = Date.now();
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
            if (normalizedPalSpeaking) {
              const currentClosing = timerRuntimeRef.current?.boundaryState
                || createInterviewTimeBoundaryState();
              const farewell = recordClosingFarewellSpeechEvent(
                currentClosing,
                normalizedPalSpeaking,
                activeConversationId,
                directClosingSpeechRef.current?.kind === "farewell"
                  ? currentClosing.farewellInferenceId
                  : "",
              );
              if (farewell.transition === "speaking") {
                persistBoundaryState(farewell.state);
              }
            }
            recoveryCompleted = completeProgressRecovery("replica_started_speaking", progressAt);
            if (!recoveryWasActive) recordProgressCheckpoint("replica_started_speaking", progressAt);
          }
          if (isReplicaStoppedSpeaking) {
            replicaSpeakingRef.current = false;
            lastAiSpeechStoppedAtRef.current = progressAt;
            const stoppedDirectSpeech = directSpeechKind;
            if (normalizedPalSpeaking) {
              const currentClosing = timerRuntimeRef.current?.boundaryState
                || createInterviewTimeBoundaryState();
              const farewell = recordClosingFarewellSpeechEvent(
                currentClosing,
                normalizedPalSpeaking,
                activeConversationId,
                directClosingSpeechRef.current?.kind === "farewell"
                  ? currentClosing.farewellInferenceId
                  : "",
              );
              if (farewell.transition === "completed" || farewell.transition === "interrupted") {
                directClosingSpeechRef.current = null;
                persistBoundaryState(farewell.state);
                sendLifecycleTelemetry(
                  farewell.transition === "completed"
                    ? "closing_farewell_completed"
                    : "closing_farewell_interrupted",
                  {
                    closing_state: farewell.state.phase,
                    remaining_time_bucket: remainingTimeBucket(currentClosingRemainingSeconds()),
                    turn_index: farewell.state.turnIndex,
                    ...(farewell.transition === "interrupted"
                      ? { speech_interrupted: true }
                      : {}),
                  },
                );
                if (
                  farewell.transition === "completed" &&
                  closingProviderEndAllowed(
                    farewell.state,
                    currentClosingRemainingSeconds(),
                  )
                ) {
                  void requestClosingProviderEnd("farewell_completed", { hardDeadline: false });
                }
              }
            }
            if (stoppedDirectSpeech && directClosingSpeechRef.current) {
              directClosingSpeechRef.current = null;
            }
            if (normalizedPalSpeaking) {
              armInactivityRuntime({
                ...normalizedPalSpeaking,
                applicationControl:
                  normalizedPalSpeaking.applicationControl || Boolean(stoppedDirectSpeech),
              });
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
          if (isCandidateStoppedSpeaking || isCandidateUtterance || isReplicaStoppedSpeaking) {
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
            if (toolName === "end_interview") {
              const closingState = timerRuntimeRef.current?.boundaryState;
              if (closingState && closingState.phase !== "INTERVIEWING") {
                const remaining = currentClosingRemainingSeconds();
                if (remaining <= 0) {
                  void requestClosingProviderEnd("time_limit_hard_deadline", { hardDeadline: true });
                }
              } else {
                void endInterview("tool_call");
              }
              return;
            }
          }
          const payloadText = JSON.stringify(data || {}).toLowerCase();
          if (/call_ended|call-ended|meeting-ended|meeting_ended|room_left|room-left|session_ended|session-ended|conversation_ended|conversation-ended|interview_ended|interview-ended/.test(payloadText)) {
            const closingState = timerRuntimeRef.current?.boundaryState;
            if (closingState && closingState.phase !== "INTERVIEWING") {
              if (!endTriggeredRef.current) {
                endTriggeredRef.current = true;
                clearAutoEndTimers();
                cancelInactivityRuntime("provider_end", true);
                void leaveLiveRoute();
              }
            } else {
              void endInterview("vendor_end_event");
            }
          }
        });

        await applySelectedDevices();
        beginStartupWatchdog();
        await call.join({
          url: session.conversation_url,
          userName: "Candidate",
          startAudioOff: false,
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
    applyClosingActions,
    cancelInactivityRuntime,
    clearAutoEndTimers,
    clearStartupTimer,
    currentClosingRemainingSeconds,
    endInterview,
    interruptReplica,
    leaveLiveRoute,
    persistBoundaryState,
    processTimeBoundary,
    recordInactivityCandidateActivity,
    requestClosingProviderEnd,
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
    scheduleZeroDeadlineFallback();
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
    scheduleZeroDeadlineFallback,
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
      <header
        className="bg-white flex-shrink-0 flex items-center px-6 h-14"
        style={{ borderBottom: "1px solid rgba(10,21,71,0.07)" }}
      >
        <img src={alphaSourceLogo} alt="alphaSource AI" className="h-8 w-auto" />
      </header>

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
