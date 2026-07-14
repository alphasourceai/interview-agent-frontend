import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Upload } from "lucide-react";
import AdminLayout from "@/components/AdminLayout";
import InfoTooltip from "@/components/InfoTooltip";
import EditRoleRubricModal from "@/components/roles/EditRoleRubricModal";
import RoleActionsMenu from "@/components/roles/RoleActionsMenu";
import ReplaceJobDescriptionModal from "@/components/roles/ReplaceJobDescriptionModal";
import {
  ROLE_TABLE_ADMIN_GRID_TEMPLATE,
  roleTableAlignmentClass,
} from "@/components/roles/roleTableLayout";
import { useAdminClient, type AdminClient } from "@/context/AdminClientContext";
import { buildEntityFilterOptions, defaultEntityFilterValue, entityFilterHelpText, entityFilterQueryValue, type EntityFilterValue } from "@/lib/entityFilters";
import { normalizeRoleJdReplacementEligibility, type RoleJdReplacementEligibility } from "@/lib/roleJdReplacementEligibility";
import { supabase } from "@/lib/supabaseClient";

/* ── Types ───────────────────────────────────────────────────── */
type RoleType = "Basic" | "Detailed" | "Technical";
type SortKey  = "name" | "entity" | "created" | "type";
type SortDir  = "asc" | "desc";
type RoleStatusFilter = "active" | "inactive" | "all";

