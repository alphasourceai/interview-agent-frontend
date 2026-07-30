import { useCallback, useEffect, useRef, useState } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Eye,
  Filter,
  Loader2,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldCheck,
  Signal,
  X,
} from "lucide-react";
import AdminLayout from "@/components/AdminLayout";
import { useAdminClient } from "@/context/AdminClientContext";
import { supabase } from "@/lib/supabaseClient";

type TimeRange = "24h" | "7d" | "30d" | "90d";
type SortField = "started_at" | "ended_at" | "duration" | "status" | "failure" | "processing_age";
type SortDirection = "asc" | "desc";
type PageSize = 10 | 20 | 50 | 100;

interface Filters {
  timeRange: TimeRange;
  roleId: string;
  status: string;
  attempt: string;
  failureCategory: string;
  reconnectOutcome: string;
  processingState: string;
  search: string;
  sort: SortField;
  direction: SortDirection;
  page: number;
  pageSize: PageSize;
}

interface ReliabilitySummary {
  total_interviews: number;
  completed_normally: number;
  incomplete: number;
  reconnect_attempted: number;
  reconnect_failed: number;
  watchdog_terminated: number;
  processing_incomplete_or_overdue: number;
}

interface ReliabilityRow {
  interview_id: string;
  candidate: string;
  client: string;
  client_id: string;
  role: string;
  role_id: string;
  attempt: number | null;
  started_at: string | null;
  ended_at: string | null;
  duration_ms: number | null;
  final_status: string;
  status_code: string;
  progress_state: string;
  reconnect: string;
  reconnect_count: number;
  terminal_reason: string;
  transcript_state: string;
  analysis_state: string;
  reliability_result: string;
  failure_category: string;
  processing_state: string;
  processing_age_ms: number | null;
}

interface FilterOption {
  id: string;
  client_id?: string;
  name: string;
}

interface ListPayload {
  generated_at?: string;
  summary: ReliabilitySummary;
  pagination: {
    page: number;
    page_size: number;
    total_items: number;
    total_pages: number;
  };
  filter_options?: {
    clients?: FilterOption[];
    roles?: FilterOption[];
  };
  items: ReliabilityRow[];
}

interface TechnicalDetails {
  [key: string]: string | number | boolean | null;
}

interface TimelineEvent {
  event: string;
  event_code: string;
  group: string;
  server_timestamp: string | null;
  observed_timestamp: string | null;
  elapsed_ms: number | null;
  speaker_role: string;
  utterance_classification: string | null;
  technical_details: TechnicalDetails;
}

interface DetailPayload {
  identity: {
    candidate: string;
    client: string;
    role: string;
    attempt: number | null;
    status: string;
    started_at: string | null;
    ended_at: string | null;
    duration_ms: number | null;
  };
  reliability: {
    classification: string;
    reconnect_count: number;
    reconnect_outcome: string;
    terminal_reason: string;
    last_practical_progress_at: string | null;
    participant_media_state: string;
    browser_network_state: string;
    browser_visibility_state: string;
    evidence_completeness: {
      level: "complete" | "partial" | "minimal";
      signals: Record<string, boolean>;
    };
  };
  processing: {
    overall: string;
    age_ms: number | null;
    transcript_reconciliation: string;
    transcript_completed_at: string | null;
    recording: string;
    recording_ready_at: string | null;
    scores: string;
    summary: string;
    question_processing: string;
    analysis_v2: string;
    report: string;
  };
  timeline: TimelineEvent[];
  attempts: {
    current_attempt: number | null;
    prior_attempt: { attempt: number | null; status: string } | null;
    replacement_attempt: { attempt: number | null; status: string } | null;
    reset_only_authorization_state: string;
    another_replacement_permitted: boolean;
    recovery_eligibility: {
      eligible: boolean | null;
      reason: string;
      read_only: boolean;
    };
  };
}

const EMPTY_SUMMARY: ReliabilitySummary = {
  total_interviews: 0,
  completed_normally: 0,
  incomplete: 0,
  reconnect_attempted: 0,
  reconnect_failed: 0,
  watchdog_terminated: 0,
  processing_incomplete_or_overdue: 0,
};

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const;

const DEFAULT_FILTERS: Filters = {
  timeRange: "7d",
  roleId: "",
  status: "",
  attempt: "",
  failureCategory: "",
  reconnectOutcome: "",
  processingState: "",
  search: "",
  sort: "started_at",
  direction: "desc",
  page: 1,
  pageSize: 20,
};

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

const surfaceStyle = {
  backgroundColor: "var(--as-surface)",
  border: "1px solid var(--as-border)",
  boxShadow: "var(--as-shadow)",
};
const mutedStyle = {
  backgroundColor: "var(--as-surface-muted)",
  borderColor: "var(--as-border)",
};
const textStyle = { color: "var(--as-text)" };
const mutedTextStyle = { color: "var(--as-text-muted)" };
const subtleTextStyle = { color: "var(--as-text-subtle)" };

