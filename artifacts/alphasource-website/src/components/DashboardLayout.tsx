import { useState, useRef, useEffect, useCallback, ReactNode } from "react";
import { createPortal } from "react-dom";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  Briefcase,
  Users,
  UserCheck,
  CreditCard,
  HelpCircle,
  LogOut,
  Menu,
  X,
  ChevronsLeft,
  ChevronsRight,
  ChevronDown,
  Check,
  ChevronRight,
  ChevronLeft,
  Map,
  CheckCircle2,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useClient } from "@/context/ClientContext";

/* ── Nav items ───────────────────────────────────────────────── */
interface NavItem {
  label: string;
  href:  string;
  icon:  React.ElementType;
}

const navItems: NavItem[] = [
  { label: "Overview",   href: "/dashboard",           icon: LayoutDashboard },
  { label: "Roles",      href: "/dashboard/roles",      icon: Briefcase       },
  { label: "Candidates", href: "/dashboard/candidates", icon: Users           },
  { label: "Members",    href: "/dashboard/members",    icon: UserCheck       },
  { label: "Billing",    href: "/dashboard/billing",    icon: CreditCard      },
  { label: "FAQ",        href: "/dashboard/faq",        icon: HelpCircle      },
];

/* ── Tour steps ──────────────────────────────────────────────── */
interface TourStep {
  navIndex: number;
  title:    string;
  emoji:    string;
  desc:     string;
  bullets:  string[];
}

const TOUR_STEPS: TourStep[] = [
  {
    navIndex: 0, title: "Overview", emoji: "📊",
    desc: "Your command center — see active roles, recent candidate submissions, score distributions, and top performers at a glance.",
    bullets: ["Hiring pipeline summary", "Recent candidate activity", "Score distribution charts"],
  },
  {
    navIndex: 1, title: "Roles", emoji: "💼",
    desc: "Create and manage open positions. Each role links to its AlphaScreen interview session and tracks every candidate assigned to it.",
    bullets: ["Create & publish new roles", "Track open vs. closed roles", "View candidates per role"],
  },
  {
    navIndex: 2, title: "Candidates", emoji: "👥",
    desc: "Review every applicant. Expand any row to see AI-scored resume and interview analyses, behavioral signals, and risk flags.",
    bullets: ["Resume & interview AI analysis", "Dynamic score coloring", "Sort, filter, and export results"],
  },
  {
    navIndex: 3, title: "Members", emoji: "🛡️",
    desc: "Control who can access your AlphaSource dashboard. Invite teammates, assign roles, and remove users when needed.",
    bullets: ["Invite team members by email", "Assign Admin or Viewer roles", "Remove or reset access"],
  },
  {
    navIndex: 4, title: "Billing", emoji: "💳",
    desc: "Manage your subscription plan, review past invoices, and update payment details — all in one place.",
    bullets: ["View your current plan", "Full invoice history", "Update payment methods"],
  },
];

/* ── Spotlight + callout tour overlay ───────────────────────── */
interface SpotRect { top: number; left: number; width: number; height: number }

