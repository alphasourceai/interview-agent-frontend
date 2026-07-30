import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronUp, ChevronRight, RefreshCw, Trash2 } from "lucide-react";
import AdminLayout from "@/components/AdminLayout";
import InfoTooltip from "@/components/InfoTooltip";
import { useAdminClient } from "@/context/AdminClientContext";
import { buildEntityFilterOptions, defaultEntityFilterValue, entityFilterHelpText, entityFilterQueryValue, type EntityFilterValue } from "@/lib/entityFilters";
import { supabase } from "@/lib/supabaseClient";

/* ── Types ───────────────────────────────────────────────────── */
interface Candidate {
  id: string;
  name: string;
  email: string;
  clientId: string;
  clientName: string;
  entityName: string;
  roleId: string;
  role: string;
  created: string;
  createdTs: number;
  resume: number | null;
  interview: number | null;
  overall: number | null;
  status: string;
  reportDate: string;
  latestReportUrl: string | null;
  latestInterviewId?: string | null;
  recordingStatus?: string | null;
  recordingReadyAt?: string | null;
  insufficientInterview?: boolean;
  hasSubstantiveInterview?: boolean;
}

interface RecordingModalState {
  interviewId: string;
  candidateName: string;
  url: string;
  expiresIn?: number | null;
  recordingReadyAt?: string | null;
  duration?: number | null;
}

interface ResetModalState {
  candidate: Candidate;
  eligibility: RecoveryEligibility;
}

interface RecoveryEligibility {
  feature_enabled?: boolean;
  eligible: boolean;
  blockers: string[];
  detail: string | null;
  prior_interview?: {
    id: string;
    attempt_number?: number | null;
    status?: string | null;
    created_at?: string | null;
    duration_seconds?: number | null;
    transcript_present?: boolean;
    recording_present?: boolean;
    report_present?: boolean;
    complete_report_present?: boolean;
  } | null;
  replacement?: {
    authorization_id?: string | null;
    status?: string | null;
    start_status?: string | null;
    replacement_interview_id?: string | null;
    reset_mode?: string | null;
    email_status?: string | null;
    interview_status?: string | null;
    vendor_start_state?: string | null;
    vendor_reconciliation_status?: string | null;
    vendor_resolution_source?: string | null;
    manual_review_required?: boolean;
    total_exact_match_count?: number | null;
    stored_match_reference_count?: number | null;
    match_references_truncated?: boolean;
    scan_complete?: boolean;
    scan_status?: string | null;
    pages_requested?: number | null;
    pages_completed?: number | null;
    total_count_reported?: number | null;
    reconciliation_at?: string | null;
    binding_recovery_required?: boolean;
  } | null;
  adjudication?: {
    id?: string | null;
    decision?: string | null;
    actor_email?: string | null;
    created_at?: string | null;
    reason_code?: string | null;
    reason_detail?: string | null;
    resulting_eligibility?: string | null;
    audit_log_id?: string | null;
  } | null;
}

interface RecoveryLoadState {
  loading: boolean;
  data: RecoveryEligibility | null;
  error: string | null;
}

type SortKey = "name" | "client" | "entity" | "role" | "created" | "resume" | "interview" | "overall";
type SortDir = "asc" | "desc";

const env =
  typeof import.meta !== "undefined" && import.meta.env ? import.meta.env : {};

function trimTrailingSlashes(value: unknown): string {
  return String(value || "").trim().replace(/\/+$/, "");
}

function firstBase(...values: unknown[]): string {
  for (const value of values) {
    const normalized = trimTrailingSlashes(value);
    if (normalized) return normalized;
  }
  return "";
}

const backendBase = firstBase(
  (env as Record<string, unknown>).VITE_BACKEND_URL,
  (env as Record<string, unknown>).VITE_API_URL,
  (env as Record<string, unknown>).VITE_PUBLIC_BACKEND_URL,
  (env as Record<string, unknown>).PUBLIC_BACKEND_URL,
  (env as Record<string, unknown>).BACKEND_URL,
);

