import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import {
  Building2, Briefcase, Users, CheckCircle2,
  Star, TrendingUp, ArrowRight, Activity,
} from "lucide-react";
import AdminLayout from "@/components/AdminLayout";
import { useAdminClient } from "@/context/AdminClientContext";
import { supabase } from "@/lib/supabaseClient";

/* ── Timeframe ───────────────────────────────────────────────── */
const timeframes = ["7d", "30d", "MTD", "6m", "YTD", "1y"] as const;
type Timeframe = (typeof timeframes)[number];
type InterviewType = "Basic" | "Detailed" | "Technical";

/* ── Platform-wide stats per timeframe ──────────────────────── */
interface PlatformStats {
  clients: number;
  roles: number;
  candidates: number;
  completed: number;
  avgScore: number;
  completionRate: number;
  rolesDelta: number;
  candidatesDelta: number;
  completedDelta: number;
}

/* ── Recent role activity rows ───────────────────────────────── */
interface ActivityRow {
  client: string;
  role: string;
  type: InterviewType;
  candidates: number;
  date: string;
}

/* ── Client breakdown ────────────────────────────────────────── */
interface ClientRow {
  name: string;
  letter: string;
  color: string;
  roles: number;
  candidates: number;
  avgScore: number;
}

interface AdminClientItem {
  id: string;
  name: string;
  letter: string;
  color: string;
}

interface RoleItem {
  id: string;
  clientId: string;
  title: string;
  type: InterviewType;
  createdAtMs: number;
}

interface CandidateItem {
  id: string;
  clientId: string;
  roleId: string;
  createdAtMs: number;
  interviewStatus: string;
  interviewScore: number | null;
  overallScore: number | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const CLIENT_COLORS = ["#A380F6", "#02ABE0", "#02D99D", "#F0A500", "#FF6B6B", "#5B6FBB", "#0285B0"] as const;

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
  return text;
}

function toDateMs(value: unknown): number {
  const raw = String(value || "").trim();
  if (!raw) return 0;
  const parsed = new Date(raw).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

function toScoreOrNull(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" && value.trim() === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(100, n));
}

function normalizeInterviewType(value: unknown): InterviewType {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "detailed") return "Detailed";
  if (normalized === "technical") return "Technical";
  return "Basic";
}