function TourSpotlight({
  spotRect,
  step,
  stepIndex,
  total,
  sidebarRight,
  onPrev,
  onNext,
  onFinish,
  onClose,
}: {
  spotRect:     SpotRect;
  step:         TourStep;
  stepIndex:    number;
  total:        number;
  sidebarRight: number;
  onPrev:    () => void;
  onNext:    () => void;
  onFinish:  () => void;
  onClose:   () => void;
}) {
  const isFirst = stepIndex === 0;
  const isLast  = stepIndex === total - 1;

  /* Vertical position of callout: center on the nav item, clamped to viewport */
  const CALLOUT_HEIGHT = 260;
  const rawTop  = spotRect.top + spotRect.height / 2 - CALLOUT_HEIGHT / 2;
  const calloutTop = Math.min(
    Math.max(rawTop, 12),
    (typeof window !== "undefined" ? window.innerHeight : 800) - CALLOUT_HEIGHT - 12
  );
  const calloutLeft = sidebarRight + 20;

  /* Arrow vertical: keep it pointing at the nav item center */
  const arrowTop = Math.max(
    20,
    Math.min(
      CALLOUT_HEIGHT - 28,
      spotRect.top + spotRect.height / 2 - calloutTop - 8
    )
  );
  const portalTarget = typeof document !== "undefined" ? document.body : null;

  if (!portalTarget) return null;

  return createPortal(
    <>
      {/* ── Full-screen backdrop — click to close ── */}
      <div
        className="fixed inset-0 z-[60]"
        style={{ backgroundColor: "rgba(10,21,71,0.0)" }}
        onClick={onClose}
      />

      {/* ── Spotlight ring around nav item ── */}
      <div
        className="fixed z-[61] pointer-events-none"
        style={{
          top:          spotRect.top    - 4,
          left:         spotRect.left   - 6,
          width:        spotRect.width  + 12,
          height:       spotRect.height + 8,
          borderRadius: "14px",
          /* Box-shadow creates the full-screen dim + lilac ring */
          boxShadow:    "0 0 0 9999px rgba(10,21,71,0.52), 0 0 0 2.5px #A380F6, 0 0 18px 4px rgba(163,128,246,0.35)",
          transition:   "top 0.25s ease, left 0.25s ease, width 0.25s ease, height 0.25s ease",
        }}
      />

      {/* ── Callout card ── */}
      <div
        className="fixed z-[62] w-[308px]"
        style={{
          top:          calloutTop,
          left:         calloutLeft,
          borderRadius: "18px",
          backgroundColor: "white",
          boxShadow:    "0 16px 48px rgba(10,21,71,0.18), 0 0 0 1px rgba(163,128,246,0.18)",
          transition:   "top 0.25s ease",
        }}
      >
        {/* Left-pointing arrow (triangle) */}
        <div
          className="absolute pointer-events-none"
          style={{
            left:         "-9px",
            top:          arrowTop,
            width:        0,
            height:       0,
            borderTop:    "9px solid transparent",
            borderBottom: "9px solid transparent",
            borderRight:  "9px solid white",
            filter:       "drop-shadow(-2px 0 2px rgba(10,21,71,0.08))",
            transition:   "top 0.25s ease",
          }}
        />

        {/* ── Card header ── */}
        <div
          className="px-5 pt-5 pb-4"
          style={{ borderBottom: "1px solid rgba(10,21,71,0.06)" }}
        >
          {/* Step dots + count */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-1.5">
              {TOUR_STEPS.map((_, i) => (
                <span
                  key={i}
                  className="rounded-full transition-all duration-300"
                  style={{
                    width:           i === stepIndex ? "20px" : "6px",
                    height:          "6px",
                    backgroundColor: i === stepIndex
                      ? "#A380F6"
                      : i < stepIndex
                      ? "#02D99D"
                      : "rgba(10,21,71,0.12)",
                  }}
                />
              ))}
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-[#0A1547]/25 hover:text-[#0A1547]/50 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Title row */}
          <div className="flex items-center gap-2.5">
            <span className="text-xl leading-none">{step.emoji}</span>
            <div>
              <p className="text-sm font-black text-[#0A1547]">{step.title}</p>
              <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: "#A380F6" }}>
                Step {stepIndex + 1} of {total}
              </p>
            </div>
          </div>
        </div>

        {/* ── Card body ── */}
        <div className="px-5 py-4">
          <p className="text-xs text-[#0A1547]/60 leading-relaxed mb-3">{step.desc}</p>
          <ul className="space-y-1.5">
            {step.bullets.map((b) => (
              <li key={b} className="flex items-start gap-2">
                <CheckCircle2
                  className="w-3 h-3 flex-shrink-0 mt-0.5"
                  style={{ color: "#A380F6" }}
                />
                <span className="text-[11px] font-semibold text-[#0A1547]/55">{b}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* ── Card footer ── */}
        <div
          className="px-5 py-3 flex items-center justify-between"
          style={{ borderTop: "1px solid rgba(10,21,71,0.06)" }}
        >
          <button
            onClick={onPrev}
            disabled={isFirst}
            className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold transition-all"
            style={{
              backgroundColor: isFirst ? "transparent" : "rgba(10,21,71,0.06)",
              color: isFirst ? "rgba(10,21,71,0.2)" : "#0A1547",
              cursor: isFirst ? "not-allowed" : "pointer",
            }}
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            Back
          </button>

          {isLast ? (
            <button
              onClick={onFinish}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold text-white transition-opacity hover:opacity-90"
              style={{ backgroundColor: "#02D99D" }}
            >
              <Check className="w-3.5 h-3.5" />
              Finish tour
            </button>
          ) : (
            <button
              onClick={onNext}
              className="flex items-center gap-1 px-4 py-1.5 rounded-full text-xs font-bold text-white transition-opacity hover:opacity-90"
              style={{ backgroundColor: "#A380F6" }}
            >
              Next
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </>,
    portalTarget
  );
}

/* ── Main layout ─────────────────────────────────────────────── */
interface DashboardLayoutProps {
  children: ReactNode;
  title:    string;
}

export default function DashboardLayout({ children, title }: DashboardLayoutProps) {
  const [mobileOpen,         setMobileOpen]         = useState(false);
  const [collapsed,          setCollapsed]           = useState(false);
  const [clientDropdownOpen, setClientDropdownOpen]  = useState(false);
  const [tourActive,         setTourActive]          = useState(false);
  const [tourStep,           setTourStep]            = useState(0);
  const [spotRect,           setSpotRect]            = useState<SpotRect | null>(null);

  const [location, setLocation] = useLocation();
  const { logout }              = useAuth();
  const { selectedClient, setSelectedClient, clients, loading: clientsLoading, error: clientsError } = useClient();
  const dropdownRef  = useRef<HTMLDivElement>(null);
  const activeTourStep = TOUR_STEPS[tourStep] || null;

  /* One ref per nav item */
  const navRefs = useRef<(HTMLAnchorElement | null)[]>([]);

  /* Measure the current tour nav item */
  const measureStep = useCallback((step: number) => {
    const stepConfig = TOUR_STEPS[step];
    if (!stepConfig) return;
    const el = navRefs.current[stepConfig.navIndex];
    if (el) {
      const r = el.getBoundingClientRect();
      setSpotRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    }
  }, []);

  /* Remeasure on step change or resize */
  useEffect(() => {
    if (!tourActive) return;
    measureStep(tourStep);
    const onResize = () => measureStep(tourStep);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [tourActive, tourStep, measureStep, collapsed]);

  /* Client dropdown outside-click */
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setClientDropdownOpen(false);
      }
    };
    if (clientDropdownOpen) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [clientDropdownOpen]);

  /* Close tour on Escape */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") endTour(); };
    if (tourActive) document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [tourActive]);

  /* Tour controls */
  const startTour = () => {
    if (collapsed) setCollapsed(false);
    setTourStep(0);
    setTourActive(true);
    /* Measure after a frame so the sidebar has expanded */
    requestAnimationFrame(() => measureStep(0));
  };
  const nextStep  = () => setTourStep((s) => Math.min(s + 1, TOUR_STEPS.length - 1));
  const prevStep  = () => setTourStep((s) => Math.max(s - 1, 0));
  const endTour   = () => { setTourActive(false); setSpotRect(null); };

  const handleSignOut = () => { logout(); setLocation("/"); };
  const isActive = (href: string) =>
    href === "/dashboard" ? location === "/dashboard" : location.startsWith(href);

  const sidebarW  = collapsed ? "w-16" : "w-60";
  const contentML = collapsed ? "lg:ml-16" : "lg:ml-60";
  const sidebarRight = collapsed ? 64 : 240;

  return (
    <div className="min-h-screen bg-[#F8F9FD] flex" style={{ fontFamily: "'Raleway', sans-serif" }}>

      {/* ── Sidebar ──────────────────────────────────────────── */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 bg-white border-r border-gray-100 flex flex-col
          transition-all duration-300 ease-in-out ${sidebarW}
          ${mobileOpen ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0`}
        style={{ overflow: "visible" }}
      >
        {/* Logo / Collapse toggle */}
        <div className={`flex items-center border-b border-gray-100 flex-shrink-0 h-14
          ${collapsed ? "justify-center px-0" : "justify-between px-4"}`}>
          {collapsed ? (
            <button
              className="hidden lg:flex flex-col items-center gap-0.5 py-1.5 px-2 rounded-xl
                         text-[#0A1547]/30 hover:text-[#A380F6] transition-colors group"
              onClick={() => setCollapsed(false)}
              title="Expand sidebar"
            >
              <img src="/alpha-symbol.png" alt="αS" className="w-8 h-8 object-contain" />
              <ChevronsRight className="w-3.5 h-3.5 text-[#A380F6]/50 group-hover:text-[#A380F6] transition-colors" />
            </button>
          ) : (
            <>
              <Link href="/" onClick={() => setMobileOpen(false)}>
                <img src="/logo-dark-text.png" alt="alphaSource AI" className="h-8 w-auto" />
              </Link>
              <div className="flex items-center gap-1">
                <button
                  className="hidden lg:flex p-1.5 rounded-lg text-[#0A1547]/25 hover:text-[#0A1547]/60 transition-colors"
                  onClick={() => { setCollapsed(true); setClientDropdownOpen(false); }}
                  title="Collapse sidebar"
                >
                  <ChevronsLeft className="w-4 h-4" />
                </button>
                <button
                  className="lg:hidden p-1.5 rounded-lg text-[#0A1547]/40 hover:text-[#0A1547]"
                  onClick={() => setMobileOpen(false)}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </>
          )}
        </div>

        {/* Client selector */}
        <div
          className={`flex-shrink-0 border-b border-gray-100 relative ${collapsed ? "py-3 flex justify-center" : "px-3 py-3"}`}
          ref={dropdownRef}
        >
          {collapsed ? (
            <button
              onClick={() => setCollapsed(false)}
              title={selectedClient.name}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-black text-white flex-shrink-0 transition-transform hover:scale-105"
              style={{ backgroundColor: selectedClient.color }}
            >
              {selectedClient.letter}
            </button>
          ) : (
            <button
              onClick={() => setClientDropdownOpen((o) => !o)}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all"
              style={{ backgroundColor: clientDropdownOpen ? "rgba(163,128,246,0.1)" : "rgba(163,128,246,0.07)" }}
            >
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-black text-white"
                style={{ backgroundColor: selectedClient.color }}
              >
                {selectedClient.letter}
              </div>
              <div className="min-w-0 flex-1 text-left">
                <p className="text-xs font-black text-[#0A1547] truncate leading-tight">{selectedClient.name}</p>
                <p className="text-[10px] text-[#0A1547]/40">Client account</p>
              </div>
              <ChevronDown
                className={`w-3.5 h-3.5 text-[#0A1547]/30 flex-shrink-0 transition-transform duration-200 ${clientDropdownOpen ? "rotate-180" : ""}`}
              />
            </button>
          )}

          {clientDropdownOpen && !collapsed && (
            <div
              className="absolute left-3 right-3 z-50 bg-white rounded-xl shadow-lg border border-gray-100 py-1 mt-1"
              style={{ top: "100%" }}
            >
              {clientsLoading && (
                <div className="px-3 py-2 text-xs font-semibold text-[#0A1547]/45">Loading clients...</div>
              )}
              {!clientsLoading && clients.length === 0 && (
                <div className="px-3 py-2 text-xs font-semibold text-[#0A1547]/45">
                  {clientsError ? "Could not load clients." : "No client access."}
                </div>
              )}
              {!clientsLoading && clients.map((client) => (
                <button
                  key={client.id}
                  onClick={() => { setSelectedClient(client); setClientDropdownOpen(false); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-gray-50 transition-colors text-left"
                >
                  <div
                    className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 text-[10px] font-black text-white"
                    style={{ backgroundColor: client.color }}
                  >
                    {client.letter}
                  </div>
                  <span className="flex-1 text-xs font-semibold text-[#0A1547] truncate">{client.name}</span>
                  {selectedClient.id === client.id && (
                    <Check className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "#A380F6" }} />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Nav links */}
        <nav className={`flex-1 py-3 space-y-0.5 overflow-y-auto overflow-x-hidden
          ${collapsed ? "px-0 flex flex-col items-center" : "px-3"}`}>
          {navItems.map((item, idx) => {
            const active = isActive(item.href);

            if (collapsed) {
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  ref={(el) => { navRefs.current[idx] = el as HTMLAnchorElement | null; }}
                  onClick={() => setMobileOpen(false)}
                  title={item.label}
                  className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all duration-150 ${
                    active ? "text-[#A380F6]" : "text-[#0A1547]/40 hover:text-[#0A1547] hover:bg-gray-50"
                  }`}
                  style={active ? { backgroundColor: "rgba(163,128,246,0.1)" } : {}}
                >
                  <item.icon className="w-[18px] h-[18px]" />
                </Link>
              );
            }

            return (
              <Link
                key={item.href}
                href={item.href}
                ref={(el) => { navRefs.current[idx] = el as HTMLAnchorElement | null; }}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-150 ${
                  active ? "text-[#A380F6]" : "text-[#0A1547]/50 hover:text-[#0A1547] hover:bg-gray-50"
                }`}
                style={active ? { backgroundColor: "rgba(163,128,246,0.1)" } : {}}
              >
                <item.icon className="w-4 h-4 flex-shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Sign out */}
        <div className={`border-t border-gray-100 flex-shrink-0 ${collapsed ? "py-3 flex justify-center" : "px-3 py-3"}`}>
          {collapsed ? (
            <button
              onClick={handleSignOut}
              title="Sign Out"
              className="w-10 h-10 flex items-center justify-center rounded-xl text-[#0A1547]/35 hover:text-red-500 hover:bg-red-50 transition-all duration-150"
            >
              <LogOut className="w-[18px] h-[18px]" />
            </button>
          ) : (
            <button
              onClick={handleSignOut}
              className="flex items-center gap-3 px-3 py-2.5 w-full rounded-xl text-sm font-semibold text-[#0A1547]/40 hover:text-[#0A1547] hover:bg-gray-50 transition-all duration-150"
            >
              <LogOut className="w-4 h-4 flex-shrink-0" />
              Sign Out
            </button>
          )}
        </div>
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/20 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ── Main content ─────────────────────────────────────── */}
      <div className={`flex-1 min-h-screen flex flex-col transition-all duration-300 ${contentML}`}>
        {/* Top bar */}
        <header className="sticky top-0 z-20 bg-white border-b border-gray-100 flex items-center h-14 px-5">
          <button
            className="lg:hidden mr-3 p-1.5 rounded-lg text-[#0A1547]/50 hover:text-[#0A1547] hover:bg-gray-50 transition-colors"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <span className="text-sm font-bold text-[#0A1547]">{title}</span>
          </div>

          {/* Take a Tour pill */}
          <button
            onClick={startTour}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold transition-all hover:opacity-90 active:scale-[0.97]"
            style={{
              backgroundColor: tourActive ? "#A380F6" : "rgba(163,128,246,0.10)",
              color:           tourActive ? "white"   : "#A380F6",
              border:          "1px solid rgba(163,128,246,0.25)",
            }}
          >
            <Map className="w-3.5 h-3.5" />
            Take a Tour
          </button>
        </header>

        {/* Page content */}
        <main className="flex-1 p-5 lg:p-8">{children}</main>
      </div>

      {/* ── Spotlight tour ───────────────────────────────────── */}
      {tourActive && spotRect && activeTourStep && (
        <TourSpotlight
          spotRect={spotRect}
          step={activeTourStep}
          stepIndex={tourStep}
          total={TOUR_STEPS.length}
          sidebarRight={sidebarRight}
          onPrev={prevStep}
          onNext={nextStep}
          onFinish={endTour}
          onClose={endTour}
        />
      )}
    </div>
  );
}
