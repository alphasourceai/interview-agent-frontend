const CANDIDATE_FLOW_MESSAGES: Record<string, string> = {
  CANDIDATE_ALREADY_EXISTS: "A candidate with this contact information already exists for this role. Use the original information or contact support.",
  INTERVIEW_ALREADY_COMPLETED: "An interview has already been completed for this role. Contact support if another attempt was approved.",
  INTERVIEW_IN_PROGRESS: "An interview is already in progress for this role. Return to the existing interview session.",
  RETAKE_AUTHORIZATION_REQUIRED: "A new interview attempt requires approval. Contact support to request another attempt.",
  OTP_EXPIRED: "This verification code has expired. Request a new code and try again.",
  OTP_USED: "This verification code has already been used. Request a new code and try again.",
  INTERVIEW_LINK_EXPIRED: "This interview link is invalid or expired. Request a current link from the hiring team.",
  INTERVIEW_LINK_RESET_REQUIRED: "This interview link can no longer be used. Contact support to request reviewed access.",
  INVALID_PHONE_FOR_COUNTRY: "Enter a valid phone number for the selected country.",
  RESUME_EMPTY: "The resume appears to be blank. Choose a resume with readable content and try again.",
  RESUME_UPLOAD_FAILED: "The resume could not be uploaded. Your submission was not completed; please try again.",
  RESUME_UNREADABLE: "The resume file could not be read. Choose a valid PDF, DOC, or DOCX file and try again.",
  INTERVIEW_VENDOR_START_FAILED: "The interview room could not be started. Contact support before trying again.",
  INTERVIEW_PROGRESS_STALLED: "The interview stopped progressing after a reconnect attempt. Contact support so your access can be reviewed.",
  INTERVIEW_DISCONNECTED: "The interview disconnected and could not reconnect. Contact support so your access can be reviewed.",
  ANALYSIS_FAILED: "Interview analysis could not be completed. Support can retry the analysis without repeating the interview.",
  INVALID_SUBMISSION_KEY: "The submission session is invalid. Refresh the interview link and try again.",
  RATE_LIMITED: "Too many requests. Please wait and try again.",
  TEMPORARY_SERVICE_ERROR: "The service is temporarily unavailable. Please try again shortly.",
};

export function getCandidateFlowError(data: unknown, fallback: string): string {
  const payload = data && typeof data === "object" ? data as Record<string, unknown> : {};
  const code = String(payload.code || "").trim().toUpperCase();
  if (code && CANDIDATE_FLOW_MESSAGES[code]) return CANDIDATE_FLOW_MESSAGES[code];
  const detail = String(payload.detail || "").trim();
  const error = String(payload.error || "").trim();
  return detail || error || fallback;
}
