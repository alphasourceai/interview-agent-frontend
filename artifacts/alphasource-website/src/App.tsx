import {
  Component,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ErrorInfo,
  type ReactNode,
} from "react";
import {
  Redirect,
  Switch,
  Route,
  Router as WouterRouter,
  useLocation,
} from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { AppearanceProvider, useAppearance } from "@/context/AppearanceContext";
import { TrackingConsentProvider } from "@/context/TrackingConsentContext";
import { ClientProvider } from "@/context/ClientContext";
import { AdminClientProvider } from "@/context/AdminClientContext";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Seo from "@/components/Seo";
import PageAnalytics from "@/components/PageAnalytics";
import IDPixelLoader from "@/components/IDPixelLoader";
import TrackingConsentNotice from "@/components/TrackingConsentNotice";
import {
  DASHBOARD_ACTIVITY_EVENT,
  DASHBOARD_ACTIVITY_STORAGE_KEY,
  newerDashboardActivity,
  parseDashboardActivity,
} from "@/lib/dashboardActivity";

/* Public pages */
import HomePage from "@/pages/HomePage";
import AlphaScreenPage from "@/pages/AlphaScreenPage";
import AlphaScreenPricingPage from "@/pages/AlphaScreenPricingPage";
import {
  AlphaScreenCandidateExperiencePage,
  AlphaScreenDentalGroupsPage,
  AlphaScreenHowItWorksPage,
  AlphaScreenRoiPage,
  AlphaScreenSecurityPage,
} from "@/pages/AlphaScreenRetailPages";
import CheckoutSubscriptionSuccessPage from "@/pages/CheckoutSubscriptionSuccessPage";
import PasswordSetupPreviewPage from "@/pages/PasswordSetupPreviewPage";
import AboutPage from "@/pages/AboutPage";
import FaqPage from "@/pages/FaqPage";
import PublicSupportPage from "@/pages/SupportPage";
import TermsPage from "@/pages/TermsPage";
import PrivacyPage from "@/pages/PrivacyPage";
import CandidateTermsPage from "@/pages/CandidateTermsPage";
import SmsConsentEvidencePage from "@/pages/SmsConsentEvidencePage";
import InterviewPage from "@/pages/InterviewPage";
import InterviewCviPage from "@/pages/InterviewCviPage";
import AccommodationRequestPage from "@/pages/AccommodationRequestPage";
import TextInterviewPage from "@/pages/TextInterviewPage";
import PwResetPage from "@/pages/PwResetPage";
import MembershipAgreementSignerPage from "@/pages/MembershipAgreementSignerPage";
import AutomationApprovalPage from "@/pages/AutomationApprovalPage";
import AutomationDigestApprovalPage from "@/pages/AutomationDigestApprovalPage";

/* Client dashboard */
import OverviewPage from "@/pages/dashboard/OverviewPage";
import RolesPage from "@/pages/dashboard/RolesPage";
import AutomationPage from "@/pages/dashboard/AutomationPage";
import CandidatesPage from "@/pages/dashboard/CandidatesPage";
import MembersPage from "@/pages/dashboard/MembersPage";
import BillingPage from "@/pages/dashboard/BillingPage";
import EntitiesPage from "@/pages/dashboard/EntitiesPage";
import DashboardFaqPage from "@/pages/dashboard/FaqPage";
import ProfileSettingsPage from "@/pages/dashboard/ProfileSettingsPage";

/* Admin dashboard */
import AdminOverviewPage from "@/pages/admin/AdminOverviewPage";
import AdminClientsPage from "@/pages/admin/AdminClientsPage";
import AdminMetricsPage from "@/pages/admin/AdminMetricsPage";
import AdminInterviewReliabilityPage from "@/pages/admin/AdminInterviewReliabilityPage";
import AdminSmsMonitoringPage from "@/pages/admin/AdminSmsMonitoringPage";
import AdminPublicAnalyticsPage from "@/pages/admin/AdminPublicAnalyticsPage";
import AdminPublicPurchasesPage from "@/pages/admin/AdminPublicPurchasesPage";
import AdminPublicPurchasePlaybookPage from "@/pages/admin/AdminPublicPurchasePlaybookPage";
import AdminRolesPage from "@/pages/admin/AdminRolesPage";
import AdminCandidatesPage from "@/pages/admin/AdminCandidatesPage";
import AdminAutomationPage from "@/pages/admin/AdminAutomationPage";
import AdminMembersPage from "@/pages/admin/AdminMembersPage";
import AdminAccommodationsPage from "@/pages/admin/AdminAccommodationsPage";
import AdminBillingPage from "@/pages/admin/AdminBillingPage";
import AdminAuditLogsPage from "@/pages/admin/AdminAuditLogsPage";

