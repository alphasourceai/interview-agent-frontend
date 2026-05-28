import { useEffect, useState } from "react";
import { RefreshCw, Download } from "lucide-react";
import AdminLayout from "@/components/AdminLayout";
import { useAdminClient } from "@/context/AdminClientContext";
import { supabase } from "@/lib/supabaseClient";

/* ── Types ───────────────────────────────────────────────────── */
interface AuditLog {
  id:      string;
  date:    string;
  dateTs:  number;
  type:    string;
  status:  "success" | "error" | "warning";
  errors:  number;
  logId:   string;
  eventId: string;
  note:    string;
}

interface BillingReconciliationRow {
  id:            string;
  clientId:      string;
  client:        string;
  expectedAmount:string;
  actualBilled:  string;
  difference:    string;
  stripeStatus:  string;
  lastChecked:   string;
  lastCheckedTs: number;
}

interface CancellationRun {
  id:           string;
  clientId:     string;
  client:       string;
  status:       string;
  triggeredBy:  string;
  started:      string;
  completed:    string;
  finalInvoice: string;
  stripeInvoice:string;
  note:         string;
  error:        string;
  startedTs:    number;
}

interface AgreementAuditRow {
  id:          string;
  eventType:   string;
  eventAt:     string;
  eventTs:     number;
  agreementId: string;
  clientId:    string;
  client:      string;
  sentBy:      string;
  sentTo:      string;
  signerIp:    string;
  status:      string;
}

interface EmailDeliveryEventRow {
  id:             string;
  eventAt:        string;
  eventTs:        number;
  eventType:      string;
  category:       string;
  email:          string;
  reasonResponse: string;
  messageId:      string;
  alert:          string;
}

const statusColors = {
  success:   { bg: "rgba(2,217,157,0.10)",   text: "#00886A" },
  error:     { bg: "rgba(255,107,107,0.10)", text: "#C94040" },
  warning:   { bg: "rgba(240,165,0,0.10)",   text: "#C07800" },
  completed: { bg: "rgba(2,217,157,0.10)",   text: "#00886A" },
  failed:    { bg: "rgba(255,107,107,0.10)", text: "#C94040" },
  running:   { bg: "rgba(163,128,246,0.10)", text: "#7C5FCC" },
};

function StatusBadge({ status }: { status: string }) {
  const s = statusColors[status as keyof typeof statusColors] ?? { bg: "color-mix(in srgb, var(--as-text) 7%, transparent)", text: "var(--as-text-muted)" };
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold"
      style={{ backgroundColor: s.bg, color: s.text }}
    >
      {status}
    </span>
  );
}

const surfaceCardStyle = {
  backgroundColor: "var(--as-surface)",
  border: "1px solid var(--as-border)",
  boxShadow: "var(--as-shadow)",
};
const dividerStyle = { borderColor: "var(--as-border)" };
const primaryTextStyle = { color: "var(--as-text)" };
const subtleTextStyle = { color: "var(--as-text-subtle)" };
const exportButtonStyle = {
  backgroundColor: "color-mix(in srgb, var(--as-text) 7%, transparent)",
  color: "var(--as-text)",
};
const fieldSurfaceStyle = {
  backgroundColor: "var(--as-surface)",
  borderColor: "var(--as-border)",
  color: "var(--as-text)",
};

const card = "rounded-2xl mb-6 overflow-hidden";
const cardStyle = surfaceCardStyle;

const thCls = "px-4 py-3 text-[10px] font-black uppercase tracking-widest text-[var(--as-text-muted)] text-left whitespace-nowrap";
const tdCls = "px-4 py-3 text-xs text-[var(--as-text-muted)] font-medium align-top";

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

function formatDateTime(value: unknown): string {
  const raw = String(value || "").trim();
  if (!raw) return "—";
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleString();
}

