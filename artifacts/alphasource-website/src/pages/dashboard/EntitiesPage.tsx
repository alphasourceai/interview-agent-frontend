import { useEffect, useState } from "react";
import { Building2, Check, Edit2, Plus, Save, X } from "lucide-react";
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
  const [editEntityLabel, setEditEntityLabel] = useState("");
  const [savingId, setSavingId] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createEntityLabel, setCreateEntityLabel] = useState("");
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
    setEditEntityLabel(entity.entity_label || "");
  };

  const cancelEdit = () => {
    setEditingId("");
    setEditName("");
    setEditEntityLabel("");
  };

  const openCreate = () => {
    setNotice(null);
    setCreateNotice(null);
    setCreateName("");
    setCreateEntityLabel("");
    setCreateOpen(true);
  };

  const closeCreate = () => {
    if (creatingEntity) return;
    setCreateOpen(false);
    setCreateNotice(null);
    setCreateName("");
    setCreateEntityLabel("");
  };

  const createEntity = async () => {
    const name = createName.trim();
    if (!name) {
      setCreateNotice({ tone: "error", text: "Entity name is required." });
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
          entity_label: createEntityLabel.trim() || null,
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
          entity_label: editEntityLabel.trim() || null,
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
          className="bg-white rounded-2xl p-6"
          style={{ border: "1px solid rgba(10,21,71,0.07)", boxShadow: "0 2px 12px rgba(10,21,71,0.05)" }}
        >
          <p className="text-sm text-[#0A1547]/45 font-semibold">Loading entity access...</p>
        </div>
      </DashboardLayout>
    );
  }

  if (!canManageEntities) {
    return (
      <DashboardLayout title="Entities">
        <div
          className="bg-white rounded-2xl p-6"
          style={{ border: "1px solid rgba(10,21,71,0.07)", boxShadow: "0 2px 12px rgba(10,21,71,0.05)" }}
        >
          <h2 className="text-base font-black text-[#0A1547] mb-2">Entities unavailable</h2>
          <p className="text-sm text-[#0A1547]/45 font-semibold">
            You do not have permission to manage entities for this client.
          </p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Entities">
      <div className="space-y-5">
        <div
          className="bg-white rounded-2xl overflow-hidden"
          style={{ border: "1px solid rgba(10,21,71,0.07)", boxShadow: "0 2px 12px rgba(10,21,71,0.05)" }}
        >
          <div className="px-6 pt-6 pb-5 border-b border-gray-100">
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
              <div>
                <h2 className="text-base font-black text-[#0A1547]">Client Entities</h2>
                <p className="text-xs text-[#0A1547]/45 font-semibold mt-1">
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
                    : "text-red-500 bg-red-50 border border-red-200"
                }`}
                role="status"
                aria-live="polite"
              >
                {notice.text}
              </div>
            )}

            {loading ? (
              <div className="py-12 text-center text-sm text-[#0A1547]/35 font-semibold">Loading entities...</div>
            ) : error ? (
              <div className="py-12 text-center text-sm text-red-500 font-semibold">{error}</div>
            ) : (
              <>
                <div className="rounded-2xl border border-[#A380F6]/20 bg-[#A380F6]/5 p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[#A380F6]/15 text-[#A380F6] flex-shrink-0">
                      <Building2 className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-black text-[#0A1547] truncate">{parent?.name || selectedClient.name}</p>
                      <p className="text-xs font-semibold text-[#0A1547]/45 mt-1">Parent client</p>
                    </div>
                  </div>
                </div>

                <div className="pl-4 md:pl-8 border-l-2 border-dashed border-[#A380F6]/20 space-y-3">
                  {entities.length === 0 ? (
                    <div className="rounded-2xl border border-gray-100 bg-gray-50/60 p-5 text-sm text-[#0A1547]/40 font-semibold">
                      No child entities have been added yet.
                    </div>
                  ) : (
                    entities.map((entity) => {
                      const editing = editingId === entity.id;
                      const saving = savingId === entity.id;
                      return (
                        <div
                          key={entity.id}
                          className="rounded-2xl bg-white border border-gray-100 p-4"
                          style={{ boxShadow: "0 1px 8px rgba(10,21,71,0.04)" }}
                        >
                          {editing ? (
                            <div className="space-y-3">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div>
                                  <label className="block text-[10px] font-black uppercase tracking-widest text-[#0A1547]/40 mb-1.5">
                                    Entity name
                                  </label>
                                  <input
                                    value={editName}
                                    onChange={(event) => setEditName(event.target.value)}
                                    disabled={saving}
                                    className="w-full px-4 py-2.5 rounded-xl text-sm bg-gray-50 border border-gray-200 text-[#0A1547] focus:outline-none focus:ring-2 focus:ring-[#A380F6]/25 focus:border-[#A380F6]"
                                  />
                                </div>
                                <div>
                                  <label className="block text-[10px] font-black uppercase tracking-widest text-[#0A1547]/40 mb-1.5">
                                    Entity label
                                  </label>
                                  <input
                                    value={editEntityLabel}
                                    onChange={(event) => setEditEntityLabel(event.target.value)}
                                    disabled={saving}
                                    placeholder="office, location, entity"
                                    className="w-full px-4 py-2.5 rounded-xl text-sm bg-gray-50 border border-gray-200 text-[#0A1547] placeholder:text-[#0A1547]/30 focus:outline-none focus:ring-2 focus:ring-[#A380F6]/25 focus:border-[#A380F6]"
                                  />
                                </div>
                              </div>
                              <div className="flex justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={cancelEdit}
                                  disabled={saving}
                                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold text-[#0A1547]/55 hover:text-[#0A1547] hover:bg-gray-50 disabled:opacity-50"
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
                                  <p className="text-sm font-black text-[#0A1547] truncate">{entity.name}</p>
                                </div>
                                <p className="text-xs font-semibold text-[#0A1547]/45 mt-1">
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
            className="w-full max-w-lg rounded-2xl bg-white overflow-hidden"
            style={{ boxShadow: "0 20px 60px rgba(10,21,71,0.22)" }}
          >
            <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-gray-100">
              <div>
                <h3 className="text-base font-black text-[#0A1547]">Add entity</h3>
                <p className="text-xs font-semibold text-[#0A1547]/45 mt-0.5">
                  Create a child entity under the parent client.
                </p>
              </div>
              <button
                type="button"
                onClick={closeCreate}
                disabled={creatingEntity}
                className="p-2 rounded-lg text-[#0A1547]/35 hover:text-[#0A1547] hover:bg-gray-50 disabled:opacity-50"
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
                      : "text-red-500 bg-red-50 border border-red-200"
                  }`}
                  role="status"
                  aria-live="polite"
                >
                  {createNotice.text}
                </div>
              )}

              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-[#0A1547]/40 mb-1.5">
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
                  className="w-full px-4 py-2.5 rounded-xl text-sm bg-gray-50 border border-gray-200 text-[#0A1547] placeholder:text-[#0A1547]/30 focus:outline-none focus:ring-2 focus:ring-[#A380F6]/25 focus:border-[#A380F6]"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-[#0A1547]/40 mb-1.5">
                  Entity label
                </label>
                <input
                  value={createEntityLabel}
                  onChange={(event) => {
                    setCreateNotice(null);
                    setCreateEntityLabel(event.target.value);
                  }}
                  disabled={creatingEntity}
                  placeholder="office, location, department"
                  className="w-full px-4 py-2.5 rounded-xl text-sm bg-gray-50 border border-gray-200 text-[#0A1547] placeholder:text-[#0A1547]/30 focus:outline-none focus:ring-2 focus:ring-[#A380F6]/25 focus:border-[#A380F6]"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50/60">
              <button
                type="button"
                onClick={closeCreate}
                disabled={creatingEntity}
                className="px-4 py-2 rounded-full text-sm font-bold text-[#0A1547]/55 hover:text-[#0A1547] hover:bg-white disabled:opacity-50"
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