import NotFound from "@/pages/not-found";

const queryClient = new QueryClient();
const PUBLIC_CHECKOUT_FALLBACK_MESSAGE = "We could not load this step. Please refresh or contact support.";
const DASHBOARD_TAB_ROUTE: Record<string, string> = {
  roles: "/dashboard/roles",
  automation: "/dashboard/automation",
  candidates: "/dashboard/candidates",
  members: "/dashboard/members",
  billing: "/dashboard/billing",
};

function sanitizePublicCheckoutRoute(path: string): string {
  const rawPath = String(path || "").split("?")[0] || "/";
  if (rawPath.startsWith("/membership-agreement/sign/")) return "/membership-agreement/sign/[token]";
  if (rawPath.startsWith("/checkout/subscription-success")) return "/checkout/subscription-success";
  if (rawPath.startsWith("/alphascreen/pricing")) return "/alphascreen/pricing";
  return rawPath;
}

class PublicCheckoutErrorBoundary extends Component<
  { children: ReactNode; resetKey: string },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidUpdate(prevProps: { resetKey: string }) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false });
    }
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    const route = sanitizePublicCheckoutRoute(typeof window !== "undefined" ? window.location.pathname : this.props.resetKey);
    console.error("[public-checkout] render_failed", {
      route,
      error_name: error instanceof Error ? error.name : "unknown",
      component_stack_present: Boolean(info.componentStack),
    });
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <section className="min-h-[calc(100vh-160px)] bg-[#F8F9FD] px-6 py-16 lg:py-20">
        <div className="mx-auto max-w-xl rounded-lg border border-[#0A1547]/10 bg-white p-6 shadow-sm sm:p-8">
          <p className="text-sm font-black uppercase tracking-[0.18em] text-[#A380F6]">alphaScreen</p>
          <h1 className="mt-3 text-2xl font-black leading-tight text-[#0A1547]">This step could not load.</h1>
          <p className="mt-3 text-sm font-semibold leading-relaxed text-[#0A1547]/60">
            {PUBLIC_CHECKOUT_FALLBACK_MESSAGE}
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex items-center justify-center rounded-full bg-[#0A1547] px-5 py-2.5 text-sm font-black text-white transition-opacity hover:opacity-90"
            >
              Refresh
            </button>
            <a
              href="/alphascreen/pricing#pricing-demo"
              className="inline-flex items-center justify-center rounded-full border border-[#0A1547]/12 bg-white px-5 py-2.5 text-sm font-black text-[#0A1547] transition-colors hover:border-[#A380F6] hover:text-[#A380F6]"
            >
              Back to pricing
            </a>
            <a
              href="/support/"
              className="inline-flex items-center justify-center rounded-full border border-[#0A1547]/12 bg-white px-5 py-2.5 text-sm font-black text-[#0A1547] transition-colors hover:border-[#A380F6] hover:text-[#A380F6]"
            >
              Contact support
            </a>
          </div>
        </div>
      </section>
    );
  }
}

