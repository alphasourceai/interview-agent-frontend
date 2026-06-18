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
  const parent = findHierarchyParent(clients, selectedClientId);
  if (!parent?.id) return [];

  const children = getHierarchyChildren(clients, parent.id);
  if (children.length === 0) return [];

  const labelSource = children.find((child) => cleanText(child.entity_label))?.entity_label || parent.entity_label;
  return [
    { value: "parent", label: "Parent" },
    { value: "all", label: `All ${pluralizeEntityLabel(labelSource)}` },
    ...children.map((child) => ({
      value: child.id,
      label: displayEntityName(child.name, "Unnamed entity"),
    })),
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
    return `The Parent option shows members assigned directly to the parent. The ${allLabel} option shows parent plus child entity member assignments. A specific entity option shows members assigned directly to that entity; inherited or effective access is not included. The Entity column shows which entity each row belongs to.`;
  }
  return `The Parent option shows records assigned directly to the parent. The ${allLabel} option shows parent plus child entity records. A specific entity option shows records assigned directly to that entity. The Entity column shows which entity each row belongs to.`;
}
