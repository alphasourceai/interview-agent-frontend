import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { ArrowRight, Briefcase, Clock, Users, Zap } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { useClient } from "@/context/ClientContext";
import { supabase } from "@/lib/supabaseClient";

const timeframes = ["7d", "30d", "MTD", "6m", "YTD", "1y"] as const;
type Timeframe = (typeof timeframes)[number];
type InterviewType = "Basic" | "Detailed" | "Technical";

interface PeriodStats {
  roles: number;
  candidates: number;
  avgPerRole: number;
  avgDays: number;
  rolesDelta: number;
  candidatesDelta: number;
}

interface RecentRole {
  name: string;
  type: InterviewType;
  date: string;
  left: number | null;
  used: number | null;
}

interface RoleItem {
  id: string;
  title: string;
  createdAtMs: number;
  type: InterviewType;
  left: number | null;
  used: number | null;
}

interface DashboardRowItem {
  createdAtMs: number;
  roleId: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

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

function extractErrorMessage(text: string, fallback: string): string {
  if (!text) return fallback;
  try {
    const data = JSON.parse(text) as { detail?: unknown; message?: unknown; error?: unknown };
    const candidate = data.detail ?? data.message ?? data.error;
    if (typeof candidate === "string" && candidate.trim()) return candidate;
  } catch {
    // fall through to raw text
  }
  return text;
}

function parseJsonSafe(text: string): unknown {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function toDateMs(value: unknown): number {
  const raw = String(value || "").trim();
  if (!raw) return 0;
  const parsed = new Date(raw).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

function toWholeNonNegativeOrNull(value: unknown): number | null {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.floor(n));
}

function mapInterviewType(value: unknown): InterviewType {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "detailed") return "Detailed";
  if (normalized === "technical") return "Technical";
  return "Basic";
}

function getWindowBounds(timeframe: Timeframe, nowMs: number): { start: number; end: number } {
  const now = new Date(nowMs);
  const end = nowMs;

  if (timeframe === "7d") {
    return { start: end - 7 * DAY_MS, end };
  }
  if (timeframe === "30d") {
    return { start: end - 30 * DAY_MS, end };
  }
  if (timeframe === "MTD") {
    return { start: new Date(now.getFullYear(), now.getMonth(), 1).getTime(), end };
  }
  if (timeframe === "6m") {
    const start = new Date(now);
    start.setMonth(start.getMonth() - 6);
    return { start: start.getTime(), end };
  }
  if (timeframe === "YTD") {
    return { start: new Date(now.getFullYear(), 0, 1).getTime(), end };
  }
  const start = new Date(now);
  start.setFullYear(start.getFullYear() - 1);
  return { start: start.getTime(), end };
}

function inWindow(timestamp: number, start: number, end: number): boolean {
  return timestamp >= start && timestamp < end;
}

function computeWindowStats(
  start: number,
  end: number,
  roles: RoleItem[],
  rows: DashboardRowItem[],
  firstScreenByRole: Map<string, number>,
): Omit<PeriodStats, "rolesDelta" | "candidatesDelta"> {
  const rolesInWindow = roles.filter((role) => inWindow(role.createdAtMs, start, end));
  const rowsInWindow = rows.filter((row) => inWindow(row.createdAtMs, start, end));

  const roleCount = rolesInWindow.length;
  const candidateCount = rowsInWindow.length;
  const avgPerRole = roleCount > 0 ? candidateCount / roleCount : 0;

  let sumDays = 0;
  let countedRoles = 0;
  for (const role of rolesInWindow) {
    const firstScreenAt = firstScreenByRole.get(role.id);
    if (typeof firstScreenAt !== "number") continue;
    const diffMs = firstScreenAt - role.createdAtMs;
    if (!Number.isFinite(diffMs) || diffMs < 0) continue;
    sumDays += diffMs / DAY_MS;
    countedRoles += 1;
  }

  const avgDays = countedRoles > 0 ? sumDays / countedRoles : 0;

  return {
    roles: roleCount,
    candidates: candidateCount,
    avgPerRole,
    avgDays,
  };
}

function formatRecentRoleDate(timestamp: number): string {
  if (!Number.isFinite(timestamp) || timestamp <= 0) return "—";
  return new Date(timestamp).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

const typeColors: Record<string, { bg: string; text: string }> = {
  Basic:     { bg: "rgba(163,128,246,0.12)", text: "#7C5FCC" },
  Detailed:  { bg: "rgba(2,171,224,0.12)",   text: "#0285B0" },
  Technical: { bg: "rgba(2,217,157,0.12)",   text: "#009E73" },
};

function Trend({ delta }: { delta: number }) {
  if (delta === 0) return <span className="text-[11px] font-semibold" style={{ color: "var(--as-text-subtle)" }}>No change</span>;
  const positive = delta > 0;
  return (
    <span
      className="text-[11px] font-bold"
      style={{ color: positive ? "#02D99D" : "#FF6B6B" }}
    >
      {positive ? "+" : ""}{delta} vs prior period
    </span>
  );
}

const metricCards = [
  {
    key: "roles" as const,
    label: "Roles Created",
    icon: Briefcase,
    color: "#A380F6",
    format: (s: PeriodStats) => String(s.roles),
    sub: "active roles",
    delta: (s: PeriodStats) => s.rolesDelta,
  },
  {
    key: "candidates" as const,
    label: "Candidates Screened",
    icon: Users,
    color: "#02ABE0",
    format: (s: PeriodStats) => String(s.candidates),
    sub: "total screenings",
    delta: (s: PeriodStats) => s.candidatesDelta,
  },
  {
    key: "avgPerRole" as const,
    label: "Avg Candidates / Role",
    icon: Zap,
    color: "#02D99D",
    format: (s: PeriodStats) => s.avgPerRole.toFixed(1),
    sub: "per role",
    delta: (_s: PeriodStats) => 0,
  },
  {
    key: "avgDays" as const,
    label: "Time to First Screening",
    icon: Clock,
    color: "#A380F6",
    format: (s: PeriodStats) => `${s.avgDays.toFixed(2)}d`,
    sub: "from role creation",
    delta: (_s: PeriodStats) => 0,
  },
];

const surfaceCardStyle = {
  backgroundColor: "var(--as-surface)",
  border: "1px solid var(--as-border)",
  boxShadow: "var(--as-shadow)",
};
const compactSurfaceStyle = {
  backgroundColor: "var(--as-surface)",
  border: "1px solid var(--as-border)",
  boxShadow: "0 1px 6px rgba(10,21,71,0.05)",
};
const dividerStyle = { borderColor: "var(--as-border)" };
const primaryTextStyle = { color: "var(--as-text)" };
const mutedTextStyle = { color: "var(--as-text-muted)" };
const subtleTextStyle = { color: "var(--as-text-subtle)" };
const progressTrackStyle = { backgroundColor: "var(--as-surface-muted)" };

function timeframeButtonStyle(active: boolean) {
  return active
    ? { backgroundColor: "var(--as-text)", color: "var(--as-surface)" }
    : mutedTextStyle;
}

export default function OverviewPage() {
  const [timeframe, setTimeframe] = useState<Timeframe>("30d");
  const { selectedClient, selectedClientId, loading: clientLoading, error: clientError, refreshClients } = useClient();
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [rows, setRows] = useState<DashboardRowItem[]>([]);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [overviewReady, setOverviewReady] = useState(false);
  const [overviewError, setOverviewError] = useState("");

  const effectiveClientId = selectedClient.id === "all" ? "all" : selectedClientId;

  useEffect(() => {
    let alive = true;

    const loadOverview = async () => {
      if (clientLoading) {
        if (!alive) return;
        setOverviewReady(false);
        setOverviewLoading(true);
        setOverviewError("");
        return;
      }
      if (clientError) {
        if (!alive) return;
        setRoles([]);
        setRows([]);
        setOverviewReady(false);
        setOverviewError(clientError);
        setOverviewLoading(false);
        return;
      }
      if (!effectiveClientId && selectedClient.id !== "all") {
        if (!alive) return;
        setRoles([]);
        setRows([]);
        setOverviewReady(true);
        setOverviewError("");
        setOverviewLoading(false);
        return;
      }
      if (!backendBase) {
        if (!alive) return;
        setRoles([]);
        setRows([]);
        setOverviewReady(false);
        setOverviewError("Missing backend base URL configuration.");
        setOverviewLoading(false);
        return;
      }

      if (!alive) return;
      setOverviewLoading(true);
      setOverviewReady(false);
      setOverviewError("");

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const token = String(session?.access_token || "").trim();
        if (!token) throw new Error("Missing session token.");

        const query =
          effectiveClientId && effectiveClientId !== "all"
            ? `?client_id=${encodeURIComponent(effectiveClientId)}`
            : "";

        const [rolesRes, rowsRes] = await Promise.all([
          fetch(`${backendBase}/roles${query}`, {
            method: "GET",
            headers: { Authorization: `Bearer ${token}` },
            credentials: "omit",
          }),
          fetch(`${backendBase}/dashboard/rows${query}`, {
            method: "GET",
            headers: { Authorization: `Bearer ${token}` },
            credentials: "omit",
          }),
        ]);

        const [rolesText, rowsText] = await Promise.all([rolesRes.text(), rowsRes.text()]);

        if (!rolesRes.ok) {
          throw new Error(extractErrorMessage(rolesText, "Failed to load roles."));
        }
        if (!rowsRes.ok) {
          throw new Error(extractErrorMessage(rowsText, "Failed to load overview rows."));
        }

        const rolesPayload = parseJsonSafe(rolesText);
        const rolesItems = rolesPayload && typeof rolesPayload === "object" && Array.isArray((rolesPayload as { items?: unknown }).items)
          ? (rolesPayload as { items: unknown[] }).items
          : [];

        const mappedRoles = rolesItems
          .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"))
          .map((item) => ({
            id: String(item.id || "").trim(),
            title: String(item.title || "").trim() || "Untitled Role",
            createdAtMs: toDateMs(item.created_at),
            type: mapInterviewType(item.interview_type),
            left: toWholeNonNegativeOrNull(item.remaining_interviews),
            used: toWholeNonNegativeOrNull(item.used_interviews),
          }))
          .filter((item) => Boolean(item.id));

        const rowsPayload = parseJsonSafe(rowsText);
        const rowsItems = rowsPayload && typeof rowsPayload === "object" && Array.isArray((rowsPayload as { items?: unknown }).items)
          ? (rowsPayload as { items: unknown[] }).items
          : [];

        const mappedRows = rowsItems
          .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"))
          .map((item) => {
            const role = item.role && typeof item.role === "object"
              ? (item.role as Record<string, unknown>)
              : {};
            return {
              createdAtMs: toDateMs(item.created_at),
              roleId: String(role.id || item.role_id || "").trim(),
            };
          })
          .filter((item) => item.createdAtMs > 0);

        if (!alive) return;
        setRoles(mappedRoles);
        setRows(mappedRows);
        setOverviewReady(true);
        setOverviewError("");
      } catch (error) {
        if (!alive) return;
        setRoles([]);
        setRows([]);
        setOverviewReady(false);
        setOverviewError(error instanceof Error ? error.message : "Failed to load overview.");
      } finally {
        if (alive) setOverviewLoading(false);
      }
    };

    void loadOverview();
    return () => {
      alive = false;
    };
  }, [effectiveClientId, selectedClient.id, clientLoading, clientError]);

  const stats = useMemo(() => {
    const firstScreenByRole = new Map<string, number>();
    for (const row of rows) {
      if (!row.roleId) continue;
      const previous = firstScreenByRole.get(row.roleId);
      if (typeof previous !== "number" || row.createdAtMs < previous) {
        firstScreenByRole.set(row.roleId, row.createdAtMs);
      }
    }

    const nowMs = Date.now();
    const current = getWindowBounds(timeframe, nowMs);
    const durationMs = Math.max(1, current.end - current.start);
    const priorStart = current.start - durationMs;
    const priorEnd = current.start;

    const currentStats = computeWindowStats(current.start, current.end, roles, rows, firstScreenByRole);
    const priorStats = computeWindowStats(priorStart, priorEnd, roles, rows, firstScreenByRole);

    return {
      ...currentStats,
      rolesDelta: currentStats.roles - priorStats.roles,
      candidatesDelta: currentStats.candidates - priorStats.candidates,
    };
  }, [timeframe, roles, rows]);

  const recentRoles = useMemo<RecentRole[]>(() => {
    return [...roles]
      .sort((a, b) => b.createdAtMs - a.createdAtMs)
      .slice(0, 3)
      .map((role) => ({
        name: role.title,
        type: role.type,
        date: formatRecentRoleDate(role.createdAtMs),
        left: role.left,
        used: role.used,
      }));
  }, [roles]);

  return (
    <DashboardLayout title="Overview">

      {/* ── Header ───────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-7">
        <div>
          <h2 className="text-2xl font-black text-[#0A1547] leading-tight" style={{ color: "var(--as-text)" }}>{selectedClient.name}</h2>
        </div>

        {/* Timeframe pill selector */}
        <div
          className="flex items-center gap-0.5 bg-white rounded-full p-1"
          style={compactSurfaceStyle}
        >
          {timeframes.map((tf) => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              className="px-3 py-1.5 text-xs font-bold rounded-full transition-all duration-200"
              style={timeframeButtonStyle(timeframe === tf)}
            >
              {tf}
            </button>
          ))}
        </div>
      </div>

      {overviewError && (
        <div
          className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl px-4 py-2.5 text-sm font-semibold"
          style={{ backgroundColor: "rgba(255,107,107,0.12)", color: "#B33A3A" }}
        >
          <span>{overviewError}</span>
          <button
            type="button"
            onClick={() => { void refreshClients(); }}
            className="rounded-full border border-current/25 bg-white px-3 py-1 text-xs font-black transition-opacity hover:opacity-80"
          >
            Retry
          </button>
        </div>
      )}

      {!overviewError && !overviewReady && (
        <div className="mb-5 text-sm font-semibold text-[#0A1547]/45" style={{ color: "var(--as-text)", opacity: 0.45 }}>
          Loading overview...
        </div>
      )}

      {overviewReady && (
        <>
      {/* ── Metric cards ─────────────────────────────────── */}
      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-7">
        {metricCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.key}
              className="bg-white rounded-2xl overflow-hidden flex flex-col"
              style={surfaceCardStyle}
            >
              {/* Color accent bar */}
              <div className="h-[3px]" style={{ backgroundColor: card.color }} />
              <div className="p-5 flex flex-col flex-1">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-[10px] font-black uppercase tracking-widest" style={subtleTextStyle}>{card.label}</p>
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: `${card.color}18` }}
                  >
                    <Icon className="w-3.5 h-3.5" style={{ color: card.color }} />
                  </div>
                </div>
                <p className="text-[2.25rem] font-black leading-none mb-2" style={primaryTextStyle}>
                  {card.format(stats)}
                </p>
                <div className="mt-auto space-y-0.5">
                  <Trend delta={card.delta(stats)} />
                  <p className="text-[11px] font-medium" style={subtleTextStyle}>{card.sub}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Recent Roles ─────────────────────────────────── */}
      <div
        className="bg-white rounded-2xl overflow-hidden"
        style={surfaceCardStyle}
      >
        {/* Section header */}
        <div className="flex items-center justify-between px-6 py-4 border-b" style={dividerStyle}>
          <p className="text-sm font-black" style={primaryTextStyle}>Recent Roles</p>
          <Link
            href="/dashboard/roles"
            className="flex items-center gap-1 text-xs font-bold transition-colors"
            style={{ color: "#A380F6" }}
          >
            View all <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Role rows */}
        <div className="divide-y divide-[var(--as-border)]">
          {!overviewLoading && recentRoles.length === 0 && (
            <div className="px-6 py-4 text-sm font-semibold" style={mutedTextStyle}>
              No roles yet for this client.
            </div>
          )}
          {recentRoles.map((role, i) => {
            const tc = typeColors[role.type];
            const usageAvailable = role.left !== null || role.used !== null;
            const left = role.left ?? 0;
            const used = role.used ?? 0;
            const total = left + used;
            const pct = total > 0 ? (used / total) * 100 : 0;
            return (
              <div
                key={i}
                className="as-shell-dropdown-item flex items-center gap-4 px-6 py-3.5 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold leading-snug" style={primaryTextStyle}>{role.name}</p>
                  <p className="text-[11px] mt-0.5" style={subtleTextStyle}>{role.date}</p>
                </div>
                <span
                  className="flex-shrink-0 px-2.5 py-1 rounded-lg text-[11px] font-bold"
                  style={{ backgroundColor: tc.bg, color: tc.text }}
                >
                  {role.type}
                </span>
                <div className="flex-shrink-0 w-28 hidden sm:block">
                  {usageAvailable ? (
                    <>
                      <div className="flex items-baseline gap-1 mb-1">
                        <span className="text-sm font-black" style={primaryTextStyle}>{left}</span>
                        <span className="text-[10px] font-semibold" style={subtleTextStyle}>left</span>
                        <span className="text-[10px] mx-0.5" style={subtleTextStyle}>/</span>
                        <span className="text-sm font-black" style={mutedTextStyle}>{used}</span>
                        <span className="text-[10px] font-semibold" style={subtleTextStyle}>used</span>
                      </div>
                      <div className="w-full rounded-full h-1" style={progressTrackStyle}>
                        <div className="h-1 rounded-full" style={{ width: `${pct}%`, backgroundColor: "#A380F6" }} />
                      </div>
                    </>
                  ) : (
                    <p className="text-[11px] font-semibold" style={subtleTextStyle}>Usage unavailable</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
        </>
      )}

    </DashboardLayout>
  );
}
