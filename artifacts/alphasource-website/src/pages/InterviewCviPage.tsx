import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";

type LiveSessionState = {
  conversation_url: string;
  conversation_id: string;
  interview_id: string;
  role_token: string;
  max_interview_minutes: number | null;
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

declare global {
  interface Window {
    DailyIframe?: DailySdk;
  }
}

const DAILY_SCRIPT_ID = "alphasource-daily-sdk";
const DAILY_SCRIPT_SRC = "https://unpkg.com/@daily-co/daily-js";
const LIVE_STATE_KEY = "alphasource_interview_live_state";
const STARTUP_REMOTE_TIMEOUT_MS = 12000;
const SOFT_CLOSE_TEXT = "We are approaching our time limit for this interview. Thank you for your time today. Our session will end momentarily.";
const SOFT_CLOSE_THRESHOLD_SECONDS = 10;
const SOFT_CLOSE_END_DELAY_MS = 7000;
const CLOSING_UTTERANCE_END_DELAY_MS = 5500;

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

export default function InterviewCviPage() {
  const [, setLocation] = useLocation();
  const [session] = useState<LiveSessionState | null>(() => readLiveState());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [finishBusy, setFinishBusy] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState<number | null>(null);
  const [hasRemoteVideo, setHasRemoteVideo] = useState(false);
  const [hasLocalVideo, setHasLocalVideo] = useState(false);

  const callRef = useRef<DailyCallObject | null>(null);
  const leavingRef = useRef(false);
  const endTriggeredRef = useRef(false);
  const softCloseSentRef = useRef(false);
  const softCloseEndTimerRef = useRef<number | null>(null);
  const closeEndTimerRef = useRef<number | null>(null);
  const startupRemoteSeenRef = useRef(false);
  const startupRecoveryAttemptedRef = useRef(false);
  const startupTimerRef = useRef<number | null>(null);
  const startMsRef = useRef<number>(Date.now());
  const recordingStartRequestedRef = useRef(false);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);

  const clearStartupTimer = useCallback(() => {
    if (startupTimerRef.current) {
      window.clearTimeout(startupTimerRef.current);
      startupTimerRef.current = null;
    }
  }, []);

  const clearAutoEndTimers = useCallback(() => {
    if (softCloseEndTimerRef.current) {
      window.clearTimeout(softCloseEndTimerRef.current);
      softCloseEndTimerRef.current = null;
    }
    if (closeEndTimerRef.current) {
      window.clearTimeout(closeEndTimerRef.current);
      closeEndTimerRef.current = null;
    }
  }, []);

  const syncParticipants = useCallback((participants?: Record<string, DailyParticipant>) => {
    const map = participants || callRef.current?.participants?.() || {};
    const list = Object.values(map);
    const local = list.find((p) => Boolean(p?.local));
    const remote = list.find((p) => !p?.local);

    const localVideoTrack = extractTrack(local?.tracks?.video);
    const remoteVideoTrack = extractTrack(remote?.tracks?.video);
    const remoteAudioTrack = extractTrack(remote?.tracks?.audio);

    setElementTrack(localVideoRef.current, localVideoTrack);
    setElementTrack(remoteVideoRef.current, remoteVideoTrack);
    setElementTrack(remoteAudioRef.current, remoteAudioTrack);

    const hasRemote = Boolean(remoteVideoTrack);
    setHasRemoteVideo(hasRemote);
    setHasLocalVideo(Boolean(localVideoTrack));
    if (hasRemote) {
      startupRemoteSeenRef.current = true;
      clearStartupTimer();
      setLoading(false);
      setError("");
    }
  }, [clearStartupTimer]);

  const teardownCall = useCallback(async () => {
    clearStartupTimer();
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
  }, [clearStartupTimer]);

  const leaveLiveRoute = useCallback(async () => {
    if (leavingRef.current) return;
    leavingRef.current = true;
    await teardownCall();
    try {
      window.sessionStorage.removeItem(LIVE_STATE_KEY);
    } catch {}
    setLocation("/interview/complete");
  }, [setLocation, teardownCall]);

  const endInterview = useCallback(async (reason: string) => {
    if (endTriggeredRef.current) {
      setFinishBusy(false);
      return;
    }
    endTriggeredRef.current = true;
    clearAutoEndTimers();
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
          }),
        });
        if (!response.ok) {
          console.warn("[InterviewCviPage] End interview request failed.", { reason, status: response.status });
        }
      }
    } catch (error) {
      console.warn("[InterviewCviPage] Could not end interview cleanly. Closing this session now.", { reason, error });
      setError("Could not end interview cleanly. Closing this session now.");
    } finally {
      setFinishBusy(false);
      await leaveLiveRoute();
    }
  }, [clearAutoEndTimers, leaveLiveRoute, session]);

  const sendSoftClose = useCallback(() => {
    if (softCloseSentRef.current || endTriggeredRef.current) return;
    softCloseSentRef.current = true;
    try {
      callRef.current?.sendAppMessage?.({
        event_type: "conversation.echo",
        eventType: "conversation.echo",
        properties: { text: SOFT_CLOSE_TEXT },
      }, "*");
    } catch {}
    softCloseEndTimerRef.current = window.setTimeout(() => {
      softCloseEndTimerRef.current = null;
      void endInterview("time_limit_soft_close");
    }, SOFT_CLOSE_END_DELAY_MS);
  }, [endInterview]);

  useEffect(() => () => clearAutoEndTimers(), [clearAutoEndTimers]);

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
          try {
            await call.leave().catch(() => {});
          } catch {}
          if (!alive) return;
          try {
            await call.join({
              url: session.conversation_url,
              userName: "Candidate",
              startAudioOff: false,
              startVideoOff: false,
            });
            beginStartupWatchdog();
            return;
          } catch {}
        }
        setLoading(false);
        setError("Interview did not start correctly. Please relaunch and try again.");
      }, STARTUP_REMOTE_TIMEOUT_MS);
    };

    (async () => {
      try {
        setLoading(true);
        setError("");
        startupRemoteSeenRef.current = false;
        startupRecoveryAttemptedRef.current = false;
        recordingStartRequestedRef.current = false;

        const daily = await loadDailySdk();
        if (!alive) return;

        call = daily.createCallObject();
        callRef.current = call;

        register("joined-meeting", () => {
          if (!alive) return;
          setLoading(false);
          syncParticipants();
          void requestRecordingStart();
        });
        register("participant-joined", (event) => syncParticipants(event?.participants));
        register("participant-updated", (event) => syncParticipants(event?.participants));
        register("participant-left", (event) => syncParticipants(event?.participants));
        register("left-meeting", () => {
          if (!alive || leavingRef.current) return;
          void leaveLiveRoute();
        });
        register("error", () => {
          if (!alive) return;
          setError("Interview encountered an issue. Please finish and relaunch.");
        });
        register("camera-error", () => {
          if (!alive) return;
          setError("Camera or microphone access failed. Please allow permissions and relaunch.");
        });
        register("app-message", (event) => {
          const data = event?.data ?? event ?? {};
          const eventType = String(data?.event_type || data?.eventType || "").toLowerCase();
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
              void endInterview("tool_call");
              return;
            }
          }
          const utteranceRole = String(data?.properties?.role || data?.role || "").toLowerCase();
          const speech = String(data?.properties?.speech || data?.properties?.text || data?.speech || data?.text || "").toLowerCase();
          const isReplicaUtterance =
            eventType === "conversation.utterance" &&
            (utteranceRole === "replica" || utteranceRole === "assistant" || utteranceRole === "agent");
          if (
            isReplicaUtterance &&
            (
              speech.includes("concludes the interview") ||
              speech.includes("ending the session") ||
              speech.includes("end the session") ||
              speech.includes("ending the interview") ||
              speech.includes("end the interview")
            ) &&
            !closeEndTimerRef.current
          ) {
            closeEndTimerRef.current = window.setTimeout(() => {
              closeEndTimerRef.current = null;
              void endInterview("closing_utterance");
            }, CLOSING_UTTERANCE_END_DELAY_MS);
            return;
          }
          const payloadText = JSON.stringify(data || {}).toLowerCase();
          if (/call_ended|call-ended|meeting-ended|meeting_ended|room_left|room-left|session_ended|session-ended|conversation_ended|conversation-ended|interview_ended|interview-ended/.test(payloadText)) {
            void endInterview("ended_payload");
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
        syncParticipants();
      } catch {
        if (!alive) return;
        setLoading(false);
        setError("Interview did not start correctly. Please relaunch and try again.");
      }
    })();

    return () => {
      alive = false;
      clearStartupTimer();
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
  }, [clearStartupTimer, endInterview, leaveLiveRoute, session, syncParticipants, teardownCall]);

  useEffect(() => {
    const maxMinutes = session?.max_interview_minutes;
    if (!maxMinutes || maxMinutes <= 0) {
      setSecondsRemaining(null);
      return;
    }

    startMsRef.current = Date.now();
    let timer: number | null = null;
    const tick = () => {
      const elapsed = Math.floor((Date.now() - startMsRef.current) / 1000);
      const remaining = Math.max(maxMinutes * 60 - elapsed, 0);
      setSecondsRemaining(remaining);
      if (remaining > 0 && remaining <= SOFT_CLOSE_THRESHOLD_SECONDS) {
        sendSoftClose();
      }
      if (remaining <= 0) {
        if (timer) {
          window.clearInterval(timer);
          timer = null;
        }
        void endInterview("time_limit");
      }
    };

    tick();
    timer = window.setInterval(tick, 1000);
    return () => {
      if (timer) window.clearInterval(timer);
    };
  }, [endInterview, sendSoftClose, session?.max_interview_minutes]);

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

  const timerLabel = useMemo(() => formatCountdown(secondsRemaining), [secondsRemaining]);
  const timerToneClass = useMemo(() => {
    if (typeof secondsRemaining !== "number") return "bg-black/60 border-white/20 text-white";
    if (secondsRemaining <= 60) return "bg-[#EF4444]/90 border-[#DC2626] text-white";
    if (secondsRemaining <= 120) return "bg-[#FBBF24]/90 border-[#F59E0B] text-[#3A2600]";
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
        <img src="/logo-dark-text.png" alt="AlphaSource AI" className="h-8 w-auto" />
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
          </div>

          <div className="mt-3 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setHelpOpen(true)}
              className="px-4 py-2 rounded-full text-xs sm:text-sm font-bold transition-colors border border-[rgba(10,21,71,0.14)] text-[#0A1547] hover:bg-white"
            >
              Need help?
            </button>
            <button
              type="button"
              onClick={finishInterview}
              disabled={finishBusy}
              className="flex items-center gap-2.5 px-6 py-2.5 rounded-full text-sm font-bold text-white transition-all hover:opacity-90 active:scale-[0.97]"
              style={{ backgroundColor: "#A380F6" }}
            >
              {finishBusy ? "Finishing..." : "Finish Interview"}
            </button>
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
