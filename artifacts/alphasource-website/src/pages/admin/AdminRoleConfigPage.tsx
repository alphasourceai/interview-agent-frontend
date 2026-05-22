import { useEffect, useMemo, useState } from "react";
import { X, Trash2, Plus, ChevronDown, ChevronUp, Search } from "lucide-react";
import AdminLayout from "@/components/AdminLayout";
import { useAdminClient, type AdminClient } from "@/context/AdminClientContext";
import { supabase } from "@/lib/supabaseClient";

/* ── Types ───────────────────────────────────────────────────── */
type RoleType = "Basic" | "Detailed" | "Technical";
type SortKey = "name" | "entity" | "type";

interface RubricQuestion {
  id: number;
  text: string;
}

interface RoleConfig {
  id: string;
  clientId: string;
  clientName: string;
  entityName: string;
  parentClientName: string;
  entityLabel: string;
  name: string;
  token: string;
  type: RoleType;
  tavusPrompt: string;
  questions: RubricQuestion[];
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
  if (!text) return "Failed to load role configs.";
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

let questionIdSeed = 100;
function toRubricQuestions(values: string[]): RubricQuestion[] {
  return values
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .map((text) => ({ id: questionIdSeed++, text }));
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

/* ── Edit Modal ──────────────────────────────────────────────── */
interface EditModalProps {
  config: RoleConfig;
  onClose: () => void;
  onSave: (next: { tavusPrompt: string; questions: RubricQuestion[] }) => void;
  saving: boolean;
}

function EditModal({ config, onClose, onSave, saving }: EditModalProps) {
  const [tavus, setTavus]         = useState(config.tavusPrompt);
  const [questions, setQuestions] = useState<RubricQuestion[]>(config.questions);

  const updateQ = (id: number, text: string) =>
    setQuestions((qs) => qs.map((q) => (q.id === id ? { ...q, text } : q)));

  const deleteQ = (id: number) =>
    setQuestions((qs) => qs.filter((q) => q.id !== id));

  const addQ = () =>
    setQuestions((qs) => [...qs, { id: Date.now(), text: "" }]);

  const textareaCls =
    "w-full px-3 py-2.5 rounded-xl text-sm text-[#0A1547] font-medium resize-none " +
    "border border-[rgba(10,21,71,0.10)] bg-white placeholder:text-[#0A1547]/25 " +
    "focus:outline-none focus:border-[#A380F6] transition-colors leading-relaxed";

  const tc = typeColors[config.type];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(10,21,71,0.55)", backdropFilter: "blur(4px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="relative w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl bg-white"
        style={{ border: "1px solid rgba(10,21,71,0.09)", boxShadow: "0 24px 64px rgba(10,21,71,0.18)" }}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-5 pb-4 border-b border-gray-100 flex-shrink-0">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-[#0A1547]/35 mb-1">Role Config</p>
            <h3 className="text-base font-black text-[#0A1547] leading-snug">{config.name}</h3>
            <div className="flex items-center gap-2 mt-1.5">
              <span className="text-[10px] font-mono text-[#0A1547]/30">Token: {config.token}</span>
              <span
                className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold"
                style={{ backgroundColor: tc.bg, color: tc.text }}
              >
                {config.type}
              </span>
            </div>
          </div>
          <button
            className="p-2 rounded-xl text-[#0A1547]/30 hover:text-[#0A1547]/70 hover:bg-gray-100 transition-all flex-shrink-0 -mt-1 -mr-1"
            onClick={onClose}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Tavus Prompt */}
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-[#0A1547]/40 mb-2">
              Tavus Prompt
            </label>
            <textarea
              rows={3}
              className={textareaCls}
              placeholder="Enter Tavus persona prompt…"
              value={tavus}
              onChange={(e) => setTavus(e.target.value)}
            />
          </div>

          {/* Rubric Questions */}
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-[#0A1547]/40 mb-3">
              Rubric Questions
            </label>
            <div className="space-y-2.5">
              {questions.map((qItem, i) => (
                <div key={qItem.id} className="flex items-start gap-2">
                  <textarea
                    rows={2}
                    className={textareaCls + " flex-1"}
                    placeholder={`Question ${i + 1}`}
                    value={qItem.text}
                    onChange={(e) => updateQ(qItem.id, e.target.value)}
                  />
                  <button
                    className="mt-1 p-2 rounded-xl text-[#0A1547]/25 hover:text-red-500 hover:bg-red-50 transition-all flex-shrink-0"
                    onClick={() => deleteQ(qItem.id)}
                    title="Delete question"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            <button
              className="flex items-center gap-1.5 mt-3 px-4 py-2 rounded-full text-xs font-bold text-white transition-opacity hover:opacity-90"
              style={{ backgroundColor: "#A380F6" }}
              onClick={addQ}
            >
              <Plus className="w-3.5 h-3.5" />
              Add question
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between flex-shrink-0">
          <button
            className="px-4 py-2 rounded-full text-xs font-bold text-[#0A1547]/40 hover:text-[#0A1547]/70 hover:bg-gray-100 transition-all"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className="px-6 py-2 rounded-full text-sm font-bold text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: "#A380F6" }}
            onClick={() => onSave({ tavusPrompt: tavus, questions })}
            disabled={saving}
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Main Page ───────────────────────────────────────────────── */
export default function AdminRoleConfigPage() {
  const {
    selectedClientId,
    clients,
    loading: adminClientsLoading,
    error: adminClientsError,
  } = useAdminClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [sortKey, setSortKey]     = useState<SortKey>("name");
  const [sortDir, setSortDir]     = useState<"asc" | "desc">("asc");
  const [searchTerm, setSearchTerm] = useState("");
  const [roles, setRoles] = useState<RoleConfig[]>([]);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [rolesError, setRolesError] = useState("");
  const [actionNotice, setActionNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [loadingConfig, setLoadingConfig] = useState<Record<string, boolean>>({});
  const [savingConfig, setSavingConfig] = useState<Record<string, boolean>>({});

  const clientById = useMemo<Record<string, AdminClient>>(
    () =>
      Object.fromEntries(
        clients
          .filter((client) => client.id !== "all")
          .map((client) => [client.id, client]),
      ) as Record<string, AdminClient>,
    [clients],
  );

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
        const token = await getSessionToken();
        const isAllClients = selectedClientId === "all";
        const url = isAllClients
          ? `${backendBase}/admin/roles`
          : `${backendBase}/admin/roles?client_id=${encodeURIComponent(selectedClientId)}`;

        const response = await fetch(url, {
          method: "GET",
          headers: { Authorization: `Bearer ${token}` },
          credentials: "omit",
        });
        const text = await response.text();
        if (!response.ok) throw new Error(extractErrorMessage(text));

        const payload = parseJsonSafe(text);
        const items =
          payload && typeof payload === "object" && Array.isArray((payload as { items?: unknown }).items)
            ? (payload as { items: unknown[] }).items
            : [];

        const mapped: RoleConfig[] = items
          .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"))
          .map((item) => {
            const roleId = String(item.id || "").trim();
            const roleClientId = String(item.client_id || "").trim();
            const owningClient = clientById[roleClientId];
            const parentClientId = String(owningClient?.parent_client_id || "").trim();
            const parentClient = parentClientId ? clientById[parentClientId] : null;
            const entityName = String(owningClient?.name || "").trim() || "—";
            const parentClientName = String(
              parentClientId
                ? owningClient?.parent_client_name || parentClient?.name || ""
                : owningClient?.name || "",
            ).trim() || "—";
            const questions = toRubricQuestions(extractRubricQuestions(item.rubric));
            return {
              id: roleId,
              clientId: roleClientId,
              clientName: entityName === "—" ? "" : entityName,
              entityName,
              parentClientName,
              entityLabel: String(owningClient?.entity_label || "").trim(),
              name: String(item.title || "").trim() || "Untitled role",
              token: String(item.slug_or_token || roleId).trim(),
              type: normalizeRoleType(item.interview_type),
              tavusPrompt: "",
              questions,
            };
          })
          .filter((role) => Boolean(role.id));

        if (!alive) return;
        setRoles(mapped);
      } catch (error) {
        if (!alive) return;
        setRoles([]);
        setRolesError(error instanceof Error ? error.message : "Failed to load role configs.");
      } finally {
        if (alive) setRolesLoading(false);
      }
    };

    void loadRoles();
    return () => {
      alive = false;
    };
  }, [selectedClientId, adminClientsLoading, adminClientsError, clientById]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  };

  const scopedRoles = selectedClientId === "all"
    ? roles
    : roles.filter((role) => role.clientId === selectedClientId);

  const searchQuery = searchTerm.trim().toLowerCase();
  const filtered = scopedRoles.filter((role) => {
    if (!searchQuery) return true;
    return [
      role.name,
      role.token,
      role.type,
      role.clientName,
      role.entityName,
      role.parentClientName,
      role.entityLabel,
      ...role.questions.map((question) => question.text),
    ]
      .join(" ")
      .toLowerCase()
      .includes(searchQuery);
  });

  const sorted = [...filtered].sort((a, b) => {
    const getSortValue = (role: RoleConfig) => {
      if (sortKey === "entity") return role.entityName.toLowerCase();
      if (sortKey === "type") return role.type.toLowerCase();
      return role.name.toLowerCase();
    };
    const av = getSortValue(a);
    const bv = getSortValue(b);
    if (av < bv) return sortDir === "asc" ? -1 : 1;
    if (av > bv) return sortDir === "asc" ? 1 : -1;
    return 0;
  });

  const editingConfig = editingId ? roles.find((role) => role.id === editingId) ?? null : null;

  const openRoleConfig = async (role: RoleConfig) => {
    if (!role.id || !role.clientId || loadingConfig[role.id]) return;
    if (!backendBase) {
      setActionNotice({ tone: "error", text: "Missing backend base URL configuration." });
      return;
    }

    setActionNotice(null);
    setLoadingConfig((prev) => ({ ...prev, [role.id]: true }));
    try {
      const token = await getSessionToken();
      const response = await fetch(
        `${backendBase}/admin/roles/${encodeURIComponent(role.id)}/interview-config?client_id=${encodeURIComponent(role.clientId)}`,
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
        ? (payload.item as { tavus_prompt?: unknown; rubric_questions?: unknown })
        : null;
      const nextPrompt = typeof item?.tavus_prompt === "string" ? item.tavus_prompt : "";
      const nextQuestionsRaw = Array.isArray(item?.rubric_questions)
        ? item.rubric_questions.map((question) => String(question || "").trim()).filter(Boolean)
        : [];
      const nextQuestions = toRubricQuestions(nextQuestionsRaw);

      setRoles((prev) =>
        prev.map((entry) =>
          entry.id === role.id
            ? { ...entry, tavusPrompt: nextPrompt, questions: nextQuestions }
            : entry,
        ),
      );
      setEditingId(role.id);
    } catch (error) {
      setActionNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "Could not load role config.",
      });
    } finally {
      setLoadingConfig((prev) => ({ ...prev, [role.id]: false }));
    }
  };

  const saveRoleConfig = async (next: { tavusPrompt: string; questions: RubricQuestion[] }) => {
    if (!editingConfig || !editingConfig.id || !editingConfig.clientId || savingConfig[editingConfig.id]) return;
    if (!backendBase) {
      setActionNotice({ tone: "error", text: "Missing backend base URL configuration." });
      return;
    }

    const roleId = editingConfig.id;
    setActionNotice(null);
    setSavingConfig((prev) => ({ ...prev, [roleId]: true }));
    try {
      const token = await getSessionToken();
      const cleanedPrompt = String(next.tavusPrompt || "").trim();
      const rubricQuestions = next.questions
        .map((question) => String(question.text || "").trim())
        .filter(Boolean);

      const response = await fetch(
        `${backendBase}/admin/roles/${encodeURIComponent(roleId)}/interview-config?client_id=${encodeURIComponent(editingConfig.clientId)}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          credentials: "omit",
          body: JSON.stringify({
            tavus_prompt: cleanedPrompt ? cleanedPrompt : null,
            rubric_questions: rubricQuestions,
          }),
        },
      );
      const text = await response.text();
      if (!response.ok) throw new Error(extractErrorMessage(text));

      const payload = parseJsonSafe(text) as { item?: unknown } | null;
      const item = payload?.item && typeof payload.item === "object"
        ? (payload.item as { tavus_prompt?: unknown; rubric_questions?: unknown })
        : null;
      const nextPrompt = typeof item?.tavus_prompt === "string" ? item.tavus_prompt : cleanedPrompt;
      const nextQuestionsRaw = Array.isArray(item?.rubric_questions)
        ? item.rubric_questions.map((question) => String(question || "").trim()).filter(Boolean)
        : rubricQuestions;
      const nextQuestionsMapped = toRubricQuestions(nextQuestionsRaw);

      setRoles((prev) =>
        prev.map((entry) =>
          entry.id === roleId
            ? { ...entry, tavusPrompt: nextPrompt, questions: nextQuestionsMapped }
            : entry,
        ),
      );
      setActionNotice({ tone: "success", text: "Role config saved." });
      setEditingId(null);
    } catch (error) {
      setActionNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "Could not save role config.",
      });
    } finally {
      setSavingConfig((prev) => ({ ...prev, [roleId]: false }));
    }
  };

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <ChevronDown className="w-3 h-3 text-[#0A1547]/20 ml-0.5 flex-shrink-0" />;
    return sortDir === "asc"
      ? <ChevronUp   className="w-3 h-3 text-[#A380F6] ml-0.5 flex-shrink-0" />
      : <ChevronDown className="w-3 h-3 text-[#A380F6] ml-0.5 flex-shrink-0" />;
  }

  return (
    <AdminLayout title="Role Config">
      {editingConfig && (
        <EditModal
          config={editingConfig}
          onClose={() => setEditingId(null)}
          onSave={saveRoleConfig}
          saving={savingConfig[editingConfig.id] === true}
        />
      )}

      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-black text-[#0A1547]">Role Config</h2>
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

      <div
        className="bg-white rounded-2xl overflow-hidden"
        style={{ border: "1px solid rgba(10,21,71,0.07)", boxShadow: "0 2px 12px rgba(10,21,71,0.04)" }}
      >
        <div className="px-5 py-4 border-b border-gray-100">
          <div className="relative max-w-xl">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#0A1547]/25" />
            <input
              className="w-full rounded-xl border border-[rgba(10,21,71,0.10)] bg-white py-2.5 pl-9 pr-3 text-sm font-semibold text-[#0A1547] placeholder:text-[#0A1547]/30 focus:border-[#A380F6] focus:outline-none"
              placeholder="Search roles, entities, clients, tokens, or rubric text..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
          </div>
        </div>

        {/* Column headers */}
        <div className="grid grid-cols-[minmax(0,1fr)_220px_140px_96px] items-center px-5 py-3 border-b border-gray-100">
          <button
            className="flex items-center text-[10px] font-black uppercase tracking-widest text-[#0A1547]/40 hover:text-[#0A1547]/70 transition-colors text-left"
            onClick={() => handleSort("name")}
          >
            Role <SortIcon col="name" />
          </button>
          <button
            className="flex items-center text-[10px] font-black uppercase tracking-widest text-[#0A1547]/40 hover:text-[#0A1547]/70 transition-colors text-left"
            onClick={() => handleSort("entity")}
          >
            Entity <SortIcon col="entity" />
          </button>
          <button
            className="flex items-center text-[10px] font-black uppercase tracking-widest text-[#0A1547]/40 hover:text-[#0A1547]/70 transition-colors"
            onClick={() => handleSort("type")}
          >
            Type <SortIcon col="type" />
          </button>
          <p className="text-[10px] font-black uppercase tracking-widest text-[#0A1547]/40">Config</p>
        </div>

        {/* Rows */}
        <div className="divide-y divide-gray-50">
          {rolesLoading ? (
            <div className="py-12 text-center">
              <p className="text-sm text-[#0A1547]/35 font-semibold">Loading role configs...</p>
            </div>
          ) : rolesError ? (
            <div className="py-12 text-center">
              <p className="text-sm text-red-500 font-semibold">{rolesError}</p>
            </div>
          ) : sorted.map((role) => {
            const tc = typeColors[role.type];
            return (
              <div
                key={role.id}
                className="grid grid-cols-[minmax(0,1fr)_220px_140px_96px] items-center px-5 py-3.5 hover:bg-gray-50/60 transition-colors"
              >
                <div className="min-w-0 pr-4">
                  <p className="text-sm font-bold text-[#0A1547] leading-snug truncate">{role.name}</p>
                  <p className="text-[10px] font-mono text-[#0A1547]/30 mt-0.5 truncate">{role.token}</p>
                </div>

                <div className="min-w-0 pr-4">
                  <p className="text-sm font-bold text-[#0A1547] leading-snug truncate">{role.entityName}</p>
                  <p className="text-[10px] text-[#0A1547]/40 mt-0.5 truncate">Parent: {role.parentClientName}</p>
                </div>

                <span
                  className="inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-bold w-fit"
                  style={{ backgroundColor: tc.bg, color: tc.text }}
                >
                  {role.type}
                </span>

                <button
                  className="px-4 py-1.5 rounded-full text-xs font-bold text-white transition-opacity hover:opacity-90 active:scale-95 w-fit"
                  style={{ backgroundColor: "#A380F6" }}
                  onClick={() => {
                    void openRoleConfig(role);
                  }}
                  disabled={loadingConfig[role.id] === true}
                >
                  {loadingConfig[role.id] === true ? "Loading..." : "Edit"}
                </button>
              </div>
            );
          })}

          {!rolesLoading && !rolesError && sorted.length === 0 && (
            <div className="py-12 text-center">
              <p className="text-sm text-[#0A1547]/35 font-semibold">
                {searchQuery ? "No role configs match your search." : "No roles configured for this client."}
              </p>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
