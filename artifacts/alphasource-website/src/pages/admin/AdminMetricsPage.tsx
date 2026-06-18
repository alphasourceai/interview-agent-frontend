import { useCallback, useEffect, useMemo, useState, type ElementType, type ReactNode } from "react";
import {
  AlertTriangle,
  Briefcase,
  Building2,
  CheckCircle2,
  Clock3,
  MailWarning,
  RefreshCw,
  ShieldCheck,
  Users,
  Video,
} from "lucide-react";
import AdminLayout from "@/components/AdminLayout";
import { useAdminClient } from "@/context/AdminClientContext";
import {
  buildEntityFilterOptions,
  entityFilterQueryValue,
  type EntityFilterValue,
} from "@/lib/entityFilters";
import { supabase } from "@/lib/supabaseClient";

interface MetricsOverview {
  active_clients?: number;
  active_roles?: number;
  candidates_in_range?: number;
  interviews_started?: number;
  interviews_completed?: number;
  reports_generated?: number;
  automation_pending_approvals?: number;
  email_delivery_failures?: number;
}

interface FunnelRow {
  key: string;
  label: string;
  count: number;
}

interface MetricsAutomation {
  rule_status_counts?: Record<string, number>;
  evaluation_status_counts?: Record<string, number>;
  action_state_counts?: Record<string, number>;
  digest_status_counts?: Record<string, number>;
  approval_links?: {
    active?: number;
    expired?: number;
    action?: Record<string, number>;
    digest?: Record<string, number>;
  };
  pending_approvals?: number;
  approved_actions?: number;
  rejected_actions?: number;
  sent_actions?: number;
  failed_actions?: number;
}

interface MetricsEmail {
  normalized_counts?: Record<string, number>;
  event_type_counts?: Record<string, number>;
  recent_problem_events?: Array<{
    id?: string | null;
    event_at?: string | null;
    event_type?: string | null;
    category?: string | null;
    detail?: string | null;
  }>;
  scope?: string;
}

interface MetricsReadiness {
  recording_ready?: number;
  recording_pending?: number;
  recording_problem?: number;
  recording_deleted?: number;
  report_generated?: number;
  missing_report_after_complete?: number;
  perception_event_received?: number;
  perception_missing_after_video_completion?: number;
  transcript_ready?: number;
}

interface EntityOpsRow {
  client_id?: string | null;
  client_name?: string | null;
  entity_name?: string | null;
  child_entity_count?: number;
  archived_child_entity_count?: number;
  member_count?: number;
  role_count?: number;
  candidate_count?: number;
  archived?: boolean;
}

interface MetricsEntityOperations {
  parent_client_count?: number;
  child_entity_count?: number;
  archived_child_entity_count?: number;
  member_count?: number;
  rows?: EntityOpsRow[];
  by_entity?: EntityOpsRow[];
}

interface AttentionItem {
  type?: string | null;
  client_name?: string | null;
  entity_name?: string | null;
  role_title?: string | null;
  candidate_name?: string | null;
  status?: string | null;
  age?: string | null;
  detail?: string | null;
  suggested_action?: string | null;
}

