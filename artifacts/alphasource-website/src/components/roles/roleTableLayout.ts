export type RoleTableColumnKey =
  | "role"
  | "created"
  | "entity"
  | "type"
  | "usage"
  | "actions";

type RoleTableAlignment = "left" | "center" | "right";

export const ROLE_TABLE_COLUMN_ALIGNMENTS: Record<RoleTableColumnKey, RoleTableAlignment> = {
  role: "left",
  created: "left",
  entity: "left",
  type: "center",
  usage: "center",
  actions: "right",
};

export const ROLE_TABLE_ALIGNMENT_CLASSES: Record<RoleTableAlignment, string> = {
  left: "flex w-full items-center justify-start text-left",
  center: "flex w-full items-center justify-center text-center",
  right: "flex w-full items-center justify-end text-right",
};

export const ROLE_TABLE_CLIENT_COLUMNS: Record<
  RoleTableColumnKey,
  { width: string; horizontalPadding: string }
> = {
  role: { width: "w-[27%]", horizontalPadding: "px-6" },
  created: { width: "w-[14%]", horizontalPadding: "px-4" },
  entity: { width: "w-[18%]", horizontalPadding: "px-4" },
  type: { width: "w-[12%]", horizontalPadding: "px-4" },
  usage: { width: "w-[18%]", horizontalPadding: "px-4" },
  actions: { width: "w-[11%]", horizontalPadding: "px-4 pr-6" },
};

export const ROLE_TABLE_ADMIN_GRID_TEMPLATE =
  "grid min-w-[900px] grid-cols-[minmax(220px,1.45fr)_minmax(135px,1fr)_108px_90px_minmax(130px,.9fr)_80px_112px] items-center px-5";

export function roleTableAlignmentClass(column: RoleTableColumnKey): string {
  return ROLE_TABLE_ALIGNMENT_CLASSES[ROLE_TABLE_COLUMN_ALIGNMENTS[column]];
}
