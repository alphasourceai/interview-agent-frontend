export type EntityFilterValue = "parent" | "all" | string;

export interface EntityClientLike {
  id: string;
  name: string;
  parent_client_id?: string | null;
  entity_label?: string | null;
  is_child_client?: boolean;
  is_parent_client?: boolean;
}

export interface EntityFilterOption {
  value: EntityFilterValue;
  label: string;
}

export type EntityFilterHelpMode = "records" | "members";

export interface EntityRowLike {
  clientId?: string | null;
  client_id?: string | null;
  entityId?: string | null;
  entity_id?: string | null;
  entityName?: string | null;
  entity_name?: string | null;
  entityLabel?: string | null;
  entity_label?: string | null;
}

function cleanText(value: unknown): string {
  return String(value || "").trim();
}

export function isChildEntity(client: EntityClientLike | null | undefined): boolean {
  return Boolean(client?.is_child_client === true || cleanText(client?.parent_client_id));
}

export function displayEntityName(value: unknown, fallback = "—"): string {
  const text = cleanText(value);
  return text || fallback;
}

export function pluralizeEntityLabel(value: unknown): string {
  const raw = cleanText(value).toLowerCase();
  if (!raw) return "entities";
  if (raw === "office") return "offices";
  if (raw.endsWith("y") && raw.length > 1 && !/[aeiou]y$/.test(raw)) return `${raw.slice(0, -1)}ies`;
  if (raw.endsWith("s")) return raw;
  return `${raw}s`;
}

export function findHierarchyParent(
  clients: EntityClientLike[],
  selectedClientId: string,
): EntityClientLike | null {
  const selected = clients.find((client) => client.id === selectedClientId) || null;
  if (!selected) return null;
  const parentId = cleanText(selected.parent_client_id);
  if (!parentId) return selected;
  return clients.find((client) => client.id === parentId) || null;
}

export function getHierarchyChildren(
  clients: EntityClientLike[],
  parentClientId: string,
): EntityClientLike[] {
  const parentId = cleanText(parentClientId);
  if (!parentId) return [];
  return clients
    .filter((client) => cleanText(client.parent_client_id) === parentId)
    .sort((a, b) => cleanText(a.name).localeCompare(cleanText(b.name)));
}

export function defaultEntityFilterValue(
  clients: EntityClientLike[],
  selectedClientId: string,
): EntityFilterValue {
  const selected = clients.find((client) => client.id === selectedClientId) || null;
  if (isChildEntity(selected)) return selected?.id || "parent";
  return "parent";
}

export function buildEntityFilterOptions(
  clients: EntityClientLike[],
  selectedClientId: string,
): EntityFilterOption[] {
  const selected = clients.find((client) => client.id === selectedClientId) || null;
  const parent = findHierarchyParent(clients, selectedClientId);
  const parentId = cleanText(parent?.id) || cleanText(selected?.parent_client_id) || (!isChildEntity(selected) ? cleanText(selected?.id) : "");
  if (!selected?.id || !parentId) return [];

  const children = getHierarchyChildren(clients, parentId);
  const knownChildren =
    isChildEntity(selected) && !children.some((child) => child.id === selected.id)
      ? [...children, selected]
      : children;
  const hasHierarchySignal = knownChildren.length > 0 || selected.is_parent_client === true || isChildEntity(selected);
  if (!hasHierarchySignal) return [];

  const labelSource = knownChildren.find((child) => cleanText(child.entity_label))?.entity_label || selected.entity_label || parent?.entity_label;
  return [
    { value: "parent", label: "Parent" },
    { value: "all", label: `All ${pluralizeEntityLabel(labelSource)}` },
    ...knownChildren.map((child) => ({
      value: child.id,
      label: displayEntityName(child.name, "Unnamed entity"),
    })),
  ];
}

export function buildEntityFilterOptionsFromRows(
  clients: EntityClientLike[],
  selectedClientId: string,
  rows: EntityRowLike[],
): EntityFilterOption[] {
  const options = buildEntityFilterOptions(clients, selectedClientId);
  const selected = clients.find((client) => client.id === selectedClientId) || null;
  const parentId = cleanText(selected?.parent_client_id) || selectedClientId;
  const knownValues = new Set(options.map((option) => option.value));
  const rowOptions: EntityFilterOption[] = [];
  let labelSource = selected?.entity_label || "";

  for (const row of rows) {
    const id = cleanText(row.entityId ?? row.entity_id ?? row.clientId ?? row.client_id);
    if (!id || id === parentId || knownValues.has(id)) continue;
    const label = displayEntityName(row.entityName ?? row.entity_name, "");
    if (!label) continue;
    const rowLabel = cleanText(row.entityLabel ?? row.entity_label);
    if (!labelSource && rowLabel) labelSource = rowLabel;
    knownValues.add(id);
    rowOptions.push({ value: id, label });
  }

  if (!rowOptions.length) return options;
  if (options.length > 0) return [...options, ...rowOptions];
  return [
    { value: "parent", label: "Parent" },
    { value: "all", label: `All ${pluralizeEntityLabel(labelSource)}` },
    ...rowOptions.sort((a, b) => a.label.localeCompare(b.label)),
  ];
}

export function entityFilterQueryValue(value: EntityFilterValue): string {
  return cleanText(value);
}

export function entityFilterHelpText(
  options: EntityFilterOption[],
  mode: EntityFilterHelpMode = "records",
): string {
  const allLabel = options.find((option) => option.value === "all")?.label || "All entities";
  if (mode === "members") {
    return `The Parent option shows members assigned directly to the parent. The ${allLabel} option shows parent plus child entity member assignments. A specific entity option shows members assigned directly to that entity; inherited or effective access is not included. The Entity column shows where each row belongs.`;
  }
  return `The Parent option shows records assigned directly to the parent. The ${allLabel} option shows parent plus child entity records. A specific entity option shows records assigned directly to that entity. The Entity column shows which entity each row belongs to.`;
}