function parseJsonSafe(text: string): unknown {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function extractErrorMessage(text: string): string {
  if (!text) return "Failed to load candidates.";
  const data = parseJsonSafe(text);
  const detail =
    data && typeof data === "object"
      ? (data as { detail?: unknown }).detail ??
        (data as { message?: unknown }).message ??
        (data as { error?: unknown }).error
      : null;
  if (typeof detail === "string" && detail.trim()) return detail;
  return text;
}

function isUsableRecordingUrl(value: unknown): boolean {
  const url = String(value || "").trim();
  if (!/^https?:\/\//i.test(url)) return false;
  return !/(^https?:\/\/)?([a-z0-9-]+\.)?(tavus\.daily\.co|c\.daily\.co)(\/|\?|$)/i.test(url);
}

function toScore(value: unknown): number | null {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function parseRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  if (typeof value === "string" && value.trim()) {
    const parsed = parseJsonSafe(value);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed as Record<string, unknown>;
  }
  return null;
}

function hasInsufficientInterviewSignal(
  item: Record<string, unknown>,
  resumeScore: number | null,
  interviewScore: number | null,
  overallScore: number | null,
): boolean {
  const transcriptScores = parseRecord(item.transcript_scores);
  const interviewAnalysis = parseRecord(item.interview_analysis);
  const markerText = [
    item.interview_summary,
    item.analysis_summary,
    interviewAnalysis?.summary,
    transcriptScores?.ai_aided_risk_reason,
    item.status,
    item.interview_status,
  ]
    .map((value) => String(value || "").trim().toLowerCase())
    .filter(Boolean)
    .join(" ");
  if (
    markerText.includes("before any substantive responses were recorded") ||
    markerText.includes("before substantive responses were captured") ||
    markerText.includes("insufficient data") ||
    markerText.includes("no substantive interview response")
  ) {
    return true;
  }

  if (interviewScore !== 0 || resumeScore === null || overallScore === null) return false;
  const derivedFromZero = toScore((resumeScore + interviewScore) / 2);
  if (derivedFromZero === null || Math.abs(overallScore - derivedFromZero) > 1) return false;

  const transcriptText = String(item.transcript || "").trim();
  const transcriptWordCount = transcriptText ? transcriptText.split(/\s+/).filter(Boolean).length : 0;
  return transcriptWordCount <= 10;
}

function formatDateTime(value: unknown): { text: string; ts: number } {
  const raw = String(value || "").trim();
  if (!raw) return { text: "—", ts: 0 };
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return { text: "—", ts: 0 };
  return { text: parsed.toLocaleString(), ts: parsed.getTime() };
}

function formatRecordingDuration(value?: number | null): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "";
  const totalSeconds = Math.max(0, Math.round(value));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes > 0 ? `${minutes}m ${String(seconds).padStart(2, "0")}s` : `${seconds}s`;
}

function formatRecordingReadyAt(value?: string | null): string {
  const formatted = formatDateTime(value);
  return formatted.ts ? formatted.text : "";
}

function recoveryStartLabel(replacement?: RecoveryEligibility["replacement"]): string {
  if (!replacement) return "None";
  if (replacement.vendor_resolution_source === "list_exact_conversation_name") {
    return "One vendor conversation found — resolved";
  }
  if (replacement.start_status === "started") return "Started successfully";
  if (replacement.binding_recovery_required || replacement.start_status === "binding_recovery_required") {
    return "Provider succeeded; database binding requires recovery";
  }
  if (replacement.start_status === "manual_review") {
    if (replacement.scan_status === "incomplete_multi_page_unsupported") {
      return "Manual review required — the Tavus account contains more conversations than can be verified safely in one response";
    }
    if (replacement.vendor_reconciliation_status === "no_match_pending") return "No vendor conversation visible — manual review";
    if (replacement.vendor_reconciliation_status === "multiple_matches") return "Multiple vendor conversations found — manual review";
    return "Vendor lookup unavailable — manual review";
  }
  if (replacement.start_status === "reconciliation_required") return "Reconciliation required";
  if (replacement.start_status === "reconciling") return "Reconciliation in progress";
  if (replacement.start_status === "starting") return "Starting";
  if (replacement.start_status === "failed_retryable" || replacement.start_status === "failed_terminal") {
    return "Start failed definitively";
  }
  if (replacement.authorization_id && replacement.start_status === "not_started") {
    return "Authorized — waiting for candidate";
  }
  return replacement.status || "Unknown";
}

function canRunProtectedReconciliation(replacement?: RecoveryEligibility["replacement"]): boolean {
  return replacement?.start_status === "reconciliation_required"
    || replacement?.start_status === "binding_recovery_required"
    || replacement?.binding_recovery_required === true;
}

/* ── Score helpers ───────────────────────────────────────────── */
function scoreColor(s: number | null) {
  if (s === null) return "var(--as-text-subtle)";
  if (s >= 75) return "#02D99D";
  if (s >= 60) return "#F0A500";
  return "#FF6B6B";
}

function ScoreCell({ score }: { score: number | null }) {
  if (score === null) return <span className="text-sm font-semibold" style={subtleTextStyle}>—</span>;
  return <span className="text-sm font-black" style={{ color: scoreColor(score) }}>{score}%</span>;
}

const surfaceCardStyle = {
  backgroundColor: "var(--as-surface)",
  border: "1px solid var(--as-border)",
  boxShadow: "var(--as-shadow)",
};
const modalSurfaceStyle = {
  backgroundColor: "var(--as-surface)",
  border: "1px solid var(--as-border)",
  boxShadow: "0 20px 44px rgba(10,21,71,0.24)",
};
const dividerStyle = { borderColor: "var(--as-border)" };
const primaryTextStyle = { color: "var(--as-text)" };
const mutedTextStyle = { color: "var(--as-text-muted)" };
const subtleTextStyle = { color: "var(--as-text-subtle)" };
const fieldSurfaceStyle = {
  backgroundColor: "var(--as-surface)",
  borderColor: "var(--as-border)",
  color: "var(--as-text)",
};

const selectCls =
  "px-3 py-2 rounded-xl text-sm font-medium border appearance-none " +
  "placeholder:text-[var(--as-text-subtle)] " +
  "focus:outline-none focus:border-[#A380F6] transition-colors cursor-pointer";

export default function AdminCandidatesPage() {
  const {
    selectedClient,
    selectedClientId,
    clients: adminClients,
    loading: adminClientsLoading,
    error: adminClientsError,
  } = useAdminClient();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [sortKey, setSortKey]       = useState<SortKey>("created");
  const [sortDir, setSortDir]       = useState<SortDir>("desc");
  const [roleFilter, setRoleFilter] = useState("all");
  const [entityFilter, setEntityFilter] = useState<EntityFilterValue>("parent");
  const [candidateSearch, setCandidateSearch] = useState("");
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [candidatesLoading, setCandidatesLoading] = useState<boolean>(false);
  const [candidatesError, setCandidatesError] = useState<string>("");
  const [emptyMessage, setEmptyMessage] = useState<string>("No candidates found.");
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [actionNotice, setActionNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [resumeBusy, setResumeBusy] = useState<Record<string, boolean>>({});
  const [reportBusy, setReportBusy] = useState<Record<string, boolean>>({});
  const [recordingBusy, setRecordingBusy] = useState<Record<string, boolean>>({});
  const [deleteBusy, setDeleteBusy] = useState<Record<string, boolean>>({});
  const [recordingModal, setRecordingModal] = useState<RecordingModalState | null>(null);
  const [resetModal, setResetModal] = useState<ResetModalState | null>(null);
  const [resetReason, setResetReason] = useState("candidate_network_disconnect");
  const [resetDetail, setResetDetail] = useState("");
  const [coverageAttested, setCoverageAttested] = useState(false);
  const [clientApprovalAcknowledged, setClientApprovalAcknowledged] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);
  const [recoveryCoreEnabled, setRecoveryCoreEnabled] = useState(false);
  const [recoveryCoreEmailEnabled, setRecoveryCoreEmailEnabled] = useState(false);
  const [recoveryByCandidate, setRecoveryByCandidate] = useState<Record<string, RecoveryLoadState>>({});
  const [reconciliationBusy, setReconciliationBusy] = useState<Record<string, boolean>>({});
  const hierarchyClients = useMemo(
    () => adminClients.filter((client) => client.id !== "all"),
    [adminClients],
  );
  const entityOptions = useMemo(
    () => buildEntityFilterOptions(hierarchyClients, selectedClientId, { useParentNameLabel: true }),
    [hierarchyClients, selectedClientId],
  );
  const entityHelpText = useMemo(() => entityFilterHelpText(entityOptions), [entityOptions]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  };

  useEffect(() => {
    if (!actionNotice) return;
    const timer = setTimeout(() => setActionNotice(null), 3200);
    return () => clearTimeout(timer);
  }, [actionNotice]);

  useEffect(() => {
    setCandidateSearch("");
  }, [selectedClientId, roleFilter, entityFilter]);

  useEffect(() => {
    setEntityFilter(defaultEntityFilterValue(hierarchyClients, selectedClientId));
  }, [hierarchyClients, selectedClientId]);

  const getSessionToken = async (): Promise<string> => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const token = String(session?.access_token || "").trim();
    if (!token) throw new Error("Missing session token.");
    return token;
  };

  const loadRecoveryEligibility = async (candidate: Candidate): Promise<RecoveryEligibility | null> => {
    if (!backendBase || !candidate.roleId || !candidate.clientId) {
      return null;
    }
    setRecoveryByCandidate((current) => ({
      ...current,
      [candidate.id]: { loading: true, data: current[candidate.id]?.data || null, error: null },
    }));
    try {
      const token = await getSessionToken();
      const params = new URLSearchParams({ client_id: candidate.clientId, role_id: candidate.roleId });
      const response = await fetch(`${backendBase}/admin/interview-recovery/${encodeURIComponent(candidate.id)}/eligibility?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
        credentials: "omit",
      });
      const text = await response.text();
      if (!response.ok) throw new Error(extractErrorMessage(text));
      const payload = parseJsonSafe(text) as RecoveryEligibility | null;
      if (!payload) throw new Error("Could not review recovery eligibility.");
      const normalized: RecoveryEligibility = {
        ...payload,
        eligible: payload.eligible === true,
        blockers: Array.isArray(payload.blockers) ? payload.blockers : [],
        detail: typeof payload.detail === "string" ? payload.detail : null,
      };
      setRecoveryByCandidate((current) => ({
        ...current,
        [candidate.id]: { loading: false, data: normalized, error: null },
      }));
      return normalized;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not review recovery eligibility.";
      setRecoveryByCandidate((current) => ({
        ...current,
        [candidate.id]: { loading: false, data: null, error: message },
      }));
      return null;
    }
  };

  const toggle = (candidate: Candidate) => {
    const opening = expandedId !== candidate.id;
    setExpandedId(opening ? candidate.id : null);
    if (opening && recoveryCoreEnabled && !recoveryByCandidate[candidate.id]?.data) {
      void loadRecoveryEligibility(candidate);
    }
  };

  const openResetModal = async (candidate: Candidate) => {
    if (!recoveryCoreEnabled) return;
    const eligibility = recoveryByCandidate[candidate.id]?.data || await loadRecoveryEligibility(candidate);
    if (!eligibility) {
      setActionNotice({ tone: "error", text: "Candidate recovery information is unavailable." });
      return;
    }
    setResetReason("candidate_network_disconnect");
    setResetDetail("");
    setCoverageAttested(false);
    setClientApprovalAcknowledged(false);
    setResetModal({ candidate, eligibility });
  };

  const submitReset = async (mode: "reset_only" | "reset_and_send") => {
    if (!resetModal || !resetModal.eligibility.eligible || resetBusy) return;
    if (resetReason === "other" && !resetDetail.trim()) {
      setActionNotice({ tone: "error", text: "Provide a brief explanation when selecting Other." });
      return;
    }
    if (!coverageAttested || !clientApprovalAcknowledged) {
      setActionNotice({ tone: "error", text: "Complete both recovery confirmations." });
      return;
    }
    setResetBusy(true);
    try {
      const candidate = resetModal.candidate;
      const token = await getSessionToken();
      const idempotencyKey = typeof crypto?.randomUUID === "function" ? crypto.randomUUID() : `${Date.now()}-${candidate.id}`;
      const priorInterviewId = String(resetModal.eligibility.prior_interview?.id || "").trim();
      if (!priorInterviewId) throw new Error("The prior interview identity is unavailable.");
      const response = await fetch(`${backendBase}/admin/interview-recovery/${encodeURIComponent(candidate.id)}/authorize`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        credentials: "omit",
        body: JSON.stringify({
          client_id: candidate.clientId,
          role_id: candidate.roleId,
          prior_interview_id: priorInterviewId,
          decision: "authorize_one_video_replacement",
          reason_code: resetReason,
          reason_detail: resetDetail.trim(),
          mode,
          required_coverage_attested: coverageAttested,
          client_approval_acknowledged: clientApprovalAcknowledged,
          idempotency_key: idempotencyKey,
        }),
      });
      const text = await response.text();
      if (!response.ok) throw new Error(extractErrorMessage(text));
      setResetModal(null);
      setRecoveryByCandidate((current) => ({ ...current, [candidate.id]: { loading: false, data: null, error: null } }));
      setActionNotice({ tone: "success", text: "One replacement video interview has been authorized." });
      setRefreshNonce((value) => value + 1);
    } catch (error) {
      setActionNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "Could not reset interview access.",
      });
    } finally {
      setResetBusy(false);
    }
  };

  const runProtectedReconciliation = async (candidate: Candidate, eligibility: RecoveryEligibility) => {
    const replacement = eligibility.replacement;
    const interviewId = replacement?.replacement_interview_id;
    const authorizationId = replacement?.authorization_id;
    if (!interviewId || !authorizationId || reconciliationBusy[candidate.id]) return;
    setReconciliationBusy((current) => ({ ...current, [candidate.id]: true }));
    try {
      const token = await getSessionToken();
      const response = await fetch(`${backendBase}/admin/interview-recovery/${encodeURIComponent(candidate.id)}/reconcile-vendor-start`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        credentials: "omit",
        body: JSON.stringify({
          client_id: candidate.clientId,
          role_id: candidate.roleId,
          interview_id: interviewId,
          authorization_id: authorizationId,
        }),
      });
      const text = await response.text();
      if (!response.ok) throw new Error(extractErrorMessage(text));
      const payload = parseJsonSafe(text) as { status?: unknown } | null;
      const status = typeof payload?.status === "string" ? payload.status : "vendor_reconciliation_manual_review";
      setActionNotice({
        tone: status === "started" ? "success" : "error",
        text: status === "started"
          ? "The existing vendor conversation is now linked to the replacement attempt."
          : "Manual review is required. No additional vendor conversation will be created automatically.",
      });
      await loadRecoveryEligibility(candidate);
    } catch (error) {
      setActionNotice({ tone: "error", text: error instanceof Error ? error.message : "Could not complete the protected reconciliation action." });
    } finally {
      setReconciliationBusy((current) => ({ ...current, [candidate.id]: false }));
    }
  };

  const openCandidateResume = async (candidate: Candidate) => {
    const candidateId = candidate.id;
    if (!candidateId || resumeBusy[candidateId]) return;
    if (!backendBase) {
      setActionNotice({ tone: "error", text: "Missing backend base URL configuration." });
      return;
    }
    setActionNotice(null);
    setResumeBusy((prev) => ({ ...prev, [candidateId]: true }));
    try {
      const token = await getSessionToken();
      const response = await fetch(
        `${backendBase}/files/resume-signed-url?candidate_id=${encodeURIComponent(candidateId)}`,
        {
          method: "GET",
          headers: { Authorization: `Bearer ${token}` },
          credentials: "omit",
        },
      );
      const text = await response.text();
      if (!response.ok) throw new Error(extractErrorMessage(text));
      const payload = parseJsonSafe(text) as { url?: unknown } | null;
      const url = String(payload?.url || "").trim();
      if (!url) throw new Error("Could not open resume.");
      window.open(url, "_blank", "noopener,noreferrer");
      setActionNotice({ tone: "success", text: "Resume opened." });
    } catch (error) {
      setActionNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "Could not open resume.",
      });
    } finally {
      setResumeBusy((prev) => ({ ...prev, [candidateId]: false }));
    }
  };

  const openCandidateReport = async (candidate: Candidate) => {
    const candidateId = candidate.id;
    if (!candidateId || reportBusy[candidateId]) return;
    if (!selectedClientId || selectedClientId === "all") {
      setActionNotice({ tone: "error", text: "Select a client to perform this action." });
      return;
    }
    if (!backendBase) {
      setActionNotice({ tone: "error", text: "Missing backend base URL configuration." });
      return;
    }
    setActionNotice(null);
    setReportBusy((prev) => ({ ...prev, [candidateId]: true }));
    try {
      const token = await getSessionToken();
      const response = await fetch(`${backendBase}/admin/reports/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        credentials: "omit",
        body: JSON.stringify({
          client_id: selectedClientId,
          candidate_id: candidateId,
          role_id: candidate.roleId || null,
          interview_id: candidate.latestInterviewId || null,
        }),
      });
      const text = await response.text();
      if (!response.ok) throw new Error(extractErrorMessage(text));
      const payload = parseJsonSafe(text) as
        | {
            signed_url?: unknown;
            url?: unknown;
            report_url?: unknown;
            latest_report_url?: unknown;
            item?: {
              signed_url?: unknown;
              url?: unknown;
              report_url?: unknown;
              latest_report_url?: unknown;
            };
          }
        | null;
      const url =
        String(payload?.signed_url || "").trim() ||
        String(payload?.url || "").trim() ||
        String(payload?.report_url || "").trim() ||
        String(payload?.latest_report_url || "").trim() ||
        String(payload?.item?.signed_url || "").trim() ||
        String(payload?.item?.url || "").trim() ||
        String(payload?.item?.report_url || "").trim() ||
        String(payload?.item?.latest_report_url || "").trim() ||
        String(candidate.latestReportUrl || "").trim();
      if (!url) throw new Error("Could not open report.");
      window.open(url, "_blank", "noopener,noreferrer");
      setActionNotice({ tone: "success", text: "Report opened." });
      setRefreshNonce((value) => value + 1);
    } catch (error) {
      setActionNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "Could not open report.",
      });
    } finally {
      setReportBusy((prev) => ({ ...prev, [candidateId]: false }));
    }
  };

  const openCandidateRecording = async (candidate: Candidate) => {
    const candidateId = candidate.id;
    const interviewId = String(candidate.latestInterviewId || "").trim();
    if (!candidateId || recordingBusy[candidateId]) return;
    if (!interviewId) {
      setActionNotice({ tone: "error", text: "Recording is not available yet." });
      return;
    }
    if (!backendBase) {
      setActionNotice({ tone: "error", text: "Missing backend base URL configuration." });
      return;
    }
    setActionNotice(null);
    setRecordingBusy((prev) => ({ ...prev, [candidateId]: true }));
    try {
      const token = await getSessionToken();
      const response = await fetch(
        `${backendBase}/dashboard/interviews/${encodeURIComponent(interviewId)}/recording-url`,
        {
          method: "GET",
          headers: { Authorization: `Bearer ${token}` },
          credentials: "omit",
        },
      );
      const text = await response.text();
      if (!response.ok) {
        if (response.status === 404 || response.status === 409) {
          throw new Error("Recording is not available yet.");
        }
        if (response.status === 401 || response.status === 403) {
          throw new Error("You do not have access to this recording.");
        }
        throw new Error(extractErrorMessage(text) || "Could not open recording.");
      }
      const payload = parseJsonSafe(text) as {
        url?: unknown;
        expires_in?: unknown;
        recording_ready_at?: unknown;
        duration?: unknown;
      } | null;
      const url = String(payload?.url || "").trim();
      if (!isUsableRecordingUrl(url)) throw new Error("Recording is not available yet.");
      const expiresIn = Number(payload?.expires_in);
      const duration = Number(payload?.duration);
      const recordingReadyAt =
        typeof payload?.recording_ready_at === "string" && payload.recording_ready_at.trim()
          ? payload.recording_ready_at.trim()
          : candidate.recordingReadyAt || null;
      setRecordingModal({
        interviewId,
        candidateName: String(candidate.name || "").trim() || "Candidate",
        url,
        expiresIn: Number.isFinite(expiresIn) ? expiresIn : null,
        recordingReadyAt,
        duration: Number.isFinite(duration) ? duration : null,
      });
    } catch (error) {
      setActionNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "Could not open recording.",
      });
    } finally {
      setRecordingBusy((prev) => ({ ...prev, [candidateId]: false }));
    }
  };

  const downloadRecordingFromModal = async () => {
    if (!recordingModal?.interviewId) return;
    try {
      if (!backendBase) throw new Error("Missing backend base URL configuration.");
      const token = await getSessionToken();
      const response = await fetch(
        `${backendBase}/dashboard/interviews/${encodeURIComponent(recordingModal.interviewId)}/recording-url?download=1`,
        {
          method: "GET",
          headers: { Authorization: `Bearer ${token}` },
          credentials: "omit",
        },
      );
      const text = await response.text();
      if (!response.ok) {
        if (response.status === 404 || response.status === 409) {
          throw new Error("Recording is not available yet.");
        }
        if (response.status === 401 || response.status === 403) {
          throw new Error("You do not have access to this recording.");
        }
        throw new Error(extractErrorMessage(text) || "Could not download recording.");
      }
      const payload = parseJsonSafe(text) as { url?: unknown } | null;
      const url = String(payload?.url || "").trim();
      if (!isUsableRecordingUrl(url)) throw new Error("Recording is not available yet.");
      const opened = window.open(url, "_blank", "noopener,noreferrer");
      if (!opened) window.location.href = url;
    } catch (error) {
      setRecordingModal(null);
      setActionNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "Could not download recording.",
      });
    }
  };

  const deleteCandidate = async (candidate: Candidate) => {
    const candidateId = candidate.id;
    if (!candidateId || deleteBusy[candidateId]) return;
    if (!selectedClientId || selectedClientId === "all") {
      setActionNotice({ tone: "error", text: "Select a client to perform this action." });
      return;
    }
    if (!window.confirm("Delete this candidate? This cannot be undone.")) return;
    if (!backendBase) {
      setActionNotice({ tone: "error", text: "Missing backend base URL configuration." });
      return;
    }
    setActionNotice(null);
    setDeleteBusy((prev) => ({ ...prev, [candidateId]: true }));
    try {
      const token = await getSessionToken();
      const response = await fetch(
        `${backendBase}/admin/candidates/${encodeURIComponent(candidateId)}?client_id=${encodeURIComponent(selectedClientId)}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
          credentials: "omit",
        },
      );
      const text = await response.text();
      if (!response.ok) throw new Error(extractErrorMessage(text));
      setActionNotice({ tone: "success", text: "Candidate deleted." });
      setRefreshNonce((value) => value + 1);
    } catch (error) {
      setActionNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "Could not delete candidate.",
      });
    } finally {
      setDeleteBusy((prev) => ({ ...prev, [candidateId]: false }));
    }
  };

  useEffect(() => {
    let alive = true;

    const loadCandidates = async () => {
      if (adminClientsLoading) return;
      if (adminClientsError) {
        if (!alive) return;
        setCandidates([]);
        setCandidatesError(adminClientsError);
        setEmptyMessage("No candidates found.");
        setCandidatesLoading(false);
        return;
      }
      if (!backendBase) {
        if (!alive) return;
        setCandidates([]);
        setCandidatesError("Missing backend base URL configuration.");
        setEmptyMessage("No candidates found.");
        setCandidatesLoading(false);
        return;
      }
      if (!selectedClientId || selectedClientId === "all") {
        if (!alive) return;
        setCandidates([]);
        setCandidatesError("");
        setEmptyMessage("Select a client to view candidates.");
        setCandidatesLoading(false);
        return;
      }

      if (!alive) return;
      setCandidatesLoading(true);
      setCandidatesError("");
      setEmptyMessage("No candidates found.");

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const token = String(session?.access_token || "").trim();
        if (!token) throw new Error("Missing session token.");

        const params = new URLSearchParams({ client_id: selectedClientId });
        if (entityOptions.length > 0) params.set("entity_filter", entityFilterQueryValue(entityFilter));
        const roleParams = new URLSearchParams({ client_id: selectedClientId });
        if (entityOptions.length > 0) roleParams.set("entity_filter", entityFilterQueryValue(entityFilter));

        const [candidatesResponse, rolesResponse] = await Promise.all([
          fetch(`${backendBase}/admin/candidates?${params.toString()}`, {
            method: "GET",
            headers: { Authorization: `Bearer ${token}` },
            credentials: "omit",
          }),
          fetch(`${backendBase}/admin/roles?${roleParams.toString()}`, {
            method: "GET",
            headers: { Authorization: `Bearer ${token}` },
            credentials: "omit",
          }).catch(() => null),
        ]);

        const candidatesText = await candidatesResponse.text();
        if (!candidatesResponse.ok) throw new Error(extractErrorMessage(candidatesText));
        const candidatesPayload = parseJsonSafe(candidatesText);
        const featurePayload = candidatesPayload && typeof candidatesPayload === "object"
          ? (candidatesPayload as { features?: { interview_recovery_core?: unknown; interview_recovery_core_email?: unknown } }).features
          : null;
        const recoveryEnabled = featurePayload?.interview_recovery_core === true;
        setRecoveryCoreEnabled(recoveryEnabled);
        setRecoveryCoreEmailEnabled(featurePayload?.interview_recovery_core_email === true);
        if (!recoveryEnabled) {
          setRecoveryByCandidate({});
          setResetModal(null);
        }
        const candidateItems =
          candidatesPayload &&
          typeof candidatesPayload === "object" &&
          Array.isArray((candidatesPayload as { candidates?: unknown }).candidates)
            ? ((candidatesPayload as { candidates: unknown[] }).candidates || [])
            : [];

        const roleTitleById: Record<string, string> = {};
        if (rolesResponse) {
          const rolesText = await rolesResponse.text();
          if (rolesResponse.ok) {
            const rolesPayload = parseJsonSafe(rolesText);
            const roleItems =
              rolesPayload &&
              typeof rolesPayload === "object" &&
              Array.isArray((rolesPayload as { items?: unknown }).items)
                ? ((rolesPayload as { items: unknown[] }).items || [])
                : [];
            for (const item of roleItems) {
              if (!item || typeof item !== "object") continue;
              const roleId = String((item as { id?: unknown }).id || "").trim();
              if (!roleId) continue;
              const roleTitle = String((item as { title?: unknown }).title || "").trim();
              roleTitleById[roleId] = roleTitle || "—";
            }
          }
        }

        const mappedCandidates: Candidate[] = candidateItems
          .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"))
          .map((item) => {
            const created = formatDateTime(item.created_at);
            const reportGenerated = formatDateTime(item.report_generated_at);
            const roleId = String(item.role_id || "").trim();
            const roleTitle = String(roleTitleById[roleId] || "").trim();
            const resumeScore = toScore(item.resume_score);
            const rawInterviewScore = toScore(item.interview_score);
            const rawOverallScore = toScore(item.overall_score);
            const insufficientInterview = hasInsufficientInterviewSignal(item, resumeScore, rawInterviewScore, rawOverallScore);
            const interviewScore = insufficientInterview ? null : rawInterviewScore;
            const overallScore = insufficientInterview ? null : rawOverallScore;
            const statusRaw = String(item.status || item.interview_status || "").trim();
            const normalizedStatus =
              statusRaw ||
              (interviewScore !== null ? "Interview Complete" : "Resume Uploaded");
            const hasSubstantiveInterview =
              !insufficientInterview &&
              (interviewScore !== null || normalizedStatus.toLowerCase().includes("interview complete"));
            return {
              id: String(item.id || "").trim(),
              name: String(item.name || "").trim() || "—",
              email: String(item.email || "").trim() || "—",
              clientId: String(item.client_id || selectedClientId).trim(),
              clientName: String(item.entity_name || selectedClient.name || "").trim() || "—",
              entityName: String(item.entity_name || selectedClient.name || "").trim() || "—",
              role: roleTitle || roleId || "—",
              roleId,
              created: created.text,
              createdTs: created.ts,
              resume: resumeScore,
              interview: interviewScore,
              overall: overallScore,
              status: normalizedStatus,
              reportDate: reportGenerated.text,
              latestReportUrl: String(item.latest_report_url || "").trim() || null,
              latestInterviewId: String(item.latest_interview_id || "").trim() || null,
              recordingStatus: String(item.recording_status || "").trim() || null,
              recordingReadyAt: String(item.recording_ready_at || "").trim() || null,
              insufficientInterview,
              hasSubstantiveInterview,
            };
          })
          .filter((item) => Boolean(item.id));

        if (!alive) return;
        setCandidates(mappedCandidates);
        setExpandedId((current) => (current && mappedCandidates.some((candidate) => candidate.id === current) ? current : null));
      } catch (error) {
        if (!alive) return;
        setCandidates([]);
        setExpandedId(null);
        setCandidatesError(error instanceof Error ? error.message : "Failed to load candidates.");
      } finally {
        if (alive) setCandidatesLoading(false);
      }
    };

    void loadCandidates();
    return () => {
      alive = false;
    };
  }, [selectedClientId, selectedClient.name, adminClientsLoading, adminClientsError, entityFilter, entityOptions.length, refreshNonce]);

  useEffect(() => {
    if (roleFilter === "all") return;
    if (candidates.some((candidate) => candidate.role === roleFilter)) return;
    setRoleFilter("all");
  }, [roleFilter, candidates]);

  /* Filter by selected client */
  const byClient = candidates;

  /* Unique roles for the dropdown */
  const uniqueRoles = Array.from(new Set(byClient.map((c) => c.role))).sort();

  /* Filter by role */
  const byRole = roleFilter === "all"
    ? byClient
    : byClient.filter((c) => c.role === roleFilter);

  const candidateSearchTerm = candidateSearch.trim().toLowerCase();
  const filteredCandidates = candidateSearchTerm
    ? byRole.filter((candidate) =>
        [
          candidate.name,
          candidate.email,
          candidate.entityName,
        ].some((value) => String(value || "").toLowerCase().includes(candidateSearchTerm)),
      )
    : byRole;

  /* Sort */
  const sorted = [...filteredCandidates].sort((a, b) => {
    let av: string | number = 0;
    let bv: string | number = 0;
    switch (sortKey) {
      case "name":      av = a.name.toLowerCase();     bv = b.name.toLowerCase();     break;
      case "client":    av = a.clientName.toLowerCase();bv = b.clientName.toLowerCase();break;
      case "entity":    av = a.entityName.toLowerCase();bv = b.entityName.toLowerCase();break;
      case "role":      av = a.role.toLowerCase();     bv = b.role.toLowerCase();     break;
      case "created":   av = a.createdTs;              bv = b.createdTs;              break;
      case "resume":    av = a.resume    ?? -1;        bv = b.resume    ?? -1;        break;
      case "interview": av = a.interview ?? -1;        bv = b.interview ?? -1;        break;
      case "overall":   av = a.overall   ?? -1;        bv = b.overall   ?? -1;        break;
    }
    if (av < bv) return sortDir === "asc" ? -1 : 1;
    if (av > bv) return sortDir === "asc" ? 1  : -1;
    return 0;
  });

  const recordingDurationText = recordingModal ? formatRecordingDuration(recordingModal.duration) : "";
  const recordingReadyAtText = recordingModal ? formatRecordingReadyAt(recordingModal.recordingReadyAt) : "";
  const recordingMeta = recordingModal
    ? [
        recordingDurationText ? `Duration ${recordingDurationText}` : "",
        recordingReadyAtText ? `Ready ${recordingReadyAtText}` : "",
        typeof recordingModal.expiresIn === "number" && Number.isFinite(recordingModal.expiresIn)
          ? `Link expires in ${Math.round(recordingModal.expiresIn)}s`
          : "",
      ].filter(Boolean).join(" · ")
    : "";

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <ChevronDown className="w-3 h-3 ml-0.5 flex-shrink-0" style={subtleTextStyle} />;
    return sortDir === "asc"
      ? <ChevronUp   className="w-3 h-3 text-[#A380F6] ml-0.5 flex-shrink-0" />
      : <ChevronDown className="w-3 h-3 text-[#A380F6] ml-0.5 flex-shrink-0" />;
  }

  /* Show client column only when "All Clients" selected */
  const showClient = selectedClient.id === "all";

  return (
    <AdminLayout title="Candidates">

      {/* ── Page header ──────────────────────────────────── */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-black" style={primaryTextStyle}>Candidates</h2>
      </div>
      {actionNotice && (
        <div
          className="mb-4 px-4 py-2.5 rounded-xl text-sm font-semibold"
          style={{
            border: actionNotice.tone === "error" ? "1px solid rgba(239,68,68,0.25)" : "1px solid rgba(2,217,157,0.25)",
            backgroundColor: actionNotice.tone === "error" ? "rgba(239,68,68,0.08)" : "rgba(2,217,157,0.10)",
            color: actionNotice.tone === "error" ? "#DC2626" : "#047857",
          }}
        >
          {actionNotice.text}
        </div>
      )}

      {/* ── Filter bar ────────────────────────────────────── */}
      <div
        className="rounded-2xl px-5 py-3.5 mb-5 flex flex-wrap items-center gap-3"
        style={surfaceCardStyle}
      >
        {entityOptions.length > 0 && (
          <div className="flex flex-1 min-w-64 max-w-[22rem] items-center gap-2">
            <div className="flex flex-shrink-0 items-center gap-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest" style={mutedTextStyle}>Entity</label>
              <InfoTooltip content={entityHelpText} side="bottom" iconClassName="w-3 h-3 text-[#0A1547]/35 dark:text-white/45" />
            </div>
            <div className="relative flex-1 min-w-0">
              <select
                className={selectCls + " w-full pr-8"}
                style={fieldSurfaceStyle}
                value={entityFilter}
                onChange={(e) => {
                  setEntityFilter(e.target.value);
                  setExpandedId(null);
                }}
              >
                {entityOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none" style={subtleTextStyle} />
            </div>
          </div>
        )}

        <div className="relative flex-1 min-w-48 max-w-72">
          <select
            className={selectCls + " w-full pr-8"}
            style={fieldSurfaceStyle}
            value={roleFilter}
            onChange={(e) => { setRoleFilter(e.target.value); setExpandedId(null); }}
          >
            <option value="all">All roles</option>
            {uniqueRoles.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none" style={subtleTextStyle} />
        </div>

        <input
          className={selectCls + " flex-1 min-w-48 max-w-sm cursor-text"}
          style={fieldSurfaceStyle}
          placeholder="Search candidate name or email..."
          value={candidateSearch}
          onChange={(e) => setCandidateSearch(e.target.value)}
        />
        {candidateSearch && (
          <button
            type="button"
            className="px-3 py-2 rounded-full text-xs font-bold transition-colors hover:bg-[var(--as-hover)]"
            style={{ backgroundColor: "var(--as-surface-muted)", color: "var(--as-text-muted)" }}
            onClick={() => setCandidateSearch("")}
          >
            Clear
          </button>
        )}

        <button
          className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold text-white transition-opacity hover:opacity-90"
          style={{ backgroundColor: "#A380F6" }}
          onClick={() => setRefreshNonce((value) => value + 1)}
          disabled={candidatesLoading || !selectedClientId || selectedClientId === "all"}
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </button>

        <p className="text-xs font-semibold ml-auto" style={subtleTextStyle}>
          {sorted.length} of {byRole.length} candidate{byRole.length !== 1 ? "s" : ""}
        </p>
      </div>

      {/* ── Candidates table ──────────────────────────────── */}
      <div
        className="rounded-2xl overflow-hidden"
        style={surfaceCardStyle}
      >
        {/* Header */}
        <div
          className={`grid items-center px-5 py-3 border-b ${
            showClient
              ? "grid-cols-[1fr_110px_130px_130px_140px_68px_78px_68px_100px_44px]"
              : "grid-cols-[1fr_130px_130px_140px_68px_78px_68px_100px_44px]"
          }`}
          style={dividerStyle}
        >
          {(["name","client","entity","role","created","resume","interview","overall"] as SortKey[])
            .filter((k) => k !== "client" || showClient)
            .map((col) => (
              <button
                key={col}
                className="flex items-center text-[10px] font-black uppercase tracking-widest hover:text-[var(--as-text)] transition-colors text-left"
                style={mutedTextStyle}
                onClick={() => handleSort(col)}
              >
                {col === "interview" ? "Interview" : col.charAt(0).toUpperCase() + col.slice(1)}
                <SortIcon col={col} />
              </button>
            ))}
          <p className="text-[10px] font-black uppercase tracking-widest" style={mutedTextStyle}>Actions</p>
          <p className="text-[10px] font-black uppercase tracking-widest" style={mutedTextStyle}>Delete</p>
        </div>

        {/* Rows */}
        <div className="divide-y divide-[var(--as-border)]">
          {candidatesLoading ? (
            <div className="py-12 text-center">
              <p className="text-sm font-semibold" style={subtleTextStyle}>Loading candidates...</p>
            </div>
          ) : candidatesError ? (
            <div className="py-12 text-center">
              <p className="text-sm text-red-500 font-semibold">{candidatesError}</p>
            </div>
          ) : (
            sorted.map((c) => {
              const expanded = expandedId === c.id;
              const recoveryState = recoveryByCandidate[c.id];
              const recovery = recoveryState?.data;
              return (
                <div key={c.id}>
                  {/* Main row */}
                  <div
                    className={`grid items-center px-5 py-3 cursor-pointer transition-colors as-shell-dropdown-item ${
                      showClient
                        ? "grid-cols-[1fr_110px_130px_130px_140px_68px_78px_68px_100px_44px]"
                        : "grid-cols-[1fr_130px_130px_140px_68px_78px_68px_100px_44px]"
                    }`}
                    style={expanded ? { backgroundColor: "var(--as-accent-soft)" } : undefined}
                    onClick={() => toggle(c)}
                  >
                    {/* Name + email */}
                    <div className="flex items-start gap-2 min-w-0 pr-2">
                      <ChevronRight
                        className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 transition-transform duration-200"
                        style={{
                          color: expanded ? "#A380F6" : "var(--as-text-subtle)",
                          transform: expanded ? "rotate(90deg)" : "rotate(0deg)",
                        }}
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-bold leading-snug truncate" style={primaryTextStyle}>{c.name}</p>
                        <p className="text-[11px] truncate" style={subtleTextStyle}>{c.email}</p>
                      </div>
                    </div>

                    {showClient && (
                      <p className="text-xs font-semibold truncate pr-2" style={mutedTextStyle}>{c.clientName}</p>
                    )}

                    <p className="text-xs font-semibold truncate pr-2" style={mutedTextStyle}>{c.entityName}</p>

                    <p className="text-xs font-semibold truncate pr-2" style={mutedTextStyle}>{c.role}</p>

                    <p className="text-[11px] font-semibold" style={mutedTextStyle}>{c.created}</p>

                    <ScoreCell score={c.resume} />
                    <ScoreCell score={c.interview} />
                    <ScoreCell score={c.overall} />

                    {/* Actions */}
                    <div
                      className="flex flex-col gap-1.5"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        disabled={resumeBusy[c.id] === true}
                        className="px-3 py-1 rounded-full text-[11px] font-bold text-white transition-opacity hover:opacity-90"
                        style={{ backgroundColor: "#A380F6" }}
                        onClick={() => {
                          void openCandidateResume(c);
                        }}
                      >
                        {resumeBusy[c.id] === true ? "Opening..." : "Resume"}
                      </button>
                      <button
                        disabled={reportBusy[c.id] === true}
                        className="px-3 py-1 rounded-full text-[11px] font-bold text-white transition-opacity hover:opacity-90"
                        style={{ backgroundColor: "#A380F6" }}
                        onClick={() => {
                          void openCandidateReport(c);
                        }}
                      >
                        {reportBusy[c.id] === true ? "Opening..." : "Report"}
                      </button>
                      {c.latestInterviewId &&
                        String(c.recordingStatus || "").toLowerCase() === "ready" &&
                        !c.insufficientInterview &&
                        (c.interview !== null || c.hasSubstantiveInterview) && (
                        <button
                          disabled={recordingBusy[c.id] === true}
                          className="px-3 py-1 rounded-full text-[11px] font-bold text-white transition-opacity hover:opacity-90"
                          style={{ backgroundColor: "#A380F6" }}
                          onClick={() => {
                            void openCandidateRecording(c);
                          }}
                        >
                          {recordingBusy[c.id] === true ? "Opening..." : "Recording"}
                        </button>
                      )}
                    </div>

                    {/* Delete */}
                    <div
                      className="flex items-center justify-center"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        disabled={deleteBusy[c.id] === true}
                        className="p-1.5 rounded-lg text-[var(--as-text-subtle)] hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        title={`Delete ${c.name}`}
                        onClick={() => {
                          void deleteCandidate(c);
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Expanded detail */}
                  {expanded && (
                    <div
                      className="px-8 py-4 border-t"
                      style={{ backgroundColor: "var(--as-surface-muted)", borderColor: "rgba(163,128,246,0.12)", borderLeft: "3px solid #A380F6" }}
                    >
                      <div className="flex flex-col sm:flex-row gap-4 sm:gap-8">
                        <div className="flex items-center gap-1.5 text-xs">
                          <span className="font-black" style={mutedTextStyle}>Status:</span>
                          <span
                            className="font-bold"
                            style={{ color: c.status === "Interview Complete" ? "#02D99D" : "#F0A500" }}
                          >
                            {c.status}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs">
                          <span className="font-black" style={mutedTextStyle}>Report generated:</span>
                          <span className="font-semibold" style={mutedTextStyle}>{c.reportDate}</span>
                        </div>
                      </div>
                      {recoveryCoreEnabled && (
                        <div className="mt-4 rounded-lg border p-4" style={{ backgroundColor: "var(--as-surface)", borderColor: "var(--as-border)" }}>
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="text-[10px] font-black uppercase tracking-widest" style={subtleTextStyle}>Video interview recovery</p>
                              <p className="mt-1 text-xs font-semibold" style={mutedTextStyle}>Manual, one-replacement authorization</p>
                            </div>
                            {recovery?.eligible && (
                              <button
                                type="button"
                                className="rounded-md px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
                                style={{ backgroundColor: "#A380F6" }}
                                onClick={(event) => { event.stopPropagation(); void openResetModal(c); }}
                              >
                                Authorize one replacement
                              </button>
                            )}
                          </div>
                          {recoveryState?.loading ? (
                            <p className="mt-3 text-xs font-semibold" style={mutedTextStyle}>Reviewing exact attempt evidence…</p>
                          ) : recoveryState?.error ? (
                            <p className="mt-3 text-xs font-semibold text-red-600">{recoveryState.error}</p>
                          ) : recovery ? (
                            <div className="mt-3 grid gap-3 lg:grid-cols-2">
                              <div className="rounded-md border p-3" style={dividerStyle}>
                                <p className="text-[10px] font-black uppercase tracking-wider" style={subtleTextStyle}>System-visible prior attempt</p>
                                <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                                  <dt style={mutedTextStyle}>Status</dt><dd className="font-bold" style={primaryTextStyle}>{recovery.prior_interview?.status || "Unknown"}</dd>
                                  <dt style={mutedTextStyle}>Created</dt><dd className="font-semibold" style={primaryTextStyle}>{formatDateTime(recovery.prior_interview?.created_at).text}</dd>
                                  <dt style={mutedTextStyle}>Duration</dt><dd className="font-semibold" style={primaryTextStyle}>{formatRecordingDuration(recovery.prior_interview?.duration_seconds) || "Unknown"}</dd>
                                  <dt style={mutedTextStyle}>Transcript</dt><dd className="font-semibold" style={primaryTextStyle}>{recovery.prior_interview?.transcript_present ? "Available" : "Not present"}</dd>
                                  <dt style={mutedTextStyle}>Recording</dt><dd className="font-semibold" style={primaryTextStyle}>{recovery.prior_interview?.recording_present ? "Available" : "Not present"}</dd>
                                  <dt style={mutedTextStyle}>Report</dt><dd className="font-semibold" style={primaryTextStyle}>{recovery.prior_interview?.report_present ? "Available" : "Not present"}</dd>
                                  <dt style={mutedTextStyle}>Replacement</dt><dd className="font-semibold" style={primaryTextStyle}>{recoveryStartLabel(recovery.replacement)}</dd>
                                </dl>
                                {recovery.replacement?.manual_review_required && (
                                  <p className="mt-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-900">
                                    Manual review required. No additional vendor conversation will be created automatically.
                                  </p>
                                )}
                                {recovery.replacement && canRunProtectedReconciliation(recovery.replacement) && (
                                  <button
                                    type="button"
                                    className="mt-3 rounded-md border px-3 py-2 text-xs font-bold disabled:opacity-50"
                                    style={{ ...dividerStyle, color: "var(--as-text-muted)" }}
                                    disabled={reconciliationBusy[c.id] === true}
                                    onClick={(event) => { event.stopPropagation(); void runProtectedReconciliation(c, recovery); }}
                                  >
                                    {reconciliationBusy[c.id]
                                      ? "Checking protected recovery state…"
                                      : (recovery.replacement.binding_recovery_required
                                        ? "Recover stored vendor binding"
                                        : "Run read-only vendor reconciliation")}
                                  </button>
                                )}
                              </div>
                              <div className="rounded-md border p-3" style={dividerStyle}>
                                <p className="text-[10px] font-black uppercase tracking-wider" style={subtleTextStyle}>Administrator decision</p>
                                {recovery.adjudication ? (
                                  <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                                    <dt style={mutedTextStyle}>Decision</dt><dd className="font-bold" style={primaryTextStyle}>{recovery.adjudication.decision || "—"}</dd>
                                    <dt style={mutedTextStyle}>Actor</dt><dd className="font-semibold" style={primaryTextStyle}>{recovery.adjudication.actor_email || "System"}</dd>
                                    <dt style={mutedTextStyle}>Time</dt><dd className="font-semibold" style={primaryTextStyle}>{formatDateTime(recovery.adjudication.created_at).text}</dd>
                                    <dt style={mutedTextStyle}>Reason</dt><dd className="font-semibold" style={primaryTextStyle}>{recovery.adjudication.reason_code || "—"}</dd>
                                    <dt style={mutedTextStyle}>Eligibility</dt><dd className="font-semibold" style={primaryTextStyle}>{recovery.adjudication.resulting_eligibility || "—"}</dd>
                                    <dt style={mutedTextStyle}>Audit</dt><dd className="font-mono text-[10px]" style={primaryTextStyle}>{recovery.adjudication.audit_log_id || "—"}</dd>
                                  </dl>
                                ) : (
                                  <p className="mt-2 text-xs font-semibold" style={mutedTextStyle}>{recovery.eligible ? "No decision recorded." : (recovery.detail || "Recovery is not eligible.")}</p>
                                )}
                              </div>
                            </div>
                          ) : (
                            <button type="button" className="mt-3 rounded-md border px-3 py-2 text-xs font-bold" style={{ ...dividerStyle, color: "var(--as-text-muted)" }} onClick={() => { void loadRecoveryEligibility(c); }}>Review recovery eligibility</button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}

          {!candidatesLoading && !candidatesError && sorted.length === 0 && (
            <div className="py-12 text-center">
              <p className="text-sm font-semibold" style={subtleTextStyle}>
                {candidateSearchTerm && byRole.length > 0 ? "No candidates match your search." : emptyMessage}
              </p>
            </div>
          )}
        </div>
      </div>
      {recordingModal && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 sm:p-6">
          <button
            type="button"
            onClick={() => setRecordingModal(null)}
            className="absolute inset-0 bg-[#0A1547]/45"
            aria-label="Close recording"
          />
          <div
            className="relative w-full max-w-3xl max-h-[85vh] rounded-2xl overflow-hidden"
            style={modalSurfaceStyle}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b" style={dividerStyle}>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest" style={subtleTextStyle}>Interview Recording</p>
                <h3 className="text-sm font-black leading-snug" style={primaryTextStyle}>{recordingModal.candidateName}</h3>
              </div>
              <button
                type="button"
                onClick={() => setRecordingModal(null)}
                className="px-3 py-1.5 text-xs font-bold rounded-full border hover:bg-[var(--as-hover)] transition-colors"
                style={{ backgroundColor: "var(--as-surface)", borderColor: "var(--as-border)", color: "var(--as-text-muted)" }}
              >
                Close
              </button>
            </div>
            <div className="px-5 py-4 overflow-y-auto max-h-[calc(85vh-72px)]">
              <video
                controls
                src={recordingModal.url}
                className="w-full max-h-[58vh] rounded-xl bg-black"
              >
                Your browser does not support the video tag.
              </video>
              {recordingMeta && (
                <p className="mt-3 text-[11px] font-semibold" style={mutedTextStyle}>{recordingMeta}</p>
              )}
              <div className="mt-4 flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    window.open(recordingModal.url, "_blank", "noopener,noreferrer");
                    setRecordingModal(null);
                  }}
                  className="px-4 py-2 text-xs font-bold rounded-full border hover:bg-[var(--as-hover)] transition-colors"
                  style={{ backgroundColor: "var(--as-surface)", borderColor: "var(--as-border)", color: "var(--as-text-muted)" }}
                >
                  Open in new tab
                </button>
                <button
                  type="button"
                  onClick={() => { void downloadRecordingFromModal(); }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white rounded-full transition-all hover:opacity-90"
                  style={{ backgroundColor: "#A380F6" }}
                >
                  Download
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {resetModal && (
        <div className="fixed inset-0 z-[85] flex items-center justify-center p-4">
          <button type="button" className="absolute inset-0 bg-[#0A1547]/45" aria-label="Close video interview recovery" onClick={() => !resetBusy && setResetModal(null)} />
          <div className="relative w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-lg p-5" style={modalSurfaceStyle}>
            <p className="text-[10px] font-black uppercase tracking-widest" style={subtleTextStyle}>Video interview recovery</p>
            <h3 className="mt-1 text-base font-black" style={primaryTextStyle}>Authorize one replacement for {resetModal.candidate.name}</h3>
            <p className="mt-2 text-xs" style={mutedTextStyle}>
              Prior attempt {resetModal.eligibility.prior_interview?.attempt_number || "—"} · {resetModal.eligibility.prior_interview?.status || "Unknown status"}. Objective evidence remains unchanged; attempt two is created only when the candidate selects Start.
            </p>
            <label className="mt-4 block text-xs font-black uppercase tracking-wider" style={mutedTextStyle}>Reason</label>
            <select className={selectCls + " mt-1 w-full rounded-md"} style={fieldSurfaceStyle} value={resetReason} onChange={(event) => setResetReason(event.target.value)} disabled={resetBusy}>
              <option value="candidate_network_disconnect">Candidate network disconnect</option>
              <option value="unknown_early_termination">Unknown early termination</option>
              <option value="no_substantive_response">No substantive response</option>
              <option value="partial_interview">Partial interview</option>
              <option value="vendor_start_failure">Vendor start failure</option>
              <option value="client_approved_exception">Client-approved exception</option>
              <option value="other">Other</option>
            </select>
            {resetReason === "other" && (
              <div className="mt-2">
                <textarea maxLength={500} className="w-full rounded-md border px-3 py-2 text-sm" style={fieldSurfaceStyle} value={resetDetail} onChange={(event) => setResetDetail(event.target.value)} placeholder="Brief explanation" rows={2} disabled={resetBusy} />
                <p className="mt-1 text-right text-[10px]" style={subtleTextStyle}>{resetDetail.length}/500</p>
              </div>
            )}
            <div className="mt-4 space-y-3">
              <label className="flex items-start gap-2 text-xs font-semibold" style={mutedTextStyle}>
                <input type="checkbox" className="mt-0.5" checked={coverageAttested} onChange={(event) => setCoverageAttested(event.target.checked)} disabled={resetBusy} />
                <span>I attest that required interview coverage was not completed or cannot be proven completed.</span>
              </label>
              <label className="flex items-start gap-2 text-xs font-semibold" style={mutedTextStyle}>
                <input type="checkbox" className="mt-0.5" checked={clientApprovalAcknowledged} onChange={(event) => setClientApprovalAcknowledged(event.target.checked)} disabled={resetBusy} />
                <span>I confirm that client approval has been recorded.</span>
              </label>
            </div>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button type="button" className="rounded-md border px-3 py-2 text-xs font-bold" style={{ borderColor: "var(--as-border)", color: "var(--as-text-muted)" }} onClick={() => setResetModal(null)} disabled={resetBusy}>Cancel</button>
              <button type="button" className="rounded-md border px-3 py-2 text-xs font-bold" style={{ borderColor: "var(--as-border)", color: "var(--as-text-muted)" }} onClick={() => { void submitReset("reset_only"); }} disabled={resetBusy || !coverageAttested || !clientApprovalAcknowledged}>Reset only</button>
              {recoveryCoreEmailEnabled && (
                <button type="button" className="rounded-md px-3 py-2 text-xs font-bold text-white" style={{ backgroundColor: "#A380F6" }} onClick={() => { void submitReset("reset_and_send"); }} disabled={resetBusy || !coverageAttested || !clientApprovalAcknowledged}>{resetBusy ? "Authorizing…" : "Reset and send"}</button>
              )}
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
