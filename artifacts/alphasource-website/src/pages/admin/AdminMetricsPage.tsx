import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Activity,
  AlertTriangle,
  Bot,
  CheckCircle2,
  ChevronDown,
  CircleHelp,
  Clock3,
  Cloud,
  CreditCard,
  Database,
  HardDrive,
  Mail,
  RefreshCw,
  Server,
  ShieldCheck,
  Video,
  Zap,
  type LucideIcon,
} from "lucide-react";
import AdminLayout from "@/components/AdminLayout";
import { supabase } from "@/lib/supabaseClient";

const timeframes = ["7d", "30d", "MTD", "6m", "YTD", "1y"] as const;
type Timeframe = (typeof timeframes)[number];
type HealthStatus = "healthy" | "warning" | "problem" | "unknown" | "not_configured";

interface MetricItem {
  label: string;
  value: unknown;
  help?: string;
}

interface CostSummary {
  label?: string;
  estimated?: number | string | null;
  value?: number | string | null;
  currency?: string | null;
  display?: string | null;
  source_label?: string | null;
  source?: string | null;
  note?: string | null;
  help?: string | null;
}

interface ReadinessItem {
  label: string;
  status: string;
  help?: string;
}

interface RecentIssue {
  project?: string | null;
  title?: string | null;
  culprit?: string | null;
  level?: string | null;
  status?: string | null;
  count?: number | string | null;
  user_count?: number | string | null;
  first_seen?: string | null;
  last_seen?: string | null;
  permalink?: string | null;
  platform?: string | null;
  environment?: string | null;
}

interface PlatformService {
  key: string;
  name: string;
  status: HealthStatus;
  configured: boolean | "unknown";
  live_connected?: boolean;
  live_api_connected?: boolean;
  connection_label?: string;
  source_label?: string;
  source: string;
  meaning?: string;
  health_summary?: string;
  usage: MetricItem[];
  errors: MetricItem[];
  usage_summary?: MetricItem[];
  problem_summary?: MetricItem[];
  problems?: MetricItem[];
  cost: CostSummary;
  cost_summary?: CostSummary;
  health_detail: string;
  readiness_items?: ReadinessItem[];
  recent_issues?: RecentIssue[];
  recentIssues?: RecentIssue[];
  troubleshooting_note?: string | null;
  notes?: string[];
  last_checked: string | null;
}

interface StatusCard {
  key: string;
  label: string;
  status: HealthStatus;
  detail: string;
  source: string;
  last_checked: string | null;
}

interface ReadinessRow {
  service: string;
  configured: boolean | "unknown";
  live_usage_connected: boolean;
  event_source: string;
  notes: string;
  items?: ReadinessItem[];
}

interface MetricsPayload {
  generated_at?: string;
  filters?: {
    date_range?: string;
    date_from_display?: string;
    date_to_display?: string;
  };
  summary?: {
    overall_status?: HealthStatus;
    healthy_count?: number;
    warning_count?: number;
    problem_count?: number;
    unknown_count?: number;
    last_checked?: string | null;
  };
  status_cards?: StatusCard[];
  services?: PlatformService[];
  integration_readiness?: ReadinessRow[];
  source_notes?: string[];
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
const compactSurfaceStyle = {
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
const dividerStyle = { borderColor: "var(--as-border)" };

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

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "Not available";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return Number.isFinite(value) ? value.toLocaleString() : "Not available";
  return String(value);
}

function statusClass(status: unknown): string {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "healthy") return "bg-[#02D99D]/10 text-[#00886A]";
  if (normalized === "problem") return "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-300";
  if (normalized === "warning") return "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300";
  if (normalized === "not_configured") return "bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-white/70";
  return "bg-[#A380F6]/10 text-[#7C5FCC]";
}

function iconToneClass(status: unknown): string {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "healthy") return "border-[#02D99D]/30 bg-[#02D99D]/5 text-[#00886A]";
  if (normalized === "problem") return "border-red-200 bg-red-50 text-red-600 dark:border-red-500/25 dark:bg-red-500/10 dark:text-red-300";
  if (normalized === "warning") return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-300";
  if (normalized === "not_configured") return "border-slate-200 bg-slate-50 text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-white/70";
  return "border-[#A380F6]/25 bg-[#A380F6]/5 text-[#7C5FCC]";
}