interface MetricsPayload {
  ok?: boolean;
  generated_at?: string;
  filters?: {
    selected_client_id?: string | null;
    entity_filter?: string | null;
    role_id?: string | null;
    date_from_display?: string | null;
    date_to_display?: string | null;
  };
  overview?: MetricsOverview;
  interview_funnel?: FunnelRow[];
  automation?: MetricsAutomation;
  email?: MetricsEmail;
  readiness?: MetricsReadiness;
  entity_operations?: MetricsEntityOperations;
  attention?: {
    items?: AttentionItem[];
    thresholds?: Record<string, number>;
  };
  sources?: {
    row_counts?: Record<string, number>;
    warnings?: Array<{ table?: string; code?: string; detail?: string }>;
    scope_notes?: string[];
  };
  request_id?: string | null;
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
const inputClass =
  "w-full h-10 rounded-xl border px-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-[#A380F6]/30";
const inputStyle = {
  backgroundColor: "var(--as-surface)",
  borderColor: "var(--as-border)",
  color: "var(--as-text)",
};
const primaryTextStyle = { color: "var(--as-text)" };
const mutedTextStyle = { color: "var(--as-text-muted)" };
const subtleTextStyle = { color: "var(--as-text-subtle)" };
const dividerStyle = { borderColor: "var(--as-border)" };
const DATE_OPTIONS = [7, 30, 90] as const;

function parseJsonSafe(text: string): unknown {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function errorMessageFromResponse(text: string, fallback: string): string {
  if (!text) return fallback;
  const data = parseJsonSafe(text);
  const detail =
    data && typeof data === "object"
      ? (data as { detail?: unknown }).detail ??
        (data as { message?: unknown }).message ??
        (data as { error?: unknown }).error
      : null;
  if (typeof detail === "string" && detail.trim()) return detail;
  return text || fallback;
}

function dateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function dateFromDays(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - Math.max(0, days - 1));
  return dateOnly(date);
}

function formatNumber(value: unknown): string {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed.toLocaleString() : "0";
}

function formatDateTime(value: unknown): string {
  const raw = String(value || "").trim();
  if (!raw) return "Never";
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return "Never";
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

function countValue(source: Record<string, number> | undefined, key: string): number {
  return Number(source?.[key] || 0);
}

function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
  tone = "neutral",
}: {
  label: string;
  value: string;
  detail: string;
  icon: ElementType;
  tone?: "neutral" | "attention" | "good";
}) {
  const iconColor = tone === "attention" ? "#C94040" : tone === "good" ? "#009E73" : "#A380F6";
  return (
    <div className="rounded-2xl p-4" style={surfaceCardStyle}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] font-black uppercase tracking-widest" style={subtleTextStyle}>{label}</p>
        <Icon className="w-4 h-4" style={{ color: iconColor }} />
      </div>
      <p className="mt-3 text-2xl font-black" style={primaryTextStyle}>{value}</p>
      <p className="mt-1 text-xs font-semibold" style={mutedTextStyle}>{detail}</p>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="px-4 py-8 text-center text-sm font-semibold" style={mutedTextStyle}>{text}</div>;
}

function SectionCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl overflow-hidden" style={surfaceCardStyle}>
      <div className="px-4 py-3 border-b" style={dividerStyle}>
        <h3 className="text-sm font-black" style={primaryTextStyle}>{title}</h3>
      </div>
      {children}
    </section>
  );
}

