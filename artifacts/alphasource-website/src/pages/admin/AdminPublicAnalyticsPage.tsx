import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertCircle,
  Archive,
  Clock3,
  Download,
  FileText,
  Filter,
  Mail,
  MousePointerClick,
  RefreshCw,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import AdminLayout from "@/components/AdminLayout";
import { supabase } from "@/lib/supabaseClient";

type LeadStatus = "all" | "submitted" | "partial" | "abandoned";
type ArchiveStatus = "active" | "archived" | "all";
type DaysFilter = "7" | "30" | "90";

interface SummaryEntry {
  key: string;
  value: string;
}

interface LeadItem {
  id: string;
  status: string;
  form_id?: string | null;
  form_type?: string | null;
  product_interest?: string | null;
  contact?: {
    first_name?: string | null;
    last_name?: string | null;
    full_name?: string | null;
    email?: string | null;
    phone?: string | null;
  };
  source?: {
    path?: string | null;
    referrer_path?: string | null;
    cta?: string | null;
    utm_summary?: SummaryEntry[];
  };
  progress?: {
    fields_completed_count?: number;
    fields_completed?: string[];
    last_field?: string | null;
  };
  message_preview?: string | null;
  message_character_count?: number;
  archived?: boolean;
  archived_at?: string | null;
  archive_reason?: string | null;
  submitted_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

interface EventItem {
  id: string;
  event_name: string;
  path?: string | null;
  page_title?: string | null;
  referrer_path?: string | null;
  metadata_summary?: SummaryEntry[];
  utm_summary?: SummaryEntry[];
  occurred_at?: string | null;
  created_at?: string | null;
}

interface PaginationInfo {
  page: number;
  limit: number;
  returned: number;
  has_more: boolean;
}

interface PublicAnalyticsPayload {
  generated_at?: string;
  filters?: {
    date_range?: string;
    date_from_display?: string;
    date_to_display?: string;
    archive_status?: ArchiveStatus;
  };
  summary?: {
    submitted_leads?: number;
    draft_or_partial_leads?: number;
    public_analytics_events?: number;
    most_active_page?: { path?: string | null; display_name?: string | null; count?: number | null } | null;
    recent_activity_at?: string | null;
    sampled?: boolean;
  };
  insights?: {
    page_activity?: PageActivityItem[];
    event_types?: EventTypeItem[];
    cta_activity?: CtaActivityItem[];
    form_activity?: FormActivityItem[];
  };
  leads?: {
    items?: LeadItem[];
    pagination?: PaginationInfo;
  };
  events?: {
    items?: EventItem[];
    pagination?: PaginationInfo;
  };
}

interface PageActivityItem {
  path: string;
  display_name?: string | null;
  event_count?: number;
  page_views?: number;
  cta_clicks?: number;
  form_activity?: number;
  lead_count?: number;
  submitted_leads?: number;
  draft_or_partial_leads?: number;
  last_activity_at?: string | null;
}

interface EventTypeItem {
  event_name: string;
  display_name?: string | null;
  count?: number;
}

interface CtaActivityItem {
  label: string;
  placement?: string | null;
  target_path?: string | null;
  count?: number;
  last_clicked_at?: string | null;
}

interface FormActivityItem {
  form_id: string;
  form_type?: string | null;
  product_interest?: string | null;
  event_count?: number;
  viewed?: number;
  started?: number;
  submitted_events?: number;
  abandoned_events?: number;
  draft_saved_events?: number;
  lead_count?: number;
  submitted_leads?: number;
  draft_or_partial_leads?: number;
  last_activity_at?: string | null;
}

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

const surfaceCardStyle = {
  backgroundColor: "var(--as-surface)",
  border: "1px solid var(--as-border)",
  boxShadow: "var(--as-shadow)",
};
const mutedPanelStyle = {
  backgroundColor: "color-mix(in srgb, var(--as-text) 4%, transparent)",
  borderColor: "var(--as-border)",
};
const primaryTextStyle = { color: "var(--as-text)" };
const mutedTextStyle = { color: "var(--as-text-muted)" };
const subtleTextStyle = { color: "var(--as-text-subtle)" };
const fieldStyle = {
  backgroundColor: "var(--as-surface)",
  borderColor: "var(--as-border)",
  color: "var(--as-text)",
};
const dividerStyle = { borderColor: "var(--as-border)" };

function parseJsonSafe(text: string): unknown {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function extractErrorMessage(text: string, fallback: string): string {
  if (!text) return fallback;
  const data = parseJsonSafe(text);
  const detail =
    data && typeof data === "object"
      ? (data as { detail?: unknown }).detail ??
        (data as { message?: unknown }).message ??
        (data as { error?: unknown }).error
      : null;
  if (typeof detail === "string" && detail.trim()) return detail;
  return fallback;
}

function filenameFromDisposition(value: string | null): string {
  const raw = String(value || "");
  const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(raw);
  const filename = match ? decodeURIComponent(match[1] || "").trim() : "";
  return filename || "public-leads.csv";
}

function formatDateTime(value: unknown): string {
  const raw = String(value || "").trim();
  if (!raw) return "Not available";
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return "Not available";
  return parsed.toLocaleString();
}

function titleCase(value: unknown): string {
  const raw = String(value || "").trim();
  if (!raw) return "Unknown";
  return raw
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function pageLabel(path?: string | null, displayName?: string | null): string {
  const label = String(displayName || "").trim();
  if (label) return label;
  const clean = String(path || "/").trim() || "/";
  if (clean === "/") return "Homepage";
  return clean;
}

function pathLabel(path?: string | null): string {
  return String(path || "/").trim() || "/";
}

function formatCount(value: unknown): string {
  const numeric = Number(value || 0);
  return Number.isFinite(numeric) ? numeric.toLocaleString() : "0";
}

function statusClass(status: unknown): string {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "submitted") return "bg-[#02D99D]/10 text-[#00886A]";
  if (normalized === "abandoned") return "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300";
  if (normalized === "partial") return "bg-[#A380F6]/10 text-[#7C5FCC]";
  return "bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-white/70";
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-black ${statusClass(status)}`}>
      {titleCase(status)}
    </span>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  detail,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  detail: string;
  tone: string;
}) {
  return (
    <section className="rounded-2xl border p-4" style={surfaceCardStyle}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-widest" style={subtleTextStyle}>{label}</p>
          <p className="mt-2 text-2xl font-black" style={primaryTextStyle}>{value}</p>
        </div>
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${tone}`}>
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>
      </div>
      <p className="mt-3 text-xs font-semibold leading-relaxed" style={mutedTextStyle}>{detail}</p>
    </section>
  );
}

