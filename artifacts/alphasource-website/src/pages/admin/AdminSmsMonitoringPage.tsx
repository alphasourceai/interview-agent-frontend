import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Activity,
  AlertTriangle,
  Ban,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  MessageSquareText,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  XCircle,
} from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import AdminLayout from "@/components/AdminLayout";
import { useAdminClient } from "@/context/AdminClientContext";
import { supabase } from "@/lib/supabaseClient";

type TimeRange = "24h" | "7d" | "30d";
type CountMap = Record<string, number>;

interface MonitoringPayload {
  generated_at?: string;
  range?: TimeRange;
  scope?: "platform" | "client";
  delivery?: {
    requested?: number;
    accepted?: number;
    sent?: number;
    delivered?: number;
    failed?: number;
    pending?: number;
    delivery_rate_pct?: number;
    by_status?: CountMap;
    trend?: Array<{ date?: string; requested?: number; delivered?: number; failed?: number }>;
  };
  consent?: {
    selected?: number;
    accepted_without_selection_evidence?: number;
    version_counts?: Array<{ version?: string; count?: number }>;
  };
  suppressions?: {
    active?: number;
    released?: number;
    opted_out?: number;
    admin_blocked?: number;
    provider_blocked?: number;
    abuse_blocked?: number;
  };
  spend?: {
    available?: boolean;
    today_counted_cents?: number;
    today_counted_attempts?: number;
    released_in_range?: number;
  };
  line_type?: {
    available?: boolean;
    mobile?: number;
    landline?: number;
    voip?: number;
    unknown?: number;
    expired?: number;
  };
  inbound?: {
    available?: boolean;
    stop?: number;
    start?: number;
    help?: number;
  };
  provider_breakers?: { available?: boolean; active?: number; released?: number };
  incidents?: Array<{
    occurred_at?: string;
    provider?: string;
    delivery_status?: string;
    failure_category?: string;
  }>;
  capabilities?: {
    spend_monitoring?: boolean;
    line_type_monitoring?: boolean;
    inbound_control_monitoring?: boolean;
    provider_breaker_monitoring?: boolean;
  };
  runtime?: {
    delivery_enabled?: boolean;
    candidate_ui_enabled?: boolean;
    environment?: string;
    provider?: string;
    sender_configured?: boolean;
    outbound_credentials_configured?: boolean;
    delivery_webhook_signing_configured?: boolean;
    inbound_webhook_signing_configured?: boolean;
    inbound_webhook_secret_configured?: boolean;
    lookup_enabled?: boolean;
    lookup_provider?: string;
    spend_cap_cents?: number | null;
    abuse_secret_configured?: boolean;
    consent_copy_version?: string | null;
    allowed_countries?: string[];
    compliance_review?: {
      status?: "approved" | "pending" | "not_recorded";
      version?: string | null;
      reviewed_at?: string | null;
      legal_review_required?: boolean;
    };
  };
}

const env = typeof import.meta !== "undefined" && import.meta.env ? import.meta.env : {};
const backendBase = String(
  (env as Record<string, unknown>).VITE_BACKEND_URL ||
  (env as Record<string, unknown>).VITE_API_URL ||
  (env as Record<string, unknown>).VITE_PUBLIC_BACKEND_URL ||
  (env as Record<string, unknown>).PUBLIC_BACKEND_URL ||
  (env as Record<string, unknown>).BACKEND_URL ||
  "",
).trim().replace(/\/+$/, "");

const surfaceStyle = { background: "var(--as-surface)", borderColor: "var(--as-border)" };
const textStyle = { color: "var(--as-text)" };
const mutedTextStyle = { color: "var(--as-muted)" };
const subtleTextStyle = { color: "var(--as-subtle)" };

function number(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatDateTime(value: unknown): string {
  if (!value) return "not yet loaded";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return "not recorded";
  return date.toLocaleString();
}

function formatMoney(cents: unknown): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(number(cents) / 100);
}

