import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronUp, FileText, Copy, Trash2, Upload } from "lucide-react";
import AdminLayout from "@/components/AdminLayout";
import { useAdminClient } from "@/context/AdminClientContext";
import { supabase } from "@/lib/supabaseClient";

/* ── Types ───────────────────────────────────────────────────── */
type RoleType = "Basic" | "Detailed" | "Technical";
type SortKey  = "name" | "created" | "type";
type SortDir  = "asc" | "desc";
type RoleStatusFilter = "active" | "inactive" | "all";

interface Role {
  id: string;
  clientId: string;
  clientName: string;
  name: string;
  token: string;
  created: string;
  createdTs: number;
  type: RoleType;
  hasJD: boolean;
  hasRubric: boolean;
  rubricQuestions: string[];
  includedInterviewsPerRole: number | null;
  purchasedInterviews: number | null;
  usedInterviews: number | null;
  remainingInterviews: number | null;
  status?: string | null;
  closedAt?: string | null;
  closedBy?: string | null;
  inactiveReason?: string | null;
  isInactive?: boolean;
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
  if (!text) return "Failed to load roles.";
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

function normalizeRoleType(value: unknown): RoleType {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "technical") return "Technical";
  if (normalized === "detailed") return "Detailed";
  return "Basic";
}

function formatRoleCreated(value: unknown): { text: string; ts: number } {
  const raw = String(value || "").trim();
  if (!raw) return { text: "—", ts: 0 };
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return { text: "—", ts: 0 };
  return { text: parsed.toLocaleString(), ts: parsed.getTime() };
}

function toWholeNonNegative(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.floor(n));
}

function extractRubricQuestions(rubric: unknown): string[] {
  const questions: string[] = [];
  const seen = new Set<string>();
  const add = (value: unknown) => {
    const text = value == null ? "" : String(value).trim();
    if (!text || seen.has(text)) return;
    seen.add(text);
    questions.push(text);
  };
  const handleItem = (item: unknown) => {
    if (item == null) return;
    if (typeof item === "string" || typeof item === "number") {
      add(item);
      return;
    }
    if (Array.isArray(item)) {
      item.forEach(handleItem);
      return;
    }
    if (typeof item === "object") {
      const obj = item as Record<string, unknown>;
      const candidate = obj.question || obj.text || obj.prompt || obj.label || obj.value;
      if (candidate) add(candidate);
      if (Array.isArray(obj.questions)) obj.questions.forEach(handleItem);
      if (Array.isArray(obj.rubric)) obj.rubric.forEach(handleItem);
      if (Array.isArray(obj.items)) obj.items.forEach(handleItem);
      if (Array.isArray(obj.prompts)) obj.prompts.forEach(handleItem);
    }
  };

  if (rubric == null) return questions;
  if (typeof rubric === "string") {
    const raw = rubric.trim();
    if (!raw) return questions;
    if ((raw.startsWith("{") && raw.endsWith("}")) || (raw.startsWith("[") && raw.endsWith("]"))) {
      try {
        handleItem(JSON.parse(raw));
        return questions;
      } catch {
        add(raw);
        return questions;
      }
    }
    add(raw);
    return questions;
  }

  handleItem(rubric);
  return questions;
}

const typeColors: Record<RoleType, { bg: string; text: string }> = {
  Basic:     { bg: "rgba(163,128,246,0.12)", text: "#7C5FCC" },
  Detailed:  { bg: "rgba(2,171,224,0.12)",   text: "#0285B0" },
  Technical: { bg: "rgba(2,217,157,0.12)",   text: "#009E73" },
};

const inputCls =
  "w-full px-3 py-2 rounded-xl text-sm text-[#0A1547] font-medium " +
  "border border-[rgba(10,21,71,0.10)] bg-white " +
  "placeholder:text-[#0A1547]/30 focus:outline-none focus:border-[#A380F6] transition-colors";

const selectCls =
  "w-full px-3 py-2 rounded-xl text-sm text-[#0A1547] font-medium " +
  "border border-[rgba(10,21,71,0.10)] bg-white appearance-none " +
  "focus:outline-none focus:border-[#A380F6] transition-colors cursor-pointer";