function hashText(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function letterForClient(name: string): string {
  const match = String(name || "").trim().match(/[A-Za-z0-9]/);
  return match ? match[0].toUpperCase() : "C";
}

function colorForClient(id: string, index: number): string {
  const seed = String(id || index || "admin-client");
  return CLIENT_COLORS[hashText(seed) % CLIENT_COLORS.length];
}

function getWindowBounds(timeframe: Timeframe, nowMs: number): { start: number; end: number } {
  const now = new Date(nowMs);
  const end = nowMs;

  if (timeframe === "7d") return { start: end - 7 * DAY_MS, end };
  if (timeframe === "30d") return { start: end - 30 * DAY_MS, end };
  if (timeframe === "MTD") return { start: new Date(now.getFullYear(), now.getMonth(), 1).getTime(), end };
  if (timeframe === "6m") {
    const start = new Date(now);
    start.setMonth(start.getMonth() - 6);
    return { start: start.getTime(), end };
  }
  if (timeframe === "YTD") return { start: new Date(now.getFullYear(), 0, 1).getTime(), end };
  const start = new Date(now);
  start.setFullYear(start.getFullYear() - 1);
  return { start: start.getTime(), end };
}

function inWindow(timestamp: number, start: number, end: number): boolean {
  return timestamp >= start && timestamp < end;
}

function isInterviewStarted(candidate: CandidateItem): boolean {
  return Boolean(candidate.interviewStatus) || candidate.interviewScore !== null || candidate.overallScore !== null;
}

function isInterviewCompleted(candidate: CandidateItem): boolean {
  if (/\bcomplete(?:d)?\b/i.test(candidate.interviewStatus)) return true;
  return candidate.interviewScore !== null && candidate.overallScore !== null;
}

function summarizeWindow(
  start: number,
  end: number,
  roles: RoleItem[],
  candidates: CandidateItem[],
): Omit<PlatformStats, "clients" | "rolesDelta" | "candidatesDelta" | "completedDelta"> & { roles: number } {
  const rolesInWindow = roles.filter((role) => inWindow(role.createdAtMs, start, end));
  const candidatesInWindow = candidates.filter((candidate) => inWindow(candidate.createdAtMs, start, end));
  const completed = candidatesInWindow.filter(isInterviewCompleted);
  const totalCandidates = candidatesInWindow.length;
  const candidatesWithInterviewScore = candidatesInWindow.filter((candidate) => candidate.interviewScore !== null).length;
  const scored = candidatesInWindow.filter((candidate) => candidate.overallScore !== null);
  const avgScoreRaw = scored.length
    ? scored.reduce((sum, candidate) => sum + Number(candidate.overallScore || 0), 0) / scored.length
    : 0;
  const completionRateRaw = totalCandidates ? (candidatesWithInterviewScore / totalCandidates) * 100 : 0;

  return {
    roles: rolesInWindow.length,
    candidates: candidatesInWindow.length,
    completed: completed.length,
    avgScore: Math.round(avgScoreRaw),
    completionRate: Math.round(completionRateRaw),
  };
}

function formatMonthDay(timestamp: number): string {
  if (!Number.isFinite(timestamp) || timestamp <= 0) return "—";
  return new Date(timestamp).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

/* ── Type badge colors ───────────────────────────────────────── */
const typeColors: Record<string, { bg: string; text: string }> = {
  Basic: { bg: "rgba(163,128,246,0.12)", text: "#7C5FCC" },
  Detailed: { bg: "rgba(2,171,224,0.12)", text: "#0285B0" },
  Technical: { bg: "rgba(2,217,157,0.12)", text: "#009E73" },
};

/* ── Trend indicator ─────────────────────────────────────────── */
function Trend({ delta }: { delta: number }) {
  if (delta === 0) return <span className="text-[11px] font-semibold" style={{ color: "var(--as-text-subtle)" }}>No change</span>;
  const positive = delta > 0;
  return (
    <span className="text-[11px] font-bold" style={{ color: positive ? "#02D99D" : "#FF6B6B" }}>
      {positive ? "+" : ""}
      {delta} vs prior period
    </span>
  );
}

/* ── Score badge ─────────────────────────────────────────────── */
function ScoreBadge({ score }: { score: number }) {
  const color = score >= 75 ? "#02D99D" : score >= 60 ? "#F0A500" : "#FF6B6B";
  return (
    <span
      className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-black"
      style={{ backgroundColor: `${color}18`, color }}
    >
      {score}
    </span>
  );
}

/* ── Metric card config ──────────────────────────────────────── */
const metricCards = [
  {
    label: "Active Clients",
    icon: Building2,
    color: "#A380F6",
    format: (s: PlatformStats) => String(s.clients),
    sub: "client accounts",
    delta: (_s: PlatformStats) => 0,
  },
  {
    label: "Active Roles",
    icon: Briefcase,
    color: "#02ABE0",
    format: (s: PlatformStats) => String(s.roles),
    sub: "across all clients",
    delta: (s: PlatformStats) => s.rolesDelta,
  },
  {
    label: "Candidates Screened",
    icon: Users,
    color: "#02D99D",
    format: (s: PlatformStats) => s.candidates.toLocaleString(),
    sub: "total screenings",
    delta: (s: PlatformStats) => s.candidatesDelta,
  },
  {
    label: "Interviews Completed",
    icon: CheckCircle2,
    color: "#F0A500",
    format: (s: PlatformStats) => s.completed.toLocaleString(),
    sub: "fully completed",
    delta: (s: PlatformStats) => s.completedDelta,
  },
  {
    label: "Avg Overall Score",
    icon: Star,
    color: "#A380F6",
    format: (s: PlatformStats) => `${s.avgScore}`,
    sub: "platform average",
    delta: (_s: PlatformStats) => 0,
  },
  {
    label: "Client Activity Rate",
    icon: TrendingUp,
    color: "#02D99D",
    format: (s: PlatformStats) => `${s.completionRate.toFixed(1)}%`,
    sub: "clients with completed interviews",
    delta: (_s: PlatformStats) => 0,
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

function timeframeButtonStyle(active: boolean) {
  return active
    ? { backgroundColor: "var(--as-text)", color: "var(--as-surface)" }
    : mutedTextStyle;
}

export default function AdminOverviewPage() {
  const [timeframe, setTimeframe] = useState<Timeframe>("30d");
  const {
    selectedClient,
    selectedClientId,
    loading: adminClientsLoading,
    error: adminClientsError,
    refreshClients,
  } = useAdminClient();
  const [globalClients, setGlobalClients] = useState<AdminClientItem[]>([]);
  const [globalRoles, setGlobalRoles] = useState<RoleItem[]>([]);
  const [globalCandidates, setGlobalCandidates] = useState<CandidateItem[]>([]);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [overviewReady, setOverviewReady] = useState(false);
  const [overviewError, setOverviewError] = useState("");

  const isAllClients = selectedClient.id === "all" || selectedClientId === "all";

  useEffect(() => {
    let alive = true;

    const loadOverview = async () => {
      if (adminClientsLoading) {
        if (!alive) return;
        setOverviewReady(false);
        setOverviewLoading(true);
        setOverviewError("");
        return;
      }
      if (adminClientsError) {
        if (!alive) return;
        setGlobalClients([]);
        setGlobalRoles([]);
        setGlobalCandidates([]);
        setOverviewReady(false);
        setOverviewError(adminClientsError);
        setOverviewLoading(false);
        return;
      }
      if (!backendBase) {
        if (!alive) return;
        setGlobalClients([]);
        setGlobalRoles([]);
        setGlobalCandidates([]);
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

        const getJson = async (path: string, fallback: string): Promise<unknown> => {
          const response = await fetch(`${backendBase}${path}`, {
            method: "GET",
            headers: { Authorization: `Bearer ${token}` },
            credentials: "omit",
          });
          const text = await response.text();
          if (!response.ok) throw new Error(extractErrorMessage(text, fallback));
          return parseJsonSafe(text);
        };

        const clientsPayload = await getJson("/admin/clients", "Failed to load clients.");
        const clientItems = clientsPayload && typeof clientsPayload === "object" && Array.isArray((clientsPayload as { items?: unknown }).items)
          ? (clientsPayload as { items: unknown[] }).items
          : [];

        const mappedClients: AdminClientItem[] = clientItems
          .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"))
          .map((item, index) => {
            const id = String(item.id || "").trim();
            const name = String(item.name || "").trim() || id || `Client ${index + 1}`;
            return {
              id,
              name,
              letter: letterForClient(name),
              color: colorForClient(id, index),
            };
          })
          .filter((item) => Boolean(item.id));

        const rolesPayload = await getJson("/admin/roles", "Failed to load roles.");
        const roleItems = rolesPayload && typeof rolesPayload === "object" && Array.isArray((rolesPayload as { items?: unknown }).items)
          ? (rolesPayload as { items: unknown[] }).items
          : [];

        const mappedRoles: RoleItem[] = roleItems
          .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"))
          .map((item) => ({
            id: String(item.id || "").trim(),
            clientId: String(item.client_id || "").trim(),
            title: String(item.title || "").trim() || "Untitled role",
            type: normalizeInterviewType(item.interview_type),
            createdAtMs: toDateMs(item.created_at),
          }))
          .filter((item) => Boolean(item.id && item.clientId));

        const candidateBatches = await Promise.all(
          mappedClients.map(async (client) => {
            const payload = await getJson(
              `/admin/candidates?client_id=${encodeURIComponent(client.id)}`,
              `Failed to load candidates for ${client.name}.`,
            );
            const rows = payload && typeof payload === "object" && Array.isArray((payload as { candidates?: unknown }).candidates)
              ? (payload as { candidates: unknown[] }).candidates
              : [];

            return rows
              .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"))
              .map((item) => ({
                id: String(item.id || "").trim(),
                clientId: String(item.client_id || client.id).trim(),
                roleId: String(item.role_id || "").trim(),
                createdAtMs: toDateMs(item.created_at),
                interviewStatus: String(item.interview_status || "").trim().toLowerCase(),
                interviewScore: toScoreOrNull(item.interview_score),
                overallScore: toScoreOrNull(item.overall_score),
              }))
              .filter((item) => Boolean(item.id && item.clientId));
          }),
        );

        if (!alive) return;
        setGlobalClients(mappedClients);
        setGlobalRoles(mappedRoles);
        setGlobalCandidates(candidateBatches.flat());
        setOverviewReady(true);
        setOverviewError("");
      } catch (error) {
        if (!alive) return;
        setGlobalClients([]);
        setGlobalRoles([]);
        setGlobalCandidates([]);
        setOverviewReady(false);
        setOverviewError(error instanceof Error ? error.message : "Failed to load admin overview.");
      } finally {
        if (alive) setOverviewLoading(false);
      }
    };

    void loadOverview();
    return () => {
      alive = false;
    };
  }, [adminClientsLoading, adminClientsError]);

  const clientNameById = useMemo(
    () => Object.fromEntries(globalClients.map((client) => [client.id, client.name])),
    [globalClients],
  );

  const scopedRoles = useMemo(() => {
    if (isAllClients) return globalRoles;
    return globalRoles.filter((role) => role.clientId === selectedClientId);
  }, [globalRoles, isAllClients, selectedClientId]);

  const scopedCandidates = useMemo(() => {
    if (isAllClients) return globalCandidates;
    return globalCandidates.filter((candidate) => candidate.clientId === selectedClientId);
  }, [globalCandidates, isAllClients, selectedClientId]);

  const scopedClientCount = useMemo(() => {
    if (isAllClients) return globalClients.length;
    return globalClients.some((client) => client.id === selectedClientId) ? 1 : 0;
  }, [globalClients, isAllClients, selectedClientId]);

  const stats = useMemo<PlatformStats>(() => {
    const nowMs = Date.now();
    const current = getWindowBounds(timeframe, nowMs);
    const durationMs = Math.max(1, current.end - current.start);
    const priorStart = current.start - durationMs;
    const priorEnd = current.start;

    const currentSummary = summarizeWindow(current.start, current.end, scopedRoles, scopedCandidates);
    const priorSummary = summarizeWindow(priorStart, priorEnd, scopedRoles, scopedCandidates);
    const clientsWithCompletedInWindow = new Set(
      globalCandidates
        .filter((candidate) => inWindow(candidate.createdAtMs, current.start, current.end) && isInterviewCompleted(candidate))
        .map((candidate) => candidate.clientId),
    );
    const clientActivityRate = globalClients.length ? (clientsWithCompletedInWindow.size / globalClients.length) * 100 : 0;

    return {
      clients: scopedClientCount,
      roles: currentSummary.roles,
      candidates: currentSummary.candidates,
      completed: currentSummary.completed,
      avgScore: currentSummary.avgScore,
      completionRate: clientActivityRate,
      rolesDelta: currentSummary.roles - priorSummary.roles,
      candidatesDelta: currentSummary.candidates - priorSummary.candidates,
      completedDelta: currentSummary.completed - priorSummary.completed,
    };
  }, [timeframe, scopedRoles, scopedCandidates, scopedClientCount, globalCandidates, globalClients]);

  const recentActivity = useMemo<ActivityRow[]>(() => {
    const candidateCountByRoleId = new Map<string, number>();
    for (const candidate of scopedCandidates) {
      if (!candidate.roleId) continue;
      const current = candidateCountByRoleId.get(candidate.roleId) || 0;
      candidateCountByRoleId.set(candidate.roleId, current + 1);
    }

    return [...scopedRoles]
      .sort((a, b) => b.createdAtMs - a.createdAtMs)
      .slice(0, 10)
      .map((role) => ({
        client: clientNameById[role.clientId] || "—",
        role: role.title,
        type: role.type,
        candidates: candidateCountByRoleId.get(role.id) || 0,
        date: formatMonthDay(role.createdAtMs),
      }));
  }, [scopedRoles, scopedCandidates, clientNameById]);

  const clientBreakdown = useMemo<ClientRow[]>(() => {
    const rolesByClient = new Map<string, number>();
    for (const role of globalRoles) {
      const current = rolesByClient.get(role.clientId) || 0;
      rolesByClient.set(role.clientId, current + 1);
    }

    const candidatesByClient = new Map<string, number>();
    const scoreTotalsByClient = new Map<string, { sum: number; count: number }>();
    for (const candidate of globalCandidates) {
      const current = candidatesByClient.get(candidate.clientId) || 0;
      candidatesByClient.set(candidate.clientId, current + 1);

      if (candidate.overallScore !== null) {
        const existing = scoreTotalsByClient.get(candidate.clientId) || { sum: 0, count: 0 };
        scoreTotalsByClient.set(candidate.clientId, {
          sum: existing.sum + Number(candidate.overallScore),
          count: existing.count + 1,
        });
      }
    }

    return [...globalClients]
      .map((client) => {
        const score = scoreTotalsByClient.get(client.id);
        const avgScore = score && score.count > 0 ? Math.round(score.sum / score.count) : 0;
        return {
          name: client.name,
          letter: client.letter,
          color: client.color,
          roles: rolesByClient.get(client.id) || 0,
          candidates: candidatesByClient.get(client.id) || 0,
          avgScore,
        };
      })
      .sort((a, b) => {
        if (b.candidates !== a.candidates) return b.candidates - a.candidates;
        return a.name.localeCompare(b.name);
      });
  }, [globalClients, globalRoles, globalCandidates]);

  return (
    <AdminLayout title="Overview">
      {/* ── Header ───────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-7">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-[#0A1547]/35 mb-1" style={{ color: "var(--as-text)", opacity: 0.35 }}>
            {selectedClient.id === "all" ? "Platform" : "Client"}
          </p>
          <h2 className="text-2xl font-black text-[#0A1547] leading-tight" style={{ color: "var(--as-text)" }}>
            {selectedClient.id === "all" ? "All Clients" : selectedClient.name}
          </h2>
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
      {/* ── Metric cards — 2×3 grid ──────────────────────── */}
      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4 mb-7">
        {metricCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className="bg-white rounded-2xl overflow-hidden flex flex-col"
              style={surfaceCardStyle}
            >
              <div className="h-[3px]" style={{ backgroundColor: card.color }} />
              <div className="p-5 flex flex-col flex-1">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-[10px] font-black uppercase tracking-widest" style={subtleTextStyle}>
                    {card.label}
                  </p>
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

      {/* ── Bottom row: Activity + Client Breakdown ────────── */}
      <div className="grid xl:grid-cols-5 gap-4">
        {/* Recent Role Activity */}
        <div
          className="xl:col-span-3 bg-white rounded-2xl overflow-hidden"
          style={surfaceCardStyle}
        >
          <div className="flex items-center justify-between px-6 py-4 border-b" style={dividerStyle}>
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4" style={subtleTextStyle} />
              <p className="text-sm font-black" style={primaryTextStyle}>Recent Role Activity</p>
            </div>
            <Link
              href="/admin/roles"
              className="flex items-center gap-1 text-xs font-bold transition-colors"
              style={{ color: "#A380F6" }}
            >
              View all <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="divide-y divide-[var(--as-border)]">
            {!overviewLoading && recentActivity.length === 0 && (
              <div className="px-6 py-4 text-sm font-semibold" style={mutedTextStyle}>
                No recent roles in this scope.
              </div>
            )}
            {recentActivity.map((row, i) => {
              const tc = typeColors[row.type];
              return (
                <div
                  key={i}
                  className="as-shell-dropdown-item flex items-center gap-3 px-6 py-3 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold truncate leading-snug" style={primaryTextStyle}>{row.role}</p>
                    <p className="text-[11px] mt-0.5" style={subtleTextStyle}>{row.client}</p>
                  </div>
                  <span
                    className="flex-shrink-0 px-2 py-0.5 rounded-lg text-[10px] font-bold"
                    style={{ backgroundColor: tc.bg, color: tc.text }}
                  >
                    {row.type}
                  </span>
                  <div className="flex-shrink-0 text-right">
                    <p className="text-sm font-black" style={primaryTextStyle}>{row.candidates}</p>
                    <p className="text-[10px]" style={subtleTextStyle}>screened</p>
                  </div>
                  <p className="flex-shrink-0 text-[11px] w-10 text-right" style={subtleTextStyle}>{row.date}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Clients by Volume */}
        <div
          className="xl:col-span-2 bg-white rounded-2xl overflow-hidden"
          style={surfaceCardStyle}
        >
          <div className="flex items-center justify-between px-6 py-4 border-b" style={dividerStyle}>
            <p className="text-sm font-black" style={primaryTextStyle}>Clients by Volume</p>
            <Link
              href="/admin/clients"
              className="flex items-center gap-1 text-xs font-bold transition-colors"
              style={{ color: "#A380F6" }}
            >
              View all <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="divide-y divide-[var(--as-border)]">
            {!overviewLoading && clientBreakdown.length === 0 && (
              <div className="px-6 py-4 text-sm font-semibold" style={mutedTextStyle}>
                No client volume data yet.
              </div>
            )}
            {clientBreakdown.slice(0, 10).map((client, i) => (
              <div
                key={i}
                className="as-shell-dropdown-item flex items-center gap-3 px-5 py-3 transition-colors"
              >
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-black text-white flex-shrink-0"
                  style={{ backgroundColor: client.color }}
                >
                  {client.letter}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold truncate leading-snug" style={primaryTextStyle}>{client.name}</p>
                  <p className="text-[10px] mt-0.5" style={subtleTextStyle}>
                    {client.roles} roles · {client.candidates} candidates
                  </p>
                </div>
                <ScoreBadge score={client.avgScore} />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Client name scroller ──────────────────────────── */}
      <div className="mt-4">
        <div
          className="bg-white rounded-2xl overflow-hidden py-5"
          style={surfaceCardStyle}
        >
          <p className="text-[9px] font-black uppercase tracking-[0.2em] text-center mb-4" style={subtleTextStyle}>
            Active Client Network
          </p>

          {/* Fade masks + scrolling track */}
          <div className="relative overflow-hidden w-full">
            {/* Left fade */}
            <div
              className="absolute left-0 top-0 bottom-0 w-16 z-10 pointer-events-none"
              style={{ background: "linear-gradient(to right, var(--as-surface), transparent)" }}
            />
            {/* Right fade */}
            <div
              className="absolute right-0 top-0 bottom-0 w-16 z-10 pointer-events-none"
              style={{ background: "linear-gradient(to left, var(--as-surface), transparent)" }}
            />

            {/* Scrolling strip — items duplicated for seamless loop */}
            <div className="flex animate-marquee w-max">
              {globalClients.length === 0 && !overviewLoading ? (
                <div className="px-6 text-sm font-semibold" style={mutedTextStyle}>No active clients.</div>
              ) : (
                [...globalClients, ...globalClients].map((client, i) => (
                  <div key={i} className="flex items-center gap-2.5 mx-8 flex-shrink-0">
                    <div
                      className="w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-black text-white flex-shrink-0"
                      style={{ backgroundColor: client.color }}
                    >
                      {client.letter}
                    </div>
                    <span
                      className="text-sm font-bold whitespace-nowrap"
                      style={mutedTextStyle}
                    >
                      {client.name}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
        </>
      )}
    </AdminLayout>
  );
}
