import { useCallback, useEffect, useRef, useState } from "react";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { ClientProvider } from "@/context/ClientContext";
import { AdminClientProvider } from "@/context/AdminClientContext";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

/* Public pages */
import HomePage from "@/pages/HomePage";
import AlphaScreenPage from "@/pages/AlphaScreenPage";
import AboutPage from "@/pages/AboutPage";
import PublicFaqPage from "@/pages/FaqPage";
import TermsPage from "@/pages/TermsPage";
import CandidateTermsPage from "@/pages/CandidateTermsPage";
import InterviewPage from "@/pages/InterviewPage";
import InterviewCviPage from "@/pages/InterviewCviPage";
import AccommodationRequestPage from "@/pages/AccommodationRequestPage";
import TextInterviewPage from "@/pages/TextInterviewPage";
import PwResetPage from "@/pages/PwResetPage";
import MembershipAgreementSignerPage from "@/pages/MembershipAgreementSignerPage";

/* Client dashboard */
import OverviewPage from "@/pages/dashboard/OverviewPage";
import RolesPage from "@/pages/dashboard/RolesPage";
import CandidatesPage from "@/pages/dashboard/CandidatesPage";
import MembersPage from "@/pages/dashboard/MembersPage";
import BillingPage from "@/pages/dashboard/BillingPage";
import DashboardFaqPage from "@/pages/dashboard/FaqPage";

/* Admin dashboard */
import AdminOverviewPage from "@/pages/admin/AdminOverviewPage";
import AdminClientsPage from "@/pages/admin/AdminClientsPage";
import AdminRolesPage from "@/pages/admin/AdminRolesPage";
import AdminCandidatesPage from "@/pages/admin/AdminCandidatesPage";
import AdminRoleConfigPage from "@/pages/admin/AdminRoleConfigPage";
import AdminMembersPage from "@/pages/admin/AdminMembersPage";
import AdminAccommodationsPage from "@/pages/admin/AdminAccommodationsPage";
import AdminBillingPage from "@/pages/admin/AdminBillingPage";
import AdminAuditLogsPage from "@/pages/admin/AdminAuditLogsPage";

import NotFound from "@/pages/not-found";

const queryClient = new QueryClient();
const DASHBOARD_TAB_ROUTE: Record<string, string> = {
  roles: "/dashboard/roles",
  candidates: "/dashboard/candidates",
  members: "/dashboard/members",
  billing: "/dashboard/billing",
};
const DASHBOARD_INACTIVITY_LIMIT_MS = 60 * 60 * 1000;
const DASHBOARD_WARNING_WINDOW_MS = 60 * 1000;
const DASHBOARD_ACTIVITY_STORAGE_KEY = "alphasource:dashboard_last_activity_ms";

function readStoredDashboardActivity(): number {
  if (typeof window === "undefined") return 0;
  try {
    const raw = window.localStorage.getItem(DASHBOARD_ACTIVITY_STORAGE_KEY);
    const parsed = Number(raw || "");
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  } catch {
    return 0;
  }
}

function writeStoredDashboardActivity(value: number) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(DASHBOARD_ACTIVITY_STORAGE_KEY, String(Math.max(0, Math.floor(value))));
  } catch {}
}

