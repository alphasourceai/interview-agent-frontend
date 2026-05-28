import { useState, useEffect, useRef } from "react";
import { RefreshCw, ChevronDown, ExternalLink } from "lucide-react";
import AdminLayout from "@/components/AdminLayout";
import { useAdminClient } from "@/context/AdminClientContext";
import { supabase } from "@/lib/supabaseClient";

/* ── Types ───────────────────────────────────────────────────── */
type AccomStatus = "Pending" | "Approved" | "Sent" | "Denied";

interface StatusEntry {
  label: string;
  date:  string;
}

interface AccomRequest {
  id:        string;
  clientId:  string;
  candidateId: string;
  name:      string;
  email:     string;
  phone:     string;
  createdAt: string;
  role:      string;
  hasResume: boolean;
  resumeUrl: string;
  request:   string;
  status:    AccomStatus;
  history:   StatusEntry[];
  notes:     string;
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

function parseJsonSafe(text: string): unknown {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function extractErrorMessage(text: string): string {
  if (!text) return "Failed to load accommodation requests.";
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

function normalizeStatus(value: unknown): AccomStatus {
  const status = String(value || "").trim().toLowerCase();
  if (status === "approved") return "Approved";
  if (status === "sent") return "Sent";
  if (status === "denied") return "Denied";
  return "Pending";
}

function formatDateTime(value: unknown): string {
  const raw = String(value || "").trim();
  if (!raw) return "—";
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleString();
}

/* ── Status config ───────────────────────────────────────────── */
const STATUS_OPTIONS: AccomStatus[] = ["Pending", "Approved", "Sent", "Denied"];

const statusStyle: Record<AccomStatus, { bg: string; text: string; border: string }> = {
  Pending:  { bg: "rgba(240,165,0,0.10)",   text: "#C07800", border: "rgba(240,165,0,0.22)"   },
  Approved: { bg: "rgba(2,217,157,0.10)",   text: "#00886A", border: "rgba(2,217,157,0.22)"   },
  Sent:     { bg: "rgba(163,128,246,0.10)", text: "#7C5FCC", border: "rgba(163,128,246,0.22)" },
  Denied:   { bg: "rgba(255,107,107,0.10)", text: "#C94040", border: "rgba(255,107,107,0.22)" },
};

const surfaceCardStyle = {
  backgroundColor: "var(--as-surface)",
  border: "1px solid var(--as-border)",
  boxShadow: "var(--as-shadow)",
};
const dropdownSurfaceStyle = {
  backgroundColor: "var(--as-surface)",
  border: "1px solid var(--as-border)",
  boxShadow: "0 8px 24px rgba(10,21,71,0.12)",
};
const dividerStyle = { borderColor: "var(--as-border)" };
const primaryTextStyle = { color: "var(--as-text)" };
const mutedTextStyle = { color: "var(--as-text-muted)" };
const subtleTextStyle = { color: "var(--as-text-subtle)" };
const fieldSurfaceStyle = {
  backgroundColor: "var(--as-surface)",
  borderColor: "var(--as-border)",
  color: "var(--as-text)",
};

/* ── Per-row status dropdown ─────────────────────────────────── */
function StatusDropdown({
  value,
  onChange,
  open,
  onToggle,
  disabled = false,
}: {
  value: AccomStatus;
  onChange: (s: AccomStatus) => void;
  open: boolean;
  onToggle: () => void;
  disabled?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onToggle();
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open, onToggle]);

  const s = statusStyle[value];

  return (
    <div ref={ref} className="relative w-28">
      <button
        className="w-full flex items-center justify-between gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
        style={{ backgroundColor: s.bg, color: s.text, border: `1px solid ${s.border}` }}
        disabled={disabled}
        onClick={onToggle}
      >
        {value}
        <ChevronDown className={`w-3 h-3 flex-shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div
          className="absolute z-30 top-full mt-1 left-0 w-32 rounded-xl overflow-hidden py-1"
          style={dropdownSurfaceStyle}
        >
          {STATUS_OPTIONS.map((opt) => {
            const os = statusStyle[opt];
            return (
              <button
                key={opt}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold transition-colors text-left as-shell-dropdown-item"
                onClick={() => { onChange(opt); onToggle(); }}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: os.text }}
                />
                <span style={{ color: opt === value ? os.text : "var(--as-text)" }}>{opt}</span>
                {opt === value && <span className="ml-auto text-[10px]" style={{ color: os.text }}>✓</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ── Main page ───────────────────────────────────────────────── */
export default function AdminAccommodationsPage() {
  const {
    selectedClientId,
    loading: adminClientsLoading,
    error: adminClientsError,
  } = useAdminClient();
  const [requests, setRequests] = useState<AccomRequest[]>([]);
  const [requestsLoading, setRequestsLoading] = useState<boolean>(false);
  const [requestsError, setRequestsError] = useState<string>("");
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [actionNotice, setActionNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  /* Per-row state maps */
  const [statuses, setStatuses] = useState<Record<string, AccomStatus>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [savedNotes, setSavedNotes] = useState<Record<string, string>>({});
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [statusSaving, setStatusSaving] = useState<Record<string, boolean>>({});
  const [notesSaving, setNotesSaving] = useState<Record<string, boolean>>({});
  const [sendLinkBusy, setSendLinkBusy] = useState<Record<string, boolean>>({});
  const [resumeBusy, setResumeBusy] = useState<Record<string, boolean>>({});

  /* Filter bar */
  const [filterStatus, setFilterStatus] = useState<AccomStatus | "All">("All");

  useEffect(() => {
    if (!actionNotice) return;
    const timer = setTimeout(() => setActionNotice(null), 3200);
    return () => clearTimeout(timer);
  }, [actionNotice]);

  const getSessionToken = async (): Promise<string> => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const token = String(session?.access_token || "").trim();
    if (!token) throw new Error("Missing session token.");
    return token;
  };

  useEffect(() => {
    let alive = true;

    const loadRequests = async () => {
      if (adminClientsLoading) return;
      if (adminClientsError) {
        if (!alive) return;
        setRequests([]);
        setRequestsError(adminClientsError);
        setRequestsLoading(false);
        return;
      }
      if (!backendBase) {
        if (!alive) return;
        setRequests([]);
        setRequestsError("Missing backend base URL configuration.");
        setRequestsLoading(false);
        return;
      }

      if (!alive) return;
      setRequestsLoading(true);
      setRequestsError("");

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const token = String(session?.access_token || "").trim();
        if (!token) throw new Error("Missing session token.");

        const params = new URLSearchParams();
        if (filterStatus !== "All") params.set("status", filterStatus.toLowerCase());
        if (selectedClientId && selectedClientId !== "all") params.set("client_id", selectedClientId);

        const qs = params.toString();
        const response = await fetch(
          `${backendBase}/admin/accommodation-requests${qs ? `?${qs}` : ""}`,
          {
            method: "GET",
            headers: { Authorization: `Bearer ${token}` },
            credentials: "omit",
          },
        );
        const text = await response.text();
        if (!response.ok) throw new Error(extractErrorMessage(text));

        const payload = parseJsonSafe(text);
        const items =
          payload && typeof payload === "object" && Array.isArray((payload as { items?: unknown }).items)
            ? ((payload as { items: unknown[] }).items || [])
            : [];

        const mappedRequests: AccomRequest[] = items
          .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"))
          .map((item, index) => {
            const roleField = item.role;
            const roleTitle =
              roleField && typeof roleField === "object"
                ? String((roleField as { title?: unknown }).title || "").trim()
                : "";
            const resumeUrl = String(item.resume_url || "").trim();
            const history: StatusEntry[] = [];
            const approvedAt = String(item.approved_at || "").trim();
            const sentAt = String(item.sent_at || "").trim();
            if (approvedAt) history.push({ label: "Approved", date: formatDateTime(approvedAt) });
            if (sentAt) history.push({ label: "Sent", date: formatDateTime(sentAt) });
            return {
              id: String(item.id || `accommodation-${index}`),
              clientId: selectedClientId || "all",
              candidateId: String(item.candidate_id || "").trim(),
              name: String(item.candidate_name || "").trim() || "—",
              email: String(item.candidate_email || "").trim() || "—",
              phone: String(item.candidate_phone || "").trim() || "—",
              createdAt: formatDateTime(item.created_at),
              role: roleTitle || "—",
              hasResume: Boolean(resumeUrl),
              resumeUrl,
              request: String(item.request_text || "").trim() || "—",
              status: normalizeStatus(item.status),
              history,
              notes: String(item.admin_notes || "").trim(),
            };
          });

        if (!alive) return;
        setRequests(mappedRequests);
        setOpenDropdown(null);
        const nextStatuses: Record<string, AccomStatus> = {};
        const nextNotes: Record<string, string> = {};
        mappedRequests.forEach((request) => {
          nextStatuses[request.id] = request.status;
          nextNotes[request.id] = request.notes;
        });
        setStatuses(nextStatuses);
        setNotes(nextNotes);
        setSavedNotes(nextNotes);
      } catch (error) {
        if (!alive) return;
        setRequests([]);
        setRequestsError(error instanceof Error ? error.message : "Failed to load accommodation requests.");
      } finally {
        if (alive) setRequestsLoading(false);
      }
    };

    void loadRequests();
    return () => {
      alive = false;
    };
  }, [selectedClientId, adminClientsLoading, adminClientsError, filterStatus, refreshNonce]);

  const buildHistoryFromItem = (item: Record<string, unknown>): StatusEntry[] => {
    const history: StatusEntry[] = [];
    const approvedAt = String(item.approved_at || "").trim();
    const sentAt = String(item.sent_at || "").trim();
    if (approvedAt) history.push({ label: "Approved", date: formatDateTime(approvedAt) });
    if (sentAt) history.push({ label: "Sent", date: formatDateTime(sentAt) });
    return history;
  };

  const mergeRequestFromItem = (requestId: string, item: Record<string, unknown>) => {
    const nextStatus = normalizeStatus(item.status);
    const nextNotes = String(item.admin_notes || "").trim();
    const nextResumeUrl = String(item.resume_url || "").trim();
    const nextHistory = buildHistoryFromItem(item);
    setStatuses((prev) => ({ ...prev, [requestId]: nextStatus }));
    setNotes((prev) => ({ ...prev, [requestId]: nextNotes }));
    setSavedNotes((prev) => ({ ...prev, [requestId]: nextNotes }));
    setRequests((prev) =>
      prev.map((request) =>
        request.id === requestId
          ? {
              ...request,
              status: nextStatus,
              notes: nextNotes,
              history: nextHistory,
              resumeUrl: nextResumeUrl || request.resumeUrl,
              hasResume: Boolean(nextResumeUrl || request.resumeUrl),
            }
          : request,
      ),
    );
  };

  const updateAccommodation = async (
    requestId: string,
    payload: { status?: string; admin_notes?: string },
    options?: { previousStatus?: AccomStatus; savingKind?: "status" | "notes" },
  ) => {
    if (!backendBase) {
      setActionNotice({ tone: "error", text: "Missing backend base URL configuration." });
      if (options?.previousStatus) {
        setStatuses((prev) => ({ ...prev, [requestId]: options.previousStatus as AccomStatus }));
      }
      return;
    }

    if (options?.savingKind === "status") {
      setStatusSaving((prev) => ({ ...prev, [requestId]: true }));
    } else if (options?.savingKind === "notes") {
      setNotesSaving((prev) => ({ ...prev, [requestId]: true }));
    }

    try {
      const token = await getSessionToken();
      const response = await fetch(`${backendBase}/admin/accommodation-requests/${encodeURIComponent(requestId)}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        credentials: "omit",
        body: JSON.stringify(payload),
      });
      const text = await response.text();
      if (!response.ok) throw new Error(extractErrorMessage(text));
      const parsed = parseJsonSafe(text) as { item?: unknown } | null;
      if (parsed?.item && typeof parsed.item === "object") {
        mergeRequestFromItem(requestId, parsed.item as Record<string, unknown>);
      }

      if (payload.status === "approved") {
        setActionNotice({ tone: "success", text: "Request approved." });
      } else if (payload.status === "denied") {
        setActionNotice({ tone: "success", text: "Request denied." });
      } else if (Object.prototype.hasOwnProperty.call(payload, "admin_notes")) {
        setActionNotice({ tone: "success", text: "Notes saved." });
      } else {
        setActionNotice({ tone: "success", text: "Request updated." });
      }
    } catch (error) {
      if (options?.previousStatus) {
        setStatuses((prev) => ({ ...prev, [requestId]: options.previousStatus as AccomStatus }));
      }
      setActionNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "Could not update accommodation request.",
      });
    } finally {
      if (options?.savingKind === "status") {
        setStatusSaving((prev) => ({ ...prev, [requestId]: false }));
      } else if (options?.savingKind === "notes") {
        setNotesSaving((prev) => ({ ...prev, [requestId]: false }));
      }
    }
  };

  const handleStatusChange = async (request: AccomRequest, nextStatus: AccomStatus) => {
    const requestId = request.id;
    if (!requestId || statusSaving[requestId]) return;
    const previousStatus = statuses[requestId] ?? request.status;
    setStatuses((prev) => ({ ...prev, [requestId]: nextStatus }));
    setActionNotice(null);
    await updateAccommodation(
      requestId,
      { status: nextStatus.toLowerCase() },
      { previousStatus, savingKind: "status" },
    );
  };

  const handleSaveNotes = async (request: AccomRequest) => {
    const requestId = request.id;
    if (!requestId || notesSaving[requestId]) return;
    const nextNotes = String(notes[requestId] || "").trim();
    const previousNotes = String(savedNotes[requestId] || "").trim();
    if (nextNotes === previousNotes) return;
    setActionNotice(null);
    await updateAccommodation(
      requestId,
      { admin_notes: nextNotes },
      { savingKind: "notes" },
    );
  };

  const sendTextInterviewLink = async (request: AccomRequest) => {
    const requestId = request.id;
    if (!requestId || sendLinkBusy[requestId]) return;
    if (!backendBase) {
      setActionNotice({ tone: "error", text: "Missing backend base URL configuration." });
      return;
    }

    setActionNotice(null);
    setSendLinkBusy((prev) => ({ ...prev, [requestId]: true }));
    try {
      const token = await getSessionToken();
      const response = await fetch(
        `${backendBase}/admin/accommodation-requests/${encodeURIComponent(requestId)}/send-text-link`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          credentials: "omit",
          body: JSON.stringify({}),
        },
      );
      const text = await response.text();
      if (!response.ok) throw new Error(extractErrorMessage(text));
      setActionNotice({ tone: "success", text: "Text interview link sent." });
      setRefreshNonce((value) => value + 1);
    } catch (error) {
      setActionNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "Failed to send link.",
      });
    } finally {
      setSendLinkBusy((prev) => ({ ...prev, [requestId]: false }));
    }
  };

  const openResumeForRequest = async (request: AccomRequest) => {
    const requestId = request.id;
    if (!requestId || resumeBusy[requestId]) return;
    if (!request.hasResume) return;

    setActionNotice(null);
    setResumeBusy((prev) => ({ ...prev, [requestId]: true }));
    try {
      let targetUrl = "";
      if (request.candidateId && backendBase) {
        const token = await getSessionToken();
        const response = await fetch(
          `${backendBase}/files/resume-signed-url?candidate_id=${encodeURIComponent(request.candidateId)}`,
          {
            method: "GET",
            headers: { Authorization: `Bearer ${token}` },
            credentials: "omit",
          },
        );
        const text = await response.text();
        if (response.ok) {
          const payload = parseJsonSafe(text) as { url?: unknown } | null;
          targetUrl = String(payload?.url || "").trim();
        }
      }
      if (!targetUrl) {
        targetUrl = String(request.resumeUrl || "").trim();
      }
      if (!targetUrl) throw new Error("Could not open resume.");

      window.open(targetUrl, "_blank", "noopener,noreferrer");
      setActionNotice({ tone: "success", text: "Resume opened." });
    } catch (error) {
      setActionNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "Could not open resume.",
      });
    } finally {
      setResumeBusy((prev) => ({ ...prev, [requestId]: false }));
    }
  };

  /* Filter by client + status */
  const filtered = requests
    .filter((r) => filterStatus === "All" || statuses[r.id] === filterStatus);

  const selectCls =
    "px-3 py-2 rounded-xl text-sm font-medium border appearance-none " +
    "focus:outline-none focus:border-[#A380F6] transition-colors cursor-pointer";

  return (
    <AdminLayout title="Accommodation Requests">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-black" style={primaryTextStyle}>Accommodation Requests</h2>
      </div>

      {/* ── Filter bar ─────────────────────────────────────── */}
      <div
        className="rounded-2xl px-5 py-3.5 mb-5 flex flex-wrap items-center gap-3"
        style={surfaceCardStyle}
      >
        <span className="text-xs font-black uppercase tracking-widest" style={mutedTextStyle}>Status</span>
        <div className="relative w-48">
          <select
            className={selectCls + " w-full pr-8"}
            style={fieldSurfaceStyle}
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as AccomStatus | "All")}
          >
            <option value="All">All</option>
            {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none" style={subtleTextStyle} />
        </div>

        <button
          onClick={() => setRefreshNonce((value) => value + 1)}
          disabled={requestsLoading}
          className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold text-white transition-opacity hover:opacity-90"
          style={{ backgroundColor: "#A380F6" }}
        >
          <RefreshCw className={`w-3.5 h-3.5 ${requestsLoading ? "animate-spin" : ""}`} />
          Refresh
        </button>

        <span className="ml-auto text-xs font-semibold" style={subtleTextStyle}>
          {filtered.length} request{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>
      {actionNotice && (
        <div
          className="px-4 py-2.5 rounded-xl text-sm font-semibold mb-5"
          style={{
            border: actionNotice.tone === "error" ? "1px solid rgba(239,68,68,0.25)" : "1px solid rgba(2,217,157,0.25)",
            backgroundColor: actionNotice.tone === "error" ? "rgba(239,68,68,0.08)" : "rgba(2,217,157,0.10)",
            color: actionNotice.tone === "error" ? "#DC2626" : "#047857",
          }}
        >
          {actionNotice.text}
        </div>
      )}

      {/* ── Table ──────────────────────────────────────────── */}
      <div
        className="rounded-2xl overflow-hidden"
        style={surfaceCardStyle}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[900px]">
            <thead>
              <tr className="border-b" style={dividerStyle}>
                {[
                  ["Candidate", "pl-5 text-left w-[220px]"],
                  ["Role",      "text-left w-[130px]"],
                  ["Request",   "text-left w-[180px]"],
                  ["Status",    "text-left w-[150px]"],
                  ["Notes",     "text-left w-[160px]"],
                  ["Actions",   "text-left pr-5 w-[110px]"],
                ].map(([label, cls]) => (
                  <th
                    key={label}
                    className={`px-4 py-3.5 text-[10px] font-black uppercase tracking-widest ${cls}`}
                    style={mutedTextStyle}
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {requestsLoading ? (
                <tr>
                  <td colSpan={6} className="text-center py-14 text-sm font-semibold" style={subtleTextStyle}>
                    Loading accommodation requests...
                  </td>
                </tr>
              ) : requestsError ? (
                <tr>
                  <td colSpan={6} className="text-center py-14 text-sm text-red-500 font-semibold">
                    {requestsError}
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-14 text-sm font-semibold" style={subtleTextStyle}>
                    No accommodation requests match this filter.
                  </td>
                </tr>
              ) : (
                filtered.map((r, idx) => {
                  const rowStatus   = statuses[r.id] ?? r.status;
                  const rowNotes    = notes[r.id] ?? "";
                  const isSendable  = rowStatus === "Approved";
                  const isLast      = idx === filtered.length - 1;

                  return (
                    <tr
                      key={r.id}
                      className="border-b transition-colors align-top as-shell-dropdown-item"
                      style={isLast ? { borderBottom: "none" } : dividerStyle}
                    >
                      {/* ── Candidate ─────────────────────── */}
                      <td className="px-4 py-4 pl-5">
                        <p className="font-bold leading-snug" style={primaryTextStyle}>{r.name}</p>
                        <p className="text-[11px] mt-0.5" style={mutedTextStyle}>{r.email}</p>
                        <p className="text-[11px]" style={mutedTextStyle}>{r.phone}</p>
                        <p className="text-[11px] mt-0.5" style={subtleTextStyle}>
                          <span className="font-semibold">Created</span> {r.createdAt}
                        </p>
                      </td>

                      {/* ── Role ──────────────────────────── */}
                      <td className="px-4 py-4">
                        <p className="font-bold leading-snug text-sm" style={primaryTextStyle}>{r.role}</p>
                        {r.hasResume ? (
                          <button
                            onClick={() => {
                              void openResumeForRequest(r);
                            }}
                            disabled={resumeBusy[r.id] === true}
                            className="flex items-center gap-1 mt-1 text-xs font-semibold transition-opacity hover:opacity-75"
                            style={{ color: "#A380F6" }}
                          >
                            <ExternalLink className="w-3 h-3" />
                            {resumeBusy[r.id] === true ? "Opening..." : "Resume"}
                          </button>
                        ) : (
                          <p className="text-xs font-medium mt-1" style={subtleTextStyle}>No resume</p>
                        )}
                      </td>

                      {/* ── Request ───────────────────────── */}
                      <td className="px-4 py-4">
                        <p className="text-xs leading-relaxed" style={mutedTextStyle}>{r.request}</p>
                      </td>

                      {/* ── Status ────────────────────────── */}
                      <td className="px-4 py-4">
                        <StatusDropdown
                          value={rowStatus}
                          onChange={(s) => {
                            void handleStatusChange(r, s);
                          }}
                          open={openDropdown === r.id}
                          onToggle={() => setOpenDropdown((prev) => (prev === r.id ? null : r.id))}
                          disabled={statusSaving[r.id] === true}
                        />

                        {/* Status history */}
                        {r.history.length > 0 && (
                          <div className="mt-2 space-y-0.5">
                            {r.history.map((h, i) => (
                              <p key={i} className="text-[10px] leading-relaxed" style={subtleTextStyle}>
                                <span className="font-semibold">{h.label}</span> {h.date}
                              </p>
                            ))}
                          </div>
                        )}
                      </td>

                      {/* ── Notes ─────────────────────────── */}
                      <td className="px-4 py-4">
                        <input
                          type="text"
                          placeholder="Admin notes"
                          value={rowNotes}
                          onChange={(e) => setNotes((prev) => ({ ...prev, [r.id]: e.target.value }))}
                          className="w-full px-2.5 py-2 rounded-xl text-xs font-medium border placeholder:text-[var(--as-text-subtle)] focus:outline-none focus:border-[#A380F6] transition-colors"
                          style={fieldSurfaceStyle}
                        />
                        <button
                          disabled={notesSaving[r.id] === true || rowNotes.trim() === String(savedNotes[r.id] || "").trim()}
                          className="mt-2 w-full px-2.5 py-1.5 rounded-full text-[11px] font-bold transition-all hover:opacity-90"
                          style={{
                            backgroundColor:
                              rowNotes !== savedNotes[r.id] ? "#A380F6" : "color-mix(in srgb, var(--as-text) 6%, transparent)",
                            color: rowNotes !== savedNotes[r.id] ? "white" : "var(--as-text-subtle)",
                          }}
                          onClick={() => {
                            void handleSaveNotes(r);
                          }}
                        >
                          {notesSaving[r.id] === true ? "Saving..." : "Save Notes"}
                        </button>
                      </td>

                      {/* ── Actions ───────────────────────── */}
                      <td className="px-4 py-4 pr-5">
                        <button
                          onClick={() => {
                            void sendTextInterviewLink(r);
                          }}
                          disabled={!isSendable || sendLinkBusy[r.id] === true}
                          className="w-full px-3 py-2 rounded-full text-xs font-bold text-white transition-all"
                          style={{
                            backgroundColor: isSendable ? "#A380F6" : "color-mix(in srgb, var(--as-text) 8%, transparent)",
                            color:           isSendable ? "white"   : "var(--as-text-subtle)",
                            cursor:          isSendable ? "pointer" : "not-allowed",
                          }}
                        >
                          {sendLinkBusy[r.id] === true ? "Sending..." : "Send Link"}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AdminLayout>
  );
}
