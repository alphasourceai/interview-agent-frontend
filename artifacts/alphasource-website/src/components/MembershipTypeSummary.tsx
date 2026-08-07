import {
  formatMembershipCapacity,
  getInterviewTypeOption,
  type InterviewType,
  type MembershipCapacityInput,
} from "@/lib/interviewContract";

export default function MembershipTypeSummary({
  membershipLevel,
  backendCapacity,
  interviewType,
  compact = false,
}: {
  membershipLevel: unknown;
  backendCapacity?: MembershipCapacityInput | null;
  interviewType: InterviewType | string | null | undefined;
  compact?: boolean;
}) {
  const type = getInterviewTypeOption(interviewType);
  const cardClass = compact ? "rounded-xl border px-3 py-2" : "rounded-xl border px-4 py-3";

  return (
    <div
      role="group"
      aria-label="Membership and interview type"
      className={`grid gap-2 ${compact ? "sm:grid-cols-2" : "md:grid-cols-2"}`}
    >
      <div className={cardClass} style={{ backgroundColor: "var(--as-surface-muted)", borderColor: "var(--as-border)" }}>
        <div className="text-[10px] font-black uppercase tracking-widest" style={{ color: "var(--as-text-subtle)" }}>Membership</div>
        <div className={`mt-1 font-semibold leading-relaxed ${compact ? "text-xs" : "text-sm"}`} style={{ color: "var(--as-text)" }}>
          {formatMembershipCapacity(membershipLevel, backendCapacity || null)}
        </div>
      </div>
      <div className={cardClass} style={{ backgroundColor: "var(--as-surface-muted)", borderColor: "var(--as-border)" }}>
        <div className="text-[10px] font-black uppercase tracking-widest" style={{ color: "var(--as-text-subtle)" }}>Interview type</div>
        <div className={`mt-1 font-semibold leading-relaxed ${compact ? "text-xs" : "text-sm"}`} style={{ color: "var(--as-text)" }}>
          {type ? `${type.label} — ${type.summary}` : "Not selected"}
        </div>
      </div>
    </div>
  );
}