function serviceIconToneClass(service: PlatformService): string {
  const key = `${service.key} ${service.name}`.toLowerCase();
  if (key.includes("openai")) return "border-indigo-200 bg-indigo-50 text-indigo-600 dark:border-indigo-400/25 dark:bg-indigo-500/10 dark:text-indigo-300";
  if (key.includes("sendgrid")) return "border-blue-200 bg-blue-50 text-blue-600 dark:border-blue-400/25 dark:bg-blue-500/10 dark:text-blue-300";
  if (key.includes("aws") || key.includes("s3") || key.includes("storage")) return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-400/25 dark:bg-amber-500/10 dark:text-amber-300";
  if (key.includes("tavus")) return "border-purple-200 bg-purple-50 text-purple-600 dark:border-purple-400/25 dark:bg-purple-500/10 dark:text-purple-300";
  if (key.includes("render")) return "border-slate-200 bg-slate-50 text-slate-700 dark:border-sky-400/25 dark:bg-sky-500/10 dark:text-sky-300";
  if (key.includes("stripe")) return "border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-400/25 dark:bg-indigo-500/10 dark:text-indigo-300";
  if (key.includes("supabase")) return "border-teal-200 bg-teal-50 text-teal-700 dark:border-teal-400/25 dark:bg-teal-500/10 dark:text-teal-300";
  if (key.includes("sentry")) return "border-rose-200 bg-rose-50 text-rose-600 dark:border-rose-400/25 dark:bg-rose-500/10 dark:text-rose-300";
  return "border-[#A380F6]/25 bg-[#A380F6]/5 text-[#7C5FCC]";
}

function neutralIconToneClass(): string {
  return "border-slate-200 bg-slate-50 text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-white/70";
}

function OutlineIcon({ icon: Icon, status, label, toneClass }: { icon: LucideIcon; status?: unknown; label?: string; toneClass?: string }) {
  return (
    <span
      className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${toneClass || iconToneClass(status)}`}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <Icon className="h-4 w-4" strokeWidth={2} />
    </span>
  );
}

function StatusBadge({ status }: { status: unknown }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-black ${statusClass(status)}`}>
      {titleCase(status)}
    </span>
  );
}

function SummaryCountBadge({ count, label, status }: { count: number | undefined; label: string; status: HealthStatus }) {
  return (
    <span className={`flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-[11px] font-black ${statusClass(status)}`}>
      <span className="uppercase">{label}</span>
      <span>{Number(count || 0).toLocaleString()}</span>
    </span>
  );
}

function timeframeButtonStyle(active: boolean) {
  return active
    ? { backgroundColor: "var(--as-text)", color: "var(--as-surface)" }
    : mutedTextStyle;
}

function configuredLabel(value: boolean | "unknown" | undefined): string {
  if (value === "unknown" || value === undefined) return "Unknown";
  return value ? "Configured" : "Not configured";
}

function liveConnectionLabel(service: PlatformService): string {
  if (service.live_api_connected === true || service.live_connected === true) return "Live API connected";
  if (service.connection_label) return service.connection_label;
  return configuredLabel(service.configured);
}

function costLabel(cost: CostSummary | undefined): string {
  if (!cost) return "Not available";
  if (cost.display) return String(cost.display);
  if (typeof cost.estimated === "number") {
    return `${cost.currency || "USD"} ${cost.estimated.toLocaleString()}`;
  }
  if (typeof cost.value === "number") {
    return `${cost.currency || "USD"} ${cost.value.toLocaleString()}`;
  }
  if (cost.estimated) return String(cost.estimated);
  if (cost.value) return String(cost.value);
  return "Not available";
}

function serviceUsage(service: PlatformService): MetricItem[] {
  return service.usage_summary || service.usage || [];
}

function serviceProblems(service: PlatformService): MetricItem[] {
  return service.problem_summary || service.problems || service.errors || [];
}

function serviceCost(service: PlatformService): CostSummary {
  return service.cost_summary || service.cost || {};
}

function serviceRecentIssues(service: PlatformService): RecentIssue[] {
  return service.recent_issues || service.recentIssues || [];
}

function serviceDetailsId(serviceKey: string): string {
  return `vendor-service-details-${serviceKey.replace(/[^a-zA-Z0-9_-]+/g, "-")}`;
}

function statusDetailsId(statusKey: string): string {
  return `platform-status-details-${statusKey.replace(/[^a-zA-Z0-9_-]+/g, "-")}`;
}

function serviceIcon(service: PlatformService): LucideIcon {
  const key = `${service.key} ${service.name}`.toLowerCase();
  if (key.includes("openai")) return Bot;
  if (key.includes("tavus")) return Video;
  if (key.includes("supabase")) return Database;
  if (key.includes("sendgrid")) return Mail;
  if (key.includes("render")) return Cloud;
  if (key.includes("sentry")) return ShieldCheck;
  if (key.includes("aws") || key.includes("s3") || key.includes("storage")) return HardDrive;
  if (key.includes("stripe")) return CreditCard;
  return Server;
}