function DashboardInactivityController({ enabled }: { enabled: boolean }) {
  const { logout } = useAuth();
  const [, setLocation] = useLocation();
  const [warningOpen, setWarningOpen] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(60);
  const lastActivityRef = useRef(0);
  const warnedRef = useRef(false);
  const logoutTriggeredRef = useRef(false);
  const timersRef = useRef<{ warningTimer: number | null; logoutTimer: number | null; countdownTimer: number | null }>({
    warningTimer: null,
    logoutTimer: null,
    countdownTimer: null,
  });

  const clearTimers = useCallback(() => {
    if (typeof window === "undefined") return;
    if (timersRef.current.warningTimer !== null) {
      window.clearTimeout(timersRef.current.warningTimer);
      timersRef.current.warningTimer = null;
    }
    if (timersRef.current.logoutTimer !== null) {
      window.clearTimeout(timersRef.current.logoutTimer);
      timersRef.current.logoutTimer = null;
    }
    if (timersRef.current.countdownTimer !== null) {
      window.clearInterval(timersRef.current.countdownTimer);
      timersRef.current.countdownTimer = null;
    }
  }, []);

  const performLogout = useCallback(() => {
    if (logoutTriggeredRef.current) return;
    logoutTriggeredRef.current = true;
    clearTimers();
    setWarningOpen(false);
    setSecondsRemaining(60);
    warnedRef.current = false;
    logout();
    setLocation("/");
  }, [clearTimers, logout, setLocation]);

  const syncWarningCountdown = useCallback(() => {
    const remaining = DASHBOARD_INACTIVITY_LIMIT_MS - (Date.now() - lastActivityRef.current);
    if (remaining <= 0) {
      performLogout();
      return;
    }
    setSecondsRemaining(Math.max(1, Math.ceil(remaining / 1000)));
  }, [performLogout]);

  const startWarning = useCallback(() => {
    if (warnedRef.current) return;
    warnedRef.current = true;
    setWarningOpen(true);
    syncWarningCountdown();
    if (typeof window === "undefined") return;
    if (timersRef.current.countdownTimer !== null) {
      window.clearInterval(timersRef.current.countdownTimer);
    }
    timersRef.current.countdownTimer = window.setInterval(syncWarningCountdown, 250);
  }, [syncWarningCountdown]);

  const scheduleFrom = useCallback((activityAt: number) => {
    if (typeof window === "undefined" || !enabled) return;
    clearTimers();
    const elapsed = Date.now() - activityAt;
    const remaining = DASHBOARD_INACTIVITY_LIMIT_MS - elapsed;
    if (remaining <= 0) {
      performLogout();
      return;
    }
    if (remaining <= DASHBOARD_WARNING_WINDOW_MS) {
      startWarning();
    } else {
      warnedRef.current = false;
      setWarningOpen(false);
      setSecondsRemaining(60);
      timersRef.current.warningTimer = window.setTimeout(startWarning, remaining - DASHBOARD_WARNING_WINDOW_MS);
    }
    timersRef.current.logoutTimer = window.setTimeout(performLogout, remaining);
  }, [clearTimers, enabled, performLogout, startWarning]);

  const validateSessionAge = useCallback(() => {
    if (!enabled || logoutTriggeredRef.current) return;
    const stored = readStoredDashboardActivity();
    const baseline = stored > 0 ? stored : Date.now();
    if (stored <= 0) {
      writeStoredDashboardActivity(baseline);
    }
    lastActivityRef.current = baseline;
    if (Date.now() - baseline >= DASHBOARD_INACTIVITY_LIMIT_MS) {
      performLogout();
      return;
    }
    scheduleFrom(baseline);
  }, [enabled, performLogout, scheduleFrom]);

  const markActivity = useCallback((force = false) => {
    if (!enabled || logoutTriggeredRef.current || typeof window === "undefined") return;
    const now = Date.now();
    if (!force && now - lastActivityRef.current < 750) return;
    lastActivityRef.current = now;
    warnedRef.current = false;
    writeStoredDashboardActivity(now);
    setWarningOpen(false);
    setSecondsRemaining(60);
    scheduleFrom(now);
  }, [enabled, scheduleFrom]);

  useEffect(() => {
    if (!enabled || typeof window === "undefined" || typeof document === "undefined") {
      clearTimers();
      setWarningOpen(false);
      setSecondsRemaining(60);
      warnedRef.current = false;
      return;
    }

    logoutTriggeredRef.current = false;
    validateSessionAge();

    const activityEvents: Array<keyof WindowEventMap> = [
      "mousemove",
      "mousedown",
      "click",
      "keydown",
      "scroll",
      "touchstart",
    ];

    const handleActivity = () => markActivity(false);
    const handleFocus = () => validateSessionAge();
    const handleVisibility = () => {
      if (document.visibilityState === "visible") validateSessionAge();
    };

    activityEvents.forEach((eventName) => window.addEventListener(eventName, handleActivity));
    window.addEventListener("focus", handleFocus);
    window.addEventListener("pageshow", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      activityEvents.forEach((eventName) => window.removeEventListener(eventName, handleActivity));
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("pageshow", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
      clearTimers();
      warnedRef.current = false;
      setWarningOpen(false);
      setSecondsRemaining(60);
    };
  }, [clearTimers, enabled, markActivity, validateSessionAge]);

  if (!enabled || !warningOpen) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/35 backdrop-blur-[1px]">
      <div
        className="w-full max-w-md rounded-2xl bg-white p-5 sm:p-6"
        style={{
          border: "1px solid rgba(10,21,71,0.10)",
          boxShadow: "0 12px 40px rgba(10,21,71,0.16)",
        }}
      >
        <h2 className="text-base sm:text-lg font-black text-[#0A1547] mb-2">Session timeout warning</h2>
        <p className="text-xs sm:text-sm text-[#0A1547]/75 leading-relaxed">
          You will be logged out due to inactivity in{" "}
          <span className="font-bold text-[#0A1547]">{secondsRemaining}</span>{" "}
          second{secondsRemaining === 1 ? "" : "s"}.
        </p>
        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={() => markActivity(true)}
            className="px-4 py-2 rounded-full text-xs sm:text-sm font-bold text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: "#A380F6" }}
          >
            Stay signed in
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Client dashboard guard ─────────────────────────────── */
function DashboardGuard() {
  const { isLoggedIn, clientAuthReady } = useAuth();
  const [location, setLocation] = useLocation();

  useEffect(() => {
    if (clientAuthReady && !isLoggedIn) setLocation("/");
  }, [clientAuthReady, isLoggedIn, setLocation]);

  useEffect(() => {
    if (!clientAuthReady || !isLoggedIn) return;
    if (location !== "/dashboard") return;
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search || "");
    const tab = String(params.get("tab") || "").trim().toLowerCase();
    const target = DASHBOARD_TAB_ROUTE[tab];
    if (!target) return;
    const search = window.location.search || "";
    setLocation(`${target}${search}`);
  }, [clientAuthReady, isLoggedIn, location, setLocation]);

  if (!clientAuthReady) return null;

  if (!isLoggedIn) return null;

  if (location === "/dashboard" && typeof window !== "undefined") {
    const params = new URLSearchParams(window.location.search || "");
    const tab = String(params.get("tab") || "").trim().toLowerCase();
    if (DASHBOARD_TAB_ROUTE[tab]) return null;
  }

  return (
    <>
      <DashboardInactivityController enabled={clientAuthReady && isLoggedIn} />
      <ClientProvider>
        <Switch>
          <Route path="/dashboard"            component={OverviewPage} />
          <Route path="/dashboard/roles"      component={RolesPage} />
          <Route path="/dashboard/candidates" component={CandidatesPage} />
          <Route path="/dashboard/members"    component={MembersPage} />
          <Route path="/dashboard/billing"    component={BillingPage} />
          <Route path="/dashboard/faq"        component={DashboardFaqPage} />
          <Route component={NotFound} />
        </Switch>
      </ClientProvider>
    </>
  );
}

/* ── Admin dashboard guard ──────────────────────────────── */
function AdminGuard() {
  const { isAdminLoggedIn, adminAuthReady } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (adminAuthReady && !isAdminLoggedIn) setLocation("/");
  }, [adminAuthReady, isAdminLoggedIn, setLocation]);

  if (!adminAuthReady) return null;
  if (!isAdminLoggedIn) return null;

  return (
    <>
      <DashboardInactivityController enabled={adminAuthReady && isAdminLoggedIn} />
      <AdminClientProvider>
        <Switch>
          <Route path="/admin"                  component={AdminOverviewPage} />
          <Route path="/admin/clients"          component={AdminClientsPage} />
          <Route path="/admin/roles"            component={AdminRolesPage} />
          <Route path="/admin/candidates"       component={AdminCandidatesPage} />
          <Route path="/admin/role-config"      component={AdminRoleConfigPage} />
          <Route path="/admin/members"          component={AdminMembersPage} />
          <Route path="/admin/accommodations"   component={AdminAccommodationsPage} />
          <Route path="/admin/billing"          component={AdminBillingPage} />
          <Route path="/admin/audit-logs"       component={AdminAuditLogsPage} />
          <Route component={NotFound} />
        </Switch>
      </AdminClientProvider>
    </>
  );
}

