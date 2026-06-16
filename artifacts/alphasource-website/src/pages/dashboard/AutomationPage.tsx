import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, Loader2, Save, X } from "lucide-react";
import CurrentScopeBanner from "@/components/CurrentScopeBanner";
import DashboardLayout from "@/components/DashboardLayout";
import InfoTooltip from "@/components/InfoTooltip";
import { useClient } from "@/context/ClientContext";
import { supabase } from "@/lib/supabaseClient";

type CriteriaValue = string | boolean;
type Notice = { tone: "success" | "error"; text: string };

interface ConfigField {
  type?: string;
  min?: number;
  max?: number;
  nullable?: boolean;
  default?: boolean;
  required?: boolean;
  max_length?: number;
  allowed_protocols?: string[];
}

interface ActionTypeOption {
  value: string;
  label: string;
  requires_approval?: boolean;
  fields?: Record<string, ConfigField>;
}

interface FrequencyOption {
  value: string;
  label: string;
  requires_weekly_day?: boolean;
}

interface PendingApprovalDigestOptions {
  recipient_limit?: number;
  frequencies?: FrequencyOption[];
  weekly_days?: string[];
  default_frequency?: string;
  default_timezone?: string;
  send_time_local_format?: string;
  approval_base_url?: ConfigField;
}

interface AutomationConfigOptions {
  criteria_config?: {
    fields?: Record<string, ConfigField>;
  };
  action_config?: {
    action_types?: ActionTypeOption[];
  };
  digest_config?: {
    pending_approval_digest?: PendingApprovalDigestOptions;
  };
  safety?: {
    digest_requires_approval?: boolean;
    digest_aggregates_by_recipient?: boolean;
    scheduler_send_requires_env_flag?: boolean;
    candidate_email_send_is_manual_after_approval?: boolean;
  };
}

interface ClientRoleOption {
  id: string;
  title: string;
}