function toTimestamp(value: unknown): number {
  const raw = String(value || "").trim();
  if (!raw) return 0;
  const parsed = new Date(raw).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseBoundary(value: string, endOfDay: boolean): number | null {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  if (endOfDay) parsed.setHours(23, 59, 59, 999);
  else parsed.setHours(0, 0, 0, 0);
  return parsed.getTime();
}

function shortTail(value: unknown): string {
  const raw = String(value || "").trim();
  if (!raw) return "—";
  return `...${raw.slice(-8)}`;
}

function toCsvCell(value: unknown): string {
  const normalized = String(value ?? "").replace(/"/g, "\"\"");
  return `"${normalized}"`;
}

function downloadCsv(filename: string, headers: string[], rows: Array<Array<unknown>>): void {
  const csv = [headers.map(toCsvCell).join(","), ...rows.map((row) => row.map(toCsvCell).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

export default function AdminAuditLogsPage() {
  const { selectedClientId } = useAdminClient();
  const [auditDateFrom, setAuditDateFrom] = useState("");
  const [auditDateTo, setAuditDateTo] = useState("");
  const [billingDateFrom, setBillingDateFrom] = useState("");
  const [billingDateTo, setBillingDateTo] = useState("");
  const [cancellationDateFrom, setCancellationDateFrom] = useState("");
  const [cancellationDateTo, setCancellationDateTo] = useState("");
  const [agreementDateFrom, setAgreementDateFrom] = useState("");
  const [agreementDateTo, setAgreementDateTo] = useState("");
  const [emailDeliveryDateFrom, setEmailDeliveryDateFrom] = useState("");
  const [emailDeliveryDateTo, setEmailDeliveryDateTo] = useState("");
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [billingRows, setBillingRows] = useState<BillingReconciliationRow[]>([]);
  const [cancellationRuns, setCancellationRuns] = useState<CancellationRun[]>([]);
  const [agreementRows, setAgreementRows] = useState<AgreementAuditRow[]>([]);
  const [emailDeliveryRows, setEmailDeliveryRows] = useState<EmailDeliveryEventRow[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [billingLoading, setBillingLoading] = useState(false);
  const [cancellationLoading, setCancellationLoading] = useState(false);
  const [agreementLoading, setAgreementLoading] = useState(false);
  const [emailDeliveryLoading, setEmailDeliveryLoading] = useState(false);
  const [auditError, setAuditError] = useState("");
  const [billingError, setBillingError] = useState("");
  const [cancellationError, setCancellationError] = useState("");
  const [agreementError, setAgreementError] = useState("");
  const [emailDeliveryError, setEmailDeliveryError] = useState("");

  const inputCls =
    "px-3 py-2 rounded-xl text-xs font-medium border placeholder:text-[var(--as-text-subtle)] " +
    "focus:outline-none focus:border-[#A380F6] transition-colors w-32";

  const authedGet = async (path: string, fallback: string): Promise<unknown> => {
    if (!backendBase) throw new Error("Missing backend base URL configuration.");
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const token = String(session?.access_token || "").trim();
    if (!token) throw new Error("Missing session token.");

    const response = await fetch(`${backendBase}${path}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
      credentials: "omit",
    });
    const text = await response.text();
    if (!response.ok) throw new Error(extractErrorMessage(text, fallback));
    return parseJsonSafe(text);
  };

  const refreshAuditLogs = async () => {
    setAuditLoading(true);
    setAuditError("");
    try {
      const payload = await authedGet("/admin/audit/contract-processing-runs", "Failed to load audit logs.");
      const items =
        payload && typeof payload === "object" && Array.isArray((payload as { items?: unknown }).items)
          ? ((payload as { items: unknown[] }).items || [])
          : [];
      const mapped: AuditLog[] = items
        .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"))
        .map((item, index) => {
          const summary =
            item.summary && typeof item.summary === "object"
              ? (item.summary as Record<string, unknown>)
              : {};
          const due = Number(summary.due || 0);
          const renewed = Number(summary.renewed || 0);
          const deactivated = Number(summary.deactivated || 0);
          const skipped = Number(summary.skipped_no_action || 0) + Number(summary.skipped_manual_override || 0);
          const errors = Number(summary.errors || 0);
          const processedOk = item.processed_ok === true ? true : item.processed_ok === false ? false : null;
          const status: "success" | "error" | "warning" =
            processedOk === true ? "success" : processedOk === false ? "error" : "warning";
          const startedAt = item.started_at || item.created_at;
          const summaryText = `due ${due}, renewed ${renewed}, deactivated ${deactivated}, skipped ${skipped}, errors ${errors}`;
          return {
            id: String(item.id || `audit-${index}`),
            date: formatDateTime(startedAt),
            dateTs: toTimestamp(startedAt),
            type: String(item.trigger_source || "—"),
            status,
            errors,
            logId: shortTail(item.request_id),
            eventId: String(item.triggered_by_email || "—"),
            note: String(item.error || "").trim() || summaryText,
          };
        });
      setAuditLogs(mapped);
    } catch (error) {
      setAuditLogs([]);
      setAuditError(error instanceof Error ? error.message : "Failed to load audit logs.");
    } finally {
      setAuditLoading(false);
    }
  };

  const refreshBillingReconciliation = async () => {
    setBillingLoading(true);
    setBillingError("");
    try {
      const payload = await authedGet("/admin/audit/billing-reconciliation", "Failed to load billing reconciliation.");
      const items =
        payload && typeof payload === "object" && Array.isArray((payload as { items?: unknown }).items)
          ? ((payload as { items: unknown[] }).items || [])
          : [];
      const mapped: BillingReconciliationRow[] = items
        .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"))
        .map((item, index) => {
          const clientId = String(item.id || "");
          const appStatus =
            item.manual_active_override === true
              ? `${String(item.billing_status || "—")} (manual)`
              : String(item.billing_status || "—");
          const overrideMode = String(item.access_override_mode || "inherit");
          const reason = String(item.reason || "—");
          const subscriptionStatus = String(item.subscription_status || "—");
          const cancelAtTermEnd = item.cancel_at_term_end === true ? "cancel_at_term_end" : "";
          const stripeStatus = [subscriptionStatus, cancelAtTermEnd].filter(Boolean).join(" / ") || "—";
          const checkedAt = item.current_term_end || item.contract_end_at;
          return {
            id: `${clientId || `billing-${index}`}-${reason}`,
            clientId,
            client: String(item.name || "—"),
            expectedAmount: appStatus,
            actualBilled: overrideMode,
            difference: reason,
            stripeStatus,
            lastChecked: formatDateTime(checkedAt),
            lastCheckedTs: toTimestamp(checkedAt),
          };
        });
      setBillingRows(mapped);
    } catch (error) {
      setBillingRows([]);
      setBillingError(error instanceof Error ? error.message : "Failed to load billing reconciliation.");
    } finally {
      setBillingLoading(false);
    }
  };

  const refreshCancellationRuns = async () => {
    setCancellationLoading(true);
    setCancellationError("");
    try {
      const payload = await authedGet("/admin/audit/contract-cancellation-runs", "Failed to load contract cancellation runs.");
      const items =
        payload && typeof payload === "object" && Array.isArray((payload as { items?: unknown }).items)
          ? ((payload as { items: unknown[] }).items || [])
          : [];
      const mapped: CancellationRun[] = items
        .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"))
        .map((item, index) => ({
          id: String(item.id || `cancel-${index}`),
          clientId: String(item.client_id || ""),
          client: String(item.client_name || "—"),
          status: String(item.status || "—"),
          triggeredBy: String(item.triggered_by_email || "—"),
          started: formatDateTime(item.started_at),
          completed: formatDateTime(item.completed_at),
          finalInvoice:
            item.final_invoice_amount == null || item.final_invoice_amount === ""
              ? "—"
              : String(item.final_invoice_amount),
          stripeInvoice: String(item.stripe_invoice_id || "—"),
          note: String(item.note || "—"),
          error: String(item.error || "—"),
          startedTs: toTimestamp(item.started_at),
        }));
      setCancellationRuns(mapped);
    } catch (error) {
      setCancellationRuns([]);
      setCancellationError(error instanceof Error ? error.message : "Failed to load contract cancellation runs.");
    } finally {
      setCancellationLoading(false);
    }
  };

  const refreshAgreementRows = async () => {
    setAgreementLoading(true);
    setAgreementError("");
    try {
      const payload = await authedGet("/admin/audit/agreements", "Failed to load agreement audit logs.");
      const items =
        payload && typeof payload === "object" && Array.isArray((payload as { items?: unknown }).items)
          ? ((payload as { items: unknown[] }).items || [])
          : [];
      const mapped: AgreementAuditRow[] = items
        .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"))
        .map((item, index) => {
          const eventAt = item.event_at || item.created_at || "";
          return {
            id: String(item.id || `agreement-audit-${index}`),
            eventType: String(item.event_type || "—"),
            eventAt: formatDateTime(eventAt),
            eventTs: toTimestamp(eventAt),
            agreementId: String(item.agreement_id || "—"),
            clientId: String(item.client_id || ""),
            client: String(item.client_name || "—"),
            sentBy: String(item.sent_by_email || item.sent_by_user_id || "—"),
            sentTo: String(item.sent_to_email || "—"),
            signerIp: String(item.signer_ip || "—"),
            status: String(item.status || "—"),
          };
        });
      setAgreementRows(mapped);
    } catch (error) {
      setAgreementRows([]);
      setAgreementError(error instanceof Error ? error.message : "Failed to load agreement audit logs.");
    } finally {
      setAgreementLoading(false);
    }
  };

  const refreshEmailDeliveryRows = async () => {
    setEmailDeliveryLoading(true);
    setEmailDeliveryError("");
    try {
      const payload = await authedGet("/admin/audit/email-delivery-events", "Failed to load email delivery events.");
      const items =
        payload && typeof payload === "object" && Array.isArray((payload as { items?: unknown }).items)
          ? ((payload as { items: unknown[] }).items || [])
          : [];
      const mapped: EmailDeliveryEventRow[] = items
        .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"))
        .map((item, index) => {
          const eventAt = item.event_at || item.created_at || "";
          const reasonParts = [item.reason, item.status, item.response]
            .map((value) => String(value || "").trim())
            .filter(Boolean);
          const alertError = String(item.alert_error || "").trim();
          const alertSentAt = item.alert_sent_at ? formatDateTime(item.alert_sent_at) : "";
          return {
            id: String(item.id || `email-delivery-${index}`),
            eventAt: formatDateTime(eventAt),
            eventTs: toTimestamp(eventAt),
            eventType: String(item.event_type || "—"),
            category: String(item.email_category || item.category || "—"),
            email: String(item.email || "—"),
            reasonResponse: reasonParts.length ? reasonParts.join(" / ") : "—",
            messageId: String(item.sg_message_id || item.sg_event_id || "—"),
            alert: alertError ? `Error: ${alertError}` : alertSentAt ? `Sent ${alertSentAt}` : "—",
          };
        });
      setEmailDeliveryRows(mapped);
    } catch (error) {
      setEmailDeliveryRows([]);
      setEmailDeliveryError(error instanceof Error ? error.message : "Failed to load email delivery events.");
    } finally {
      setEmailDeliveryLoading(false);
    }
  };

  useEffect(() => {
    void refreshAuditLogs();
    void refreshBillingReconciliation();
    void refreshCancellationRuns();
    void refreshAgreementRows();
    void refreshEmailDeliveryRows();
  }, []);

  const auditStartTs = parseBoundary(auditDateFrom, false);
  const auditEndTs = parseBoundary(auditDateTo, true);
  const filteredAuditLogs = auditLogs.filter((log) => {
    if (auditStartTs != null && log.dateTs < auditStartTs) return false;
    if (auditEndTs != null && log.dateTs > auditEndTs) return false;
    return true;
  });

  const billingStartTs = parseBoundary(billingDateFrom, false);
  const billingEndTs = parseBoundary(billingDateTo, true);
  const scopedBillingRows =
    selectedClientId === "all"
      ? billingRows
      : billingRows.filter((row) => row.clientId === selectedClientId);
  const filteredBillingRows = scopedBillingRows.filter((row) => {
    if (billingStartTs != null && row.lastCheckedTs < billingStartTs) return false;
    if (billingEndTs != null && row.lastCheckedTs > billingEndTs) return false;
    return true;
  });

  const cancellationStartTs = parseBoundary(cancellationDateFrom, false);
  const cancellationEndTs = parseBoundary(cancellationDateTo, true);
  const scopedCancellationRuns =
    selectedClientId === "all"
      ? cancellationRuns
      : cancellationRuns.filter((run) => run.clientId === selectedClientId);
  const filteredCancellationRuns = scopedCancellationRuns.filter((run) => {
    if (cancellationStartTs != null && run.startedTs < cancellationStartTs) return false;
    if (cancellationEndTs != null && run.startedTs > cancellationEndTs) return false;
    return true;
  });

  const agreementStartTs = parseBoundary(agreementDateFrom, false);
  const agreementEndTs = parseBoundary(agreementDateTo, true);
  const scopedAgreementRows =
    selectedClientId === "all"
      ? agreementRows
      : agreementRows.filter((row) => row.clientId === selectedClientId);
  const filteredAgreementRows = scopedAgreementRows.filter((row) => {
    if (agreementStartTs != null && row.eventTs < agreementStartTs) return false;
    if (agreementEndTs != null && row.eventTs > agreementEndTs) return false;
    return true;
  });

  const emailDeliveryStartTs = parseBoundary(emailDeliveryDateFrom, false);
  const emailDeliveryEndTs = parseBoundary(emailDeliveryDateTo, true);
  const filteredEmailDeliveryRows = emailDeliveryRows.filter((row) => {
    if (emailDeliveryStartTs != null && row.eventTs < emailDeliveryStartTs) return false;
    if (emailDeliveryEndTs != null && row.eventTs > emailDeliveryEndTs) return false;
    return true;
  });

  const refreshBtn = (label: string, onClick: () => Promise<void>, loading = false) => (
    <button
      onClick={() => void onClick()}
      disabled={loading}
      className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold text-white transition-opacity hover:opacity-90 flex-shrink-0"
      style={{ backgroundColor: "#A380F6" }}
    >
      <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
      {loading ? "Loading..." : label}
    </button>
  );

  return (
    <AdminLayout title="Audit Logs">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-black" style={primaryTextStyle}>Audit Logs</h2>
        <span className="text-xs font-medium italic" style={{ color: "var(--as-text)", opacity: 0.35 }}>Global — not client specific</span>
      </div>

      {/* ── Section 1: Contract Renewal Processing Runs ──────────────────────────── */}
      <div className={card} style={cardStyle}>
        {/* Header */}
        <div className="px-5 py-4 border-b flex flex-wrap items-center gap-3" style={dividerStyle}>
          <p className="text-sm font-black mr-auto" style={primaryTextStyle}>Contract Renewal Processing Runs</p>

          {/* Date range */}
          <input
            type="text"
            className={inputCls}
            style={fieldSurfaceStyle}
            value={auditDateFrom}
            onChange={(e) => setAuditDateFrom(e.target.value)}
            placeholder="MM/DD/YYYY"
          />
          <input
            type="text"
            className={inputCls}
            style={fieldSurfaceStyle}
            value={auditDateTo}
            onChange={(e) => setAuditDateTo(e.target.value)}
            placeholder="MM/DD/YYYY"
          />

          {/* Export */}
          <button
            onClick={() => {
              downloadCsv(
                "audit-logs.csv",
                ["Date / Time", "Type", "Status", "Errors", "Log ID", "Event ID", "Note"],
                filteredAuditLogs.map((log) => [
                  log.date,
                  log.type,
                  log.status,
                  log.errors,
                  log.logId,
                  log.eventId,
                  log.note,
                ]),
              );
            }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold transition-all hover:opacity-90 flex-shrink-0"
            style={exportButtonStyle}
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>

          {refreshBtn("Refresh", refreshAuditLogs, auditLoading)}
        </div>

        {/* Table — scrollable */}
        <div className="overflow-auto max-h-80">
          <table className="w-full text-sm min-w-[700px]">
            <thead className="sticky top-0 z-10" style={{ backgroundColor: "var(--as-surface)" }}>
              <tr className="border-b" style={dividerStyle}>
                <th className={thCls + " pl-5"}>Date / Time</th>
                <th className={thCls}>Type</th>
                <th className={thCls}>Status</th>
                <th className={thCls}>Errors</th>
                <th className={thCls}>Log ID</th>
                <th className={thCls}>Event ID</th>
                <th className={thCls + " pr-5"}>Note</th>
              </tr>
            </thead>
            <tbody>
              {auditLoading ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-sm font-semibold" style={subtleTextStyle}>
                    Loading audit logs...
                  </td>
                </tr>
              ) : auditError ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-sm text-red-500 font-semibold">
                    {auditError}
                  </td>
                </tr>
              ) : filteredAuditLogs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-sm font-semibold" style={subtleTextStyle}>
                    No audit log runs yet.
                  </td>
                </tr>
              ) : (
                filteredAuditLogs.map((log, idx) => (
                  <tr
                    key={log.id}
                    className="border-b transition-colors as-shell-dropdown-item"
                    style={idx === filteredAuditLogs.length - 1 ? { borderBottom: "none" } : dividerStyle}
                  >
                    <td className={tdCls + " pl-5 font-semibold text-[var(--as-text-muted)] whitespace-nowrap"}>{log.date}</td>
                    <td className={tdCls}>{log.type}</td>
                    <td className={tdCls}><StatusBadge status={log.status} /></td>
                    <td className={tdCls}>errors {log.errors}</td>
                    <td className={tdCls + " font-mono text-[var(--as-text-subtle)] text-[11px]"}>{log.logId}</td>
                    <td className={tdCls + " text-[var(--as-text-subtle)]"}>{log.eventId}</td>
                    <td className={tdCls + " pr-5 text-[var(--as-text-subtle)]"}>{log.note}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="px-5 py-2.5 border-t" style={dividerStyle}>
          <p className="text-[11px] font-semibold" style={subtleTextStyle}>{filteredAuditLogs.length} entries</p>
        </div>
      </div>

      {/* ── Section 2: Agreements ──────────────────────────── */}
      <div className={card} style={cardStyle}>
        <div className="px-5 py-4 border-b flex flex-wrap items-center gap-3" style={dividerStyle}>
          <p className="text-sm font-black mr-auto" style={primaryTextStyle}>Agreements</p>
          <input
            type="text"
            className={inputCls}
            style={fieldSurfaceStyle}
            value={agreementDateFrom}
            onChange={(e) => setAgreementDateFrom(e.target.value)}
            placeholder="MM/DD/YYYY"
          />
          <input
            type="text"
            className={inputCls}
            style={fieldSurfaceStyle}
            value={agreementDateTo}
            onChange={(e) => setAgreementDateTo(e.target.value)}
            placeholder="MM/DD/YYYY"
          />
          <button
            onClick={() => {
              downloadCsv(
                "agreement-audit-logs.csv",
                ["Event Time", "Event Type", "Agreement ID", "Client", "Sent By", "Sent To", "Signer IP", "Status"],
                filteredAgreementRows.map((row) => [
                  row.eventAt,
                  row.eventType,
                  row.agreementId,
                  row.client,
                  row.sentBy,
                  row.sentTo,
                  row.signerIp,
                  row.status,
                ]),
              );
            }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold transition-all hover:opacity-90 flex-shrink-0"
            style={exportButtonStyle}
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>
          {refreshBtn("Refresh", refreshAgreementRows, agreementLoading)}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[980px]">
            <thead>
              <tr className="border-b" style={dividerStyle}>
                <th className={thCls + " pl-5"}>Event Time</th>
                <th className={thCls}>Event Type</th>
                <th className={thCls}>Agreement ID</th>
                <th className={thCls}>Client</th>
                <th className={thCls}>Sent By</th>
                <th className={thCls}>Sent To</th>
                <th className={thCls}>Signer IP</th>
                <th className={thCls + " pr-5"}>Status</th>
              </tr>
            </thead>
            <tbody>
              {agreementLoading ? (
                <tr>
                  <td colSpan={8} className="text-center py-10 text-sm font-semibold" style={subtleTextStyle}>
                    Loading agreement audit logs...
                  </td>
                </tr>
              ) : agreementError ? (
                <tr>
                  <td colSpan={8} className="text-center py-10 text-sm text-red-500 font-semibold">
                    {agreementError}
                  </td>
                </tr>
              ) : filteredAgreementRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-10 text-sm font-semibold" style={subtleTextStyle}>
                    No agreement audit events yet.
                  </td>
                </tr>
              ) : (
                filteredAgreementRows.map((row, idx) => (
                  <tr
                    key={row.id}
                    className="border-b transition-colors as-shell-dropdown-item"
                    style={idx === filteredAgreementRows.length - 1 ? { borderBottom: "none" } : dividerStyle}
                  >
                    <td className={tdCls + " pl-5 whitespace-nowrap"}>{row.eventAt}</td>
                    <td className={tdCls + " font-semibold text-[var(--as-text-muted)]"}>{row.eventType}</td>
                    <td className={tdCls + " font-mono text-[var(--as-text-muted)] text-[11px]"}>{row.agreementId}</td>
                    <td className={tdCls}>{row.client}</td>
                    <td className={tdCls + " text-[var(--as-text-muted)]"}>{row.sentBy}</td>
                    <td className={tdCls + " text-[var(--as-text-muted)]"}>{row.sentTo}</td>
                    <td className={tdCls + " text-[var(--as-text-subtle)]"}>{row.signerIp}</td>
                    <td className={tdCls + " pr-5"}><StatusBadge status={row.status} /></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Section 3: Email Delivery Problems ─────────────── */}
      <div className={card} style={cardStyle}>
        <div className="px-5 py-4 border-b flex flex-wrap items-center gap-3" style={dividerStyle}>
          <p className="text-sm font-black mr-auto" style={primaryTextStyle}>Email Delivery Problems</p>
          <input
            type="text"
            className={inputCls}
            style={fieldSurfaceStyle}
            value={emailDeliveryDateFrom}
            onChange={(e) => setEmailDeliveryDateFrom(e.target.value)}
            placeholder="MM/DD/YYYY"
          />
          <input
            type="text"
            className={inputCls}
            style={fieldSurfaceStyle}
            value={emailDeliveryDateTo}
            onChange={(e) => setEmailDeliveryDateTo(e.target.value)}
            placeholder="MM/DD/YYYY"
          />
          <button
            onClick={() => {
              downloadCsv(
                "email-delivery-problems.csv",
                ["Event Time", "Event", "Category", "Recipient", "Reason / Response", "Message ID", "Alert"],
                filteredEmailDeliveryRows.map((row) => [
                  row.eventAt,
                  row.eventType,
                  row.category,
                  row.email,
                  row.reasonResponse,
                  row.messageId,
                  row.alert,
                ]),
              );
            }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold transition-all hover:opacity-90 flex-shrink-0"
            style={exportButtonStyle}
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>
          {refreshBtn("Refresh", refreshEmailDeliveryRows, emailDeliveryLoading)}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[980px]">
            <thead>
              <tr className="border-b" style={dividerStyle}>
                <th className={thCls + " pl-5"}>Event Time</th>
                <th className={thCls}>Event</th>
                <th className={thCls}>Category</th>
                <th className={thCls}>Recipient</th>
                <th className={thCls}>Reason / Response</th>
                <th className={thCls}>Message ID</th>
                <th className={thCls + " pr-5"}>Alert</th>
              </tr>
            </thead>
            <tbody>
              {emailDeliveryLoading ? (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-sm font-semibold" style={subtleTextStyle}>
                    Loading email delivery events...
                  </td>
                </tr>
              ) : emailDeliveryError ? (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-sm text-red-500 font-semibold">
                    {emailDeliveryError}
                  </td>
                </tr>
              ) : filteredEmailDeliveryRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-sm font-semibold" style={subtleTextStyle}>
                    No email delivery problem events yet.
                  </td>
                </tr>
              ) : (
                filteredEmailDeliveryRows.map((row, idx) => (
                  <tr
                    key={row.id}
                    className="border-b transition-colors as-shell-dropdown-item"
                    style={idx === filteredEmailDeliveryRows.length - 1 ? { borderBottom: "none" } : dividerStyle}
                  >
                    <td className={tdCls + " pl-5 whitespace-nowrap"}>{row.eventAt}</td>
                    <td className={tdCls}><StatusBadge status={row.eventType} /></td>
                    <td className={tdCls + " font-semibold text-[var(--as-text-muted)]"}>{row.category}</td>
                    <td className={tdCls + " text-[var(--as-text-muted)]"}>{row.email}</td>
                    <td className={tdCls + " text-[var(--as-text-muted)]"}>{row.reasonResponse}</td>
                    <td className={tdCls + " font-mono text-[var(--as-text-subtle)] text-[11px]"}>{row.messageId === "—" ? "—" : shortTail(row.messageId)}</td>
                    <td className={tdCls + " pr-5 text-[var(--as-text-subtle)]"}>{row.alert}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Section 4: Billing Reconciliation ─────────────── */}
      <div className={card} style={cardStyle}>
        <div className="px-5 py-4 border-b flex flex-wrap items-center gap-3" style={dividerStyle}>
          <p className="text-sm font-black mr-auto" style={primaryTextStyle}>Billing Reconciliation</p>
          <input
            type="text"
            className={inputCls}
            style={fieldSurfaceStyle}
            value={billingDateFrom}
            onChange={(e) => setBillingDateFrom(e.target.value)}
            placeholder="MM/DD/YYYY"
          />
          <input
            type="text"
            className={inputCls}
            style={fieldSurfaceStyle}
            value={billingDateTo}
            onChange={(e) => setBillingDateTo(e.target.value)}
            placeholder="MM/DD/YYYY"
          />
          <button
            onClick={() => {
              downloadCsv(
                "billing-reconciliation.csv",
                ["Client", "Expected Amount", "Actual Billed", "Difference", "Stripe Status", "Last Checked"],
                filteredBillingRows.map((row) => [
                  row.client,
                  row.expectedAmount,
                  row.actualBilled,
                  row.difference,
                  row.stripeStatus,
                  row.lastChecked,
                ]),
              );
            }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold transition-all hover:opacity-90 flex-shrink-0"
            style={exportButtonStyle}
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>
          {refreshBtn("Refresh", refreshBillingReconciliation, billingLoading)}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[650px]">
            <thead>
              <tr className="border-b" style={dividerStyle}>
                <th className={thCls + " pl-5"}>Client</th>
                <th className={thCls}>Expected Amount</th>
                <th className={thCls}>Actual Billed</th>
                <th className={thCls}>Difference</th>
                <th className={thCls}>Stripe Status</th>
                <th className={thCls + " pr-5"}>Last Checked</th>
              </tr>
            </thead>
            <tbody>
              {billingLoading ? (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-sm font-semibold" style={subtleTextStyle}>
                    Loading billing reconciliation...
                  </td>
                </tr>
              ) : billingError ? (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-sm text-red-500 font-semibold">
                    {billingError}
                  </td>
                </tr>
              ) : filteredBillingRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-sm font-semibold" style={subtleTextStyle}>
                    No billing mismatches found.
                  </td>
                </tr>
              ) : (
                filteredBillingRows.map((row, idx) => (
                  <tr
                    key={row.id}
                    className="border-b transition-colors as-shell-dropdown-item"
                    style={idx === filteredBillingRows.length - 1 ? { borderBottom: "none" } : dividerStyle}
                  >
                    <td className={tdCls + " pl-5 font-bold text-[var(--as-text)]"}>{row.client}</td>
                    <td className={tdCls}>{row.expectedAmount}</td>
                    <td className={tdCls}>{row.actualBilled}</td>
                    <td className={tdCls + " text-[var(--as-text-muted)]"}>{row.difference}</td>
                    <td className={tdCls}>{row.stripeStatus}</td>
                    <td className={tdCls + " pr-5 whitespace-nowrap"}>{row.lastChecked}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Section 5: Contract Cancellation Runs ─────────── */}
      <div className={card} style={cardStyle}>
        <div className="px-5 py-4 border-b flex flex-wrap items-center gap-3" style={dividerStyle}>
          <p className="text-sm font-black mr-auto" style={primaryTextStyle}>Contract Cancellation Runs</p>
          <input
            type="text"
            className={inputCls}
            style={fieldSurfaceStyle}
            value={cancellationDateFrom}
            onChange={(e) => setCancellationDateFrom(e.target.value)}
            placeholder="MM/DD/YYYY"
          />
          <input
            type="text"
            className={inputCls}
            style={fieldSurfaceStyle}
            value={cancellationDateTo}
            onChange={(e) => setCancellationDateTo(e.target.value)}
            placeholder="MM/DD/YYYY"
          />
          <button
            onClick={() => {
              downloadCsv(
                "contract-cancellation-runs.csv",
                ["Client", "Status", "Triggered By", "Started", "Completed", "Final Invoice", "Stripe Invoice", "Note", "Error"],
                filteredCancellationRuns.map((run) => [
                  run.client,
                  run.status,
                  run.triggeredBy,
                  run.started,
                  run.completed,
                  run.finalInvoice,
                  run.stripeInvoice,
                  run.note,
                  run.error,
                ]),
              );
            }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold transition-all hover:opacity-90 flex-shrink-0"
            style={exportButtonStyle}
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>
          {refreshBtn("Refresh", refreshCancellationRuns, cancellationLoading)}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[900px]">
            <thead>
              <tr className="border-b" style={dividerStyle}>
                <th className={thCls + " pl-5"}>Client</th>
                <th className={thCls}>Status</th>
                <th className={thCls}>Triggered By</th>
                <th className={thCls}>Started</th>
                <th className={thCls}>Completed</th>
                <th className={thCls}>Final Invoice</th>
                <th className={thCls}>Stripe Invoice</th>
                <th className={thCls}>Note</th>
                <th className={thCls + " pr-5"}>Error</th>
              </tr>
            </thead>
            <tbody>
              {cancellationLoading ? (
                <tr>
                  <td colSpan={9} className="text-center py-10 text-sm font-semibold" style={subtleTextStyle}>
                    Loading contract cancellation runs...
                  </td>
                </tr>
              ) : cancellationError ? (
                <tr>
                  <td colSpan={9} className="text-center py-10 text-sm text-red-500 font-semibold">
                    {cancellationError}
                  </td>
                </tr>
              ) : filteredCancellationRuns.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-10 text-sm font-semibold" style={subtleTextStyle}>
                    No contract cancellation runs yet.
                  </td>
                </tr>
              ) : (
                filteredCancellationRuns.map((run, idx) => (
                  <tr
                    key={run.id}
                    className="border-b transition-colors as-shell-dropdown-item"
                    style={idx === filteredCancellationRuns.length - 1 ? { borderBottom: "none" } : dividerStyle}
                  >
                    <td className={tdCls + " pl-5 font-bold text-[var(--as-text)]"}>{run.client}</td>
                    <td className={tdCls}><StatusBadge status={run.status} /></td>
                    <td className={tdCls + " text-[var(--as-text-muted)]"}>{run.triggeredBy}</td>
                    <td className={tdCls + " whitespace-nowrap"}>{run.started}</td>
                    <td className={tdCls + " whitespace-nowrap"}>{run.completed}</td>
                    <td className={tdCls + " text-[var(--as-text-subtle)]"}>{run.finalInvoice}</td>
                    <td className={tdCls + " text-[var(--as-text-subtle)]"}>{run.stripeInvoice}</td>
                    <td className={tdCls + " text-[var(--as-text-subtle)]"}>{run.note}</td>
                    <td className={tdCls + " pr-5 text-[var(--as-text-subtle)]"}>{run.error}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AdminLayout>
  );
}
