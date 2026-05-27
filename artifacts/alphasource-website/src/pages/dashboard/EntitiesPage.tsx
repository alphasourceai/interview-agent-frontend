import { useEffect, useState } from "react";
import { Building2, Check, Edit2, Plus, Save, X } from "lucide-react";
import CurrentScopeBanner from "@/components/CurrentScopeBanner";
import DashboardLayout from "@/components/DashboardLayout";
import { useClient } from "@/context/ClientContext";
import { supabase } from "@/lib/supabaseClient";

interface ClientEntity {
  id: string;
  name: string;
  parent_client_id: string | null;
  entity_label: string | null;
  billing_client_id?: string | null;
  is_parent_client?: boolean;
  is_child_client?: boolean;
}

const STANDARD_ENTITY_LABELS = [
  { label: "Office", value: "office" },
  { label: "Location", value: "location" },
  { label: "Branch", value: "branch" },
  { label: "Company", value: "company" },
  { label: "Employer", value: "employer" },
  { label: "Contractor", value: "contractor" },
] as const;
const CUSTOM_ENTITY_LABEL = "custom";

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
const modalSurfaceStyle = {
  backgroundColor: "var(--as-surface)",
  border: "1px solid var(--as-border)",
  boxShadow: "0 20px 60px rgba(10,21,71,0.22)",
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

function normalizeRole(role: unknown): string {
  const normalized = String(role || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  return normalized === "superadmin" ? "super_admin" : normalized;
}

function extractErrorMessage(text: string, fallback: string): string {
  if (!text) return fallback;
  try {
    const data = JSON.parse(text) as { detail?: unknown; message?: unknown; error?: unknown };
    const candidate = data.detail ?? data.message ?? data.error;
    if (typeof candidate === "string" && candidate.trim()) return candidate;
  } catch {
    // fall through to raw text
  }
  return text;
}

function parseJsonSafe(text: string): unknown {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function toEntity(value: unknown): ClientEntity | null {
  if (!value || typeof value !== "object") return null;
  const source = value as Record<string, unknown>;
  const id = String(source.id || "").trim();
  if (!id) return null;
  return {
    id,
    name: String(source.name || "").trim() || "Unnamed entity",
    parent_client_id: String(source.parent_client_id || "").trim() || null,
    entity_label: String(source.entity_label || "").trim() || null,
    billing_client_id: String(source.billing_client_id || "").trim() || null,
    is_parent_client: source.is_parent_client === true,
    is_child_client: source.is_child_client === true,
  };
}

function displayEntityLabel(label: unknown): string {
  const value = String(label || "").trim();
  if (!value) return "Entity";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function sortEntities(items: ClientEntity[]): ClientEntity[] {
  return [...items].sort((a, b) => a.name.localeCompare(b.name));
}

function normalizeEntityLabel(value: unknown): string {
  return String(value || "").trim().toLowerCase();
}

function isStandardEntityLabel(value: unknown): boolean {
  const normalized = normalizeEntityLabel(value);
  return STANDARD_ENTITY_LABELS.some((option) => option.value === normalized);
}

function entityLabelChoice(value: unknown): string {
  const normalized = normalizeEntityLabel(value);
  if (!normalized) return "office";
  return isStandardEntityLabel(normalized) ? normalized : CUSTOM_ENTITY_LABEL;
}

function entityCustomLabel(value: unknown): string {
  const normalized = String(value || "").trim();
  return normalized && !isStandardEntityLabel(normalized) ? normalized : "";
}

function resolvedEntityLabel(choice: string, customValue: string): string {
  return choice === CUSTOM_ENTITY_LABEL ? customValue.trim() : choice;
}

export default function EntitiesPage() {
  const {
    selectedClient,
    selectedClientId,
    loading: clientLoading,
    error: clientError,
    isGlobalAdmin,
  } = useClient();

  const canManageEntities = isGlobalAdmin || normalizeRole(selectedClient.role) === "super_admin";
  const [parent, setParent] = useState<ClientEntity | null>(null);
  const [entities, setEntities] = useState<ClientEntity[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [editingId, setEditingId] = useState("");
  const [editName, setEditName] = useState("");
  const [editEntityLabelChoice, setEditEntityLabelChoice] = useState("office");
  const [editCustomEntityLabel, setEditCustomEntityLabel] = useState("");
  const [savingId, setSavingId] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createEntityLabelChoice, setCreateEntityLabelChoice] = useState("office");
  const [createCustomEntityLabel, setCreateCustomEntityLabel] = useState("");
  const [createNotice, setCreateNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [creatingEntity, setCreatingEntity] = useState(false);

  useEffect(() => {
    let alive = true;

    const loadEntities = async () => {
      if (clientLoading) return;
      if (!canManageEntities) {
        if (!alive) return;
        setParent(null);
        setEntities([]);
        setError("");
        setLoading(false);
        return;
      }
      if (clientError) {
        if (!alive) return;
        setParent(null);
        setEntities([]);
        setError(clientError);
        setLoading(false);
        return;
      }
      if (!selectedClientId) {
        if (!alive) return;
        setParent(null);
        setEntities([]);
        setError("");
        setLoading(false);
        return;
      }
      if (!backendBase) {
        if (!alive) return;
        setParent(null);
        setEntities([]);
        setError("Missing backend base URL configuration.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError("");
      setNotice(null);
      setEditingId("");

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const token = String(session?.access_token || "").trim();
        if (!token) throw new Error("Missing session token.");

        const response = await fetch(
          `${backendBase}/clients/entities?client_id=${encodeURIComponent(selectedClientId)}`,
          {
            method: "GET",
            headers: { Authorization: `Bearer ${token}` },
            credentials: "omit",
          },
        );

        const text = await response.text();
        if (!response.ok) throw new Error(extractErrorMessage(text, "Failed to load entities."));

        const payload = parseJsonSafe(text) as { parent?: unknown; items?: unknown } | null;
        const nextParent = toEntity(payload?.parent);
        const nextItems = Array.isArray(payload?.items)
          ? payload.items.map(toEntity).filter((item): item is ClientEntity => Boolean(item))
          : [];

        if (!alive) return;
        setParent(nextParent);
        setEntities(nextItems);
      } catch (loadError) {
        if (!alive) return;
        setParent(null);
        setEntities([]);
        setError(loadError instanceof Error ? loadError.message : "Failed to load entities.");
      } finally {
        if (alive) setLoading(false);
      }
    };

    void loadEntities();
    return () => {
      alive = false;
    };
  }, [selectedClientId, clientLoading, clientError, canManageEntities]);

  const startEdit = (entity: ClientEntity) => {
    setNotice(null);
    setEditingId(entity.id);
    setEditName(entity.name);
    setEditEntityLabelChoice(entityLabelChoice(entity.entity_label));
    setEditCustomEntityLabel(entityCustomLabel(entity.entity_label));
  };

  const cancelEdit = () => {
    setEditingId("");
    setEditName("");
    setEditEntityLabelChoice("office");
    setEditCustomEntityLabel("");
  };

  const openCreate = () => {
    setNotice(null);
    setCreateNotice(null);
    setCreateName("");
    setCreateEntityLabelChoice("office");
    setCreateCustomEntityLabel("");
    setCreateOpen(true);
  };

  const closeCreate = () => {
    if (creatingEntity) return;
    setCreateOpen(false);
    setCreateNotice(null);
    setCreateName("");
    setCreateEntityLabelChoice("office");
    setCreateCustomEntityLabel("");
  };

  const createEntity = async () => {
    const name = createName.trim();
    if (!name) {
      setCreateNotice({ tone: "error", text: "Entity name is required." });
      return;
    }
    const entityLabel = resolvedEntityLabel(createEntityLabelChoice, createCustomEntityLabel);
    if (createEntityLabelChoice === CUSTOM_ENTITY_LABEL && !entityLabel) {
      setCreateNotice({ tone: "error", text: "Custom entity label is required." });
      return;
    }
    if (!selectedClientId) {
      setCreateNotice({ tone: "error", text: "Client selection is required." });
      return;
    }
    if (!backendBase) {
      setCreateNotice({ tone: "error", text: "Missing backend base URL configuration." });
      return;
    }

    setCreatingEntity(true);
    setCreateNotice(null);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = String(session?.access_token || "").trim();
      if (!token) throw new Error("Missing session token.");

      const response = await fetch(`${backendBase}/clients/entities`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        credentials: "omit",
        body: JSON.stringify({
          client_id: selectedClientId,
          name,
          entity_label: entityLabel,
        }),
      });

      const text = await response.text();
      if (!response.ok) throw new Error(extractErrorMessage(text, "Could not create entity."));

      const payload = parseJsonSafe(text) as { item?: unknown } | null;
      const created = toEntity(payload?.item);
      if (!created) throw new Error("Created entity was not returned.");

      setEntities((prev) => sortEntities([...prev.filter((item) => item.id !== created.id), created]));
      closeCreate();
      setNotice({ tone: "success", text: "Entity created." });
    } catch (createError) {
      setCreateNotice({
        tone: "error",
        text: createError instanceof Error ? createError.message : "Could not create entity.",
      });
    } finally {
      setCreatingEntity(false);
    }
  };

  const saveEdit = async (entity: ClientEntity) => {
    const name = editName.trim();
    if (!name) {
      setNotice({ tone: "error", text: "Entity name is required." });
      return;
    }
    const entityLabel = resolvedEntityLabel(editEntityLabelChoice, editCustomEntityLabel);
    if (editEntityLabelChoice === CUSTOM_ENTITY_LABEL && !entityLabel) {
      setNotice({ tone: "error", text: "Custom entity label is required." });
      return;
    }
    if (!backendBase) {
      setNotice({ tone: "error", text: "Missing backend base URL configuration." });
      return;
    }

    setSavingId(entity.id);
    setNotice(null);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = String(session?.access_token || "").trim();
      if (!token) throw new Error("Missing session token.");

      const response = await fetch(`${backendBase}/clients/entities/${encodeURIComponent(entity.id)}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        credentials: "omit",
        body: JSON.stringify({
          name,
          entity_label: entityLabel,
        }),
      });

      const text = await response.text();
      if (!response.ok) throw new Error(extractErrorMessage(text, "Could not update entity."));

      const payload = parseJsonSafe(text) as { item?: unknown } | null;
      const updated = toEntity(payload?.item);
      if (!updated) throw new Error("Updated entity was not returned.");

      setEntities((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      cancelEdit();
      setNotice({ tone: "success", text: "Entity updated." });
    } catch (saveError) {
      setNotice({
        tone: "error",
        text: saveError instanceof Error ? saveError.message : "Could not update entity.",
      });
    } finally {
      setSavingId("");
    }
  };

  if (clientLoading) {
    return (
      <DashboardLayout title="Entities">
        <div
          className="rounded-2xl p-6"
          style={surfaceCardStyle}
        >
          <p className="text-sm font-semibold" style={mutedTextStyle}>Loading entity access...</p>
        </div>
      </DashboardLayout>
    );
  }

  if (!canManageEntities) {
    return (
      <DashboardLayout title="Entities">
        <div
          className="rounded-2xl p-6"
          style={surfaceCardStyle}
        >
          <h2 className="text-base font-black mb-2" style={primaryTextStyle}>Entities unavailable</h2>
          <p className="text-sm font-semibold" style={mutedTextStyle}>
            You do not have permission to manage entities for this client.
          </p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Entities">
      <CurrentScopeBanner client={selectedClient} />

      <div className="space-y-5">
        <div
          className="rounded-2xl overflow-hidden"
          style={surfaceCardStyle}
        >
          <div className="px-6 pt-6 pb-5 border-b" style={dividerStyle}>
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
              <div>
                <h2 className="text-base font-black" style={primaryTextStyle}>Client Entities</h2>
                <p className="text-xs font-semibold mt-1" style={mutedTextStyle}>
                  View your parent client and manage child entity names and labels.
                </p>
              </div>
              <button
                type="button"
                onClick={openCreate}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold text-white hover:opacity-90 active:scale-[0.97] transition-all"
                style={{ backgroundColor: "#A380F6" }}
              >
                <Plus className="w-3.5 h-3.5" />
                Add entity
              </button>
            </div>
          </div>

          <div className="p-6 space-y-4">
            {notice && (
              <div
                className={`rounded-xl px-3.5 py-2 text-xs font-semibold ${
                  notice.tone === "success"
                    ? "text-[#009E73] bg-[#02D99D]/10 border border-[#02D99D]/25"
                    : "text-red-500 bg-red-50 border border-red-200 dark:text-red-300 dark:bg-red-500/10 dark:border-red-500/25"
                }`}
                role="status"
                aria-live="polite"
              >
                {notice.text}
              </div>
            )}

            {loading ? (
              <div className="py-12 text-center text-sm font-semibold" style={subtleTextStyle}>Loading entities...</div>
            ) : error ? (
              <div className="py-12 text-center text-sm text-red-500 font-semibold">{error}</div>
            ) : (
              <>
                <div className="rounded-2xl border p-4" style={{ backgroundColor: "var(--as-accent-soft)", borderColor: "rgba(163,128,246,0.20)" }}>
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[#A380F6]/15 text-[#A380F6] flex-shrink-0">
                      <Building2 className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-black truncate" style={primaryTextStyle}>{parent?.name || selectedClient.name}</p>
                      <p className="text-xs font-semibold mt-1" style={mutedTextStyle}>Parent client</p>
                    </div>
                  </div>
                </div>

                <div className="pl-4 md:pl-8 border-l-2 border-dashed border-[#A380F6]/20 space-y-3">
                  {entities.length === 0 ? (
                    <div className="rounded-2xl border p-5 text-sm font-semibold" style={{ ...mutedPanelStyle, ...mutedTextStyle }}>
                      No child entities have been added yet.
                    </div>
                  ) : (
                    entities.map((entity) => {
                      const editing = editingId === entity.id;
                      const saving = savingId === entity.id;
                      return (
                        <div
                          key={entity.id}
                          className="rounded-2xl p-4"
                          style={compactSurfaceStyle}
                        >
                          {editing ? (
                            <div className="space-y-3">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div>
                                  <label className="block text-[10px] font-black uppercase tracking-widest mb-1.5" style={mutedTextStyle}>
                                    Entity name
                                  </label>
                                  <input
                                    value={editName}
                                    onChange={(event) => setEditName(event.target.value)}
                                    disabled={saving}
                                    className="w-full h-[42px] px-4 py-2.5 rounded-xl text-sm border focus:outline-none focus:ring-2 focus:ring-[#A380F6]/25 focus:border-[#A380F6]"
                                    style={fieldSurfaceStyle}
                                  />
                                </div>
                                <div>
                                  <label className="block text-[10px] font-black uppercase tracking-widest mb-1.5" style={mutedTextStyle}>
                                    Entity label
                                  </label>
                                  <select
                                    value={editEntityLabelChoice}
                                    onChange={(event) => {
                                      setNotice(null);
                                      setEditEntityLabelChoice(event.target.value);
                                    }}
                                    disabled={saving}
                                    className="w-full h-[42px] px-4 py-2.5 rounded-xl text-sm border focus:outline-none focus:ring-2 focus:ring-[#A380F6]/25 focus:border-[#A380F6]"
                                    style={fieldSurfaceStyle}
                                  >
                                    {STANDARD_ENTITY_LABELS.map((option) => (
                                      <option key={option.value} value={option.value}>{option.label}</option>
                                    ))}
                                    <option value={CUSTOM_ENTITY_LABEL}>Custom</option>
                                  </select>
                                  {editEntityLabelChoice === CUSTOM_ENTITY_LABEL && (
                                    <input
                                      value={editCustomEntityLabel}
                                      onChange={(event) => {
                                        setNotice(null);
                                        setEditCustomEntityLabel(event.target.value);
                                      }}
                                      disabled={saving}
                                      placeholder="Custom label"
                                      className="mt-2 w-full px-4 py-2.5 rounded-xl text-sm border placeholder:text-[#0A1547]/30 dark:placeholder:text-slate-400/45 focus:outline-none focus:ring-2 focus:ring-[#A380F6]/25 focus:border-[#A380F6]"
                                      style={fieldSurfaceStyle}
                                    />
                                  )}
                                </div>
                              </div>
                              <div className="flex justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={cancelEdit}
                                  disabled={saving}
                                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold text-[#0A1547]/55 dark:text-slate-300/70 hover:text-[#0A1547] dark:hover:text-white hover:bg-gray-50 dark:hover:bg-white/5 disabled:opacity-50"
                                >
                                  <X className="w-3.5 h-3.5" />
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  onClick={() => { void saveEdit(entity); }}
                                  disabled={saving}
                                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold text-white hover:opacity-90 disabled:opacity-60"
                                  style={{ backgroundColor: "#A380F6" }}
                                >
                                  <Save className="w-3.5 h-3.5" />
                                  {saving ? "Saving..." : "Save"}
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <Check className="w-4 h-4 text-[#02D99D] flex-shrink-0" />
                                  <p className="text-sm font-black truncate" style={primaryTextStyle}>{entity.name}</p>
                                </div>
                                <p className="text-xs font-semibold mt-1" style={mutedTextStyle}>
                                  {displayEntityLabel(entity.entity_label)} under {parent?.name || "parent client"}
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => startEdit(entity)}
                                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold text-[#A380F6] bg-[#A380F6]/10 hover:bg-[#A380F6]/15 transition-colors"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                                Edit
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {createOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#0A1547]/35 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Add entity"
        >
          <div
            className="w-full max-w-lg rounded-2xl overflow-hidden"
            style={modalSurfaceStyle}
          >
            <div className="flex items-center justify-between gap-4 px-6 py-4 border-b" style={dividerStyle}>
              <div>
                <h3 className="text-base font-black" style={primaryTextStyle}>Add entity</h3>
                <p className="text-xs font-semibold mt-0.5" style={mutedTextStyle}>
                  Create a child entity under the parent client.
                </p>
              </div>
              <button
                type="button"
                onClick={closeCreate}
                disabled={creatingEntity}
                className="p-2 rounded-lg text-[#0A1547]/35 dark:text-slate-300/65 hover:text-[#0A1547] dark:hover:text-white hover:bg-gray-50 dark:hover:bg-white/5 disabled:opacity-50"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              {createNotice && (
                <div
                  className={`rounded-xl px-3.5 py-2 text-xs font-semibold ${
                    createNotice.tone === "success"
                      ? "text-[#009E73] bg-[#02D99D]/10 border border-[#02D99D]/25"
                      : "text-red-500 bg-red-50 border border-red-200 dark:text-red-300 dark:bg-red-500/10 dark:border-red-500/25"
                  }`}
                  role="status"
                  aria-live="polite"
                >
                  {createNotice.text}
                </div>
              )}

              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest mb-1.5" style={mutedTextStyle}>
                  Entity name
                </label>
                <input
                  value={createName}
                  onChange={(event) => {
                    setCreateNotice(null);
                    setCreateName(event.target.value);
                  }}
                  disabled={creatingEntity}
                  placeholder="Denver Office"
                  className="w-full px-4 py-2.5 rounded-xl text-sm border placeholder:text-[#0A1547]/30 dark:placeholder:text-slate-400/45 focus:outline-none focus:ring-2 focus:ring-[#A380F6]/25 focus:border-[#A380F6]"
                  style={fieldSurfaceStyle}
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest mb-1.5" style={mutedTextStyle}>
                  Entity label
                </label>
                <select
                  value={createEntityLabelChoice}
                  onChange={(event) => {
                    setCreateNotice(null);
                    setCreateEntityLabelChoice(event.target.value);
                  }}
                  disabled={creatingEntity}
                  className="w-full h-[42px] px-4 py-2.5 rounded-xl text-sm border focus:outline-none focus:ring-2 focus:ring-[#A380F6]/25 focus:border-[#A380F6]"
                  style={fieldSurfaceStyle}
                >
                  {STANDARD_ENTITY_LABELS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                  <option value={CUSTOM_ENTITY_LABEL}>Custom</option>
                </select>
                {createEntityLabelChoice === CUSTOM_ENTITY_LABEL && (
                  <input
                    value={createCustomEntityLabel}
                    onChange={(event) => {
                      setCreateNotice(null);
                      setCreateCustomEntityLabel(event.target.value);
                    }}
                    disabled={creatingEntity}
                    placeholder="Custom label"
                    className="mt-2 w-full px-4 py-2.5 rounded-xl text-sm border placeholder:text-[#0A1547]/30 dark:placeholder:text-slate-400/45 focus:outline-none focus:ring-2 focus:ring-[#A380F6]/25 focus:border-[#A380F6]"
                    style={fieldSurfaceStyle}
                  />
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t" style={{ ...dividerStyle, backgroundColor: "var(--as-surface-muted)" }}>
              <button
                type="button"
                onClick={closeCreate}
                disabled={creatingEntity}
                className="px-4 py-2 rounded-full text-sm font-bold text-[#0A1547]/55 dark:text-slate-300/70 hover:text-[#0A1547] dark:hover:text-white hover:bg-white dark:hover:bg-white/5 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => { void createEntity(); }}
                disabled={creatingEntity}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full text-sm font-bold text-white hover:opacity-90 disabled:opacity-60"
                style={{ backgroundColor: "#A380F6" }}
              >
                <Plus className="w-4 h-4" />
                {creatingEntity ? "Creating..." : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