export default function AdminRolesPage() {
  const {
    selectedClient,
    selectedClientId,
    clients: adminClients,
    loading: adminClientsLoading,
    error: adminClientsError,
  } = useAdminClient();
  const [sortKey, setSortKey] = useState<SortKey>("created");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [copied, setCopied] = useState<string | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [rolesLoading, setRolesLoading] = useState<boolean>(false);
  const [rolesError, setRolesError] = useState<string>("");
  const [roleSearch, setRoleSearch] = useState("");
  const [roleStatusFilter, setRoleStatusFilter] = useState<RoleStatusFilter>("active");
  const [actionNotice, setActionNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [openingJd, setOpeningJd] = useState<Record<string, boolean>>({});
  const [loadingRubric, setLoadingRubric] = useState<Record<string, boolean>>({});
  const [deletingRoles, setDeletingRoles] = useState<Record<string, boolean>>({});
  const [updatingRoleStatus, setUpdatingRoleStatus] = useState<Record<string, boolean>>({});
  const [creatingRole, setCreatingRole] = useState<boolean>(false);
  const [jdFile, setJdFile] = useState<File | null>(null);
  const [rubricModal, setRubricModal] = useState<{ roleName: string; questions: string[] } | null>(null);
  const [roleStatusConfirm, setRoleStatusConfirm] = useState<{ role: Role; nextStatus: "active" | "inactive" } | null>(null);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [form, setForm] = useState({ title: "", type: "Basic", jdFileName: "" });

  const clientNameById = useMemo(
    () =>
      Object.fromEntries(
        adminClients
          .filter((client) => client.id !== "all")
          .map((client) => [client.id, client.name]),
      ),
    [adminClients],
  );

  useEffect(() => {
    if (!actionNotice) return;
    const timer = setTimeout(() => setActionNotice(null), 3200);
    return () => clearTimeout(timer);
  }, [actionNotice]);

  useEffect(() => {
    setRoleSearch("");
    setRoleStatusConfirm(null);
  }, [selectedClientId]);

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

    const loadRoles = async () => {
      if (adminClientsLoading) return;
      if (adminClientsError) {
        if (!alive) return;
        setRoles([]);
        setRolesError(adminClientsError);
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
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const token = String(session?.access_token || "").trim();
        if (!token) throw new Error("Missing session token.");

        const isAllClients = selectedClientId === "all";
        const statusParam = `status=${encodeURIComponent(roleStatusFilter)}`;
        const url = isAllClients
          ? `${backendBase}/admin/roles?${statusParam}`
          : `${backendBase}/admin/roles?client_id=${encodeURIComponent(selectedClientId)}&${statusParam}`;

        const response = await fetch(url, {
          method: "GET",
          headers: { Authorization: `Bearer ${token}` },
          credentials: "omit",
        });

        const text = await response.text();
        if (!response.ok) throw new Error(extractErrorMessage(text));

        const payload = parseJsonSafe(text);
        const items = payload && typeof payload === "object" && Array.isArray((payload as { items?: unknown }).items)
          ? (payload as { items: unknown[] }).items
          : [];

        const mappedRoles: Role[] = items
          .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"))
          .map((item) => {
            const roleId = String(item.id || "").trim();
            const roleClientId = String(item.client_id || "").trim();
            const created = formatRoleCreated(item.created_at);
            const rubricQuestions = extractRubricQuestions(item.rubric);
            const status = String(item.status || "active").trim().toLowerCase() || "active";
            return {
              id: roleId,
              clientId: roleClientId,
              clientName: String(clientNameById[roleClientId] || "").trim(),
              name: String(item.title || "").trim() || "Untitled role",
              token: String(item.slug_or_token || roleId).trim(),
              created: created.text,
              createdTs: created.ts,
              type: normalizeRoleType(item.interview_type),
              hasJD: Boolean(String(item.job_description_url || "").trim()),
              hasRubric: rubricQuestions.length > 0,
              rubricQuestions,
              includedInterviewsPerRole: toWholeNonNegative(item.included_interviews_per_role),
              purchasedInterviews: toWholeNonNegative(item.purchased_interviews),
              usedInterviews: toWholeNonNegative(item.used_interviews),
              remainingInterviews: toWholeNonNegative(item.remaining_interviews),
              status,
              closedAt: String(item.closed_at || "").trim() || null,
              closedBy: String(item.closed_by || "").trim() || null,
              inactiveReason: String(item.inactive_reason || "").trim() || null,
              isInactive: status === "inactive",
            };
          })
          .filter((item) => Boolean(item.id));

        if (!alive) return;
        setRoles(mappedRoles);
      } catch (error) {
        if (!alive) return;
        setRoles([]);
        setRolesError(error instanceof Error ? error.message : "Failed to load roles.");
      } finally {
        if (alive) setRolesLoading(false);
      }
    };

    void loadRoles();
    return () => {
      alive = false;
    };
  }, [selectedClientId, adminClientsLoading, adminClientsError, clientNameById, roleStatusFilter, refreshNonce]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  };

  /* Filter by selected client */
  const filteredByClient = selectedClientId === "all"
    ? roles
    : roles.filter((r) => r.clientId === selectedClientId);

  const roleSearchTerm = roleSearch.trim().toLowerCase();
  const filtered = roleSearchTerm
    ? filteredByClient.filter((role) =>
        role.name.toLowerCase().includes(roleSearchTerm),
      )
    : filteredByClient;

  /* Sort */
  const sorted = [...filtered].sort((a, b) => {
    let av: string | number = "";
    let bv: string | number = "";
    if (sortKey === "name")    { av = a.name.toLowerCase(); bv = b.name.toLowerCase(); }
    if (sortKey === "created") { av = a.createdTs; bv = b.createdTs; }
    if (sortKey === "type")    { av = a.type.toLowerCase(); bv = b.type.toLowerCase(); }
    if (av < bv) return sortDir === "asc" ? -1 : 1;
    if (av > bv) return sortDir === "asc" ? 1 : -1;
    return 0;
  });

  const safeCopy = async (text: string): Promise<boolean> => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return true;
      }
      throw new Error("clipboard_api_unavailable");
    } catch {
      try {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.style.position = "fixed";
        textarea.style.top = "-9999px";
        textarea.style.left = "-9999px";
        textarea.setAttribute("readonly", "");
        document.body.appendChild(textarea);
        textarea.select();
        textarea.setSelectionRange(0, textarea.value.length);
        const successful = document.execCommand("copy");
        textarea.remove();
        return successful;
      } catch {
        return false;
      }
    }
  };

  const buildInterviewShareUrl = (token: string): string => {
    const normalizedToken = String(token || "").trim();
    const origin =
      typeof window !== "undefined" && window.location
        ? trimTrailingSlashes(window.location.origin)
        : "";
    return `${origin}/interview-access/${encodeURIComponent(normalizedToken)}`;
  };

  const handleCopy = async (role: Role) => {
    if (role.isInactive) {
      setActionNotice({ tone: "error", text: "Inactive roles cannot accept new candidates." });
      return;
    }
    const token = String(role.token || "").trim();
    if (!token) {
      setActionNotice({ tone: "error", text: "Missing role token." });
      return;
    }
    const ok = await safeCopy(buildInterviewShareUrl(token));
    if (!ok) {
      setActionNotice({ tone: "error", text: "Could not copy link." });
      return;
    }
    setCopied(role.id);
    setTimeout(() => setCopied(null), 1500);
    setActionNotice({ tone: "success", text: "Link copied." });
  };

  const createRole = async () => {
    if (creatingRole) return;
    if (!backendBase) {
      setActionNotice({ tone: "error", text: "Missing backend base URL configuration." });
      return;
    }

    const clientId = String(selectedClientId || "").trim();
    if (!clientId || clientId === "all") {
      setActionNotice({ tone: "error", text: "Select a specific client to create a role." });
      return;
    }

    const title = String(form.title || "").trim();
    if (!title) {
      setActionNotice({ tone: "error", text: "Role title is required." });
      return;
    }

    const normalizedType = String(form.type || "").trim().toUpperCase();
    const interviewType = ["BASIC", "DETAILED", "TECHNICAL"].includes(normalizedType) ? normalizedType : "BASIC";
    if (jdFile) {
      const ext = String(jdFile.name || "").toLowerCase().split(".").pop() || "";
      if (!["pdf", "docx"].includes(ext)) {
        setActionNotice({ tone: "error", text: "JD file must be a PDF or DOCX." });
        return;
      }
    }

    setActionNotice(null);
    setCreatingRole(true);
    let createdRoleId = "";
    let roleCreated = false;
    try {
      const token = await getSessionToken();
      const response = await fetch(`${backendBase}/admin/roles`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        credentials: "omit",
        body: JSON.stringify({
          client_id: clientId,
          title,
          interview_type: interviewType,
        }),
      });
      const text = await response.text();
      if (!response.ok) throw new Error(extractErrorMessage(text));
      roleCreated = true;
      const payload = parseJsonSafe(text) as { item?: { id?: unknown } | null; role?: { id?: unknown } | null } | null;
      createdRoleId = String(payload?.item?.id || payload?.role?.id || "").trim();
      if (jdFile && !createdRoleId) {
        throw new Error("Role created, but JD upload could not start: missing role id in create response.");
      }

      if (jdFile && createdRoleId) {
        const uploadFormData = new FormData();
        uploadFormData.append("file", jdFile);
        uploadFormData.append("client_id", clientId);
        uploadFormData.append("role_id", createdRoleId);
        const uploadResponse = await fetch(
          `${backendBase}/roles-upload/upload-jd?client_id=${encodeURIComponent(clientId)}&role_id=${encodeURIComponent(createdRoleId)}`,
          {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
            credentials: "omit",
            body: uploadFormData,
          },
        );
        const uploadText = await uploadResponse.text();
        if (!uploadResponse.ok) {
          throw new Error(`Role created, but JD upload failed: ${extractErrorMessage(uploadText)}`);
        }
      }

      setForm({ title: "", type: "Basic", jdFileName: "" });
      setJdFile(null);
      setActionNotice({ tone: "success", text: "Role created." });
      setRefreshNonce((value) => value + 1);
    } catch (error) {
      if (roleCreated) {
        setRefreshNonce((value) => value + 1);
      }
      setActionNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "Could not create role.",
      });
    } finally {
      setCreatingRole(false);
    }
  };

  const openRoleJd = async (role: Role) => {
    if (!role.id || openingJd[role.id]) return;
    if (!backendBase) {
      setActionNotice({ tone: "error", text: "Missing backend base URL configuration." });
      return;
    }

    setActionNotice(null);
    setOpeningJd((prev) => ({ ...prev, [role.id]: true }));
    try {
      const token = await getSessionToken();
      const response = await fetch(`${backendBase}/api/roles/${encodeURIComponent(role.id)}/jd-signed-url`, {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
        credentials: "omit",
      });
      const text = await response.text();
      if (!response.ok) throw new Error(extractErrorMessage(text));
      const payload = parseJsonSafe(text) as { url?: unknown } | null;
      const url = String(payload?.url || "").trim();
      if (!url) throw new Error("Could not open Job Description.");
      window.open(url, "_blank", "noopener,noreferrer");
      setActionNotice({ tone: "success", text: "Job description opened." });
    } catch (error) {
      setActionNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "Could not open Job Description.",
      });
    } finally {
      setOpeningJd((prev) => ({ ...prev, [role.id]: false }));
    }
  };

  const openRoleRubric = async (role: Role) => {
    if (!role.id || loadingRubric[role.id]) return;

    if (role.rubricQuestions.length > 0) {
      setRubricModal({ roleName: role.name, questions: role.rubricQuestions });
      return;
    }

    if (!backendBase) {
      setActionNotice({ tone: "error", text: "Missing backend base URL configuration." });
      return;
    }

    const clientId = String(role.clientId || "").trim() || String(selectedClientId || "").trim();
    if (!clientId || clientId === "all") {
      setActionNotice({ tone: "error", text: "Select a client to view role config." });
      return;
    }

    setActionNotice(null);
    setLoadingRubric((prev) => ({ ...prev, [role.id]: true }));
    try {
      const token = await getSessionToken();
      const response = await fetch(
        `${backendBase}/admin/roles/${encodeURIComponent(role.id)}/interview-config?client_id=${encodeURIComponent(clientId)}`,
        {
          method: "GET",
          headers: { Authorization: `Bearer ${token}` },
          credentials: "omit",
        },
      );
      const text = await response.text();
      if (!response.ok) throw new Error(extractErrorMessage(text));
      const payload = parseJsonSafe(text) as { item?: unknown } | null;
      const item = payload?.item && typeof payload.item === "object"
        ? (payload.item as { rubric_questions?: unknown })
        : null;
      const questions = Array.isArray(item?.rubric_questions)
        ? item.rubric_questions.map((q) => String(q || "").trim()).filter(Boolean)
        : [];
      if (!questions.length) throw new Error("No rubric questions found.");
      setRubricModal({ roleName: role.name, questions });
    } catch (error) {
      setActionNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "Could not load role config.",
      });
    } finally {
      setLoadingRubric((prev) => ({ ...prev, [role.id]: false }));
    }
  };

  const deleteRole = async (role: Role) => {
    if (!role.id || deletingRoles[role.id]) return;
    if (!backendBase) {
      setActionNotice({ tone: "error", text: "Missing backend base URL configuration." });
      return;
    }

    const clientId = String(role.clientId || "").trim() || String(selectedClientId || "").trim();
    if (!clientId || clientId === "all") {
      setActionNotice({ tone: "error", text: "Select a client to perform this action." });
      return;
    }
    if (!window.confirm(`Delete role "${role.name}"? This cannot be undone.`)) return;

    setActionNotice(null);
    setDeletingRoles((prev) => ({ ...prev, [role.id]: true }));
    try {
      const token = await getSessionToken();
      const response = await fetch(
        `${backendBase}/admin/roles?id=${encodeURIComponent(role.id)}&client_id=${encodeURIComponent(clientId)}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
          credentials: "omit",
        },
      );

      if (!response.ok) {
        const text = await response.text();
        if (response.status !== 404) throw new Error(extractErrorMessage(text));
        const fallbackResponse = await fetch(`${backendBase}/admin/roles/delete`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          credentials: "omit",
          body: JSON.stringify({ id: role.id, client_id: clientId }),
        });
        const fallbackText = await fallbackResponse.text();
        if (!fallbackResponse.ok) throw new Error(extractErrorMessage(fallbackText));
      }

      setRoles((prev) => prev.filter((item) => item.id !== role.id));
      setActionNotice({ tone: "success", text: "Role deleted." });
      setRefreshNonce((value) => value + 1);
    } catch (error) {
      setActionNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "Could not delete role.",
      });
    } finally {
      setDeletingRoles((prev) => ({ ...prev, [role.id]: false }));
    }
  };

  const updateRoleStatus = async (role: Role, nextStatus: "active" | "inactive") => {
    if (!role.id || updatingRoleStatus[role.id]) return;
    if (!backendBase) {
      setActionNotice({ tone: "error", text: "Missing backend base URL configuration." });
      return;
    }

    const clientId = String(role.clientId || "").trim() || String(selectedClientId || "").trim();
    if (!clientId || clientId === "all") {
      setActionNotice({ tone: "error", text: "Select a client to perform this action." });
      return;
    }

    setActionNotice(null);
    setUpdatingRoleStatus((prev) => ({ ...prev, [role.id]: true }));
    try {
      const token = await getSessionToken();
      const response = await fetch(`${backendBase}/admin/roles/${encodeURIComponent(role.id)}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        credentials: "omit",
        body: JSON.stringify(
          nextStatus === "inactive"
            ? { status: "inactive", client_id: clientId, inactive_reason: "Closed by admin" }
            : { status: "active", client_id: clientId },
        ),
      });
      const text = await response.text();
      if (!response.ok) throw new Error(extractErrorMessage(text) || "Could not update role.");
      setActionNotice({
        tone: "success",
        text: nextStatus === "inactive" ? "Role closed." : "Role reopened.",
      });
      setRefreshNonce((value) => value + 1);
    } catch (error) {
      setActionNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "Could not update role.",
      });
    } finally {
      setUpdatingRoleStatus((prev) => ({ ...prev, [role.id]: false }));
    }
  };

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <ChevronDown className="w-3 h-3 text-[#0A1547]/20 ml-0.5 flex-shrink-0" />;
    return sortDir === "asc"
      ? <ChevronUp   className="w-3 h-3 text-[#A380F6] ml-0.5 flex-shrink-0" />
      : <ChevronDown className="w-3 h-3 text-[#A380F6] ml-0.5 flex-shrink-0" />;
  }

  /* Determine if we're showing a client column */
  const showClient = selectedClient.id === "all";

  return (
    <AdminLayout title="Roles">

      {/* ── Page header ──────────────────────────────────── */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-black text-[#0A1547]">Roles</h2>
      </div>
      {actionNotice && (
        <div
          className="mb-4 px-4 py-2.5 rounded-xl text-sm font-semibold"
          style={{
            border: actionNotice.tone === "error" ? "1px solid rgba(239,68,68,0.25)" : "1px solid rgba(2,217,157,0.25)",
            backgroundColor: actionNotice.tone === "error" ? "rgba(239,68,68,0.08)" : "rgba(2,217,157,0.10)",
            color: actionNotice.tone === "error" ? "#DC2626" : "#047857",
          }}
        >
          {actionNotice.text}
        </div>
      )}

      {/* ── Create role form ──────────────────────────────── */}
      <div
        className="bg-white rounded-2xl p-5 mb-5"
        style={{ border: "1px solid rgba(10,21,71,0.07)", boxShadow: "0 2px 12px rgba(10,21,71,0.04)" }}
      >
        <div className="flex gap-3 flex-wrap">
          <input
            className={inputCls + " flex-1 min-w-36"}
            placeholder="Role title"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
          <div className="relative w-40 flex-shrink-0">
            <select
              className={selectCls}
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
            >
              <option>Basic</option>
              <option>Detailed</option>
              <option>Technical</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#0A1547]/30 pointer-events-none" />
          </div>

          {/* JD file upload */}
          <label
            className="flex-1 min-w-48 flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-[#0A1547]/40 font-medium border border-dashed border-[rgba(10,21,71,0.18)] bg-white cursor-pointer hover:border-[#A380F6]/50 hover:text-[#A380F6]/60 transition-colors"
          >
            <Upload className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="truncate">
              {form.jdFileName || "Drag JD file here or click to browse"}
            </span>
            <input
              type="file"
              className="hidden"
              accept=".pdf,.docx"
              onChange={(e) => {
                const file = e.target.files?.[0] ?? null;
                setJdFile(file);
                setForm({ ...form, jdFileName: file?.name ?? "" });
              }}
            />
          </label>

          <button
            type="button"
            onClick={() => {
              void createRole();
            }}
            disabled={creatingRole}
            className="flex-shrink-0 px-5 py-2 rounded-full text-sm font-bold text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: "#A380F6" }}
          >
            {creatingRole ? "Creating..." : "Create"}
          </button>
        </div>
      </div>

      {/* ── Search ────────────────────────────────────────── */}
      <div
        className="bg-white rounded-2xl px-5 py-3.5 mb-5 flex flex-wrap items-center gap-3"
        style={{ border: "1px solid rgba(10,21,71,0.07)", boxShadow: "0 2px 12px rgba(10,21,71,0.04)" }}
      >
        <input
          className={inputCls + " max-w-sm"}
          placeholder="Search role name..."
          value={roleSearch}
          onChange={(e) => setRoleSearch(e.target.value)}
        />
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-black uppercase tracking-widest text-[#0A1547]/40">Status</span>
          <div className="inline-flex items-center rounded-full bg-[#0A1547]/5 p-1">
            {(["active", "inactive", "all"] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setRoleStatusFilter(value)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${
                  roleStatusFilter === value
                    ? "bg-white text-[#0A1547] shadow-sm"
                    : "text-[#0A1547]/45 hover:text-[#0A1547]/70"
                }`}
              >
                {value === "active" ? "Active" : value === "inactive" ? "Inactive" : "All"}
              </button>
            ))}
          </div>
        </div>
        {roleSearch && (
          <button
            type="button"
            className="px-3 py-2 rounded-full text-xs font-bold text-[#0A1547]/55 bg-[#0A1547]/5 hover:bg-[#0A1547]/10 transition-colors"
            onClick={() => setRoleSearch("")}
          >
            Clear
          </button>
        )}
        <p className="text-xs text-[#0A1547]/35 font-semibold ml-auto">
          {sorted.length} of {filteredByClient.length} role{filteredByClient.length !== 1 ? "s" : ""}
        </p>
      </div>

      {/* ── Roles table ───────────────────────────────────── */}
      <div
        className="bg-white rounded-2xl overflow-hidden"
        style={{ border: "1px solid rgba(10,21,71,0.07)", boxShadow: "0 2px 12px rgba(10,21,71,0.04)" }}
      >
        {/* Header */}
        <div
          className={`grid items-center px-5 py-3 border-b border-gray-100 ${
            showClient
              ? "grid-cols-[minmax(160px,1fr)_110px_120px_90px_110px_120px_56px_56px_110px_112px]"
              : "grid-cols-[minmax(180px,1fr)_120px_90px_110px_120px_56px_56px_110px_112px]"
          }`}
        >
          <button
            className="flex items-center text-[10px] font-black uppercase tracking-widest text-[#0A1547]/40 hover:text-[#0A1547]/70 transition-colors text-left"
            onClick={() => handleSort("name")}
          >
            Role <SortIcon col="name" />
          </button>
          {showClient && (
            <p className="text-[10px] font-black uppercase tracking-widest text-[#0A1547]/40">Client</p>
          )}
          <button
            className="flex items-center text-[10px] font-black uppercase tracking-widest text-[#0A1547]/40 hover:text-[#0A1547]/70 transition-colors"
            onClick={() => handleSort("created")}
          >
            Created <SortIcon col="created" />
          </button>
          <button
            className="flex items-center text-[10px] font-black uppercase tracking-widest text-[#0A1547]/40 hover:text-[#0A1547]/70 transition-colors"
            onClick={() => handleSort("type")}
          >
            Type <SortIcon col="type" />
          </button>
          <p className="text-[10px] font-black uppercase tracking-widest text-[#0A1547]/40">Usage</p>
          <p className="text-center text-[10px] font-black uppercase tracking-widest text-[#0A1547]/40">Purchased Add’l Interviews</p>
          <p className="text-[10px] font-black uppercase tracking-widest text-[#0A1547]/40">Rubric</p>
          <p className="text-[10px] font-black uppercase tracking-widest text-[#0A1547]/40">JD</p>
          <p className="text-[10px] font-black uppercase tracking-widest text-[#0A1547]/40">Link</p>
          <p className="text-[10px] font-black uppercase tracking-widest text-[#0A1547]/40">Actions</p>
        </div>

        {/* Rows */}
        <div className="divide-y divide-gray-50">
          {rolesLoading ? (
            <div className="py-12 text-center">
              <p className="text-sm text-[#0A1547]/35 font-semibold">Loading roles...</p>
            </div>
          ) : rolesError ? (
            <div className="py-12 text-center">
              <p className="text-sm text-red-500 font-semibold">{rolesError}</p>
            </div>
          ) : (
            sorted.map((role) => {
              const tc = typeColors[role.type];
              const isCopied = copied === role.id;
              return (
                <div
                  key={role.id}
                  className={`grid items-center px-5 py-3.5 hover:bg-gray-50/60 transition-colors ${
                    showClient
                      ? "grid-cols-[minmax(160px,1fr)_110px_120px_90px_110px_120px_56px_56px_110px_112px]"
                      : "grid-cols-[minmax(180px,1fr)_120px_90px_110px_120px_56px_56px_110px_112px]"
                  }`}
                >
                  {/* Name + token */}
                  <div className="min-w-0 pr-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <p className="text-sm font-bold text-[#0A1547] leading-snug truncate">{role.name}</p>
                      {role.isInactive && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black bg-[#0A1547]/7 text-[#0A1547]/45">
                          Inactive
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-[#0A1547]/30 mt-0.5 font-mono truncate">
                      Token: {role.token}
                      {role.isInactive && role.inactiveReason ? ` • ${role.inactiveReason}` : ""}
                    </p>
                  </div>

                  {/* Client (all-clients view only) */}
                  {showClient && (
                    <p className="text-xs font-semibold text-[#0A1547]/50 truncate pr-2">
                      {role.clientName || "—"}
                    </p>
                  )}

                  {/* Created */}
                  <p className="text-xs text-[#0A1547]/50 font-semibold pr-2">{role.created}</p>

                  {/* Type badge */}
                  <span
                    className="inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-bold w-fit"
                    style={{ backgroundColor: tc.bg, color: tc.text }}
                  >
                    {role.type}
                  </span>

                  {/* Usage */}
                  <p className="text-xs text-[#0A1547]/55 font-bold pr-2">
                    {role.remainingInterviews == null || role.usedInterviews == null
                      ? "—"
                      : `${role.remainingInterviews} left / ${role.usedInterviews} used`}
                  </p>

                  {/* Purchased add'l interviews */}
                  <p className="text-center text-xs text-[#0A1547]/55 font-bold">
                    {role.purchasedInterviews == null ? "—" : role.purchasedInterviews}
                  </p>

                  {/* Rubric icon */}
                  <div className="flex justify-center">
                    <button
                      onClick={() => {
                        void openRoleRubric(role);
                      }}
                      disabled={loadingRubric[role.id] === true}
                      className="p-1.5 rounded-lg text-[#0A1547]/30 hover:text-[#A380F6] hover:bg-[rgba(163,128,246,0.08)] transition-all"
                      title="View rubric"
                    >
                      <FileText className="w-4 h-4" />
                    </button>
                  </div>

                  {/* JD icon */}
                  <div className="flex justify-center">
                    {role.hasJD ? (
                      <button
                        onClick={() => {
                          void openRoleJd(role);
                        }}
                        disabled={openingJd[role.id] === true}
                        className="p-1.5 rounded-lg text-[#0A1547]/30 hover:text-[#A380F6] hover:bg-[rgba(163,128,246,0.08)] transition-all"
                        title="View job description"
                      >
                        <FileText className="w-4 h-4" />
                      </button>
                    ) : (
                      <span className="text-sm text-[#0A1547]/20 font-semibold">—</span>
                    )}
                  </div>

                  {/* Copy link */}
                  <button
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all hover:opacity-90 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100 w-fit"
                    style={{
                      backgroundColor: role.isInactive ? "rgba(10,21,71,0.06)" : isCopied ? "#02D99D" : "#A380F6",
                      color: role.isInactive ? "rgba(10,21,71,0.38)" : "#FFFFFF",
                    }}
                    onClick={() => {
                      void handleCopy(role);
                    }}
                    disabled={role.isInactive}
                    title={role.isInactive ? "Inactive roles cannot accept new candidates." : undefined}
                  >
                    <Copy className="w-3 h-3" />
                    {isCopied ? "Copied!" : "Copy link"}
                  </button>

                  {/* Actions */}
                  <div className="flex items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => setRoleStatusConfirm({ role, nextStatus: role.isInactive ? "active" : "inactive" })}
                      disabled={updatingRoleStatus[role.id] === true}
                      className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${
                        role.isInactive
                          ? "text-[#009E73] bg-[#02D99D]/10 hover:bg-[#02D99D]/15"
                          : "text-[#0A1547]/55 bg-[#0A1547]/5 hover:bg-[#0A1547]/10"
                      }`}
                    >
                      {role.isInactive ? "Reopen" : "Close"}
                    </button>
                    <button
                      onClick={() => {
                        void deleteRole(role);
                      }}
                      disabled={deletingRoles[role.id] === true}
                      className="p-1.5 rounded-lg text-[#0A1547]/25 hover:text-red-500 hover:bg-red-50 transition-all"
                      title={`Delete ${role.name}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )}

          {!rolesLoading && !rolesError && sorted.length === 0 && (
            <div className="py-12 text-center">
              <p className="text-sm text-[#0A1547]/35 font-semibold">
                {roleSearchTerm && filteredByClient.length > 0
                  ? "No roles match your search."
                  : roleStatusFilter === "inactive"
                    ? "No inactive roles."
                    : roleStatusFilter === "active"
                      ? "No active roles."
                      : "No roles found for this client."}
              </p>
            </div>
          )}
        </div>
      </div>
      {roleStatusConfirm && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 sm:p-6">
          <button
            type="button"
            onClick={() => setRoleStatusConfirm(null)}
            className="absolute inset-0 bg-[#0A1547]/45"
            aria-label="Cancel role status change"
          />
          <div
            className="relative w-full max-w-md rounded-2xl bg-white border border-[rgba(10,21,71,0.10)] shadow-[0_24px_70px_rgba(10,21,71,0.24)] overflow-hidden"
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-role-status-confirm-title"
          >
            <div className="px-6 py-5 border-b border-gray-100">
              <h3 id="admin-role-status-confirm-title" className="text-base font-black text-[#0A1547]">
                {roleStatusConfirm.nextStatus === "inactive" ? "Close role" : "Reopen role"}
              </h3>
            </div>
            <div className="px-6 py-5">
              <p className="text-sm leading-6 text-[#0A1547]/70 font-medium">
                {roleStatusConfirm.nextStatus === "inactive"
                  ? `Close "${roleStatusConfirm.role.name}"? This role will stop accepting new candidates/interviews. Existing candidates, reports, interviews, and recordings will remain viewable.`
                  : `Reopen "${roleStatusConfirm.role.name}" and allow new candidates/interviews?`}
              </p>
            </div>
            <div className="px-6 py-4 bg-gray-50/70 border-t border-gray-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setRoleStatusConfirm(null)}
                className="px-4 py-2 rounded-full text-xs font-bold text-[#0A1547]/55 bg-white border border-[rgba(10,21,71,0.10)] hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  void updateRoleStatus(roleStatusConfirm.role, roleStatusConfirm.nextStatus);
                  setRoleStatusConfirm(null);
                }}
                className={`px-4 py-2 rounded-full text-xs font-bold text-white transition-opacity hover:opacity-90 ${
                  roleStatusConfirm.nextStatus === "inactive" ? "bg-[#0A1547]" : "bg-[#A380F6]"
                }`}
              >
                {roleStatusConfirm.nextStatus === "inactive" ? "Close Role" : "Reopen Role"}
              </button>
            </div>
          </div>
        </div>
      )}
      {rubricModal && (
        <div className="fixed inset-0 z-40 bg-black/35 backdrop-blur-[1px] flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-white rounded-2xl border border-[rgba(10,21,71,0.10)] shadow-[0_20px_60px_rgba(10,21,71,0.22)] overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-base font-black text-[#0A1547]">Rubric — {rubricModal.roleName}</h3>
              <button
                className="px-3 py-1.5 rounded-full text-xs font-bold text-[#0A1547]/60 hover:bg-gray-100 transition-colors"
                onClick={() => setRubricModal(null)}
              >
                Close
              </button>
            </div>
            <div className="px-5 py-4 max-h-[60vh] overflow-auto">
              {rubricModal.questions.length === 0 ? (
                <p className="text-sm text-[#0A1547]/45 font-semibold">No rubric questions found.</p>
              ) : (
                <ol className="list-decimal pl-5 space-y-2">
                  {rubricModal.questions.map((question, index) => (
                    <li key={`${question}-${index}`} className="text-sm text-[#0A1547]/75 leading-relaxed">
                      {question}
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