function ProgressRow({ label, count, max }: { label: string; count: number; max: number }) {
  const width = max > 0 ? Math.max(4, Math.min(100, Math.round((count / max) * 100))) : 0;
  return (
    <div className="py-3 border-b last:border-b-0" style={dividerStyle}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-bold" style={primaryTextStyle}>{label}</p>
        <p className="text-xs font-black" style={primaryTextStyle}>{formatNumber(count)}</p>
      </div>
      <div className="mt-2 h-2 rounded-full overflow-hidden" style={{ backgroundColor: "color-mix(in srgb, var(--as-text) 8%, transparent)" }}>
        <div className="h-full rounded-full bg-[#A380F6]" style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

function CountGrid({ rows }: { rows: Array<{ label: string; value: number; tone?: "neutral" | "attention" | "good" }> }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 p-4">
      {rows.map((row) => {
        const color = row.tone === "attention" ? "#C94040" : row.tone === "good" ? "#009E73" : "var(--as-text)";
        return (
          <div key={row.label} className="rounded-xl border p-3" style={mutedPanelStyle}>
            <p className="text-[10px] font-black uppercase tracking-widest" style={subtleTextStyle}>{row.label}</p>
            <p className="mt-2 text-xl font-black" style={{ color }}>{formatNumber(row.value)}</p>
          </div>
        );
      })}
    </div>
  );
}

function StatusBadge({ value, attention = false }: { value: unknown; attention?: boolean }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-black ${
        attention
          ? "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-300"
          : "bg-[#A380F6]/10 text-[#7C5FCC]"
      }`}
    >
      {titleCase(value)}
    </span>
  );
}

export default function AdminMetricsPage() {
  const { selectedClient, selectedClientId, clients } = useAdminClient();
  const [payload, setPayload] = useState<MetricsPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [rangeDays, setRangeDays] = useState<(typeof DATE_OPTIONS)[number]>(30);
  const [entityFilter, setEntityFilter] = useState<EntityFilterValue>("all");
  const [roleId, setRoleId] = useState("");
  const [reloadNonce, setReloadNonce] = useState(0);

  const entityOptions = useMemo(() => {
    if (!selectedClientId || selectedClientId === "all") return [];
    return buildEntityFilterOptions(clients, selectedClientId, { useParentNameLabel: true });
  }, [clients, selectedClientId]);

  useEffect(() => {
    if (entityOptions.length === 0) {
      setEntityFilter("all");
      return;
    }
    const selectedIsChild = selectedClient.is_child_client === true || Boolean(selectedClient.parent_client_id);
    const preferred = selectedIsChild && entityOptions.some((option) => option.value === selectedClientId)
      ? selectedClientId
      : "all";
    setEntityFilter((current) => entityOptions.some((option) => option.value === current) ? current : preferred);
  }, [entityOptions, selectedClient, selectedClientId]);

  const getToken = useCallback(async (): Promise<string> => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const token = String(session?.access_token || "").trim();
    if (!token) throw new Error("Missing session token.");
    return token;
  }, []);

  const loadMetrics = useCallback(async () => {
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
      const params = new URLSearchParams();
      params.set("date_from", dateFromDays(rangeDays));
      params.set("date_to", dateOnly(new Date()));
      if (selectedClientId && selectedClientId !== "all") params.set("client_id", selectedClientId);
      if (selectedClientId && selectedClientId !== "all" && entityOptions.length > 0) {
        params.set("entity_filter", entityFilterQueryValue(entityFilter));
      }
      const trimmedRoleId = roleId.trim();
      if (trimmedRoleId) params.set("role_id", trimmedRoleId);

      const response = await fetch(`${backendBase}/admin/metrics?${params.toString()}`, {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
        credentials: "omit",
      });
      const text = await response.text();
      if (!response.ok) throw new Error(errorMessageFromResponse(text, "Could not load platform metrics."));
      setPayload((parseJsonSafe(text) as MetricsPayload | null) || null);
    } catch (loadError) {
      setPayload(null);
      setError(loadError instanceof Error ? loadError.message : "Could not load platform metrics.");
    } finally {
      setLoading(false);
    }
  }, [entityFilter, entityOptions.length, getToken, rangeDays, roleId, selectedClientId]);

  useEffect(() => {
    void loadMetrics();
  }, [loadMetrics, reloadNonce]);

  const overview = payload?.overview || {};
  const automation = payload?.automation || {};
  const email = payload?.email || {};
  const readiness = payload?.readiness || {};
  const entityOperations = payload?.entity_operations || {};
  const funnelRows = payload?.interview_funnel || [];
  const maxFunnel = Math.max(1, ...funnelRows.map((row) => Number(row.count || 0)));
  const attentionItems = payload?.attention?.items || [];
  const problemCount = Number(overview.email_delivery_failures || 0) + Number(readiness.recording_problem || 0) + Number(readiness.missing_report_after_complete || 0);
  const dateLabel = payload?.filters?.date_from_display && payload?.filters?.date_to_display
    ? `${payload.filters.date_from_display} to ${payload.filters.date_to_display}`
    : `Last ${rangeDays} days`;

  return (
    <AdminLayout title="Metrics">
      <div className="flex flex-col gap-5">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div>
            <h2 className="text-2xl font-black" style={primaryTextStyle}>Platform Metrics</h2>
            <p className="text-sm font-semibold mt-1" style={mutedTextStyle}>
              Operational visibility for interviews, automation, delivery, and go-live readiness.
            </p>
          </div>
          <button
            type="button"
            disabled={loading}
            onClick={() => setReloadNonce((value) => value + 1)}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-full text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
            style={{ backgroundColor: "#A380F6" }}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {error && (
          <div
            className="flex items-start gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-red-500 bg-red-50 border border-red-200 dark:text-red-300 dark:bg-red-500/10 dark:border-red-500/25"
            role="status"
            aria-live="polite"
          >
            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            {error}
          </div>
        )}

        <div className="rounded-2xl px-4 py-3 grid grid-cols-1 lg:grid-cols-[1.2fr_1fr_250px_180px] gap-3 items-end" style={surfaceCardStyle}>
          <div>
            <p className="text-xs font-black" style={primaryTextStyle}>Client scope</p>
            <p className="text-[11px] font-semibold mt-1" style={subtleTextStyle}>
              {selectedClientId === "all" ? "All clients" : selectedClient.name}. Change this in the admin client picker.
            </p>
          </div>
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest mb-1.5" style={mutedTextStyle}>Entity</label>
            <select
              value={entityFilterQueryValue(entityFilter)}
              disabled={entityOptions.length === 0}
              onChange={(event) => setEntityFilter(event.target.value as EntityFilterValue)}
              className={inputClass}
              style={inputStyle}
            >
              {entityOptions.length === 0 ? (
                <option value="all">All entities</option>
              ) : entityOptions.map((option) => (
                <option key={String(option.value)} value={entityFilterQueryValue(option.value)}>{option.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest mb-1.5" style={mutedTextStyle}>Date range</label>
            <div className="grid grid-cols-3 gap-1 rounded-xl border p-1" style={inputStyle}>
              {DATE_OPTIONS.map((days) => (
                <button
                  key={days}
                  type="button"
                  onClick={() => setRangeDays(days)}
                  className={`h-8 rounded-lg text-xs font-black transition-colors ${
                    rangeDays === days ? "text-white" : "text-[var(--as-text-muted)] hover:bg-[#A380F6]/10"
                  }`}
                  style={rangeDays === days ? { backgroundColor: "#A380F6" } : undefined}
                >
                  {days}d
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest mb-1.5" style={mutedTextStyle}>Role ID</label>
            <input
              value={roleId}
              onChange={(event) => setRoleId(event.target.value)}
              placeholder="Optional"
              className={inputClass}
              style={inputStyle}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          <MetricCard label="Active roles" value={formatNumber(overview.active_roles)} detail={`${formatNumber(overview.active_clients)} active parent clients`} icon={Briefcase} />
          <MetricCard label="Candidates" value={formatNumber(overview.candidates_in_range)} detail={dateLabel} icon={Users} />
          <MetricCard label="Completed interviews" value={formatNumber(overview.interviews_completed)} detail={`${formatNumber(overview.interviews_started)} started`} icon={Video} tone="good" />
          <MetricCard label="Reports generated" value={formatNumber(overview.reports_generated)} detail={`${formatNumber(readiness.missing_report_after_complete)} missing after threshold`} icon={CheckCircle2} tone={readiness.missing_report_after_complete ? "attention" : "good"} />
          <MetricCard label="Pending approvals" value={formatNumber(overview.automation_pending_approvals)} detail={`${formatNumber(automation.approval_links?.active)} active approval links`} icon={Clock3} tone={overview.automation_pending_approvals ? "attention" : "neutral"} />
          <MetricCard label="Delivery problems" value={formatNumber(overview.email_delivery_failures)} detail="Email event problems in range" icon={MailWarning} tone={overview.email_delivery_failures ? "attention" : "neutral"} />
          <MetricCard label="Readiness problems" value={formatNumber(problemCount)} detail="Recordings, reports, delivery" icon={AlertTriangle} tone={problemCount ? "attention" : "good"} />
          <MetricCard label="Child entities" value={formatNumber(entityOperations.child_entity_count)} detail={`${formatNumber(entityOperations.archived_child_entity_count)} archived`} icon={Building2} />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          <SectionCard title="Interview Funnel">
            {loading ? (
              <EmptyState text="Loading funnel..." />
            ) : funnelRows.length === 0 ? (
              <EmptyState text="No interview activity in the selected range." />
            ) : (
              <div className="px-4">
                {funnelRows.map((row) => (
                  <ProgressRow key={row.key} label={row.label} count={Number(row.count || 0)} max={maxFunnel} />
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard title="Recording And Report Readiness">
            <CountGrid
              rows={[
                { label: "Recording ready", value: Number(readiness.recording_ready || 0), tone: "good" },
                { label: "Pending", value: Number(readiness.recording_pending || 0), tone: readiness.recording_pending ? "attention" : "neutral" },
                { label: "Problem", value: Number(readiness.recording_problem || 0), tone: readiness.recording_problem ? "attention" : "neutral" },
                { label: "Deleted", value: Number(readiness.recording_deleted || 0) },
                { label: "Reports", value: Number(readiness.report_generated || 0), tone: "good" },
                { label: "Missing report", value: Number(readiness.missing_report_after_complete || 0), tone: readiness.missing_report_after_complete ? "attention" : "neutral" },
                { label: "Perception events", value: Number(readiness.perception_event_received || 0) },
                { label: "Perception missing", value: Number(readiness.perception_missing_after_video_completion || 0), tone: readiness.perception_missing_after_video_completion ? "attention" : "neutral" },
                { label: "Transcript ready", value: Number(readiness.transcript_ready || 0), tone: "good" },
              ]}
            />
          </SectionCard>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          <SectionCard title="Automation">
            <CountGrid
              rows={[
                { label: "Rules enabled", value: countValue(automation.rule_status_counts, "enabled"), tone: "good" },
                { label: "Rules paused", value: countValue(automation.rule_status_counts, "paused") },
                { label: "Rules archived", value: countValue(automation.rule_status_counts, "archived") },
                { label: "Pending approvals", value: Number(automation.pending_approvals || 0), tone: automation.pending_approvals ? "attention" : "neutral" },
                { label: "Approved", value: Number(automation.approved_actions || 0), tone: "good" },
                { label: "Rejected", value: Number(automation.rejected_actions || 0) },
                { label: "Sent", value: Number(automation.sent_actions || 0), tone: "good" },
                { label: "Failed", value: Number(automation.failed_actions || 0), tone: automation.failed_actions ? "attention" : "neutral" },
                { label: "Digest sent", value: countValue(automation.digest_status_counts, "sent"), tone: "good" },
                { label: "Digest failed", value: countValue(automation.digest_status_counts, "failed"), tone: countValue(automation.digest_status_counts, "failed") ? "attention" : "neutral" },
                { label: "Links active", value: Number(automation.approval_links?.active || 0) },
                { label: "Links expired", value: Number(automation.approval_links?.expired || 0), tone: automation.approval_links?.expired ? "attention" : "neutral" },
              ]}
            />
          </SectionCard>

          <SectionCard title="Email Delivery">
            <CountGrid
              rows={[
                { label: "Sent/delivered", value: countValue(email.normalized_counts, "sent_delivered"), tone: "good" },
                { label: "Engagement", value: countValue(email.normalized_counts, "engagement") },
                { label: "Problem", value: countValue(email.normalized_counts, "problem"), tone: countValue(email.normalized_counts, "problem") ? "attention" : "neutral" },
                { label: "Unknown", value: countValue(email.normalized_counts, "unknown") },
              ]}
            />
            {(email.recent_problem_events || []).length === 0 ? (
              <EmptyState text={loading ? "Loading email events..." : "No email problem events in the selected range."} />
            ) : (
              <div className="overflow-x-auto border-t" style={dividerStyle}>
                <table className="w-full text-sm">
                  <thead style={mutedPanelStyle}>
                    <tr className="text-left text-[10px] font-black uppercase tracking-widest" style={subtleTextStyle}>
                      <th className="px-4 py-2">Event</th>
                      <th className="px-4 py-2">Category</th>
                      <th className="px-4 py-2">Detail</th>
                      <th className="px-4 py-2">Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(email.recent_problem_events || []).map((event, index) => (
                      <tr key={event.id || index} className="border-t" style={dividerStyle}>
                        <td className="px-4 py-3"><StatusBadge value={event.event_type || "problem"} attention /></td>
                        <td className="px-4 py-3 text-xs font-semibold" style={mutedTextStyle}>{event.category || "unknown"}</td>
                        <td className="px-4 py-3 text-xs font-semibold max-w-md" style={mutedTextStyle}>{event.detail || "No detail"}</td>
                        <td className="px-4 py-3 text-xs font-semibold whitespace-nowrap" style={mutedTextStyle}>{formatDateTime(event.event_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>
        </div>

        <SectionCard title="Attention Needed">
          {loading ? (
            <EmptyState text="Loading attention list..." />
          ) : attentionItems.length === 0 ? (
            <EmptyState text="No attention items for the selected filters." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead style={mutedPanelStyle}>
                  <tr className="text-left text-[10px] font-black uppercase tracking-widest" style={subtleTextStyle}>
                    <th className="px-4 py-2">Type</th>
                    <th className="px-4 py-2">Client / Entity</th>
                    <th className="px-4 py-2">Role / Candidate</th>
                    <th className="px-4 py-2">Status</th>
                    <th className="px-4 py-2">Age</th>
                    <th className="px-4 py-2">Suggested action</th>
                  </tr>
                </thead>
                <tbody>
                  {attentionItems.map((item, index) => (
                    <tr key={`${item.type || "item"}-${index}`} className="border-t" style={dividerStyle}>
                      <td className="px-4 py-3"><StatusBadge value={item.type || "attention"} attention /></td>
                      <td className="px-4 py-3">
                        <p className="text-xs font-bold" style={primaryTextStyle}>{item.client_name || "Platform"}</p>
                        <p className="text-[11px] font-semibold" style={mutedTextStyle}>{item.entity_name || "All entities"}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-xs font-bold" style={primaryTextStyle}>{item.role_title || "No role"}</p>
                        <p className="text-[11px] font-semibold" style={mutedTextStyle}>{item.candidate_name || item.detail || "No candidate"}</p>
                      </td>
                      <td className="px-4 py-3 text-xs font-semibold" style={mutedTextStyle}>{titleCase(item.status)}</td>
                      <td className="px-4 py-3 text-xs font-black whitespace-nowrap" style={primaryTextStyle}>{item.age || "unknown"}</td>
                      <td className="px-4 py-3 text-xs font-semibold max-w-md" style={mutedTextStyle}>{item.suggested_action || "Review in admin tools."}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>

        <SectionCard title="Entity And Client Operations">
          <CountGrid
            rows={[
              { label: "Parent clients", value: Number(entityOperations.parent_client_count || 0) },
              { label: "Child entities", value: Number(entityOperations.child_entity_count || 0) },
              { label: "Archived entities", value: Number(entityOperations.archived_child_entity_count || 0), tone: entityOperations.archived_child_entity_count ? "attention" : "neutral" },
              { label: "Members", value: Number(entityOperations.member_count || 0) },
            ]}
          />
          {(entityOperations.by_entity || []).length === 0 ? (
            <EmptyState text={loading ? "Loading entity operations..." : "No entity operations rows for this scope."} />
          ) : (
            <div className="overflow-x-auto border-t" style={dividerStyle}>
              <table className="w-full text-sm">
                <thead style={mutedPanelStyle}>
                  <tr className="text-left text-[10px] font-black uppercase tracking-widest" style={subtleTextStyle}>
                    <th className="px-4 py-2">Client</th>
                    <th className="px-4 py-2">Entity</th>
                    <th className="px-4 py-2">Roles</th>
                    <th className="px-4 py-2">Candidates</th>
                    <th className="px-4 py-2">Members</th>
                    <th className="px-4 py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(entityOperations.by_entity || []).slice(0, 20).map((row, index) => (
                    <tr key={row.client_id || index} className="border-t" style={dividerStyle}>
                      <td className="px-4 py-3 text-xs font-bold" style={primaryTextStyle}>{row.client_name || "Unknown client"}</td>
                      <td className="px-4 py-3 text-xs font-semibold" style={mutedTextStyle}>{row.entity_name || "Parent"}</td>
                      <td className="px-4 py-3 text-xs font-black" style={primaryTextStyle}>{formatNumber(row.role_count)}</td>
                      <td className="px-4 py-3 text-xs font-black" style={primaryTextStyle}>{formatNumber(row.candidate_count)}</td>
                      <td className="px-4 py-3 text-xs font-black" style={primaryTextStyle}>{formatNumber(row.member_count)}</td>
                      <td className="px-4 py-3"><StatusBadge value={row.archived ? "archived" : "active"} attention={row.archived === true} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>

        <div className="rounded-2xl p-4" style={surfaceCardStyle}>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#A380F6]" />
              <p className="text-sm font-black" style={primaryTextStyle}>Safe read-only metrics</p>
            </div>
            <p className="text-xs font-semibold" style={mutedTextStyle}>Generated {formatDateTime(payload?.generated_at)}</p>
          </div>
          <div className="mt-3 grid grid-cols-1 lg:grid-cols-2 gap-3">
            {(payload?.sources?.scope_notes || []).map((note, index) => (
              <p key={index} className="rounded-xl border px-3 py-2 text-xs font-semibold" style={{ ...mutedPanelStyle, color: "var(--as-text-muted)" }}>
                {note}
              </p>
            ))}
            {(payload?.sources?.warnings || []).map((warning, index) => (
              <p key={`warning-${index}`} className="rounded-xl border px-3 py-2 text-xs font-semibold text-amber-700 bg-amber-50 border-amber-200 dark:text-amber-300 dark:bg-amber-500/10 dark:border-amber-500/25">
                {warning.table || "Source"}: {warning.detail || warning.code || "Unavailable"}
              </p>
            ))}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