function PublicCheckoutBoundaryRoute({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return (
    <PublicCheckoutErrorBoundary resetKey={sanitizePublicCheckoutRoute(location)}>
      {children}
    </PublicCheckoutErrorBoundary>
  );
}

function AlphaScreenPricingRoute() {
  return (
    <PublicCheckoutBoundaryRoute>
      <AlphaScreenPricingPage />
    </PublicCheckoutBoundaryRoute>
  );
}

function CheckoutSubscriptionSuccessRoute() {
  return (
    <PublicCheckoutBoundaryRoute>
      <CheckoutSubscriptionSuccessPage />
    </PublicCheckoutBoundaryRoute>
  );
}

function MembershipAgreementSignerRoute({ params }: { params?: { token?: string } }) {
  return (
    <PublicCheckoutBoundaryRoute>
      <MembershipAgreementSignerPage params={params} />
    </PublicCheckoutBoundaryRoute>
  );
}

function PublicSiteShell({ children }: { children: ReactNode }) {
  const { resolvedMode } = useAppearance();
  const [location] = useLocation();
  const isHomePage = location === "/";

  return (
    <div
      className={`public-site-shell min-h-screen ${isHomePage ? "public-site-home" : "public-site-rest"} ${resolvedMode === "dark" ? "dark" : ""}`}
      data-theme={resolvedMode}
    >
      {children}
    </div>
  );
}
const DASHBOARD_INACTIVITY_LIMIT_MS = 60 * 60 * 1000;
const DASHBOARD_WARNING_WINDOW_MS = 60 * 1000;

function readStoredDashboardActivity(): number {
  if (typeof window === "undefined") return 0;
  try {
    return parseDashboardActivity(window.localStorage.getItem(DASHBOARD_ACTIVITY_STORAGE_KEY));
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
    const handleStoredActivity = (event: StorageEvent) => {
      if (event.key !== DASHBOARD_ACTIVITY_STORAGE_KEY || logoutTriggeredRef.current) return;
      const activityAt = newerDashboardActivity(lastActivityRef.current, event.newValue);
      if (activityAt === null) return;
      lastActivityRef.current = activityAt;
      warnedRef.current = false;
      setWarningOpen(false);
      setSecondsRemaining(60);
      scheduleFrom(activityAt);
    };
    const handleSupportVoiceActivity = () => markActivity(false);
    const handleFocus = () => validateSessionAge();
    const handleVisibility = () => {
      if (document.visibilityState === "visible") validateSessionAge();
    };

    activityEvents.forEach((eventName) => window.addEventListener(eventName, handleActivity));
    window.addEventListener("storage", handleStoredActivity);
    window.addEventListener(DASHBOARD_ACTIVITY_EVENT, handleSupportVoiceActivity);
    window.addEventListener("focus", handleFocus);
    window.addEventListener("pageshow", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      activityEvents.forEach((eventName) => window.removeEventListener(eventName, handleActivity));
      window.removeEventListener("storage", handleStoredActivity);
      window.removeEventListener(DASHBOARD_ACTIVITY_EVENT, handleSupportVoiceActivity);
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("pageshow", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
      clearTimers();
      warnedRef.current = false;
      setWarningOpen(false);
      setSecondsRemaining(60);
    };
  }, [clearTimers, enabled, markActivity, scheduleFrom, validateSessionAge]);

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
    <AppearanceProvider>
      <DashboardInactivityController enabled={clientAuthReady && isLoggedIn} />
      <ClientProvider>
        <Switch>
          <Route path="/dashboard"            component={OverviewPage} />
          <Route path="/dashboard/roles"      component={RolesPage} />
          <Route path="/dashboard/automation" component={AutomationPage} />
          <Route path="/dashboard/candidates" component={CandidatesPage} />
          <Route path="/dashboard/members"    component={MembersPage} />
          <Route path="/dashboard/billing"    component={BillingPage} />
          <Route path="/dashboard/entities"   component={EntitiesPage} />
          <Route path="/dashboard/profile"    component={ProfileSettingsPage} />
          <Route path="/dashboard/support"    component={DashboardFaqPage} />
          <Route path="/dashboard/faq"        component={DashboardFaqPage} />
          <Route component={NotFound} />
        </Switch>
      </ClientProvider>
    </AppearanceProvider>
  );
}