interface ClientMemberOption {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface AutomationRule {
  id: string;
  name: string;
  client_id: string;
  role_id: string;
  enabled: boolean;
  mode?: string;
  criteria_config?: Record<string, unknown>;
  action_config?: Record<string, unknown>;
  digest_config?: Record<string, unknown>;
  rule_version?: number;
  archived_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

const ACTION_TYPE_SECOND_ROUND = "send_second_round_scheduling_email";
const DEFAULT_RULE_NAME = "Automation rule";
const DEFAULT_SCHEDULING_LABEL = "Schedule Your Interview";
const DEFAULT_APPROVAL_TIMEZONE = "America/Denver";
const DEFAULT_SEND_TIME = "08:00";

const usTimezoneOptions = [
  { value: "America/New_York", label: "Eastern" },
  { value: "America/Chicago", label: "Central" },
  { value: "America/Denver", label: "Mountain" },
  { value: "America/Los_Angeles", label: "Pacific" },
  { value: "America/Anchorage", label: "Alaska" },
  { value: "Pacific/Honolulu", label: "Hawaii" },
];

const sendTimeOptions = [
  "06:00",
  "06:30",
  "07:00",
  "07:30",
  "08:00",
  "08:30",
  "09:00",
  "09:30",
  "10:00",
  "10:30",
  "11:00",
  "11:30",
  "12:00",
  "12:30",
  "13:00",
  "13:30",
  "14:00",
  "14:30",
  "15:00",
  "15:30",
  "16:00",
  "16:30",
  "17:00",
  "17:30",
  "18:00",
];

const weekdayOptions = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
];

const frequencyOptions = [
  { value: "daily", label: "Daily" },
  { value: "weekdays", label: "Weekdays" },
  { value: "weekly", label: "Weekly" },
];

const surfaceCardStyle = {
  backgroundColor: "var(--as-surface)",
  border: "1px solid var(--as-border)",
  boxShadow: "var(--as-shadow)",
};
const compactSurfaceStyle = {
  backgroundColor: "var(--as-surface)",
  border: "1px solid var(--as-border)",
  boxShadow: "0 1px 8px rgba(10,21,71,0.04)",
};
const mutedPanelStyle = {
  backgroundColor: "var(--as-surface-muted)",
  borderColor: "var(--as-border)",
};
const fieldSurfaceStyle = {
  backgroundColor: "var(--as-surface-muted)",
  borderColor: "var(--as-border)",
  color: "var(--as-text)",
};
const primaryTextStyle = { color: "var(--as-text)" };
const mutedTextStyle = { color: "var(--as-text-muted)" };
const subtleTextStyle = { color: "var(--as-text-subtle)" };
const fieldLabelCls = "block text-[10px] font-black uppercase tracking-widest mb-1.5";
const inputCls = "w-full px-3.5 py-2 rounded-xl border text-sm placeholder-gray-400 dark:placeholder:text-slate-400/45 focus:outline-none focus:ring-2 focus:ring-[#A380F6]/25 focus:border-[#A380F6] transition-all";
const selectCls = "w-full appearance-none px-3.5 py-2 rounded-xl border text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#A380F6]/25 focus:border-[#A380F6] transition-all cursor-pointer pr-9";
const noticeCls = "rounded-xl px-3.5 py-2 text-xs font-semibold";
const successNoticeCls = "text-[#009E73] bg-[#02D99D]/10 border border-[#02D99D]/25";
const errorNoticeCls = "text-red-500 bg-red-50 border border-red-200 dark:text-red-300 dark:bg-red-500/10 dark:border-red-500/25";

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

const criteriaLabels: Record<string, { label: string; help: string }> = {
  min_overall_score: {
    label: "Minimum overall score",
    help: "Candidate must meet or exceed this overall score when available.",
  },
  min_resume_score: {
    label: "Minimum resume score",
    help: "Candidate must meet or exceed this resume score when this threshold is configured.",
  },
  min_interview_score: {
    label: "Minimum interview score",
    help: "Candidate must meet or exceed this interview score when this threshold is configured.",
  },
  allow_resume_only: {
    label: "Allow resume-only matching",
    help: "Permit matching when interview or overall thresholds are not part of this automation.",
  },
  require_sufficient_content: {
    label: "Require sufficient content",
    help: "Require enough candidate content before a candidate can be sent for approval.",
  },
};
const scoreCriteriaKeys = [
  "min_overall_score",
  "min_resume_score",
  "min_interview_score",
] as const;

function parseJsonSafe(text: string): unknown {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function extractErrorMessage(text: string, fallback = "Failed to load automation options."): string {
  if (!text) return fallback;
  const data = parseJsonSafe(text);
  const detail =
    data && typeof data === "object"
      ? (data as { detail?: unknown; message?: unknown; error?: unknown }).detail ??
        (data as { detail?: unknown; message?: unknown; error?: unknown }).message ??
        (data as { detail?: unknown; message?: unknown; error?: unknown }).error
      : null;
  if (typeof detail === "string" && detail.trim()) return detail;
  return text;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function toConfigOptions(value: unknown): AutomationConfigOptions | null {
  if (!isRecord(value)) return null;
  const item = isRecord(value.item) ? value.item : value;
  return item as AutomationConfigOptions;
}

function responseItems(value: unknown): unknown[] {
  if (!isRecord(value) || !Array.isArray(value.items)) return [];
  return value.items;
}

function toClientRoles(value: unknown): ClientRoleOption[] {
  return responseItems(value)
    .filter((item): item is Record<string, unknown> => isRecord(item))
    .map((item) => ({
      id: String(item.id || "").trim(),
      title: String(item.title || "").trim() || "Untitled Role",
    }))
    .filter((item) => Boolean(item.id));
}

function toMemberRole(value: unknown): string {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "manager" || normalized === "admin") return "Manager";
  return "Member";
}

function fallbackNameFromEmail(email: string): string {
  const local = String(email || "").split("@")[0] || "";
  return local.trim() || "Unnamed Member";
}

function toClientMembers(value: unknown): ClientMemberOption[] {
  return responseItems(value)
    .filter((item): item is Record<string, unknown> => isRecord(item))
    .map((item, index) => {
      const email = String(item.email || "").trim().toLowerCase();
      const rawId = item.id ?? item.user_id ?? email;
      const id = String(rawId || "").trim() || `member-${index + 1}`;
      const name = collapseWhitespace(String(item.name || "").trim()) || fallbackNameFromEmail(email);
      return {
        id,
        name,
        email,
        role: toMemberRole(item.role),
      };
    })
    .filter((item) => Boolean(item.email) && isValidEmail(item.email));
}

function toAutomationRule(value: unknown): AutomationRule | null {
  if (!isRecord(value)) return null;
  const id = String(value.id || "").trim();
  const clientId = String(value.client_id || "").trim();
  const roleId = String(value.role_id || "").trim();
  if (!id || !clientId || !roleId) return null;
  return {
    id,
    name: String(value.name || "").trim() || DEFAULT_RULE_NAME,
    client_id: clientId,
    role_id: roleId,
    enabled: value.enabled === true,
    mode: String(value.mode || "").trim() || undefined,
    criteria_config: isRecord(value.criteria_config) ? value.criteria_config : {},
    action_config: isRecord(value.action_config) ? value.action_config : {},
    digest_config: isRecord(value.digest_config) ? value.digest_config : {},
    rule_version: Number.isFinite(Number(value.rule_version)) ? Number(value.rule_version) : undefined,
    archived_at: typeof value.archived_at === "string" ? value.archived_at : null,
    created_at: typeof value.created_at === "string" ? value.created_at : null,
    updated_at: typeof value.updated_at === "string" ? value.updated_at : null,
  };
}

function toAutomationRules(value: unknown): AutomationRule[] {
  return responseItems(value)
    .map((item) => toAutomationRule(item))
    .filter((item): item is AutomationRule => Boolean(item));
}

function toSavedRule(value: unknown): AutomationRule | null {
  if (!isRecord(value)) return toAutomationRule(value);
  return toAutomationRule(isRecord(value.item) ? value.item : value);
}

function ruleTimestamp(rule: AutomationRule): number {
  const updated = Date.parse(String(rule.updated_at || ""));
  if (Number.isFinite(updated)) return updated;
  const created = Date.parse(String(rule.created_at || ""));
  return Number.isFinite(created) ? created : 0;
}

function ruleForRole(rules: AutomationRule[], roleId: string): AutomationRule | null {
  const matches = rules
    .filter((rule) => rule.role_id === roleId && !rule.archived_at)
    .sort((a, b) => ruleTimestamp(b) - ruleTimestamp(a) || b.id.localeCompare(a.id));
  return matches[0] || null;
}

function titleCase(value: string): string {
  return String(value || "")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function numericFieldBounds(field: ConfigField): { min: number; max: number } {
  return {
    min: typeof field.min === "number" ? field.min : 0,
    max: typeof field.max === "number" ? field.max : 100,
  };
}

function getInitialCriteriaValues(fields: Record<string, ConfigField>): Record<string, CriteriaValue> {
  const next: Record<string, CriteriaValue> = {};
  Object.entries(fields).forEach(([key, field]) => {
    next[key] = field.type === "boolean" ? Boolean(field.default) : "";
  });
  if (next.require_sufficient_content === undefined) next.require_sufficient_content = true;
  if (next.allow_resume_only === undefined) next.allow_resume_only = false;
  return next;
}

function criteriaValuesFromRule(
  fields: Record<string, ConfigField>,
  rule: AutomationRule,
): Record<string, CriteriaValue> {
  const source = isRecord(rule.criteria_config) ? rule.criteria_config : {};
  const next = getInitialCriteriaValues(fields);
  for (const key of Object.keys(next)) {
    const field = fields[key] || {};
    const value = source[key];
    if (field.type === "boolean") {
      next[key] = typeof value === "boolean" ? value : Boolean(next[key]);
    } else {
      next[key] = value === null || value === undefined || value === "" ? "" : String(value);
    }
  }
  return next;
}

function getPendingDigest(rule: AutomationRule): Record<string, unknown> {
  const digestConfig = isRecord(rule.digest_config) ? rule.digest_config : {};
  return isRecord(digestConfig.pending_approval_digest)
    ? digestConfig.pending_approval_digest
    : {};
}

function stringField(value: unknown): string {
  return String(value || "").trim();
}

function collapseWhitespace(value: string): string {
  return value.replace(/[\r\n\t]+/g, " ").replace(/\s+/g, " ").trim();
}

function generatedRuleName(roleTitle: string): string {
  const cleanTitle = collapseWhitespace(roleTitle);
  return cleanTitle ? `Second-round review - ${cleanTitle}` : DEFAULT_RULE_NAME;
}

function parseScoreValue(value: CriteriaValue | undefined): number | null {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function normalizeEmailList(values: unknown[]): string[] {
  const seen = new Set<string>();
  const emails: string[] = [];
  values
    .map((email) => String(email || "").trim().toLowerCase())
    .filter(Boolean)
    .forEach((email) => {
      if (seen.has(email) || !isValidEmail(email)) return;
      seen.add(email);
      emails.push(email);
    });
  return emails;
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isValidHttpUrl(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return true;
  try {
    const url = new URL(trimmed);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function getCurrentAppOrigin(): string {
  if (typeof window === "undefined") return "";
  return window.location.origin.replace(/\/+$/, "");
}

function safeTimezone(value: unknown): string {
  const normalized = String(value || "").trim();
  return usTimezoneOptions.some((item) => item.value === normalized)
    ? normalized
    : DEFAULT_APPROVAL_TIMEZONE;
}

function safeSendTime(value: unknown): string {
  const normalized = String(value || "").trim();
  return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(normalized) && sendTimeOptions.includes(normalized)
    ? normalized
    : DEFAULT_SEND_TIME;
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "";
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return "";
  return parsed.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

async function getSessionToken(): Promise<string> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = String(session?.access_token || "").trim();
  if (!token) throw new Error("Missing session token.");
  return token;
}

export default function AutomationPage() {
  const {
    selectedClient,
    selectedClientId,
    loading: clientLoading,
    error: clientError,
  } = useClient();
  const [options, setOptions] = useState<AutomationConfigOptions | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [roles, setRoles] = useState<ClientRoleOption[]>([]);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [rolesError, setRolesError] = useState("");
  const [members, setMembers] = useState<ClientMemberOption[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [membersError, setMembersError] = useState("");
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [rulesLoading, setRulesLoading] = useState(false);
  const [rulesError, setRulesError] = useState("");
  const [selectedRuleId, setSelectedRuleId] = useState("");
  const [selectedRoleId, setSelectedRoleId] = useState("");
  const [saving, setSaving] = useState(false);
  const [actionNotice, setActionNotice] = useState<Notice | null>(null);
  const [ruleEnabled, setRuleEnabled] = useState(false);
  const [criteriaValues, setCriteriaValues] = useState<Record<string, CriteriaValue>>({});
  const [selectedActionType, setSelectedActionType] = useState("");
  const [schedulingUrl, setSchedulingUrl] = useState("");
  const [schedulingLabel, setSchedulingLabel] = useState("");
  const [selectedRecipientEmails, setSelectedRecipientEmails] = useState<string[]>([]);
  const [timezone, setTimezone] = useState(DEFAULT_APPROVAL_TIMEZONE);
  const [sendTimeLocal, setSendTimeLocal] = useState(DEFAULT_SEND_TIME);
  const [frequency, setFrequency] = useState("daily");
  const [weeklyDay, setWeeklyDay] = useState("monday");
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const criteriaFields = options?.criteria_config?.fields || {};
  const actionTypes = options?.action_config?.action_types || [];
  const defaultActionType = actionTypes.find((item) => item.value === ACTION_TYPE_SECOND_ROUND)?.value || actionTypes[0]?.value || ACTION_TYPE_SECOND_ROUND;
  const selectedAction = actionTypes.find((item) => item.value === selectedActionType) || actionTypes[0] || null;
  const actionFields = selectedAction?.fields || {};
  const labelMaxLength = actionFields.second_round_scheduling_label?.max_length || 80;
  const digestOptions = options?.digest_config?.pending_approval_digest || {};
  const recipientLimit = digestOptions.recipient_limit || 10;
  const recipientList = useMemo(
    () => normalizeEmailList(selectedRecipientEmails),
    [selectedRecipientEmails],
  );
  const recipientCount = recipientList.length;
  const selectedRule = rules.find((rule) => rule.id === selectedRuleId) || null;
  const selectedRole = roles.find((role) => role.id === selectedRoleId) || null;
  const generatedName = generatedRuleName(selectedRole?.title || "");
  const configDisabled = !ruleEnabled;
  const memberByEmail = useMemo(
    () => new Map(members.map((member) => [member.email, member])),
    [members],
  );
  const selectedRecipients = recipientList.map((email) => {
    const member = memberByEmail.get(email);
    return member || { id: email, name: fallbackNameFromEmail(email), email, role: "Member" };
  });
  const availableRecipientMembers = members.filter(
    (member) => !recipientList.includes(member.email),
  );
  const blockingError = error || clientError;
  const isInitialLoading = loading || clientLoading;

  const resetDraftForm = useCallback((roleId = "") => {
    const configuredFrequency = String(digestOptions.default_frequency || "daily");
    const nextFrequency = frequencyOptions.some((item) => item.value === configuredFrequency)
      ? configuredFrequency
      : "daily";
    setSelectedRuleId("");
    setSelectedRoleId(roleId);
    setRuleEnabled(false);
    setCriteriaValues(getInitialCriteriaValues(criteriaFields));
    setSelectedActionType(defaultActionType);
    setSchedulingUrl("");
    setSchedulingLabel(DEFAULT_SCHEDULING_LABEL);
    setSelectedRecipientEmails([]);
    setTimezone(safeTimezone(digestOptions.default_timezone));
    setSendTimeLocal(DEFAULT_SEND_TIME);
    setFrequency(nextFrequency);
    setWeeklyDay("monday");
    setAdvancedOpen(false);
  }, [criteriaFields, defaultActionType, digestOptions.default_frequency, digestOptions.default_timezone]);

  const populateFormFromRule = useCallback((rule: AutomationRule) => {
    const actionConfig = isRecord(rule.action_config) ? rule.action_config : {};
    const pendingDigest = getPendingDigest(rule);
    const configuredFrequency = stringField(pendingDigest.frequency);
    const nextFrequency =
      configuredFrequency && frequencyOptions.some((item) => item.value === configuredFrequency)
        ? configuredFrequency
        : "daily";

    setSelectedRuleId(rule.id);
    setSelectedRoleId(rule.role_id);
    setRuleEnabled(rule.enabled === true);
    setCriteriaValues(criteriaValuesFromRule(criteriaFields, rule));
    setSelectedActionType(defaultActionType);
    setSchedulingUrl(stringField(actionConfig.second_round_scheduling_url));
    setSchedulingLabel(
      (stringField(actionConfig.second_round_scheduling_label) || DEFAULT_SCHEDULING_LABEL).slice(0, labelMaxLength),
    );
    setSelectedRecipientEmails(
      Array.isArray(pendingDigest.recipient_emails)
        ? normalizeEmailList(pendingDigest.recipient_emails)
        : [],
    );
    setTimezone(safeTimezone(pendingDigest.timezone || digestOptions.default_timezone));
    setSendTimeLocal(safeSendTime(pendingDigest.send_time_local));
    setFrequency(nextFrequency);
    setWeeklyDay(weekdayOptions.includes(stringField(pendingDigest.weekly_day)) ? stringField(pendingDigest.weekly_day) : "monday");
    setAdvancedOpen(false);
  }, [criteriaFields, defaultActionType, digestOptions.default_timezone, labelMaxLength]);

  const loadOptions = useCallback(async () => {
    if (!backendBase) {
      setOptions(null);
      setError("Missing backend base URL configuration.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const token = await getSessionToken();
      const response = await fetch(`${backendBase}/api/automation/rules/config-options`, {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
        credentials: "omit",
      });
      const text = await response.text();
      if (!response.ok) throw new Error(extractErrorMessage(text));

      const parsed = toConfigOptions(parseJsonSafe(text));
      if (!parsed) throw new Error("Automation options response was not recognized.");

      const parsedCriteriaFields = parsed.criteria_config?.fields || {};
      const parsedActionTypes = parsed.action_config?.action_types || [];
      const parsedDigestOptions = parsed.digest_config?.pending_approval_digest || {};
      const parsedFrequency = String(parsedDigestOptions.default_frequency || "daily");

      setOptions(parsed);
      setCriteriaValues(getInitialCriteriaValues(parsedCriteriaFields));
      setSelectedActionType(parsedActionTypes.find((item) => item.value === ACTION_TYPE_SECOND_ROUND)?.value || parsedActionTypes[0]?.value || ACTION_TYPE_SECOND_ROUND);
      setTimezone(safeTimezone(parsedDigestOptions.default_timezone));
      setFrequency(frequencyOptions.some((item) => item.value === parsedFrequency) ? parsedFrequency : "daily");
      setWeeklyDay("monday");
    } catch (loadError) {
      setOptions(null);
      setError(loadError instanceof Error ? loadError.message : "Failed to load automation options.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadOptions();
  }, [loadOptions]);

  useEffect(() => {
    setActionNotice(null);
    resetDraftForm("");
  }, [resetDraftForm, selectedClientId]);

  useEffect(() => {
    if (!actionNotice) return;
    const timer = setTimeout(() => setActionNotice(null), 4200);
    return () => clearTimeout(timer);
  }, [actionNotice]);

  useEffect(() => {
    let alive = true;

    const loadRoles = async () => {
      if (clientLoading) return;
      if (clientError) {
        if (!alive) return;
        setRoles([]);
        setRolesError(clientError);
        setRolesLoading(false);
        return;
      }
      if (!selectedClientId) {
        if (!alive) return;
        setRoles([]);
        setRolesError("");
        setRolesLoading(false);
        return;
      }
      if (!backendBase) {
        if (!alive) return;
        setRoles([]);
        setRolesError("Missing backend base URL configuration.");
        setRolesLoading(false);
        return;
      }

      if (!alive) return;
      setRolesLoading(true);
      setRolesError("");

      try {
        const token = await getSessionToken();
        const response = await fetch(
          `${backendBase}/roles?client_id=${encodeURIComponent(selectedClientId)}`,
          {
            method: "GET",
            headers: { Authorization: `Bearer ${token}` },
            credentials: "omit",
          },
        );
        const text = await response.text();
        if (!response.ok) throw new Error(extractErrorMessage(text, "Failed to load roles."));

        if (!alive) return;
        setRoles(toClientRoles(parseJsonSafe(text)));
      } catch (loadError) {
        if (!alive) return;
        setRoles([]);
        setRolesError(loadError instanceof Error ? loadError.message : "Failed to load roles.");
      } finally {
        if (alive) setRolesLoading(false);
      }
    };

    void loadRoles();
    return () => {
      alive = false;
    };
  }, [clientError, clientLoading, selectedClientId]);

  useEffect(() => {
    let alive = true;

    const loadMembers = async () => {
      if (clientLoading) return;
      if (clientError) {
        if (!alive) return;
        setMembers([]);
        setMembersError(clientError);
        setMembersLoading(false);
        return;
      }
      if (!selectedClientId) {
        if (!alive) return;
        setMembers([]);
        setMembersError("");
        setMembersLoading(false);
        return;
      }
      if (!backendBase) {
        if (!alive) return;
        setMembers([]);
        setMembersError("Missing backend base URL configuration.");
        setMembersLoading(false);
        return;
      }

      if (!alive) return;
      setMembersLoading(true);
      setMembersError("");

      try {
        const token = await getSessionToken();
        const response = await fetch(
          `${backendBase}/client-members?client_id=${encodeURIComponent(selectedClientId)}`,
          {
            method: "GET",
            headers: { Authorization: `Bearer ${token}` },
            credentials: "omit",
          },
        );
        const text = await response.text();
        if (!response.ok) throw new Error(extractErrorMessage(text, "Failed to load team members."));

        if (!alive) return;
        setMembers(toClientMembers(parseJsonSafe(text)));
      } catch (loadError) {
        if (!alive) return;
        setMembers([]);
        setMembersError(loadError instanceof Error ? loadError.message : "Failed to load team members.");
      } finally {
        if (alive) setMembersLoading(false);
      }
    };

    void loadMembers();
    return () => {
      alive = false;
    };
  }, [clientError, clientLoading, selectedClientId]);

  useEffect(() => {
    let alive = true;

    const loadRules = async () => {
      if (clientLoading) return;
      if (clientError) {
        if (!alive) return;
        setRules([]);
        setRulesError(clientError);
        setRulesLoading(false);
        return;
      }
      if (!selectedClientId) {
        if (!alive) return;
        setRules([]);
        setRulesError("");
        setRulesLoading(false);
        return;
      }
      if (!backendBase) {
        if (!alive) return;
        setRules([]);
        setRulesError("Missing backend base URL configuration.");
        setRulesLoading(false);
        return;
      }

      if (!alive) return;
      setRulesLoading(true);
      setRulesError("");

      try {
        const token = await getSessionToken();
        const response = await fetch(
          `${backendBase}/api/automation/rules?client_id=${encodeURIComponent(selectedClientId)}`,
          {
            method: "GET",
            headers: { Authorization: `Bearer ${token}` },
            credentials: "omit",
          },
        );
        const text = await response.text();
        if (!response.ok) throw new Error(extractErrorMessage(text, "Failed to load saved automation settings."));

        if (!alive) return;
        setRules(toAutomationRules(parseJsonSafe(text)));
      } catch (loadError) {
        if (!alive) return;
        setRules([]);
        setRulesError(loadError instanceof Error ? loadError.message : "Failed to load saved automation settings.");
      } finally {
        if (alive) setRulesLoading(false);
      }
    };

    void loadRules();
    return () => {
      alive = false;
    };
  }, [clientError, clientLoading, selectedClientId]);

  const selectRoleAutomation = useCallback((roleId: string) => {
    setActionNotice(null);
    if (!roleId) {
      resetDraftForm("");
      return;
    }
    const existingRule = ruleForRole(rules, roleId);
    if (existingRule) {
      populateFormFromRule(existingRule);
      return;
    }
    resetDraftForm(roleId);
  }, [populateFormFromRule, resetDraftForm, rules]);

  useEffect(() => {
    if (!selectedRoleId || rulesLoading) return;
    const existingRule = ruleForRole(rules, selectedRoleId);
    if (existingRule && existingRule.id !== selectedRuleId) {
      populateFormFromRule(existingRule);
    }
  }, [populateFormFromRule, rules, rulesLoading, selectedRoleId, selectedRuleId]);

  const validateForm = () => {
    const normalizedName = generatedName;
    if (!selectedClientId) return { error: "Select a client before saving this automation." };
    if (!selectedRoleId) return { error: "Select a role before saving this automation." };
    if (!selectedRole) return { error: "Select a valid role before saving this automation." };
    if (!normalizedName) return { error: "Automation settings could not be prepared for this role." };

    for (const key of scoreCriteriaKeys) {
      const parsed = parseScoreValue(criteriaValues[key]);
      if (Number.isNaN(parsed) || (parsed !== null && (parsed < 0 || parsed > 100))) {
        const label = criteriaLabels[key]?.label || titleCase(key);
        return { error: `${label} must be blank or a number from 0 to 100.` };
      }
    }

    if (!schedulingUrl.trim()) {
      return { error: "Scheduling URL is required before saving this automation." };
    }
    if (!isValidHttpUrl(schedulingUrl)) {
      return { error: "Scheduling URL must be a valid http/https URL." };
    }

    const approvalBaseUrl = getCurrentAppOrigin();
    if (!approvalBaseUrl || !isValidHttpUrl(approvalBaseUrl)) {
      return { error: "A valid approval link base URL is required before saving." };
    }

    const invalidEmail = recipientList.find((email) => !isValidEmail(email));
    if (invalidEmail) return { error: `Recipient email is invalid: ${invalidEmail}` };
    if (recipientList.length === 0) {
      return { error: "Choose at least one approval recipient." };
    }
    if (recipientList.length > recipientLimit) {
      return { error: `Approval recipients must include ${recipientLimit} or fewer people.` };
    }

    if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(sendTimeLocal)) {
      return { error: "Send time must use HH:MM 24-hour format." };
    }

    const allowedFrequencies = frequencyOptions.map((item) => item.value);
    if (!allowedFrequencies.includes(frequency)) {
      return { error: "Frequency is not supported by the backend." };
    }
    if (frequency === "weekly") {
      if (!weeklyDay) return { error: "Weekly day is required when frequency is weekly." };
      if (!weekdayOptions.includes(weeklyDay)) {
        return { error: "Weekly day is not supported by the backend." };
      }
    }

    if (!usTimezoneOptions.some((item) => item.value === timezone)) {
      return { error: "Choose a supported US timezone." };
    }

    return { error: "", normalizedName, approvalBaseUrl };
  };

  const buildPayload = (normalizedName: string, approvalBaseUrl: string) => {
    const recipientNames = recipientList.reduce<Record<string, string>>((acc, email) => {
      const member = memberByEmail.get(email);
      const name = collapseWhitespace(member?.name || fallbackNameFromEmail(email)).slice(0, 120);
      if (name) acc[email] = name;
      return acc;
    }, {});
    const criteria_config = {
      min_overall_score: parseScoreValue(criteriaValues.min_overall_score),
      min_resume_score: parseScoreValue(criteriaValues.min_resume_score),
      min_interview_score: parseScoreValue(criteriaValues.min_interview_score),
      allow_resume_only: criteriaValues.allow_resume_only === true,
      require_sufficient_content: true,
    };
    const pendingApprovalDigest: Record<string, unknown> = {
      enabled: true,
      recipient_emails: recipientList,
      recipient_names: recipientNames,
      approval_base_url: approvalBaseUrl,
      send_time_local: sendTimeLocal.trim(),
      timezone: timezone.trim(),
      frequency,
    };
    if (frequency === "weekly") pendingApprovalDigest.weekly_day = weeklyDay;

    return {
      name: normalizedName,
      enabled: ruleEnabled,
      criteria_config,
      action_config: {
        second_round_scheduling_url: schedulingUrl.trim(),
        second_round_scheduling_label: schedulingLabel.trim(),
      },
      digest_config: {
        pending_approval_digest: pendingApprovalDigest,
      },
    };
  };

  const handleSave = async () => {
    if (saving) return;
    setActionNotice(null);

    const validation = validateForm();
    if (validation.error || !validation.normalizedName) {
      setActionNotice({ tone: "error", text: validation.error || "Automation could not be saved." });
      return;
    }
    if (!backendBase) {
      setActionNotice({ tone: "error", text: "Missing backend base URL configuration." });
      return;
    }

    setSaving(true);
    try {
      const token = await getSessionToken();
      const basePayload = buildPayload(validation.normalizedName, validation.approvalBaseUrl);
      const isPatch = Boolean(selectedRuleId);
      const payload = isPatch
        ? basePayload
        : {
          ...basePayload,
          client_id: selectedClientId,
          role_id: selectedRoleId,
          action_type: ACTION_TYPE_SECOND_ROUND,
        };
      const url = isPatch
        ? `${backendBase}/api/automation/rules/${encodeURIComponent(selectedRuleId)}`
        : `${backendBase}/api/automation/rules`;
      const response = await fetch(url, {
        method: isPatch ? "PATCH" : "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        credentials: "omit",
        body: JSON.stringify(payload),
      });
      const text = await response.text();
      if (!response.ok) throw new Error(extractErrorMessage(text, "Failed to save automation."));

      const savedRule = toSavedRule(parseJsonSafe(text));
      if (!savedRule) throw new Error("Automation save response was not recognized.");

      setRules((current) => {
        const exists = current.some((rule) => rule.id === savedRule.id);
        if (exists) return current.map((rule) => (rule.id === savedRule.id ? savedRule : rule));
        return [savedRule, ...current];
      });
      populateFormFromRule(savedRule);
      setActionNotice({
        tone: "success",
        text: isPatch ? "Automation saved." : "Automation created.",
      });
    } catch (saveError) {
      setActionNotice({
        tone: "error",
        text: saveError instanceof Error ? saveError.message : "Failed to save automation.",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleRoleSelection = (roleId: string) => {
    selectRoleAutomation(roleId);
  };

  const renderNumberCriteria = (key: string, field: ConfigField) => {
    const copy = criteriaLabels[key] || {
      label: titleCase(key),
      help: "Backend-supported automation threshold.",
    };
    const bounds = numericFieldBounds(field);
    return (
      <div key={key}>
        <label className={`${fieldLabelCls} flex items-center gap-1`} style={mutedTextStyle}>
          {copy.label}
          <InfoTooltip content={copy.help} side="bottom" />
        </label>
        <input
          type="number"
          min={bounds.min}
          max={bounds.max}
          value={String(criteriaValues[key] ?? "")}
          onChange={(event) => setCriteriaValues((prev) => ({ ...prev, [key]: event.target.value }))}
          placeholder="No threshold"
          className={inputCls}
          style={fieldSurfaceStyle}
        />
        <p className="mt-1 text-[10px] font-semibold" style={subtleTextStyle}>
          Range {bounds.min}-{bounds.max}
        </p>
      </div>
    );
  };

  const renderBooleanCriteria = (key: string) => {
    const copy = criteriaLabels[key] || {
      label: titleCase(key),
      help: "Backend-supported automation option.",
    };
    return (
      <label
        key={key}
        className="rounded-xl border px-3 py-2.5 flex items-start gap-2.5 cursor-pointer"
        style={mutedPanelStyle}
      >
        <input
          type="checkbox"
          checked={Boolean(criteriaValues[key])}
          onChange={(event) => setCriteriaValues((prev) => ({ ...prev, [key]: event.target.checked }))}
          className="mt-0.5 h-4 w-4 rounded border-gray-300 text-[#A380F6] focus:ring-[#A380F6]"
        />
        <span className="min-w-0">
          <span className="block text-xs font-black" style={primaryTextStyle}>{copy.label}</span>
          <span className="block text-[11px] leading-relaxed mt-0.5" style={mutedTextStyle}>{copy.help}</span>
        </span>
      </label>
    );
  };

  const safetyItems = [
    "Saving this automation does not email candidates.",
    "Candidates who meet your settings are gathered for review.",
    "Your team receives one approval email with the matching candidates.",
    "Scores help organize the review, but hiring decisions stay with your team.",
  ];

  return (
    <DashboardLayout title="Automation">
      <CurrentScopeBanner client={selectedClient} />

      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <h2 className="text-2xl font-black leading-tight mb-3" style={primaryTextStyle}>
            Automation
          </h2>
          <p className="text-sm leading-relaxed" style={mutedTextStyle}>
            Set when candidates should be gathered for your team to review before a second-round interview. You choose the score criteria, reviewers, and how often the approval email is sent.
          </p>
        </div>
        <label className="inline-flex items-center gap-3 rounded-2xl border px-4 py-3 shrink-0" style={compactSurfaceStyle}>
          <span className="min-w-0">
            <span className="flex items-center gap-1 text-xs font-black" style={primaryTextStyle}>
              Automation on/off
              <InfoTooltip content="Turns review automation on for the selected role. Saving settings here does not email candidates." side="bottom" />
            </span>
            <span className="block text-[11px] font-semibold mt-0.5" style={subtleTextStyle}>
              {ruleEnabled ? "On for this role" : "Off for this role"}
            </span>
          </span>
          <input
            type="checkbox"
            checked={ruleEnabled}
            onChange={(event) => setRuleEnabled(event.target.checked)}
            className="sr-only"
            aria-label="Automation on/off"
          />
          <span
            className={`relative inline-flex h-7 w-12 rounded-full transition-colors ${ruleEnabled ? "bg-[#A380F6]" : "bg-slate-300 dark:bg-slate-700"}`}
          >
            <span
              className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${ruleEnabled ? "translate-x-6" : "translate-x-1"}`}
            />
          </span>
        </label>
      </div>

      {isInitialLoading && (
        <div className="rounded-2xl px-5 py-4 mb-5 flex items-center gap-3" style={surfaceCardStyle}>
          <Loader2 className="h-4 w-4 animate-spin text-[#A380F6]" />
          <p className="text-sm font-semibold" style={mutedTextStyle}>Loading automation options...</p>
        </div>
      )}

      {!isInitialLoading && blockingError && (
        <div className="rounded-2xl p-5 mb-5" style={surfaceCardStyle}>
          <p className="text-sm font-bold text-red-500 mb-3">{blockingError}</p>
          {!clientError && (
            <button
              type="button"
              onClick={() => { void loadOptions(); }}
              className="px-4 py-2 rounded-full text-xs font-bold text-white transition-opacity hover:opacity-90"
              style={{ backgroundColor: "#A380F6" }}
            >
              Retry
            </button>
          )}
        </div>
      )}

      {!isInitialLoading && !blockingError && (
        <div className="space-y-5">
          {actionNotice && (
            <div
              className={`${noticeCls} ${actionNotice.tone === "success" ? successNoticeCls : errorNoticeCls}`}
              role="status"
              aria-live="polite"
            >
              {actionNotice.text}
            </div>
          )}

          {(rolesError || membersError || rulesError) && (
            <div className={`${noticeCls} ${errorNoticeCls}`} role="status" aria-live="polite">
              {rolesError || membersError || rulesError}
            </div>
          )}

          <section className="rounded-2xl p-5" style={surfaceCardStyle}>
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-end">
              <div>
                <label className={fieldLabelCls} style={mutedTextStyle}>Role</label>
                <div className="relative">
                  <select
                    value={selectedRoleId}
                    onChange={(event) => handleRoleSelection(event.target.value)}
                    className={selectCls}
                    style={fieldSurfaceStyle}
                    disabled={rolesLoading || rulesLoading}
                  >
                    <option value="">
                      {rolesLoading ? "Loading roles..." : "Select a role..."}
                    </option>
                    {roles.map((role) => (
                      <option key={role.id} value={role.id}>
                        {role.title}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none" style={mutedTextStyle} />
                </div>
                <p className="mt-1 text-[10px] font-semibold" style={subtleTextStyle}>
                  {selectedRule ? "Saved settings loaded for this role." : "Choose the role this automation should use."}
                </p>
              </div>
              <div className="rounded-xl border px-4 py-3" style={mutedPanelStyle}>
                <p className="text-xs font-black" style={primaryTextStyle}>
                  {selectedRole ? `${selectedRole.title} automation` : "Select a role to start"}
                </p>
                <p className="text-[11px] font-semibold mt-1" style={mutedTextStyle}>
                  {selectedRule?.updated_at ? `Last saved ${formatDate(selectedRule.updated_at)}` : "One automation is shown per role."}
                </p>
              </div>
            </div>
          </section>

          {configDisabled && selectedRoleId && (
            <div className="rounded-2xl px-4 py-3 text-xs font-semibold" style={mutedPanelStyle}>
              <span style={mutedTextStyle}>Automation is off for this role. You can prepare settings now and turn it on when ready.</span>
            </div>
          )}

          <section className={`rounded-2xl p-5 transition-opacity ${configDisabled ? "opacity-55" : ""}`} style={surfaceCardStyle}>
            <div className="flex flex-col gap-1 mb-4">
              <p className="text-[10px] font-black uppercase tracking-widest" style={subtleTextStyle}>Candidate criteria</p>
              <h3 className="text-base font-black" style={primaryTextStyle}>Who should be reviewed?</h3>
              <p className="text-xs leading-relaxed" style={mutedTextStyle}>
                Candidates who meet your score settings will be added to your approval email.
              </p>
            </div>
            <div className="space-y-3">
              <div className="max-w-sm">
                {renderNumberCriteria("min_overall_score", criteriaFields.min_overall_score || {})}
              </div>
              <div className="rounded-xl border" style={mutedPanelStyle}>
                <button
                  type="button"
                  onClick={() => setAdvancedOpen((open) => !open)}
                  className="w-full px-4 py-3 flex items-center justify-between gap-3 text-left"
                >
                  <span className="flex items-center gap-1 text-sm font-black" style={primaryTextStyle}>
                    Advanced score options
                    <InfoTooltip content="Optional settings for teams that want separate resume or interview thresholds." side="bottom" />
                  </span>
                  <ChevronDown className={`w-4 h-4 transition-transform ${advancedOpen ? "rotate-180" : ""}`} style={mutedTextStyle} />
                </button>
                {advancedOpen && (
                  <div className="border-t p-4 space-y-3" style={{ borderColor: "var(--as-border)" }}>
                    <div className="grid gap-3 md:grid-cols-2">
                      {renderNumberCriteria("min_resume_score", criteriaFields.min_resume_score || {})}
                      {renderNumberCriteria("min_interview_score", criteriaFields.min_interview_score || {})}
                    </div>
                    {renderBooleanCriteria("allow_resume_only")}
                  </div>
                )}
              </div>
            </div>
          </section>

          <section className={`rounded-2xl p-5 transition-opacity ${configDisabled ? "opacity-55" : ""}`} style={surfaceCardStyle}>
            <div className="flex flex-col gap-1 mb-4">
              <p className="text-[10px] font-black uppercase tracking-widest" style={subtleTextStyle}>Next step</p>
              <h3 className="text-base font-black" style={primaryTextStyle}>Add the scheduling link</h3>
              <p className="text-xs leading-relaxed" style={mutedTextStyle}>
                Approved candidates receive this link when your team approves them from the review page.
              </p>
            </div>
            <div className="grid gap-3 lg:grid-cols-2">
              <div>
                <label className={`${fieldLabelCls} flex items-center gap-1`} style={mutedTextStyle}>
                  Scheduling URL
                  <InfoTooltip content="The scheduling page approved candidates should use for the next interview step." side="bottom" />
                </label>
                <input
                  type="url"
                  value={schedulingUrl}
                  onChange={(event) => setSchedulingUrl(event.target.value)}
                  placeholder="https://..."
                  className={inputCls}
                  style={fieldSurfaceStyle}
                />
              </div>
              <div>
                <label className={`${fieldLabelCls} flex items-center gap-1`} style={mutedTextStyle}>
                  Button text for candidate email
                  <InfoTooltip content="This is the button or link text candidates see in the scheduling email." side="bottom" />
                </label>
                <input
                  type="text"
                  value={schedulingLabel}
                  onChange={(event) => setSchedulingLabel(event.target.value.slice(0, labelMaxLength))}
                  maxLength={labelMaxLength}
                  placeholder={DEFAULT_SCHEDULING_LABEL}
                  className={inputCls}
                  style={fieldSurfaceStyle}
                />
                <p className="mt-1 text-[10px] font-semibold" style={subtleTextStyle}>
                  {schedulingLabel.length}/{labelMaxLength}
                </p>
              </div>
            </div>
          </section>

          <section className={`rounded-2xl p-5 transition-opacity ${configDisabled ? "opacity-55" : ""}`} style={surfaceCardStyle}>
            <div className="flex flex-col gap-1 mb-4">
              <p className="text-[10px] font-black uppercase tracking-widest" style={subtleTextStyle}>Approval email</p>
              <h3 className="text-base font-black" style={primaryTextStyle}>Choose who reviews candidates</h3>
              <p className="text-xs leading-relaxed" style={mutedTextStyle}>
                We'll send one email with matching candidates for your team to approve.
              </p>
            </div>
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)]">
              <div>
                <label className={`${fieldLabelCls} flex items-center gap-1`} style={mutedTextStyle}>
                  Approval recipients
                  <InfoTooltip content="Choose team members who should receive the approval email for this role." side="bottom" />
                </label>
                <div className="relative">
                  <select
                    value=""
                    onChange={(event) => {
                      const email = event.target.value;
                      if (!email) return;
                      setSelectedRecipientEmails((current) => normalizeEmailList([...current, email]).slice(0, recipientLimit));
                    }}
                    className={selectCls}
                    style={fieldSurfaceStyle}
                    disabled={membersLoading || availableRecipientMembers.length === 0 || recipientCount >= recipientLimit}
                  >
                    <option value="">
                      {membersLoading ? "Loading team members..." : "Add team member..."}
                    </option>
                    {availableRecipientMembers.map((member) => (
                      <option key={member.id} value={member.email}>
                        {member.name} — {member.email} — {member.role}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none" style={mutedTextStyle} />
                </div>
                <p className="mt-1 text-[10px] font-semibold" style={recipientCount > recipientLimit ? { color: "#EF4444" } : subtleTextStyle}>
                  {recipientCount}/{recipientLimit} recipients
                </p>
                {members.length === 0 && !membersLoading && (
                  <p className="mt-2 text-[11px] font-semibold" style={mutedTextStyle}>
                    No team members with email addresses are available for this client.
                  </p>
                )}
                {selectedRecipients.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {selectedRecipients.map((member) => (
                      <span
                        key={member.email}
                        className="inline-flex max-w-full items-center gap-2 rounded-xl border px-2.5 py-1.5 text-[11px] font-semibold"
                        style={mutedPanelStyle}
                      >
                        <span className="min-w-0 truncate" style={primaryTextStyle}>
                          {member.name} — {member.email} — {member.role}
                        </span>
                        <button
                          type="button"
                          onClick={() => setSelectedRecipientEmails((current) => current.filter((email) => email !== member.email))}
                          className="shrink-0 rounded-full p-0.5 hover:bg-red-500/10 hover:text-red-500"
                          aria-label={`Remove ${member.name}`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label className={`${fieldLabelCls} flex items-center gap-1`} style={mutedTextStyle}>
                  Send schedule
                  <InfoTooltip content="How often the approval email should gather matching candidates for reviewers." side="bottom" />
                </label>
                <div className="relative">
                  <select
                    value={frequency}
                    onChange={(event) => setFrequency(event.target.value)}
                    className={selectCls}
                    style={fieldSurfaceStyle}
                  >
                    {frequencyOptions.map((item) => (
                      <option key={item.value} value={item.value}>{item.label}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none" style={mutedTextStyle} />
                </div>
                {frequency === "weekly" && (
                  <div className="mt-3">
                  <label className={fieldLabelCls} style={mutedTextStyle}>Weekly day</label>
                  <div className="relative">
                    <select
                      value={weeklyDay}
                      onChange={(event) => setWeeklyDay(event.target.value)}
                      className={selectCls}
                      style={fieldSurfaceStyle}
                    >
                      {weekdayOptions.map((day) => (
                        <option key={day} value={day}>{titleCase(day)}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none" style={mutedTextStyle} />
                  </div>
                </div>
                )}
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                <div>
                  <label className={`${fieldLabelCls} flex items-center gap-1`} style={mutedTextStyle}>
                    Send time
                    <InfoTooltip content="The local time reviewers should receive the approval email." side="bottom" />
                  </label>
                  <div className="relative">
                    <select
                      value={sendTimeLocal}
                      onChange={(event) => setSendTimeLocal(event.target.value)}
                      className={selectCls}
                      style={fieldSurfaceStyle}
                    >
                      {sendTimeOptions.map((time) => (
                        <option key={time} value={time}>{time}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none" style={mutedTextStyle} />
                  </div>
                </div>
                <div>
                  <label className={`${fieldLabelCls} flex items-center gap-1`} style={mutedTextStyle}>
                    Timezone
                    <InfoTooltip content="The US timezone used for the approval email schedule." side="bottom" />
                  </label>
                  <div className="relative">
                    <select
                      value={timezone}
                      onChange={(event) => setTimezone(event.target.value)}
                      className={selectCls}
                      style={fieldSurfaceStyle}
                    >
                      {usTimezoneOptions.map((item) => (
                        <option key={item.value} value={item.value}>{item.label} — {item.value}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none" style={mutedTextStyle} />
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-2xl p-4" style={compactSurfaceStyle}>
            <div className="flex flex-col gap-3">
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-widest mb-1" style={subtleTextStyle}>How this works</p>
                <h3 className="text-sm font-black" style={primaryTextStyle}>Review flow</h3>
              </div>
              <ul className="list-disc pl-5 space-y-1.5">
                {safetyItems.map((item) => (
                  <li key={item} className="text-xs font-semibold leading-relaxed" style={mutedTextStyle}>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => { void handleSave(); }}
              disabled={saving || rolesLoading || rulesLoading || membersLoading}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-full text-xs font-bold text-white transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-55 disabled:cursor-not-allowed"
              style={{ backgroundColor: "#A380F6" }}
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              {saving ? "Saving..." : "Save automation"}
            </button>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
