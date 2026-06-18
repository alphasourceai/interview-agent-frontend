import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Archive,
  Bot,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Edit3,
  Pause,
  Play,
  RefreshCw,
  ShieldCheck,
  X,
} from "lucide-react";
import AdminLayout from "@/components/AdminLayout";
import { useAdminClient } from "@/context/AdminClientContext";
import {
  buildEntityFilterOptions,
  entityFilterQueryValue,
  type EntityFilterValue,
} from "@/lib/entityFilters";
import { supabase } from "@/lib/supabaseClient";

interface AutomationOverview {
  total_rules?: number;
  enabled_rules?: number;
  pending_approval_count?: number;
  recent_sent_action_count?: number;
  recent_failed_action_count?: number;
  scheduler_send_enabled?: boolean;
  scheduler_secret_configured?: boolean;
}

interface AutomationRule {
  id: string;
  name?: string | null;
  client_id?: string | null;
  client_name?: string | null;
  entity_name?: string | null;
  entity_parent_client_id?: string | null;
  role_title?: string | null;
  enabled?: boolean;
  archived_at?: string | null;
  status?: string | null;
  criteria_config?: Record<string, unknown>;
  criteria_summary?: string | null;
  recipients_summary?: string | null;
  cadence_summary?: string | null;
  scheduling_url_configured?: boolean;
  scheduling_url_display?: string | null;
  rule_version?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
}

interface AutomationAction {
  id: string;
  client_name?: string | null;
  role_title?: string | null;
  candidate_name?: string | null;
  state?: string | null;
  approval_status?: string | null;
  event_summary?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

interface AutomationDigest {
  id: string;
  client_name?: string | null;
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

interface CriteriaForm {
  min_overall_score: string;
  min_resume_score: string;
  min_interview_score: string;
  allow_resume_only: boolean;
  require_sufficient_content: boolean;
}

const env =
  typeof import.meta !== "undefined" && import.meta.env ? import.meta.env : {};

const backendBase = [
  (env as Record<string, unknown>).VITE_BACKEND_URL,
  (env as Record<string, unknown>).VITE_API_URL,
  (env as Record<string, unknown>).VITE_PUBLIC_BACKEND_URL,
  (env as Record<string, unknown>).PUBLIC_BACKEND_URL,
  (env as Record<string, unknown>).BACKEND_URL,
].map((value) => String(value || "").trim().replace(/\/+$/, "")).find(Boolean) || "";

const surfaceCardStyle = {
  backgroundColor: "var(--as-surface)",
  border: "1px solid var(--as-border)",
  boxShadow: "var(--as-shadow)",
};
const modalSurfaceStyle = {
  backgroundColor: "var(--as-surface)",
  border: "1px solid var(--as-border)",
  boxShadow: "0 12px 30px rgba(10,21,71,0.18)",
};
const mutedPanelStyle = {
  backgroundColor: "var(--as-surface-muted)",
  borderColor: "var(--as-border)",
};
const primaryTextStyle = { color: "var(--as-text)" };
const mutedTextStyle = { color: "var(--as-text-muted)" };
const subtleTextStyle = { color: "var(--as-text-subtle)" };
const dividerStyle = { borderColor: "var(--as-border)" };
const inputCls =
  "w-full h-10 rounded-xl px-3 text-sm font-semibold border bg-[var(--as-surface)] text-[var(--as-text)] border-[var(--as-border)] focus:outline-none focus:border-[#A380F6]";

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
  return Number.isFinite(parsed) ? new Intl.NumberFormat().format(parsed) : "0";
}

function formatDateTime(value: unknown): string {
  const raw = String(value || "").trim();
  if (!raw) return "—";
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? "—" : parsed.toLocaleString();
}

function titleCase(value: unknown): string {
  const raw = String(value || "").trim().replace(/_/g, " ");
  if (!raw) return "—";
  return raw.replace(/\b\w/g, (char) => char.toUpperCase());
}

function ruleStatus(rule: AutomationRule): "active" | "paused" | "archived" {
  if (rule.archived_at || rule.status === "archived") return "archived";
  return rule.enabled === true ? "active" : "paused";
}

function statusClass(status: string): string {
  if (status === "active") return "text-[#009E73] bg-[#02D99D]/10";
  if (status === "archived") return "text-red-600 bg-red-50 dark:text-red-300 dark:bg-red-500/10";
  return "text-[#0A1547]/65 dark:text-slate-300/80 bg-[#0A1547]/5 dark:bg-white/5";
}

function scoreFormValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "";
  return String(value);
}

