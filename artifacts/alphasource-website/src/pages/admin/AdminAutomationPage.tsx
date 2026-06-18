import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Bot, CheckCircle2, Clock3, RefreshCw, ShieldCheck } from "lucide-react";
import AdminLayout from "@/components/AdminLayout";
import { useAdminClient } from "@/context/AdminClientContext";
import { supabase } from "@/lib/supabaseClient";

interface AutomationOverview {
  total_rules?: number;
  enabled_rules?: number;
  disabled_rules?: number;
  pending_approval_count?: number;
  recent_sent_action_count?: number;
  recent_rejected_action_count?: number;
  recent_failed_action_count?: number;
  recent_digest_delivery_count?: number;
  scheduler_send_enabled?: boolean;
  scheduler_secret_configured?: boolean;
  scheduler_send_mode?: string;
  digest_frequencies?: string[];
}

interface AutomationRule {
  id: string;
  name?: string | null;
  client_id?: string | null;
  client_name?: string | null;
  role_title?: string | null;
  enabled?: boolean;
  criteria_summary?: string | null;
  recipients_summary?: string | null;
  cadence_summary?: string | null;
  scheduling_url_configured?: boolean;
  created_at?: string | null;
  updated_at?: string | null;
}

interface AutomationAction {
  id: string;
  client_id?: string | null;
  client_name?: string | null;
  role_title?: string | null;
  candidate_name?: string | null;
  action_type?: string | null;
  state?: string | null;
  approval_status?: string | null;
  event_summary?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

interface AutomationDigest {
  id: string;
  client_id?: string | null;
  client_name?: string | null;
  role_title?: string | null;
  recipient_summary?: string | null;
  delivery_date?: string | null;
  status?: string | null;
  pending_count?: number;
  sent_at?: string | null;
  failed_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

interface AutomationPayload {
  overview?: AutomationOverview;
  rules?: AutomationRule[];
  actions?: AutomationAction[];
  digests?: AutomationDigest[];
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
  backgroundColor: "var(--as-surface-muted)",
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
  const parsed = parseJsonSafe(text);
  if (parsed && typeof parsed === "object") {
    const source = parsed as { detail?: unknown; message?: unknown; error?: unknown };
    const detail = source.detail ?? source.message ?? source.error;
    if (typeof detail === "string" && detail.trim()) return detail;
  }
  return text || fallback;
}

function formatNumber(value: unknown): string {
  const parsed = Number(value ?? 0);
  if (!Number.isFinite(parsed)) return "0";
  return new Intl.NumberFormat().format(parsed);
}

function formatDateTime(value: unknown): string {
  const raw = String(value || "").trim();
  if (!raw) return "—";
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleString();
}

function titleCase(value: unknown): string {
  const raw = String(value || "").trim().replace(/_/g, " ");
  if (!raw) return "—";
  return raw.replace(/\b\w/g, (char) => char.toUpperCase());
}

function includesClient(row: { client_id?: string | null }, selectedClientId: string): boolean {
  if (!selectedClientId || selectedClientId === "all") return true;
  return String(row.client_id || "").trim() === selectedClientId;
}

function statusMatches(value: unknown, filter: string): boolean {
  if (!filter || filter === "all") return true;
  return String(value || "").trim().toLowerCase() === filter;
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="px-4 py-5 text-sm font-semibold" style={subtleTextStyle}>
      {text}
    </div>
  );
}

export default function AdminAutomationPage() {
  const { selectedClientId } = useAdminClient();
  const [payload, setPayload] = useState<AutomationPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [reloadNonce, setReloadNonce] = useState(0);

  const loadAutomation = useCallback(async () => {
    if (!backendBase) {
      setError("Missing backend base URL configuration.");
      setPayload(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = String(session?.access_token || "").trim();
      if (!token) throw new Error("Missing session token.");

      const response = await fetch(`${backendBase}/admin/automation/overview`, {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
        credentials: "omit",
      });
      const text = await response.text();
      if (!response.ok) throw new Error(errorMessageFromResponse(text, "Could not load automation overview."));

      const data = parseJsonSafe(text) as AutomationPayload | null;
      setPayload(data || {});
    } catch (loadError) {
      setPayload(null);
      setError(loadError instanceof Error ? loadError.message : "Could not load automation overview.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAutomation();
  }, [loadAutomation, reloadNonce]);

  const overview = payload?.overview || {};
  const rules = useMemo(
    () => (payload?.rules || []).filter((rule) => includesClient(rule, selectedClientId)),
    [payload?.rules, selectedClientId],
  );
  const actions = useMemo(
    () => (payload?.actions || [])
      .filter((action) => includesClient(action, selectedClientId))
      .filter((action) => statusMatches(action.state, statusFilter)),
    [payload?.actions, selectedClientId, statusFilter],
  );
  const digests = useMemo(
    () => (payload?.digests || [])
      .filter((digest) => includesClient(digest, selectedClientId))
      .filter((digest) => statusMatches(digest.status, statusFilter)),
    [payload?.digests, selectedClientId, statusFilter],
  );

  return (
    <AdminLayout title="Automation">
      <div className="flex flex-col gap-5">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div>
            <h2 className="text-2xl font-black" style={primaryTextStyle}>Automation Control</h2>
            <p className="text-sm font-semibold mt-1" style={mutedTextStyle}>
              Read-only operational status for rules, approvals, digests, and scheduler guardrails.
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

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          {[
            { label: "Rules", value: formatNumber(overview.total_rules), detail: `${formatNumber(overview.enabled_rules)} enabled`, icon: Bot },
            { label: "Pending approvals", value: formatNumber(overview.pending_approval_count), detail: "Current action queue", icon: Clock3 },
            { label: "Recent sent", value: formatNumber(overview.recent_sent_action_count), detail: `${formatNumber(overview.recent_failed_action_count)} failed`, icon: CheckCircle2 },
            {
              label: "Scheduler guardrail",
              value: overview.scheduler_send_enabled ? "Send on" : "Dry-run",
              detail: overview.scheduler_secret_configured ? "Secret configured" : "Secret missing",
              icon: ShieldCheck,
            },
          ].map((card) => {
            const Icon = card.icon;
            return (
              <div key={card.label} className="rounded-2xl p-4" style={surfaceCardStyle}>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[10px] font-black uppercase tracking-widest" style={subtleTextStyle}>{card.label}</p>
                  <Icon className="w-4 h-4 text-[#A380F6]" />
                </div>
                <p className="mt-3 text-2xl font-black" style={primaryTextStyle}>{card.value}</p>
                <p className="mt-1 text-xs font-semibold" style={mutedTextStyle}>{card.detail}</p>
              </div>
            );
          })}
        </div>

        <div className="rounded-2xl px-4 py-3 flex flex-col md:flex-row md:items-center gap-3" style={surfaceCardStyle}>
          <div className="min-w-0">
            <p className="text-xs font-black" style={primaryTextStyle}>Filters</p>
            <p className="text-[11px] font-semibold" style={subtleTextStyle}>
              Client selection follows the admin client picker.
            </p>
          </div>
          <div className="md:ml-auto w-full md:w-56">
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="w-full h-10 rounded-xl px-3 text-sm font-semibold border bg-[var(--as-surface)] text-[var(--as-text)] border-[var(--as-border)] focus:outline-none focus:border-[#A380F6]"
            >
              <option value="all">All statuses</option>
              <option value="pending_approval">Pending approval</option>
              <option value="approved">Approved</option>
              <option value="sent">Sent</option>
              <option value="rejected">Rejected</option>
              <option value="failed">Failed</option>
            </select>
          </div>
        </div>

        <section className="rounded-2xl overflow-hidden" style={surfaceCardStyle}>
          <div className="px-4 py-3 border-b" style={dividerStyle}>
            <h3 className="text-sm font-black" style={primaryTextStyle}>Automation Rules</h3>
          </div>
          {loading ? (
            <EmptyState text="Loading rules..." />
          ) : rules.length === 0 ? (
            <EmptyState text="No automation rules match the current filter." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead style={mutedPanelStyle}>
                  <tr className="text-left text-[10px] font-black uppercase tracking-widest" style={subtleTextStyle}>
                    <th className="px-4 py-2">Client</th>
                    <th className="px-4 py-2">Role</th>
                    <th className="px-4 py-2">Status</th>
                    <th className="px-4 py-2">Criteria</th>
                    <th className="px-4 py-2">Recipients</th>
                    <th className="px-4 py-2">Cadence</th>
                    <th className="px-4 py-2">Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {rules.map((rule) => (
                    <tr key={rule.id} className="border-t" style={dividerStyle}>
                      <td className="px-4 py-3 font-bold" style={primaryTextStyle}>{rule.client_name || "—"}</td>
                      <td className="px-4 py-3 font-semibold" style={mutedTextStyle}>{rule.role_title || "—"}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-black ${rule.enabled ? "text-[#009E73] bg-[#02D99D]/10" : "text-[#0A1547]/55 dark:text-slate-300/70 bg-[#0A1547]/5 dark:bg-white/5"}`}>
                          {rule.enabled ? "Enabled" : "Disabled"}
                        </span>
                      </td>
                      <td className="px-4 py-3 max-w-xs font-semibold" style={mutedTextStyle}>{rule.criteria_summary || "—"}</td>
                      <td className="px-4 py-3 font-semibold" style={mutedTextStyle}>{rule.recipients_summary || "—"}</td>
                      <td className="px-4 py-3 font-semibold" style={mutedTextStyle}>
                        {rule.cadence_summary || "—"}
                        {rule.scheduling_url_configured && <span className="ml-2 text-[#02ABE0]">URL</span>}
                      </td>
                      <td className="px-4 py-3 font-semibold whitespace-nowrap" style={mutedTextStyle}>{formatDateTime(rule.updated_at || rule.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="rounded-2xl overflow-hidden" style={surfaceCardStyle}>
          <div className="px-4 py-3 border-b" style={dividerStyle}>
            <h3 className="text-sm font-black" style={primaryTextStyle}>Actions And Approvals</h3>
          </div>
          {loading ? (
            <EmptyState text="Loading actions..." />
          ) : actions.length === 0 ? (
            <EmptyState text="No automation actions match the current filter." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead style={mutedPanelStyle}>
                  <tr className="text-left text-[10px] font-black uppercase tracking-widest" style={subtleTextStyle}>
                    <th className="px-4 py-2">Client</th>
                    <th className="px-4 py-2">Role</th>
                    <th className="px-4 py-2">Candidate</th>
                    <th className="px-4 py-2">State</th>
                    <th className="px-4 py-2">Approval</th>
                    <th className="px-4 py-2">Event</th>
                    <th className="px-4 py-2">Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {actions.map((action) => (
                    <tr key={action.id} className="border-t" style={dividerStyle}>
                      <td className="px-4 py-3 font-bold" style={primaryTextStyle}>{action.client_name || "—"}</td>
                      <td className="px-4 py-3 font-semibold" style={mutedTextStyle}>{action.role_title || "—"}</td>
                      <td className="px-4 py-3 font-semibold" style={mutedTextStyle}>{action.candidate_name || "—"}</td>
                      <td className="px-4 py-3 font-bold" style={mutedTextStyle}>{titleCase(action.state)}</td>
                      <td className="px-4 py-3 font-semibold" style={mutedTextStyle}>{titleCase(action.approval_status)}</td>
                      <td className="px-4 py-3 font-semibold" style={mutedTextStyle}>{action.event_summary || "—"}</td>
                      <td className="px-4 py-3 font-semibold whitespace-nowrap" style={mutedTextStyle}>{formatDateTime(action.updated_at || action.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="rounded-2xl overflow-hidden" style={surfaceCardStyle}>
          <div className="px-4 py-3 border-b" style={dividerStyle}>
            <h3 className="text-sm font-black" style={primaryTextStyle}>Recent Digest Deliveries</h3>
          </div>
          {loading ? (
            <EmptyState text="Loading digest deliveries..." />
          ) : digests.length === 0 ? (
            <EmptyState text="No digest deliveries match the current filter." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead style={mutedPanelStyle}>
                  <tr className="text-left text-[10px] font-black uppercase tracking-widest" style={subtleTextStyle}>
                    <th className="px-4 py-2">Client</th>
                    <th className="px-4 py-2">Recipient</th>
                    <th className="px-4 py-2">Date</th>
                    <th className="px-4 py-2">Status</th>
                    <th className="px-4 py-2">Pending</th>
                    <th className="px-4 py-2">Sent/Failed</th>
                  </tr>
                </thead>
                <tbody>
                  {digests.map((digest) => (
                    <tr key={digest.id} className="border-t" style={dividerStyle}>
                      <td className="px-4 py-3 font-bold" style={primaryTextStyle}>{digest.client_name || "—"}</td>
                      <td className="px-4 py-3 font-semibold" style={mutedTextStyle}>{digest.recipient_summary || "—"}</td>
                      <td className="px-4 py-3 font-semibold" style={mutedTextStyle}>{digest.delivery_date || "—"}</td>
                      <td className="px-4 py-3 font-bold" style={mutedTextStyle}>{titleCase(digest.status)}</td>
                      <td className="px-4 py-3 font-semibold" style={mutedTextStyle}>{formatNumber(digest.pending_count)}</td>
                      <td className="px-4 py-3 font-semibold whitespace-nowrap" style={mutedTextStyle}>
                        {formatDateTime(digest.sent_at || digest.failed_at || digest.updated_at || digest.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </AdminLayout>
  );
}
