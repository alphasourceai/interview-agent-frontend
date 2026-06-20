import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, ShieldCheck, XCircle } from "lucide-react";

type ApprovalStatus = "loading" | "ready" | "approved" | "rejected" | "expired" | "unavailable" | "error";

interface AutomationApprovalPageProps {
  params?: {
    token?: string;
  };
}

interface ApprovalItem {
  state?: string | null;
  candidate_name?: string | null;
  role_title?: string | null;
  scores?: {
    overall_score?: unknown;
    resume_score?: unknown;
    interview_score?: unknown;
  } | null;
  expires_at?: string | null;
}

interface ApprovalResponse {
  ok?: boolean;
  item?: ApprovalItem | null;
  code?: string;
  error?: string;
  detail?: string;
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

function joinUrl(base: string, path: string): string {
  if (!base) return path;
  if (base.endsWith("/") && path.startsWith("/")) return `${base.slice(0, -1)}${path}`;
  if (!base.endsWith("/") && !path.startsWith("/")) return `${base}/${path}`;
  return `${base}${path}`;
}

function readApprovalToken(params?: { token?: string }): string {
  const fromParams = String(params?.token || "").trim();
  if (fromParams) return fromParams;
  if (typeof window === "undefined") return "";
  try {
    const path = String(window.location.pathname || "");
    const pathMatch = path.match(/^\/automation\/approval\/([^/?#]+)/);
    if (pathMatch?.[1]) return decodeURIComponent(pathMatch[1]).trim();
    return "";
  } catch {
    return "";
  }
}

function parseJsonSafe(text: string): ApprovalResponse {
  if (!text) return {};
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function textOrNull(value: unknown): string | null {
  const text = String(value || "").trim().replace(/\s+/g, " ");
  return text || null;
}

function scoreOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const score = Number(value);
  return Number.isFinite(score) ? score : null;
}

function formatScore(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1)}%`;
}

function formatDateTime(value: unknown): string | null {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function classifyError(status: number, data: ApprovalResponse): Exclude<ApprovalStatus, "loading" | "ready" | "approved" | "rejected"> {
  const code = String(data?.code || data?.error || "").trim();
  if (status === 410 || code === "approval_token_expired") return "expired";
  if (
    status === 404 ||
    status === 409 ||
    code === "approval_token_invalid" ||
    code === "invalid_action_state"
  ) {
    return "unavailable";
  }
  return "error";
}

const backendBase = firstBase(
  env.VITE_BACKEND_URL,
  env.VITE_API_URL,
  env.VITE_PUBLIC_BACKEND_URL,
  env.PUBLIC_BACKEND_URL,
  env.BACKEND_URL,
);

const primaryButtonCls =
  "inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-black text-white transition-all hover:opacity-90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60";
const secondaryButtonCls =
  "inline-flex items-center justify-center gap-2 rounded-full border px-5 py-2.5 text-sm font-black transition-all hover:bg-red-50 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60";

function StateCard({
  icon,
  title,
  body,
  tone = "neutral",
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  tone?: "neutral" | "success" | "warning";
}) {
  const toneClass =
    tone === "success"
      ? "bg-emerald-50 text-emerald-700"
      : tone === "warning"
        ? "bg-amber-50 text-amber-700"
        : "bg-[#A380F6]/10 text-[#A380F6]";

  return (
    <div className="space-y-5 text-center">
      <div className={`mx-auto flex h-12 w-12 items-center justify-center rounded-full ${toneClass}`}>
        {icon}
      </div>
      <div>
        <h1 className="text-2xl font-black leading-tight text-[#0A1547]">{title}</h1>
        <p className="mt-3 text-sm leading-relaxed text-[#0A1547]/65">{body}</p>
      </div>
    </div>
  );
}

function ScoreCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-[#0A1547]/10 bg-[#F8F9FD] px-4 py-3">
      <p className="text-[10px] font-black uppercase tracking-widest text-[#0A1547]/45">{label}</p>
      <p className="mt-1 text-2xl font-black text-[#0A1547]">{formatScore(value)}</p>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[#0A1547]/10 bg-white px-4 py-3">
      <p className="text-[10px] font-black uppercase tracking-widest text-[#0A1547]/45">{label}</p>
      <p className="mt-1 text-sm font-black text-[#0A1547]">{value}</p>
    </div>
  );
}

export default function AutomationApprovalPage({ params }: AutomationApprovalPageProps) {
  const token = useMemo(() => readApprovalToken(params), [params?.token]);
  const [status, setStatus] = useState<ApprovalStatus>("loading");
  const [item, setItem] = useState<ApprovalItem | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [submitting, setSubmitting] = useState<"approve" | "reject" | null>(null);

  const candidateName = textOrNull(item?.candidate_name);
  const roleTitle = textOrNull(item?.role_title);
  const overallScore = scoreOrNull(item?.scores?.overall_score);
  const resumeScore = scoreOrNull(item?.scores?.resume_score);
  const interviewScore = scoreOrNull(item?.scores?.interview_score);
  const expiresAt = formatDateTime(item?.expires_at);
  const visibleScores = [
    { label: "Overall score", value: overallScore },
    { label: "Resume score", value: resumeScore },
    { label: "Interview score", value: interviewScore },
  ].filter((score): score is { label: string; value: number } => score.value !== null);

  useEffect(() => {
    let canceled = false;

    async function loadApproval() {
      setStatus("loading");
      setErrorMessage("");
      setItem(null);

      if (!token) {
        setStatus("unavailable");
        return;
      }
      if (!backendBase) {
        setErrorMessage("Review service is not configured. Please try again later.");
        setStatus("error");
        return;
      }

      try {
        const response = await fetch(
          joinUrl(backendBase, `/api/automation/approval/${encodeURIComponent(token)}`),
          {
            method: "GET",
            credentials: "omit",
          },
        );
        const data = parseJsonSafe(await response.text());
        if (canceled) return;

        if (!response.ok || !data?.ok || !data.item) {
          setStatus(classifyError(response.status, data));
          return;
        }

        setItem(data.item);
        setStatus("ready");
      } catch {
        if (canceled) return;
        setErrorMessage("Network error loading this review link. Please try again.");
        setStatus("error");
      }
    }

    void loadApproval();
    return () => {
      canceled = true;
    };
  }, [token]);

  async function submitDecision(decision: "approve" | "reject") {
    if (!token || !backendBase || submitting) return;
    setSubmitting(decision);
    setErrorMessage("");
    try {
      const suffix = decision === "approve" ? "confirm" : "reject";
      const response = await fetch(
        joinUrl(backendBase, `/api/automation/approval/${encodeURIComponent(token)}/${suffix}`),
        {
          method: "POST",
          credentials: "omit",
        },
      );
      const data = parseJsonSafe(await response.text());
      if (!response.ok || !data?.ok) {
        setStatus(classifyError(response.status, data));
        return;
      }
      setStatus(decision === "approve" ? "approved" : "rejected");
    } catch {
      setErrorMessage("Network error saving your response. Please try again.");
      setStatus("error");
    } finally {
      setSubmitting(null);
    }
  }

  return (
    <div className="min-h-screen bg-[#F8F9FD] flex flex-col" style={{ fontFamily: "'Raleway', sans-serif" }}>
      <header
        className="bg-white flex-shrink-0 flex items-center px-6 h-14"
        style={{ borderBottom: "1px solid rgba(10,21,71,0.07)" }}
      >
        <img src="/logo-dark-text.png" alt="alphaSource AI" className="h-8 w-auto" />
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-10 sm:py-12">
        <div
          className="bg-white rounded-2xl p-6 sm:p-8 w-full max-w-2xl"
          style={{
            border: "1px solid rgba(10,21,71,0.07)",
            boxShadow: "0 4px 24px rgba(10,21,71,0.08)",
          }}
        >
          {status === "loading" && (
            <StateCard
              icon={<Loader2 className="h-6 w-6 animate-spin" />}
              title="Loading review"
              body="Opening this candidate review link."
            />
          )}

          {status === "expired" && (
            <StateCard
              icon={<AlertTriangle className="h-6 w-6" />}
              title="This review link has expired"
              body="Ask your team for a new review link if this candidate still needs approval."
              tone="warning"
            />
          )}

          {status === "unavailable" && (
            <StateCard
              icon={<XCircle className="h-6 w-6" />}
              title="This review link is no longer available"
              body="The link may have already been used, rejected, revoked, or may be invalid."
              tone="warning"
            />
          )}

          {status === "error" && (
            <StateCard
              icon={<AlertTriangle className="h-6 w-6" />}
              title="Review is temporarily unavailable"
              body={errorMessage || "We could not load this review link. Please try again."}
              tone="warning"
            />
          )}

          {status === "approved" && (
            <StateCard
              icon={<CheckCircle2 className="h-6 w-6" />}
              title="Approved"
              body="Candidate approved. This older link does not send the scheduling email."
              tone="success"
            />
          )}

          {status === "rejected" && (
            <StateCard
              icon={<XCircle className="h-6 w-6" />}
              title="Not approved"
              body="Candidate not approved."
              tone="warning"
            />
          )}

          {status === "ready" && (
            <div>
              <div className="flex items-start gap-4">
                <div className="hidden sm:flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#A380F6]/10 text-[#A380F6]">
                  <ShieldCheck className="h-6 w-6" />
                </div>
                <div>
                  <h1 className="text-2xl sm:text-3xl font-black leading-tight text-[#0A1547]">
                    Review candidate
                  </h1>
                  <p className="mt-3 text-sm leading-relaxed text-[#0A1547]/65">
                    This is an older one-candidate review link. New approval emails now use a shared review page for all candidates.
                  </p>
                </div>
              </div>

              <section className="mt-7 grid gap-3 sm:grid-cols-2">
                {candidateName && <DetailRow label="Candidate" value={candidateName} />}
                {roleTitle && <DetailRow label="Role" value={roleTitle} />}
                {expiresAt && <DetailRow label="Review link expires" value={expiresAt} />}
              </section>

              {visibleScores.length > 0 && (
                <section className="mt-5 grid gap-3 sm:grid-cols-3">
                  {visibleScores.map((score) => (
                    <ScoreCard key={score.label} label={score.label} value={score.value} />
                  ))}
                </section>
              )}

              <div className="mt-6 rounded-2xl bg-[#F8F9FD] px-4 py-4 text-sm leading-relaxed text-[#0A1547]/68">
                <p>Scores help organize the review, but hiring decisions stay with your team.</p>
                <p className="mt-2 font-bold text-[#0A1547]">
                  Approving from this older link marks the candidate approved, but it does not send the scheduling email. If you expected to send the scheduling email, use the latest Review candidates link from your approval email.
                </p>
              </div>

              <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  className={secondaryButtonCls}
                  style={{ borderColor: "rgba(239,68,68,0.28)", color: "#B42318" }}
                  onClick={() => void submitDecision("reject")}
                  disabled={submitting !== null}
                >
                  {submitting === "reject" && <Loader2 className="h-4 w-4 animate-spin" />}
                  Do not approve
                </button>
                <button
                  type="button"
                  className={primaryButtonCls}
                  style={{ backgroundColor: "#A380F6" }}
                  onClick={() => void submitDecision("approve")}
                  disabled={submitting !== null}
                >
                  {submitting === "approve" && <Loader2 className="h-4 w-4 animate-spin" />}
                  Approve next step
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