/* ── Admin dashboard guard ──────────────────────────────── */
function AdminGuard() {
  const { isAdminLoggedIn, adminAuthReady, resolveAdminAccess } = useAuth();
  const [, setLocation] = useLocation();
  const [checkingAdminAccess, setCheckingAdminAccess] = useState(true);

  useEffect(() => {
    if (adminAuthReady && isAdminLoggedIn) {
      setCheckingAdminAccess(false);
      return;
    }

    let active = true;
    setCheckingAdminAccess(true);
    void resolveAdminAccess().finally(() => {
      if (active) setCheckingAdminAccess(false);
    });
    return () => {
      active = false;
    };
  }, [adminAuthReady, isAdminLoggedIn, resolveAdminAccess]);

  useEffect(() => {
    if (!checkingAdminAccess && adminAuthReady && !isAdminLoggedIn) setLocation("/");
  }, [adminAuthReady, checkingAdminAccess, isAdminLoggedIn, setLocation]);

  if (checkingAdminAccess || !adminAuthReady) return null;
  if (!isAdminLoggedIn) return null;

  return (
    <AppearanceProvider>
      <DashboardInactivityController enabled={adminAuthReady && isAdminLoggedIn} />
      <AdminClientProvider>
        <Switch>
          <Route path="/admin"                  component={AdminOverviewPage} />
          <Route path="/admin/metrics"          component={AdminMetricsPage} />
          <Route path="/admin/interview-reliability" component={AdminInterviewReliabilityPage} />
          <Route path="/admin/sms-monitoring" component={AdminSmsMonitoringPage} />
          <Route path="/admin/public-analytics" component={AdminPublicAnalyticsPage} />
          <Route path="/admin/public-purchases/playbook" component={AdminPublicPurchasePlaybookPage} />
          <Route path="/admin/public-purchases" component={AdminPublicPurchasesPage} />
          <Route path="/admin/clients"          component={AdminClientsPage} />
          <Route path="/admin/roles"            component={AdminRolesPage} />
          <Route path="/admin/candidates"       component={AdminCandidatesPage} />
          <Route path="/admin/role-config"      component={AdminRoleConfigRedirect} />
          <Route path="/admin/automation"       component={AdminAutomationPage} />
          <Route path="/admin/members"          component={AdminMembersPage} />
          <Route path="/admin/accommodations"   component={AdminAccommodationsPage} />
          <Route path="/admin/billing"          component={AdminBillingPage} />
          <Route path="/admin/audit-logs"       component={AdminAuditLogsPage} />
          <Route component={NotFound} />
        </Switch>
      </AdminClientProvider>
    </AppearanceProvider>
  );
}

