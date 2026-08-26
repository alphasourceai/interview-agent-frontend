import { useState, useRef, useEffect, useCallback, useMemo, ReactNode } from "react";
import { createPortal } from "react-dom";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  Briefcase,
  Workflow,
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
  ArrowRight,
  Compass,
  CheckCircle2,
  Search,
  Building2,
  Settings,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useAppearance } from "@/context/AppearanceContext";
import { useClient, type Client } from "@/context/ClientContext";
import DashboardBrand from "@/components/DashboardBrand";
import SupportVoicePopover from "@/components/SupportVoicePopover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const SIDEBAR_COLLAPSED_STORAGE_KEY = "alphasource:dashboard_sidebar_collapsed";

function readStoredSidebarCollapsed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (!window.matchMedia("(min-width: 1024px)").matches) return false;
    return window.sessionStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

function writeStoredSidebarCollapsed(collapsed: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, collapsed ? "true" : "false");
  } catch {
    // Sidebar state still works in memory if session storage is unavailable.
  }
}

/* ── Nav items ───────────────────────────────────────────────── */
interface NavItem {
  label: string;
  href:  string;
  icon:  React.ElementType;
}

const navItems: NavItem[] = [
  { label: "Overview",   href: "/dashboard",           icon: LayoutDashboard },
  { label: "Roles",      href: "/dashboard/roles",      icon: Briefcase       },
  { label: "Automation", href: "/dashboard/automation", icon: Workflow        },
  { label: "Candidates", href: "/dashboard/candidates", icon: Users           },
  { label: "Members",    href: "/dashboard/members",    icon: UserCheck       },
  { label: "Billing",    href: "/dashboard/billing",    icon: CreditCard      },
  { label: "Entities",   href: "/dashboard/entities",   icon: Building2       },
  { label: "Help Center", href: "/dashboard/support",    icon: HelpCircle      },
];

/* ── Tour steps ──────────────────────────────────────────────── */
interface TourStep {
  href:     string;
  title:    string;
  emoji:    string;
  desc:     string;
  bullets:  string[];
}

