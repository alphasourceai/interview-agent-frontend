import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, ChevronDown, Loader2, Save } from "lucide-react";
import CurrentScopeBanner from "@/components/CurrentScopeBanner";
import DashboardLayout from "@/components/DashboardLayout";
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
    help: "Permit matching when interview or overall thresholds are not part of the rule.",
  },
  require_sufficient_content: {
    label: "Require sufficient content",
    help: "Require enough candidate content before the rule can identify a candidate for approval.",
  },
};
const criteriaOrder = [
  "min_overall_score",
  "min_resume_score",
  "min_interview_score",
  "allow_resume_only",
  "require_sufficient_content",
];
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

function parseScoreValue(value: CriteriaValue | undefined): number | null {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function splitRecipientEmails(value: string): string[] {
  const seen = new Set<string>();
  const emails: string[] = [];
  value
    .split(/[\n,]+/)
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean)
    .forEach((email) => {
      if (seen.has(email)) return;
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
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [rulesLoading, setRulesLoading] = useState(false);
  const [rulesError, setRulesError] = useState("");
  const [selectedRuleId, setSelectedRuleId] = useState("");
  const [selectedRoleId, setSelectedRoleId] = useState("");
  const [saving, setSaving] = useState(false);
  const [actionNotice, setActionNotice] = useState<Notice | null>(null);
  const [ruleEnabled, setRuleEnabled] = useState(false);
  const [ruleName, setRuleName] = useState("");
  const [criteriaValues, setCriteriaValues] = useState<Record<string, CriteriaValue>>({});
  const [selectedActionType, setSelectedActionType] = useState("");
  const [schedulingUrl, setSchedulingUrl] = useState("");
  const [schedulingLabel, setSchedulingLabel] = useState("");
  const [digestEnabled, setDigestEnabled] = useState(false);
  const [recipientEmails, setRecipientEmails] = useState("");
  const [approvalBaseUrl, setApprovalBaseUrl] = useState("");
  const [timezone, setTimezone] = useState("America/Denver");
  const [sendTimeLocal, setSendTimeLocal] = useState("08:00");
  const [frequency, setFrequency] = useState("daily");
  const [weeklyDay, setWeeklyDay] = useState("monday");

  const criteriaFields = options?.criteria_config?.fields || {};
  const criteriaKeys = useMemo(() => {
    const configured = new Set(Object.keys(criteriaFields));
    return [
      ...criteriaOrder.filter((key) => configured.has(key)),
      ...Object.keys(criteriaFields).filter((key) => !criteriaOrder.includes(key)),
    ];
  }, [criteriaFields]);
  const actionTypes = options?.action_config?.action_types || [];
  const defaultActionType = actionTypes.find((item) => item.value === ACTION_TYPE_SECOND_ROUND)?.value || actionTypes[0]?.value || ACTION_TYPE_SECOND_ROUND;
  const selectedAction = actionTypes.find((item) => item.value === selectedActionType) || actionTypes[0] || null;
  const actionFields = selectedAction?.fields || {};
  const labelMaxLength = actionFields.second_round_scheduling_label?.max_length || 80;
  const digestOptions = options?.digest_config?.pending_approval_digest || {};
  const recipientLimit = digestOptions.recipient_limit || 10;
  const frequencies = digestOptions.frequencies || [];
  const weeklyDays = digestOptions.weekly_days || [];
  const sendTimeFormat = digestOptions.send_time_local_format || "HH:MM";
  const safety = options?.safety || {};
  const recipientList = useMemo(() => splitRecipientEmails(recipientEmails), [recipientEmails]);
  const recipientCount = recipientList.length;
  const numberCriteriaKeys = criteriaKeys.filter((key) => criteriaFields[key]?.type !== "boolean");
  const booleanCriteriaKeys = criteriaKeys.filter((key) => criteriaFields[key]?.type === "boolean");
  const selectedRule = rules.find((rule) => rule.id === selectedRuleId) || null;
  const isEditingSavedRule = Boolean(selectedRuleId);
  const blockingError = error || clientError;
  const isInitialLoading = loading || clientLoading;

  const resetDraftForm = useCallback((roleId = "") => {
    const nextFrequency = String(digestOptions.default_frequency || frequencies[0]?.value || "daily");
    setSelectedRuleId("");
    setSelectedRoleId(roleId);
    setRuleEnabled(false);
    setRuleName("");
    setCriteriaValues(getInitialCriteriaValues(criteriaFields));
    setSelectedActionType(defaultActionType);
    setSchedulingUrl("");
    setSchedulingLabel("");
    setDigestEnabled(false);
    setRecipientEmails("");
    setApprovalBaseUrl("");
    setTimezone(String(digestOptions.default_timezone || "America/Denver"));
    setSendTimeLocal("08:00");
    setFrequency(nextFrequency);
    setWeeklyDay(String(weeklyDays[0] || "monday"));
  }, [criteriaFields, defaultActionType, digestOptions.default_frequency, digestOptions.default_timezone, frequencies, weeklyDays]);

  const populateFormFromRule = useCallback((rule: AutomationRule) => {
    const actionConfig = isRecord(rule.action_config) ? rule.action_config : {};
    const pendingDigest = getPendingDigest(rule);
    const configuredFrequency = stringField(pendingDigest.frequency);
    const supportedFrequencies = frequencies.map((item) => item.value);
    const nextFrequency =
      configuredFrequency && (supportedFrequencies.length === 0 || supportedFrequencies.includes(configuredFrequency))
        ? configuredFrequency
        : String(digestOptions.default_frequency || frequencies[0]?.value || "daily");
    const recipientEmailsValue = Array.isArray(pendingDigest.recipient_emails)
      ? pendingDigest.recipient_emails.map((email) => String(email || "").trim()).filter(Boolean).join("\n")
      : "";

    setSelectedRuleId(rule.id);
    setSelectedRoleId(rule.role_id);
    setRuleEnabled(rule.enabled === true);
    setRuleName(rule.name || DEFAULT_RULE_NAME);
    setCriteriaValues(criteriaValuesFromRule(criteriaFields, rule));
    setSelectedActionType(defaultActionType);
    setSchedulingUrl(stringField(actionConfig.second_round_scheduling_url));
    setSchedulingLabel(stringField(actionConfig.second_round_scheduling_label).slice(0, labelMaxLength));
    setDigestEnabled(pendingDigest.enabled === true);
    setRecipientEmails(recipientEmailsValue);
    setApprovalBaseUrl(stringField(pendingDigest.approval_base_url));
    setTimezone(stringField(pendingDigest.timezone) || String(digestOptions.default_timezone || "America/Denver"));
    setSendTimeLocal(stringField(pendingDigest.send_time_local) || "08:00");
    setFrequency(nextFrequency);
    setWeeklyDay(stringField(pendingDigest.weekly_day) || String(weeklyDays[0] || "monday"));
  }, [criteriaFields, defaultActionType, digestOptions.default_frequency, digestOptions.default_timezone, frequencies, labelMaxLength, weeklyDays]);

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
      const parsedFrequencies = parsedDigestOptions.frequencies || [];
      const parsedWeeklyDays = parsedDigestOptions.weekly_days || [];

      setOptions(parsed);
      setCriteriaValues(getInitialCriteriaValues(parsedCriteriaFields));
      setSelectedActionType(parsedActionTypes.find((item) => item.value === ACTION_TYPE_SECOND_ROUND)?.value || parsedActionTypes[0]?.value || ACTION_TYPE_SECOND_ROUND);
      setTimezone(String(parsedDigestOptions.default_timezone || "America/Denver"));
      setFrequency(String(parsedDigestOptions.default_frequency || parsedFrequencies[0]?.value || "daily"));
      setWeeklyDay(String(parsedWeeklyDays[0] || "monday"));
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
        if (!response.ok) throw new Error(extractErrorMessage(text, "Failed to load automation rules."));

        if (!alive) return;
        setRules(toAutomationRules(parseJsonSafe(text)));
      } catch (loadError) {
        if (!alive) return;
        setRules([]);
        setRulesError(loadError instanceof Error ? loadError.message : "Failed to load automation rules.");
      } finally {
        if (alive) setRulesLoading(false);
      }
    };

    void loadRules();
    return () => {
      alive = false;
    };
  }, [clientError, clientLoading, selectedClientId]);

  const validateForm = () => {
    const normalizedName = collapseWhitespace(ruleName);
    if (!selectedClientId) return { error: "Select a client before saving an automation rule." };
    if (!selectedRoleId) return { error: "Select a role before saving an automation rule." };
    if (!normalizedName) return { error: "Rule name is required." };

    for (const key of scoreCriteriaKeys) {
      const parsed = parseScoreValue(criteriaValues[key]);
      if (Number.isNaN(parsed) || (parsed !== null && (parsed < 0 || parsed > 100))) {
        const label = criteriaLabels[key]?.label || titleCase(key);
        return { error: `${label} must be blank or a number from 0 to 100.` };
      }
    }

    if (!isValidHttpUrl(schedulingUrl)) {
      return { error: "Scheduling URL must be blank or a valid http/https URL." };
    }
    if (!isValidHttpUrl(approvalBaseUrl)) {
      return { error: "Approval base URL must be blank or a valid http/https URL." };
    }

    const invalidEmail = recipientList.find((email) => !isValidEmail(email));
    if (invalidEmail) return { error: `Recipient email is invalid: ${invalidEmail}` };
    if (recipientList.length > recipientLimit) {
      return { error: `Recipient emails must include ${recipientLimit} or fewer addresses.` };
    }

    if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(sendTimeLocal)) {
      return { error: "Send time must use HH:MM 24-hour format." };
    }

    const supportedFrequencies = frequencies.map((item) => item.value).filter(Boolean);
    const allowedFrequencies = supportedFrequencies.length > 0 ? supportedFrequencies : ["daily"];
    if (!allowedFrequencies.includes(frequency)) {
      return { error: "Frequency is not supported by the backend." };
    }
    if (frequency === "weekly") {
      if (!weeklyDay) return { error: "Weekly day is required when frequency is weekly." };
      if (weeklyDays.length > 0 && !weeklyDays.includes(weeklyDay)) {
        return { error: "Weekly day is not supported by the backend." };
      }
    }

    return { error: "", normalizedName };
  };

  const buildPayload = (normalizedName: string) => {
    const criteria_config = {
      min_overall_score: parseScoreValue(criteriaValues.min_overall_score),
      min_resume_score: parseScoreValue(criteriaValues.min_resume_score),
      min_interview_score: parseScoreValue(criteriaValues.min_interview_score),
      allow_resume_only: criteriaValues.allow_resume_only === true,
      require_sufficient_content: criteriaValues.require_sufficient_content === undefined
        ? true
        : criteriaValues.require_sufficient_content === true,
    };
    const pendingApprovalDigest: Record<string, unknown> = {
      enabled: digestEnabled,
      recipient_emails: recipientList,
      approval_base_url: approvalBaseUrl.trim(),
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
      setActionNotice({ tone: "error", text: validation.error || "Automation rule could not be saved." });
      return;
    }
    if (!backendBase) {
      setActionNotice({ tone: "error", text: "Missing backend base URL configuration." });
      return;
    }

    setSaving(true);
    try {
      const token = await getSessionToken();
      const basePayload = buildPayload(validation.normalizedName);
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
      if (!response.ok) throw new Error(extractErrorMessage(text, "Failed to save automation rule."));

      const savedRule = toSavedRule(parseJsonSafe(text));
      if (!savedRule) throw new Error("Automation rule save response was not recognized.");

      setRules((current) => {
        const exists = current.some((rule) => rule.id === savedRule.id);
        if (exists) return current.map((rule) => (rule.id === savedRule.id ? savedRule : rule));
        return [savedRule, ...current];
      });
      populateFormFromRule(savedRule);
      setActionNotice({
        tone: "success",
        text: isPatch ? "Automation rule saved." : "Automation rule created.",
      });
    } catch (saveError) {
      setActionNotice({
        tone: "error",
        text: saveError instanceof Error ? saveError.message : "Failed to save automation rule.",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleRuleSelection = (ruleId: string) => {
    setActionNotice(null);
    if (!ruleId) {
      resetDraftForm(selectedRoleId);
      return;
    }
    const rule = rules.find((item) => item.id === ruleId);
    if (rule) populateFormFromRule(rule);
  };

  const handleRoleSelection = (roleId: string) => {
    setActionNotice(null);
    if (isEditingSavedRule) return;
    setSelectedRoleId(roleId);
  };

  const renderNumberCriteria = (key: string, field: ConfigField) => {
    const copy = criteriaLabels[key] || {
      label: titleCase(key),
      help: "Backend-supported rule threshold.",
    };
    const bounds = numericFieldBounds(field);
    return (
      <div key={key}>
        <label className={fieldLabelCls} style={mutedTextStyle}>
          {copy.label}
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
      help: "Backend-supported rule option.",
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

  type SafetyKey = keyof NonNullable<AutomationConfigOptions["safety"]>;
  const safetyItems: Array<{ key?: SafetyKey; text: string }> = [
    {
      text: "Saving a rule does not email candidates.",
    },
    {
      key: "digest_requires_approval",
      text: "Matched candidates are routed for internal approval.",
    },
    {
      key: "candidate_email_send_is_manual_after_approval",
      text: "Candidate-facing outreach remains manual after approval.",
    },
    {
      key: "scheduler_send_requires_env_flag",
      text: "Scheduler controls are not available on this page.",
    },
  ];

  return (
    <DashboardLayout title="Automation">
      <CurrentScopeBanner client={selectedClient} />

      <div className="mb-5">
        <div className="max-w-3xl">
          <p className="text-[10px] font-black uppercase tracking-widest mb-1" style={subtleTextStyle}>
            Candidate Automation
          </p>
          <h2 className="text-2xl font-black leading-tight mb-3" style={primaryTextStyle}>
            Automation
          </h2>
          <p className="text-sm leading-relaxed" style={mutedTextStyle}>
            Configure supported rule options for identifying candidates for internal approval. Saving a rule does not email candidates.
          </p>
        </div>
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

          {rules.length > 0 && (
            <section className="rounded-2xl p-4" style={compactSurfaceStyle}>
              <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] md:items-end">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest mb-1" style={subtleTextStyle}>Saved rules</p>
                  <p className="text-sm font-black" style={primaryTextStyle}>
                    {rules.length} rule{rules.length === 1 ? "" : "s"}
                  </p>
                </div>
                <div>
                  <label className={fieldLabelCls} style={mutedTextStyle}>Rule</label>
                  <div className="relative">
                    <select
                      value={selectedRuleId}
                      onChange={(event) => handleRuleSelection(event.target.value)}
                      className={selectCls}
                      style={fieldSurfaceStyle}
                      disabled={rulesLoading}
                    >
                      <option value="">Create a new rule</option>
                      {rules.map((rule) => {
                        const roleTitle = roles.find((role) => role.id === rule.role_id)?.title || "Unknown role";
                        return (
                          <option key={rule.id} value={rule.id}>
                            {rule.name} - {roleTitle}
                          </option>
                        );
                      })}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none" style={mutedTextStyle} />
                  </div>
                </div>
              </div>
            </section>
          )}

          {(rolesError || rulesError) && (
            <div className={`${noticeCls} ${errorNoticeCls}`} role="status" aria-live="polite">
              {rolesError || rulesError}
            </div>
          )}

          <section className="rounded-2xl p-5" style={surfaceCardStyle}>
            <div className="flex flex-col gap-1 mb-4">
              <p className="text-[10px] font-black uppercase tracking-widest" style={subtleTextStyle}>Rule setup</p>
              <h3 className="text-base font-black" style={primaryTextStyle}>
                {selectedRule ? "Edit automation rule" : "Create automation rule"}
              </h3>
              {selectedRule?.updated_at && (
                <p className="text-[11px] font-semibold" style={subtleTextStyle}>
                  Last updated {formatDate(selectedRule.updated_at)}
                </p>
              )}
            </div>
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1.4fr)_minmax(0,1fr)]">
              <div>
                <label className={fieldLabelCls} style={mutedTextStyle}>Role</label>
                <div className="relative">
                  <select
                    value={selectedRoleId}
                    onChange={(event) => handleRoleSelection(event.target.value)}
                    className={selectCls}
                    style={fieldSurfaceStyle}
                    disabled={rolesLoading || rulesLoading || isEditingSavedRule}
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
                  {isEditingSavedRule ? "Role is fixed for saved rules." : "Select the role this new rule will target."}
                </p>
              </div>
              <div>
                <label className={fieldLabelCls} style={mutedTextStyle}>Rule name</label>
                <input
                  type="text"
                  value={ruleName}
                  onChange={(event) => setRuleName(event.target.value)}
                  placeholder="Second-round approval rule"
                  className={inputCls}
                  style={fieldSurfaceStyle}
                />
              </div>
              <label className="rounded-xl border px-3 py-2.5 flex items-start gap-2.5 cursor-pointer" style={mutedPanelStyle}>
                <input
                  type="checkbox"
                  checked={ruleEnabled}
                  onChange={(event) => setRuleEnabled(event.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-gray-300 text-[#A380F6] focus:ring-[#A380F6]"
                />
                <span>
                  <span className="block text-xs font-black" style={primaryTextStyle}>Automation enabled</span>
                  <span className="block text-[11px] mt-0.5" style={mutedTextStyle}>
                    {isEditingSavedRule ? "Saved rule configuration." : "Ready to save for this role."}
                  </span>
                </span>
              </label>
            </div>
          </section>

          <section className="rounded-2xl p-5" style={surfaceCardStyle}>
            <div className="flex flex-col gap-1 mb-4">
              <p className="text-[10px] font-black uppercase tracking-widest" style={subtleTextStyle}>Candidate criteria</p>
              <h3 className="text-base font-black" style={primaryTextStyle}>Matching thresholds</h3>
            </div>
            {criteriaKeys.length === 0 ? (
              <div className="rounded-xl border px-4 py-5 text-center text-sm font-semibold" style={mutedPanelStyle}>
                <span style={mutedTextStyle}>No rule criteria options were returned.</span>
              </div>
            ) : (
              <div className="space-y-3">
                {numberCriteriaKeys.length > 0 && (
                  <div className="grid gap-3 md:grid-cols-3">
                    {numberCriteriaKeys.map((key) => renderNumberCriteria(key, criteriaFields[key]))}
                  </div>
                )}
                {booleanCriteriaKeys.length > 0 && (
                  <div className="grid gap-2 md:grid-cols-2">
                    {booleanCriteriaKeys.map((key) => renderBooleanCriteria(key))}
                  </div>
                )}
              </div>
            )}
          </section>

          <section className="rounded-2xl p-5" style={surfaceCardStyle}>
            <div className="flex flex-col gap-1 mb-4">
              <p className="text-[10px] font-black uppercase tracking-widest" style={subtleTextStyle}>Approval workflow</p>
              <h3 className="text-base font-black" style={primaryTextStyle}>Action and digest settings</h3>
              <p className="text-xs leading-relaxed" style={mutedTextStyle}>
                Matched candidates are routed for internal approval. Candidate-facing outreach remains manual after approval.
              </p>
            </div>
            <div className="grid gap-3 lg:grid-cols-3">
              <div>
                <label className={fieldLabelCls} style={mutedTextStyle}>Action type</label>
                <div className="relative">
                  <select
                    value={selectedActionType}
                    onChange={(event) => setSelectedActionType(event.target.value)}
                    className={selectCls}
                    style={fieldSurfaceStyle}
                  >
                    {actionTypes.length === 0 ? (
                      <option value={ACTION_TYPE_SECOND_ROUND}>Second-round scheduling email</option>
                    ) : (
                      actionTypes.map((action) => (
                        <option key={action.value} value={action.value}>{action.label}</option>
                      ))
                    )}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none" style={mutedTextStyle} />
                </div>
              </div>
              <div>
                <label className={fieldLabelCls} style={mutedTextStyle}>Scheduling URL</label>
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
                <label className={fieldLabelCls} style={mutedTextStyle}>Scheduling label</label>
                <input
                  type="text"
                  value={schedulingLabel}
                  onChange={(event) => setSchedulingLabel(event.target.value.slice(0, labelMaxLength))}
                  maxLength={labelMaxLength}
                  placeholder="Schedule next interview"
                  className={inputCls}
                  style={fieldSurfaceStyle}
                />
                <p className="mt-1 text-[10px] font-semibold" style={subtleTextStyle}>
                  {schedulingLabel.length}/{labelMaxLength}
                </p>
              </div>
            </div>

            <div className="my-4 border-t" style={{ borderColor: "var(--as-border)" }} />

            <div className="grid gap-3 lg:grid-cols-3">
              <label className="rounded-xl border px-3 py-2.5 flex items-start gap-2.5 cursor-pointer" style={mutedPanelStyle}>
                <input
                  type="checkbox"
                  checked={digestEnabled}
                  onChange={(event) => setDigestEnabled(event.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-gray-300 text-[#A380F6] focus:ring-[#A380F6]"
                />
                <span>
                  <span className="block text-xs font-black" style={primaryTextStyle}>Approval digest enabled</span>
                  <span className="block text-[11px] mt-0.5" style={mutedTextStyle}>Grouped internal approval summaries.</span>
                </span>
              </label>
              <div className="lg:col-span-2">
                <label className={fieldLabelCls} style={mutedTextStyle}>Recipient emails</label>
                <textarea
                  value={recipientEmails}
                  onChange={(event) => setRecipientEmails(event.target.value)}
                  placeholder="manager@example.com"
                  rows={2}
                  className={inputCls}
                  style={fieldSurfaceStyle}
                />
                <p className="mt-1 text-[10px] font-semibold" style={recipientCount > recipientLimit ? { color: "#EF4444" } : subtleTextStyle}>
                  {recipientCount}/{recipientLimit} recipients
                </p>
              </div>
              <div>
                <label className={fieldLabelCls} style={mutedTextStyle}>Approval base URL</label>
                <input
                  type="url"
                  value={approvalBaseUrl}
                  onChange={(event) => setApprovalBaseUrl(event.target.value)}
                  placeholder="https://app.alphasourceai.com"
                  className={inputCls}
                  style={fieldSurfaceStyle}
                />
              </div>
              <div>
                <label className={fieldLabelCls} style={mutedTextStyle}>Timezone</label>
                <input
                  type="text"
                  value={timezone}
                  onChange={(event) => setTimezone(event.target.value)}
                  className={inputCls}
                  style={fieldSurfaceStyle}
                />
              </div>
              <div>
                <label className={fieldLabelCls} style={mutedTextStyle}>Send time</label>
                <input
                  type="time"
                  value={sendTimeLocal}
                  onChange={(event) => setSendTimeLocal(event.target.value)}
                  className={inputCls}
                  style={fieldSurfaceStyle}
                />
                <p className="mt-1 text-[10px] font-semibold" style={subtleTextStyle}>{sendTimeFormat}</p>
              </div>
              <div>
                <label className={fieldLabelCls} style={mutedTextStyle}>Frequency</label>
                <div className="relative">
                  <select
                    value={frequency}
                    onChange={(event) => setFrequency(event.target.value)}
                    className={selectCls}
                    style={fieldSurfaceStyle}
                  >
                    {frequencies.length === 0 ? (
                      <option value="daily">Daily</option>
                    ) : (
                      frequencies.map((item) => (
                        <option key={item.value} value={item.value}>{item.label}</option>
                      ))
                    )}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none" style={mutedTextStyle} />
                </div>
              </div>
              {frequency === "weekly" && (
                <div>
                  <label className={fieldLabelCls} style={mutedTextStyle}>Weekly day</label>
                  <div className="relative">
                    <select
                      value={weeklyDay}
                      onChange={(event) => setWeeklyDay(event.target.value)}
                      className={selectCls}
                      style={fieldSurfaceStyle}
                    >
                      {weeklyDays.length === 0 ? (
                        <option value="">No weekly days available</option>
                      ) : (
                        weeklyDays.map((day) => (
                          <option key={day} value={day}>{titleCase(day)}</option>
                        ))
                      )}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none" style={mutedTextStyle} />
                  </div>
                </div>
              )}
            </div>
          </section>

          <section className="rounded-2xl p-4" style={compactSurfaceStyle}>
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-widest mb-1" style={subtleTextStyle}>Safety</p>
                <h3 className="text-sm font-black" style={primaryTextStyle}>Workflow guardrails</h3>
              </div>
              <ul className="grid flex-1 gap-2 md:grid-cols-2">
                {safetyItems.map((item) => (
                  <li key={item.text} className="flex items-start gap-2 text-xs font-semibold leading-relaxed" style={mutedTextStyle}>
                    <CheckCircle2
                      className="h-3.5 w-3.5 mt-0.5 flex-shrink-0"
                      style={{ color: item.key && safety[item.key] === false ? "var(--as-text-subtle)" : "#02D99D" }}
                    />
                    {item.text}
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => { void handleSave(); }}
              disabled={saving || rolesLoading || rulesLoading}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-full text-xs font-bold text-white transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-55 disabled:cursor-not-allowed"
              style={{ backgroundColor: "#A380F6" }}
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              {saving ? "Saving..." : "Save automation rule"}
            </button>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
