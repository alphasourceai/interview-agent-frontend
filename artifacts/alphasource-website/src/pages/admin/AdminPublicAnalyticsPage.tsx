import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertCircle,
  Clock3,
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
  };
  summary?: {
    submitted_leads?: number;
    draft_or_partial_leads?: number;
    public_analytics_events?: number;
    most_active_page?: { path?: string | null; count?: number | null } | null;
    recent_activity_at?: string | null;
    sampled?: boolean;
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
  const [days, setDays] = useState<DaysFilter>("30");
  const [status, setStatus] = useState<LeadStatus>("all");
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
  }, [days, eventName, eventPage, getToken, leadPage, pathFilter, status]);

  useEffect(() => {
    void loadPublicAnalytics();
  }, [loadPublicAnalytics, reloadNonce]);

  const resetPages = useCallback(() => {
    setLeadPage(1);
    setEventPage(1);
  }, []);

  const leads = payload?.leads?.items || [];
  const events = payload?.events?.items || [];
  const summary = payload?.summary || {};
  const dateLabel = payload?.filters?.date_from_display && payload?.filters?.date_to_display
    ? `${payload.filters.date_from_display} to ${payload.filters.date_to_display}`
    : `${days} days`;
  const mostActivePage = summary.most_active_page?.path
    ? `${summary.most_active_page.path} (${formatCount(summary.most_active_page.count)} events)`
    : "Not available";

  const eventNameOptions = useMemo(() => {
    const names = Array.from(new Set(events.map((event) => String(event.event_name || "").trim()).filter(Boolean)));
    return names.slice(0, 8);
  }, [events]);

  return (
    <AdminLayout title="Leads & Public Analytics">
      <div className="space-y-6">
        <section className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-[10px] font-black uppercase tracking-[0.24em]" style={subtleTextStyle}>Admin only</p>
            <h1 className="mt-2 text-2xl font-black sm:text-3xl" style={primaryTextStyle}>Leads & Public Analytics</h1>
            <p className="mt-2 text-sm font-semibold leading-relaxed" style={mutedTextStyle}>
              Read-only view of public site lead captures and public-page activity signals. Broad lists show sanitized summaries, not raw payload dumps.
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
            detail={`Most recent activity: ${formatDateTime(summary.recent_activity_at)}`}
            tone="border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-300"
          />
        </section>

        <section className="rounded-2xl border p-4" style={surfaceCardStyle}>
          <div className="mb-4 flex items-center gap-2">
            <Filter className="h-4 w-4" style={subtleTextStyle} aria-hidden="true" />
            <h2 className="text-sm font-black" style={primaryTextStyle}>Filters</h2>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
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
        </section>

        {error && (
          <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <p className="text-sm font-semibold">{error}</p>
          </div>
        )}

        <section className="rounded-2xl border overflow-hidden" style={surfaceCardStyle}>
          <div className="border-b px-5 py-4" style={dividerStyle}>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-black" style={primaryTextStyle}>Recent lead captures</h2>
                <p className="mt-1 text-xs font-semibold" style={mutedTextStyle}>Contact fields are shown for admin review. Message content is preview-only and submitted-only.</p>
              </div>
              <p className="text-[11px] font-bold" style={subtleTextStyle}>{dateLabel}</p>
            </div>
          </div>
          <div className="divide-y" style={dividerStyle}>
            {loading && leads.length === 0 ? (
              <div className="px-5 py-6 text-sm font-semibold" style={mutedTextStyle}>Loading lead captures...</div>
            ) : leads.length === 0 ? (
              <div className="p-5">
                <EmptyState title="No lead captures match these filters" detail="Try a wider date range or remove the status/page filters." />
              </div>
            ) : (
              leads.map((lead) => (
                <article key={lead.id} className="px-5 py-4">
                  <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
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
                      </div>
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold" style={mutedTextStyle}>
                        {lead.contact?.email && <span><Mail className="mr-1 inline h-3 w-3 align-[-2px]" aria-hidden="true" />{lead.contact.email}</span>}
                        {lead.contact?.phone && <span>{lead.contact.phone}</span>}
                        <span>{lead.source?.path || "/"}</span>
                        <span>Updated {formatDateTime(lead.updated_at)}</span>
                      </div>
                      {lead.message_preview && (
                        <p className="mt-3 rounded-xl border px-3 py-2 text-xs font-semibold leading-relaxed" style={{ ...mutedPanelStyle, color: "var(--as-text-muted)" }}>
                          {lead.message_preview}
                        </p>
                      )}
                    </div>
                    <div className="grid min-w-[220px] grid-cols-2 gap-2 text-[11px] font-semibold xl:text-right">
                      <span style={subtleTextStyle}>Fields</span>
                      <span className="font-black" style={primaryTextStyle}>{lead.progress?.fields_completed_count || 0}</span>
                      <span style={subtleTextStyle}>CTA</span>
                      <span className="truncate font-black" style={primaryTextStyle} title={lead.source?.cta || "Not available"}>{lead.source?.cta || "Not available"}</span>
                      <span style={subtleTextStyle}>Submitted</span>
                      <span className="font-black" style={primaryTextStyle}>{formatDateTime(lead.submitted_at)}</span>
                    </div>
                  </div>
                </article>
              ))
            )}
          </div>
          <PaginationControls pagination={payload?.leads?.pagination} onPageChange={setLeadPage} />
        </section>

        <section className="rounded-2xl border overflow-hidden" style={surfaceCardStyle}>
          <div className="border-b px-5 py-4" style={dividerStyle}>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-black" style={primaryTextStyle}>Recent public analytics events</h2>
                <p className="mt-1 text-xs font-semibold" style={mutedTextStyle}>Shows public-page activity with safe metadata summaries only.</p>
              </div>
              <p className="text-[11px] font-bold" style={subtleTextStyle}>Generated {formatDateTime(payload?.generated_at)}</p>
            </div>
          </div>
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
        </section>
      </div>
    </AdminLayout>
  );
}
