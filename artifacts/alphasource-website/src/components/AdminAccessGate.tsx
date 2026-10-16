import { useEffect, useRef, useState, type ReactNode } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { adminAccessView, beginAdminAccessCheck, settleAdminAccessCheck, unknownAdminAccess } from "@/lib/adminAccessDecision";

export default function AdminAccessGate({ children }: { children: ReactNode }) {
  const { clientAuthReady, isLoggedIn, currentUser, adminAccessEpoch, resolveAdminAccess } = useAuth();
  const userId = currentUser?.id || null;
  const [, setLocation] = useLocation();
  const [decision, setDecision] = useState(unknownAdminAccess);
  const generation = useRef(0);

  useEffect(() => {
    const check = ++generation.current;
    if (!clientAuthReady) return;
    if (!isLoggedIn || !userId) {
      setDecision(unknownAdminAccess);
      setLocation("/");
      return;
    }
    let active = true;
    setDecision(previous => beginAdminAccessCheck(previous, userId, adminAccessEpoch, check));
    void resolveAdminAccess().then(result => {
      if (!active || generation.current !== check) return;
      if (result.status === "stale" || (result.userId !== null && result.userId !== userId)) {
        console.warn("admin_access_verification_stale");
        return; // Inert pending view; never reinterpret a superseded probe as denial.
      }
      setDecision(previous => settleAdminAccessCheck(previous, check, result));
      if (result.status === "denied") setLocation("/");
    }).catch(() => {
      if (!active || generation.current !== check) return;
      setDecision(previous => settleAdminAccessCheck(previous, check, { status: "denied", userId }));
      setLocation("/");
    });
    return () => { active = false; ++generation.current; };
  }, [clientAuthReady, isLoggedIn, userId, adminAccessEpoch, resolveAdminAccess, setLocation]);

  const view = adminAccessView(decision, userId, adminAccessEpoch, clientAuthReady, isLoggedIn);
  if (!view.mounted) return null;
  // Same identity/key keeps the form mounted. A changed identity gets a fresh subtree.
  return <div key={userId} inert={view.pending} aria-busy={view.pending}>{children}</div>;
}