function statusIcon(card: StatusCard): LucideIcon {
  const key = `${card.key} ${card.label} ${card.source}`.toLowerCase();
  if (key.includes("database") || key.includes("supabase") || key.includes("db")) return Database;
  if (key.includes("backend") || key.includes("api") || key.includes("server")) return Server;
  if (key.includes("storage") || key.includes("aws") || key.includes("s3")) return HardDrive;
  if (key.includes("vendor") || key.includes("platform") || key.includes("render")) return Cloud;
  if (card.status === "problem" || card.status === "warning") return AlertTriangle;
  if (card.status === "healthy") return CheckCircle2;
  return Activity;
}

function statusSearchText(card: StatusCard): string {
  return `${card.key} ${card.label} ${card.source} ${card.detail}`.toLowerCase();
}

function findStatusCard(cards: StatusCard[], terms: string[]): StatusCard | null {
  return cards.find((card) => {
    const searchable = statusSearchText(card);
    return terms.some((term) => searchable.includes(term));
  }) || null;
}

function attentionStatus(problemCount: number, warningCount: number): HealthStatus {
  if (problemCount > 0) return "problem";
  if (warningCount > 0) return "warning";
  return "healthy";
}

function uniqueValues(values: string[]): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const value of values) {
    const normalized = value.trim();
    if (!normalized || seen.has(normalized.toLowerCase())) continue;
    seen.add(normalized.toLowerCase());
    unique.push(normalized);
  }
  return unique;
}

function metricSignal(item: MetricItem | undefined): string {
  if (!item) return "";
  return `${item.label}: ${formatValue(item.value)}`;
}

function serviceKeySignals(service: PlatformService): string[] {
  const usage = serviceUsage(service);
  const problems = serviceProblems(service);
  const cost = serviceCost(service);
  const costValue = costLabel(cost);
  const problemSignal = problems.find((item) => {
    const value = formatValue(item.value).toLowerCase();
    return value && value !== "not available" && value !== "0" && value !== "none";
  });
  const signals = [
    liveConnectionLabel(service),
    service.status === "warning" || service.status === "problem" ? metricSignal(problemSignal) : "",
    metricSignal(usage[0]),
    costValue !== "Not available" ? `Cost: ${costValue}` : "",
    service.source_label || titleCase(service.source),
  ];
  return uniqueValues(signals).slice(0, 2);
}

function issueMetaParts(issue: RecentIssue): string[] {
  return [issue.project, issue.level, issue.status, issue.environment, issue.platform]
    .map((value) => String(value || "").trim())
    .filter(Boolean);
}

function SmallMetricList({ items, emptyText }: { items: MetricItem[]; emptyText: string }) {
  const rows = items.slice(0, 5);
  if (rows.length === 0) {
    return <p className="text-xs font-semibold" style={mutedTextStyle}>{emptyText}</p>;
  }
  return (
    <div className="space-y-2">
      {rows.map((item) => (
        <div key={item.label} className="flex items-start justify-between gap-3 text-xs">
          <span className="font-semibold" style={mutedTextStyle} title={item.help}>{item.label}</span>
          <span className="font-black text-right" style={primaryTextStyle}>{formatValue(item.value)}</span>
        </div>
      ))}
    </div>
  );
}

function DetailSection({ title, children, className = "" }: { title: string; children: ReactNode; className?: string }) {
  return (
    <section className={`min-w-0 ${className}`}>
      <h4 className="text-[10px] font-black uppercase" style={subtleTextStyle}>{title}</h4>
      <div className="mt-2 space-y-0">
        {children}
      </div>
    </section>
  );
}

function DetailRow({ label, value, help }: { label: string; value: unknown; help?: string | null }) {
  return (
    <div className="grid grid-cols-1 gap-1 border-t py-2 first:border-t-0 sm:grid-cols-[minmax(140px,0.38fr)_minmax(0,0.62fr)]" style={dividerStyle}>
      <span className="text-xs font-semibold" style={subtleTextStyle} title={help || undefined}>{label}</span>
      <span className="min-w-0 break-words text-xs font-black sm:text-right" style={primaryTextStyle}>{formatValue(value)}</span>
    </div>
  );
}

function DetailMetricRows({ items, emptyText }: { items: MetricItem[]; emptyText: string }) {
  const rows = items.slice(0, 6);
  if (rows.length === 0) {
    return <p className="border-t py-2 text-xs font-semibold" style={{ ...dividerStyle, ...mutedTextStyle }}>{emptyText}</p>;
  }
  return (
    <>
      {rows.map((item, index) => (
        <DetailRow key={`${item.label}-${index}`} label={item.label} value={item.value} help={item.help} />
      ))}
    </>
  );
}