function criteriaFormFromRule(rule: AutomationRule): CriteriaForm {
  const criteria = rule.criteria_config || {};
  return {
    min_overall_score: scoreFormValue(criteria.min_overall_score),
    min_resume_score: scoreFormValue(criteria.min_resume_score),
    min_interview_score: scoreFormValue(criteria.min_interview_score),
    allow_resume_only: criteria.allow_resume_only === true,
    require_sufficient_content: criteria.require_sufficient_content !== false,
  };
}

function parseScore(value: string, label: string): number | null {
  const trimmed = String(value || "").trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
    throw new Error(`${label} must be blank or a number from 0 to 100.`);
  }
  return parsed;
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="px-4 py-5 text-sm font-semibold" style={subtleTextStyle}>
      {text}
    </div>
  );
}

export default function AdminAutomationPage() {
  const { selectedClient, selectedClientId, clients } = useAdminClient();
  const [payload, setPayload] = useState<AutomationPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [actionStatusFilter, setActionStatusFilter] = useState("all");
  const [ruleStatusFilter, setRuleStatusFilter] = useState("active");
  const [entityFilter, setEntityFilter] = useState<EntityFilterValue>("all");
  const [expandedRuleId, setExpandedRuleId] = useState("");
  const [busyRuleId, setBusyRuleId] = useState("");
  const [editRule, setEditRule] = useState<AutomationRule | null>(null);
  const [editCriteria, setEditCriteria] = useState<CriteriaForm>(() => criteriaFormFromRule({ id: "" }));
  const [editNotice, setEditNotice] = useState("");
  const [archiveRule, setArchiveRule] = useState<AutomationRule | null>(null);
  const [archiveNotice, setArchiveNotice] = useState("");
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
      const token = await getToken();
      const params = new URLSearchParams();
      if (selectedClientId && selectedClientId !== "all") params.set("client_id", selectedClientId);
      if (selectedClientId && selectedClientId !== "all" && entityOptions.length > 0) {
        params.set("entity_filter", entityFilterQueryValue(entityFilter));
      }
      params.set("rule_status", ruleStatusFilter);
      if (actionStatusFilter !== "all") params.set("status", actionStatusFilter);

      const response = await fetch(`${backendBase}/admin/automation/overview?${params.toString()}`, {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
        credentials: "omit",
      });
      const text = await response.text();
      if (!response.ok) throw new Error(errorMessageFromResponse(text, "Could not load automation overview."));
      setPayload((parseJsonSafe(text) as AutomationPayload | null) || {});
    } catch (loadError) {
      setPayload(null);
      setError(loadError instanceof Error ? loadError.message : "Could not load automation overview.");
    } finally {
      setLoading(false);
    }
  }, [actionStatusFilter, entityFilter, entityOptions.length, getToken, ruleStatusFilter, selectedClientId]);

  useEffect(() => {
    void loadAutomation();
  }, [loadAutomation, reloadNonce]);

  const mutateRule = async (rule: AutomationRule, path: string, successText: string, body: Record<string, unknown> = {}) => {
    if (!rule.id || busyRuleId) return;
    setBusyRuleId(rule.id);
    setNotice(null);
    try {
      if (!backendBase) throw new Error("Missing backend base URL configuration.");
      const token = await getToken();
      const response = await fetch(`${backendBase}${path}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        credentials: "omit",
        body: JSON.stringify(body),
      });
      const text = await response.text();
      if (!response.ok) throw new Error(errorMessageFromResponse(text, "Could not update automation rule."));
      setNotice({ tone: "success", text: successText });
      setReloadNonce((value) => value + 1);
    } catch (mutationError) {
      setNotice({
        tone: "error",
        text: mutationError instanceof Error ? mutationError.message : "Could not update automation rule.",
      });
      throw mutationError;
    } finally {
      setBusyRuleId("");
    }
  };

  const openEditCriteria = (rule: AutomationRule) => {
    setEditRule(rule);
    setEditCriteria(criteriaFormFromRule(rule));
    setEditNotice("");
  };

  const saveCriteria = async () => {
    if (!editRule) return;
    setEditNotice("");
    try {
      const criteria_config = {
        min_overall_score: parseScore(editCriteria.min_overall_score, "Min overall score"),
        min_resume_score: parseScore(editCriteria.min_resume_score, "Min resume score"),
        min_interview_score: parseScore(editCriteria.min_interview_score, "Min interview score"),
        allow_resume_only: editCriteria.allow_resume_only,
        require_sufficient_content: editCriteria.require_sufficient_content,
      };
      await mutateRule(
        editRule,
        `/admin/automation/rules/${encodeURIComponent(editRule.id)}`,
        "Rule criteria updated.",
        { criteria_config },
      );
      setEditRule(null);
    } catch (saveError) {
      setEditNotice(saveError instanceof Error ? saveError.message : "Could not update criteria.");
    }
  };

  const confirmArchiveRule = async () => {
    if (!archiveRule) return;
    setArchiveNotice("");
    try {
      await mutateRule(
        archiveRule,
        `/admin/automation/rules/${encodeURIComponent(archiveRule.id)}/archive`,
        "Automation rule archived.",
      );
      setArchiveRule(null);
    } catch (archiveError) {
      setArchiveNotice(archiveError instanceof Error ? archiveError.message : "Could not archive automation rule.");
    }
  };

  const overview = payload?.overview || {};
  const rules = payload?.rules || [];
  const actions = payload?.actions || [];
  const digests = payload?.digests || [];

  return (
    <AdminLayout title="Automation">
      <div className="flex flex-col gap-5">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div>
            <h2 className="text-2xl font-black" style={primaryTextStyle}>Automation Control</h2>
            <p className="text-sm font-semibold mt-1" style={mutedTextStyle}>
              Operational controls for rules only. Sends, approvals, and scheduler behavior stay unchanged.
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

        {(error || notice) && (
          <div
            className={`flex items-start gap-2 rounded-xl px-4 py-3 text-sm font-semibold ${
              error || notice?.tone === "error"
                ? "text-red-500 bg-red-50 border border-red-200 dark:text-red-300 dark:bg-red-500/10 dark:border-red-500/25"
                : "text-[#009E73] bg-[#02D99D]/10 border border-[#02D99D]/25"
            }`}
            role="status"
            aria-live="polite"
          >
            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            {error || notice?.text}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          {[
            { label: "Rules", value: formatNumber(overview.total_rules), detail: `${formatNumber(overview.enabled_rules)} enabled`, icon: Bot },
            { label: "Pending approvals", value: formatNumber(overview.pending_approval_count), detail: "Visibility only", icon: Clock3 },
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

        <div className="rounded-2xl px-4 py-3 grid grid-cols-1 lg:grid-cols-[1.2fr_1fr_180px_180px] gap-3 items-end" style={surfaceCardStyle}>
          <div>
            <p className="text-xs font-black" style={primaryTextStyle}>Client filter</p>
            <p className="text-[11px] font-semibold mt-1" style={subtleTextStyle}>
              {selectedClientId === "all" ? "All clients" : selectedClient.name}. Change this in the admin client picker.
            </p>
          </div>
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest mb-1.5" style={mutedTextStyle}>Entity</label>
            <select
              value={entityFilterQueryValue(entityFilter)}
              disabled={entityOptions.length === 0}
              onChange={(event) => setEntityFilter(event.target.value)}
              className={inputCls}
            >
              {entityOptions.length === 0 ? (
                <option value="all">All entities</option>
              ) : entityOptions.map((option) => (
                <option key={String(option.value)} value={entityFilterQueryValue(option.value)}>{option.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest mb-1.5" style={mutedTextStyle}>Rule status</label>
            <select value={ruleStatusFilter} onChange={(event) => setRuleStatusFilter(event.target.value)} className={inputCls}>
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="archived">Archived</option>
              <option value="all">All</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest mb-1.5" style={mutedTextStyle}>Action status</label>
            <select value={actionStatusFilter} onChange={(event) => setActionStatusFilter(event.target.value)} className={inputCls}>
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
            <EmptyState text="No automation rules match the current filters." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead style={mutedPanelStyle}>
                  <tr className="text-left text-[10px] font-black uppercase tracking-widest" style={subtleTextStyle}>
                    <th className="px-4 py-2 w-9"></th>
                    <th className="px-4 py-2">Client / Entity</th>
                    <th className="px-4 py-2">Role</th>
                    <th className="px-4 py-2">Status</th>
                    <th className="px-4 py-2">Criteria</th>
                    <th className="px-4 py-2">Cadence</th>
                    <th className="px-4 py-2">Scheduling</th>
                    <th className="px-4 py-2">Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {rules.map((rule) => {
                    const expanded = expandedRuleId === rule.id;
                    const status = ruleStatus(rule);
                    return (
                      <Fragment key={rule.id}>
                        <tr className="border-t" style={dividerStyle}>
                          <td className="px-4 py-3">
                            <button
                              type="button"
                              onClick={() => setExpandedRuleId((current) => current === rule.id ? "" : rule.id)}
                              className="p-1.5 rounded-lg hover:bg-[#A380F6]/10 transition-colors"
                              aria-label={expanded ? "Collapse rule" : "Expand rule"}
                            >
                              <ChevronRight className={`w-4 h-4 text-[#A380F6] transition-transform ${expanded ? "rotate-90" : ""}`} />
                            </button>
                          </td>
                          <td className="px-4 py-3">
                            <p className="font-bold" style={primaryTextStyle}>{rule.client_name || "—"}</p>
                            <p className="text-xs font-semibold" style={mutedTextStyle}>{rule.entity_name || "Parent"}</p>
                          </td>
                          <td className="px-4 py-3 font-semibold" style={mutedTextStyle}>{rule.role_title || "—"}</td>
                          <td className="px-4 py-3">
                            <span className={`rounded-full px-2.5 py-1 text-xs font-black ${statusClass(status)}`}>{titleCase(status)}</span>
                          </td>
                          <td className="px-4 py-3 max-w-xs font-semibold" style={mutedTextStyle}>{rule.criteria_summary || "—"}</td>
                          <td className="px-4 py-3 font-semibold" style={mutedTextStyle}>{rule.cadence_summary || "—"}</td>
                          <td className="px-4 py-3 font-bold" style={rule.scheduling_url_configured ? { color: "#02ABE0" } : subtleTextStyle}>
                            {rule.scheduling_url_configured ? "Configured" : "Not configured"}
                          </td>
                          <td className="px-4 py-3 font-semibold whitespace-nowrap" style={mutedTextStyle}>{formatDateTime(rule.updated_at || rule.created_at)}</td>
                        </tr>
                        {expanded && (
                          <tr className="border-t" style={dividerStyle}>
                            <td></td>
                            <td colSpan={7} className="px-4 py-4">
                              <div className="grid grid-cols-1 xl:grid-cols-[1fr_280px] gap-4">
                                <div className="rounded-xl border p-3 space-y-2" style={mutedPanelStyle}>
                                  <p className="text-xs font-black" style={primaryTextStyle}>{rule.name || "Automation rule"}</p>
                                  <p className="text-xs font-semibold" style={mutedTextStyle}>Criteria: {rule.criteria_summary || "—"}</p>
                                  <p className="text-xs font-semibold" style={mutedTextStyle}>Recipients: {rule.recipients_summary || "—"}</p>
                                  <p className="text-xs font-semibold" style={mutedTextStyle}>Scheduling URL: {rule.scheduling_url_display || "Not configured"}</p>
                                  <p className="text-xs font-semibold" style={subtleTextStyle}>Rule version {rule.rule_version || 1}</p>
                                </div>
                                <div className="flex flex-wrap xl:flex-col gap-2">
                                  {status === "active" ? (
                                    <button
                                      type="button"
                                      disabled={busyRuleId === rule.id}
                                      onClick={() => { void mutateRule(rule, `/admin/automation/rules/${encodeURIComponent(rule.id)}/pause`, "Automation rule paused."); }}
                                      className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-full text-xs font-bold bg-[#0A1547]/5 dark:bg-white/5 text-[var(--as-text)] hover:bg-[#0A1547]/10 dark:hover:bg-white/10 disabled:opacity-50"
                                    >
                                      <Pause className="w-3.5 h-3.5" /> Pause
                                    </button>
                                  ) : status === "paused" ? (
                                    <button
                                      type="button"
                                      disabled={busyRuleId === rule.id}
                                      onClick={() => { void mutateRule(rule, `/admin/automation/rules/${encodeURIComponent(rule.id)}/resume`, "Automation rule resumed."); }}
                                      className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-full text-xs font-bold text-white bg-[#02D99D] hover:opacity-90 disabled:opacity-50"
                                    >
                                      <Play className="w-3.5 h-3.5" /> Resume
                                    </button>
                                  ) : null}
                                  <button
                                    type="button"
                                    disabled={busyRuleId === rule.id || status === "archived"}
                                    onClick={() => openEditCriteria(rule)}
                                    className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-full text-xs font-bold text-[#A380F6] bg-[#A380F6]/10 hover:bg-[#A380F6]/15 disabled:opacity-50"
                                  >
                                    <Edit3 className="w-3.5 h-3.5" /> Edit criteria
                                  </button>
                                  <button
                                    type="button"
                                    disabled={busyRuleId === rule.id || status === "archived"}
                                    onClick={() => { setArchiveRule(rule); setArchiveNotice(""); }}
                                    className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-full text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 dark:text-red-300 dark:bg-red-500/10 dark:hover:bg-red-500/15 disabled:opacity-50"
                                  >
                                    <Archive className="w-3.5 h-3.5" /> Archive rule
                                  </button>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
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
            <EmptyState text="No automation actions match the current filters." />
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
            <EmptyState text="No digest deliveries match the current filters." />
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

      {editRule && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center px-4">
          <button type="button" className="absolute inset-0 bg-[#0A1547]/35" aria-label="Close edit criteria" onClick={() => setEditRule(null)} />
          <div className="relative w-full max-w-lg rounded-2xl p-5" style={modalSurfaceStyle} role="dialog" aria-modal="true" aria-label="Edit rule criteria">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-base font-black" style={primaryTextStyle}>Edit rule criteria</h3>
              <button type="button" className="p-1.5 rounded-lg hover:bg-[#0A1547]/5 dark:hover:bg-white/5" onClick={() => setEditRule(null)} aria-label="Close">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                ["min_overall_score", "Min overall"],
                ["min_resume_score", "Min resume"],
                ["min_interview_score", "Min interview"],
              ].map(([key, label]) => (
                <div key={key}>
                  <label className="block text-[10px] font-black uppercase tracking-widest mb-1.5" style={mutedTextStyle}>{label}</label>
                  <input
                    className={inputCls}
                    inputMode="decimal"
                    value={editCriteria[key as keyof CriteriaForm] as string}
                    onChange={(event) => setEditCriteria((prev) => ({ ...prev, [key]: event.target.value }))}
                    placeholder="Blank"
                  />
                </div>
              ))}
            </div>
            <div className="mt-4 space-y-2">
              <label className="flex items-center gap-2 text-sm font-semibold" style={mutedTextStyle}>
                <input type="checkbox" checked={editCriteria.allow_resume_only} onChange={(event) => setEditCriteria((prev) => ({ ...prev, allow_resume_only: event.target.checked }))} />
                Allow resume-only evaluation
              </label>
              <label className="flex items-center gap-2 text-sm font-semibold" style={mutedTextStyle}>
                <input type="checkbox" checked={editCriteria.require_sufficient_content} onChange={(event) => setEditCriteria((prev) => ({ ...prev, require_sufficient_content: event.target.checked }))} />
                Require sufficient candidate content
              </label>
            </div>
            {editNotice && (
              <div className="mt-4 rounded-xl px-3.5 py-2 text-xs font-semibold text-red-500 bg-red-50 border border-red-200 dark:text-red-300 dark:bg-red-500/10 dark:border-red-500/25">
                {editNotice}
              </div>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" className="px-4 py-2 rounded-full text-sm font-bold text-[#0A1547]/70 dark:text-slate-300/80 bg-[#0A1547]/5 dark:bg-white/5 hover:bg-[#0A1547]/10 dark:hover:bg-white/10" onClick={() => setEditRule(null)}>
                Cancel
              </button>
              <button type="button" className="px-4 py-2 rounded-full text-sm font-bold text-white hover:opacity-90" style={{ backgroundColor: "#A380F6" }} onClick={() => { void saveCriteria(); }}>
                Save criteria
              </button>
            </div>
          </div>
        </div>
      )}

      {archiveRule && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center px-4">
          <button type="button" className="absolute inset-0 bg-[#0A1547]/35" aria-label="Close archive rule" onClick={() => setArchiveRule(null)} />
          <div className="relative w-full max-w-md rounded-2xl p-5" style={modalSurfaceStyle} role="dialog" aria-modal="true" aria-label="Archive automation rule">
            <h3 className="text-base font-black" style={primaryTextStyle}>Archive automation rule</h3>
            <p className="mt-2 text-sm font-semibold leading-relaxed" style={mutedTextStyle}>
              This pauses and hides the rule from active automation views. Historical actions, approvals, digests, and events remain intact.
            </p>
            {archiveNotice && (
              <div className="mt-4 rounded-xl px-3.5 py-2 text-xs font-semibold text-red-500 bg-red-50 border border-red-200 dark:text-red-300 dark:bg-red-500/10 dark:border-red-500/25">
                {archiveNotice}
              </div>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" className="px-4 py-2 rounded-full text-sm font-bold text-[#0A1547]/70 dark:text-slate-300/80 bg-[#0A1547]/5 dark:bg-white/5 hover:bg-[#0A1547]/10 dark:hover:bg-white/10" onClick={() => setArchiveRule(null)}>
                Cancel
              </button>
              <button type="button" className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-bold text-white bg-red-500 hover:bg-red-600" onClick={() => { void confirmArchiveRule(); }}>
                <Archive className="w-3.5 h-3.5" />
                Archive rule
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
