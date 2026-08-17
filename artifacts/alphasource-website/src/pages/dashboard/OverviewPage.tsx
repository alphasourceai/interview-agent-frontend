import { useEffect, useMemo, useState, type ElementType, type ReactNode } from "react";
import { Link } from "wouter";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Briefcase,
  CalendarClock,
  CheckCircle2,
  CircleDot,
  Clock3,
  FileCheck2,
  Filter,
  SlidersHorizontal,
  UserRound,
  Users,
  Workflow,
} from "lucide-react";
import { Bar, BarChart, Cell, Line, LineChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import DashboardLayout from "@/components/DashboardLayout";
import { useClient } from "@/context/ClientContext";
import { getInterviewTypeLabel, type InterviewTypeLabel } from "@/lib/interviewContract";
import { supabase } from "@/lib/supabaseClient";

const timeframes = ["7d", "30d", "MTD", "6m", "YTD", "1y"] as const;
type Timeframe = (typeof timeframes)[number];

interface PeriodStats {
  roles: number;
  candidates: number;
  avgDays: number;
  rolesDelta: number;
  candidatesDelta: number;
}

interface RoleItem {
  id: string;
  title: string;
  createdAtMs: number;
  type: InterviewTypeLabel;
  left: number | null;
  used: number | null;
}

interface DashboardRowItem {
  id: string;
  createdAtMs: number;
  roleId: string;
  roleTitle: string;
  candidateName: string;
  overallScore: number | null;
  interviewScore: number | null;
  interviewStatus: string;
}

interface MetricDefinition {
  key: string;
  label: string;
  value: string;
  detail: string;
  positive: boolean;
  icon: ElementType;
  color: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const env = typeof import.meta !== "undefined" && import.meta.env ? import.meta.env : {};

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

function extractErrorMessage(text: string, fallback: string): string {
  const payload = parseJsonSafe(text);
  if (payload && typeof payload === "object") {
    const source = payload as Record<string, unknown>;
    const candidate = source.detail ?? source.message ?? source.error;
    if (typeof candidate === "string" && candidate.trim()) return candidate;
  }
  return text || fallback;
}

function toDateMs(value: unknown): number {
  const parsed = new Date(String(value || "")).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function toWholeNonNegativeOrNull(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : null;
}

function toScoreOrNull(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.min(100, Math.round(parsed))) : null;
}

function getWindowBounds(timeframe: Timeframe, nowMs: number): { start: number; end: number } {
  const now = new Date(nowMs);
  if (timeframe === "7d") return { start: nowMs - 7 * DAY_MS, end: nowMs };
  if (timeframe === "30d") return { start: nowMs - 30 * DAY_MS, end: nowMs };
  if (timeframe === "MTD") return { start: new Date(now.getFullYear(), now.getMonth(), 1).getTime(), end: nowMs };
  if (timeframe === "6m") {
    const start = new Date(now);
    start.setMonth(start.getMonth() - 6);
    return { start: start.getTime(), end: nowMs };
  }
  if (timeframe === "YTD") return { start: new Date(now.getFullYear(), 0, 1).getTime(), end: nowMs };
  const start = new Date(now);
  start.setFullYear(start.getFullYear() - 1);
  return { start: start.getTime(), end: nowMs };
}

function computePeriodStats(timeframe: Timeframe, roles: RoleItem[], rows: DashboardRowItem[]): PeriodStats {
  const current = getWindowBounds(timeframe, Date.now());
  const duration = Math.max(1, current.end - current.start);
  const prior = { start: current.start - duration, end: current.start };
  const inWindow = (timestamp: number, window: { start: number; end: number }) => timestamp >= window.start && timestamp < window.end;
  const currentRoles = roles.filter((role) => inWindow(role.createdAtMs, current));
  const currentRows = rows.filter((row) => inWindow(row.createdAtMs, current));
  const priorRoles = roles.filter((role) => inWindow(role.createdAtMs, prior));
  const priorRows = rows.filter((row) => inWindow(row.createdAtMs, prior));
  const firstScreenByRole = new Map<string, number>();
  for (const row of currentRows) {
    if (!row.roleId) continue;
    const existing = firstScreenByRole.get(row.roleId);
    if (existing === undefined || row.createdAtMs < existing) firstScreenByRole.set(row.roleId, row.createdAtMs);
  }
  const firstScreenDays = currentRoles.flatMap((role) => {
    const first = firstScreenByRole.get(role.id);
    return first !== undefined && first >= role.createdAtMs ? [(first - role.createdAtMs) / DAY_MS] : [];
  });
  return {
    roles: currentRoles.length,
    candidates: currentRows.length,
    avgDays: firstScreenDays.length ? firstScreenDays.reduce((sum, value) => sum + value, 0) / firstScreenDays.length : 0,
    rolesDelta: currentRoles.length - priorRoles.length,
    candidatesDelta: currentRows.length - priorRows.length,
  };
}

function initials(name: string): string {
  const parts = String(name || "Candidate").trim().split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "C";
}

function relativeDate(timestamp: number): { primary: string; secondary: string } {
  if (!timestamp) return { primary: "Date unavailable", secondary: "" };
  const diff = Date.now() - timestamp;
  const days = Math.floor(diff / DAY_MS);
  if (days === 0) {
    return {
      primary: new Date(timestamp).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
      secondary: "Today",
    };
  }
  if (days === 1) return { primary: "Yesterday", secondary: new Date(timestamp).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) };
  return {
    primary: new Date(timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    secondary: `${days} days ago`,
  };
}

function candidateState(row: DashboardRowItem): { label: string; tone: "success" | "info" | "neutral" } {
  if (row.overallScore !== null) return { label: "Review ready", tone: "success" };
  if (row.interviewScore !== null || ["completed", "complete", "ended"].includes(row.interviewStatus)) return { label: "Interview complete", tone: "info" };
  return { label: "New candidate", tone: "neutral" };
}

function StatusBadge({ label, tone }: { label: string; tone: "success" | "info" | "warning" | "neutral" }) {
  const classes = {
    success: "bg-emerald-50 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300",
    info: "bg-sky-50 text-sky-700 dark:bg-sky-400/10 dark:text-sky-300",
    warning: "bg-rose-50 text-rose-700 dark:bg-rose-400/10 dark:text-rose-300",
    neutral: "bg-slate-100 text-slate-600 dark:bg-white/5 dark:text-slate-300",
  } as const;
  return <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] font-black ${classes[tone]}`}>{label}</span>;
}

function SurfaceCard({ className = "", children }: { className?: string; children: ReactNode }) {
  return (
    <section className={`rounded-2xl border bg-[var(--as-surface)] shadow-[var(--as-shadow)] ${className}`} style={{ borderColor: "var(--as-border)" }}>
      {children}
    </section>
  );
}

function EmptyState({ children }: { children: ReactNode }) {
  return <div className="flex min-h-28 items-center justify-center px-5 text-center text-xs font-semibold" style={{ color: "var(--as-text-muted)" }}>{children}</div>;
}

export default function OverviewPage() {
  const [timeframe, setTimeframe] = useState<Timeframe>("30d");
  const [queueFilter, setQueueFilter] = useState<"all" | "ready">("all");
  const [queueNewestFirst, setQueueNewestFirst] = useState(true);
  const { selectedClient, selectedClientId, loading: clientLoading, error: clientError, refreshClients } = useClient();
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [rows, setRows] = useState<DashboardRowItem[]>([]);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [overviewReady, setOverviewReady] = useState(false);
  const [overviewError, setOverviewError] = useState("");
  const [reloadNonce, setReloadNonce] = useState(0);
  const effectiveClientId = selectedClient.id === "all" ? "all" : selectedClientId;

  useEffect(() => {
    let alive = true;
    const loadOverview = async () => {
      if (clientLoading) {
        if (alive) setOverviewLoading(true);
        return;
      }
      if (clientError) {
        if (alive) {
          setOverviewError(clientError);
          setOverviewLoading(false);
        }
        return;
      }
      if (!backendBase) {
        if (alive) {
          setOverviewError("Missing backend base URL configuration.");
          setOverviewLoading(false);
        }
        return;
      }
      if (!effectiveClientId && selectedClient.id !== "all") {
        if (alive) {
          setRoles([]);
          setRows([]);
          setOverviewReady(true);
          setOverviewLoading(false);
        }
        return;
      }
      setOverviewLoading(true);
      setOverviewReady(false);
      setOverviewError("");
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = String(session?.access_token || "").trim();
        if (!token) throw new Error("Missing session token.");
        const query = effectiveClientId && effectiveClientId !== "all" ? `?client_id=${encodeURIComponent(effectiveClientId)}` : "";
        const [rolesResponse, rowsResponse] = await Promise.all([
          fetch(`${backendBase}/roles${query}`, { headers: { Authorization: `Bearer ${token}` }, credentials: "omit" }),
          fetch(`${backendBase}/dashboard/rows${query}`, { headers: { Authorization: `Bearer ${token}` }, credentials: "omit" }),
        ]);
        const [rolesText, rowsText] = await Promise.all([rolesResponse.text(), rowsResponse.text()]);
        if (!rolesResponse.ok) throw new Error(extractErrorMessage(rolesText, "Failed to load roles."));
        if (!rowsResponse.ok) throw new Error(extractErrorMessage(rowsText, "Failed to load overview rows."));
        const rolesPayload = parseJsonSafe(rolesText);
        const roleItems = rolesPayload && typeof rolesPayload === "object" && Array.isArray((rolesPayload as { items?: unknown }).items)
          ? (rolesPayload as { items: unknown[] }).items
          : [];
        const mappedRoles = roleItems
          .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"))
          .map((item) => ({
            id: String(item.id || "").trim(),
            title: String(item.title || "").trim() || "Untitled Role",
            createdAtMs: toDateMs(item.created_at),
            type: getInterviewTypeLabel(item.interview_type) as InterviewTypeLabel,
            left: toWholeNonNegativeOrNull(item.remaining_interviews),
            used: toWholeNonNegativeOrNull(item.used_interviews),
          }))
          .filter((item) => Boolean(item.id));
        const rowsPayload = parseJsonSafe(rowsText);
        const rowItems = rowsPayload && typeof rowsPayload === "object" && Array.isArray((rowsPayload as { items?: unknown }).items)
          ? (rowsPayload as { items: unknown[] }).items
          : [];
        const mappedRows = rowItems
          .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"))
          .map((item, index) => {
            const role = item.role && typeof item.role === "object" ? item.role as Record<string, unknown> : {};
            const candidate = item.candidate && typeof item.candidate === "object" ? item.candidate as Record<string, unknown> : {};
            return {
              id: String(item.id || candidate.id || `row-${index}`),
              createdAtMs: toDateMs(item.created_at),
              roleId: String(role.id || item.role_id || "").trim(),
              roleTitle: String(role.title || "").trim() || "Role unavailable",
              candidateName: String(candidate.name || "").trim() || "Unnamed Candidate",
              overallScore: toScoreOrNull(item.overall_score),
              interviewScore: toScoreOrNull(item.interview_score),
              interviewStatus: String(item.interview_status || "").trim().toLowerCase(),
            };
          })
          .filter((item) => item.createdAtMs > 0);
        if (!alive) return;
        setRoles(mappedRoles);
        setRows(mappedRows);
        setOverviewReady(true);
      } catch (error) {
        if (!alive) return;
        setRoles([]);
        setRows([]);
        setOverviewError(error instanceof Error ? error.message : "Failed to load overview.");
      } finally {
        if (alive) setOverviewLoading(false);
      }
    };
    void loadOverview();
    return () => { alive = false; };
  }, [effectiveClientId, selectedClient.id, clientLoading, clientError, reloadNonce]);

  const stats = useMemo(() => computePeriodStats(timeframe, roles, rows), [timeframe, roles, rows]);
  const selectedWindow = useMemo(() => getWindowBounds(timeframe, Date.now()), [timeframe]);
  const periodRows = useMemo(() => rows.filter((row) => row.createdAtMs >= selectedWindow.start && row.createdAtMs < selectedWindow.end), [rows, selectedWindow]);
  const completedRows = useMemo(() => periodRows.filter((row) => row.interviewScore !== null || row.overallScore !== null || ["completed", "complete", "ended"].includes(row.interviewStatus)), [periodRows]);
  const completionRate = periodRows.length ? Math.round((completedRows.length / periodRows.length) * 100) : 0;
  const remainingCapacity = roles.reduce((sum, role) => sum + (role.left ?? 0), 0);
  const sortedRows = useMemo(() => [...rows].sort((a, b) => b.createdAtMs - a.createdAtMs), [rows]);
  const queueRows = useMemo(() => sortedRows
    .filter((row) => queueFilter === "all" || row.overallScore !== null)
    .sort((a, b) => queueNewestFirst ? b.createdAtMs - a.createdAtMs : a.createdAtMs - b.createdAtMs)
    .slice(0, 6), [queueFilter, queueNewestFirst, sortedRows]);

  const metricDefinitions = useMemo<MetricDefinition[]>(() => [
    { key: "roles", label: "Roles added", value: String(stats.roles), detail: `${stats.rolesDelta >= 0 ? "+" : ""}${stats.rolesDelta} vs prior period`, positive: stats.rolesDelta >= 0, icon: Briefcase, color: "#4F7DF3" },
    { key: "capacity", label: "Open capacity", value: roles.some((role) => role.left !== null) ? String(remainingCapacity) : "—", detail: roles.some((role) => role.left !== null) ? "interviews remaining" : "usage unavailable", positive: true, icon: FileCheck2, color: "#4F7DF3" },
    { key: "candidates", label: "Candidates added", value: String(stats.candidates), detail: `${stats.candidatesDelta >= 0 ? "+" : ""}${stats.candidatesDelta} vs prior period`, positive: stats.candidatesDelta >= 0, icon: Users, color: "#A380F6" },
    { key: "screen", label: "Time to first screen", value: stats.avgDays > 0 ? `${stats.avgDays.toFixed(1)}d` : "—", detail: stats.avgDays > 0 ? "for roles in period" : "not enough data", positive: true, icon: Clock3, color: "#02D99D" },
    { key: "completion", label: "Interview completion", value: periodRows.length ? `${completionRate}%` : "—", detail: periodRows.length ? `${completedRows.length} completed interviews` : "no candidates in period", positive: true, icon: CheckCircle2, color: "#02ABE0" },
  ], [completedRows.length, completionRate, periodRows.length, remainingCapacity, roles, stats]);

  const roleHealth = useMemo(() => roles
    .map((role) => {
      const roleRows = rows.filter((row) => row.roleId === role.id);
      const candidateCount = roleRows.length;
      const total = (role.left ?? 0) + (role.used ?? 0);
      const utilization = total > 0 ? Math.round(((role.used ?? 0) / total) * 100) : 0;
      const status = role.left === 0 && role.used !== null ? { label: "At risk", tone: "warning" as const } : candidateCount === 0 ? { label: "Attention", tone: "warning" as const } : { label: "Healthy", tone: "success" as const };
      const trend = Array.from({ length: 4 }, (_, index) => {
        const end = Date.now() - (3 - index) * 7 * DAY_MS;
        return { value: roleRows.filter((row) => row.createdAtMs <= end).length };
      });
      return { ...role, candidateCount, utilization, status, trend };
    })
    .sort((a, b) => b.candidateCount - a.candidateCount)
    .slice(0, 4), [roles, rows]);

  const activityData = useMemo(() => {
    const result: Array<{ label: string; count: number }> = [];
    const now = new Date();
    for (let offset = 6; offset >= 0; offset -= 1) {
      const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() - offset);
      const start = day.getTime();
      const end = start + DAY_MS;
      result.push({ label: day.toLocaleDateString("en-US", { weekday: "short" }).slice(0, 1), count: rows.filter((row) => row.createdAtMs >= start && row.createdAtMs < end).length });
    }
    return result;
  }, [rows]);

  return (
    <DashboardLayout title="Overview">
      <div className="mx-auto max-w-[1440px]">
        {overviewError && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 dark:bg-rose-400/10 dark:text-rose-300">
            <span>{overviewError}</span>
            <button type="button" onClick={() => { void refreshClients(); setReloadNonce((value) => value + 1); }} className="rounded-lg border border-current/20 px-3 py-1 text-xs font-black">Retry</button>
          </div>
        )}

        {!overviewError && !overviewReady && <div className="mb-4 text-sm font-semibold" style={{ color: "var(--as-text-muted)" }}>{overviewLoading ? "Loading overview…" : "Preparing overview…"}</div>}

        {overviewReady && (
          <>
            <SurfaceCard className="mb-5 overflow-hidden">
              <div className="grid divide-y divide-[var(--as-border)] sm:grid-cols-2 sm:divide-y-0 xl:grid-cols-5 xl:divide-x">
                {metricDefinitions.map((metric) => {
                  const Icon = metric.icon;
                  return (
                    <div key={metric.key} className="flex min-h-[112px] items-center gap-4 px-5 py-4">
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-black uppercase tracking-[0.12em]" style={{ color: "var(--as-text-muted)" }}>{metric.label}</p>
                        <p className="mt-2 text-2xl font-black leading-none" style={{ color: "var(--as-text)" }}>{metric.value}</p>
                        <p className={`mt-2 flex items-center gap-1 text-[10px] font-bold ${metric.positive ? "text-emerald-600 dark:text-emerald-300" : "text-rose-600 dark:text-rose-300"}`}>
                          {metric.positive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}{metric.detail}
                        </p>
                      </div>
                      <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: `${metric.color}18`, color: metric.color }}><Icon className="h-5 w-5" /></span>
                    </div>
                  );
                })}
              </div>
            </SurfaceCard>

            <div className="mb-4 flex items-end gap-6 border-b" style={{ borderColor: "var(--as-border)" }}>
              <h2 className="border-b-2 border-[#0A1547] pb-3 text-sm font-black dark:border-[#A380F6]">Today&apos;s decisions</h2>
              <Link href="/dashboard/candidates" className="pb-3 text-sm font-semibold" style={{ color: "var(--as-text-muted)" }}>All candidates</Link>
              <span className="ml-auto flex items-center gap-2 pb-2">
                <span className="hidden text-[10px] font-black uppercase tracking-wider sm:inline" style={{ color: "var(--as-text-muted)" }}>Compare</span>
                <label className="sr-only" htmlFor="overview-timeframe">Metrics timeframe</label>
                <select id="overview-timeframe" value={timeframe} onChange={(event) => setTimeframe(event.target.value as Timeframe)} className="rounded-lg border bg-[var(--as-surface)] px-2 py-1.5 text-xs font-bold" style={{ borderColor: "var(--as-border)", color: "var(--as-text)" }}>
                  {timeframes.map((value) => <option key={value}>{value}</option>)}
                </select>
              </span>
            </div>

            <div className="grid gap-5 xl:grid-cols-[minmax(0,1.85fr)_minmax(310px,0.95fr)]">
              <div className="min-w-0">
                <div className="mb-3 flex flex-wrap items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2"><h2 className="text-base font-black">Your action queue</h2><span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-[#A380F6]/15 px-2 text-[10px] font-black text-[#7655D0]">{queueRows.length}</span></div>
                    <p className="mt-1 text-xs" style={{ color: "var(--as-text-muted)" }}>The newest candidates in this client scope, ready for review.</p>
                  </div>
                  <button type="button" aria-pressed={queueFilter === "ready"} onClick={() => setQueueFilter((current) => current === "all" ? "ready" : "all")} className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-bold transition-colors hover:bg-[var(--as-hover)]" style={{ color: queueFilter === "ready" ? "#8B68E8" : "var(--as-text-muted)" }}><Filter className="h-3.5 w-3.5" /> {queueFilter === "ready" ? "Review ready" : "All candidates"}</button>
                  <button type="button" onClick={() => setQueueNewestFirst((current) => !current)} className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-bold transition-colors hover:bg-[var(--as-hover)]" style={{ color: "var(--as-text-muted)" }}><SlidersHorizontal className="h-3.5 w-3.5" /> {queueNewestFirst ? "Newest" : "Oldest"}</button>
                </div>

                <div className="space-y-2.5">
                  {queueRows.length === 0 && <SurfaceCard><EmptyState>No candidate activity is available for this client yet.</EmptyState></SurfaceCard>}
                  {queueRows.map((row, index) => {
                    const date = relativeDate(row.createdAtMs);
                    const state = candidateState(row);
                    const avatarColors = ["#CC3F75", "#9272EB", "#009E73", "#02ABE0"];
                    return (
                      <div key={row.id} className="grid grid-cols-[78px_minmax(0,1fr)] gap-3">
                        <div className="relative pt-3 text-[10px] font-bold" style={{ color: "var(--as-text-muted)" }}>
                          <CircleDot className="absolute -left-0.5 top-3 h-3 w-3" />
                          <p className="pl-4">{date.primary}</p><p className="mt-1 pl-4 text-[9px] opacity-75">{date.secondary}</p>
                          {index < queueRows.length - 1 && <span className="absolute bottom-[-20px] left-[5px] top-8 w-px bg-[var(--as-border)]" />}
                        </div>
                        <SurfaceCard className="group flex min-h-[78px] items-center gap-3 px-4 py-3 transition-colors hover:border-[#A380F6]/35">
                          <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-xs font-black text-white" style={{ backgroundColor: avatarColors[index % avatarColors.length] }}>{initials(row.candidateName)}</span>
                          <div className="min-w-0 flex-[1.15]"><p className="truncate text-xs font-black">{row.candidateName}</p><p className="mt-1 truncate text-[10px]" style={{ color: "var(--as-text-muted)" }}>{row.roleTitle}</p></div>
                          <div className="hidden min-w-0 flex-1 md:block"><p className="truncate text-xs font-bold">Candidate review</p><p className="mt-1 truncate text-[10px]" style={{ color: "var(--as-text-muted)" }}>{row.overallScore === null ? "Evaluation in progress" : `Overall score ${row.overallScore}%`}</p></div>
                          <div className="hidden sm:block"><StatusBadge label={state.label} tone={state.tone} /></div>
                          <Link href="/dashboard/candidates" className="inline-flex min-h-9 items-center justify-center rounded-lg border px-3 text-[11px] font-black transition-colors hover:border-[#A380F6]/45" style={{ borderColor: "var(--as-border)" }}>Review</Link>
                        </SurfaceCard>
                      </div>
                    );
                  })}
                </div>

                <Link href="/dashboard/candidates" className="mt-3 flex min-h-10 items-center rounded-xl border bg-[var(--as-surface)] px-4 text-xs font-bold text-[#8B68E8]" style={{ borderColor: "var(--as-border)" }}>View all candidates <ArrowRight className="ml-1.5 h-3.5 w-3.5" /></Link>
                <Link href="/dashboard/automation" className="mt-3 flex min-h-11 items-center gap-2 rounded-xl border bg-[var(--as-surface)] px-4 text-xs font-black" style={{ borderColor: "var(--as-border)" }}><Workflow className="h-4 w-4 text-emerald-500" /> Automations running <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300">View automation</span><ArrowRight className="ml-auto h-4 w-4" style={{ color: "var(--as-text-muted)" }} /></Link>
              </div>

              <aside className="space-y-4">
                <SurfaceCard className="p-4">
                  <div className="flex items-center justify-between"><h2 className="text-base font-black">Role health</h2><Link href="/dashboard/roles" className="text-[10px] font-bold text-[#9272EB]">View all roles →</Link></div>
                  <div className="mt-4 grid grid-cols-[minmax(0,1.5fr)_36px_50px_54px_76px] text-[9px] font-black uppercase tracking-wider" style={{ color: "var(--as-text-muted)" }}><span>Role</span><span>Open</span><span>Pipeline</span><span>Trend</span><span>Health</span></div>
                  <div className="mt-2 space-y-1">
                    {roleHealth.length === 0 && <EmptyState>No role health data is available yet.</EmptyState>}
                    {roleHealth.map((role) => (
                      <div key={role.id} className="grid min-h-9 grid-cols-[minmax(0,1.5fr)_36px_50px_54px_76px] items-center text-[10px]">
                        <span className="truncate pr-2 font-black">{role.title}</span><span style={{ color: "var(--as-text-muted)" }}>{role.left ?? "—"}</span><span style={{ color: "var(--as-text-muted)" }}>{role.candidateCount}</span>
                        <span className="h-7 w-12"><ResponsiveContainer width="100%" height="100%"><LineChart data={role.trend}><Line type="monotone" dataKey="value" stroke={role.status.tone === "success" ? "#02A57A" : "#E54872"} strokeWidth={2} dot={false} isAnimationActive={false} /></LineChart></ResponsiveContainer></span>
                        <StatusBadge label={role.status.label} tone={role.status.tone} />
                      </div>
                    ))}
                  </div>
                  <Link href="/dashboard/roles" className="mt-3 inline-flex text-[10px] font-bold text-[#9272EB]">Manage roles →</Link>
                </SurfaceCard>

                <SurfaceCard className="p-4">
                  <div className="flex items-center justify-between"><h2 className="text-base font-black">Interview activity</h2><Link href="/dashboard/candidates" className="text-[10px] font-bold text-[#9272EB]">View candidates →</Link></div>
                  <div className="mt-4 grid grid-cols-[72px_minmax(0,1fr)] items-end gap-3">
                    <div><p className="text-2xl font-black">{activityData.reduce((sum, item) => sum + item.count, 0)}</p><p className="text-[10px] font-semibold" style={{ color: "var(--as-text-muted)" }}>Candidates this week</p></div>
                    <div className="h-20"><ResponsiveContainer width="100%" height="100%"><BarChart data={activityData} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}><XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: "#8490AB" }} /><Tooltip cursor={{ fill: "rgba(163,128,246,0.06)" }} contentStyle={{ borderRadius: 10, borderColor: "rgba(163,128,246,0.2)", fontSize: 11 }} /><Bar dataKey="count" radius={[4, 4, 0, 0]} isAnimationActive={false}>{activityData.map((entry, index) => <Cell key={`${entry.label}-${index}`} fill={index === activityData.length - 1 ? "#02D99D" : "#A380F6"} />)}</Bar></BarChart></ResponsiveContainer></div>
                  </div>
                  <div className="mt-3 flex items-center justify-between border-t pt-3" style={{ borderColor: "var(--as-border)" }}><div><p className="text-lg font-black">{stats.avgDays > 0 ? `${stats.avgDays.toFixed(1)}d` : "—"}</p><p className="text-[10px]" style={{ color: "var(--as-text-muted)" }}>Avg time to first screening</p></div><CalendarClock className="h-8 w-8 text-[#9272EB]" /></div>
                </SurfaceCard>

                <SurfaceCard className="p-4">
                  <h2 className="text-base font-black">Recent movement</h2>
                  <div className="mt-3 space-y-2">
                    {sortedRows.length === 0 && <EmptyState>No recent candidate movement is available.</EmptyState>}
                    {sortedRows.slice(0, 3).map((row, index) => {
                      const state = candidateState(row);
                      return (
                        <div key={row.id} className="grid grid-cols-[24px_32px_minmax(0,1fr)_auto] items-center gap-2 py-1.5">
                          <span className={`flex h-6 w-6 items-center justify-center rounded-full ${state.tone === "success" ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-400/10" : "bg-sky-50 text-sky-600 dark:bg-sky-400/10"}`}>{index % 2 === 0 ? <ArrowUpRight className="h-3.5 w-3.5" /> : <UserRound className="h-3.5 w-3.5" />}</span>
                          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#A380F6]/15 text-[10px] font-black text-[#7655D0]">{initials(row.candidateName)}</span>
                          <span className="min-w-0"><span className="block truncate text-[11px] font-black">{row.candidateName}</span><span className="block truncate text-[9px]" style={{ color: "var(--as-text-muted)" }}>{row.roleTitle}</span></span>
                          <span className="text-right"><StatusBadge label={state.label} tone={state.tone} /><span className="mt-1 block text-[9px]" style={{ color: "var(--as-text-muted)" }}>{relativeDate(row.createdAtMs).secondary || relativeDate(row.createdAtMs).primary}</span></span>
                        </div>
                      );
                    })}
                  </div>
                  <Link href="/dashboard/candidates" className="mt-3 inline-flex text-[10px] font-bold text-[#9272EB]">View all activity →</Link>
                </SurfaceCard>
              </aside>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