function NotesRows({ notes }: { notes: string[] }) {
  return (
    <>
      {notes.map((note, index) => (
        <p key={index} className="border-t py-2 text-xs font-semibold first:border-t-0" style={{ ...dividerStyle, ...mutedTextStyle }}>
          {note}
        </p>
      ))}
    </>
  );
}

function RecentIssuesPanel({ service, issues }: { service: PlatformService; issues: RecentIssue[] }) {
  const connected = service.live_api_connected === true || service.live_connected === true;
  const visibleIssues = issues.slice(0, 5);

  return (
    <DetailSection title="Recent issues" className="xl:col-span-2">
      {visibleIssues.length === 0 ? (
        <p className="border-t py-2 text-xs font-semibold" style={{ ...dividerStyle, ...mutedTextStyle }}>
          {connected ? "No recent unresolved issues found." : "Recent issue details are unavailable until the Sentry issue API is connected."}
        </p>
      ) : (
        <div>
          {visibleIssues.map((issue, index) => {
            const meta = issueMetaParts(issue);
            return (
              <div key={`${issue.project || "sentry"}-${issue.last_seen || issue.first_seen || index}`} className="border-t py-3 first:border-t-0" style={dividerStyle}>
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-black" style={primaryTextStyle}>{formatValue(issue.title)}</p>
                    {meta.length > 0 && <p className="mt-1 text-[11px] font-semibold" style={subtleTextStyle}>{meta.join(" · ")}</p>}
                    {issue.culprit && <p className="mt-1 break-words text-xs font-semibold" style={mutedTextStyle}>{issue.culprit}</p>}
                  </div>
                  {issue.permalink && (
                    <a
                      href={String(issue.permalink)}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-black text-[#7C5FCC] hover:underline whitespace-nowrap"
                    >
                      Open in Sentry
                    </a>
                  )}
                </div>
                <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2 text-[11px] font-semibold" style={subtleTextStyle}>
                  <span>Events: <span className="font-black" style={primaryTextStyle}>{formatValue(issue.count)}</span></span>
                  <span>Users: <span className="font-black" style={primaryTextStyle}>{formatValue(issue.user_count)}</span></span>
                  <span>First: <span className="font-black" style={primaryTextStyle}>{formatDateTime(issue.first_seen)}</span></span>
                  <span>Last: <span className="font-black" style={primaryTextStyle}>{formatDateTime(issue.last_seen)}</span></span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </DetailSection>
  );
}

export default function AdminMetricsPage() {
  const [payload, setPayload] = useState<MetricsPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [timeframe, setTimeframe] = useState<Timeframe>("30d");
  const [reloadNonce, setReloadNonce] = useState(0);
  const [expandedServices, setExpandedServices] = useState<Set<string>>(() => new Set());

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
      const params = new URLSearchParams({ date_range: timeframe });
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
  }, [getToken, timeframe]);

  useEffect(() => {
    void loadMetrics();
  }, [loadMetrics, reloadNonce]);

  const toggleServiceCard = useCallback((serviceKey: string) => {
    setExpandedServices((current) => {
      const next = new Set(current);
      if (next.has(serviceKey)) {
        next.delete(serviceKey);
      } else {
        next.add(serviceKey);
      }
      return next;
    });
  }, []);

  const services = payload?.services || [];
  const statusCards = payload?.status_cards || [];
  const readinessRows = payload?.integration_readiness || [];
  const sourceNotes = payload?.source_notes || [];
  const lastRefreshed = payload?.summary?.last_checked || payload?.generated_at || null;
  const dateLabel = payload?.filters?.date_from_display && payload?.filters?.date_to_display
    ? `${payload.filters.date_from_display} to ${payload.filters.date_to_display}`
    : timeframe;
  const serviceByKey = useMemo(() => Object.fromEntries(services.map((service) => [service.key, service])), [services]);
  const overallStatus = payload?.summary?.overall_status || "unknown";
  const healthyCount = Number(payload?.summary?.healthy_count || 0);
  const warningCount = Number(payload?.summary?.warning_count || 0);
  const problemCount = Number(payload?.summary?.problem_count || 0);
  const unknownCount = Number(payload?.summary?.unknown_count || 0);
  const platformAttentionText = problemCount > 0
    ? `${problemCount.toLocaleString()} problem${problemCount === 1 ? "" : "s"} need attention.`
    : warningCount > 0
      ? `${warningCount.toLocaleString()} warning${warningCount === 1 ? "" : "s"} need review.`
      : "No active platform problems reported.";
  const backendStatusCard = findStatusCard(statusCards, ["backend", "api", "server"]);
  const databaseStatusCard = findStatusCard(statusCards, ["database", "db", "supabase"]);
  const attentionCards = statusCards.filter((card) => card.status === "problem" || card.status === "warning");
  const attentionSummary = attentionCards.length > 0
    ? `${attentionCards.slice(0, 2).map((card) => card.label).join(", ")}${attentionCards.length > 2 ? ` and ${attentionCards.length - 2} more` : ""} ${problemCount > 0 ? "need attention." : "need review."}`
    : platformAttentionText;
  const attentionSignalStatus = attentionStatus(problemCount, warningCount);
  const platformSignals: Array<{
    key: string;
    label: string;
    value: string;
    detail: string;
    icon: LucideIcon;
    status: HealthStatus;
    toneClass?: string;
  }> = [
    {
      key: "backend-api",
      label: "Backend/API",
      value: backendStatusCard ? titleCase(backendStatusCard.status) : "Unknown",
      detail: backendStatusCard?.detail || "No backend/API check returned.",
      icon: Server,
      status: backendStatusCard?.status || "unknown",
    },
    {
      key: "database",
      label: "Database",
      value: databaseStatusCard ? titleCase(databaseStatusCard.status) : "Unknown",
      detail: databaseStatusCard?.detail || "No database check returned.",
      icon: Database,
      status: databaseStatusCard?.status || "unknown",
    },
    {
      key: "attention",
      label: "Needs attention",
      value: problemCount + warningCount > 0 ? `${(problemCount + warningCount).toLocaleString()} checks` : "None reported",
      detail: attentionSummary,
      icon: AlertTriangle,
      status: attentionSignalStatus,
    },
    {
      key: "last-refreshed",
      label: "Last refreshed",
      value: formatDateTime(lastRefreshed),
      detail: "Current status only. Vendor usage has its own date range.",
      icon: RefreshCw,
      status: "unknown",
      toneClass: neutralIconToneClass(),
    },
  ];

  const renderStatusCard = (card: StatusCard) => {
    const Icon = statusIcon(card);
    const detailsId = statusDetailsId(card.key);
    return (
      <details key={card.key} className="group rounded-2xl border overflow-hidden" style={surfaceCardStyle}>
        <summary className="list-none cursor-pointer [&::-webkit-details-marker]:hidden">
          <div className="flex items-start justify-between gap-3 px-4 py-3 transition-colors hover:bg-[var(--as-hover)]">
            <div className="min-w-0 flex items-start gap-3">
              <OutlineIcon icon={Icon} status={card.status} />
              <div className="min-w-0">
                <p className="text-sm font-black" style={primaryTextStyle}>{card.label}</p>
                <p className="mt-1 text-xs font-semibold truncate" style={mutedTextStyle} title={card.detail}>{card.detail}</p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <StatusBadge status={card.status} />
              <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" style={mutedTextStyle} aria-hidden="true" />
            </div>
          </div>
        </summary>
        <div id={detailsId} className="border-t px-4 py-3" style={dividerStyle}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-xl border px-3 py-2" style={mutedPanelStyle}>
              <p className="text-[10px] font-black uppercase" style={subtleTextStyle}>Check source</p>
              <p className="mt-1 text-sm font-black" style={primaryTextStyle}>{titleCase(card.source)}</p>
            </div>
            <div className="rounded-xl border px-3 py-2" style={mutedPanelStyle}>
              <p className="text-[10px] font-black uppercase" style={subtleTextStyle}>Last checked</p>
              <p className="mt-1 text-sm font-black" style={primaryTextStyle}>{formatDateTime(card.last_checked)}</p>
            </div>
          </div>
          <p className="mt-3 text-xs font-semibold" style={mutedTextStyle}>{card.detail}</p>
        </div>
      </details>
    );
  };

  const renderServiceCard = (service: PlatformService) => {
    const cost = serviceCost(service);
    const expanded = expandedServices.has(service.key);
    const detailsId = serviceDetailsId(service.key);
    const summary = service.health_summary || service.health_detail || "No health summary available.";
    const recentIssues = serviceRecentIssues(service);
    const keySignals = serviceKeySignals(service);
    const Icon = serviceIcon(service);

    return (
      <article
        key={service.key}
        className="w-full rounded-2xl border overflow-hidden"
        style={surfaceCardStyle}
      >
        <button
          type="button"
          className="w-full px-4 py-3 text-left transition-colors hover:bg-[var(--as-hover)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#A380F6] focus-visible:ring-inset"
          onClick={() => toggleServiceCard(service.key)}
          aria-expanded={expanded}
          aria-controls={detailsId}
          aria-label={`${expanded ? "Collapse" : "Expand"} ${service.name} metrics details`}
        >
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(260px,0.86fr)_minmax(96px,auto)_minmax(280px,1.08fr)_minmax(220px,auto)] xl:items-center">
            <div className="min-w-0 flex items-start gap-3 xl:items-center">
              <OutlineIcon icon={Icon} toneClass={serviceIconToneClass(service)} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-base font-black" style={primaryTextStyle} title={service.name}>{service.name}</p>
                <p className="mt-1 truncate text-xs font-semibold" style={mutedTextStyle} title={summary}>{summary}</p>
              </div>
            </div>

            <div className="flex pl-12 xl:pl-0 xl:justify-start">
              <StatusBadge status={service.status} />
            </div>

            <div className="flex min-w-0 flex-wrap gap-2">
              {keySignals.map((signal) => (
                <span
                  key={signal}
                  className="max-w-full truncate rounded-full border px-2.5 py-1 text-[11px] font-black"
                  style={{ ...mutedPanelStyle, color: "var(--as-text-muted)" }}
                  title={signal}
                >
                  {signal}
                </span>
              ))}
            </div>

            <div className="flex min-w-0 items-center justify-between gap-3 xl:justify-end">
              <p className="min-w-0 truncate text-[11px] font-semibold" style={subtleTextStyle}>
                <Clock3 className="mr-1.5 inline h-3 w-3 align-[-2px]" aria-hidden="true" />
                Last checked {formatDateTime(service.last_checked)}
              </p>
              <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-black" style={mutedTextStyle}>
                {expanded ? "Hide details" : "View details"}
                <ChevronDown
                  className={`h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`}
                  aria-hidden="true"
                />
              </span>
            </div>
          </div>
        </button>

        <div id={detailsId} hidden={!expanded} className="border-t px-4 py-4" style={dividerStyle}>
          <p className="mb-5 max-w-4xl text-xs font-semibold" style={mutedTextStyle}>{summary}</p>
          <div className="grid grid-cols-1 gap-x-10 gap-y-6 xl:grid-cols-2">
            <DetailSection title="Connection">
              <DetailRow label="Connection" value={service.connection_label || configuredLabel(service.configured)} />
              <DetailRow label="Usage source" value={service.source_label || titleCase(service.source)} />
              <DetailRow label="What this means" value={service.meaning || service.health_summary || service.health_detail} />
              <DetailRow label="Last checked" value={formatDateTime(service.last_checked)} />
            </DetailSection>

            <DetailSection title="Usage this period">
              <DetailMetricRows items={serviceUsage(service)} emptyText="No usage signal available." />
            </DetailSection>

            <DetailSection title="Problems this period">
              <DetailMetricRows items={serviceProblems(service)} emptyText="No problem signal available." />
            </DetailSection>

            <DetailSection title="Cost this period">
              <DetailRow label="Cost" value={costLabel(cost)} />
              <DetailRow label="Source" value={cost.source_label || cost.source || "Not available"} />
              {cost.note && <DetailRow label="Note" value={cost.note} />}
              {cost.help && <DetailRow label="Help" value={cost.help} />}
            </DetailSection>

            {service.readiness_items && service.readiness_items.length > 0 && (
              <DetailSection title="Readiness and configuration">
                <DetailMetricRows
                  items={service.readiness_items.map((item) => ({ label: item.label, value: item.status, help: item.help }))}
                  emptyText="No readiness details returned."
                />
              </DetailSection>
            )}

            {service.notes && service.notes.length > 0 && (
              <DetailSection title="Notes and limitations">
                <NotesRows notes={service.notes} />
              </DetailSection>
            )}

            {service.troubleshooting_note && (
              <DetailSection title="Troubleshooting" className="xl:col-span-2">
                <p className="border-t py-2 text-xs font-semibold text-amber-700 dark:text-amber-300" style={dividerStyle}>
                  {service.troubleshooting_note}
                </p>
              </DetailSection>
            )}

            {service.key === "sentry" && <RecentIssuesPanel service={service} issues={recentIssues} />}
          </div>
        </div>
      </article>
    );
  };

  return (
    <AdminLayout title="Metrics">
      <div className="flex flex-col gap-5">
        <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-black" style={primaryTextStyle}>Platform Health & Usage</h2>
            <p className="text-sm font-semibold mt-1" style={mutedTextStyle}>
              Live service health, API usage, errors, and cost signals for alphaScreen.
            </p>
            <p className="text-xs font-semibold mt-2 max-w-3xl" style={mutedTextStyle}>
              This page checks the services alphaScreen depends on. Some rows use live vendor APIs; others use alphaScreen records until a live usage connection is available.
            </p>
            <p className="text-xs font-semibold mt-2" style={subtleTextStyle}>
              Last refreshed {formatDateTime(lastRefreshed)}
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
            className="rounded-xl px-4 py-3 text-sm font-semibold text-red-500 bg-red-50 border border-red-200 dark:text-red-300 dark:bg-red-500/10 dark:border-red-500/25"
            role="status"
            aria-live="polite"
          >
            {error}
          </div>
        )}

        <section className="rounded-2xl overflow-hidden" style={surfaceCardStyle}>
          <div className="px-4 py-3 border-b flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3" style={dividerStyle}>
            <div className="flex items-start gap-3">
              <OutlineIcon icon={Activity} status={overallStatus} />
              <div>
                <h3 className="text-base font-black" style={primaryTextStyle}>Current Platform Status</h3>
                <p className="text-xs font-semibold mt-1" style={mutedTextStyle}>
                  Current reachability and configuration checks. The date range below does not apply to this section.
                </p>
              </div>
            </div>
            <StatusBadge status={overallStatus} />
          </div>
          <div className="p-4 space-y-3">
            <div className="rounded-2xl border p-4" style={mutedPanelStyle}>
              <div className="grid grid-cols-1 2xl:grid-cols-[minmax(280px,0.8fr)_minmax(0,1.2fr)] gap-4">
                <div className="flex flex-col justify-between gap-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[10px] font-black uppercase" style={subtleTextStyle}>Overall platform health</p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <p className="text-2xl font-black" style={primaryTextStyle}>{titleCase(overallStatus)}</p>
                        <StatusBadge status={overallStatus} />
                      </div>
                      <p className="mt-2 text-sm font-semibold" style={mutedTextStyle}>{attentionSummary}</p>
                    </div>
                    <OutlineIcon
                      icon={overallStatus === "problem" ? AlertTriangle : overallStatus === "healthy" ? Activity : CircleHelp}
                      status={overallStatus}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <SummaryCountBadge count={healthyCount} label="healthy" status="healthy" />
                    <SummaryCountBadge count={warningCount} label="warning" status="warning" />
                    <SummaryCountBadge count={problemCount} label="problem" status="problem" />
                    <SummaryCountBadge count={unknownCount} label="unknown" status="unknown" />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {platformSignals.map((signal) => (
                    <div key={signal.key} className="rounded-xl border px-3 py-3" style={surfaceCardStyle}>
                      <div className="flex items-start gap-3">
                        <OutlineIcon icon={signal.icon} status={signal.status} toneClass={signal.toneClass} />
                        <div className="min-w-0">
                          <p className="text-[10px] font-black uppercase" style={subtleTextStyle}>{signal.label}</p>
                          <p className="mt-1 truncate text-sm font-black" style={primaryTextStyle} title={signal.value}>{signal.value}</p>
                          <p className="mt-1 text-xs font-semibold" style={mutedTextStyle}>{signal.detail}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <details className="group rounded-2xl border overflow-hidden" style={surfaceCardStyle}>
              <summary className="list-none cursor-pointer [&::-webkit-details-marker]:hidden">
                <div className="px-4 py-3 flex items-start justify-between gap-3 transition-colors hover:bg-[var(--as-hover)]">
                  <div className="flex items-start gap-3">
                    <OutlineIcon icon={CircleHelp} toneClass={neutralIconToneClass()} />
                    <div>
                      <h4 className="text-sm font-black" style={primaryTextStyle}>View configuration checks</h4>
                      <p className="text-xs font-semibold mt-1" style={mutedTextStyle}>Detailed check source, status, and last-checked timestamps are hidden by default.</p>
                    </div>
                  </div>
                  <ChevronDown className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180" style={mutedTextStyle} aria-hidden="true" />
                </div>
              </summary>
              <div className="border-t p-4" style={dividerStyle}>
                {loading && statusCards.length === 0 ? (
                  <div className="rounded-2xl border" style={mutedPanelStyle}>
                    <div className="px-4 py-8 text-center text-sm font-semibold" style={mutedTextStyle}>Loading platform status...</div>
                  </div>
                ) : statusCards.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {statusCards.map((card) => renderStatusCard(card))}
                  </div>
                ) : (
                  <div className="rounded-2xl border" style={mutedPanelStyle}>
                    <div className="px-4 py-8 text-center text-sm font-semibold" style={mutedTextStyle}>No platform status checks returned.</div>
                  </div>
                )}
              </div>
            </details>
          </div>
        </section>

        <section className="rounded-2xl overflow-hidden" style={surfaceCardStyle}>
          <div className="px-4 py-3 border-b flex flex-col 2xl:flex-row 2xl:items-center 2xl:justify-between gap-3" style={dividerStyle}>
            <div className="flex items-start gap-3">
              <OutlineIcon icon={Zap} status="unknown" />
              <div>
                <h3 className="text-base font-black" style={primaryTextStyle}>Vendor Usage and Health</h3>
                <p className="text-xs font-semibold mt-1" style={mutedTextStyle}>
                  Period-based usage, problem, and cost signals. Selected range: <span className="font-black">{dateLabel}</span>.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-0.5 rounded-full p-1 overflow-x-auto" style={compactSurfaceStyle} aria-label="Vendor usage date range">
              {timeframes.map((tf) => (
                <button
                  key={tf}
                  type="button"
                  onClick={() => setTimeframe(tf)}
                  className="px-3 py-1.5 text-xs font-bold rounded-full transition-all duration-200"
                  style={timeframeButtonStyle(timeframe === tf)}
                >
                  {tf}
                </button>
              ))}
            </div>
          </div>
          {loading && services.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm font-semibold" style={mutedTextStyle}>Loading vendors...</div>
          ) : (
            <div className="p-4">
              <div className="space-y-2">
                {services.map((service) => renderServiceCard(service))}
              </div>
            </div>
          )}
        </section>

        <details className="group rounded-2xl overflow-hidden" style={surfaceCardStyle}>
          <summary className="list-none cursor-pointer [&::-webkit-details-marker]:hidden">
            <div className="px-4 py-3 flex items-start justify-between gap-3 transition-colors hover:bg-[var(--as-hover)]">
              <div className="flex items-start gap-3">
                <OutlineIcon icon={ShieldCheck} status="unknown" />
                <div>
                  <h3 className="text-sm font-black" style={primaryTextStyle}>Integration Readiness</h3>
                  <p className="text-xs font-semibold mt-1" style={mutedTextStyle}>Configuration, live usage connection, event source, and operational notes are hidden by default.</p>
                </div>
              </div>
              <ChevronDown className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180" style={mutedTextStyle} aria-hidden="true" />
            </div>
          </summary>
          <div className="border-t p-4" style={dividerStyle}>
            {readinessRows.length === 0 ? (
              <p className="text-sm font-semibold" style={mutedTextStyle}>No integration readiness rows returned.</p>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {readinessRows.map((row) => {
                  const serviceKey = services.find((service) => service.name === row.service)?.key || row.service;
                  const service = serviceByKey[serviceKey];
                  return (
                    <div key={row.service} className="rounded-xl border px-3 py-3" style={mutedPanelStyle}>
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm font-black" style={primaryTextStyle}>{row.service}</p>
                        <StatusBadge status={row.live_usage_connected ? "healthy" : "unknown"} />
                      </div>
                      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>
                          <p className="text-[10px] font-black uppercase" style={subtleTextStyle}>Configured</p>
                          <p className="mt-1 text-xs font-semibold" style={mutedTextStyle}>{configuredLabel(row.configured)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-black uppercase" style={subtleTextStyle}>Live usage connected</p>
                          <p className="mt-1 text-xs font-semibold" style={mutedTextStyle}>{row.live_usage_connected ? "Connected" : "Live API not connected"}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-black uppercase" style={subtleTextStyle}>Webhook/event source</p>
                          <p className="mt-1 text-xs font-semibold" style={mutedTextStyle}>{row.event_source || "Not connected yet"}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-black uppercase" style={subtleTextStyle}>Notes</p>
                          <p className="mt-1 text-xs font-semibold" style={mutedTextStyle}>{row.notes || service?.health_detail || "No notes"}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </details>

        <details className="group rounded-2xl overflow-hidden" style={surfaceCardStyle}>
          <summary className="list-none cursor-pointer [&::-webkit-details-marker]:hidden">
            <div className="px-4 py-3 flex items-start justify-between gap-3 transition-colors hover:bg-[var(--as-hover)]">
              <div className="flex items-start gap-3">
                <OutlineIcon icon={CircleHelp} status="unknown" />
                <div>
                  <h3 className="text-sm font-black" style={primaryTextStyle}>Source and Limitations</h3>
                  <p className="text-xs font-semibold mt-1" style={mutedTextStyle}>Data source notes remain available for troubleshooting and handoff, but are not always visible.</p>
                </div>
              </div>
              <ChevronDown className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180" style={mutedTextStyle} aria-hidden="true" />
            </div>
          </summary>
          <div className="border-t p-4" style={dividerStyle}>
            {sourceNotes.length === 0 ? (
              <p className="text-sm font-semibold" style={mutedTextStyle}>No source limitations returned.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {sourceNotes.map((note, index) => (
                  <p key={index} className="rounded-xl border px-3 py-2 text-xs font-semibold" style={{ ...mutedPanelStyle, color: "var(--as-text-muted)" }}>
                    {note}
                  </p>
                ))}
              </div>
            )}
          </div>
        </details>
      </div>
    </AdminLayout>
  );
}
