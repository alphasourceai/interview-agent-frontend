export const BACKEND_CONTRACT_COMMIT = "0e75f1d9e7ef40be1690da4cc16aab9ae7d83d80";

export type InterviewType = "core" | "leadership" | "technical";
export type InterviewTypeLabel = "Core" | "Leadership" | "Technical";
export type MembershipLevel = "basic" | "pro" | "enterprise";

export interface InterviewTypeOption {
  value: InterviewType;
  label: InterviewTypeLabel;
  tooltip: string;
  supporting: string;
  summary: string;
}

export interface MembershipCapacity {
  membership_level: MembershipLevel;
  label: "Basic" | "Pro" | "Enterprise";
  duration_minutes: number;
  scored_question_count: number;
}

export interface MembershipCapacityInput {
  membership_level?: unknown;
  plan_tier?: unknown;
  interview_duration_minutes?: unknown;
  max_interview_minutes?: unknown;
  scored_question_count?: unknown;
  internal_synthetic_duration_override?: unknown;
}

export const CANONICAL_INTERVIEW_TYPES: readonly InterviewType[] = Object.freeze([
  "core",
  "leadership",
  "technical",
]);

export const INTERVIEW_TYPE_OPTIONS: readonly Readonly<InterviewTypeOption>[] = Object.freeze([
  Object.freeze({
    value: "core",
    label: "Core",
    tooltip: "Broad screening of relevant experience, judgment, ownership, communication, adaptability, and role readiness.",
    supporting: "Core is appropriate for many individual-contributor and general roles and does not mean entry-level.",
    summary: "broad experience, judgment, ownership, communication, and readiness",
  }),
  Object.freeze({
    value: "leadership",
    label: "Leadership",
    tooltip: "Management and leadership screening focused on coaching, accountability, prioritization, conflict, change, and execution.",
    supporting: "",
    summary: "coaching, accountability, decisions, and execution",
  }),
  Object.freeze({
    value: "technical",
    label: "Technical",
    tooltip: "Role-specific applied assessment of technical knowledge, troubleshooting, implementation, tradeoffs, risk, and quality.",
    supporting: "",
    summary: "applied knowledge, troubleshooting, tradeoffs, risk, and quality",
  }),
]);

const INTERVIEW_TYPE_ALIASES: Readonly<Record<string, InterviewType>> = Object.freeze({
  basic: "core",
  core: "core",
  detailed: "leadership",
  leadership: "leadership",
  technical: "technical",
});

export const MEMBERSHIP_CAPACITY: Readonly<Record<MembershipLevel, Readonly<MembershipCapacity>>> = Object.freeze({
  basic: Object.freeze({ membership_level: "basic", label: "Basic", duration_minutes: 10, scored_question_count: 5 }),
  pro: Object.freeze({ membership_level: "pro", label: "Pro", duration_minutes: 12, scored_question_count: 6 }),
  enterprise: Object.freeze({ membership_level: "enterprise", label: "Enterprise", duration_minutes: 15, scored_question_count: 7 }),
});

export function normalizeMembershipLevel(value: unknown): MembershipLevel | null {
  const normalized = String(value || "").trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(MEMBERSHIP_CAPACITY, normalized)
    ? normalized as MembershipLevel
    : null;
}

export function normalizeInterviewTypeForRead(
  value: unknown,
  fallback: InterviewType | null = "core",
): InterviewType | null {
  const normalized = String(value || "").trim().toLowerCase();
  return INTERVIEW_TYPE_ALIASES[normalized] || fallback;
}

export function toCanonicalInterviewTypeWrite(value: unknown): InterviewType {
  const normalized = normalizeInterviewTypeForRead(value, null);
  if (!normalized || !CANONICAL_INTERVIEW_TYPES.includes(normalized)) {
    throw new TypeError("Interview type must be Core, Leadership, or Technical.");
  }
  return normalized;
}

export function getInterviewTypeOption(value: unknown): Readonly<InterviewTypeOption> | null {
  const normalized = normalizeInterviewTypeForRead(value, null);
  return INTERVIEW_TYPE_OPTIONS.find((option) => option.value === normalized) || null;
}

export function getInterviewTypeLabel(value: unknown): InterviewTypeLabel | "—" {
  return getInterviewTypeOption(value)?.label || "—";
}

function positiveInteger(value: unknown): number | null {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

export function resolveMembershipCapacity(
  membershipLevel: unknown,
  backendCapacity: MembershipCapacityInput | null = null,
): Readonly<MembershipCapacity> | null {
  const membership = normalizeMembershipLevel(
    membershipLevel || backendCapacity?.membership_level || backendCapacity?.plan_tier,
  );
  if (!membership) return null;

  const fallback = MEMBERSHIP_CAPACITY[membership];
  const isInternalOverride = backendCapacity?.internal_synthetic_duration_override === true;
  const backendDuration = isInternalOverride
    ? null
    : positiveInteger(
      backendCapacity?.interview_duration_minutes ?? backendCapacity?.max_interview_minutes,
    );
  const backendQuestionCount = positiveInteger(backendCapacity?.scored_question_count);

  return Object.freeze({
    ...fallback,
    duration_minutes: backendDuration ?? fallback.duration_minutes,
    scored_question_count: backendQuestionCount ?? fallback.scored_question_count,
  });
}

export function formatMembershipCapacity(
  membershipLevel: unknown,
  backendCapacity: MembershipCapacityInput | null = null,
): string {
  const capacity = resolveMembershipCapacity(membershipLevel, backendCapacity);
  if (!capacity) return "Membership capacity unavailable";
  return `${capacity.label} — ${capacity.duration_minutes} minutes, ${capacity.scored_question_count} scored questions`;
}

export function formatMembershipSentence(
  membershipLevel: unknown,
  backendCapacity: MembershipCapacityInput | null = null,
): string {
  const capacity = resolveMembershipCapacity(membershipLevel, backendCapacity);
  if (!capacity) return "Membership capacity will be confirmed before interview launch.";
  return `${capacity.duration_minutes}-minute interview with ${capacity.scored_question_count} scored questions.`;
}