interface Role {
  id: string;
  clientId: string;
  clientName: string;
  entityName: string;
  parentClientName: string;
  name: string;
  token: string;
  created: string;
  createdDate: string;
  createdTime: string;
  createdTs: number;
  type: RoleType;
  hasJD: boolean;
  jobDescriptionUrl: string;
  jobDescriptionReplacement: RoleJdReplacementEligibility;
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

function formatRoleCreated(value: unknown): { text: string; date: string; time: string; ts: number } {
  const raw = String(value || "").trim();
  if (!raw) return { text: "—", date: "—", time: "—", ts: 0 };
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return { text: "—", date: "—", time: "—", ts: 0 };
  return {
    text: parsed.toLocaleString(),
    date: parsed.toLocaleDateString(),
    time: parsed.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
    ts: parsed.getTime(),
  };
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

const surfaceCardStyle = {
  backgroundColor: "var(--as-surface)",
  border: "1px solid var(--as-border)",
  boxShadow: "var(--as-shadow)",
};
const modalSurfaceStyle = {
  backgroundColor: "var(--as-surface)",
  border: "1px solid var(--as-border)",
  boxShadow: "0 24px 70px rgba(10,21,71,0.24)",
};
const fieldSurfaceStyle = {
  backgroundColor: "var(--as-surface-muted)",
  borderColor: "var(--as-border)",
  color: "var(--as-text)",
};
const mutedPanelStyle = {
  backgroundColor: "var(--as-surface-muted)",
  borderColor: "var(--as-border)",
};
const dividerStyle = { borderColor: "var(--as-border)" };
const primaryTextStyle = { color: "var(--as-text)" };
const mutedTextStyle = { color: "var(--as-text-muted)" };
const subtleTextStyle = { color: "var(--as-text-subtle)" };

const inputCls =
  "w-full px-3 py-2 rounded-xl text-sm text-[var(--as-text)] font-medium " +
  "border border-[var(--as-border)] bg-[var(--as-surface-muted)] " +
  "placeholder:text-[#0A1547]/30 dark:placeholder:text-slate-400/45 focus:outline-none focus:border-[#A380F6] transition-colors";

const selectCls =
  "w-full px-3 py-2 rounded-xl text-sm text-[var(--as-text)] font-medium " +
  "border border-[var(--as-border)] bg-[var(--as-surface-muted)] appearance-none " +
  "focus:outline-none focus:border-[#A380F6] transition-colors cursor-pointer";

export default function AdminRolesPage() {
  const {
    selectedClientId,
    clients: adminClients,
    loading: adminClientsLoading,
    error: adminClientsError,
  } = useAdminClient();
  const [sortKey, setSortKey] = useState<SortKey>("created");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [roles, setRoles] = useState<Role[]>([]);
  const [rolesLoading, setRolesLoading] = useState<boolean>(false);
  const [rolesError, setRolesError] = useState<string>("");
  const [roleSearch, setRoleSearch] = useState("");
  const [roleStatusFilter, setRoleStatusFilter] = useState<RoleStatusFilter>("active");
  const [entityFilter, setEntityFilter] = useState<EntityFilterValue>("parent");
  const [actionNotice, setActionNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [openingJd, setOpeningJd] = useState<Record<string, boolean>>({});
  const [loadingRubric, setLoadingRubric] = useState<Record<string, boolean>>({});
  const [deletingRoles, setDeletingRoles] = useState<Record<string, boolean>>({});
  const [updatingRoleStatus, setUpdatingRoleStatus] = useState<Record<string, boolean>>({});
  const [creatingRole, setCreatingRole] = useState<boolean>(false);
  const [jdFile, setJdFile] = useState<File | null>(null);
  const [rubricModal, setRubricModal] = useState<{ roleName: string; questions: string[] } | null>(null);
  const [roleStatusConfirm, setRoleStatusConfirm] = useState<{ role: Role; nextStatus: "active" | "inactive" } | null>(null);
  const [roleDeleteConfirm, setRoleDeleteConfirm] = useState<{ role: Role } | null>(null);
  const [editingRubricRole, setEditingRubricRole] = useState<Role | null>(null);
  const [rubricEditorSession, setRubricEditorSession] = useState(0);
  const [replacementRole, setReplacementRole] = useState<Role | null>(null);
  const [openRoleActionsId, setOpenRoleActionsId] = useState<string | null>(null);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const roleActionsTriggerRef = useRef<HTMLButtonElement>(null);
  const [form, setForm] = useState({ title: "", type: "Basic", jdFileName: "" });
  const hierarchyClients = useMemo(
    () => adminClients.filter((client) => client.id !== "all"),
    [adminClients],
  );
  const entityOptions = useMemo(
    () => buildEntityFilterOptions(hierarchyClients, selectedClientId, { useParentNameLabel: true }),
    [hierarchyClients, selectedClientId],
  );
  const entityHelpText = useMemo(() => entityFilterHelpText(entityOptions), [entityOptions]);

  const clientById = useMemo<Record<string, AdminClient>>(
    () =>
      Object.fromEntries(
        adminClients
          .filter((client) => client.id !== "all")
          .map((client) => [client.id, client]),
      ) as Record<string, AdminClient>,
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
    setRoleDeleteConfirm(null);
    setEditingRubricRole(null);
    setReplacementRole(null);
    setOpenRoleActionsId(null);
  }, [selectedClientId]);

  useEffect(() => {
    setEntityFilter(defaultEntityFilterValue(hierarchyClients, selectedClientId));
  }, [hierarchyClients, selectedClientId]);

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

        const params = new URLSearchParams({ status: roleStatusFilter });
        if (selectedClientId !== "all") params.set("client_id", selectedClientId);
        if (entityOptions.length > 0) params.set("entity_filter", entityFilterQueryValue(entityFilter));

        const response = await fetch(`${backendBase}/admin/roles?${params.toString()}`, {
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
            const owningClient = clientById[roleClientId];
            const parentClientId = String(owningClient?.parent_client_id || "").trim();
            const isChildClient = owningClient?.is_child_client === true || Boolean(parentClientId);
            const entityName = String(item.entity_name || owningClient?.name || "").trim() || "—";
            const parentClientName = String(
              isChildClient
                ? (owningClient?.parent_client_name || clientById[parentClientId]?.name || "")
                : (owningClient?.name || ""),
            ).trim() || "—";
            const created = formatRoleCreated(item.created_at);
            const rubricQuestions = extractRubricQuestions(item.rubric);
            const status = String(item.status || "active").trim().toLowerCase() || "active";
            return {
              id: roleId,
              clientId: roleClientId,
              clientName: entityName === "—" ? "" : entityName,
              entityName,
              parentClientName,
              name: String(item.title || "").trim() || "Untitled role",
              token: String(item.slug_or_token || roleId).trim(),
              created: created.text,
              createdDate: created.date,
              createdTime: created.time,
              createdTs: created.ts,
              type: normalizeRoleType(item.interview_type),
              hasJD: Boolean(String(item.job_description_url || "").trim()),
              jobDescriptionUrl: String(item.job_description_url || "").trim(),
              jobDescriptionReplacement: normalizeRoleJdReplacementEligibility(item.job_description_replacement),
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
  }, [selectedClientId, adminClientsLoading, adminClientsError, clientById, roleStatusFilter, entityFilter, entityOptions.length, refreshNonce]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  };

  /* Filter by selected client */
  const filteredByClient = roles;

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
    if (sortKey === "entity")  { av = a.entityName.toLowerCase(); bv = b.entityName.toLowerCase(); }
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
    if (sortKey !== col) return <ChevronDown className="w-3 h-3 ml-0.5 flex-shrink-0" style={subtleTextStyle} />;
    return sortDir === "asc"
      ? <ChevronUp   className="w-3 h-3 text-[#A380F6] ml-0.5 flex-shrink-0" />
      : <ChevronDown className="w-3 h-3 text-[#A380F6] ml-0.5 flex-shrink-0" />;
  }

  return (
    <AdminLayout title="Roles">

      {/* ── Page header ──────────────────────────────────── */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-black text-[#0A1547]" style={{ color: "var(--as-text)" }}>Roles</h2>
      </div>
      {actionNotice && (
        <div
          role="status"
          aria-live="polite"
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
        className="rounded-2xl p-5 mb-5"
        style={surfaceCardStyle}
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
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none" style={subtleTextStyle} />
          </div>

          {/* JD file upload */}
          <label
            className="flex-1 min-w-48 flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium border border-dashed cursor-pointer hover:border-[#A380F6]/50 hover:text-[#A380F6]/60 transition-colors"
            style={{ ...fieldSurfaceStyle, color: "var(--as-text-muted)" }}
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
        className="rounded-2xl px-5 py-3.5 mb-5 flex flex-wrap items-center gap-3"
        style={surfaceCardStyle}
      >
        <input
          className={inputCls + " max-w-sm"}
          placeholder="Search role name..."
          value={roleSearch}
          onChange={(e) => setRoleSearch(e.target.value)}
        />
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-black uppercase tracking-widest" style={mutedTextStyle}>Status</span>
          <div className="inline-flex items-center rounded-full p-1" style={mutedPanelStyle}>
            {(["active", "inactive", "all"] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setRoleStatusFilter(value)}
                className="px-3 py-1.5 rounded-full text-xs font-bold transition-colors hover:text-[#A380F6]"
                style={
                  roleStatusFilter === value
                    ? { backgroundColor: "var(--as-surface)", color: "var(--as-text)", boxShadow: "0 1px 3px rgba(10,21,71,0.08)" }
                    : mutedTextStyle
                }
              >
                {value === "active" ? "Active" : value === "inactive" ? "Inactive" : "All"}
              </button>
            ))}
          </div>
        </div>
        {entityOptions.length > 0 && (
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest" style={mutedTextStyle}>Entity</label>
              <InfoTooltip content={entityHelpText} side="bottom" iconClassName="w-3 h-3 text-[#0A1547]/35 dark:text-white/45" />
            </div>
            <div className="relative">
              <select
                value={entityFilter}
                onChange={(event) => setEntityFilter(event.target.value)}
                className="appearance-none w-44 px-4 py-2 rounded-xl border text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#A380F6]/25 focus:border-[#A380F6] transition-all cursor-pointer pr-9"
                style={fieldSurfaceStyle}
              >
                {entityOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none" style={mutedTextStyle} />
            </div>
          </div>
        )}
        {roleSearch && (
          <button
            type="button"
            className="px-3 py-2 rounded-full text-xs font-bold text-[#0A1547]/55 dark:text-slate-300/70 bg-[#0A1547]/5 dark:bg-white/5 hover:bg-[#0A1547]/10 dark:hover:bg-white/10 transition-colors"
            onClick={() => setRoleSearch("")}
          >
            Clear
          </button>
        )}
        <p className="text-xs font-semibold ml-auto" style={subtleTextStyle}>
          {sorted.length} of {filteredByClient.length} role{filteredByClient.length !== 1 ? "s" : ""}
        </p>
      </div>

      {/* ── Roles table ───────────────────────────────────── */}
      <div
        className="rounded-2xl overflow-x-auto"
        style={surfaceCardStyle}
      >
        {/* Header */}
        <div
          className={`${ROLE_TABLE_ADMIN_GRID_TEMPLATE} py-3 border-b`}
          style={dividerStyle}
        >
          <div className={roleTableAlignmentClass("role")}>
            <button
              className="inline-flex items-center justify-center gap-1 text-[10px] font-black uppercase tracking-widest hover:text-[#A380F6] transition-colors"
              style={mutedTextStyle}
              onClick={() => handleSort("name")}
            >
              Role <SortIcon col="name" />
            </button>
          </div>
          <div className={roleTableAlignmentClass("entity")}>
            <button
              className="inline-flex items-center justify-center gap-1 text-[10px] font-black uppercase tracking-widest hover:text-[#A380F6] transition-colors"
              style={mutedTextStyle}
              onClick={() => handleSort("entity")}
            >
              Entity <SortIcon col="entity" />
            </button>
          </div>
          <div className={roleTableAlignmentClass("created")}>
            <button
              className="inline-flex items-center justify-center gap-1 text-[10px] font-black uppercase tracking-widest hover:text-[#A380F6] transition-colors"
              style={mutedTextStyle}
              onClick={() => handleSort("created")}
            >
              Created <SortIcon col="created" />
            </button>
          </div>
          <div className={roleTableAlignmentClass("type")}>
            <button
              className="inline-flex items-center justify-center gap-1 text-[10px] font-black uppercase tracking-widest hover:text-[#A380F6] transition-colors"
              style={mutedTextStyle}
              onClick={() => handleSort("type")}
            >
              Type <SortIcon col="type" />
            </button>
          </div>
          <div className={roleTableAlignmentClass("usage")}>
            <span className="inline-flex items-center justify-center text-[10px] font-black uppercase tracking-widest" style={mutedTextStyle}>Usage</span>
          </div>
          <div className={roleTableAlignmentClass("usage")}>
            <span className="inline-flex items-center justify-center text-[10px] font-black uppercase tracking-widest" style={mutedTextStyle}>Add’l Int.</span>
          </div>
          <div className={roleTableAlignmentClass("actions")}>
            <span className="inline-flex items-center justify-center text-[10px] font-black uppercase tracking-widest" style={mutedTextStyle}>Actions</span>
          </div>
        </div>

        {/* Rows */}
        <div>
          {rolesLoading ? (
            <div className="py-12 text-center">
              <p className="text-sm font-semibold" style={subtleTextStyle}>Loading roles...</p>
            </div>
          ) : rolesError ? (
            <div className="py-12 text-center">
              <p className="text-sm text-red-500 font-semibold">{rolesError}</p>
            </div>
          ) : (
            sorted.map((role) => {
              const tc = typeColors[role.type];
              return (
                <div
                  key={role.id}
                  className={`${ROLE_TABLE_ADMIN_GRID_TEMPLATE} py-3.5 border-b as-shell-dropdown-item transition-colors`}
                  style={dividerStyle}
                >
                  {/* Name + parent */}
                  <div className={roleTableAlignmentClass("role")}>
                    <div className="min-w-0 w-full">
                      <div className="flex items-center gap-2 min-w-0">
                        <p className="text-sm font-bold leading-snug truncate" style={primaryTextStyle}>{role.name}</p>
                        {role.isInactive && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black" style={{ backgroundColor: "color-mix(in srgb, var(--as-text) 7%, transparent)", color: "var(--as-text-muted)" }}>
                            Inactive
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] mt-0.5 font-semibold truncate" style={subtleTextStyle}>
                        Parent: {role.parentClientName}
                      </p>
                      {role.isInactive && (
                        <p className="text-[10px] mt-0.5 truncate" style={subtleTextStyle}>
                          Recordings expire 14 days after role closure.
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Entity */}
                  <div className={roleTableAlignmentClass("entity")}>
                    <p className="w-full text-xs font-semibold truncate" style={mutedTextStyle}>
                      {role.entityName || "—"}
                    </p>
                  </div>

                  {/* Created */}
                  <div className={roleTableAlignmentClass("created")}>
                    <div className="w-full">
                      <p className="text-xs font-bold leading-snug" style={mutedTextStyle}>{role.createdDate}</p>
                      <p className="text-[10px] font-semibold mt-0.5" style={subtleTextStyle}>{role.createdTime}</p>
                    </div>
                  </div>

                  {/* Type badge */}
                  <div className={roleTableAlignmentClass("type")}>
                    <span
                      className="inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-bold w-fit"
                      style={{ backgroundColor: tc.bg, color: tc.text }}
                    >
                      {role.type}
                    </span>
                  </div>

                  {/* Usage */}
                  <div className={roleTableAlignmentClass("usage")}>
                    <p className="text-center text-xs font-bold" style={mutedTextStyle}>
                      {role.remainingInterviews == null || role.usedInterviews == null
                        ? "—"
                        : `${role.remainingInterviews} left / ${role.usedInterviews} used`}
                    </p>
                  </div>

                  {/* Add'l interviews */}
                  <div className={roleTableAlignmentClass("usage")}>
                    <p className="text-xs font-bold" style={mutedTextStyle}>
                      {role.purchasedInterviews == null ? "—" : role.purchasedInterviews}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className={roleTableAlignmentClass("actions")}>
                    <RoleActionsMenu
                      open={openRoleActionsId === role.id}
                      onOpenChange={(open) => setOpenRoleActionsId(open ? role.id : null)}
                      roleTitle={role.name}
                      canManageRole
                      canCopyInterviewLink={!role.isInactive && Boolean(role.token)}
                      copyDisabledReason={role.isInactive ? "Inactive roles cannot accept new candidates." : "Interview link unavailable."}
                      hasJobDescription={role.hasJD}
                      hasRubric={role.hasRubric}
                      openingJobDescription={openingJd[role.id] === true}
                      loadingRubric={loadingRubric[role.id] === true}
                      replacementEligibility={role.jobDescriptionReplacement}
                      updatingStatus={updatingRoleStatus[role.id] === true}
                      deleting={deletingRoles[role.id] === true}
                      isInactive={Boolean(role.isInactive)}
                      onTriggerFocus={(trigger) => { roleActionsTriggerRef.current = trigger; }}
                      onCopyInterviewLink={() => { void handleCopy(role); }}
                      onViewJobDescription={() => { void openRoleJd(role); }}
                      onViewRubric={() => { void openRoleRubric(role); }}
                      onEditRubricQuestions={() => {
                        setOpenRoleActionsId(null);
                        setReplacementRole(null);
                        setRubricEditorSession((value) => value + 1);
                        setEditingRubricRole(role);
                      }}
                      onReplaceJobDescription={() => {
                        if (!role.jobDescriptionReplacement.eligible) return;
                        setOpenRoleActionsId(null);
                        setEditingRubricRole(null);
                        setReplacementRole(role);
                      }}
                      onToggleRoleStatus={() => setRoleStatusConfirm({ role, nextStatus: role.isInactive ? "active" : "inactive" })}
                      onDeleteRole={() => setRoleDeleteConfirm({ role })}
                    />
                  </div>
                </div>
              );
            })
          )}

          {!rolesLoading && !rolesError && sorted.length === 0 && (
            <div className="py-12 text-center">
              <p className="text-sm font-semibold" style={subtleTextStyle}>
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
      <EditRoleRubricModal
        open={Boolean(editingRubricRole)}
        role={editingRubricRole ? {
          id: editingRubricRole.id,
          clientId: editingRubricRole.clientId,
          title: editingRubricRole.name,
          entityName: editingRubricRole.entityName,
          parentClientName: editingRubricRole.parentClientName,
          status: editingRubricRole.status,
        } : null}
        sessionKey={rubricEditorSession}
        backendBase={backendBase}
        getSessionToken={getSessionToken}
        onClose={() => setEditingRubricRole(null)}
        onSuccess={() => {
          setRefreshNonce((value) => value + 1);
          setActionNotice({ tone: "success", text: "Rubric questions updated." });
        }}
        getRestoreFocusTarget={() => roleActionsTriggerRef.current}
      />
      <ReplaceJobDescriptionModal
        open={Boolean(replacementRole)}
        role={replacementRole ? {
          id: replacementRole.id,
          clientId: replacementRole.clientId,
          title: replacementRole.name,
          status: replacementRole.status,
          jobDescriptionUrl: replacementRole.jobDescriptionUrl,
        } : null}
        getSessionToken={getSessionToken}
        onClose={() => setReplacementRole(null)}
        onSuccess={() => {
          setRefreshNonce((value) => value + 1);
          setActionNotice({ tone: "success", text: "Job description replaced and role configuration rebuilt." });
        }}
        getRestoreFocusTarget={() => roleActionsTriggerRef.current}
      />
      {roleStatusConfirm && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 sm:p-6">
          <button
            type="button"
            onClick={() => setRoleStatusConfirm(null)}
            className="absolute inset-0 bg-[#0A1547]/45"
            aria-label="Cancel role status change"
          />
          <div
            className="relative w-full max-w-md rounded-2xl overflow-hidden"
            style={modalSurfaceStyle}
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-role-status-confirm-title"
          >
            <div className="px-6 py-5 border-b" style={dividerStyle}>
              <h3 id="admin-role-status-confirm-title" className="text-base font-black" style={primaryTextStyle}>
                {roleStatusConfirm.nextStatus === "inactive" ? "Close role" : "Reopen role"}
              </h3>
            </div>
            <div className="px-6 py-5">
              {roleStatusConfirm.nextStatus === "inactive" ? (
                <div className="space-y-3 text-sm leading-6 font-medium" style={mutedTextStyle}>
                  <p>{`Close "${roleStatusConfirm.role.name}"? This role will stop accepting new candidates/interviews. Existing candidates, reports, and interviews will remain viewable.`}</p>
                  <p>
                    Recordings associated with this role will remain available for <span className="font-bold">14 days</span> after closure, then will be <span className="font-bold">permanently deleted</span> if the role remains inactive.
                  </p>
                </div>
              ) : (
                <p className="text-sm leading-6 font-medium" style={mutedTextStyle}>
                  {`Reopen "${roleStatusConfirm.role.name}" and allow new candidates/interviews?`}
                </p>
              )}
            </div>
            <div className="px-6 py-4 border-t flex items-center justify-end gap-2" style={{ ...dividerStyle, backgroundColor: "var(--as-surface-muted)" }}>
              <button
                type="button"
                onClick={() => setRoleStatusConfirm(null)}
                className="px-4 py-2 rounded-full text-xs font-bold text-[#0A1547]/55 dark:text-slate-300/70 border hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                style={{ backgroundColor: "var(--as-surface)", borderColor: "var(--as-border)" }}
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
      {roleDeleteConfirm && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 sm:p-6">
          <button
            type="button"
            onClick={() => setRoleDeleteConfirm(null)}
            className="absolute inset-0 bg-[#0A1547]/45"
            aria-label="Cancel role delete"
          />
          <div
            className="relative w-full max-w-md rounded-2xl overflow-hidden"
            style={modalSurfaceStyle}
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-role-delete-confirm-title"
          >
            <div className="px-6 py-5 border-b" style={dividerStyle}>
              <h3 id="admin-role-delete-confirm-title" className="text-base font-black" style={primaryTextStyle}>
                Delete role
              </h3>
            </div>
            <div className="px-6 py-5">
              <p className="text-sm leading-6 font-medium" style={mutedTextStyle}>
                {`Delete "${roleDeleteConfirm.role.name}"? This permanently removes the role. Existing related records may no longer be connected to this role in the same way. Use Close instead if you only want to stop accepting new candidates.`}
              </p>
            </div>
            <div className="px-6 py-4 border-t flex items-center justify-end gap-2" style={{ ...dividerStyle, backgroundColor: "var(--as-surface-muted)" }}>
              <button
                type="button"
                onClick={() => setRoleDeleteConfirm(null)}
                className="px-4 py-2 rounded-full text-xs font-bold text-[#0A1547]/55 dark:text-slate-300/70 border hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                style={{ backgroundColor: "var(--as-surface)", borderColor: "var(--as-border)" }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  void deleteRole(roleDeleteConfirm.role);
                  setRoleDeleteConfirm(null);
                }}
                className="px-4 py-2 rounded-full text-xs font-bold text-white bg-red-500 hover:bg-red-600 transition-colors"
              >
                Delete Role
              </button>
            </div>
          </div>
        </div>
      )}
      {rubricModal && (
        <div className="fixed inset-0 z-40 bg-black/35 backdrop-blur-[1px] flex items-center justify-center p-4">
          <div className="w-full max-w-2xl rounded-2xl overflow-hidden" style={modalSurfaceStyle}>
            <div className="px-5 py-4 border-b flex items-center justify-between" style={dividerStyle}>
              <h3 className="text-base font-black" style={primaryTextStyle}>Rubric — {rubricModal.roleName}</h3>
              <button
                className="px-3 py-1.5 rounded-full text-xs font-bold text-[#0A1547]/60 dark:text-slate-300/70 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
                onClick={() => setRubricModal(null)}
              >
                Close
              </button>
            </div>
            <div className="px-5 py-4 max-h-[60vh] overflow-auto">
              {rubricModal.questions.length === 0 ? (
                <p className="text-sm font-semibold" style={mutedTextStyle}>No rubric questions found.</p>
              ) : (
                <ol className="list-decimal pl-5 space-y-2">
                  {rubricModal.questions.map((question, index) => (
                    <li key={`${question}-${index}`} className="text-sm leading-relaxed" style={mutedTextStyle}>
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