function titleCase(value: unknown): string {
  const normalized = String(value || "not recorded").trim().replace(/[_-]+/g, " ");
  return normalized.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function responseError(text: string, fallback: string): string {
  try {
    const parsed = JSON.parse(text) as { detail?: unknown; message?: unknown; error?: unknown };
    const value = parsed?.detail ?? parsed?.message ?? parsed?.error;
    return typeof value === "string" && value.trim() ? value : fallback;
  } catch {
    return fallback;
  }
}

function CapabilityNotice({ available, children }: { available: boolean; children: ReactNode }) {
  if (available) return null;
  return (
    <p className="rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs font-medium leading-relaxed text-amber-700 dark:text-amber-300">
      {children}
    </p>
  );
}

function ChecklistRow({ label, ready, detail }: { label: string; ready: boolean; detail: string }) {
  const Icon = ready ? CheckCircle2 : AlertTriangle;
  return (
    <div className="flex items-start gap-3 border-t py-3 first:border-t-0" style={{ borderColor: "var(--as-border)" }}>
      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${ready ? "text-emerald-500" : "text-amber-500"}`} />
      <div className="min-w-0">
        <p className="text-xs font-semibold" style={textStyle}>{label}</p>
        <p className="mt-0.5 text-xs font-normal leading-relaxed" style={subtleTextStyle}>{detail}</p>
      </div>
    </div>
  );
}

export default function AdminSmsMonitoringPage() {
  const { selectedClientId } = useAdminClient();
  const [range, setRange] = useState<TimeRange>("7d");
  const [payload, setPayload] = useState<MonitoringPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshNonce, setRefreshNonce] = useState(0);

  const load = useCallback(async () => {
    if (!backendBase) {
      setError("Missing backend base URL configuration.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = String(session?.access_token || "").trim();
      if (!token) throw new Error("Missing session token.");
      const params = new URLSearchParams({ range });
      if (selectedClientId && selectedClientId !== "all") params.set("client_id", selectedClientId);
      const response = await fetch(`${backendBase}/admin/sms-monitoring?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
        credentials: "omit",
      });
      const text = await response.text();
      if (!response.ok) throw new Error(responseError(text, "Could not load SMS monitoring data."));
      const next = JSON.parse(text) as MonitoringPayload;
      if (!next || typeof next !== "object" || !next.delivery) throw new Error("SMS monitoring response was incomplete.");
      setPayload(next);
    } catch (loadError) {
      setPayload(null);
      setError(loadError instanceof Error ? loadError.message : "Could not load SMS monitoring data.");
    } finally {
      setLoading(false);
    }
  }, [range, selectedClientId]);

  useEffect(() => { void load(); }, [load, refreshNonce]);

  const runtime = payload?.runtime;
  const delivery = payload?.delivery;
  const activeBreaker = number(payload?.provider_breakers?.active) > 0;
  const attention = activeBreaker || number(delivery?.failed) > 0 || runtime?.compliance_review?.legal_review_required === true;
  const state = !runtime?.delivery_enabled
    ? { label: "Delivery disabled", className: "border-slate-400/30 bg-slate-400/10 text-slate-600 dark:text-slate-300", icon: Clock3 }
    : attention
      ? { label: "Attention required", className: "border-amber-400/30 bg-amber-400/10 text-amber-700 dark:text-amber-300", icon: AlertTriangle }
      : { label: "Operational", className: "border-emerald-400/30 bg-emerald-400/10 text-emerald-700 dark:text-emerald-300", icon: CheckCircle2 };
  const StateIcon = state.icon;

  const summary = [
    ["Requested", number(delivery?.requested), MessageSquareText],
    ["Provider accepted", number(delivery?.accepted), Activity],
    ["Delivered", number(delivery?.delivered), CheckCircle2],
    ["Failed / undelivered", number(delivery?.failed), XCircle],
    ["Delivery rate", `${number(delivery?.delivery_rate_pct).toFixed(1)}%`, Smartphone],
    ["Active suppressions", number(payload?.suppressions?.active), Ban],
    ["Today counted spend", payload?.spend?.available ? formatMoney(payload.spend.today_counted_cents) : "Unavailable", CircleDollarSign],
  ] as const;

  const checklist = useMemo(() => [
    ["SMS delivery", runtime?.delivery_enabled === true, runtime?.delivery_enabled ? "Enabled for this environment." : "Disabled for this environment."],
    ["Candidate SMS selection", runtime?.candidate_ui_enabled === true, runtime?.candidate_ui_enabled ? "Candidate-facing SMS selection is enabled." : "Candidate-facing SMS selection is disabled."],
    ["Provider and sender", Boolean(runtime?.provider && runtime?.sender_configured), runtime?.sender_configured ? `${titleCase(runtime?.provider)} sender is configured.` : "Provider or sender configuration is incomplete."],
    ["Outbound credentials", runtime?.outbound_credentials_configured === true, runtime?.outbound_credentials_configured ? "Credentials are present; values remain hidden." : "Outbound credentials are not configured."],
    ["Signed delivery webhook", runtime?.delivery_webhook_signing_configured === true, runtime?.delivery_webhook_signing_configured ? "Webhook verification material is configured." : "Delivery webhook verification is not configured."],
    ["Signed inbound controls", (runtime?.inbound_webhook_signing_configured ?? runtime?.inbound_webhook_secret_configured) === true, (runtime?.inbound_webhook_signing_configured ?? runtime?.inbound_webhook_secret_configured) ? "Signed STOP/START/HELP controls are active with Telnyx Ed25519 verification." : "Signed STOP/START/HELP verification material is not configured."],
    ["Line-type lookup", runtime?.lookup_enabled === true, runtime?.lookup_enabled ? `${titleCase(runtime?.lookup_provider)} mobile, landline, and VoIP lookup is enabled and fails closed.` : "Mobile/landline/VoIP lookup is disabled."],
    ["Global spend cap", number(runtime?.spend_cap_cents) > 0, runtime?.spend_cap_cents ? `${formatMoney(runtime.spend_cap_cents)} daily spend cap is configured.` : "A daily spend cap is not configured."],
    ["SMS abuse key", runtime?.abuse_secret_configured === true, runtime?.abuse_secret_configured ? "Keyed abuse controls are configured." : "SMS abuse control secret is not configured."],
    ["Consent disclosure", Boolean(runtime?.consent_copy_version), runtime?.consent_copy_version ? `Version ${runtime.consent_copy_version} is configured.` : "Consent disclosure version is not configured."],
    ["Formal compliance review", runtime?.compliance_review?.status === "approved", runtime?.compliance_review?.status === "approved" ? `Approved${runtime.compliance_review.version ? ` as ${runtime.compliance_review.version}` : ""}.` : runtime?.compliance_review?.status === "pending" ? "Review packet is ready; formal owner approval remains pending." : "LEGAL_REVIEW_REQUIRED — formal approval is not recorded."],
  ] as const, [runtime]);

  return (
    <AdminLayout title="SMS Monitoring">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-2xl font-black" style={textStyle}>SMS Monitoring &amp; Compliance</h2>
              <span className="rounded-full border px-2.5 py-1 text-[10px] font-black uppercase" style={{ ...surfaceStyle, color: "var(--as-subtle)" }}>Read only</span>
            </div>
            <p className="mt-1 text-sm font-normal" style={mutedTextStyle}>Operational delivery, safety controls, consent evidence, and compliance readiness.</p>
            <p className="mt-1 text-xs font-normal" style={subtleTextStyle}>Last refreshed {formatDateTime(payload?.generated_at)}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="SMS monitoring time range"
              value={range}
              onChange={(event) => setRange(event.target.value as TimeRange)}
              className="h-9 rounded-full border bg-transparent px-3 text-xs font-black outline-none focus:border-[#A380F6]"
              style={{ ...surfaceStyle, ...textStyle }}
            >
              <option value="24h">Last 24 hours</option>
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
            </select>
            <button type="button" onClick={() => setRefreshNonce((value) => value + 1)} disabled={loading} className="inline-flex h-9 items-center gap-2 rounded-full bg-[#A380F6] px-4 text-xs font-black text-white disabled:opacity-60">
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
            </button>
          </div>
        </div>

        {error ? <div role="alert" className="rounded-xl border border-red-400/30 bg-red-400/10 p-4 text-sm font-medium text-red-700 dark:text-red-300">{error}</div> : null}
        {loading && !payload ? <div className="rounded-xl border p-6 text-sm font-medium" style={surfaceStyle}>Loading SMS monitoring data…</div> : null}

        {payload ? (
          <>
            <div className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${state.className}`}>
              <StateIcon className="h-5 w-5" />
              <div><p className="text-sm font-semibold">{state.label}</p><p className="text-xs font-normal">Environment: {titleCase(runtime?.environment)} · Scope: {titleCase(payload.scope)}</p></div>
            </div>

            <section aria-label="SMS delivery summary" className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-7">
              {summary.map(([label, value, Icon]) => (
                <div key={label} className="min-w-0 rounded-xl border px-3 py-3" style={surfaceStyle}>
                  <div className="flex items-center justify-between gap-2"><p className="truncate text-xl font-black tabular-nums" style={textStyle}>{typeof value === "number" ? value.toLocaleString() : value}</p><Icon className="h-4 w-4 shrink-0 text-[#A380F6]" /></div>
                  <p className="mt-1 text-[10px] font-semibold uppercase leading-tight tracking-wide" style={subtleTextStyle}>{label}</p>
                </div>
              ))}
            </section>

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.55fr)]">
              <section className="rounded-xl border p-4" style={surfaceStyle}>
                <div className="mb-4"><h3 className="text-sm font-bold" style={textStyle}>Delivery trend</h3><p className="text-xs font-normal" style={subtleTextStyle}>Requested, delivered, and failed challenges by day.</p></div>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={delivery?.trend || []} margin={{ left: -24, right: 8, top: 8, bottom: 0 }}>
                      <defs><linearGradient id="smsDelivered" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#02D99D" stopOpacity={0.35}/><stop offset="95%" stopColor="#02D99D" stopOpacity={0}/></linearGradient></defs>
                      <CartesianGrid stroke="var(--as-border)" strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--as-subtle)" }} tickLine={false} axisLine={false} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "var(--as-subtle)" }} tickLine={false} axisLine={false} />
                      <Tooltip contentStyle={{ background: "var(--as-surface)", border: "1px solid var(--as-border)", borderRadius: 12, color: "var(--as-text)" }} />
                      <Area type="monotone" dataKey="requested" stroke="#A380F6" fill="transparent" strokeWidth={2} />
                      <Area type="monotone" dataKey="delivered" stroke="#02D99D" fill="url(#smsDelivered)" strokeWidth={2} />
                      <Area type="monotone" dataKey="failed" stroke="#FF6B6B" fill="transparent" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </section>

              <section className="rounded-xl border p-4" style={surfaceStyle}>
                <h3 className="text-sm font-bold" style={textStyle}>Delivery states</h3>
                <div className="mt-3 space-y-2">
                  {Object.entries(delivery?.by_status || {}).length ? Object.entries(delivery?.by_status || {}).sort().map(([status, count]) => (
                    <div key={status} className="flex items-center justify-between rounded-lg border px-3 py-2" style={{ borderColor: "var(--as-border)" }}><span className="text-xs font-medium" style={mutedTextStyle}>{titleCase(status)}</span><span className="text-sm font-bold tabular-nums" style={textStyle}>{number(count).toLocaleString()}</span></div>
                  )) : <p className="text-xs font-normal" style={subtleTextStyle}>No SMS delivery states in this range.</p>}
                </div>
              </section>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <section className="rounded-xl border p-4" style={surfaceStyle}>
                <div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-[#A380F6]"/><h3 className="text-sm font-bold" style={textStyle}>Runtime and compliance readiness</h3></div>
                <div className="mt-2">{checklist.map(([label, ready, detail]) => <ChecklistRow key={label} label={label} ready={ready} detail={detail} />)}</div>
              </section>

              <section className="space-y-4">
                <div className="rounded-xl border p-4" style={surfaceStyle}>
                  <h3 className="text-sm font-bold" style={textStyle}>Consent and suppressions</h3>
                  <p className="mt-1 text-xs font-normal leading-relaxed" style={subtleTextStyle}>Suppression totals are platform-wide because the private ledger intentionally has no candidate or client identity.</p>
                  <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {[
                      ["Explicit selections", payload.consent?.selected],
                      ["Accepted without evidence", payload.consent?.accepted_without_selection_evidence],
                      ["Active suppressions", payload.suppressions?.active],
                      ["Opted out", payload.suppressions?.opted_out],
                      ["Provider blocked", payload.suppressions?.provider_blocked],
                      ["Abuse blocked", payload.suppressions?.abuse_blocked],
                    ].map(([label, value]) => <div key={String(label)} className="rounded-lg border p-3" style={{ borderColor: "var(--as-border)" }}><p className="text-lg font-bold" style={textStyle}>{number(value).toLocaleString()}</p><p className="text-[10px] font-semibold uppercase tracking-wide" style={subtleTextStyle}>{label}</p></div>)}
                  </div>
                </div>

                <div className="rounded-xl border p-4" style={surfaceStyle}>
                  <h3 className="text-sm font-bold" style={textStyle}>Inbound controls and line type</h3>
                  <p className="mt-1 text-xs font-normal leading-relaxed" style={subtleTextStyle}>These safety totals are platform-wide and contain no raw destination data.</p>
                  <div className="mt-3 space-y-2">
                    <CapabilityNotice available={payload.capabilities?.inbound_control_monitoring === true}>Inbound STOP/START/HELP monitoring is not installed in this environment.</CapabilityNotice>
                    <CapabilityNotice available={payload.capabilities?.line_type_monitoring === true}>Live line-type monitoring is not installed in this environment.</CapabilityNotice>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {[
                      ["STOP", payload.inbound?.stop], ["START", payload.inbound?.start], ["HELP", payload.inbound?.help],
                      ["Mobile", payload.line_type?.mobile], ["Landline", payload.line_type?.landline], ["VoIP", payload.line_type?.voip], ["Unknown", payload.line_type?.unknown],
                    ].map(([label, value]) => <div key={String(label)} className="rounded-lg border p-2.5" style={{ borderColor: "var(--as-border)" }}><p className="text-base font-bold" style={textStyle}>{number(value).toLocaleString()}</p><p className="text-[10px] font-semibold uppercase tracking-wide" style={subtleTextStyle}>{label}</p></div>)}
                  </div>
                </div>

                <div className="rounded-xl border p-4" style={surfaceStyle}>
                  <h3 className="text-sm font-bold" style={textStyle}>Spend and breaker protection</h3>
                  <p className="mt-1 text-xs font-normal leading-relaxed" style={subtleTextStyle}>Spend respects the selected client scope; provider breaker totals are platform-wide.</p>
                  <div className="mt-3 space-y-2">
                    <CapabilityNotice available={payload.capabilities?.spend_monitoring === true}>Spend-reservation monitoring is not installed in this environment.</CapabilityNotice>
                    <CapabilityNotice available={payload.capabilities?.provider_breaker_monitoring === true}>Provider-breaker monitoring is not installed in this environment.</CapabilityNotice>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {[
                      ["Counted today", payload.spend?.available ? formatMoney(payload.spend.today_counted_cents) : "—"],
                      ["Counted attempts", payload.spend?.today_counted_attempts ?? "—"],
                      ["Active breakers", payload.provider_breakers?.active ?? "—"],
                      ["Released breakers", payload.provider_breakers?.released ?? "—"],
                    ].map(([label, value]) => <div key={String(label)} className="rounded-lg border p-2.5" style={{ borderColor: "var(--as-border)" }}><p className="text-base font-bold" style={textStyle}>{value}</p><p className="text-[10px] font-semibold uppercase tracking-wide" style={subtleTextStyle}>{label}</p></div>)}
                  </div>
                </div>
              </section>
            </div>

            <section className="overflow-hidden rounded-xl border" style={surfaceStyle}>
              <div className="border-b px-4 py-3" style={{ borderColor: "var(--as-border)" }}><h3 className="text-sm font-bold" style={textStyle}>Recent bounded incidents</h3><p className="text-xs font-normal leading-relaxed" style={subtleTextStyle}>No phone numbers, candidate identities, message IDs, fingerprints, or OTPs are displayed.</p></div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[680px] text-left text-xs"><thead><tr className="border-b" style={{ borderColor: "var(--as-border)" }}>{["Occurred", "Provider", "Delivery status", "Failure category"].map((heading) => <th key={heading} className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wide" style={subtleTextStyle}>{heading}</th>)}</tr></thead><tbody>
                  {(payload.incidents || []).length ? payload.incidents?.map((incident, index) => <tr key={`${incident.occurred_at || "incident"}-${index}`} className="border-b last:border-b-0" style={{ borderColor: "var(--as-border)" }}><td className="px-4 py-3 font-normal" style={mutedTextStyle}>{formatDateTime(incident.occurred_at)}</td><td className="px-4 py-3 font-medium" style={textStyle}>{titleCase(incident.provider)}</td><td className="px-4 py-3 font-medium" style={textStyle}>{titleCase(incident.delivery_status)}</td><td className="px-4 py-3 font-medium" style={textStyle}>{titleCase(incident.failure_category)}</td></tr>) : <tr><td colSpan={4} className="px-4 py-8 text-center text-sm font-normal" style={subtleTextStyle}>No bounded SMS incidents in this range.</td></tr>}
                </tbody></table>
              </div>
            </section>
          </>
        ) : null}
      </div>
    </AdminLayout>
  );
}