function InterviewCompletePage() {
  return (
    <div className="min-h-screen bg-[#F8F9FD] flex items-center justify-center px-4" style={{ fontFamily: "'Raleway', sans-serif" }}>
      <div
        className="bg-white rounded-2xl p-8 w-full max-w-md text-center"
        style={{ border: "1px solid rgba(10,21,71,0.07)", boxShadow: "0 4px 24px rgba(10,21,71,0.08)" }}
      >
        <h1 className="text-xl font-black text-[#0A1547] mb-3">Interview complete</h1>
        <p className="text-sm text-[#0A1547]/65 leading-relaxed">
          Thank you for completing your interview. You may now close this window.
        </p>
      </div>
    </div>
  );
}

function InterviewTokenAlias({ params }: { params?: { role_token?: string } }) {
  const [, setLocation] = useLocation();

  useEffect(() => {
    const roleToken = String(params?.role_token || "").trim();
    if (!roleToken) {
      setLocation("/interview");
      return;
    }
    setLocation(`/interview/${encodeURIComponent(roleToken)}`);
  }, [params?.role_token, setLocation]);

  return null;
}

/* ── Router ─────────────────────────────────────────────── */
function Router() {
  const [location] = useLocation();
  const isDashboard = location === "/dashboard" || location.startsWith("/dashboard/");
  const isAdmin     = location === "/admin"     || location.startsWith("/admin/");
  const isInterview =
    location === "/interview" ||
    location.startsWith("/interview/") ||
    location === "/interview-access" ||
    location.startsWith("/interview-access/") ||
    location.startsWith("/interview-host/") ||
    location.startsWith("/text-interview/") ||
    location.startsWith("/membership-agreement/sign/") ||
    location === "/pwreset" ||
    location === "/accommodation-request" ||
    location.startsWith("/accommodation-request/") ||
    location === "/interview-cvi" ||
    location === "/interview-complete";

  if (isDashboard) return <DashboardGuard />;
  if (isAdmin)     return <AdminGuard />;
  if (isInterview) return (
    <Switch>
      <Route path="/accommodation-request/:role_token" component={AccommodationRequestPage} />
      <Route path="/accommodation-request" component={AccommodationRequestPage} />
      <Route path="/interview-access/:role_token" component={InterviewTokenAlias} />
      <Route path="/interview-host/:role_token" component={InterviewTokenAlias} />
      <Route path="/text-interview/:token" component={TextInterviewPage} />
      <Route path="/membership-agreement/sign/:token" component={MembershipAgreementSignerPage} />
      <Route path="/interview/terms" component={CandidateTermsPage} />
      <Route path="/pwreset" component={PwResetPage} />
      <Route path="/interview-access" component={InterviewPage} />
      <Route path="/interview-cvi" component={InterviewCviPage} />
      <Route path="/interview-complete" component={InterviewCompletePage} />
      <Route path="/interview/live" component={InterviewCviPage} />
      <Route path="/interview/complete" component={InterviewCompletePage} />
      <Route path="/interview/:role_token" component={InterviewPage} />
      <Route path="/interview" component={InterviewPage} />
    </Switch>
  );

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1">
        <Switch>
          <Route path="/"            component={HomePage} />
          <Route path="/alphascreen" component={AlphaScreenPage} />
          <Route path="/about"       component={AboutPage} />
          <Route path="/faq"         component={PublicFaqPage} />
          <Route path="/terms"       component={TermsPage} />
          <Route component={NotFound} />
        </Switch>
      </main>
      <Footer />
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <AuthProvider>
            <Router />
          </AuthProvider>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
