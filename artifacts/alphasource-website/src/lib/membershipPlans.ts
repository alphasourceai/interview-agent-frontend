export type MembershipPlanKey = "basic" | "pro" | "enterprise";

const MEMBERSHIP_PLAN_LABELS: Readonly<Record<MembershipPlanKey, string>> = Object.freeze({
  basic: "Essential",
  pro: "Pro",
  enterprise: "Enterprise",
});

export function getMembershipPlanLabel(value: unknown, fallback = "—"): string {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return fallback;
  if (normalized === "essential") return MEMBERSHIP_PLAN_LABELS.basic;
  return MEMBERSHIP_PLAN_LABELS[normalized as MembershipPlanKey] || fallback;
}
