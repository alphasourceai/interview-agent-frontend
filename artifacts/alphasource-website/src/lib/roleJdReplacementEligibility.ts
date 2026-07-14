export interface RoleJdReplacementEligibility {
  eligible: boolean;
  blockers: string[];
}

const blockerLabels: Record<string, string> = {
  candidates: "Candidate activity",
  interviews: "Interview activity",
  reports: "Completed interview reports",
  otp_tokens: "Interview access records",
  accommodation_requests: "Accommodation activity",
  automation_rules: "Automation activity",
  automation_evaluations: "Automation activity",
  automation_actions: "Automation activity",
  automation_digest_deliveries: "Automation activity",
  digest_logs: "Automation activity",
  role_not_active: "This role is inactive",
  eligibility_unavailable: "Replacement availability is unavailable",
};

export function normalizeRoleJdReplacementEligibility(value: unknown): RoleJdReplacementEligibility {
  const raw = value && typeof value === "object" ? value as Record<string, unknown> : null;
  const blockers = Array.isArray(raw?.blockers)
    ? raw.blockers
      .map((blocker) => String(blocker || "").trim())
      .filter(Boolean)
    : [];
  return {
    eligible: raw?.eligible === true,
    blockers,
  };
}

export function replacementBlockerDescription(eligibility: RoleJdReplacementEligibility): string {
  const firstBlocker = eligibility.blockers[0];
  if (!firstBlocker) return "Replacement availability is unavailable.";
  if (firstBlocker === "role_not_active") return "Only active roles can be replaced.";
  const label = blockerLabels[firstBlocker] || "Role activity";
  return `Blocked by ${label.toLowerCase()}.`;
}

export function replacementBlockerLabels(eligibility: RoleJdReplacementEligibility): string[] {
  const labels = new Set<string>();
  for (const blocker of eligibility.blockers) {
    const label = blockerLabels[blocker] || "Role activity";
    labels.add(label);
  }
  return Array.from(labels);
}