function InsightPanel({
  title,
  detail,
  children,
}: {
  title: string;
  detail: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border overflow-hidden" style={surfaceCardStyle}>
      <div className="border-b px-5 py-4" style={dividerStyle}>
        <h2 className="text-sm font-black" style={primaryTextStyle}>{title}</h2>
        <p className="mt-1 text-xs font-semibold leading-relaxed" style={mutedTextStyle}>{detail}</p>
      </div>
      <div className="divide-y" style={dividerStyle}>
        {children}
      </div>
    </section>
  );
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="rounded-2xl border px-5 py-8 text-center" style={mutedPanelStyle}>
      <p className="text-sm font-black" style={primaryTextStyle}>{title}</p>
      <p className="mt-2 text-xs font-semibold" style={mutedTextStyle}>{detail}</p>
    </div>
  );
}

function MetadataChips({ entries }: { entries?: SummaryEntry[] }) {
  const safeEntries = Array.isArray(entries) ? entries.slice(0, 5) : [];
  if (safeEntries.length === 0) return <span style={subtleTextStyle}>No safe metadata summary</span>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {safeEntries.map((entry) => (
        <span
          key={`${entry.key}:${entry.value}`}
          className="max-w-full truncate rounded-full border px-2 py-0.5 text-[11px] font-bold"
          style={{ ...mutedPanelStyle, color: "var(--as-text-muted)" }}
          title={`${entry.key}: ${entry.value}`}
        >
          {entry.key}: {entry.value}
        </span>
      ))}
    </div>
  );
}

function PaginationControls({
  pagination,
  onPageChange,
}: {
  pagination?: PaginationInfo;
  onPageChange: (page: number) => void;
}) {
  if (!pagination || (pagination.page <= 1 && !pagination.has_more)) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t px-5 py-3" style={dividerStyle}>
      <p className="text-[11px] font-semibold" style={subtleTextStyle}>
        Page {pagination.page} · {pagination.returned} shown
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={pagination.page <= 1}
          onClick={() => onPageChange(Math.max(1, pagination.page - 1))}
          className="rounded-full border px-3 py-1.5 text-xs font-bold transition-colors hover:bg-[var(--as-hover)] disabled:cursor-not-allowed disabled:opacity-45"
          style={fieldStyle}
        >
          Previous
        </button>
        <button
          type="button"
          disabled={!pagination.has_more}
          onClick={() => onPageChange(pagination.page + 1)}
          className="rounded-full border px-3 py-1.5 text-xs font-bold transition-colors hover:bg-[var(--as-hover)] disabled:cursor-not-allowed disabled:opacity-45"
          style={fieldStyle}
        >
          Next
        </button>
      </div>
    </div>
  );
}

