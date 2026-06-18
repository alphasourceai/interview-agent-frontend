import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, RefreshCw, ShieldCheck } from "lucide-react";
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

function StatusBadge({ status }: { status: unknown }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-black ${statusClass(status)}`}>
      {titleCase(status)}
    </span>
  );
}

function SummaryCountBadge({ count, label, status }: { count: number | undefined; label: string; status: HealthStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-black ${statusClass(status)}`}>
      {Number(count || 0).toLocaleString()} {label}
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

function serviceDetailsId(serviceKey: string): string {
  return `vendor-service-details-${serviceKey.replace(/[^a-zA-Z0-9_-]+/g, "-")}`;
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

  return (
    <AdminLayout title="Metrics">
      <div className="flex flex-col gap-5">
        <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-black" style={primaryTextStyle}>Platform Health & Usage</h2>
            <p className="text-sm font-semibold mt-1" style={mutedTextStyle}>
              Live service health, API usage, errors, and cost signals for alphaScreen.
            </p>
            <p className="text-xs font-semibold mt-2 max-w-3xl" style={mutedTextStyle}>
              This page checks the services alphaScreen depends on. Some rows use live vendor APIs; others use alphaScreen records until a live usage connection is available.
            </p>
            <p className="text-xs font-semibold mt-2" style={subtleTextStyle}>
              {dateLabel} · Last refreshed {formatDateTime(lastRefreshed)}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-0.5 rounded-full p-1" style={compactSurfaceStyle} aria-label="Date range">
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

        <section>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-black" style={primaryTextStyle}>Platform Status Summary</h3>
              <p className="text-xs font-semibold mt-1" style={mutedTextStyle}>
                Overall status: <span className="font-black">{titleCase(payload?.summary?.overall_status || "unknown")}</span>
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <SummaryCountBadge count={payload?.summary?.healthy_count} label="healthy" status="healthy" />
              <SummaryCountBadge count={payload?.summary?.warning_count} label="warning" status="warning" />
              <SummaryCountBadge count={payload?.summary?.problem_count} label="problem" status="problem" />
              <SummaryCountBadge count={payload?.summary?.unknown_count} label="unknown" status="unknown" />
            </div>
          </div>
          {loading && statusCards.length === 0 ? (
            <div className="rounded-2xl" style={surfaceCardStyle}>
              <div className="px-4 py-8 text-center text-sm font-semibold" style={mutedTextStyle}>Loading platform status...</div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
              {statusCards.map((card) => (
                <div key={card.key} className="rounded-2xl p-3" style={surfaceCardStyle}>
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-black" style={primaryTextStyle}>{card.label}</p>
                    <StatusBadge status={card.status} />
                  </div>
                  <p className="mt-2 text-xs font-semibold truncate" style={mutedTextStyle} title={card.detail}>{card.detail}</p>
                  <div className="mt-2 flex items-center justify-between gap-2 text-[11px] font-semibold" style={subtleTextStyle}>
                    <span>{titleCase(card.source)}</span>
                    <span>{formatDateTime(card.last_checked)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-2xl overflow-hidden" style={surfaceCardStyle}>
          <div className="px-4 py-3 border-b flex items-center justify-between gap-3" style={dividerStyle}>
            <div>
              <h3 className="text-sm font-black" style={primaryTextStyle}>Vendor Usage And Health</h3>
              <p className="text-xs font-semibold mt-1" style={mutedTextStyle}>One card per core dependency. Usage and problems are summaries, not raw event logs.</p>
            </div>
            <ShieldCheck className="w-4 h-4 text-[#A380F6]" />
          </div>
          {loading && services.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm font-semibold" style={mutedTextStyle}>Loading vendors...</div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 p-4">
              {services.map((service) => {
                const cost = serviceCost(service);
                const expanded = expandedServices.has(service.key);
                const detailsId = serviceDetailsId(service.key);
                const summary = service.health_summary || service.health_detail || "No health summary available.";
                return (
                  <article key={service.key} className="rounded-2xl border overflow-hidden" style={mutedPanelStyle}>
                    <button
                      type="button"
                      className="w-full px-4 py-3 text-left transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#A380F6] focus-visible:ring-inset"
                      onClick={() => toggleServiceCard(service.key)}
                      aria-expanded={expanded}
                      aria-controls={detailsId}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-base font-black" style={primaryTextStyle}>{service.name}</p>
                          <p className="mt-1 text-xs font-semibold" style={mutedTextStyle}>{summary}</p>
                        </div>
                        <div className="flex flex-shrink-0 items-center gap-2">
                          <StatusBadge status={service.status} />
                          <ChevronDown
                            className={`w-4 h-4 transition-transform ${expanded ? "rotate-180" : ""}`}
                            style={mutedTextStyle}
                            aria-hidden="true"
                          />
                        </div>
                      </div>
                    </button>

                    <div id={detailsId} hidden={!expanded} className="px-4 pb-4">
                      <div className="mt-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="rounded-xl border px-3 py-2" style={surfaceCardStyle}>
                          <p className="text-[10px] font-black uppercase" style={subtleTextStyle}>Connection</p>
                          <p className="mt-1 text-sm font-black" style={primaryTextStyle}>{service.connection_label || configuredLabel(service.configured)}</p>
                        </div>
                        <div className="rounded-xl border px-3 py-2" style={surfaceCardStyle}>
                          <p className="text-[10px] font-black uppercase" style={subtleTextStyle}>Usage source</p>
                          <p className="mt-1 text-sm font-black" style={primaryTextStyle}>{service.source_label || titleCase(service.source)}</p>
                        </div>
                      </div>

                      <div className="mt-3 rounded-xl border px-3 py-2" style={surfaceCardStyle}>
                        <p className="text-[10px] font-black uppercase" style={subtleTextStyle}>What this means</p>
                        <p className="mt-1 text-sm font-semibold" style={mutedTextStyle}>{service.meaning || service.health_summary || service.health_detail}</p>
                      </div>

                      <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="rounded-xl border px-3 py-3" style={surfaceCardStyle}>
                          <p className="mb-2 text-[10px] font-black uppercase" style={subtleTextStyle}>Usage this period</p>
                          <SmallMetricList items={serviceUsage(service)} emptyText="No usage signal available." />
                        </div>
                        <div className="rounded-xl border px-3 py-3" style={surfaceCardStyle}>
                          <p className="mb-2 text-[10px] font-black uppercase" style={subtleTextStyle}>Problems this period</p>
                          <SmallMetricList items={serviceProblems(service)} emptyText="No problem signal available." />
                        </div>
                      </div>

                      <div className="mt-3 rounded-xl border px-3 py-2" style={surfaceCardStyle}>
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                          <div>
                            <p className="text-[10px] font-black uppercase" style={subtleTextStyle}>Cost this period</p>
                            <p className="mt-1 text-sm font-black" style={primaryTextStyle}>{costLabel(cost)}</p>
                          </div>
                          <p className="text-xs font-semibold" style={mutedTextStyle}>{cost.source_label || cost.source || "Not available"}</p>
                        </div>
                        {cost.help && <p className="mt-2 text-[11px] font-semibold" style={subtleTextStyle}>{cost.help}</p>}
                      </div>

                      {service.troubleshooting_note && (
                        <p className="mt-3 rounded-xl border px-3 py-2 text-xs font-semibold text-amber-700 bg-amber-50 border-amber-200 dark:text-amber-300 dark:bg-amber-500/10 dark:border-amber-500/25">
                          {service.troubleshooting_note}
                        </p>
                      )}

                      <p className="mt-3 text-[11px] font-semibold" style={subtleTextStyle}>Last checked {formatDateTime(service.last_checked)}</p>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <section className="rounded-2xl overflow-hidden" style={surfaceCardStyle}>
          <div className="px-4 py-3 border-b" style={dividerStyle}>
            <h3 className="text-sm font-black" style={primaryTextStyle}>Integration Readiness</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead style={mutedPanelStyle}>
                <tr className="text-left text-[10px] font-black" style={subtleTextStyle}>
                  <th className="px-4 py-3">Service</th>
                  <th className="px-4 py-3">Configured</th>
                  <th className="px-4 py-3">Live usage connected</th>
                  <th className="px-4 py-3">Webhook/event source</th>
                  <th className="px-4 py-3">Notes</th>
                </tr>
              </thead>
              <tbody>
                {readinessRows.map((row) => {
                  const serviceKey = services.find((service) => service.name === row.service)?.key || row.service;
                  const service = serviceByKey[serviceKey];
                  return (
                    <tr key={row.service} className="border-t" style={dividerStyle}>
                      <td className="px-4 py-3 font-black" style={primaryTextStyle}>{row.service}</td>
                      <td className="px-4 py-3 text-xs font-semibold" style={mutedTextStyle}>{configuredLabel(row.configured)}</td>
                      <td className="px-4 py-3 text-xs font-semibold" style={mutedTextStyle}>{row.live_usage_connected ? "Connected" : "Live API not connected"}</td>
                      <td className="px-4 py-3 text-xs font-semibold" style={mutedTextStyle}>{row.event_source || "Not connected yet"}</td>
                      <td className="px-4 py-3 text-xs font-semibold max-w-lg" style={mutedTextStyle}>{row.notes || service?.health_detail || "No notes"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-2xl p-4" style={surfaceCardStyle}>
          <h3 className="text-sm font-black" style={primaryTextStyle}>Source And Limitations</h3>
          <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
            {sourceNotes.map((note, index) => (
              <p key={index} className="rounded-xl border px-3 py-2 text-xs font-semibold" style={{ ...mutedPanelStyle, color: "var(--as-text-muted)" }}>
                {note}
              </p>
            ))}
          </div>
        </section>
      </div>
    </AdminLayout>
  );
}
