export const INTERVIEW_STATE_LABELS = {
  not_started: "Not started",
  no_response: "No response",
  tech_issue: "Tech issue",
  processing: "Processing",
  incomplete: "Incomplete",
  scored: "Scored",
} as const;

export type InterviewState = keyof typeof INTERVIEW_STATE_LABELS;
export type InterviewStateLabel = (typeof INTERVIEW_STATE_LABELS)[InterviewState];

export function normalizeInterviewState(value: unknown): InterviewState | undefined {
  const state = String(value || "").trim();
  return Object.prototype.hasOwnProperty.call(INTERVIEW_STATE_LABELS, state)
    ? state as InterviewState
    : undefined;
}

export function interviewStateLabel(state?: InterviewState): InterviewStateLabel | undefined {
  return state ? INTERVIEW_STATE_LABELS[state] : undefined;
}
