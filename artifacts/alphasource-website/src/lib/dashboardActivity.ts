export const DASHBOARD_ACTIVITY_STORAGE_KEY = "alphasource:dashboard_last_activity_ms";
export const DASHBOARD_ACTIVITY_EVENT = "alphasource:dashboard_activity";

export function parseDashboardActivity(value: unknown): number {
  const parsed = Number(typeof value === "string" || typeof value === "number" ? value : "");
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
}

export function newerDashboardActivity(current: unknown, candidate: unknown): number | null {
  const currentAt = parseDashboardActivity(current);
  const candidateAt = parseDashboardActivity(candidate);
  return candidateAt > currentAt ? candidateAt : null;
}

export function signalDashboardActivity() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(DASHBOARD_ACTIVITY_EVENT));
}
