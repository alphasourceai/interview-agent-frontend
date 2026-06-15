import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, ChevronDown, Loader2, ShieldCheck, Workflow } from "lucide-react";
import CurrentScopeBanner from "@/components/CurrentScopeBanner";
import DashboardLayout from "@/components/DashboardLayout";
import { useClient } from "@/context/ClientContext";
import { supabase } from "@/lib/supabaseClient";

type CriteriaValue = string | boolean;

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
  return next;
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
  const { selectedClient } = useClient();
  const [options, setOptions] = useState<AutomationConfigOptions | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
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

      const criteriaFields = parsed.criteria_config?.fields || {};
      const actionTypes = parsed.action_config?.action_types || [];
      const digestOptions = parsed.digest_config?.pending_approval_digest || {};
      const frequencies = digestOptions.frequencies || [];
      const weeklyDays = digestOptions.weekly_days || [];

      setOptions(parsed);
      setCriteriaValues(getInitialCriteriaValues(criteriaFields));
      setSelectedActionType(actionTypes[0]?.value || "");
      setTimezone(String(digestOptions.default_timezone || "America/Denver"));
      setFrequency(String(digestOptions.default_frequency || frequencies[0]?.value || "daily"));
      setWeeklyDay(String(weeklyDays[0] || "monday"));
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

  const criteriaFields = options?.criteria_config?.fields || {};
  const criteriaKeys = useMemo(() => {
    const configured = new Set(Object.keys(criteriaFields));
    return [
      ...criteriaOrder.filter((key) => configured.has(key)),
      ...Object.keys(criteriaFields).filter((key) => !criteriaOrder.includes(key)),
    ];
  }, [criteriaFields]);
  const actionTypes = options?.action_config?.action_types || [];
  const selectedAction = actionTypes.find((item) => item.value === selectedActionType) || actionTypes[0] || null;
  const actionFields = selectedAction?.fields || {};
  const labelMaxLength = actionFields.second_round_scheduling_label?.max_length || 80;
  const digestOptions = options?.digest_config?.pending_approval_digest || {};
  const recipientLimit = digestOptions.recipient_limit || 10;
  const frequencies = digestOptions.frequencies || [];
  const weeklyDays = digestOptions.weekly_days || [];
  const sendTimeFormat = digestOptions.send_time_local_format || "HH:MM";
  const safety = options?.safety || {};
  const recipientCount = recipientEmails
    .split(/[\n,]+/)
    .map((email) => email.trim())
    .filter(Boolean).length;

  const renderCriteriaInput = (key: string, field: ConfigField) => {
    const copy = criteriaLabels[key] || {
      label: titleCase(key),
      help: "Backend-supported rule field.",
    };
    if (field.type === "boolean") {
      return (
        <label
          key={key}
          className="rounded-xl border p-4 flex items-start gap-3 cursor-pointer"
          style={mutedPanelStyle}
        >
          <input
            type="checkbox"
            checked={Boolean(criteriaValues[key])}
            onChange={(event) => setCriteriaValues((prev) => ({ ...prev, [key]: event.target.checked }))}
            className="mt-1 h-4 w-4 rounded border-gray-300 text-[#A380F6] focus:ring-[#A380F6]"
          />
          <span className="min-w-0">
            <span className="block text-sm font-black" style={primaryTextStyle}>{copy.label}</span>
            <span className="block text-xs leading-relaxed mt-1" style={mutedTextStyle}>{copy.help}</span>
          </span>
        </label>
      );
    }

    const bounds = numericFieldBounds(field);
    return (
      <div key={key} className="rounded-xl border p-4" style={mutedPanelStyle}>
        <label className="block text-[10px] font-black uppercase tracking-widest mb-1.5" style={mutedTextStyle}>
          {copy.label}
        </label>
        <input
          type="number"
          min={bounds.min}
          max={bounds.max}
          value={String(criteriaValues[key] ?? "")}
          onChange={(event) => setCriteriaValues((prev) => ({ ...prev, [key]: event.target.value }))}
          placeholder="No threshold"
          className="w-full px-4 py-2.5 rounded-xl border text-sm placeholder-gray-400 dark:placeholder:text-slate-400/45 focus:outline-none focus:ring-2 focus:ring-[#A380F6]/25 focus:border-[#A380F6] transition-all"
          style={fieldSurfaceStyle}
        />
        <p className="text-xs leading-relaxed mt-2" style={subtleTextStyle}>
          {copy.help} Supported range: {bounds.min}-{bounds.max}.
        </p>
      </div>
    );
  };

  const safetyItems = [
    {
      key: "digest_requires_approval" as const,
      title: "Approval required",
      body: "Matched candidates are routed for internal approval before candidate-facing outreach.",
    },
    {
      key: "digest_aggregates_by_recipient" as const,
      title: "Digest groups by recipient",
      body: "Pending approval items are grouped into one digest per recipient where supported.",
    },
    {
      key: "scheduler_send_requires_env_flag" as const,
      title: "Scheduler controls unavailable",
      body: "Scheduled sending is controlled outside this dashboard and is not exposed on this page.",
    },
    {
      key: "candidate_email_send_is_manual_after_approval" as const,
      title: "Candidate outreach stays controlled",
      body: "Candidate email sending remains a manual post-approval action.",
    },
  ];

  return (
    <DashboardLayout title="Automation">
      <CurrentScopeBanner client={selectedClient} />

      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div className="max-w-3xl">
          <p className="text-[10px] font-black uppercase tracking-widest mb-1" style={subtleTextStyle}>
            Candidate Automation
          </p>
          <h2 className="text-2xl font-black leading-tight mb-3" style={primaryTextStyle}>
            Automation
          </h2>
          <p className="text-sm leading-relaxed" style={mutedTextStyle}>
            Configure frontend-ready automation rule options for identifying candidates for internal approval before any candidate-facing action is sent.
          </p>
        </div>
        <div
          className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-black"
          style={{ backgroundColor: "rgba(163,128,246,0.12)", color: "#7C5FCC" }}
        >
          <Workflow className="h-4 w-4" />
          Foundation preview
        </div>
      </div>

      {loading && (
        <div className="rounded-2xl p-6 mb-5 flex items-center gap-3" style={surfaceCardStyle}>
          <Loader2 className="h-4 w-4 animate-spin text-[#A380F6]" />
          <p className="text-sm font-semibold" style={mutedTextStyle}>Loading automation options...</p>
        </div>
      )}

      {!loading && error && (
        <div className="rounded-2xl p-6 mb-5" style={surfaceCardStyle}>
          <p className="text-sm font-bold text-red-500 mb-3">{error}</p>
          <button
            type="button"
            onClick={() => { void loadOptions(); }}
            className="px-4 py-2 rounded-full text-xs font-bold text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: "#A380F6" }}
          >
            Retry
          </button>
        </div>
      )}

      {!loading && !error && (
        <>
          <section className="rounded-2xl p-6 mb-5" style={surfaceCardStyle}>
            <div className="flex flex-col gap-1 mb-5">
              <p className="text-[10px] font-black uppercase tracking-widest" style={subtleTextStyle}>
                Rule Criteria
              </p>
              <h3 className="text-base font-black" style={primaryTextStyle}>Candidate matching thresholds</h3>
              <p className="text-sm leading-relaxed" style={mutedTextStyle}>
                These local controls mirror backend-supported criteria. Saving is intentionally disabled in this phase.
              </p>
            </div>
            {criteriaKeys.length === 0 ? (
              <div className="rounded-xl border px-4 py-6 text-center text-sm font-semibold" style={mutedPanelStyle}>
                <span style={mutedTextStyle}>No rule criteria options were returned.</span>
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {criteriaKeys.map((key) => renderCriteriaInput(key, criteriaFields[key]))}
              </div>
            )}
          </section>

          <section className="rounded-2xl p-6 mb-5" style={surfaceCardStyle}>
            <div className="flex flex-col gap-1 mb-5">
              <p className="text-[10px] font-black uppercase tracking-widest" style={subtleTextStyle}>
                Second-Round Action
              </p>
              <h3 className="text-base font-black" style={primaryTextStyle}>Internal approval action setup</h3>
              <p className="text-sm leading-relaxed" style={mutedTextStyle}>
                This section prepares action configuration only. It does not send scheduling emails.
              </p>
            </div>
            <div className="grid gap-4 lg:grid-cols-3">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest mb-1.5" style={mutedTextStyle}>
                  Action type
                </label>
                <div className="relative">
                  <select
                    value={selectedActionType}
                    onChange={(event) => setSelectedActionType(event.target.value)}
                    className="w-full appearance-none px-4 py-2.5 rounded-xl border text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#A380F6]/25 focus:border-[#A380F6] transition-all cursor-pointer pr-9"
                    style={fieldSurfaceStyle}
                  >
                    {actionTypes.length === 0 ? (
                      <option value="">No action types available</option>
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
                <label className="block text-[10px] font-black uppercase tracking-widest mb-1.5" style={mutedTextStyle}>
                  Scheduling URL
                </label>
                <input
                  type="url"
                  value={schedulingUrl}
                  onChange={(event) => setSchedulingUrl(event.target.value)}
                  placeholder="https://..."
                  className="w-full px-4 py-2.5 rounded-xl border text-sm placeholder-gray-400 dark:placeholder:text-slate-400/45 focus:outline-none focus:ring-2 focus:ring-[#A380F6]/25 focus:border-[#A380F6] transition-all"
                  style={fieldSurfaceStyle}
                />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest mb-1.5" style={mutedTextStyle}>
                  Scheduling label
                </label>
                <input
                  type="text"
                  value={schedulingLabel}
                  onChange={(event) => setSchedulingLabel(event.target.value.slice(0, labelMaxLength))}
                  maxLength={labelMaxLength}
                  placeholder="Schedule next interview"
                  className="w-full px-4 py-2.5 rounded-xl border text-sm placeholder-gray-400 dark:placeholder:text-slate-400/45 focus:outline-none focus:ring-2 focus:ring-[#A380F6]/25 focus:border-[#A380F6] transition-all"
                  style={fieldSurfaceStyle}
                />
                <p className="mt-1 text-[10px] font-semibold" style={subtleTextStyle}>
                  {schedulingLabel.length}/{labelMaxLength} characters
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-2xl p-6 mb-5" style={surfaceCardStyle}>
            <div className="flex flex-col gap-1 mb-5">
              <p className="text-[10px] font-black uppercase tracking-widest" style={subtleTextStyle}>
                Approval Digest
              </p>
              <h3 className="text-base font-black" style={primaryTextStyle}>Internal approval digest configuration</h3>
              <p className="text-sm leading-relaxed" style={mutedTextStyle}>
                Configure how internal approval digests should be prepared. This page does not expose scheduler controls.
              </p>
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <label className="rounded-xl border p-4 flex items-start gap-3 cursor-pointer" style={mutedPanelStyle}>
                <input
                  type="checkbox"
                  checked={digestEnabled}
                  onChange={(event) => setDigestEnabled(event.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-gray-300 text-[#A380F6] focus:ring-[#A380F6]"
                />
                <span>
                  <span className="block text-sm font-black" style={primaryTextStyle}>Enable pending approval digest</span>
                  <span className="block text-xs leading-relaxed mt-1" style={mutedTextStyle}>
                    Prepare grouped internal approval summaries for configured recipients.
                  </span>
                </span>
              </label>
              <div className="rounded-xl border p-4" style={mutedPanelStyle}>
                <label className="block text-[10px] font-black uppercase tracking-widest mb-1.5" style={mutedTextStyle}>
                  Recipient emails
                </label>
                <textarea
                  value={recipientEmails}
                  onChange={(event) => setRecipientEmails(event.target.value)}
                  placeholder="manager@example.com"
                  rows={4}
                  className="w-full px-4 py-2.5 rounded-xl border text-sm placeholder-gray-400 dark:placeholder:text-slate-400/45 focus:outline-none focus:ring-2 focus:ring-[#A380F6]/25 focus:border-[#A380F6] transition-all"
                  style={fieldSurfaceStyle}
                />
                <p className="mt-1 text-[10px] font-semibold" style={recipientCount > recipientLimit ? { color: "#EF4444" } : subtleTextStyle}>
                  {recipientCount}/{recipientLimit} recipients
                </p>
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest mb-1.5" style={mutedTextStyle}>
                  Approval base URL
                </label>
                <input
                  type="url"
                  value={approvalBaseUrl}
                  onChange={(event) => setApprovalBaseUrl(event.target.value)}
                  placeholder="https://app.alphasourceai.com"
                  className="w-full px-4 py-2.5 rounded-xl border text-sm placeholder-gray-400 dark:placeholder:text-slate-400/45 focus:outline-none focus:ring-2 focus:ring-[#A380F6]/25 focus:border-[#A380F6] transition-all"
                  style={fieldSurfaceStyle}
                />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest mb-1.5" style={mutedTextStyle}>
                  Timezone
                </label>
                <input
                  type="text"
                  value={timezone}
                  onChange={(event) => setTimezone(event.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border text-sm placeholder-gray-400 dark:placeholder:text-slate-400/45 focus:outline-none focus:ring-2 focus:ring-[#A380F6]/25 focus:border-[#A380F6] transition-all"
                  style={fieldSurfaceStyle}
                />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest mb-1.5" style={mutedTextStyle}>
                  Send time
                </label>
                <input
                  type="time"
                  value={sendTimeLocal}
                  onChange={(event) => setSendTimeLocal(event.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-[#A380F6]/25 focus:border-[#A380F6] transition-all"
                  style={fieldSurfaceStyle}
                />
                <p className="mt-1 text-[10px] font-semibold" style={subtleTextStyle}>Expected format: {sendTimeFormat}</p>
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest mb-1.5" style={mutedTextStyle}>
                  Frequency
                </label>
                <div className="relative">
                  <select
                    value={frequency}
                    onChange={(event) => setFrequency(event.target.value)}
                    className="w-full appearance-none px-4 py-2.5 rounded-xl border text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#A380F6]/25 focus:border-[#A380F6] transition-all cursor-pointer pr-9"
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
                  <label className="block text-[10px] font-black uppercase tracking-widest mb-1.5" style={mutedTextStyle}>
                    Weekly day
                  </label>
                  <div className="relative">
                    <select
                      value={weeklyDay}
                      onChange={(event) => setWeeklyDay(event.target.value)}
                      className="w-full appearance-none px-4 py-2.5 rounded-xl border text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#A380F6]/25 focus:border-[#A380F6] transition-all cursor-pointer pr-9"
                      style={fieldSurfaceStyle}
                    >
                      {weeklyDays.map((day) => (
                        <option key={day} value={day}>{titleCase(day)}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none" style={mutedTextStyle} />
                  </div>
                </div>
              )}
            </div>
          </section>

          <section className="rounded-2xl p-6 mb-5" style={surfaceCardStyle}>
            <div className="flex items-start gap-3 mb-5">
              <div className="rounded-xl p-2" style={{ backgroundColor: "rgba(2,217,157,0.12)", color: "#009E73" }}>
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest" style={subtleTextStyle}>Safety</p>
                <h3 className="text-base font-black" style={primaryTextStyle}>Built-in workflow guardrails</h3>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {safetyItems.map((item) => (
                <div key={item.key} className="rounded-xl border p-4 flex gap-3" style={compactSurfaceStyle}>
                  <CheckCircle2
                    className="h-4 w-4 mt-0.5 flex-shrink-0"
                    style={{ color: safety[item.key] === false ? "var(--as-text-subtle)" : "#02D99D" }}
                  />
                  <div>
                    <h4 className="text-sm font-black mb-1" style={primaryTextStyle}>{item.title}</h4>
                    <p className="text-xs leading-relaxed" style={mutedTextStyle}>{item.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <div className="rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3" style={compactSurfaceStyle}>
            <p className="text-sm font-semibold leading-relaxed" style={mutedTextStyle}>
              Rule saving will be enabled in the next phase. Changes on this page are local only.
            </p>
            <button
              type="button"
              disabled
              className="px-5 py-2.5 rounded-full text-xs font-black cursor-not-allowed opacity-70"
              style={{ backgroundColor: "var(--as-surface-muted)", color: "var(--as-text-subtle)" }}
            >
              Saving coming next
            </button>
          </div>
        </>
      )}
    </DashboardLayout>
  );
}