function AdminRoleConfigRedirect() {
  return <Redirect to="/admin/roles" replace />;
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

/* ── Router ─────────────────────────────────────────────── */
function Router() {
  const [location] = useLocation();
  const isDashboard = location === "/dashboard" || location.startsWith("/dashboard/");
  const isAdmin     = location === "/admin"     || location.startsWith("/admin/");
  const isAutomationDigestApproval = location === "/automation/digest-approval" || location.startsWith("/automation/digest-approval/");
  const isAutomationApproval = location === "/automation/approval" || location.startsWith("/automation/approval/");
  const isInterview =
    location === "/interview" ||
    location.startsWith("/interview/") ||
    location === "/interview-access" ||
    location.startsWith("/interview-access/") ||
    location === "/interview-host" ||
    location.startsWith("/interview-host/") ||
    location === "/text-interview" ||
    location.startsWith("/text-interview/") ||
    location === "/membership-agreement/sign" ||
    location.startsWith("/membership-agreement/sign/") ||
    location === "/pwreset" ||
    location === "/pwreset/" ||
    location === "/accommodation" ||
    location.startsWith("/accommodation/") ||
    location === "/accommodation-request" ||
    location.startsWith("/accommodation-request/") ||
    location === "/interview-cvi" ||
    location === "/interview-complete";

  let content: ReactNode;

  if (isDashboard) {
    content = <DashboardGuard />;
  } else if (isAdmin) {
    content = <AdminGuard />;
  } else if (isAutomationDigestApproval) {
    content = (
      <Switch>
        <Route path="/automation/digest-approval/:token" component={AutomationDigestApprovalPage} />
        <Route path="/automation/digest-approval" component={AutomationDigestApprovalPage} />
        <Route component={NotFound} />
      </Switch>
    );
  } else if (isAutomationApproval) {
    content = (
      <Switch>
        <Route path="/automation/approval/:token" component={AutomationApprovalPage} />
        <Route path="/automation/approval" component={AutomationApprovalPage} />
        <Route component={NotFound} />
      </Switch>
    );
  } else if (isInterview) {
    content = (
      <Switch>
        <Route path="/accommodation/:role_token" component={AccommodationRequestPage} />
        <Route path="/accommodation" component={AccommodationRequestPage} />
        <Route path="/accommodation-request/:role_token" component={AccommodationRequestPage} />
        <Route path="/accommodation-request" component={AccommodationRequestPage} />
        <Route path="/interview-access/:role_token" component={InterviewPage} />
        <Route path="/interview-host/:role_token" component={InterviewPage} />
        <Route path="/interview-host" component={InterviewPage} />
        <Route path="/text-interview/:token" component={TextInterviewPage} />
        <Route path="/text-interview" component={TextInterviewPage} />
        <Route path="/membership-agreement/sign/:token" component={MembershipAgreementSignerRoute} />
        <Route path="/membership-agreement/sign" component={MembershipAgreementSignerRoute} />
        <Route path="/interview/sms-consent-evidence" component={SmsConsentEvidencePage} />
        <Route path="/interview/terms" component={CandidateTermsPage} />
        <Route path="/pwreset" component={PwResetPage} />
        <Route path="/pwreset/" component={PwResetPage} />
        <Route path="/interview-access" component={InterviewPage} />
        <Route path="/interview-cvi" component={InterviewCviPage} />
        <Route path="/interview-complete" component={InterviewCompletePage} />
        <Route path="/interview/live" component={InterviewCviPage} />
        <Route path="/interview/complete" component={InterviewCompletePage} />
        <Route path="/interview/:role_token" component={InterviewPage} />
        <Route path="/interview" component={InterviewPage} />
      </Switch>
    );
  } else {
    content = (
      <AppearanceProvider>
        <PublicSiteShell>
          <div className="min-h-screen flex flex-col bg-white text-[#0A1547] transition-colors duration-300 dark:bg-[#080E2E] dark:text-white">
            <Navbar />
            <main className="flex-1">
              <Switch>
          <Route path="/checkout/password-setup-preview/" component={PasswordSetupPreviewPage} />
          <Route path="/checkout/password-setup-preview" component={PasswordSetupPreviewPage} />
          <Route path="/checkout/subscription-success/" component={CheckoutSubscriptionSuccessRoute} />
          <Route path="/checkout/subscription-success" component={CheckoutSubscriptionSuccessRoute} />
          <Route path="/"            component={HomePage} />
          <Route path="/alphascreen/pricing/" component={AlphaScreenPricingRoute} />
          <Route path="/alphascreen/pricing" component={AlphaScreenPricingRoute} />
          <Route path="/alphascreen/how-it-works/" component={AlphaScreenHowItWorksPage} />
          <Route path="/alphascreen/how-it-works" component={AlphaScreenHowItWorksPage} />
          <Route path="/alphascreen/security/" component={AlphaScreenSecurityPage} />
          <Route path="/alphascreen/security" component={AlphaScreenSecurityPage} />
          <Route path="/alphascreen/candidate-experience/" component={AlphaScreenCandidateExperiencePage} />
          <Route path="/alphascreen/candidate-experience" component={AlphaScreenCandidateExperiencePage} />
          <Route path="/alphascreen/for-dental-groups/" component={AlphaScreenDentalGroupsPage} />
          <Route path="/alphascreen/for-dental-groups" component={AlphaScreenDentalGroupsPage} />
          <Route path="/alphascreen/roi/" component={AlphaScreenRoiPage} />
          <Route path="/alphascreen/roi" component={AlphaScreenRoiPage} />
          <Route path="/alphascreen/" component={AlphaScreenPage} />
          <Route path="/alphascreen" component={AlphaScreenPage} />
          <Route path="/about/"      component={AboutPage} />
          <Route path="/about"       component={AboutPage} />
          <Route path="/support/"    component={PublicSupportPage} />
          <Route path="/support"     component={PublicSupportPage} />
          <Route path="/faq/"        component={FaqPage} />
          <Route path="/faq"         component={FaqPage} />
          <Route path="/privacy-policy/" component={PrivacyPage} />
          <Route path="/privacy-policy" component={PrivacyPage} />
          <Route path="/privacy/"    component={PrivacyPage} />
          <Route path="/privacy"     component={PrivacyPage} />
          <Route path="/terms-and-conditions/" component={TermsPage} />
          <Route path="/terms-and-conditions" component={TermsPage} />
          <Route path="/terms/"      component={TermsPage} />
          <Route path="/terms"       component={TermsPage} />
          <Route component={NotFound} />
              </Switch>
            </main>
            <Footer />
            <TrackingConsentNotice visible />
          </div>
        </PublicSiteShell>
      </AppearanceProvider>
    );
  }

  return (
    <>
      <Seo location={location} />
      <PageAnalytics location={location} />
      <IDPixelLoader location={location} />
      {content}
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <TrackingConsentProvider>
            <AuthProvider>
              <Router />
            </AuthProvider>
          </TrackingConsentProvider>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