function parseJsonSafe(text: string): unknown {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function responseError(text: string, fallback: string): string {
  const payload = parseJsonSafe(text);
  if (payload && typeof payload === "object") {
    const detail =
      (payload as { detail?: unknown }).detail ??
      (payload as { message?: unknown }).message ??
      (payload as { error?: unknown }).error;
    if (typeof detail === "string" && detail.trim()) return detail;
  }
  return fallback;
}

function titleCase(value: unknown): string {
  const text = String(value || "").trim();
  if (!text) return "Unknown";
  return text
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDateTime(value: unknown): string {
  const parsed = new Date(String(value || ""));
  return Number.isNaN(parsed.getTime()) ? "—" : parsed.toLocaleString();
}

function formatDuration(value: number | null | undefined): string {
  if (!Number.isFinite(value)) return "—";
  const totalSeconds = Math.max(0, Math.round(Number(value) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    return `${hours}h ${minutes % 60}m`;
  }
  return `${minutes}m ${seconds}s`;
}

function formatAge(value: number | null | undefined): string {
  if (!Number.isFinite(value)) return "—";
  const minutes = Math.max(0, Math.floor(Number(value) / 60000));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

function badgeClass(value: unknown): string {
  const normalized = String(value || "").toLowerCase();
  if (normalized.includes("healthy") || normalized === "complete" || normalized === "recovered" || normalized === "ready" || normalized === "available") {
    return "bg-[#02D99D]/10 text-[#00886A] dark:text-[#53E4BF]";
  }
  if (normalized.includes("failed") || normalized.includes("watchdog") || normalized === "overdue") {
    return "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-300";
  }
  if (normalized.includes("pending") || normalized.includes("incomplete") || normalized === "partial") {
    return "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300";
  }
  return "bg-[#A380F6]/10 text-[#7659C5] dark:text-[#C8B8FF]";
}

function StatusBadge({ value }: { value: unknown }) {
  return (
    <span className={`inline-flex max-w-full items-center rounded-full px-2 py-1 text-[10px] font-black ${badgeClass(value)}`}>
      <span className="truncate">{titleCase(value)}</span>
    </span>
  );
}

function parsePageSize(value: string | null): PageSize {
  const parsed = Number(value);
  return PAGE_SIZE_OPTIONS.includes(parsed as PageSize) ? (parsed as PageSize) : 20;
}

function readInitialFilters(): Filters {
  if (typeof window === "undefined") return DEFAULT_FILTERS;
  const params = new URLSearchParams(window.location.search);
  const timeRange = params.get("time_range");
  const sort = params.get("sort");
  const direction = params.get("direction");
  const page = Number(params.get("page") || "1");
  return {
    timeRange: ["24h", "7d", "30d", "90d"].includes(String(timeRange)) ? (timeRange as TimeRange) : "7d",
    roleId: params.get("role_id") || "",
    status: params.get("status") || "",
    attempt: params.get("attempt") || "",
    failureCategory: params.get("failure_category") || "",
    reconnectOutcome: params.get("reconnect_outcome") || "",
    processingState: params.get("processing_state") || "",
    search: (params.get("search") || "").slice(0, 80),
    sort: ["started_at", "ended_at", "duration", "status", "failure", "processing_age"].includes(String(sort))
      ? (sort as SortField)
      : "started_at",
    direction: direction === "asc" ? "asc" : "desc",
    page: Number.isInteger(page) && page > 0 ? page : 1,
    pageSize: parsePageSize(params.get("page_size")),
  };
}

function listQuery(filters: Filters, selectedClientId: string): URLSearchParams {
  const params = new URLSearchParams({
    time_range: filters.timeRange,
    page: String(filters.page),
    page_size: String(filters.pageSize),
    sort: filters.sort,
    direction: filters.direction,
  });
  if (selectedClientId && selectedClientId !== "all") params.set("client_id", selectedClientId);
  if (filters.roleId) params.set("role_id", filters.roleId);
  if (filters.status) params.set("status", filters.status);
  if (filters.attempt) params.set("attempt", filters.attempt);
  if (filters.failureCategory) params.set("failure_category", filters.failureCategory);
  if (filters.reconnectOutcome) params.set("reconnect_outcome", filters.reconnectOutcome);
  if (filters.processingState) params.set("processing_state", filters.processingState);
  if (filters.search.trim()) params.set("search", filters.search.trim());
  return params;
}

function DetailLine({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="grid grid-cols-[minmax(120px,0.45fr)_minmax(0,0.55fr)] gap-3 border-t py-2 first:border-t-0" style={{ borderColor: "var(--as-border)" }}>
      <span className="text-xs font-semibold" style={subtleTextStyle}>{label}</span>
      <span className="min-w-0 break-words text-right text-xs font-black" style={textStyle}>
        {typeof value === "boolean" ? (value ? "Yes" : "No") : String(value ?? "—")}
      </span>
    </div>
  );
}

function ReliabilityDetail({
  detail,
  loading,
  error,
  onClose,
}: {
  detail: DetailPayload | null;
  loading: boolean;
  error: string;
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[80] flex justify-end bg-black/35" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="reliability-detail-title"
        className="h-full w-full max-w-3xl overflow-y-auto"
        style={{ backgroundColor: "var(--as-surface)", boxShadow: "-12px 0 40px rgba(10,21,71,0.16)" }}
      >
        <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b px-5 py-4" style={{ backgroundColor: "var(--as-surface)", borderColor: "var(--as-border)" }}>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.15em]" style={subtleTextStyle}>Read-only diagnostics</p>
            <h2 id="reliability-detail-title" className="mt-1 text-lg font-black" style={textStyle}>
              {detail?.identity.candidate || "Interview reliability detail"}
            </h2>
            {detail && (
              <p className="mt-1 text-xs font-semibold" style={mutedTextStyle}>
                {detail.identity.client} · {detail.identity.role} · Attempt {detail.identity.attempt ?? "—"}
              </p>
            )}
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 transition-colors hover:bg-[var(--as-hover)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#A380F6]"
            aria-label="Close reliability detail"
            style={mutedTextStyle}
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="space-y-4 p-5">
          {loading && (
            <div className="flex items-center justify-center gap-2 rounded-xl border px-4 py-12 text-sm font-semibold" style={{ ...mutedStyle, ...mutedTextStyle }}>
              <Loader2 className="h-4 w-4 animate-spin" /> Loading diagnostic timeline...
            </div>
          )}
          {error && !loading && (
            <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600 dark:border-red-500/25 dark:bg-red-500/10 dark:text-red-300">
              {error}
            </div>
          )}
          {detail && !loading && (
            <>
              <section className="rounded-xl border" style={surfaceStyle}>
                <div className="flex flex-wrap items-start justify-between gap-3 border-b px-4 py-3" style={{ borderColor: "var(--as-border)" }}>
                  <div>
                    <h3 className="text-sm font-black" style={textStyle}>Reliability summary</h3>
                    <p className="mt-1 text-xs font-semibold" style={mutedTextStyle}>Bounded operational evidence for this attempt.</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <StatusBadge value={detail.reliability.classification} />
                    <StatusBadge value={`evidence_${detail.reliability.evidence_completeness.level}`} />
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-x-8 px-4 py-2 sm:grid-cols-2">
                  <DetailLine label="Status" value={detail.identity.status} />
                  <DetailLine label="Duration" value={formatDuration(detail.identity.duration_ms)} />
                  <DetailLine label="Started" value={formatDateTime(detail.identity.started_at)} />
                  <DetailLine label="Ended" value={formatDateTime(detail.identity.ended_at)} />
                  <DetailLine label="Reconnect" value={`${titleCase(detail.reliability.reconnect_outcome)} · ${detail.reliability.reconnect_count}`} />
                  <DetailLine label="Terminal reason" value={titleCase(detail.reliability.terminal_reason)} />
                  <DetailLine label="Last progress" value={formatDateTime(detail.reliability.last_practical_progress_at)} />
                  <DetailLine label="Network / visibility" value={`${titleCase(detail.reliability.browser_network_state)} / ${titleCase(detail.reliability.browser_visibility_state)}`} />
                </div>
              </section>

              <section className="rounded-xl border" style={surfaceStyle}>
                <div className="border-b px-4 py-3" style={{ borderColor: "var(--as-border)" }}>
                  <h3 className="text-sm font-black" style={textStyle}>Processing status</h3>
                </div>
                <div className="grid grid-cols-1 gap-x-8 px-4 py-2 sm:grid-cols-2">
                  <DetailLine label="Overall" value={titleCase(detail.processing.overall)} />
                  <DetailLine label="Processing age" value={formatAge(detail.processing.age_ms)} />
                  <DetailLine label="Transcript reconciliation" value={titleCase(detail.processing.transcript_reconciliation)} />
                  <DetailLine label="Transcript completed" value={formatDateTime(detail.processing.transcript_completed_at)} />
                  <DetailLine label="Recording" value={titleCase(detail.processing.recording)} />
                  <DetailLine label="Recording ready" value={formatDateTime(detail.processing.recording_ready_at)} />
                  <DetailLine label="Scores / summary" value={`${titleCase(detail.processing.scores)} / ${titleCase(detail.processing.summary)}`} />
                  <DetailLine label="Question processing" value={titleCase(detail.processing.question_processing)} />
                  <DetailLine label="Analysis V2" value={titleCase(detail.processing.analysis_v2)} />
                  <DetailLine label="Report" value={titleCase(detail.processing.report)} />
                </div>
              </section>

              <section className="rounded-xl border" style={surfaceStyle}>
                <div className="border-b px-4 py-3" style={{ borderColor: "var(--as-border)" }}>
                  <h3 className="text-sm font-black" style={textStyle}>Attempt and recovery</h3>
                </div>
                <div className="grid grid-cols-1 gap-x-8 px-4 py-2 sm:grid-cols-2">
                  <DetailLine label="Current attempt" value={detail.attempts.current_attempt ?? "—"} />
                  <DetailLine label="Prior attempt" value={detail.attempts.prior_attempt ? `Attempt ${detail.attempts.prior_attempt.attempt} · ${detail.attempts.prior_attempt.status}` : "None"} />
                  <DetailLine label="Replacement attempt" value={detail.attempts.replacement_attempt ? `Attempt ${detail.attempts.replacement_attempt.attempt} · ${detail.attempts.replacement_attempt.status}` : "None"} />
                  <DetailLine label="Reset-only authorization" value={titleCase(detail.attempts.reset_only_authorization_state)} />
                  <DetailLine label="Another replacement permitted" value={detail.attempts.another_replacement_permitted} />
                  <DetailLine label="Recovery eligibility" value={`${detail.attempts.recovery_eligibility.eligible === true ? "Eligible" : detail.attempts.recovery_eligibility.eligible === false ? "Not eligible" : "Review"} · ${titleCase(detail.attempts.recovery_eligibility.reason)}`} />
                </div>
              </section>

              <section className="rounded-xl border" style={surfaceStyle}>
                <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3" style={{ borderColor: "var(--as-border)" }}>
                  <div>
                    <h3 className="text-sm font-black" style={textStyle}>Diagnostic timeline</h3>
                    <p className="mt-1 text-xs font-semibold" style={mutedTextStyle}>Ordered by observed time, then server receipt time.</p>
                  </div>
                  <span className="text-xs font-black" style={subtleTextStyle}>{detail.timeline.length} events</span>
                </div>
                {!detail.timeline.length ? (
                  <div className="px-4 py-8 text-center text-sm font-semibold" style={mutedTextStyle}>No bounded lifecycle events were recorded for this attempt.</div>
                ) : (
                  <ol className="space-y-2 p-4">
                    {detail.timeline.map((event, index) => {
                      const technicalEntries = Object.entries(event.technical_details || {});
                      return (
                        <li key={`${event.event_code}-${event.server_timestamp || index}`} className="rounded-lg border px-3 py-2.5" style={mutedStyle}>
                          <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-xs font-black" style={textStyle}>{event.event}</p>
                                <span className="text-[9px] font-black uppercase tracking-[0.1em]" style={subtleTextStyle}>{titleCase(event.group)}</span>
                              </div>
                              <p className="mt-1 text-[11px] font-semibold" style={mutedTextStyle}>
                                {formatDateTime(event.server_timestamp)}
                                {event.elapsed_ms != null ? ` · +${formatDuration(event.elapsed_ms)}` : ""}
                              </p>
                            </div>
                            {event.utterance_classification && <StatusBadge value={event.utterance_classification} />}
                          </div>
                          {technicalEntries.length > 0 && (
                            <details className="mt-2">
                              <summary className="cursor-pointer text-[11px] font-black" style={mutedTextStyle}>Technical details</summary>
                              <dl className="mt-2 grid grid-cols-1 gap-1 sm:grid-cols-2">
                                {technicalEntries.map(([key, value]) => (
                                  <div key={key} className="flex justify-between gap-3 text-[10px]">
                                    <dt className="font-semibold" style={subtleTextStyle}>{titleCase(key)}</dt>
                                    <dd className="font-black" style={textStyle}>{String(value)}</dd>
                                  </div>
                                ))}
                              </dl>
                            </details>
                          )}
                        </li>
                      );
                    })}
                  </ol>
                )}
              </section>
            </>
          )}
        </div>
      </section>
    </div>
  );
}

export default function AdminInterviewReliabilityPage() {
  const { selectedClientId } = useAdminClient();
  const [draftFilters, setDraftFilters] = useState<Filters>(() => readInitialFilters());
  const [filters, setFilters] = useState<Filters>(() => readInitialFilters());
  const [payload, setPayload] = useState<ListPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [detail, setDetail] = useState<DetailPayload | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const urlSyncStartedRef = useRef(false);
  const restoringHistoryRef = useRef(false);

  const getToken = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const token = String(session?.access_token || "").trim();
    if (!token) throw new Error("Missing session token.");
    return token;
  }, []);

  const loadList = useCallback(async () => {
    if (!backendBase) {
      setError("Missing backend base URL configuration.");
      setPayload(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const token = await getToken();
      const params = listQuery(filters, selectedClientId);
      const response = await fetch(`${backendBase}/admin/interview-reliability?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
        credentials: "omit",
      });
      const text = await response.text();
      if (!response.ok) throw new Error(responseError(text, "Could not load interview reliability data."));
      const next = parseJsonSafe(text) as ListPayload | null;
      if (!next || !Array.isArray(next.items)) throw new Error("Interview reliability response was incomplete.");
      setPayload(next);
    } catch (loadError) {
      setPayload(null);
      setError(loadError instanceof Error ? loadError.message : "Could not load interview reliability data.");
    } finally {
      setLoading(false);
    }
  }, [filters, getToken, selectedClientId]);

  useEffect(() => {
    void loadList();
  }, [loadList, refreshNonce]);

  useEffect(() => {
    setDraftFilters((current) => ({ ...current, roleId: "", page: 1 }));
    setFilters((current) => ({ ...current, roleId: "", page: 1 }));
  }, [selectedClientId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = listQuery(filters, selectedClientId);
    const nextUrl = `${window.location.pathname}?${params.toString()}`;
    const currentUrl = `${window.location.pathname}${window.location.search}`;
    if (currentUrl === nextUrl) {
      urlSyncStartedRef.current = true;
      restoringHistoryRef.current = false;
      return;
    }
    if (!urlSyncStartedRef.current || restoringHistoryRef.current) {
      window.history.replaceState({ interviewReliability: true }, "", nextUrl);
    } else {
      window.history.pushState({ interviewReliability: true }, "", nextUrl);
    }
    urlSyncStartedRef.current = true;
    restoringHistoryRef.current = false;
  }, [filters, selectedClientId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const restoreFromHistory = () => {
      restoringHistoryRef.current = true;
      const next = readInitialFilters();
      setDraftFilters(next);
      setFilters(next);
      setDetailOpen(false);
      setDetail(null);
      setDetailError("");
    };
    window.addEventListener("popstate", restoreFromHistory);
    return () => window.removeEventListener("popstate", restoreFromHistory);
  }, []);

  useEffect(() => {
    if (loading || !payload) return;
    const totalPages = Math.max(1, Number(payload.pagination.total_pages) || 1);
    if (payload.pagination.page !== filters.page || filters.page <= totalPages) return;
    setDraftFilters((current) => ({ ...current, page: totalPages }));
    setFilters((current) => ({ ...current, page: totalPages }));
  }, [filters.page, loading, payload]);

  const applyFilters = (event: React.FormEvent) => {
    event.preventDefault();
    setFilters({ ...draftFilters, page: 1 });
  };

  const resetFilters = () => {
    setDraftFilters(DEFAULT_FILTERS);
    setFilters(DEFAULT_FILTERS);
  };

  const changeSort = (sort: SortField) => {
    const direction: SortDirection = filters.sort === sort && filters.direction === "desc" ? "asc" : "desc";
    const next = { ...filters, sort, direction, page: 1 };
    setDraftFilters(next);
    setFilters(next);
  };

  const changePage = (page: number) => {
    const nextPage = Math.max(1, Math.min(page, payload?.pagination.total_pages || 1));
    setDraftFilters((current) => ({ ...current, page: nextPage }));
    setFilters((current) => ({ ...current, page: nextPage }));
  };

  const changePageSize = (pageSize: PageSize) => {
    const next = { ...filters, page: 1, pageSize };
    setDraftFilters(next);
    setFilters(next);
  };

  const openDetail = async (row: ReliabilityRow) => {
    setDetailOpen(true);
    setDetail(null);
    setDetailError("");
    setDetailLoading(true);
    try {
      const token = await getToken();
      const params = new URLSearchParams();
      if (selectedClientId && selectedClientId !== "all") params.set("client_id", selectedClientId);
      const suffix = params.size ? `?${params.toString()}` : "";
      const response = await fetch(`${backendBase}/admin/interview-reliability/${encodeURIComponent(row.interview_id)}${suffix}`, {
        headers: { Authorization: `Bearer ${token}` },
        credentials: "omit",
      });
      const text = await response.text();
      if (!response.ok) throw new Error(responseError(text, "Could not load interview detail."));
      setDetail(parseJsonSafe(text) as DetailPayload);
    } catch (loadError) {
      setDetailError(loadError instanceof Error ? loadError.message : "Could not load interview detail.");
    } finally {
      setDetailLoading(false);
    }
  };

  const closeDetail = useCallback(() => {
    setDetailOpen(false);
    setDetail(null);
    setDetailError("");
  }, []);

  const summary = payload?.summary || EMPTY_SUMMARY;
  const roles = (payload?.filter_options?.roles || []).filter((role) =>
    selectedClientId === "all" || !selectedClientId || role.client_id === selectedClientId);
  const inputClass = "h-9 rounded-lg border bg-transparent px-2.5 text-xs font-semibold outline-none transition-colors focus:border-[#A380F6]";
  const summaryItems = [
    ["Total interviews", summary.total_interviews, Activity],
    ["Completed normally", summary.completed_normally, CheckCircle2],
    ["Incomplete", summary.incomplete, AlertTriangle],
    ["Reconnect attempted", summary.reconnect_attempted, RefreshCw],
    ["Reconnect failed", summary.reconnect_failed, Signal],
    ["Watchdog terminated", summary.watchdog_terminated, Clock3],
    ["Processing incomplete / overdue", summary.processing_incomplete_or_overdue, ShieldCheck],
  ] as const;

  return (
    <AdminLayout title="Interview Reliability">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
          <div>
            <h2 className="text-2xl font-black" style={textStyle}>Interview Reliability</h2>
            <p className="mt-1 text-sm font-semibold" style={mutedTextStyle}>
              Read-only attempt diagnostics and downstream processing health.
            </p>
            <p className="mt-1 text-xs font-semibold" style={subtleTextStyle}>
              Last refreshed {formatDateTime(payload?.generated_at)}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setRefreshNonce((value) => value + 1)}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-[#A380F6] px-4 py-2 text-xs font-black text-white transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        <section aria-label="Reliability summary" className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-7">
          {summaryItems.map(([label, value, Icon]) => (
            <div key={label} className="min-w-0 rounded-xl border px-3 py-3" style={surfaceStyle}>
              <div className="flex items-center justify-between gap-2">
                <p className="text-xl font-black tabular-nums" style={textStyle}>{Number(value || 0).toLocaleString()}</p>
                <Icon className="h-4 w-4 shrink-0 text-[#A380F6]" aria-hidden="true" />
              </div>
              <p className="mt-1 text-[10px] font-black uppercase leading-tight" style={subtleTextStyle}>{label}</p>
            </div>
          ))}
        </section>

        <form onSubmit={applyFilters} aria-label="Interview reliability filters" className="rounded-xl border p-3" style={surfaceStyle}>
          <div data-testid="reliability-filter-row-primary" className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-7">
            <label className="space-y-1">
              <span className="text-[10px] font-black uppercase" style={subtleTextStyle}>Time range</span>
              <select value={draftFilters.timeRange} onChange={(event) => setDraftFilters((current) => ({ ...current, timeRange: event.target.value as TimeRange }))} className={`${inputClass} w-full`} style={{ ...textStyle, borderColor: "var(--as-border)" }}>
                <option value="24h">Last 24 hours</option>
                <option value="7d">Last 7 days</option>
                <option value="30d">Last 30 days</option>
                <option value="90d">Last 90 days</option>
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-[10px] font-black uppercase" style={subtleTextStyle}>Role</span>
              <select value={draftFilters.roleId} onChange={(event) => setDraftFilters((current) => ({ ...current, roleId: event.target.value }))} className={`${inputClass} w-full`} style={{ ...textStyle, borderColor: "var(--as-border)" }}>
                <option value="">All roles</option>
                {roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-[10px] font-black uppercase" style={subtleTextStyle}>Status</span>
              <select value={draftFilters.status} onChange={(event) => setDraftFilters((current) => ({ ...current, status: event.target.value }))} className={`${inputClass} w-full`} style={{ ...textStyle, borderColor: "var(--as-border)" }}>
                <option value="">All statuses</option>
                <option value="analyzed">Analyzed</option>
                <option value="readyforanalysis">Ready for analysis</option>
                <option value="incomplete">Incomplete</option>
                <option value="ended">Ended</option>
                <option value="in_progress">In progress</option>
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-[10px] font-black uppercase" style={subtleTextStyle}>Attempt</span>
              <select value={draftFilters.attempt} onChange={(event) => setDraftFilters((current) => ({ ...current, attempt: event.target.value }))} className={`${inputClass} w-full`} style={{ ...textStyle, borderColor: "var(--as-border)" }}>
                <option value="">All attempts</option>
                <option value="1">Attempt 1</option>
                <option value="2">Attempt 2</option>
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-[10px] font-black uppercase" style={subtleTextStyle}>Failure category</span>
              <select value={draftFilters.failureCategory} onChange={(event) => setDraftFilters((current) => ({ ...current, failureCategory: event.target.value }))} className={`${inputClass} w-full`} style={{ ...textStyle, borderColor: "var(--as-border)" }}>
                <option value="">All outcomes</option>
                <option value="incomplete_substantive">Incomplete substantive</option>
                <option value="incomplete_non_substantive">Incomplete non-substantive</option>
                <option value="reconnect_failed">Reconnect failed</option>
                <option value="watchdog_timeout">Watchdog timeout</option>
                <option value="unknown_termination">Unknown termination</option>
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-[10px] font-black uppercase" style={subtleTextStyle}>Reconnect</span>
              <select value={draftFilters.reconnectOutcome} onChange={(event) => setDraftFilters((current) => ({ ...current, reconnectOutcome: event.target.value }))} className={`${inputClass} w-full`} style={{ ...textStyle, borderColor: "var(--as-border)" }}>
                <option value="">All reconnects</option>
                <option value="not_attempted">Not attempted</option>
                <option value="attempted_unknown">Attempted</option>
                <option value="recovered">Recovered</option>
                <option value="failed">Failed</option>
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-[10px] font-black uppercase" style={subtleTextStyle}>Processing</span>
              <select value={draftFilters.processingState} onChange={(event) => setDraftFilters((current) => ({ ...current, processingState: event.target.value }))} className={`${inputClass} w-full`} style={{ ...textStyle, borderColor: "var(--as-border)" }}>
                <option value="">All processing</option>
                <option value="complete">Complete</option>
                <option value="pending">Pending</option>
                <option value="overdue">Overdue</option>
                <option value="incomplete">Incomplete</option>
                <option value="failed">Failed</option>
                <option value="not_applicable">Not applicable</option>
              </select>
            </label>
          </div>
          <div data-testid="reliability-filter-row-secondary" className="mt-3 grid grid-cols-1 items-end gap-2 md:grid-cols-2 xl:grid-cols-7">
            <label className="space-y-1 md:col-span-2 xl:col-span-3">
              <span className="text-[10px] font-black uppercase" style={subtleTextStyle}>Candidate Search</span>
              <span className="relative block">
                <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5" style={subtleTextStyle} />
                <input
                  aria-label="Candidate Search"
                  value={draftFilters.search}
                  onChange={(event) => setDraftFilters((current) => ({ ...current, search: event.target.value.slice(0, 80) }))}
                  maxLength={80}
                  placeholder="Display name"
                  className={`${inputClass} w-full pl-8`}
                  style={{ ...textStyle, borderColor: "var(--as-border)" }}
                />
              </span>
            </label>
            <label className="space-y-1">
              <span className="block text-[10px] font-black uppercase" style={subtleTextStyle}>Sort</span>
              <select
                value={draftFilters.sort}
                onChange={(event) => setDraftFilters((current) => ({ ...current, sort: event.target.value as SortField }))}
                className={inputClass}
                style={{ ...textStyle, borderColor: "var(--as-border)" }}
              >
                <option value="started_at">Started time</option>
                <option value="ended_at">Ended time</option>
                <option value="duration">Duration</option>
                <option value="status">Status</option>
                <option value="failure">Failure</option>
                <option value="processing_age">Processing age</option>
              </select>
            </label>
            <label className="space-y-1">
              <span className="block text-[10px] font-black uppercase" style={subtleTextStyle}>Direction</span>
              <select
                value={draftFilters.direction}
                onChange={(event) => setDraftFilters((current) => ({ ...current, direction: event.target.value as SortDirection }))}
                className={inputClass}
                style={{ ...textStyle, borderColor: "var(--as-border)" }}
              >
                <option value="desc">Descending</option>
                <option value="asc">Ascending</option>
              </select>
            </label>
            <div data-testid="reliability-filter-actions" className="flex flex-wrap items-center justify-end gap-2 md:col-span-2 xl:col-span-2">
              <button type="button" onClick={resetFilters} className="inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-black" style={{ ...mutedStyle, ...mutedTextStyle }}>
                <RotateCcw className="h-3.5 w-3.5" /> Reset
              </button>
              <button type="submit" className="inline-flex h-9 items-center gap-1.5 rounded-full bg-[#0A1547] px-3 text-xs font-black text-white dark:bg-[#A380F6]">
                <Filter className="h-3.5 w-3.5" /> Apply filters
              </button>
            </div>
          </div>
        </form>

        {error && (
          <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600 dark:border-red-500/25 dark:bg-red-500/10 dark:text-red-300">
            {error}
          </div>
        )}

        <section className="overflow-hidden rounded-xl border" style={surfaceStyle}>
          <div className="flex items-center justify-between gap-3 border-b px-4 py-3" style={{ borderColor: "var(--as-border)" }}>
            <div>
              <h3 className="text-sm font-black" style={textStyle}>Interview results</h3>
              <p className="mt-1 text-xs font-semibold" style={mutedTextStyle}>{payload?.pagination.total_items || 0} matching interviews</p>
            </div>
            {loading && <Loader2 className="h-4 w-4 animate-spin text-[#A380F6]" aria-label="Loading interviews" />}
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-[1320px] w-full text-left">
              <thead>
                <tr className="border-b text-[10px] font-black uppercase tracking-wide" style={{ ...subtleTextStyle, borderColor: "var(--as-border)" }}>
                  <th className="px-3 py-2.5">Candidate</th>
                  <th className="px-3 py-2.5">Client</th>
                  <th className="px-3 py-2.5">Role</th>
                  <th className="px-3 py-2.5">Attempt</th>
                  <th className="px-3 py-2.5"><button type="button" onClick={() => changeSort("started_at")} className="inline-flex items-center gap-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#A380F6]">Started <ChevronDown className="h-3 w-3" /></button></th>
                  <th className="px-3 py-2.5"><button type="button" onClick={() => changeSort("duration")} className="inline-flex items-center gap-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#A380F6]">Duration <ChevronDown className="h-3 w-3" /></button></th>
                  <th className="px-3 py-2.5"><button type="button" onClick={() => changeSort("status")} className="inline-flex items-center gap-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#A380F6]">Final status <ChevronDown className="h-3 w-3" /></button></th>
                  <th className="px-3 py-2.5">Progress</th>
                  <th className="px-3 py-2.5">Reconnect</th>
                  <th className="px-3 py-2.5">Terminal reason</th>
                  <th className="px-3 py-2.5">Transcript</th>
                  <th className="px-3 py-2.5">Analysis</th>
                  <th className="px-3 py-2.5"><button type="button" onClick={() => changeSort("failure")} className="inline-flex items-center gap-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#A380F6]">Reliability result <ChevronDown className="h-3 w-3" /></button></th>
                  <th className="px-3 py-2.5"><span className="sr-only">Open detail</span></th>
                </tr>
              </thead>
              <tbody>
                {!loading && (payload?.items.length || 0) === 0 && (
                  <tr>
                    <td colSpan={14} className="px-4 py-12 text-center text-sm font-semibold" style={mutedTextStyle}>
                      No interviews match the selected filters.
                    </td>
                  </tr>
                )}
                {payload?.items.map((row) => (
                  <tr key={row.interview_id} className="border-b last:border-b-0 hover:bg-[var(--as-hover)]" style={{ borderColor: "var(--as-border)" }}>
                    <td className="max-w-[190px] truncate px-3 py-3 text-xs font-black" style={textStyle} title={row.candidate}>{row.candidate}</td>
                    <td className="max-w-[170px] truncate px-3 py-3 text-xs font-semibold" style={mutedTextStyle} title={row.client}>{row.client}</td>
                    <td className="max-w-[190px] truncate px-3 py-3 text-xs font-semibold" style={mutedTextStyle} title={row.role}>{row.role}</td>
                    <td className="px-3 py-3 text-xs font-black" style={textStyle}>{row.attempt ?? "—"}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-xs font-semibold" style={mutedTextStyle}>{formatDateTime(row.started_at)}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-xs font-semibold" style={mutedTextStyle}>{formatDuration(row.duration_ms)}</td>
                    <td className="px-3 py-3"><StatusBadge value={row.final_status} /></td>
                    <td className="px-3 py-3"><StatusBadge value={row.progress_state} /></td>
                    <td className="px-3 py-3"><StatusBadge value={row.reconnect} /></td>
                    <td className="px-3 py-3"><StatusBadge value={row.terminal_reason} /></td>
                    <td className="px-3 py-3"><StatusBadge value={row.transcript_state} /></td>
                    <td className="px-3 py-3"><StatusBadge value={row.analysis_state} /></td>
                    <td className="px-3 py-3"><StatusBadge value={row.reliability_result} /></td>
                    <td className="px-3 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => void openDetail(row)}
                        className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[11px] font-black transition-colors hover:border-[#A380F6] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#A380F6]"
                        style={{ ...mutedStyle, ...mutedTextStyle }}
                        aria-label={`Open reliability detail for ${row.candidate}`}
                      >
                        <Eye className="h-3.5 w-3.5" /> Detail
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-col items-center justify-between gap-2 border-t px-4 py-3 sm:flex-row" style={{ borderColor: "var(--as-border)" }}>
            <p className="text-xs font-semibold" style={mutedTextStyle}>
              Page {payload?.pagination.page || filters.page} of {payload?.pagination.total_pages || 1}
            </p>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 text-xs font-semibold" style={mutedTextStyle}>
                <span>Rows per page</span>
                <select
                  aria-label="Rows per page"
                  value={filters.pageSize}
                  onChange={(event) => changePageSize(parsePageSize(event.target.value))}
                  className={`${inputClass} w-[72px]`}
                  style={{ ...textStyle, borderColor: "var(--as-border)" }}
                >
                  {PAGE_SIZE_OPTIONS.map((pageSize) => (
                    <option key={pageSize} value={pageSize}>{pageSize}</option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                onClick={() => changePage((payload?.pagination.page || filters.page) - 1)}
                disabled={(payload?.pagination.page || filters.page) <= 1 || loading}
                className="inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-black disabled:opacity-40"
                style={{ ...mutedStyle, ...mutedTextStyle }}
              >
                <ChevronLeft className="h-3.5 w-3.5" /> Previous
              </button>
              <button
                type="button"
                onClick={() => changePage((payload?.pagination.page || filters.page) + 1)}
                disabled={(payload?.pagination.page || filters.page) >= (payload?.pagination.total_pages || 1) || loading}
                className="inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-black disabled:opacity-40"
                style={{ ...mutedStyle, ...mutedTextStyle }}
              >
                Next <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </section>
      </div>

      {detailOpen && (
        <ReliabilityDetail
          detail={detail}
          loading={detailLoading}
          error={detailError}
          onClose={closeDetail}
        />
      )}
    </AdminLayout>
  );
}
