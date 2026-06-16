import { useEffect, useMemo, useState, type ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Loader2, Send, ShieldCheck, XCircle } from "lucide-react";

type DigestPageStatus = "loading" | "ready" | "expired" | "unavailable" | "empty" | "error";
type ItemAction = "approve" | "reject";

interface AutomationDigestApprovalPageProps {
  params?: {
    token?: string;
  };
}

interface DigestScores {
  overall_score?: unknown;
  resume_score?: unknown;
  interview_score?: unknown;
}

interface DigestReviewItem {
  item_id?: string | null;
  candidate_name?: string | null;
  role_title?: string | null;
  scores?: DigestScores | null;
  status?: string | null;
  can_approve_send?: boolean | null;
  can_reject?: boolean | null;
}

interface DigestResponse {
  ok?: boolean;
  item?: {
    expires_at?: string | null;
    items?: DigestReviewItem[] | null;
  } | DigestReviewItem | null;
  side_effects?: {
    emails_sent?: unknown;
  } | null;
  code?: string;
  error?: string;
  detail?: string;
}

interface ItemFeedback {
  submitting?: ItemAction | null;
  message?: string;
  error?: string;
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

function readDigestApprovalToken(params?: { token?: string }): string {
  const fromParams = String(params?.token || "").trim();
  if (fromParams) return fromParams;
  if (typeof window === "undefined") return "";
  try {
    const path = String(window.location.pathname || "");
    const pathMatch = path.match(/^\/automation\/digest-approval\/([^/?#]+)/);
    if (pathMatch?.[1]) return decodeURIComponent(pathMatch[1]).trim();
    return "";
  } catch {
    return "";
  }
}

function parseJsonSafe(text: string): DigestResponse {
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

function responseCode(data: DigestResponse): string {
  return String(data?.code || data?.error || "").trim();
}

function classifyDigestError(status: number, data: DigestResponse): Exclude<DigestPageStatus, "loading" | "ready" | "empty"> {
  const code = responseCode(data);
  if (status === 410 || code === "digest_approval_token_expired") return "expired";
  if (
    status === 404 ||
    code === "digest_approval_token_invalid" ||
    code === "digest_approval_unavailable"
  ) {
    return "unavailable";
  }
  return "error";
}

function itemErrorMessage(status: number, data: DigestResponse): string {
  const code = responseCode(data);
  if (code === "automation_digest_approval_action_already_sent") {
    return "This candidate has already been approved and sent.";
  }
  if (
    status === 404 ||
    code === "digest_approval_item_unavailable" ||
    code === "automation_digest_approval_action_unavailable"
  ) {
    return "This review item is no longer available.";
  }
  if (
    status === 409 ||
    code === "automation_digest_approval_action_in_progress" ||
    code === "automation_digest_approval_action_state_conflict"
  ) {
    return "This review item is already being handled.";
  }
  return "We could not save this response. Please try again.";
}

function isTokenLevelError(status: number, data: DigestResponse): boolean {
  const code = responseCode(data);
  return (
    status === 410 ||
    code === "digest_approval_token_expired" ||
    code === "digest_approval_token_invalid" ||
    code === "digest_approval_unavailable"
  );
}

function isDigestListPayload(item: DigestResponse["item"]): item is { expires_at?: string | null; items: DigestReviewItem[] } {
  return !!item && typeof item === "object" && Array.isArray((item as { items?: unknown }).items);
}

function isDigestReviewItem(value: unknown): value is DigestReviewItem {
  return !!value && typeof value === "object" && !!textOrNull((value as DigestReviewItem).item_id);
}

function digestItemsFromResponse(data: DigestResponse): DigestReviewItem[] {
  const item = data?.item;
  if (!isDigestListPayload(item)) return [];
  return item.items
    .filter(isDigestReviewItem)
    .map((entry) => ({
      ...entry,
      item_id: textOrNull(entry.item_id),
    }));
}

function actionItemFromResponse(data: DigestResponse): DigestReviewItem | null {
  const item = data?.item;
  if (!item || isDigestListPayload(item)) return null;
  const actionItem = item as DigestReviewItem;
  const itemId = textOrNull(actionItem.item_id);
  if (!itemId) return null;
  return {
    ...actionItem,
    item_id: itemId,
  };
}

function getExpiresAt(data: DigestResponse): string | null {
  const item = data?.item;
  if (!isDigestListPayload(item)) return null;
  return textOrNull(item.expires_at);
}

function statusLabel(status: unknown): string {
  const normalized = String(status || "").trim();
  if (normalized === "pending") return "Pending";
  if (normalized === "approved_or_sent" || normalized === "sent") return "Sent";
  if (normalized === "rejected") return "Not approved";
  if (normalized === "failed") return "Failed";
  return "Unavailable";
}

function statusClass(status: unknown): string {
  const normalized = String(status || "").trim();
  if (normalized === "pending") return "bg-amber-50 text-amber-700 ring-amber-200";
  if (normalized === "approved_or_sent" || normalized === "sent") return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  if (normalized === "rejected") return "bg-slate-100 text-slate-700 ring-slate-200";
  if (normalized === "failed") return "bg-red-50 text-red-700 ring-red-200";
  return "bg-[#F8F9FD] text-[#0A1547]/60 ring-[#0A1547]/10";
}

function visibleScores(item: DigestReviewItem): Array<{ label: string; value: number }> {
  const scores = [
    { label: "Overall score", value: scoreOrNull(item.scores?.overall_score) },
    { label: "Resume score", value: scoreOrNull(item.scores?.resume_score) },
    { label: "Interview score", value: scoreOrNull(item.scores?.interview_score) },
  ];
  return scores.filter((score): score is { label: string; value: number } => score.value !== null);
}

const backendBase = firstBase(
  env.VITE_BACKEND_URL,
  env.VITE_API_URL,
  env.VITE_PUBLIC_BACKEND_URL,
  env.PUBLIC_BACKEND_URL,
  env.BACKEND_URL,
);

const primaryButtonCls =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-black text-white transition-all hover:opacity-90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60";
const secondaryButtonCls =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-full border px-5 py-2.5 text-sm font-black transition-all hover:bg-red-50 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60";

function StateCard({
  icon,
  title,
  body,
  tone = "neutral",
}: {
  icon: ReactNode;
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
      <p className="mt-1 text-xl font-black text-[#0A1547]">{formatScore(value)}</p>
    </div>
  );
}

function CandidateCard({
  item,
  feedback,
  onApprove,
  onReject,
}: {
  item: DigestReviewItem;
  feedback?: ItemFeedback;
  onApprove: (item: DigestReviewItem) => void;
  onReject: (item: DigestReviewItem) => void;
}) {
  const candidateName = textOrNull(item.candidate_name) || "Candidate";
  const roleTitle = textOrNull(item.role_title);
  const scores = visibleScores(item);
  const submitting = feedback?.submitting || null;
  const canApprove = item.can_approve_send === true && String(item.status || "") === "pending";
  const canReject = item.can_reject === true && String(item.status || "") === "pending";
  const buttonsDisabled = submitting !== null;

  return (
    <article
      className="rounded-2xl bg-white p-5 sm:p-6"
      style={{
        border: "1px solid rgba(10,21,71,0.08)",
        boxShadow: "0 2px 14px rgba(10,21,71,0.05)",
      }}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-lg font-black leading-tight text-[#0A1547]">{candidateName}</h2>
          {roleTitle && <p className="mt-1 text-sm font-bold text-[#0A1547]/60">{roleTitle}</p>}
        </div>
        <span
          className={`inline-flex w-fit shrink-0 items-center rounded-full px-3 py-1 text-xs font-black ring-1 ${statusClass(item.status)}`}
        >
          {statusLabel(item.status)}
        </span>
      </div>

      {scores.length > 0 && (
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {scores.map((score) => (
            <ScoreCard key={score.label} label={score.label} value={score.value} />
          ))}
        </div>
      )}

      <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <button
          type="button"
          className={secondaryButtonCls}
          style={{ borderColor: "rgba(239,68,68,0.28)", color: "#B42318" }}
          onClick={() => onReject(item)}
          disabled={buttonsDisabled || !canReject}
        >
          {submitting === "reject" && <Loader2 className="h-4 w-4 animate-spin" />}
          Do not approve
        </button>
        <button
          type="button"
          className={primaryButtonCls}
          style={{ backgroundColor: "#A380F6" }}
          onClick={() => onApprove(item)}
          disabled={buttonsDisabled || !canApprove}
        >
          {submitting === "approve" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Approve and send scheduling email
        </button>
      </div>

      {(feedback?.message || feedback?.error) && (
        <p
          className={`mt-3 text-sm font-bold ${
            feedback.error ? "text-red-700" : "text-emerald-700"
          }`}
        >
          {feedback.error || feedback.message}
        </p>
      )}
    </article>
  );
}

export default function AutomationDigestApprovalPage({ params }: AutomationDigestApprovalPageProps) {
  const token = useMemo(() => readDigestApprovalToken(params), [params?.token]);
  const [status, setStatus] = useState<DigestPageStatus>("loading");
  const [items, setItems] = useState<DigestReviewItem[]>([]);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [itemFeedback, setItemFeedback] = useState<Record<string, ItemFeedback>>({});
  const formattedExpiresAt = formatDateTime(expiresAt);

  useEffect(() => {
    let canceled = false;

    async function loadDigestApproval() {
      setStatus("loading");
      setErrorMessage("");
      setItems([]);
      setItemFeedback({});
      setExpiresAt(null);

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
          joinUrl(backendBase, `/api/automation/digest-approval/${encodeURIComponent(token)}`),
          {
            method: "GET",
            credentials: "omit",
          },
        );
        const data = parseJsonSafe(await response.text());
        if (canceled) return;

        if (!response.ok || !data?.ok) {
          setStatus(classifyDigestError(response.status, data));
          return;
        }

        const nextItems = digestItemsFromResponse(data);
        if (nextItems.length === 0) {
          setStatus("empty");
          return;
        }

        setItems(nextItems);
        setExpiresAt(getExpiresAt(data));
        setStatus("ready");
      } catch {
        if (canceled) return;
        setErrorMessage("Network error loading this review link. Please try again.");
        setStatus("error");
      }
    }

    void loadDigestApproval();
    return () => {
      canceled = true;
    };
  }, [token]);

  function setFeedback(itemId: string, feedback: ItemFeedback) {
    setItemFeedback((current) => ({
      ...current,
      [itemId]: feedback,
    }));
  }

  function mergeUpdatedItem(update: DigestReviewItem) {
    const updateItemId = textOrNull(update.item_id);
    if (!updateItemId) return;
    setItems((current) =>
      current.map((item) =>
        item.item_id === updateItemId
          ? {
              ...item,
              status: update.status ?? item.status,
              can_approve_send: update.can_approve_send ?? item.can_approve_send,
              can_reject: update.can_reject ?? item.can_reject,
            }
          : item,
      ),
    );
  }

  async function submitItemDecision(item: DigestReviewItem, action: ItemAction) {
    const itemId = textOrNull(item.item_id);
    if (!itemId || !token || !backendBase) return;

    setFeedback(itemId, { submitting: action });
    try {
      const suffix = action === "approve" ? "approve-send" : "reject";
      const response = await fetch(
        joinUrl(
          backendBase,
          `/api/automation/digest-approval/${encodeURIComponent(token)}/items/${encodeURIComponent(itemId)}/${suffix}`,
        ),
        {
          method: "POST",
          credentials: "omit",
        },
      );
      const data = parseJsonSafe(await response.text());

      if (!response.ok || !data?.ok) {
        if (isTokenLevelError(response.status, data)) {
          setStatus(classifyDigestError(response.status, data));
          return;
        }
        setFeedback(itemId, { error: itemErrorMessage(response.status, data) });
        return;
      }

      const updatedItem = actionItemFromResponse(data);
      if (updatedItem) mergeUpdatedItem(updatedItem);
      const emailsSent = Number(data.side_effects?.emails_sent || 0);
      const nextStatus = String(updatedItem?.status || "").trim();
      const message =
        action === "approve"
          ? emailsSent === 0 && nextStatus === "sent"
            ? "Already sent."
            : "Scheduling email sent."
          : "Candidate not approved.";
      setFeedback(itemId, { message });
    } catch {
      setFeedback(itemId, { error: "Network error saving your response. Please try again." });
    }
  }

  return (
    <div className="min-h-screen bg-[#F8F9FD] flex flex-col" style={{ fontFamily: "'Raleway', sans-serif" }}>
      <header
        className="bg-white flex-shrink-0 flex items-center px-6 h-14"
        style={{ borderBottom: "1px solid rgba(10,21,71,0.07)" }}
      >
        <img src="/logo-dark-text.png" alt="AlphaSource AI" className="h-8 w-auto" />
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-10 sm:py-12">
        <div
          className="bg-white rounded-2xl p-6 sm:p-8 w-full max-w-4xl"
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
              body="Ask your team for a new review link if these candidates still need review."
              tone="warning"
            />
          )}

          {status === "unavailable" && (
            <StateCard
              icon={<XCircle className="h-6 w-6" />}
              title="This review link is no longer available"
              body="The link may have already been used, revoked, or may be invalid."
              tone="warning"
            />
          )}

          {status === "empty" && (
            <StateCard
              icon={<XCircle className="h-6 w-6" />}
              title="No candidates are available for review"
              body="There are no candidates available from this review link right now."
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

          {status === "ready" && (
            <div>
              <div className="flex items-start gap-4">
                <div className="hidden sm:flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#A380F6]/10 text-[#A380F6]">
                  <ShieldCheck className="h-6 w-6" />
                </div>
                <div>
                  <h1 className="text-2xl sm:text-3xl font-black leading-tight text-[#0A1547]">
                    Review candidates for next steps
                  </h1>
                  <p className="mt-3 text-sm leading-relaxed text-[#0A1547]/65">
                    These candidates matched your automation settings. Review each one and choose whether to send the second-round scheduling email.
                  </p>
                </div>
              </div>

              <div className="mt-6 rounded-2xl bg-[#F8F9FD] px-4 py-4 text-sm leading-relaxed text-[#0A1547]/68">
                <p className="font-bold text-[#0A1547]">
                  Approving a candidate sends the scheduling email to that candidate.
                </p>
                <p className="mt-2">
                  Scores help organize the review, but hiring decisions stay with your team.
                </p>
                {formattedExpiresAt && (
                  <p className="mt-2 text-xs font-bold uppercase tracking-widest text-[#0A1547]/45">
                    Review link expires {formattedExpiresAt}
                  </p>
                )}
              </div>

              <section className="mt-6 space-y-4" aria-label="Candidate review list">
                {items.map((item) => {
                  const itemId = textOrNull(item.item_id) || "";
                  return (
                    <CandidateCard
                      key={itemId}
                      item={item}
                      feedback={itemFeedback[itemId]}
                      onApprove={(selectedItem) => void submitItemDecision(selectedItem, "approve")}
                      onReject={(selectedItem) => void submitItemDecision(selectedItem, "reject")}
                    />
                  );
                })}
              </section>

              <div className="mt-6 flex items-center gap-2 rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <p>Only your choice for the selected candidate is saved when you use these buttons.</p>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
