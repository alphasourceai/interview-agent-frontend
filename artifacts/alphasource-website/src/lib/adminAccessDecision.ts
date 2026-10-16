export type AdminAccessResult = { status: "allowed" | "denied" | "stale"; userId: string | null };
export type AdminAccessDecision = {
  userId: string | null;
  verifiedUserId: string | null;
  epoch: number;
  generation: number;
  phase: "unknown" | "pending" | "allowed" | "denied";
};
export const unknownAdminAccess: AdminAccessDecision = {
  userId: null, verifiedUserId: null, epoch: -1, generation: 0, phase: "unknown",
};
export function beginAdminAccessCheck(previous: AdminAccessDecision, userId: string, epoch: number, generation: number): AdminAccessDecision {
  return { userId, epoch, generation, phase: "pending",
    verifiedUserId: previous.userId === userId && previous.verifiedUserId === userId ? userId : null };
}
export function settleAdminAccessCheck(previous: AdminAccessDecision, generation: number, result: AdminAccessResult): AdminAccessDecision {
  if (previous.generation !== generation || result.status === "stale"
    || (result.userId !== null && result.userId !== previous.userId)) return previous;
  if (result.status === "allowed" && result.userId !== previous.userId) return previous;
  return { ...previous, phase: result.status, verifiedUserId: result.status === "allowed" ? result.userId : null };
}
export function adminAccessView(state: AdminAccessDecision, userId: string | null, epoch: number, ready: boolean, signedIn: boolean) {
  const mounted = ready && signedIn && !!userId && state.userId === userId && state.verifiedUserId === userId
    && (state.phase === "allowed" || state.phase === "pending");
  return { mounted, pending: state.epoch !== epoch || state.phase !== "allowed" };
}