const TOUR_STEPS_BY_HREF: Record<string, TourStep> = {
  "/dashboard": {
    href: "/dashboard", title: "Overview", emoji: "📊",
    desc: "Your command center — see active roles, recent candidate submissions, score distributions, and top performers at a glance.",
    bullets: ["Hiring pipeline summary", "Recent candidate activity", "Score distribution charts"],
  },
  "/dashboard/roles": {
    href: "/dashboard/roles", title: "Roles", emoji: "💼",
    desc: "Create and manage open positions. Parent and child-entity clients can use the Entity selector to review roles assigned directly to the parent/client, all entities, or one specific entity.",
    bullets: ["Create & publish new roles", "Track open vs. closed roles", "Use the Entity column to confirm role scope"],
  },
  "/dashboard/automation": {
    href: "/dashboard/automation", title: "Automation", emoji: "⚙️",
    desc: "Configure Candidate Automation to gather candidates who meet thresholds into one Review Candidates digest for client admin review and approved next-step workflow actions.",
    bullets: ["Set score thresholds and reviewers", "Review candidates awaiting approval", "Approving controls configured next-step outreach"],
  },
  "/dashboard/candidates": {
    href: "/dashboard/candidates", title: "Candidates", emoji: "👥",
    desc: "Review every applicant. Parent and child-entity clients can filter candidates by parent/client, all entities, or one specific entity and confirm ownership in the Entity column.",
    bullets: ["Resume & screening interview analysis", "Sort, filter, and export results", "Review the Entity column before sharing records"],
  },
  "/dashboard/members": {
    href: "/dashboard/members", title: "Members", emoji: "🛡️",
    desc: "Control who can access your alphaSource dashboard. Entity filtering shows direct member assignments for the selected scope, not inherited or effective access.",
    bullets: ["Invite team members by email", "Assign team access by client/entity scope", "Use Entity filtering to review direct assignments"],
  },
  "/dashboard/billing": {
    href: "/dashboard/billing", title: "Billing", emoji: "💳",
    desc: "Manage your subscription plan, review past invoices, and update payment details — all in one place.",
    bullets: ["View your current plan", "Full invoice history", "Update payment methods"],
  },
  "/dashboard/entities": {
    href: "/dashboard/entities", title: "Entities", emoji: "🏢",
    desc: "Manage parent-client and child-entity structure when your organization has multiple operating scopes.",
    bullets: ["View parent and child entities", "Import child entities from CSV", "Archive inactive child entities without deleting history"],
  },
  "/dashboard/support": {
    href: "/dashboard/support", title: "Help Center", emoji: "❓",
    desc: "Find alphaScreen guidance, common questions, product updates, and client data-practice documentation directly inside the client portal.",
    bullets: ["Review dashboard help topics", "See client-facing product updates", "Understand retention, deletion, incidents, automation, and entity filtering"],
  },
};

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
              {Array.from({ length: total }).map((_, i) => (
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

function clientScopeLabel(client: Client): string {
  if (client.is_child_client === true || client.parent_client_id) {
    const parentName = String(client.parent_client_name || "").trim();
    return parentName ? `Child entity of ${parentName}` : "Child entity";
  }
  return "Parent client";
}

function clientScopeSubtitle(client: Client): string {
  const parts = [clientScopeLabel(client)];
  if (client.inherited === true) parts.push("Inherited access");
  return parts.join(" · ");
}

function clientSearchText(client: Client): string {
  return [
    client.name,
    client.role,
    client.entity_label,
    client.parent_client_name,
    clientScopeLabel(client),
    client.inherited === true ? "inherited inherited access" : "",
    client.is_child_client === true || client.parent_client_id ? "child entity" : "parent scope",
  ].join(" ").toLowerCase();
}

function pluralizeEntityLabel(label: string): string {
  const normalized = String(label || "").trim().toLowerCase();
  if (!normalized) return "";
  if (normalized.endsWith("s")) return normalized;
  if (normalized.endsWith("y") && !/[aeiou]y$/.test(normalized)) return `${normalized.slice(0, -1)}ies`;
  if (/(x|z|ch|sh)$/.test(normalized)) return `${normalized}es`;
  return `${normalized}s`;
}

function getClientSearchPlaceholder(clients: Client[]): string {
  const entityLabel = clients.map((client) => String(client.entity_label || "").trim()).find(Boolean);
  const pluralized = pluralizeEntityLabel(entityLabel || "");
  return pluralized ? `Search ${pluralized}...` : "Search clients...";
}

function sidebarAvatarColor(color: string, resolvedMode: string): string {
  if (resolvedMode !== "dark") return color;
  return color.trim().toLowerCase() === "#0a1547" ? "#A380F6" : color;
}

function normalizeClientRole(role: unknown): string {
  const normalized = String(role || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  return normalized === "superadmin" ? "super_admin" : normalized;
}

function hasBillingNavAccess(client: Client): boolean {
  const permissions = client.permissions;
  if (permissions?.can_view_legal_billing === true || permissions?.can_purchase_interviews === true) return true;
  const hasExplicitBillingPermissions =
    typeof permissions?.can_view_legal_billing === "boolean" ||
    typeof permissions?.can_purchase_interviews === "boolean";
  if (hasExplicitBillingPermissions) return false;
  return ["manager", "admin", "owner", "super_admin"].includes(normalizeClientRole(client.role));
}

function hasMembersNavAccess(client: Client): boolean {
  const permission = client.permissions?.can_manage_members;
  if (permission === true) return true;
  if (permission === false) return false;
  return ["manager", "admin", "owner", "super_admin"].includes(normalizeClientRole(client.role));
}

function hasEntitiesNavAccess(client: Client, isGlobalAdmin: boolean): boolean {
  if (isGlobalAdmin) return true;
  const isParentScope = !(client.is_child_client === true || client.parent_client_id);
  const inheritedFromParent = client.inherited === true && Boolean(client.inherited_from_client_id || client.parent_client_id);
  const canReachParentEntityScope = isParentScope || inheritedFromParent;
  const permission = client.permissions?.can_manage_members;
  if (permission === true) return canReachParentEntityScope;
  if (permission === false) return false;
  return canReachParentEntityScope && ["manager", "admin", "owner", "super_admin"].includes(normalizeClientRole(client.role));
}

/* ── Main layout ─────────────────────────────────────────────── */
interface DashboardLayoutProps {
  children: ReactNode;
  title:    string;
}

const DASHBOARD_PAGE_DESCRIPTIONS: Record<string, string> = {
  Overview: "Your hiring pipeline at a glance. Prioritize decisions and keep things moving.",
  Roles: "Create and manage interview roles, capacity, and status for this client.",
  Automation: "Configure review criteria, digest timing, reviewers, and scheduling workflows.",
  Candidates: "Review, filter, and manage candidates across roles and interview stages.",
  Members: "Manage dashboard access and client membership for your team.",
  Billing: "Review membership, usage, billing status, agreements, and payment activity.",
  Entities: "Manage parent and child entities, labels, and client scope structure.",
  Support: "Find practical guidance, product updates, account security help, and support contacts.",
  "Profile Settings": "Manage your personal information, appearance, and sign-in methods.",
};

function userDisplayName(user: ReturnType<typeof useAuth>["currentUser"]): string {
  const metadata = user?.user_metadata || {};
  const explicit = String(metadata.full_name || metadata.name || "").trim();
  if (explicit) return explicit;
  const parts = [metadata.first_name, metadata.last_name]
    .map((value) => String(value || "").trim())
    .filter(Boolean);
  return parts.join(" ") || String(user?.email || "").split("@")[0] || "Account";
}

function userInitial(user: ReturnType<typeof useAuth>["currentUser"]): string {
  const match = userDisplayName(user).match(/[A-Za-z0-9]/);
  return match ? match[0].toUpperCase() : "A";
}

export default function DashboardLayout({ children, title }: DashboardLayoutProps) {
  const [mobileOpen,         setMobileOpen]         = useState(false);
  const [collapsed,          setCollapsed]           = useState(() => readStoredSidebarCollapsed());
  const [clientDropdownOpen, setClientDropdownOpen]  = useState(false);
  const [clientSearch,       setClientSearch]        = useState("");
  const [tourActive,         setTourActive]          = useState(false);
  const [tourStep,           setTourStep]            = useState(0);
  const [spotRect,           setSpotRect]            = useState<SpotRect | null>(null);

  const [location, setLocation] = useLocation();
  const { logout, currentUser } = useAuth();
  const { mode: appearanceMode, resolvedMode } = useAppearance();
  const { selectedClient, setSelectedClient, clients, loading: clientsLoading, error: clientsError, isGlobalAdmin } = useClient();
  const dropdownRef  = useRef<HTMLDivElement>(null);
  const visibleNavItems = useMemo(
    () => navItems.filter((item) => {
      if (item.label === "Members") return hasMembersNavAccess(selectedClient);
      if (item.label === "Billing") return hasBillingNavAccess(selectedClient);
      if (item.label === "Entities") return hasEntitiesNavAccess(selectedClient, isGlobalAdmin);
      return true;
    }),
    [isGlobalAdmin, selectedClient],
  );
  const visibleTourSteps = useMemo(
    () => visibleNavItems
      .map((item) => TOUR_STEPS_BY_HREF[item.href])
      .filter((step): step is TourStep => Boolean(step)),
    [visibleNavItems],
  );
  const activeTourStep = visibleTourSteps[tourStep] || null;

  /* One ref per visible nav item */
  const navRefs = useRef<Record<string, HTMLAnchorElement | null>>({});

  /* Measure the current tour nav item */
  const measureStep = useCallback((step: number) => {
    const stepConfig = visibleTourSteps[step];
    if (!stepConfig) return;
    const el = navRefs.current[stepConfig.href];
    if (el) {
      const r = el.getBoundingClientRect();
      setSpotRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    }
  }, [visibleTourSteps]);

  /* Remeasure on step change or resize */
  useEffect(() => {
    if (!tourActive) return;
    measureStep(tourStep);
    const onResize = () => measureStep(tourStep);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [tourActive, tourStep, measureStep, collapsed]);

  useEffect(() => {
    if (!tourActive) return;
    if (tourStep < visibleTourSteps.length) return;
    setTourStep(Math.max(0, visibleTourSteps.length - 1));
  }, [tourActive, tourStep, visibleTourSteps.length]);

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

  useEffect(() => {
    if (!clientDropdownOpen) setClientSearch("");
  }, [clientDropdownOpen]);

  useEffect(() => {
    writeStoredSidebarCollapsed(collapsed);
  }, [collapsed]);

  /* Close tour on Escape */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") endTour(); };
    if (tourActive) document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [tourActive]);

  /* Tour controls */
  const startTour = () => {
    if (visibleTourSteps.length === 0) return;
    if (collapsed) setCollapsed(false);
    setTourStep(0);
    setTourActive(true);
    /* Measure after a frame so the sidebar has expanded */
    requestAnimationFrame(() => measureStep(0));
  };
  const nextStep  = () => setTourStep((s) => Math.min(s + 1, visibleTourSteps.length - 1));
  const prevStep  = () => setTourStep((s) => Math.max(s - 1, 0));
  const endTour   = () => { setTourActive(false); setSpotRect(null); };

  const handleSignOut = () => { logout(); setLocation("/"); };
  const isActive = (href: string) => {
    if (href === "/dashboard") return location === "/dashboard";
    if (href === "/dashboard/support") return location === "/dashboard/support" || location === "/dashboard/faq";
    return location.startsWith(href);
  };

  const sidebarW  = collapsed ? "w-16" : "w-[232px]";
  const contentML = collapsed ? "lg:ml-16" : "lg:ml-[232px]";
  const sidebarRight = collapsed ? 64 : 232;
  const clientSearchTerm = clientSearch.trim().toLowerCase();
  const filteredClients = clientSearchTerm
    ? clients.filter((client) => clientSearchText(client).includes(clientSearchTerm))
    : clients;
  const pageDescription = DASHBOARD_PAGE_DESCRIPTIONS[title] || "Manage your alphaScreen workspace.";
  const clientSearchPlaceholder = getClientSearchPlaceholder(clients);
  return (
    <div
      className={`as-app-shell min-h-screen flex ${resolvedMode === "dark" ? "dark" : ""}`}
      data-theme={resolvedMode}
      data-appearance-mode={appearanceMode}
      style={{ fontFamily: "'Raleway', sans-serif" }}
    >

      {/* ── Sidebar ──────────────────────────────────────────── */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex flex-col
          transition-all duration-300 ease-in-out ${sidebarW}
          ${mobileOpen ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0`}
        style={{ overflow: "visible", backgroundColor: "#070D2E", borderRight: "1px solid rgba(163,128,246,0.16)" }}
      >
        {/* Logo / Collapse toggle */}
        <div
          className={`flex items-center flex-shrink-0 h-20
          ${collapsed ? "justify-center px-0" : "justify-between px-5"}`}
          style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}
        >
          {collapsed ? (
            <button
              className="hidden lg:flex flex-col items-center gap-0.5 py-1.5 px-2 rounded-xl
                         transition-colors group"
              style={{ color: "var(--as-text-subtle)" }}
              onClick={() => setCollapsed(false)}
              title="Expand sidebar"
            >
              <DashboardBrand mode="dark" variant="compact" />
              <ChevronsRight className="w-3.5 h-3.5 text-[#A380F6]/50 group-hover:text-[#A380F6] transition-colors" />
            </button>
          ) : (
            <>
              <Link href="/" onClick={() => setMobileOpen(false)}>
                <DashboardBrand mode="dark" variant="full" />
              </Link>
              <div className="flex items-center gap-1">
                <button
                  className="hidden lg:flex p-1.5 rounded-lg transition-colors"
                    style={{ color: "rgba(255,255,255,0.45)" }}
                  onClick={() => { setCollapsed(true); setClientDropdownOpen(false); }}
                  title="Collapse sidebar"
                >
                  <ChevronsLeft className="w-4 h-4" />
                </button>
                <button
                  className="lg:hidden p-1.5 rounded-lg"
                    style={{ color: "rgba(255,255,255,0.7)" }}
                  onClick={() => setMobileOpen(false)}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </>
          )}
        </div>

        {/* Nav links */}
        <nav className={`min-h-0 flex-1 py-4 space-y-0.5 overflow-y-auto overflow-x-hidden
          ${collapsed ? "px-0 flex flex-col items-center" : "px-3"}`}>
          {!collapsed && <p className="px-3 pb-2 text-[10px] font-black uppercase tracking-[0.16em] text-white/45">Workspace</p>}
          {visibleNavItems.map((item) => {
            const active = isActive(item.href);

            if (collapsed) {
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  ref={(el) => { navRefs.current[item.href] = el as HTMLAnchorElement | null; }}
                  onClick={() => setMobileOpen(false)}
                  title={item.label}
                  className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all duration-150 ${active ? "bg-[#A380F6]/25 text-white" : "text-white/65 hover:bg-white/5 hover:text-white"}`}
                >
                  <item.icon className="w-[18px] h-[18px]" />
                </Link>
              );
            }

            return (
              <Link
                key={item.href}
                href={item.href}
                ref={(el) => { navRefs.current[item.href] = el as HTMLAnchorElement | null; }}
                onClick={() => setMobileOpen(false)}
                className={`relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-150 ${active ? "bg-[#A380F6]/25 text-white" : "text-white/70 hover:bg-white/5 hover:text-white"}`}
              >
                {active && <span className="absolute inset-y-2 left-0 w-1 rounded-full bg-[#A380F6]" />}
                <item.icon className="w-4 h-4 flex-shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className={`flex-shrink-0 ${collapsed ? "px-3" : "px-5"}`}>
          {collapsed ? <SupportVoicePopover placement="sidebar" collapsed /> : <SupportVoicePopover />}
          {collapsed && (
            <button
              type="button"
              onClick={startTour}
              aria-label="Start dashboard tour"
              title="Start dashboard tour"
              className="mt-2 flex h-10 w-10 items-center justify-center rounded-xl border border-[#A380F6]/30 bg-[#A380F6]/10 text-[#BBA4FF] transition-colors hover:border-[#A380F6]/70 hover:bg-[#A380F6]/20"
            >
              <Compass className="h-4 w-4" />
            </button>
          )}
        </div>

        {!collapsed && (
          <button
            type="button"
            onClick={startTour}
            className="mx-5 mb-4 rounded-2xl border border-[#A380F6]/25 bg-[#25266A] p-4 text-left text-white transition-colors hover:border-[#A380F6]/55 hover:bg-[#2D2D76]"
          >
            <span className="block text-[10px] font-black uppercase tracking-[0.14em] text-white/80">Quick guide</span>
            <span className="mt-3 block text-sm font-black">Need a refresher?</span>
            <span className="mt-2 block text-[11px] leading-relaxed text-white/70">Replay the dashboard tour without leaving your work.</span>
            <span className="mt-4 flex items-center gap-1.5 text-xs font-bold text-[#BBA4FF]">Start tour <ArrowRight className="h-3 w-3" /></span>
          </button>
        )}

        {!collapsed && (
          <div className="flex-shrink-0 px-4 pb-4">
            <div className="border-t border-white/10 pt-3">
              <span className="text-[10px] font-semibold text-white/40">alphaScreen</span>
            </div>
          </div>
        )}
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
        <header
          className="sticky top-0 z-20 flex min-h-[88px] items-center gap-4 px-5 lg:px-8"
          style={{ backgroundColor: "color-mix(in srgb, var(--as-page) 94%, transparent)", borderBottom: "1px solid var(--as-border)", backdropFilter: "blur(14px)" }}
        >
          <button
            className="lg:hidden mr-3 p-1.5 rounded-lg transition-colors"
            style={{ color: "var(--as-text-muted)" }}
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-2xl font-black leading-tight" style={{ color: "var(--as-text)" }}>{title}</h1>
            <p className="mt-1 truncate text-xs sm:text-sm" style={{ color: "var(--as-text-muted)" }}>{pageDescription}</p>
          </div>

          <div className="relative min-w-0" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setClientDropdownOpen((open) => !open)}
              aria-expanded={clientDropdownOpen}
              aria-haspopup="listbox"
              aria-label="Select client scope"
              className="flex h-10 w-40 items-center gap-2.5 rounded-xl border px-3 text-left transition-colors hover:border-[#A380F6]/45 sm:w-64"
              style={{ backgroundColor: "var(--as-surface)", borderColor: "var(--as-border)" }}
            >
              <span className="min-w-0 flex-1 truncate text-xs font-black" style={{ color: "var(--as-text)" }}>{selectedClient.name}</span>
              <ChevronDown className={`h-3.5 w-3.5 flex-shrink-0 transition-transform ${clientDropdownOpen ? "rotate-180" : ""}`} style={{ color: "var(--as-text-muted)" }} />
            </button>
            {clientDropdownOpen && (
              <div role="listbox" aria-label="Client scopes" className="absolute right-0 top-12 z-50 max-h-80 w-80 overflow-y-auto rounded-xl border py-1 shadow-xl" style={{ backgroundColor: "var(--as-surface)", borderColor: "var(--as-border)" }}>
                {!clientsLoading && clients.length > 1 && (
                  <div className="px-2 py-1.5">
                    <div className="flex items-center gap-1.5 rounded-lg border px-2 py-1.5" style={{ backgroundColor: "var(--as-surface-muted)", borderColor: "var(--as-border)" }}>
                      <Search className="h-3.5 w-3.5 flex-shrink-0" style={{ color: "var(--as-text-subtle)" }} />
                      <input aria-label="Search client scopes" value={clientSearch} onChange={(event) => setClientSearch(event.target.value)} placeholder={clientSearchPlaceholder} className="min-w-0 flex-1 bg-transparent text-xs font-semibold outline-none" style={{ color: "var(--as-text)" }} />
                    </div>
                  </div>
                )}
                {clientsLoading && <div className="px-3 py-2 text-xs font-semibold" style={{ color: "var(--as-text-muted)" }}>Loading clients...</div>}
                {!clientsLoading && clients.length === 0 && <div className="px-3 py-2 text-xs font-semibold" style={{ color: "var(--as-text-muted)" }}>{clientsError ? "Could not load clients." : "No client access."}</div>}
                {!clientsLoading && clients.length > 0 && filteredClients.length === 0 && <div className="px-3 py-2 text-xs font-semibold" style={{ color: "var(--as-text-muted)" }}>No scopes match your search.</div>}
                {!clientsLoading && filteredClients.map((client) => (
                  <button key={client.id} type="button" role="option" aria-selected={selectedClient.id === client.id} onClick={() => { setSelectedClient(client); setClientSearch(""); setClientDropdownOpen(false); }} className="as-shell-dropdown-item flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors">
                    <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-[10px] font-black text-white" style={{ backgroundColor: sidebarAvatarColor(client.color, resolvedMode) }}>{client.letter}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-semibold" style={{ color: "var(--as-text)" }}>{client.name}</span>
                      <span className="block truncate text-[10px]" style={{ color: "var(--as-text-muted)" }}>{clientScopeSubtitle(client)}</span>
                    </span>
                    {selectedClient.id === client.id && <Check className="h-3.5 w-3.5 flex-shrink-0 text-[#A380F6]" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="Open account menu"
                className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[#9272EB] text-xs font-black text-white transition-all hover:bg-[#8060DC] focus:outline-none focus:ring-2 focus:ring-[#A380F6]/35 focus:ring-offset-2"
              >
                {userInitial(currentUser)}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              sideOffset={8}
              className="w-64 rounded-xl border p-1.5 shadow-xl"
              style={{ backgroundColor: "var(--as-surface)", borderColor: "var(--as-border)", color: "var(--as-text)" }}
            >
              <DropdownMenuLabel className="px-3 py-2">
                <span className="block truncate text-xs font-black">{userDisplayName(currentUser)}</span>
                <span className="mt-0.5 block truncate text-[11px] font-medium" style={{ color: "var(--as-text-muted)" }}>{currentUser?.email || ""}</span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator style={{ backgroundColor: "var(--as-border)" }} />
              <DropdownMenuItem
                onSelect={(event) => { event.preventDefault(); setLocation("/dashboard/profile"); }}
                className="cursor-pointer items-start rounded-lg px-3 py-2.5"
              >
                <Settings className="mt-0.5 h-4 w-4 text-[#A380F6]" />
                <span className="min-w-0">
                  <span className="block text-xs font-black">Profile &amp; security</span>
                  <span className="mt-0.5 block text-[10px] font-medium" style={{ color: "var(--as-text-muted)" }}>
                    Profile, appearance, and passkeys
                  </span>
                </span>
              </DropdownMenuItem>
              <DropdownMenuSeparator style={{ backgroundColor: "var(--as-border)" }} />
              <DropdownMenuItem
                onSelect={(event) => { event.preventDefault(); handleSignOut(); }}
                className="cursor-pointer rounded-lg px-3 py-2 text-xs font-bold text-red-600 focus:bg-red-50 focus:text-red-700"
              >
                <LogOut className="h-4 w-4" />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        {/* Page content */}
        <main className="flex-1 p-5 lg:px-8 lg:py-5">{children}</main>
      </div>

      {/* ── Spotlight tour ───────────────────────────────────── */}
      {tourActive && spotRect && activeTourStep && (
        <TourSpotlight
          spotRect={spotRect}
          step={activeTourStep}
          stepIndex={tourStep}
          total={visibleTourSteps.length}
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
