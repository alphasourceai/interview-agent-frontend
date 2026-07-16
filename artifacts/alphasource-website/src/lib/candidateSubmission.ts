const SUBMISSION_KEY_PREFIX = "alphasource_candidate_submission";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function storageKey(roleToken: string, surface: string): string {
  return `${SUBMISSION_KEY_PREFIX}:${surface}:${encodeURIComponent(String(roleToken || "").trim())}`;
}

function createSubmissionKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  const bytes = new Uint8Array(16);
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    crypto.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function getOrCreateCandidateSubmissionKey(roleToken: string, surface = "interview"): string {
  const key = storageKey(roleToken, surface);
  try {
    const existing = window.sessionStorage.getItem(key);
    if (existing && UUID_RE.test(existing)) return existing.toLowerCase();
    const created = createSubmissionKey();
    window.sessionStorage.setItem(key, created);
    return created;
  } catch {
    return createSubmissionKey();
  }
}

export function clearCandidateSubmissionKey(roleToken: string, surface = "interview"): void {
  try {
    window.sessionStorage.removeItem(storageKey(roleToken, surface));
  } catch {}
}
