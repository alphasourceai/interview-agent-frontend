export type BillingModel = "fixed" | "rollover" | "usage" | null;
export function billingModel(value: unknown): BillingModel {
  return value === "fixed" || value === "rollover" || value === "usage"
    ? value
    : null;
}
export function nonNegativeCount(value: unknown): number | null {
  if (
    value == null ||
    (typeof value !== "number" && typeof value !== "string") ||
    (typeof value === "string" && !value.trim())
  )
    return null;
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= 0 ? number : null;
}
export function moneyCents(value: unknown): string {
  const cents = nonNegativeCount(value);
  return cents === null
    ? "Not configured"
    : new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
      }).format(cents / 100);
}
export function moneyDollars(value: unknown): string {
  if (
    (typeof value !== "number" && typeof value !== "string") ||
    (typeof value === "string" && !value.trim())
  )
    return "Not configured";
  const dollars = Number(value);
  if (!Number.isFinite(dollars) || dollars < 0) return "Not configured";
  return moneyCents(Math.round(dollars * 100));
}
export function hasPricedUsage(value: unknown): boolean {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every(
      (line) =>
        line &&
        typeof line === "object" &&
        nonNegativeCount(line.quantity) !== null &&
        nonNegativeCount(line.unit_price_cents) !== null &&
        nonNegativeCount(line.amount_cents) !== null,
    )
  );
}
export function modelLabel(value: unknown): string {
  const model = billingModel(value);
  return model === "fixed"
    ? "Per-role allowance"
    : model === "rollover"
      ? "Per-role allowance + rollover credits"
      : model === "usage"
        ? "Metered interviews"
        : "Model unavailable";
}
export interface RoleCapacity {
  model: BillingModel;
  own: number | null;
  shared: number | null;
  pool: number | null;
  used: number | null;
}
export function roleCapacity(row: Record<string, unknown>): RoleCapacity {
  return {
    model: billingModel(row.billing_model),
    own: nonNegativeCount(row.own_remaining_interviews),
    shared: nonNegativeCount(row.credit_interviews),
    pool: nonNegativeCount(row.pool_remaining_interviews),
    used: nonNegativeCount(row.used_interviews),
  };
}
export function capacityLabel(capacity: RoleCapacity): string {
  const used =
    capacity.used === null ? "Usage unavailable" : `${capacity.used} used`;
  if (capacity.model === "usage") return `Metered · ${used}`;
  if (!capacity.model || capacity.own === null)
    return `Capacity unavailable · ${used}`;
  return `${capacity.own} role-owned left · ${used}`;
}
// Shared credit/pool is deliberately NOT added once per role.
export function summarizeRoleCapacity(capacities: RoleCapacity[]): {
  value: string;
  detail: string;
} {
  if (!capacities.length) return { value: "—", detail: "no roles in scope" };
  if (
    capacities.some((c) => !c.model || (c.model !== "usage" && c.own === null))
  )
    return { value: "—", detail: "capacity unavailable" };
  const metered = capacities.filter((c) => c.model === "usage").length;
  const own = capacities.reduce(
    (sum, c) => sum + (c.model !== "usage" ? (c.own ?? 0) : 0),
    0,
  );
  if (metered === capacities.length)
    return {
      value: "Metered",
      detail: "usage-based roles; not a remaining quota",
    };
  return {
    value: String(own),
    detail: metered
      ? `role-owned interviews; ${metered} metered roles separate`
      : "role-owned interviews; shared credits separate",
  };
}