export default function AdminPublicAnalyticsPage() {
  const [payload, setPayload] = useState<PublicAnalyticsPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [csvExporting, setCsvExporting] = useState(false);
  const [csvExportError, setCsvExportError] = useState("");
  const [archiveActionError, setArchiveActionError] = useState("");
  const [archiveActionLoading, setArchiveActionLoading] = useState(false);
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);
  const [days, setDays] = useState<DaysFilter>("30");
  const [status, setStatus] = useState<LeadStatus>("all");
  const [archiveStatus, setArchiveStatus] = useState<ArchiveStatus>("active");
  const [eventName, setEventName] = useState("");
  const [pathFilter, setPathFilter] = useState("");
  const [leadPage, setLeadPage] = useState(1);
  const [eventPage, setEventPage] = useState(1);
  const [reloadNonce, setReloadNonce] = useState(0);

  const getToken = useCallback(async (): Promise<string> => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const token = String(session?.access_token || "").trim();
    if (!token) throw new Error("Missing session token.");
    return token;
  }, []);

  const loadPublicAnalytics = useCallback(async () => {
    if (!backendBase) {
      setPayload(null);
      setError("Missing backend base URL configuration.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const token = await getToken();
      const params = new URLSearchParams({
        days,
        lead_page: String(leadPage),
        event_page: String(eventPage),
        lead_limit: "25",
        event_limit: "25",
      });
      if (status !== "all") params.set("status", status);
      params.set("archive_status", archiveStatus);
      if (eventName.trim()) params.set("event_name", eventName.trim().toLowerCase());
      if (pathFilter.trim()) params.set("path", pathFilter.trim());
      const response = await fetch(`${backendBase}/admin/public-analytics?${params.toString()}`, {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
        credentials: "omit",
      });
      const text = await response.text();
      if (!response.ok) throw new Error(extractErrorMessage(text, "Could not load public analytics."));
      setPayload((parseJsonSafe(text) as PublicAnalyticsPayload | null) || null);
    } catch (loadError) {
      setPayload(null);
      setError(loadError instanceof Error ? loadError.message : "Could not load public analytics.");
    } finally {
      setLoading(false);
    }
  }, [archiveStatus, days, eventName, eventPage, getToken, leadPage, pathFilter, status]);

  useEffect(() => {
    void loadPublicAnalytics();
  }, [loadPublicAnalytics, reloadNonce]);

  const resetPages = useCallback(() => {
    setLeadPage(1);
    setEventPage(1);
  }, []);

  const exportLeadsCsv = useCallback(async () => {
    if (!backendBase) {
      setCsvExportError("Missing backend base URL configuration.");
      return;
    }
    setCsvExporting(true);
    setCsvExportError("");
    try {
      const token = await getToken();
      const params = new URLSearchParams({ days });
      if (status !== "all") params.set("status", status);
      params.set("archive_status", archiveStatus);
      if (pathFilter.trim()) params.set("path", pathFilter.trim());
      const response = await fetch(`${backendBase}/admin/public-analytics/leads.csv?${params.toString()}`, {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
        credentials: "omit",
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(extractErrorMessage(text, "Could not export lead captures."));
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filenameFromDisposition(response.headers.get("Content-Disposition"));
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => window.URL.revokeObjectURL(url), 1000);
    } catch (exportError) {
      setCsvExportError(exportError instanceof Error ? exportError.message : "Could not export lead captures.");
    } finally {
      setCsvExporting(false);
    }
  }, [archiveStatus, days, getToken, pathFilter, status]);

  const updateSelectedLeadArchiveState = useCallback(async (action: "archive" | "unarchive") => {
    const leadIds = selectedLeadIds.map((id) => id.trim()).filter(Boolean);
    if (leadIds.length === 0) return;
    if (!backendBase) {
      setArchiveActionError("Missing backend base URL configuration.");
      return;
    }
    const confirmed = window.confirm(
      action === "archive"
        ? `Archive selected lead captures?\n\nThis hides ${leadIds.length} selected lead capture${leadIds.length === 1 ? "" : "s"} from the default Active view. The records remain available in Archived view and are not deleted.`
        : `Unarchive selected lead captures?\n\nThis restores ${leadIds.length} selected lead capture${leadIds.length === 1 ? "" : "s"} to the default Active view.`,
    );
    if (!confirmed) return;

    setArchiveActionLoading(true);
    setArchiveActionError("");
    try {
      const token = await getToken();
      const response = await fetch(`${backendBase}/admin/public-analytics/leads/${action}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        credentials: "omit",
        body: JSON.stringify({
          lead_ids: leadIds,
          ...(action === "archive" ? { reason: "Manual admin archive" } : {}),
        }),
      });
      const text = await response.text();
      if (!response.ok) {
        throw new Error(extractErrorMessage(text, action === "archive" ? "Could not archive lead capture." : "Could not unarchive lead capture."));
      }
      setSelectedLeadIds([]);
      setReloadNonce((value) => value + 1);
    } catch (archiveError) {
      setArchiveActionError(archiveError instanceof Error ? archiveError.message : "Could not update lead capture.");
    } finally {
      setArchiveActionLoading(false);
    }
  }, [getToken, selectedLeadIds]);

  const leads = payload?.leads?.items || [];
  const events = payload?.events?.items || [];
  const summary = payload?.summary || {};
  const insights = payload?.insights || {};
  const pageActivity = insights.page_activity || [];
  const eventTypes = insights.event_types || [];
  const ctaActivity = insights.cta_activity || [];
  const formActivity = insights.form_activity || [];
  const visibleLeadIds = useMemo(
    () => leads.map((lead) => String(lead.id || "").trim()).filter(Boolean),
    [leads],
  );
  const selectedVisibleLeads = useMemo(
    () => leads.filter((lead) => selectedLeadIds.includes(String(lead.id || "").trim())),
    [leads, selectedLeadIds],
  );
  const selectedCount = selectedVisibleLeads.length;
  const allVisibleSelected = visibleLeadIds.length > 0 && visibleLeadIds.every((id) => selectedLeadIds.includes(id));
  const selectedArchivedCount = selectedVisibleLeads.filter((lead) => lead.archived === true || Boolean(lead.archived_at)).length;
  const selectedActiveCount = selectedCount - selectedArchivedCount;
  const selectedArchiveAction: "archive" | "unarchive" | null =
    selectedCount === 0
      ? null
      : archiveStatus === "active"
        ? "archive"
        : archiveStatus === "archived"
          ? "unarchive"
          : selectedArchivedCount === selectedCount
            ? "unarchive"
            : selectedActiveCount === selectedCount
              ? "archive"
              : null;
  const selectedActionLabel = selectedArchiveAction === "unarchive" ? "Unarchive selected" : "Archive selected";
  const selectedActionDisabled = archiveActionLoading || selectedCount === 0 || !selectedArchiveAction;

  useEffect(() => {
    setSelectedLeadIds((ids) => {
      const next = ids.filter((id) => visibleLeadIds.includes(id));
      return next.length === ids.length ? ids : next;
    });
  }, [visibleLeadIds]);

  useEffect(() => {
    setSelectedLeadIds([]);
  }, [archiveStatus, days, eventName, pathFilter, status]);
  const dateLabel = payload?.filters?.date_from_display && payload?.filters?.date_to_display
    ? `${payload.filters.date_from_display} to ${payload.filters.date_to_display}`
    : `${days} days`;
  const mostActivePage = summary.most_active_page?.path
    ? pageLabel(summary.most_active_page.path, summary.most_active_page.display_name)
    : "Not available";
  const mostActivePageDetail = summary.most_active_page?.path
    ? `${formatCount(summary.most_active_page.count)} matching public events. Includes page views, CTA clicks, and form activity.`
    : "Based on matching public events in the selected date range.";

  const eventNameOptions = useMemo(() => {
    const names = Array.from(new Set([
      ...eventTypes.map((event) => String(event.event_name || "").trim()).filter(Boolean),
      ...events.map((event) => String(event.event_name || "").trim()).filter(Boolean),
    ]));
    return names.slice(0, 8);
  }, [eventTypes, events]);

  return (
    <AdminLayout title="Leads & Public Analytics">
      <div className="space-y-6">
        <section className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-[10px] font-black uppercase tracking-[0.24em]" style={subtleTextStyle}>Admin only</p>
            <h1 className="mt-2 text-2xl font-black sm:text-3xl" style={primaryTextStyle}>Leads & Public Analytics</h1>
            <p className="mt-2 text-sm font-semibold leading-relaxed" style={mutedTextStyle}>
              Review public site lead captures and public-page activity signals. Summaries use the current filters and show sanitized counts, not raw payload dumps.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setReloadNonce((value) => value + 1)}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-black text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            style={{ backgroundColor: "#A380F6" }}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} aria-hidden="true" />
            Refresh
          </button>
        </section>

        <section className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            icon={UserRound}
            label="Submitted leads"
            value={formatCount(summary.submitted_leads)}
            detail={`Submitted public lead captures in ${dateLabel}.`}
            tone="border-[#02D99D]/25 bg-[#02D99D]/5 text-[#00886A]"
          />
          <SummaryCard
            icon={FileText}
            label="Draft / partial leads"
            value={formatCount(summary.draft_or_partial_leads)}
            detail="Partial or abandoned captures with contact information saved."
            tone="border-[#A380F6]/25 bg-[#A380F6]/5 text-[#7C5FCC]"
          />
          <SummaryCard
            icon={MousePointerClick}
            label="Public events"
            value={formatCount(summary.public_analytics_events)}
            detail={summary.sampled ? "Sampled from recent matching events." : "Matching public analytics events returned."}
            tone="border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-500/25 dark:bg-sky-500/10 dark:text-sky-300"
          />
          <SummaryCard
            icon={Activity}
            label="Most active page"
            value={mostActivePage}
            detail={mostActivePageDetail}
            tone="border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-300"
          />
        </section>

        <section className="rounded-2xl border p-4" style={surfaceCardStyle}>
          <div className="mb-4 flex items-center gap-2">
            <Filter className="h-4 w-4" style={subtleTextStyle} aria-hidden="true" />
            <h2 className="text-sm font-black" style={primaryTextStyle}>Filters</h2>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
            <label className="space-y-1.5">
              <span className="text-[10px] font-black uppercase tracking-widest" style={subtleTextStyle}>Date range</span>
              <select
                value={days}
                onChange={(event) => { resetPages(); setDays(event.target.value as DaysFilter); }}
                className="w-full rounded-xl border px-3 py-2 text-sm font-semibold outline-none focus:ring-2 focus:ring-[#A380F6]"
                style={fieldStyle}
              >
                <option value="7">Last 7 days</option>
                <option value="30">Last 30 days</option>
                <option value="90">Last 90 days</option>
              </select>
            </label>
            <label className="space-y-1.5">
              <span className="text-[10px] font-black uppercase tracking-widest" style={subtleTextStyle}>Lead status</span>
              <select
                value={status}
                onChange={(event) => { resetPages(); setStatus(event.target.value as LeadStatus); }}
                className="w-full rounded-xl border px-3 py-2 text-sm font-semibold outline-none focus:ring-2 focus:ring-[#A380F6]"
                style={fieldStyle}
              >
                <option value="all">All lead statuses</option>
                <option value="submitted">Submitted</option>
                <option value="partial">Partial</option>
                <option value="abandoned">Abandoned</option>
              </select>
            </label>
            <label className="space-y-1.5">
              <span className="text-[10px] font-black uppercase tracking-widest" style={subtleTextStyle}>Archive view</span>
              <select
                value={archiveStatus}
                onChange={(event) => { resetPages(); setArchiveStatus(event.target.value as ArchiveStatus); }}
                className="w-full rounded-xl border px-3 py-2 text-sm font-semibold outline-none focus:ring-2 focus:ring-[#A380F6]"
                style={fieldStyle}
              >
                <option value="active">Active</option>
                <option value="archived">Archived</option>
                <option value="all">All</option>
              </select>
            </label>
            <label className="space-y-1.5">
              <span className="text-[10px] font-black uppercase tracking-widest" style={subtleTextStyle}>Event name</span>
              <input
                value={eventName}
                onChange={(event) => { resetPages(); setEventName(event.target.value); }}
                list="public-analytics-event-names"
                placeholder="page_view"
                className="w-full rounded-xl border px-3 py-2 text-sm font-semibold outline-none focus:ring-2 focus:ring-[#A380F6]"
                style={fieldStyle}
              />
              <datalist id="public-analytics-event-names">
                {eventNameOptions.map((name) => <option key={name} value={name} />)}
              </datalist>
            </label>
            <label className="space-y-1.5">
              <span className="text-[10px] font-black uppercase tracking-widest" style={subtleTextStyle}>Page path</span>
              <input
                value={pathFilter}
                onChange={(event) => { resetPages(); setPathFilter(event.target.value); }}
                placeholder="/alphascreen"
                className="w-full rounded-xl border px-3 py-2 text-sm font-semibold outline-none focus:ring-2 focus:ring-[#A380F6]"
                style={fieldStyle}
              />
            </label>
          </div>
          <p className="mt-3 text-[11px] font-semibold" style={subtleTextStyle}>
            Summary cards, insight sections, lead captures, and the troubleshooting event log are based on these filters.
          </p>
        </section>

        {error && (
          <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <p className="text-sm font-semibold">{error}</p>
          </div>
        )}

        <section className="rounded-2xl border overflow-hidden" style={surfaceCardStyle}>
          <div className="border-b px-5 py-4" style={dividerStyle}>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h2 className="text-lg font-black" style={primaryTextStyle}>Recent lead captures</h2>
                <p className="mt-1 text-xs font-semibold" style={mutedTextStyle}>Submitted leads and contact-ready partial leads stay visible for review. Archived captures are hidden from the default Active view.</p>
                <p className="mt-1 text-[11px] font-bold" style={subtleTextStyle}>{dateLabel} · {titleCase(archiveStatus)} view</p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <button
                  type="button"
                  onClick={exportLeadsCsv}
                  disabled={csvExporting || !backendBase}
                  className="inline-flex items-center justify-center gap-2 rounded-full border px-4 py-2 text-xs font-black transition-colors hover:bg-[var(--as-hover)] disabled:cursor-not-allowed disabled:opacity-55"
                  style={fieldStyle}
                >
                  <Download className="h-4 w-4" aria-hidden="true" />
                  {csvExporting ? "Exporting..." : "Export leads CSV"}
                </button>
                <button
                  type="button"
                  onClick={() => selectedArchiveAction && void updateSelectedLeadArchiveState(selectedArchiveAction)}
                  disabled={selectedActionDisabled}
                  className="inline-flex items-center justify-center gap-2 rounded-full border px-4 py-2 text-xs font-black transition-colors hover:bg-[var(--as-hover)] disabled:cursor-not-allowed disabled:opacity-55"
                  style={fieldStyle}
                >
                  <Archive className="h-4 w-4" aria-hidden="true" />
                  {archiveActionLoading ? "Updating..." : `${selectedActionLabel}${selectedCount ? ` (${selectedCount})` : ""}`}
                </button>
              </div>
            </div>
            {archiveStatus === "all" && selectedCount > 0 && !selectedArchiveAction && (
              <p className="mt-3 text-[11px] font-semibold text-amber-700 dark:text-amber-300">
                Select only active leads or only archived leads before using the bulk archive action.
              </p>
            )}
            {visibleLeadIds.length > 0 && (
              <label className="mt-4 inline-flex items-center gap-2 text-xs font-black" style={mutedTextStyle}>
                <input
                  type="checkbox"
                  checked={allVisibleSelected}
                  onChange={(event) => {
                    setSelectedLeadIds(event.target.checked ? visibleLeadIds : []);
                    setArchiveActionError("");
                  }}
                  className="h-4 w-4 rounded border"
                />
                Select all visible
              </label>
            )}
          </div>
          {csvExportError && (
            <div className="border-b px-5 py-3 text-xs font-semibold text-red-600 dark:text-red-300" style={dividerStyle}>
              {csvExportError}
            </div>
          )}
          {archiveActionError && (
            <div className="border-b px-5 py-3 text-xs font-semibold text-red-600 dark:text-red-300" style={dividerStyle}>
              {archiveActionError}
            </div>
          )}
          <div className="divide-y" style={dividerStyle}>
            {loading && leads.length === 0 ? (
              <div className="px-5 py-6 text-sm font-semibold" style={mutedTextStyle}>Loading lead captures...</div>
            ) : leads.length === 0 ? (
              <div className="p-5">
                <EmptyState title="No lead captures match these filters" detail="Try a wider date range or adjust the status, archive, or page filters." />
              </div>
            ) : (
              leads.map((lead) => {
                const submitted = String(lead.status || "").toLowerCase() === "submitted";
                const archived = lead.archived === true || Boolean(lead.archived_at);
                return (
                <article key={lead.id} className={`px-5 py-4 ${submitted ? "bg-[#02D99D]/[0.035]" : ""}`}>
                  <div className="flex gap-3">
                    <label className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center">
                      <input
                        type="checkbox"
                        checked={selectedLeadIds.includes(lead.id)}
                        onChange={(event) => {
                          setArchiveActionError("");
                          setSelectedLeadIds((ids) => {
                            if (event.target.checked) return Array.from(new Set([...ids, lead.id]));
                            return ids.filter((id) => id !== lead.id);
                          });
                        }}
                        className="h-4 w-4 rounded border"
                        aria-label={`Select lead capture ${lead.contact?.full_name || lead.contact?.email || lead.contact?.phone || lead.id}`}
                      />
                    </label>
                    <div className="flex min-w-0 flex-1 flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusBadge status={lead.status} />
                        <span className="text-sm font-black" style={primaryTextStyle}>
                          {lead.contact?.full_name || lead.contact?.email || lead.contact?.phone || "Contact saved"}
                        </span>
                        {lead.product_interest && (
                          <span className="rounded-full border px-2 py-0.5 text-[11px] font-bold" style={{ ...mutedPanelStyle, color: "var(--as-text-muted)" }}>
                            {lead.product_interest}
                          </span>
                        )}
                        {archived && (
                          <span className="rounded-full border border-slate-300 bg-slate-100 px-2 py-0.5 text-[11px] font-black text-slate-600 dark:border-white/15 dark:bg-white/10 dark:text-white/70">
                            Archived
                          </span>
                        )}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold" style={mutedTextStyle}>
                        {lead.contact?.email && <span><Mail className="mr-1 inline h-3 w-3 align-[-2px]" aria-hidden="true" />{lead.contact.email}</span>}
                        {lead.contact?.phone && <span>{lead.contact.phone}</span>}
                        <span>{pageLabel(lead.source?.path)} · {pathLabel(lead.source?.path)}</span>
                        <span>Updated {formatDateTime(lead.updated_at)}</span>
                        {archived && <span>Archived {formatDateTime(lead.archived_at)}</span>}
                      </div>
                      {lead.message_preview && (
                        <p className="mt-3 rounded-xl border px-3 py-2 text-xs font-semibold leading-relaxed" style={{ ...mutedPanelStyle, color: "var(--as-text-muted)" }}>
                          {lead.message_preview}
                        </p>
                      )}
                    </div>
                    <div className="min-w-[220px] space-y-3 xl:text-right">
                      <div className="grid grid-cols-2 gap-2 text-[11px] font-semibold">
                        <span style={subtleTextStyle}>Fields</span>
                        <span className="font-black" style={primaryTextStyle}>{lead.progress?.fields_completed_count || 0}</span>
                        <span style={subtleTextStyle}>CTA</span>
                        <span className="truncate font-black" style={primaryTextStyle} title={lead.source?.cta || "Not available"}>{lead.source?.cta || "Not available"}</span>
                        <span style={subtleTextStyle}>Submitted</span>
                        <span className="font-black" style={primaryTextStyle}>{formatDateTime(lead.submitted_at)}</span>
                      </div>
                    </div>
                    </div>
                  </div>
                </article>
              );
              })
            )}
          </div>
          <PaginationControls pagination={payload?.leads?.pagination} onPageChange={setLeadPage} />
        </section>

        <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <InsightPanel
            title="Page activity summary"
            detail="Public page performance in the selected range, grouped by page instead of raw event order."
          >
            {loading && pageActivity.length === 0 ? (
              <div className="px-5 py-6 text-sm font-semibold" style={mutedTextStyle}>Loading page activity...</div>
            ) : pageActivity.length === 0 ? (
              <div className="p-5">
                <EmptyState title="No page activity yet" detail="Try a wider date range or remove the page filter." />
              </div>
            ) : pageActivity.map((page) => (
              <article key={page.path} className="px-5 py-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black" style={primaryTextStyle}>{pageLabel(page.path, page.display_name)}</p>
                    <p className="mt-1 text-xs font-semibold" style={mutedTextStyle}>{pathLabel(page.path)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-black" style={primaryTextStyle}>{formatCount((page.event_count || 0) + (page.lead_count || 0))}</p>
                    <p className="text-[10px] font-black uppercase tracking-widest" style={subtleTextStyle}>signals</p>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] font-semibold sm:grid-cols-4" style={mutedTextStyle}>
                  <span>{formatCount(page.page_views)} page views</span>
                  <span>{formatCount(page.cta_clicks)} CTA clicks</span>
                  <span>{formatCount(page.form_activity)} form events</span>
                  <span>{formatCount(page.lead_count)} leads</span>
                </div>
              </article>
            ))}
          </InsightPanel>

          <InsightPanel
            title="CTA activity summary"
            detail="Public calls to action ranked by matching click events."
          >
            {loading && ctaActivity.length === 0 ? (
              <div className="px-5 py-6 text-sm font-semibold" style={mutedTextStyle}>Loading CTA activity...</div>
            ) : ctaActivity.length === 0 ? (
              <div className="p-5">
                <EmptyState title="No CTA clicks match these filters" detail="CTA clicks will appear here after public visitors interact with tracked links." />
              </div>
            ) : ctaActivity.map((cta) => (
              <article key={`${cta.label}:${cta.placement}:${cta.target_path}`} className="px-5 py-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black" style={primaryTextStyle}>{cta.label || "Unknown CTA"}</p>
                    <p className="mt-1 truncate text-xs font-semibold" style={mutedTextStyle}>
                      {cta.placement || "Unknown placement"} · {cta.target_path || "Unknown target"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-black" style={primaryTextStyle}>{formatCount(cta.count)}</p>
                    <p className="text-[10px] font-black uppercase tracking-widest" style={subtleTextStyle}>clicks</p>
                  </div>
                </div>
              </article>
            ))}
          </InsightPanel>

          <InsightPanel
            title="Form activity summary"
            detail="Lead form progress and saved lead records, grouped by form."
          >
            {loading && formActivity.length === 0 ? (
              <div className="px-5 py-6 text-sm font-semibold" style={mutedTextStyle}>Loading form activity...</div>
            ) : formActivity.length === 0 ? (
              <div className="p-5">
                <EmptyState title="No form activity match these filters" detail="Form views, starts, saved drafts, and submitted leads will summarize here." />
              </div>
            ) : formActivity.map((form) => (
              <article key={`${form.form_id}:${form.form_type}:${form.product_interest || ""}`} className="px-5 py-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black" style={primaryTextStyle}>{form.product_interest || titleCase(form.form_id)}</p>
                    <p className="mt-1 truncate text-xs font-semibold" style={mutedTextStyle}>
                      {form.form_id} · {titleCase(form.form_type)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-black" style={primaryTextStyle}>{formatCount(form.submitted_leads)}</p>
                    <p className="text-[10px] font-black uppercase tracking-widest" style={subtleTextStyle}>submitted</p>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] font-semibold sm:grid-cols-4" style={mutedTextStyle}>
                  <span>{formatCount(form.viewed)} views</span>
                  <span>{formatCount(form.started)} starts</span>
                  <span>{formatCount(form.draft_saved_events)} saved drafts</span>
                  <span>{formatCount(form.draft_or_partial_leads)} partial leads</span>
                </div>
              </article>
            ))}
          </InsightPanel>

          <InsightPanel
            title="Event type summary"
            detail="High-level event mix for the selected range."
          >
            {loading && eventTypes.length === 0 ? (
              <div className="px-5 py-6 text-sm font-semibold" style={mutedTextStyle}>Loading event mix...</div>
            ) : eventTypes.length === 0 ? (
              <div className="p-5">
                <EmptyState title="No event types match these filters" detail="Public analytics event categories will appear here." />
              </div>
            ) : eventTypes.map((event) => (
              <article key={event.event_name} className="flex items-center justify-between gap-4 px-5 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-black" style={primaryTextStyle}>{event.display_name || titleCase(event.event_name)}</p>
                  <p className="mt-1 truncate text-xs font-semibold" style={mutedTextStyle}>{event.event_name}</p>
                </div>
                <p className="text-lg font-black" style={primaryTextStyle}>{formatCount(event.count)}</p>
              </article>
            ))}
          </InsightPanel>
        </section>

        <details className="rounded-2xl border overflow-hidden" style={surfaceCardStyle}>
          <summary className="cursor-pointer list-none border-b px-5 py-4 transition-colors hover:bg-[var(--as-hover)]" style={dividerStyle}>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-black" style={primaryTextStyle}>Recent public analytics events</h2>
                <p className="mt-1 text-xs font-semibold" style={mutedTextStyle}>Troubleshooting event log. Open only when you need recent sanitized event details.</p>
              </div>
              <p className="text-[11px] font-bold" style={subtleTextStyle}>Generated {formatDateTime(payload?.generated_at)}</p>
            </div>
          </summary>
          <div className="divide-y" style={dividerStyle}>
            {loading && events.length === 0 ? (
              <div className="px-5 py-6 text-sm font-semibold" style={mutedTextStyle}>Loading public analytics events...</div>
            ) : events.length === 0 ? (
              <div className="p-5">
                <EmptyState title="No public events match these filters" detail="Try a wider date range or remove the event/page filters." />
              </div>
            ) : (
              events.map((event) => (
                <article key={event.id} className="px-5 py-4">
                  <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(220px,0.7fr)_minmax(260px,1fr)_minmax(180px,auto)] lg:items-start">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black" style={primaryTextStyle}>{titleCase(event.event_name)}</p>
                      <p className="mt-1 truncate text-xs font-semibold" style={mutedTextStyle} title={event.path || "/"}>{event.path || "/"}</p>
                    </div>
                    <div className="min-w-0">
                      <MetadataChips entries={event.metadata_summary} />
                      {event.utm_summary && event.utm_summary.length > 0 && (
                        <div className="mt-2">
                          <MetadataChips entries={event.utm_summary} />
                        </div>
                      )}
                    </div>
                    <p className="text-xs font-semibold lg:text-right" style={subtleTextStyle}>
                      <Clock3 className="mr-1 inline h-3 w-3 align-[-2px]" aria-hidden="true" />
                      {formatDateTime(event.occurred_at)}
                    </p>
                  </div>
                </article>
              ))
            )}
          </div>
          <PaginationControls pagination={payload?.events?.pagination} onPageChange={setEventPage} />
        </details>
      </div>
    </AdminLayout>
  );
}
