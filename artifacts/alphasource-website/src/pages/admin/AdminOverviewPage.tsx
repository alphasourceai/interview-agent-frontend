import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import {
  Building2, Briefcase, Users, CheckCircle2,
  Star, ArrowRight, Download, Plus, AlertCircle,
} from "lucide-react";
import AdminLayout from "@/components/AdminLayout";
import AppearanceSelector from "@/components/AppearanceSelector";
import { useAdminClient } from "@/context/AdminClientContext";
import { getInterviewTypeLabel, type InterviewTypeLabel } from "@/lib/interviewContract";
import { supabase } from "@/lib/supabaseClient";

/* ── Timeframe ───────────────────────────────────────────────── */
const timeframes = ["7d", "30d", "MTD", "6m", "YTD", "1y"] as const;
type Timeframe = (typeof timeframes)[number];

/* ── Platform-wide stats per timeframe ──────────────────────── */
interface PlatformStats {
  clients: number;
  roles: number;
  candidates: number;
  completed: number;
  avgScore: number;
  completionRate: number;
  clientActivityRate: number;
  rolesDelta: number;
  candidatesDelta: number;
  completedDelta: number;
}

/* ── Recent role activity rows ───────────────────────────────── */
interface ActivityRow {
  client: string;
  role: string;
  type: InterviewTypeLabel;
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
  completed: number;
  avgScore: number | null;
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
  type: InterviewTypeLabel;
  status: string;
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
): Omit<PlatformStats, "clients" | "clientActivityRate" | "rolesDelta" | "candidatesDelta" | "completedDelta"> & { roles: number } {
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
function ScoreBadge({ score }: { score: number | null }) {
  if (score === null) {
    return <span className="inline-flex rounded-lg bg-[var(--as-surface-muted)] px-2.5 py-1 text-xs font-black" style={mutedTextStyle}>—</span>;
  }
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
    label: "Candidates",
    icon: Users,
    color: "#02D99D",
    format: (s: PlatformStats) => s.candidates.toLocaleString(),
    sub: "in selected period",
    delta: (s: PlatformStats) => s.candidatesDelta,
  },
  {
    label: "Interviews",
    icon: CheckCircle2,
    color: "#F0A500",
    format: (s: PlatformStats) => s.completed.toLocaleString(),
    sub: "fully completed",
    delta: (s: PlatformStats) => s.completedDelta,
  },
  {
    label: "Avg. Score",
    icon: Star,
    color: "#A380F6",
    format: (s: PlatformStats) => `${s.avgScore}`,
    sub: "platform average",
    delta: (_s: PlatformStats) => 0,
  },
];

