import { useEffect, useState, useRef } from "react";
import { useLocation } from "wouter";
import { Upload, FileText, Trash2, Check, ArrowRight, ChevronRight } from "lucide-react";

/* ── Checklist copy (verbatim) ───────────────────────────────────── */
const CHECKLIST = [
  "Current resume in PDF, DOC, or DOCX format",
  "Stable internet connection",
  "3 uninterrupted minutes to complete the interview",
  "Quiet environment free of background conversations and distractions",
  "You may complete only one interview per role. Once submitted, the interview cannot be retaken.",
];

type Step = "info" | "otp" | "ready" | "live";

/* ── Step progress bar ───────────────────────────────────────────── */
const STEPS = [
  { id: "info",  label: "Your Info" },
  { id: "otp",  label: "Verify"    },
  { id: "ready", label: "Start"    },
];

function StepIndicator({ current }: { current: Step }) {
  const idx = STEPS.findIndex((s) => s.id === current);
  const active = idx === -1 ? 2 : idx; // "ready" is index 2

  return (
    <div className="flex items-center justify-center gap-0 mb-8">
      {STEPS.map((s, i) => {
        const done    = i < active;
        const current = i === active;
        return (
          <div key={s.id} className="flex items-center">
            <div className="flex flex-col items-center gap-1.5">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-black transition-all duration-300"
                style={{
                  backgroundColor: done || current ? "#A380F6" : "transparent",
                  border: done || current ? "none" : "2px solid #D1D5DB",
                  color: done || current ? "#fff" : "#9CA3AF",
                }}
              >
                {done ? <Check className="w-3.5 h-3.5" /> : i + 1}
              </div>
              <span
                className="text-[10px] font-bold tracking-wide whitespace-nowrap"
                style={{ color: current ? "#A380F6" : done ? "#0A1547" : "#9CA3AF" }}
              >
                {s.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className="w-16 h-[2px] mx-1 mb-5 rounded-full transition-all duration-300"
                style={{ backgroundColor: done ? "#A380F6" : "#E5E7EB" }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ── Shared card wrapper ─────────────────────────────────────────── */
function Card({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="bg-white rounded-2xl p-8 w-full max-w-md"
      style={{
        border: "1px solid rgba(10,21,71,0.07)",
        boxShadow: "0 4px 24px rgba(10,21,71,0.08)",
      }}
    >
      {children}
    </div>
  );
}

/* ── Shared input style ──────────────────────────────────────────── */
const inputCls =
  "w-full px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-[#0A1547] text-sm " +
  "placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#A380F6]/20 " +
  "focus:border-[#A380F6] transition-all";

const errorCls = "text-red-500 text-[10px] mt-1 font-semibold";
const isValidPhone = (value: string) => /^(\d{10}|\(\d{3}\)\s?\d{3}-\d{4}|\d{3}-\d{3}-\d{4}|\d{3}\.\d{3}\.\d{4})$/.test(String(value || "").trim());
const isValidResumeFile = (file: File | null | undefined) =>
  Boolean(file && /\.(pdf|doc|docx)$/i.test(String(file.name || "")));
type DevicePreferences = {
  selectedCameraDeviceId?: string;
  selectedMicrophoneDeviceId?: string;
};
type NetworkCheck = {
  checking: boolean;
  bars: number;
  latencyMs: number | null;
};
const networkStatusText = ["Connection unavailable", "Weak connection", "Fair connection", "Good connection", "Strong connection"];

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

function readRoleToken(): string {
  if (typeof window === "undefined") return "";
  try {
    const path = String(window.location.pathname || "");
    const pathMatch = path.match(/^\/interview\/([^/?#]+)/);
    if (pathMatch?.[1]) return decodeURIComponent(pathMatch[1]).trim();

    const url = new URL(window.location.href);
    return (
      String(url.searchParams.get("role_token") || "").trim() ||
      String(url.searchParams.get("role") || "").trim() ||
      String(url.searchParams.get("token") || "").trim()
    );
  } catch {
    return "";
  }
}

export default function InterviewPage() {
  const [, setLocation] = useLocation();

  /* ── Terms modal ─────────────────────────────────────────────── */
  const [termsOpen, setTermsOpen]     = useState(true);
  const [understood, setUnderstood]   = useState(false);

  /* ── Workflow step ───────────────────────────────────────────── */
  const [step, setStep] = useState<Step>("info");

  /* ── Step 1 fields ───────────────────────────────────────────── */
  const [firstName, setFirstName]     = useState("");
  const [lastName, setLastName]       = useState("");
  const [email, setEmail]             = useState("");
  const [phone, setPhone]             = useState("");
  const [resumeFile, setResumeFile]   = useState<File | null>(null);
  const [dragging, setDragging]       = useState(false);
  const [errors, setErrors]           = useState<Record<string, string>>({});
  const fileRef                       = useRef<HTMLInputElement>(null);

  /* ── Step 2 fields ───────────────────────────────────────────── */
  const [otp, setOtp]         = useState("");
  const [otpError, setOtpError] = useState("");
  const [resendLoading, setResendLoading] = useState(false);
  const [resendMessage, setResendMessage] = useState("");
  const [resendError, setResendError] = useState("");
  const [submitLoading, setSubmitLoading] = useState(false);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [startLoading, setStartLoading] = useState(false);
  const [startError, setStartError] = useState("");
  const [interviewAuth, setInterviewAuth] = useState({
    candidate_id: "",
    role_id: "",
    email: "",
    role_token: readRoleToken(),
  });
  const [interviewStartState, setInterviewStartState] = useState<{
    interview_id: string;
    conversation_id: string;
    conversation_url: string;
    max_interview_minutes: number | null;
  }>({
    interview_id: "",
    conversation_id: "",
    conversation_url: "",
    max_interview_minutes: null,
  });
  const [preStartMaxInterviewMinutes, setPreStartMaxInterviewMinutes] = useState<number | null>(null);
  const [deviceModalOpen, setDeviceModalOpen] = useState(false);
  const [deviceLoading, setDeviceLoading] = useState(false);
  const [deviceError, setDeviceError] = useState("");
  const [cameraDevices, setCameraDevices] = useState<MediaDeviceInfo[]>([]);
  const [microphoneDevices, setMicrophoneDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedCameraDeviceId, setSelectedCameraDeviceId] = useState("");
  const [selectedMicrophoneDeviceId, setSelectedMicrophoneDeviceId] = useState("");
  const [savedDevicePreferences, setSavedDevicePreferences] = useState<DevicePreferences>({});
  const [micLevel, setMicLevel] = useState(0);
  const [networkOnline, setNetworkOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine));
  const [networkCheck, setNetworkCheck] = useState<NetworkCheck>({ checking: false, bars: 0, latencyMs: null });
  const [speakerTesting, setSpeakerTesting] = useState(false);
  const previewVideoRef = useRef<HTMLVideoElement>(null);
  const previewStreamRef = useRef<MediaStream | null>(null);
  const micAnimationRef = useRef<number | null>(null);
  const micAudioContextRef = useRef<AudioContext | null>(null);
  const networkCheckAbortRef = useRef<AbortController | null>(null);

  /* ── Helpers ─────────────────────────────────────────────────── */
  function handleFile(file: File) {
    if (!isValidResumeFile(file)) {
      if (fileRef.current) fileRef.current.value = "";
      setErrors((e) => ({
        ...e,
        resume: "Resume must be a PDF, DOC, or DOCX file.",
      }));
      return;
    }
    setResumeFile(file);
    setErrors((e) => ({ ...e, resume: "", submit: "" }));
  }

  function validateStep1() {
    const e: Record<string, string> = {};
    if (!firstName.trim()) e.firstName = "Required";
    if (!lastName.trim())  e.lastName  = "Required";
    if (!email.trim() || !/\S+@\S+\.\S+/.test(email)) e.email = "A valid email is required";
    if (!isValidPhone(phone)) e.phone = "Enter a valid phone number: XXXXXXXXXX, (XXX) XXX-XXXX, XXX-XXX-XXXX, or XXX.XXX.XXXX.";
    if (!resumeFile)       e.resume    = "Please upload your resume";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function stopDevicePreview() {
    if (micAnimationRef.current !== null) {
      window.cancelAnimationFrame(micAnimationRef.current);
      micAnimationRef.current = null;
    }
    if (micAudioContextRef.current) {
      void micAudioContextRef.current.close().catch(() => {});
      micAudioContextRef.current = null;
    }
    if (previewStreamRef.current) {
      previewStreamRef.current.getTracks().forEach((track) => track.stop());
      previewStreamRef.current = null;
    }
    if (previewVideoRef.current) {
      previewVideoRef.current.srcObject = null;
    }
    setMicLevel(0);
  }

  async function loadDeviceOptions() {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    const devices = await navigator.mediaDevices.enumerateDevices();
    setCameraDevices(devices.filter((device) => device.kind === "videoinput"));
    setMicrophoneDevices(devices.filter((device) => device.kind === "audioinput"));
  }

  async function startDevicePreview() {
    if (!navigator.mediaDevices?.getUserMedia) {
      setDeviceError("Camera and microphone checks are not supported in this browser.");
      return;
    }

    setDeviceLoading(true);
    setDeviceError("");
    stopDevicePreview();
    try {
      const constraints: MediaStreamConstraints = {
        video: selectedCameraDeviceId ? { deviceId: { exact: selectedCameraDeviceId } } : true,
        audio: selectedMicrophoneDeviceId ? { deviceId: { exact: selectedMicrophoneDeviceId } } : true,
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      previewStreamRef.current = stream;
      if (previewVideoRef.current) {
        previewVideoRef.current.srcObject = stream;
        void previewVideoRef.current.play().catch(() => {});
      }

      await loadDeviceOptions();
      const cameraId = stream.getVideoTracks()[0]?.getSettings?.().deviceId || "";
      const microphoneId = stream.getAudioTracks()[0]?.getSettings?.().deviceId || "";
      if (!selectedCameraDeviceId && cameraId) setSelectedCameraDeviceId(cameraId);
      if (!selectedMicrophoneDeviceId && microphoneId) setSelectedMicrophoneDeviceId(microphoneId);

      const audioTrack = stream.getAudioTracks()[0];
      const AudioCtor =
        window.AudioContext ||
        (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (audioTrack && AudioCtor) {
        const audioContext = new AudioCtor();
        micAudioContextRef.current = audioContext;
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        const source = audioContext.createMediaStreamSource(new MediaStream([audioTrack]));
        source.connect(analyser);
        const data = new Uint8Array(analyser.fftSize);
        const tick = () => {
          analyser.getByteTimeDomainData(data);
          let sum = 0;
          for (const value of data) {
            const diff = (value - 128) / 128;
            sum += diff * diff;
          }
          setMicLevel(Math.min(100, Math.round(Math.sqrt(sum / data.length) * 140)));
          micAnimationRef.current = window.requestAnimationFrame(tick);
        };
        tick();
      }
    } catch {
      setDeviceError("Could not access your camera or microphone. You can allow permissions, try again, or skip and use browser defaults.");
    } finally {
      setDeviceLoading(false);
    }
  }

  function handleSkipDeviceCheck() {
    setSavedDevicePreferences({});
    setSelectedCameraDeviceId("");
    setSelectedMicrophoneDeviceId("");
    setDeviceError("");
    stopDevicePreview();
    setDeviceModalOpen(false);
  }

  function handleProceedDeviceCheck() {
    setSavedDevicePreferences({
      selectedCameraDeviceId: selectedCameraDeviceId || undefined,
      selectedMicrophoneDeviceId: selectedMicrophoneDeviceId || undefined,
    });
    stopDevicePreview();
    setDeviceModalOpen(false);
  }

  async function playSpeakerTest() {
    setSpeakerTesting(true);
    setDeviceError("");
    try {
      const AudioCtor =
        window.AudioContext ||
        (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtor) throw new Error("unsupported");
      const audioContext = new AudioCtor();
      if (audioContext.state === "suspended") await audioContext.resume();
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = 660;
      gain.gain.value = 0.08;
      oscillator.connect(gain);
      gain.connect(audioContext.destination);
      oscillator.start();
      oscillator.stop(audioContext.currentTime + 0.18);
      oscillator.onended = () => {
        void audioContext.close().catch(() => {});
        setSpeakerTesting(false);
      };
    } catch {
      setSpeakerTesting(false);
      setDeviceError("Could not play the speaker test sound in this browser.");
    }
  }

  async function runNetworkCheck() {
    networkCheckAbortRef.current?.abort();
    networkCheckAbortRef.current = null;

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setNetworkOnline(false);
      setNetworkCheck({ checking: false, bars: 0, latencyMs: null });
      return;
    }

    const controller = new AbortController();
    networkCheckAbortRef.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), 4500);
    const startedAt = performance.now();
    setNetworkCheck({ checking: true, bars: 0, latencyMs: null });

    try {
      const response = await fetch(`/logo-dark-text-clear.png?network_check=${Date.now()}`, {
        cache: "no-store",
        signal: controller.signal,
      });
      if (!response.ok) throw new Error("network-check-failed");
      const latencyMs = Math.round(performance.now() - startedAt);
      const bars = latencyMs >= 700 ? 1 : latencyMs >= 300 ? 2 : latencyMs >= 150 ? 3 : 4;
      if (networkCheckAbortRef.current === controller) {
        setNetworkOnline(true);
        setNetworkCheck({ checking: false, bars, latencyMs });
      }
    } catch (error) {
      const timedOut = Boolean(error && typeof error === "object" && "name" in error && (error as { name?: string }).name === "AbortError");
      if (networkCheckAbortRef.current === controller) {
        setNetworkCheck({ checking: false, bars: timedOut ? 1 : 0, latencyMs: null });
      }
    } finally {
      window.clearTimeout(timeout);
      if (networkCheckAbortRef.current === controller) networkCheckAbortRef.current = null;
    }
  }

  useEffect(() => {
    const syncNetwork = () => setNetworkOnline(navigator.onLine);
    window.addEventListener("online", syncNetwork);
    window.addEventListener("offline", syncNetwork);
    return () => {
      window.removeEventListener("online", syncNetwork);
      window.removeEventListener("offline", syncNetwork);
    };
  }, []);

  useEffect(() => {
    const roleToken = String(interviewAuth.role_token || "").trim();
    if (!backendBase || !roleToken) return;
    let alive = true;
    (async () => {
      try {
        const resp = await fetch(joinUrl(backendBase, `/public/interview-status?role_token=${encodeURIComponent(roleToken)}`), {
          method: "GET",
          credentials: "omit",
        });
        const data = await resp.json().catch(() => ({}));
        if (!resp.ok) return;
        const raw = Number(data?.max_interview_minutes);
        if (alive && Number.isFinite(raw) && raw > 0) setPreStartMaxInterviewMinutes(Math.floor(raw));
      } catch {}
    })();
    return () => {
      alive = false;
    };
  }, [interviewAuth.role_token]);

  useEffect(() => {
    if (!deviceModalOpen) {
      networkCheckAbortRef.current?.abort();
      networkCheckAbortRef.current = null;
      return;
    }
    void runNetworkCheck();
  }, [deviceModalOpen, networkOnline]);

  useEffect(() => {
    if (!deviceModalOpen) {
      stopDevicePreview();
      return;
    }
    void startDevicePreview();
    return () => stopDevicePreview();
  }, [deviceModalOpen, selectedCameraDeviceId, selectedMicrophoneDeviceId]);

  useEffect(() => () => {
    networkCheckAbortRef.current?.abort();
    networkCheckAbortRef.current = null;
    stopDevicePreview();
  }, []);

  async function handleSubmit() {
    if (!validateStep1()) return;

    const roleToken = String(interviewAuth.role_token || "").trim();
    if (!roleToken) {
      setErrors((e) => ({ ...e, submit: "Missing role link. Please use the interview URL you were sent." }));
      return;
    }
    if (!backendBase) {
      setErrors((e) => ({ ...e, submit: "Interview service is not configured. Please try again later." }));
      return;
    }

    setSubmitLoading(true);
    setErrors((e) => ({ ...e, submit: "" }));
    setOtpError("");

    try {
      const body = new FormData();
      body.append("first_name", firstName.trim());
      body.append("last_name", lastName.trim());
      body.append("email", email.trim());
      body.append("phone", String(phone || "").replace(/\D/g, ""));
      body.append("role_token", roleToken);
      if (resumeFile) body.append("resume", resumeFile);

      const resp = await fetch(joinUrl(backendBase, "/api/candidate/submit"), {
        method: "POST",
        body,
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        const hint = String(data?.hint || "").trim();
        const detail = String(data?.detail || "").trim();
        const msg = detail || String(data?.error || "").trim() || "Could not submit your information.";
        setErrors((e) => ({ ...e, submit: hint ? `${msg} ${hint}` : msg }));
        return;
      }

      const verifiedEmail = String(data?.email || email).trim();
      setInterviewAuth({
        candidate_id: String(data?.candidate_id || "").trim(),
        role_id: String(data?.role_id || "").trim(),
        email: verifiedEmail,
        role_token: roleToken,
      });
      setEmail(verifiedEmail);
      setStep("otp");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setErrors((e) => ({ ...e, submit: "Network error. Please try again." }));
    } finally {
      setSubmitLoading(false);
    }
  }

  async function handleResendOtp() {
    const resendEmail = String(interviewAuth.email || email).trim().toLowerCase();
    if (!resendEmail) {
      setResendMessage("");
      setResendError("Could not resend the code. Please try again.");
      return;
    }
    if (!backendBase) {
      setResendMessage("");
      setResendError("Could not resend the code. Please try again.");
      return;
    }

    setResendLoading(true);
    setResendMessage("");
    setResendError("");
    try {
      const resp = await fetch(joinUrl(backendBase, "/api/candidate/verify-otp/resend"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: resendEmail,
          candidate_id: interviewAuth.candidate_id,
          role_id: interviewAuth.role_id,
        }),
      });
      if (!resp.ok) {
        setResendError("Could not resend the code. Please try again.");
        return;
      }
      setResendMessage("A new code was sent. Please check your email.");
    } catch {
      setResendError("Could not resend the code. Please try again.");
    } finally {
      setResendLoading(false);
    }
  }

  async function handleVerify() {
    if (!/^\d{6}$/.test(otp)) {
      setOtpError("Please enter a valid 6-digit code.");
      return;
    }
    if (!backendBase) {
      setOtpError("Interview service is not configured. Please try again later.");
      return;
    }

    const verifyEmail = String(interviewAuth.email || email).trim().toLowerCase();
    if (!verifyEmail || !interviewAuth.candidate_id || !interviewAuth.role_id) {
      setOtpError("Missing interview session data. Please submit your information again.");
      return;
    }

    setVerifyLoading(true);
    setOtpError("");
    try {
      const resp = await fetch(joinUrl(backendBase, "/api/candidate/verify-otp"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: verifyEmail,
          code: otp.trim(),
          candidate_id: interviewAuth.candidate_id,
          role_id: interviewAuth.role_id,
        }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        const hint = String(data?.hint || "").trim();
        const detail = String(data?.detail || "").trim();
        const msg = detail || String(data?.error || "").trim() || "Verification failed.";
        setOtpError(hint ? `${msg} ${hint}` : msg);
        return;
      }

      const verifiedEmail = String(data?.email || verifyEmail).trim();
      setInterviewAuth((prev) => ({
        candidate_id: String(data?.candidate_id || prev.candidate_id).trim(),
        role_id: String(data?.role_id || prev.role_id).trim(),
        email: verifiedEmail,
        role_token: prev.role_token,
      }));
      setStartError("");
      setStep("ready");
      setDeviceModalOpen(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setOtpError("Network error verifying code.");
    } finally {
      setVerifyLoading(false);
    }
  }

  async function handleStartInterview() {
    if (!backendBase) {
      setStartError("Interview service is not configured. Please try again later.");
      return;
    }

    const candidateId = String(interviewAuth.candidate_id || "").trim();
    const roleId = String(interviewAuth.role_id || "").trim();
    const candidateEmail = String(interviewAuth.email || email).trim();
    const roleToken = String(interviewAuth.role_token || "").trim();

    if (!candidateId || !roleId || !candidateEmail || !roleToken) {
      setStartError("Missing interview session data. Please submit and verify again.");
      return;
    }

    setStartLoading(true);
    setStartError("");

    try {
      const resp = await fetch(joinUrl(backendBase, "/create-tavus-interview"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          candidate_id: candidateId,
          role_id: roleId,
          email: candidateEmail,
          roleToken,
          role_token: roleToken,
        }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        const hint = String(data?.hint || "").trim();
        const detail = String(data?.detail || "").trim();
        const msg = detail || String(data?.error || "").trim() || "Could not start interview.";
        setStartError(hint ? `${msg} ${hint}` : msg);
        return;
      }

      const conversationUrl = String(
        data?.conversation_url ||
        data?.video_url ||
        data?.redirect_url ||
        data?.url ||
        "",
      ).trim();
      const conversationId = String(data?.conversation_id || "").trim();
      const interviewId = String(data?.interview_id || "").trim();
      const maxInterviewMinutesRaw = Number(data?.max_interview_minutes);
      const maxInterviewMinutes = Number.isFinite(maxInterviewMinutesRaw) && maxInterviewMinutesRaw > 0
        ? Math.floor(maxInterviewMinutesRaw)
        : null;
      const candidateAssistanceContact = String(
        data?.candidate_assistance_contact ||
        data?.candidateAssistanceContact ||
        "",
      ).trim();

      setInterviewStartState({
        interview_id: interviewId,
        conversation_id: conversationId,
        conversation_url: conversationUrl,
        max_interview_minutes: maxInterviewMinutes,
      });
      if (!conversationUrl) {
        setStartError("Interview room is initializing—try again in a moment.");
        return;
      }

      try {
        window.sessionStorage.setItem(
          "alphasource_interview_live_state",
          JSON.stringify({
            conversation_url: conversationUrl,
            conversation_id: conversationId,
            interview_id: interviewId,
            role_token: roleToken,
            max_interview_minutes: maxInterviewMinutes,
            email: candidateEmail,
            candidate_id: candidateId,
            role_id: roleId,
            candidate_assistance_contact: candidateAssistanceContact,
            ...(savedDevicePreferences.selectedCameraDeviceId
              ? { selectedCameraDeviceId: savedDevicePreferences.selectedCameraDeviceId }
              : {}),
            ...(savedDevicePreferences.selectedMicrophoneDeviceId
              ? { selectedMicrophoneDeviceId: savedDevicePreferences.selectedMicrophoneDeviceId }
              : {}),
          }),
        );
      } catch {}

      setLocation("/interview-cvi");
    } catch {
      setStartError("Network error starting interview.");
    }
    finally {
      setStartLoading(false);
    }
  }

  /* ═══════════════════════════════════════════════════════════════
     PAGE SHELL (all non-live steps)
  ═══════════════════════════════════════════════════════════════ */
  const checklist = CHECKLIST.map((item) =>
    item === "3 uninterrupted minutes to complete the interview"
      ? `${preStartMaxInterviewMinutes ?? 3} uninterrupted minutes to complete the interview`
      : item,
  );

  return (
    <div
      className="min-h-screen bg-[#F8F9FD] flex flex-col"
      style={{ fontFamily: "'Raleway', sans-serif" }}
    >
      {/* ── Terms modal ──────────────────────────────────────── */}
      {termsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div
            className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden"
            style={{ border: "1px solid rgba(10,21,71,0.08)" }}
          >
            {/* Modal header */}
            <div
              className="px-7 pt-7 pb-5"
              style={{ borderBottom: "1px solid rgba(10,21,71,0.07)" }}
            >
              <div className="flex items-center gap-3 mb-1">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: "rgba(163,128,246,0.12)" }}
                >
                  <ChevronRight className="w-4 h-4" style={{ color: "#A380F6" }} />
                </div>
                <h2 className="text-lg font-black text-[#0A1547] leading-tight">
                  Before you start your interview
                </h2>
              </div>
            </div>

            {/* Modal body */}
            <div className="px-7 py-5">
              <p className="text-xs text-[#0A1547]/50 font-semibold mb-3">
                Please review this quick checklist before you begin:
              </p>
              <ul className="space-y-2 mb-5">
                {checklist.map((item) => (
                  <li key={item} className="flex items-start gap-2.5">
                    <span
                      className="mt-0.5 w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: "rgba(163,128,246,0.12)" }}
                    >
                      <Check className="w-2.5 h-2.5" style={{ color: "#A380F6" }} />
                    </span>
                    <span className="text-xs text-[#0A1547]/70 leading-snug">{item}</span>
                  </li>
                ))}
              </ul>

              <div
                className="rounded-xl p-3.5 mb-5 text-xs text-[#0A1547]/60 leading-relaxed"
                style={{ backgroundColor: "rgba(163,128,246,0.06)", border: "1px solid rgba(163,128,246,0.15)" }}
              >
                Background conversations and noise can be picked up during the interview and may
                interfere with your responses.
              </div>

              <label htmlFor="interview-acknowledgement" className="flex items-center gap-2.5 cursor-pointer select-none group">
                <input
                  id="interview-acknowledgement"
                  type="checkbox"
                  className="sr-only"
                  checked={understood}
                  onChange={(e) => setUnderstood(e.target.checked)}
                />
                <span
                  className="w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all"
                  style={{
                    borderColor: understood ? "#A380F6" : "#D1D5DB",
                    backgroundColor: understood ? "#A380F6" : "transparent",
                  }}
                >
                  {understood && <Check className="w-2.5 h-2.5 text-white" />}
                </span>
                <span className="text-xs text-[#0A1547]/70 font-semibold">
                  I understand and I am in a quiet place.
                </span>
              </label>
              <p className="text-[10px] text-[#0A1547]/45 mt-3">
                By continuing, you agree to the{" "}
                <a href="/interview/terms" target="_blank" rel="noopener noreferrer" className="text-[#A380F6] hover:underline font-semibold">
                  Candidate Terms &amp; Conditions
                </a>
                .
              </p>
            </div>

            {/* Modal footer */}
            <div
              className="px-7 py-5 flex justify-end"
              style={{ borderTop: "1px solid rgba(10,21,71,0.07)" }}
            >
              <button
                disabled={!understood}
                onClick={() => setTermsOpen(false)}
                className="flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-bold text-white transition-all"
                style={{
                  backgroundColor: understood ? "#A380F6" : "rgba(163,128,246,0.30)",
                  cursor: understood ? "pointer" : "not-allowed",
                }}
              >
                Continue
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {deviceModalOpen && step === "ready" && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-[#0A1547]/45 backdrop-blur-sm">
          <div
            className="bg-white rounded-2xl w-full max-w-4xl max-h-[92vh] overflow-y-auto shadow-2xl"
            style={{ border: "1px solid rgba(10,21,71,0.08)" }}
          >
            <div className="px-6 py-5 border-b border-gray-100">
              <p className="text-[10px] font-black uppercase tracking-widest text-[#A380F6] mb-1">Device check</p>
              <h2 className="text-lg font-black text-[#0A1547]">Check your audio and video</h2>
              <p className="text-xs text-[#0A1547]/55 font-semibold mt-1 leading-relaxed">
                Test or change your camera and microphone, play a speaker test, and confirm your network is ready before joining the interview.
              </p>
            </div>

            <div className="p-6 grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
              <div className="space-y-4">
                <div className="relative rounded-2xl overflow-hidden bg-[#0A1547] aspect-video flex items-center justify-center">
                  <video ref={previewVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                  {!previewStreamRef.current && (
                    <span className="absolute text-xs font-semibold text-white/65">Camera preview</span>
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-black uppercase tracking-widest text-[#0A1547]/40">Microphone level</span>
                    <span className="text-[10px] font-semibold text-[#0A1547]/35">{micLevel}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${micLevel}%`, backgroundColor: "#02D99D" }} />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-[#0A1547]/40 block mb-1.5">Camera source</label>
                  <select
                    value={selectedCameraDeviceId}
                    onChange={(e) => setSelectedCameraDeviceId(e.target.value)}
                    className={inputCls}
                  >
                    <option value="">Default camera</option>
                    {cameraDevices.map((device, index) => (
                      <option key={device.deviceId || `camera-${index}`} value={device.deviceId}>
                        {device.label || `Camera ${index + 1}`}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-[#0A1547]/40 block mb-1.5">Microphone source</label>
                  <select
                    value={selectedMicrophoneDeviceId}
                    onChange={(e) => setSelectedMicrophoneDeviceId(e.target.value)}
                    className={inputCls}
                  >
                    <option value="">Default microphone</option>
                    {microphoneDevices.map((device, index) => (
                      <option key={device.deviceId || `microphone-${index}`} value={device.deviceId}>
                        {device.label || `Microphone ${index + 1}`}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="rounded-xl p-3.5 bg-gray-50 border border-gray-100">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-black text-[#0A1547]">Speaker test</p>
                      <p className="text-[10px] text-[#0A1547]/45 font-semibold">Play a short sound and confirm you can hear it.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => { void playSpeakerTest(); }}
                      disabled={speakerTesting}
                      className="px-3.5 py-2 rounded-full text-xs font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                      style={{ backgroundColor: "#A380F6" }}
                    >
                      {speakerTesting ? "Playing..." : "Play sound"}
                    </button>
                  </div>
                </div>

                <div className="rounded-xl p-3.5 bg-gray-50 border border-gray-100">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-black text-[#0A1547]">Network</p>
                      <p className="text-[10px] text-[#0A1547]/45 font-semibold">Lightweight connection check.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => { void runNetworkCheck(); }}
                      disabled={networkCheck.checking}
                      className="px-3 py-1.5 rounded-full text-[10px] font-black text-[#0A1547] bg-white border border-gray-200 transition-opacity hover:opacity-80 disabled:opacity-50"
                    >
                      {networkCheck.checking ? "Testing..." : "Retest"}
                    </button>
                  </div>
                  <div className="mt-3 flex items-end justify-between gap-3">
                    <div className="flex items-end gap-1" aria-label={`${networkCheck.bars} of 4 connection bars`}>
                      {[1, 2, 3, 4].map((bar) => (
                        <span
                          key={bar}
                          className={`w-2 rounded-full ${bar <= networkCheck.bars ? "bg-[#009E73]" : "bg-gray-200"}`}
                          style={{ height: `${bar * 4 + 8}px` }}
                        />
                      ))}
                    </div>
                    <div className="text-right">
                      <p className={`text-xs font-black ${networkCheck.checking ? "text-[#0A1547]/55" : networkCheck.bars > 0 ? "text-[#009E73]" : "text-red-500"}`}>
                        {networkCheck.checking ? "Checking connection" : networkStatusText[networkCheck.bars]}
                      </p>
                      <p className="text-[10px] text-[#0A1547]/45 font-semibold">
                        {networkCheck.latencyMs !== null ? `${networkCheck.latencyMs} ms` : networkCheck.checking ? "Testing latency..." : networkOnline ? "Latency unavailable" : "Offline"}
                      </p>
                    </div>
                  </div>
                </div>

                {deviceError && <p className="text-xs text-red-500 font-semibold leading-relaxed">{deviceError}</p>}
                {deviceLoading && <p className="text-xs text-[#0A1547]/45 font-semibold">Checking devices...</p>}
              </div>
            </div>

            <div className="px-6 py-5 border-t border-gray-100 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={handleSkipDeviceCheck}
                className="px-5 py-2.5 rounded-full text-sm font-bold text-[#0A1547]/55 bg-[#0A1547]/5 hover:bg-[#0A1547]/10 transition-colors"
              >
                Skip
              </button>
              <button
                type="button"
                onClick={handleProceedDeviceCheck}
                className="px-5 py-2.5 rounded-full text-sm font-bold text-white hover:opacity-90 transition-opacity"
                style={{ backgroundColor: "#A380F6" }}
              >
                Proceed
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Header ───────────────────────────────────────────── */}
      <header
        className="bg-white flex-shrink-0 flex items-center px-6 h-14"
        style={{ borderBottom: "1px solid rgba(10,21,71,0.07)" }}
      >
        <img src="/logo-dark-text.png" alt="AlphaSource AI" className="h-8 w-auto" />
      </header>

      {/* ── Centered workflow area ────────────────────────────── */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-12">

        {/* Step indicator */}
        <StepIndicator current={step} />

        {/* ── STEP 1: Enter your information ─────────────────── */}
        {step === "info" && (
          <Card>
            <h1 className="text-xl font-black text-[#0A1547] mb-1">Enter your information</h1>
            <p className="text-xs text-[#0A1547]/45 font-semibold mb-6">
              All fields are required to proceed.
            </p>

            <div className="space-y-4">
              {/* Names */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-[#0A1547]/40 block mb-1.5">
                    First Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    value={firstName}
                    onChange={(e) => { setFirstName(e.target.value); setErrors((er) => ({ ...er, firstName: "", submit: "" })); }}
                    placeholder="Jane"
                    className={inputCls}
                  />
                  {errors.firstName && <p className={errorCls}>{errors.firstName}</p>}
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-[#0A1547]/40 block mb-1.5">
                    Last Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    value={lastName}
                    onChange={(e) => { setLastName(e.target.value); setErrors((er) => ({ ...er, lastName: "", submit: "" })); }}
                    placeholder="Smith"
                    className={inputCls}
                  />
                  {errors.lastName && <p className={errorCls}>{errors.lastName}</p>}
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-[#0A1547]/40 block mb-1.5">
                  Email <span className="text-red-400">*</span>
                </label>
                  <input
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setErrors((er) => ({ ...er, email: "", submit: "" })); }}
                    placeholder="jane@example.com"
                    type="email"
                    className={inputCls}
                />
                {errors.email && <p className={errorCls}>{errors.email}</p>}
              </div>

              {/* Phone */}
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-[#0A1547]/40 block mb-1.5">
                  Phone <span className="text-red-400">*</span>
                </label>
                  <input
                    value={phone}
                    onChange={(e) => { setPhone(e.target.value); setErrors((er) => ({ ...er, phone: "", submit: "" })); }}
                    placeholder="(555) 123-4567"
                    type="tel"
                    className={inputCls}
                />
                {errors.phone && <p className={errorCls}>{errors.phone}</p>}
              </div>

              {/* Resume upload */}
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-[#0A1547]/40 block mb-1.5">
                  Resume <span className="text-red-400">*</span>
                </label>
                <div
                  className={`flex items-center gap-2.5 px-4 py-3 rounded-xl border-2 border-dashed cursor-pointer transition-all text-sm
                    ${dragging
                      ? "border-[#A380F6] bg-[#A380F6]/05"
                      : "border-gray-200 hover:border-[#A380F6]/50 hover:bg-gray-50"
                    }`}
                  onClick={() => fileRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragging(false);
                    if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
                    setErrors((er) => ({ ...er, submit: "" }));
                  }}
                >
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".pdf,.doc,.docx"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files?.[0]) handleFile(e.target.files[0]);
                      setErrors((er) => ({ ...er, submit: "" }));
                    }}
                  />
                  {resumeFile ? (
                    <>
                      <FileText className="w-4 h-4 flex-shrink-0" style={{ color: "#A380F6" }} />
                      <span className="text-xs font-semibold text-[#0A1547] truncate flex-1">{resumeFile.name}</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setResumeFile(null);
                          setErrors((er) => ({ ...er, submit: "" }));
                        }}
                        className="text-[#0A1547]/30 hover:text-red-500 transition-colors flex-shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 flex-shrink-0 text-gray-400" />
                      <span className="text-xs text-gray-400">
                        PDF, DOC, or DOCX — drag here or click to browse
                      </span>
                    </>
                  )}
                </div>
                {errors.resume && <p className={errorCls}>{errors.resume}</p>}
                {errors.submit && <p className={errorCls}>{errors.submit}</p>}
              </div>
            </div>

            {/* Submit */}
            <div className="mt-7 flex items-center justify-between">
              <a
                href={
                  interviewAuth.role_token
                    ? `/accommodation-request/${encodeURIComponent(interviewAuth.role_token)}`
                    : "/accommodation-request"
                }
                className="text-xs text-[#A380F6] hover:underline transition-colors"
              >
                Need an accommodation?
              </a>
              <button
                onClick={handleSubmit}
                disabled={submitLoading}
                className="flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-bold text-white transition-all hover:opacity-90 active:scale-[0.97]"
                style={{ backgroundColor: "#A380F6" }}
              >
                {submitLoading ? "Submitting..." : "Submit & Get OTP"}
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </Card>
        )}

        {/* ── STEP 2: Verify ─────────────────────────────────── */}
        {step === "otp" && (
          <Card>
            <h1 className="text-xl font-black text-[#0A1547] mb-1">Verify your identity</h1>
            <p className="text-xs text-[#0A1547]/45 font-semibold mb-6">
              A one-time code was sent to{" "}
              <span className="text-[#0A1547]/70">{interviewAuth.email || email}</span>.
            </p>

            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-[#0A1547]/40 block mb-1.5">
                One-Time Code <span className="text-red-400">*</span>
              </label>
              <input
                value={otp}
                onChange={(e) => {
                  setOtp(e.target.value.replace(/\D/g, "").slice(0, 6));
                  setOtpError("");
                }}
                onKeyDown={(e) => { if (e.key === "Enter") handleVerify(); }}
                placeholder="123456"
                maxLength={6}
                className={`${inputCls} text-center tracking-[0.5em] text-lg font-black`}
              />
              {otpError && <p className={errorCls}>{otpError}</p>}
            </div>

            <p className="text-[10px] text-[#0A1547]/35 mt-3 leading-relaxed">
              Didn't receive a code? Check your spam folder or contact{" "}
              <a href="mailto:info@alphasourceai.com" className="text-[#A380F6] hover:underline">
                info@alphasourceai.com
              </a>
              .
            </p>

            <button
              onClick={handleVerify}
              disabled={verifyLoading}
              className="mt-7 w-full flex items-center justify-center gap-2 px-6 py-2.5 rounded-full text-sm font-bold text-white transition-all hover:opacity-90 active:scale-[0.97]"
              style={{ backgroundColor: "#A380F6" }}
            >
              {verifyLoading ? "Verifying..." : "Verify"}
              <ArrowRight className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={handleResendOtp}
              disabled={resendLoading || verifyLoading || submitLoading}
              className="mt-3 w-full px-6 py-2.5 rounded-full text-sm font-bold text-[#7C5FCC] bg-[#A380F6]/10 hover:bg-[#A380F6]/15 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              {resendLoading ? "Sending..." : "Resend code"}
            </button>
            {resendMessage && <p className="text-[#02D99D] text-[10px] mt-2 font-semibold">{resendMessage}</p>}
            {resendError && <p className={errorCls}>{resendError}</p>}
          </Card>
        )}

        {/* ── STEP 3: Start Interview ─────────────────────────── */}
        {step === "ready" && (
          <Card>
            {/* Success icon */}
            <div className="flex flex-col items-center text-center">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5"
                style={{ backgroundColor: "rgba(2,217,157,0.12)", border: "1px solid rgba(2,217,157,0.2)" }}
              >
                <Check className="w-6 h-6" style={{ color: "#02D99D" }} />
              </div>

              <h1 className="text-xl font-black text-[#0A1547] mb-2">You're all set, {firstName}!</h1>
              <p className="text-xs text-[#0A1547]/45 font-semibold mb-2 leading-relaxed max-w-xs">
                Your identity has been verified. When you're ready, click the button below to begin
                your interview.
              </p>
              <p className="text-[10px] text-[#0A1547]/30 mb-8 leading-relaxed max-w-xs">
                Make sure you are in a quiet space with a stable internet connection before starting.
              </p>
              <button
                type="button"
                onClick={() => setDeviceModalOpen(true)}
                className="mb-5 px-4 py-2 rounded-full text-xs font-bold text-[#7C5FCC] bg-[#A380F6]/10 hover:bg-[#A380F6]/15 transition-colors"
              >
                Device check
              </button>

              <button
                onClick={handleStartInterview}
                disabled={startLoading}
                className="flex items-center gap-2.5 px-8 py-3 rounded-full text-sm font-bold text-white transition-all hover:opacity-90 active:scale-[0.97] shadow-lg"
                style={{ backgroundColor: "#02D99D", boxShadow: "0 4px 20px rgba(2,217,157,0.35)" }}
              >
                <span
                  className="w-2 h-2 rounded-full bg-white animate-pulse flex-shrink-0"
                />
                {startLoading ? "Starting..." : "Start Interview"}
              </button>
              {startError && <p className={errorCls}>{startError}</p>}
            </div>
          </Card>
        )}
      </main>
    </div>
  );
}
