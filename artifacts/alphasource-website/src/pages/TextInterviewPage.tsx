import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Check, FileText, MessageSquareText, Trash2, Upload } from "lucide-react";

type TextSession = {
  request_id?: string;
  candidate_name?: string;
  candidate_email?: string;
  candidate_assistance_contact?: string;
  role_id?: string;
  role_title?: string;
  questions?: string[];
  resume_required?: boolean;
  completed?: boolean;
};

type TextAnswer = {
  index: number;
  question: string;
  answer: string;
  paste_count: number;
  largest_paste_length: number;
  typed_char_count: number;
  pasted_char_count: number;
  used_paste: boolean;
};

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

function joinUrl(base: string, path: string): string {
  if (!base) return path;
  if (base.endsWith("/") && path.startsWith("/")) return `${base.slice(0, -1)}${path}`;
  if (!base.endsWith("/") && !path.startsWith("/")) return `${base}/${path}`;
  return `${base}${path}`;
}

function readTextToken(params?: { token?: string }): string {
  const fromParams = String(params?.token || "").trim();
  if (fromParams) return fromParams;
  if (typeof window === "undefined") return "";
  try {
    const path = String(window.location.pathname || "");
    const pathMatch = path.match(/^\/text-interview\/([^/?#]+)/);
    if (pathMatch?.[1]) return decodeURIComponent(pathMatch[1]).trim();

    const url = new URL(window.location.href);
    return (
      String(url.searchParams.get("token") || "").trim() ||
      String(url.searchParams.get("role_token") || "").trim()
    );
  } catch {
    return "";
  }
}

const env = (
  typeof import.meta !== "undefined" && import.meta.env ? import.meta.env : {}
) as Record<string, string | undefined>;

const backendBase = firstBase(
  env.VITE_BACKEND_URL,
  env.VITE_API_URL,
  env.VITE_PUBLIC_BACKEND_URL,
  env.PUBLIC_BACKEND_URL,
  env.BACKEND_URL,
);

const inputCls =
  "w-full px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-[#0A1547] text-sm " +
  "placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#A380F6]/20 " +
  "focus:border-[#A380F6] transition-all";

const errorCls = "text-red-500 text-[10px] mt-1 font-semibold";
const primaryButtonCls =
  "flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-bold text-white transition-all hover:opacity-90 active:scale-[0.97] disabled:opacity-60";
const secondaryButtonCls =
  "flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-bold text-[#0A1547] bg-gray-100 hover:bg-gray-200 transition-colors disabled:opacity-50";

export default function TextInterviewPage({ params }: { params?: { token?: string } }) {
  const token = useMemo(() => readTextToken(params), [params?.token]);
  const fileRef = useRef<HTMLInputElement>(null);
  const answerRef = useRef<HTMLTextAreaElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const pendingPasteCharsRef = useRef(0);

  const [started, setStarted] = useState(false);
  const [loadingSession, setLoadingSession] = useState(false);
  const [session, setSession] = useState<TextSession | null>(null);
  const [blocked, setBlocked] = useState<{ message: string } | null>(null);
  const [error, setError] = useState("");

  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [resumeUploaded, setResumeUploaded] = useState(false);
  const [uploadingResume, setUploadingResume] = useState(false);

  const [answers, setAnswers] = useState<TextAnswer[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [closeAttempted, setCloseAttempted] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  const totalQuestions = answers.length;
  const current = answers[currentIndex] || null;
  const chatReady = started && resumeUploaded && !submitted && !loadingSession && !error && !blocked;
  const isWorkspaceStage = started && resumeUploaded && !submitted && !loadingSession && !blocked;
  const candidateAssistanceContact = useMemo(
    () => String(session?.candidate_assistance_contact || "").trim(),
    [session?.candidate_assistance_contact],
  );
  const candidateAssistanceHref = useMemo(() => {
    if (!candidateAssistanceContact) return "";
    if (candidateAssistanceContact.includes("@")) return `mailto:${candidateAssistanceContact}`;
    const digits = candidateAssistanceContact.replace(/\D+/g, "");
    if (digits.length >= 10) return `tel:${digits}`;
    return "";
  }, [candidateAssistanceContact]);

  async function loadSession() {
    if (!token) {
      setError("Missing interview link.");
      setLoadingSession(false);
      return;
    }
    setLoadingSession(true);
    setError("");
    setBlocked(null);
    try {
      const resp = await fetch(joinUrl(backendBase, "/api/text-interview/session"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await resp.json().catch(() => ({}));

      if (!resp.ok) {
        if (data?.code === "duplicate_candidate") {
          setBlocked({
            message: String(data?.error || "Our records show you’ve already completed an interview for this role."),
          });
          setSession(null);
          return;
        }
        const detail = String(data?.detail || "").trim();
        const msg = String(data?.error || "").trim();
        setError(detail || msg || "Could not load interview.");
        setSession(null);
        return;
      }

      const nextSession: TextSession = data || {};
      const questions = Array.isArray(nextSession.questions) ? nextSession.questions : [];
      const nextAnswers: TextAnswer[] = questions.map((q, idx) => ({
        index: idx + 1,
        question: String(q || "").trim(),
        answer: "",
        paste_count: 0,
        largest_paste_length: 0,
        typed_char_count: 0,
        pasted_char_count: 0,
        used_paste: false,
      }));

      setSession(nextSession);
      setAnswers(nextAnswers);
      setCurrentIndex(0);
      setSubmitted(Boolean(nextSession.completed));
      setResumeUploaded(false);
      pendingPasteCharsRef.current = 0;
    } catch {
      setError("Network error loading interview.");
      setSession(null);
    } finally {
      setLoadingSession(false);
    }
  }

  useEffect(() => {
    if (!started) return;
    void loadSession();
  }, [token, started]);

  useEffect(() => {
    if (!chatReady) return;
    const raf = requestAnimationFrame(() => {
      answerRef.current?.focus();
      chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    });
    return () => cancelAnimationFrame(raf);
  }, [chatReady, currentIndex]);

  async function uploadResume() {
    if (!resumeFile) return;
    setUploadingResume(true);
    setError("");
    try {
      const body = new FormData();
      body.append("token", token);
      body.append("resume", resumeFile);

      const resp = await fetch(joinUrl(backendBase, "/api/text-interview/resume"), {
        method: "POST",
        body,
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        const detail = String(data?.detail || "").trim();
        const msg = String(data?.error || "").trim();
        setError(detail || msg || "Resume upload failed.");
        return;
      }

      setResumeUploaded(true);
      setResumeFile(null);
      if (fileRef.current) fileRef.current.value = "";
    } catch {
      setError("Network error uploading resume.");
    } finally {
      setUploadingResume(false);
    }
  }

  async function submitAnswers() {
    setSubmitting(true);
    setError("");
    try {
      const payload = {
        token,
        answers: answers.map((item) => ({
          question: item.question,
          answer: item.answer,
          paste_count: Number(item.paste_count) || 0,
          largest_paste_length: Number(item.largest_paste_length) || 0,
          typed_char_count: Number(item.typed_char_count) || 0,
          pasted_char_count: Number(item.pasted_char_count) || 0,
          used_paste: Boolean(item.used_paste),
        })),
      };

      const resp = await fetch(joinUrl(backendBase, "/api/text-interview/answers"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        const detail = String(data?.detail || "").trim();
        const msg = String(data?.error || "").trim();
        setError(detail || msg || "Submission failed.");
        return;
      }
      setSubmitted(true);
    } catch {
      setError("Network error submitting answers.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleNext() {
    if (!current) return;
    if (!String(current.answer || "").trim()) {
      setError("Please enter your response before continuing.");
      return;
    }
    setError("");
    if (currentIndex < totalQuestions - 1) {
      setCurrentIndex((idx) => idx + 1);
      return;
    }
    void submitAnswers();
  }

  function handlePrev() {
    if (currentIndex === 0) return;
    setError("");
    setCurrentIndex((idx) => idx - 1);
  }

  function handleClose() {
    setCloseAttempted(true);
    try {
      window.close();
    } catch {}
  }

  return (
    <div className="min-h-screen bg-[#F8F9FD] flex flex-col" style={{ fontFamily: "'Raleway', sans-serif" }}>
      <header
        className="bg-white flex-shrink-0 flex items-center px-6 h-14"
        style={{ borderBottom: "1px solid rgba(10,21,71,0.07)" }}
      >
        <img src="/logo-dark-text.png" alt="alphaSource AI" className="h-8 w-auto" />
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        <div
          className={`bg-white rounded-2xl p-8 w-full ${isWorkspaceStage ? "max-w-3xl" : "max-w-md"}`}
          style={{
            border: "1px solid rgba(10,21,71,0.07)",
            boxShadow: "0 4px 24px rgba(10,21,71,0.08)",
          }}
        >
          {loadingSession ? (
            <div className="text-center">
              <h1 className="text-xl font-black text-[#0A1547] mb-2">Loading text interview</h1>
              <p className="text-xs text-[#0A1547]/45 font-semibold">Please wait while we prepare your interview session.</p>
            </div>
          ) : blocked ? (
            <div className="text-center">
              <h1 className="text-xl font-black text-[#0A1547] mb-2">Interview unavailable</h1>
              <p className="text-xs text-[#0A1547]/60 leading-relaxed font-semibold">{blocked.message}</p>
              <p className="text-xs text-[#0A1547]/50 mt-3">
                If you believe this is an error, contact{" "}
                <a href="mailto:info@alphasourceai.com" className="text-[#A380F6] hover:underline">
                  info@alphasourceai.com
                </a>
                .
              </p>
            </div>
          ) : submitted ? (
            <div className="text-center">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5"
                style={{ backgroundColor: "rgba(2,217,157,0.12)", border: "1px solid rgba(2,217,157,0.2)" }}
              >
                <Check className="w-6 h-6" style={{ color: "#02D99D" }} />
              </div>
              <h1 className="text-xl font-black text-[#0A1547] mb-2">Interview complete</h1>
              <p className="text-xs text-[#0A1547]/60 leading-relaxed font-semibold">
                Thanks for completing your text interview. We’ve received your responses and will follow up soon.
              </p>
              <button
                type="button"
                onClick={handleClose}
                className={`${primaryButtonCls} mt-6 mx-auto`}
                style={{ backgroundColor: "#A380F6" }}
              >
                Close window
              </button>
              {closeAttempted && (
                <p className="text-xs text-[#0A1547]/45 mt-3">
                  If this window didn’t close automatically, you can safely close it now.
                </p>
              )}
            </div>
          ) : !started ? (
            <div className="text-center">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5"
                style={{ backgroundColor: "rgba(163,128,246,0.12)", border: "1px solid rgba(163,128,246,0.2)" }}
              >
                <MessageSquareText className="w-6 h-6" style={{ color: "#A380F6" }} />
              </div>
              <h1 className="text-xl font-black text-[#0A1547] mb-1">This is a text interview</h1>
              <p className="text-xs text-[#0A1547]/45 font-semibold leading-relaxed">
                You will complete this interview in writing.
              </p>
              <div
                className="rounded-xl p-3.5 mt-5 text-left text-xs text-[#0A1547]/60 leading-relaxed"
                style={{ backgroundColor: "rgba(163,128,246,0.06)", border: "1px solid rgba(163,128,246,0.15)" }}
              >
                After you continue, you will upload your resume and then answer interview questions in writing.
              </div>
              <p className="text-[10px] text-[#0A1547]/45 mt-4">
                By continuing, you agree to the{" "}
                <a href="/interview/terms" target="_blank" rel="noopener noreferrer" className="text-[#A380F6] hover:underline font-semibold">
                  Candidate Terms &amp; Conditions
                </a>
                .
              </p>
              {error && <p className={errorCls}>{error}</p>}
              <button
                type="button"
                onClick={() => {
                  setError("");
                  setLoadingSession(true);
                  setStarted(true);
                }}
                className={`${primaryButtonCls} mt-7 mx-auto`}
                style={{ backgroundColor: "#A380F6" }}
              >
                Start Text Interview
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : !resumeUploaded ? (
            <div>
              <h1 className="text-xl font-black text-[#0A1547] mb-1">Upload your resume</h1>
              <p className="text-xs text-[#0A1547]/45 font-semibold mb-6">
                Resume upload is required before answering text interview questions.
              </p>

              <div
                className="flex items-center gap-2.5 px-4 py-3 rounded-xl border-2 border-dashed cursor-pointer transition-all text-sm border-gray-200 hover:border-[#A380F6]/50 hover:bg-gray-50"
                onClick={() => fileRef.current?.click()}
              >
                <input
                  ref={fileRef}
                  type="file"
                  accept=".pdf,.doc,.docx"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null;
                    setResumeFile(file);
                    setError("");
                  }}
                />
                {resumeFile ? (
                  <>
                    <FileText className="w-4 h-4 flex-shrink-0" style={{ color: "#A380F6" }} />
                    <span className="text-xs font-semibold text-[#0A1547] truncate flex-1">{resumeFile.name}</span>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        setResumeFile(null);
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
                      PDF, DOCX, or DOC — drag here or click to browse
                    </span>
                  </>
                )}
              </div>

              {error && <p className={errorCls}>{error}</p>}

              <div className="mt-7 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setStarted(false)}
                  className={secondaryButtonCls}
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => void uploadResume()}
                  disabled={!resumeFile || uploadingResume}
                  className={primaryButtonCls}
                  style={{ backgroundColor: "#A380F6" }}
                >
                  {uploadingResume ? "Uploading..." : "Upload Resume"}
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ) : (
            <div className="max-w-2xl mx-auto">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <h1 className="text-xl font-black text-[#0A1547] mb-1">Text interview workspace</h1>
                  <p className="text-xs text-[#0A1547]/45 font-semibold">
                    Question {Math.min(currentIndex + 1, Math.max(totalQuestions, 1))} of {Math.max(totalQuestions, 1)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setHelpOpen(true)}
                  className="px-4 py-2 rounded-full text-xs sm:text-sm font-bold transition-colors border border-[rgba(10,21,71,0.14)] text-[#0A1547] hover:bg-white"
                >
                  Need help?
                </button>
              </div>

              <div
                className="rounded-xl p-4 h-[340px] overflow-y-auto mb-4"
                style={{ border: "1px solid rgba(10,21,71,0.08)", backgroundColor: "#F8F9FD" }}
              >
                {answers.slice(0, currentIndex).map((item) => (
                  <div key={item.index} className="mb-4">
                    <div
                      className="rounded-2xl px-4 py-3 text-sm text-[#0A1547] mb-2"
                      style={{ backgroundColor: "rgba(163,128,246,0.12)", border: "1px solid rgba(163,128,246,0.2)" }}
                    >
                      <span className="font-bold mr-1">Q{item.index}.</span>
                      {item.question}
                    </div>
                    <div className="rounded-2xl px-4 py-3 text-sm text-white ml-6" style={{ backgroundColor: "#0A1547" }}>
                      {item.answer}
                    </div>
                  </div>
                ))}

                {current ? (
                  <div className="mb-2">
                    <div
                      className="rounded-2xl px-4 py-3 text-sm text-[#0A1547]"
                      style={{ backgroundColor: "rgba(163,128,246,0.12)", border: "1px solid rgba(163,128,246,0.2)" }}
                    >
                      <span className="font-bold mr-1">Q{current.index}.</span>
                      {current.question}
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-[#0A1547]/60">No questions are available for this interview.</div>
                )}
                <div ref={chatEndRef} />
              </div>

              {current ? (
                <>
                  <label className="text-[10px] font-black uppercase tracking-widest text-[#0A1547]/40 block mb-1.5">
                    Your response
                  </label>
                  <textarea
                    ref={answerRef}
                    rows={5}
                    className={inputCls}
                    value={current.answer}
                    onChange={(event) => {
                      const nextValue = event.target.value;
                      setAnswers((prev) => {
                        const next = [...prev];
                        const existing = next[currentIndex];
                        if (!existing) return prev;
                        const prevValue = String(existing.answer || "");
                        const growth = Math.max(0, nextValue.length - prevValue.length);
                        const pendingPasteChars = Math.max(0, Number(pendingPasteCharsRef.current) || 0);
                        const pastedDelta = Math.min(pendingPasteChars, growth);
                        const typedDelta = Math.max(0, growth - pastedDelta);
                        pendingPasteCharsRef.current = Math.max(0, pendingPasteChars - pastedDelta);
                        next[currentIndex] = {
                          ...existing,
                          answer: nextValue,
                          typed_char_count: (Number(existing.typed_char_count) || 0) + typedDelta,
                        };
                        return next;
                      });
                    }}
                    onPaste={(event) => {
                      const pastedText = event.clipboardData?.getData?.("text") || "";
                      const pastedLen = Math.max(0, pastedText.length);
                      pendingPasteCharsRef.current = (Number(pendingPasteCharsRef.current) || 0) + pastedLen;
                      setAnswers((prev) => {
                        const next = [...prev];
                        const existing = next[currentIndex];
                        if (!existing) return prev;
                        next[currentIndex] = {
                          ...existing,
                          paste_count: (Number(existing.paste_count) || 0) + 1,
                          largest_paste_length: Math.max(Number(existing.largest_paste_length) || 0, pastedLen),
                          pasted_char_count: (Number(existing.pasted_char_count) || 0) + pastedLen,
                          used_paste: true,
                        };
                        return next;
                      });
                    }}
                  />
                </>
              ) : null}

              {error && <p className={errorCls}>{error}</p>}

              <div className="mt-6 flex items-center justify-between">
                <button
                  type="button"
                  className={secondaryButtonCls}
                  onClick={handlePrev}
                  disabled={currentIndex === 0 || submitting}
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleNext}
                  disabled={submitting || !current}
                  className={primaryButtonCls}
                  style={{ backgroundColor: "#A380F6" }}
                >
                  {submitting ? "Submitting..." : currentIndex === totalQuestions - 1 ? "Submit Interview" : "Next"}
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
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