const surfaceCardStyle = {
  backgroundColor: "var(--as-surface)",
  border: "1px solid var(--as-border)",
  boxShadow: "var(--as-shadow)",
};
const dividerStyle = { borderColor: "var(--as-border)" };
const primaryTextStyle = { color: "var(--as-text)" };
const mutedTextStyle = { color: "var(--as-text-muted)" };
const subtleTextStyle = { color: "var(--as-text-subtle)" };

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
            type: getInterviewTypeLabel(item.interview_type) as InterviewTypeLabel,
            status: String(item.status || "active").trim().toLowerCase(),
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
      scopedCandidates
        .filter((candidate) => inWindow(candidate.createdAtMs, current.start, current.end) && isInterviewCompleted(candidate))
        .map((candidate) => candidate.clientId),
    );
    const clientActivityRate = scopedClientCount ? (clientsWithCompletedInWindow.size / scopedClientCount) * 100 : 0;

    const activeRoles = scopedRoles.filter((role) => role.status !== "inactive" && role.status !== "closed").length;

    return {
      clients: scopedClientCount,
      roles: activeRoles,
      candidates: currentSummary.candidates,
      completed: currentSummary.completed,
      avgScore: currentSummary.avgScore,
      completionRate: currentSummary.completionRate,
      clientActivityRate,
      rolesDelta: currentSummary.roles - priorSummary.roles,
      candidatesDelta: currentSummary.candidates - priorSummary.candidates,
      completedDelta: currentSummary.completed - priorSummary.completed,
    };
  }, [timeframe, scopedRoles, scopedCandidates, scopedClientCount]);

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
    const nowMs = Date.now();
    const window = getWindowBounds(timeframe, nowMs);
    const rolesByClient = new Map<string, number>();
    for (const role of globalRoles) {
      if (role.status === "inactive" || role.status === "closed") continue;
      const current = rolesByClient.get(role.clientId) || 0;
      rolesByClient.set(role.clientId, current + 1);
    }

    const candidatesByClient = new Map<string, number>();
    const completedByClient = new Map<string, number>();
    const scoreTotalsByClient = new Map<string, { sum: number; count: number }>();
    for (const candidate of globalCandidates) {
      if (!inWindow(candidate.createdAtMs, window.start, window.end)) continue;
      const current = candidatesByClient.get(candidate.clientId) || 0;
      candidatesByClient.set(candidate.clientId, current + 1);
      if (isInterviewCompleted(candidate)) {
        completedByClient.set(candidate.clientId, (completedByClient.get(candidate.clientId) || 0) + 1);
      }

      if (candidate.overallScore !== null) {
        const existing = scoreTotalsByClient.get(candidate.clientId) || { sum: 0, count: 0 };
        scoreTotalsByClient.set(candidate.clientId, {
          sum: existing.sum + Number(candidate.overallScore),
          count: existing.count + 1,
        });
      }
    }

    const visibleClients = isAllClients
      ? globalClients
      : globalClients.filter((client) => client.id === selectedClientId);

    return visibleClients
      .map((client) => {
        const score = scoreTotalsByClient.get(client.id);
        const avgScore = score && score.count > 0 ? Math.round(score.sum / score.count) : null;
        return {
          name: client.name,
          letter: client.letter,
          color: client.color,
          roles: rolesByClient.get(client.id) || 0,
          candidates: candidatesByClient.get(client.id) || 0,
          completed: completedByClient.get(client.id) || 0,
          avgScore,
        };
      })
      .sort((a, b) => {
        if (b.candidates !== a.candidates) return b.candidates - a.candidates;
        return a.name.localeCompare(b.name);
      });
  }, [globalClients, globalRoles, globalCandidates, timeframe, isAllClients, selectedClientId]);

  const exportOverview = () => {
    if (typeof window === "undefined") return;
    const rows = [
      ["Client", "Active roles", "Candidates in period", "Completed interviews", "Average score"],
      ...clientBreakdown.map((client) => [client.name, client.roles, client.candidates, client.completed, client.avgScore]),
    ];
    const csv = rows
      .map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `alphascreen-admin-overview-${timeframe.toLowerCase()}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AdminLayout title="Overview">
      {/* ── Header ───────────────────────────────────────── */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black leading-tight tracking-[-0.03em] sm:text-[28px]" style={primaryTextStyle}>Platform overview</h1>
          <p className="mt-1 text-xs font-medium sm:text-sm" style={mutedTextStyle}>
            Monitor client health, hiring activity, and interview progress for {selectedClient.id === "all" ? "all clients" : selectedClient.name}.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <span className="hidden lg:inline-flex"><AppearanceSelector /></span>
          <label className="sr-only" htmlFor="admin-overview-timeframe">Overview timeframe</label>
          <select id="admin-overview-timeframe" value={timeframe} onChange={(event) => setTimeframe(event.target.value as Timeframe)} className="h-10 rounded-xl border bg-[var(--as-surface)] px-3 text-xs font-bold outline-none focus:border-[#A380F6]" style={{ borderColor: "var(--as-border)", color: "var(--as-text)" }}>
            {timeframes.map((tf) => <option key={tf} value={tf}>{tf}</option>)}
          </select>
          <button type="button" onClick={exportOverview} disabled={!overviewReady} className="inline-flex h-10 items-center gap-1.5 rounded-xl border bg-[var(--as-surface)] px-3 text-xs font-bold disabled:cursor-not-allowed disabled:opacity-45" style={{ borderColor: "var(--as-border)", color: "var(--as-text)" }}>
            <Download className="h-3.5 w-3.5" /> Export
          </button>
          <Link href="/admin/clients" className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-[#A380F6] px-3.5 text-xs font-bold text-white shadow-[0_8px_18px_rgba(163,128,246,0.24)]">
            <Plus className="h-3.5 w-3.5" /> Add client
          </Link>
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
      {/* ── Compact platform metrics ──────────────────────── */}
      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {metricCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className="flex min-h-[116px] flex-col overflow-hidden rounded-xl bg-white"
              style={surfaceCardStyle}
            >
              <div className="flex flex-1 flex-col p-4">
                <div className="mb-3 flex items-center justify-between">
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
                <p className="mb-2 text-2xl font-black leading-none" style={primaryTextStyle}>
                  {card.format(stats)}
                </p>
                <div className="mt-auto space-y-0.5">
                  {card.label === "Active Roles"
                    ? <span className="text-[11px] font-semibold" style={mutedTextStyle}>Current active roles</span>
                    : <Trend delta={card.delta(stats)} />}
                  <p className="text-[11px] font-medium" style={subtleTextStyle}>
                    {card.label === "Active Roles"
                      ? (isAllClients ? "across all clients" : "for selected client")
                      : card.label === "Avg. Score"
                        ? (isAllClients ? "platform average" : "selected client average")
                        : card.sub}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Operational review + context rail ─────────────── */}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,2.1fr)_minmax(280px,1fr)]">
        <section className="overflow-hidden rounded-xl bg-white" style={surfaceCardStyle}>
          <div className="flex items-start justify-between gap-4 border-b px-5 py-4" style={dividerStyle}>
            <div>
              <h2 className="text-base font-black" style={primaryTextStyle}>Client operational review</h2>
              <p className="mt-0.5 text-[11px] font-medium" style={mutedTextStyle}>Prioritize accounts using current roles and activity.</p>
            </div>
            <Link href="/admin/clients" className="flex items-center gap-1 text-[11px] font-bold text-[#8B68E8]">All clients <ArrowRight className="h-3.5 w-3.5" /></Link>
          </div>

          <div className="grid grid-cols-[minmax(0,1.6fr)_70px_92px_82px] gap-2 bg-[var(--as-surface-muted)] px-5 py-2 text-[9px] font-black uppercase tracking-[0.11em] sm:grid-cols-[minmax(0,1.7fr)_70px_92px_90px_96px]" style={subtleTextStyle}>
            <span>Client</span><span>Roles</span><span>Candidates</span><span>Score</span><span className="hidden sm:block">Status</span>
          </div>
          <div className="divide-y divide-[var(--as-border)] px-3">
            {!overviewLoading && clientBreakdown.length === 0 && <p className="px-2 py-5 text-sm font-semibold" style={mutedTextStyle}>No client activity is available in this scope.</p>}
            {clientBreakdown.slice(0, 8).map((client) => {
              const status = client.candidates > 0 ? "Active" : client.roles > 0 ? "Ready" : "Quiet";
              const statusColor = status === "Active" ? "#04966F" : status === "Ready" ? "#7C5FCC" : "#718096";
              return (
                <div key={client.name} className="grid min-h-[62px] grid-cols-[minmax(0,1.6fr)_70px_92px_82px] items-center gap-2 rounded-lg px-2 py-2.5 transition-colors hover:bg-[var(--as-hover)] sm:grid-cols-[minmax(0,1.7fr)_70px_92px_90px_96px]">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-bold" style={primaryTextStyle}>{client.name}</p>
                    <p className="mt-0.5 text-[10px]" style={subtleTextStyle}>{client.completed} completed in period</p>
                  </div>
                  <div><p className="text-xs font-black" style={primaryTextStyle}>{client.roles}</p><p className="text-[9px]" style={subtleTextStyle}>active</p></div>
                  <div><p className="text-xs font-black" style={primaryTextStyle}>{client.candidates}</p><p className="text-[9px]" style={subtleTextStyle}>{timeframe}</p></div>
                  <ScoreBadge score={client.avgScore} />
                  <span className="hidden w-fit rounded-full px-2.5 py-1 text-[9px] font-black sm:inline-flex" style={{ backgroundColor: `${statusColor}16`, color: statusColor }}>{status}</span>
                </div>
              );
            })}
          </div>
        </section>

        <aside className="space-y-4">
          <section className="rounded-xl bg-white p-5" style={surfaceCardStyle}>
            <h2 className="text-base font-black" style={primaryTextStyle}>Interview progress</h2>
            <p className="mt-3 text-3xl font-black" style={primaryTextStyle}>{stats.completionRate.toFixed(1)}%</p>
            <p className="mt-1 text-[11px] font-medium" style={mutedTextStyle}>Candidates with interview scoring in the selected period</p>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-[var(--as-surface-muted)]"><div className="h-full rounded-full bg-emerald-400" style={{ width: `${Math.min(100, stats.completionRate)}%` }} /></div>
            <div className="mt-3 grid grid-cols-2 gap-3 text-[10px]">
              <div><p className="text-xs font-black" style={primaryTextStyle}>{stats.completed}</p><p style={mutedTextStyle}>Completed</p></div>
              <div><p className="text-xs font-black" style={primaryTextStyle}>{stats.clientActivityRate.toFixed(1)}%</p><p style={mutedTextStyle}>Clients active</p></div>
            </div>
          </section>

          <section className="rounded-xl bg-white p-5" style={surfaceCardStyle}>
            <div className="flex items-center justify-between gap-3"><h2 className="text-base font-black" style={primaryTextStyle}>Completion follow-up</h2><span className="rounded-full bg-rose-500/10 px-2.5 py-1 text-[9px] font-black text-rose-600">{Math.max(0, stats.candidates - stats.completed)} not complete</span></div>
            <div className="mt-3 flex gap-2.5"><AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-500" /><div><p className="text-xs font-bold" style={primaryTextStyle}>Incomplete interviews</p><p className="mt-0.5 text-[10px] leading-relaxed" style={mutedTextStyle}>{Math.max(0, stats.candidates - stats.completed)} candidates in this period have not reached completed status.</p></div></div>
            <Link href="/admin/candidates" className="mt-4 inline-flex items-center gap-1 text-[11px] font-bold text-[#8B68E8]">View candidates <ArrowRight className="h-3.5 w-3.5" /></Link>
          </section>

          <section className="rounded-xl bg-white p-5" style={surfaceCardStyle}>
            <h2 className="text-base font-black" style={primaryTextStyle}>Recent platform activity</h2>
            <div className="mt-3 space-y-3">
              {recentActivity.length === 0 && <p className="text-[11px] font-medium" style={mutedTextStyle}>No recent role activity in this scope.</p>}
              {recentActivity.slice(0, 3).map((row) => (
                <div key={`${row.client}-${row.role}`} className="flex gap-2.5">
                  <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[#A380F6]" />
                  <div className="min-w-0"><p className="truncate text-[11px] font-bold" style={primaryTextStyle}>{row.role}</p><p className="mt-0.5 truncate text-[9px]" style={mutedTextStyle}>{row.client} · {row.date}</p></div>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border bg-[var(--as-surface)] px-4 py-2.5 text-[10px] font-semibold" style={{ borderColor: "var(--as-border)", color: "var(--as-text-muted)" }}>
        <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-emerald-400" /> Dashboard data loaded from authenticated admin services</span>
        <Link href="/admin/interview-reliability" className="font-bold text-[#8B68E8]">View reliability</Link>
      </div>
        </>
      )}
    </AdminLayout>
  );
}
