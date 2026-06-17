import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Building2, Check, Download, Edit2, Plus, Save, Upload, X } from "lucide-react";
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

interface RawImportRow {
  rowNumber: number;
  name: string;
  locationType: string;
  locationUserEmail: string;
  memberRole: string;
}

interface ImportPreviewRow extends RawImportRow {
  errors: string[];
  warnings: string[];
  status: "ready" | "skip" | "error";
}

interface ImportResultCounts {
  total: number;
  valid: number;
  created: number;
  skipped: number;
  failed: number;
}

interface ImportResultRow {
  row_number?: number;
  name?: string;
  location_type?: string;
  location_user_email?: string;
  member_role?: string;
  status?: string;
  detail?: string;
  errors?: string[];
  warnings?: string[];
  item?: unknown;
  assignment?: {
    status?: string;
    code?: string;
    detail?: string;
  } | null;
}

interface ImportResult {
  counts?: ImportResultCounts;
  results?: ImportResultRow[];
  created?: unknown[];
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
const IMPORT_TEMPLATE_HEADERS = ["Name", "Location type", "Location user email", "Manager/Member designation"];
const IMPORT_TEMPLATE_ROWS = [
  ["Castle Rock Office", "Office", "manager@example.com", "Manager"],
  ["Denver Office", "Office", "member@example.com", "Member"],
];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

function csvEscape(value: unknown): string {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function buildTemplateCsv(): string {
  return [IMPORT_TEMPLATE_HEADERS, ...IMPORT_TEMPLATE_ROWS]
    .map((row) => row.map(csvEscape).join(","))
    .join("\n");
}

function downloadCsvTemplate() {
  const blob = new Blob([buildTemplateCsv()], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "alphascreen-entities-import-template.csv";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        cell += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(cell);
      cell = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }

    cell += char;
  }

  row.push(cell);
  rows.push(row);
  return rows;
}

function normalizeHeader(value: unknown): string {
  return String(value || "").trim().toLowerCase();
}

function normalizeImportRole(value: unknown): string {
  const normalized = String(value || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (!normalized) return "";
  if (normalized === "manager") return "manager";
  if (normalized === "member") return "member";
  return normalized;
}

function parseImportRows(csvText: string): { rows: RawImportRow[]; error: string } {
  const parsed = parseCsv(csvText).filter((row) => row.some((cell) => String(cell || "").trim()));
  if (parsed.length === 0) return { rows: [], error: "" };

  const headers = parsed[0].map(normalizeHeader);
  const requiredHeaders = IMPORT_TEMPLATE_HEADERS.map(normalizeHeader);
  const exactHeaders = headers.length === requiredHeaders.length && requiredHeaders.every((header, index) => headers[index] === header);
  if (!exactHeaders) {
    return {
      rows: [],
      error: `CSV headers must be exactly: ${IMPORT_TEMPLATE_HEADERS.join(", ")}`,
    };
  }

  const rows = parsed.slice(1).map((row, index) => ({
    rowNumber: index + 2,
    name: String(row[0] || "").trim(),
    locationType: String(row[1] || "").trim().toLowerCase(),
    locationUserEmail: String(row[2] || "").trim().toLowerCase(),
    memberRole: normalizeImportRole(row[3]),
  })).filter((row) => (
    row.name || row.locationType || row.locationUserEmail || row.memberRole
  ));

  return { rows, error: "" };
}

function buildImportPreviewRows(rows: RawImportRow[], existingEntities: ClientEntity[]): ImportPreviewRow[] {
  const existingNames = new Set(existingEntities.map((entity) => entity.name.trim().toLowerCase()).filter(Boolean));
  const counts = new Map<string, number>();
  rows.forEach((row) => {
    const key = row.name.trim().toLowerCase();
    if (key) counts.set(key, (counts.get(key) || 0) + 1);
  });

  return rows.map((row) => {
    const errors: string[] = [];
    const warnings: string[] = [];
    const key = row.name.trim().toLowerCase();
    if (!row.name) errors.push("Name is required.");
    if (key && (counts.get(key) || 0) > 1) errors.push("Duplicate entity name in this CSV.");
    if (row.locationUserEmail && !EMAIL_RE.test(row.locationUserEmail)) errors.push("Location user email must be a valid email address.");
    if (row.memberRole && !["manager", "member"].includes(row.memberRole)) {
      errors.push("Manager/Member designation must be blank, Manager, or Member.");
    }
    if (row.memberRole && !row.locationUserEmail) {
      errors.push("Location user email is required when Manager/Member designation is supplied.");
    }
    if (row.locationUserEmail || row.memberRole) {
      warnings.push("Member assignment will not be created during this import.");
    }

    const existingDuplicate = key && existingNames.has(key);
    return {
      ...row,
      errors,
      warnings,
      status: errors.length > 0 ? "error" : existingDuplicate ? "skip" : "ready",
    };
  });
}

function displayImportRole(role: string): string {
  if (role === "manager") return "Manager";
  if (role === "member") return "Member";
  return role || "—";
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
  const [importOpen, setImportOpen] = useState(false);
  const [importCsvText, setImportCsvText] = useState("");
  const [importFileName, setImportFileName] = useState("");
  const [importConfirmed, setImportConfirmed] = useState(false);
  const [importSubmitting, setImportSubmitting] = useState(false);
  const [importNotice, setImportNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  const importPreview = useMemo(() => {
    if (!importCsvText.trim()) return { rows: [] as ImportPreviewRow[], parseError: "" };
    const parsed = parseImportRows(importCsvText);
    if (parsed.error) return { rows: [] as ImportPreviewRow[], parseError: parsed.error };
    return {
      rows: buildImportPreviewRows(parsed.rows, entities),
      parseError: "",
    };
  }, [importCsvText, entities]);

  const importRows = importPreview.rows;
  const importParseError = importPreview.parseError;
  const importReadyCount = importRows.filter((row) => row.status === "ready").length;
  const importSkipCount = importRows.filter((row) => row.status === "skip").length;
  const importErrorCount = importRows.filter((row) => row.status === "error").length;

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

  const resetImportState = () => {
    setImportCsvText("");
    setImportFileName("");
    setImportConfirmed(false);
    setImportSubmitting(false);
    setImportNotice(null);
    setImportResult(null);
  };

  const openImport = () => {
    setNotice(null);
    resetImportState();
    setImportOpen(true);
  };

  const closeImport = () => {
    if (importSubmitting) return;
    setImportOpen(false);
    resetImportState();
  };

  const handleImportFile = (file: File | null) => {
    if (!file) return;
    setImportNotice(null);
    setImportResult(null);
    setImportConfirmed(false);
    setImportFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      setImportCsvText(String(reader.result || ""));
    };
    reader.onerror = () => {
      setImportNotice({ tone: "error", text: "Could not read the selected CSV file." });
    };
    reader.readAsText(file);
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

  const submitImport = async () => {
    if (!selectedClientId) {
      setImportNotice({ tone: "error", text: "Client selection is required." });
      return;
    }
    if (!backendBase) {
      setImportNotice({ tone: "error", text: "Missing backend base URL configuration." });
      return;
    }
    if (importParseError || importErrorCount > 0 || importReadyCount === 0) {
      setImportNotice({ tone: "error", text: "Fix row errors before importing." });
      return;
    }
    if (!importConfirmed) {
      setImportNotice({ tone: "error", text: "Confirm that you reviewed the rows before importing." });
      return;
    }

    setImportSubmitting(true);
    setImportNotice(null);
    setImportResult(null);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = String(session?.access_token || "").trim();
      if (!token) throw new Error("Missing session token.");

      const response = await fetch(`${backendBase}/clients/entities/import`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        credentials: "omit",
        body: JSON.stringify({
          client_id: selectedClientId,
          rows: importRows.map((row) => ({
            name: row.name,
            location_type: row.locationType,
            location_user_email: row.locationUserEmail,
            member_role: row.memberRole,
          })),
        }),
      });

      const text = await response.text();
      if (!response.ok) throw new Error(extractErrorMessage(text, "Could not import entities."));

      const payload = parseJsonSafe(text) as ImportResult | null;
      const createdEntities = Array.isArray(payload?.created)
        ? payload.created.map(toEntity).filter((item): item is ClientEntity => Boolean(item))
        : [];

      if (createdEntities.length > 0) {
        setEntities((prev) => sortEntities([
          ...prev.filter((existing) => !createdEntities.some((created) => created.id === existing.id)),
          ...createdEntities,
        ]));
      }

      setImportResult(payload || null);
      setImportConfirmed(false);
      const counts = payload?.counts;
      setImportNotice({
        tone: counts?.failed ? "error" : "success",
        text: counts
          ? `Import complete: ${counts.created} created, ${counts.skipped} skipped, ${counts.failed} failed.`
          : "Import complete.",
      });
    } catch (importError) {
      setImportNotice({
        tone: "error",
        text: importError instanceof Error ? importError.message : "Could not import entities.",
      });
    } finally {
      setImportSubmitting(false);
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
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={downloadCsvTemplate}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold transition-colors"
                  style={{ backgroundColor: "var(--as-surface-muted)", color: "var(--as-text)" }}
                >
                  <Download className="w-3.5 h-3.5" />
                  CSV template
                </button>
                <button
                  type="button"
                  onClick={openImport}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold text-[#A380F6] bg-[#A380F6]/10 hover:bg-[#A380F6]/15 transition-colors"
                >
                  <Upload className="w-3.5 h-3.5" />
                  Import CSV
                </button>
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

      {importOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#0A1547]/35 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Import entities from CSV"
        >
          <div
            className="w-full max-w-5xl max-h-[92vh] rounded-2xl overflow-hidden flex flex-col"
            style={modalSurfaceStyle}
          >
            <div className="flex items-center justify-between gap-4 px-6 py-4 border-b" style={dividerStyle}>
              <div>
                <h3 className="text-base font-black" style={primaryTextStyle}>Import entities</h3>
                <p className="text-xs font-semibold mt-0.5" style={mutedTextStyle}>
                  Create child entities under {parent?.name || selectedClient.name || "the selected parent client"}.
                </p>
              </div>
              <button
                type="button"
                onClick={closeImport}
                disabled={importSubmitting}
                className="p-2 rounded-lg text-[#0A1547]/35 dark:text-slate-300/65 hover:text-[#0A1547] dark:hover:text-white hover:bg-gray-50 dark:hover:bg-white/5 disabled:opacity-50"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4 overflow-y-auto">
              <div className="rounded-xl border p-4" style={mutedPanelStyle}>
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 mt-0.5 text-[#A380F6] flex-shrink-0" />
                  <div className="space-y-1 text-xs font-semibold leading-relaxed" style={mutedTextStyle}>
                    <p>Imports create child entities only. Billing, agreements, subscriptions, and payment settings stay with the parent client.</p>
                    <p>Location type is saved as the entity label when provided. Location user email and Manager/Member designation are validated for review, but member assignments are not created during this import.</p>
                  </div>
                </div>
              </div>

              {importNotice && (
                <div
                  className={`rounded-xl px-3.5 py-2 text-xs font-semibold ${
                    importNotice.tone === "success"
                      ? "text-[#009E73] bg-[#02D99D]/10 border border-[#02D99D]/25"
                      : "text-red-500 bg-red-50 border border-red-200 dark:text-red-300 dark:bg-red-500/10 dark:border-red-500/25"
                  }`}
                  role="status"
                  aria-live="polite"
                >
                  {importNotice.text}
                </div>
              )}

              <div className="grid gap-3 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
                <div className="rounded-xl border p-4 space-y-3" style={mutedPanelStyle}>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest mb-1" style={subtleTextStyle}>Template</p>
                    <p className="text-xs font-semibold leading-relaxed" style={mutedTextStyle}>
                      Use these columns exactly: Name, Location type, Location user email, Manager/Member designation.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={downloadCsvTemplate}
                    className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold text-white hover:opacity-90"
                    style={{ backgroundColor: "#A380F6" }}
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download template
                  </button>
                  <p className="text-[11px] font-semibold leading-relaxed" style={subtleTextStyle}>
                    The template includes example rows only. Replace them before importing.
                  </p>
                </div>

                <div className="rounded-xl border p-4 space-y-3" style={mutedPanelStyle}>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest mb-1" style={subtleTextStyle}>Upload or paste CSV</p>
                    <p className="text-xs font-semibold leading-relaxed" style={mutedTextStyle}>
                      Select a CSV file or paste CSV content below, then review every parsed row before import.
                    </p>
                  </div>
                  <label className="inline-flex w-fit items-center justify-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold cursor-pointer text-[#A380F6] bg-[#A380F6]/10 hover:bg-[#A380F6]/15 transition-colors">
                    <Upload className="w-3.5 h-3.5" />
                    Select CSV
                    <input
                      type="file"
                      accept=".csv,text/csv"
                      className="hidden"
                      disabled={importSubmitting}
                      onChange={(event) => handleImportFile(event.target.files?.[0] || null)}
                    />
                  </label>
                  {importFileName && (
                    <p className="text-[11px] font-semibold" style={subtleTextStyle}>{importFileName}</p>
                  )}
                  <textarea
                    value={importCsvText}
                    onChange={(event) => {
                      setImportCsvText(event.target.value);
                      setImportNotice(null);
                      setImportResult(null);
                      setImportConfirmed(false);
                    }}
                    disabled={importSubmitting}
                    rows={7}
                    placeholder="Name,Location type,Location user email,Manager/Member designation"
                    className="w-full px-4 py-3 rounded-xl text-xs border placeholder:text-[#0A1547]/30 dark:placeholder:text-slate-400/45 focus:outline-none focus:ring-2 focus:ring-[#A380F6]/25 focus:border-[#A380F6]"
                    style={fieldSurfaceStyle}
                  />
                </div>
              </div>

              {(importParseError || importRows.length > 0) && (
                <div className="rounded-xl border overflow-hidden" style={mutedPanelStyle}>
                  <div className="px-4 py-3 border-b flex flex-wrap items-center justify-between gap-2" style={dividerStyle}>
                    <div>
                      <p className="text-sm font-black" style={primaryTextStyle}>Preview</p>
                      <p className="text-[11px] font-semibold mt-0.5" style={mutedTextStyle}>
                        {importRows.length} parsed row{importRows.length === 1 ? "" : "s"} · {importReadyCount} ready · {importSkipCount} skipped · {importErrorCount} with errors
                      </p>
                    </div>
                  </div>

                  {importParseError ? (
                    <div className="p-4 text-sm font-semibold text-red-500">{importParseError}</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b" style={dividerStyle}>
                            <th className="px-3 py-2 text-left font-black uppercase tracking-widest" style={subtleTextStyle}>Row</th>
                            <th className="px-3 py-2 text-left font-black uppercase tracking-widest" style={subtleTextStyle}>Name</th>
                            <th className="px-3 py-2 text-left font-black uppercase tracking-widest" style={subtleTextStyle}>Location type</th>
                            <th className="px-3 py-2 text-left font-black uppercase tracking-widest" style={subtleTextStyle}>User email</th>
                            <th className="px-3 py-2 text-left font-black uppercase tracking-widest" style={subtleTextStyle}>Designation</th>
                            <th className="px-3 py-2 text-left font-black uppercase tracking-widest" style={subtleTextStyle}>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {importRows.map((row) => (
                            <tr key={`${row.rowNumber}-${row.name}`} className="border-b last:border-b-0" style={dividerStyle}>
                              <td className="px-3 py-2 font-semibold" style={mutedTextStyle}>{row.rowNumber}</td>
                              <td className="px-3 py-2 font-semibold min-w-[10rem]" style={primaryTextStyle}>{row.name || "—"}</td>
                              <td className="px-3 py-2 font-semibold" style={mutedTextStyle}>{row.locationType || "—"}</td>
                              <td className="px-3 py-2 font-semibold max-w-[12rem] truncate" style={mutedTextStyle} title={row.locationUserEmail}>{row.locationUserEmail || "—"}</td>
                              <td className="px-3 py-2 font-semibold" style={mutedTextStyle}>{displayImportRole(row.memberRole)}</td>
                              <td className="px-3 py-2 min-w-[14rem]">
                                <div className="space-y-1">
                                  <span
                                    className={`inline-flex rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-widest ${
                                      row.status === "ready"
                                        ? "text-[#009E73] bg-[#02D99D]/10"
                                        : row.status === "skip"
                                          ? "text-[#A380F6] bg-[#A380F6]/10"
                                          : "text-red-500 bg-red-50 dark:bg-red-500/10"
                                    }`}
                                  >
                                    {row.status === "ready" ? "Ready" : row.status === "skip" ? "Skip duplicate" : "Error"}
                                  </span>
                                  {row.status === "skip" && (
                                    <p className="text-[11px] font-semibold leading-relaxed" style={mutedTextStyle}>Entity name already exists under this parent.</p>
                                  )}
                                  {[...row.errors, ...row.warnings].map((message) => (
                                    <p key={message} className={`text-[11px] font-semibold leading-relaxed ${row.errors.includes(message) ? "text-red-500" : ""}`} style={row.errors.includes(message) ? undefined : subtleTextStyle}>
                                      {message}
                                    </p>
                                  ))}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {importResult?.counts && (
                <div className="rounded-xl border p-4 space-y-3" style={mutedPanelStyle}>
                  <div>
                    <p className="text-sm font-black" style={primaryTextStyle}>Import results</p>
                    <p className="text-xs font-semibold mt-1" style={mutedTextStyle}>
                      {importResult.counts.created} created, {importResult.counts.skipped} skipped, {importResult.counts.failed} failed.
                    </p>
                  </div>
                  <div className="grid gap-2">
                    {(importResult.results || []).map((row) => (
                      <div key={`${row.row_number}-${row.name}-${row.status}`} className="rounded-lg border px-3 py-2" style={fieldSurfaceStyle}>
                        <p className="text-xs font-black" style={primaryTextStyle}>
                          Row {row.row_number || "—"} · {row.name || "Unnamed"} · {row.status || "unknown"}
                        </p>
                        {(row.detail || row.assignment?.detail || (row.errors || []).length > 0) && (
                          <p className="text-[11px] font-semibold mt-1 leading-relaxed" style={mutedTextStyle}>
                            {row.detail || row.assignment?.detail || (row.errors || []).join(" ")}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t flex flex-col gap-3 md:flex-row md:items-center md:justify-between" style={{ ...dividerStyle, backgroundColor: "var(--as-surface-muted)" }}>
              <label className="flex items-start gap-2 text-xs font-semibold leading-relaxed" style={mutedTextStyle}>
                <input
                  type="checkbox"
                  checked={importConfirmed}
                  onChange={(event) => setImportConfirmed(event.target.checked)}
                  disabled={importSubmitting || importRows.length === 0 || importErrorCount > 0 || Boolean(importParseError)}
                  className="mt-0.5 h-4 w-4 rounded border-gray-300 text-[#A380F6] focus:ring-[#A380F6]"
                />
                I reviewed the preview. Create ready entities under the selected parent client.
              </label>
              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={closeImport}
                  disabled={importSubmitting}
                  className="px-4 py-2 rounded-full text-sm font-bold text-[#0A1547]/55 dark:text-slate-300/70 hover:text-[#0A1547] dark:hover:text-white hover:bg-white dark:hover:bg-white/5 disabled:opacity-50"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => { void submitImport(); }}
                  disabled={importSubmitting || !importConfirmed || importReadyCount === 0 || importErrorCount > 0 || Boolean(importParseError)}
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full text-sm font-bold text-white hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed"
                  style={{ backgroundColor: "#A380F6" }}
                >
                  <Upload className="w-4 h-4" />
                  {importSubmitting ? "Importing..." : "Confirm import"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
