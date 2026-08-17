import { useState, useRef, useEffect, ReactNode } from "react";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  Building2,
  Briefcase,
  Users,
  UserCheck,
  HeartHandshake,
  CreditCard,
  ScrollText,
  LogOut,
  Menu,
  X,
  ChevronsLeft,
  ChevronsRight,
  ChevronDown,
  Check,
  Search,
  Bot,
  BarChart3,
  MousePointerClick,
  ShoppingCart,
  RadioTower,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useAppearance } from "@/context/AppearanceContext";
import { useAdminClient, type AdminClient } from "@/context/AdminClientContext";
import AppearanceSelector from "@/components/AppearanceSelector";
import DashboardBrand from "@/components/DashboardBrand";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
}

const navItems: NavItem[] = [
  { label: "Overview",              href: "/admin",                      icon: LayoutDashboard },
  { label: "Metrics",               href: "/admin/metrics",              icon: BarChart3 },
  { label: "Interview Reliability", href: "/admin/interview-reliability", icon: RadioTower },
  { label: "Leads & Public Analytics", href: "/admin/public-analytics",   icon: MousePointerClick },
  { label: "Public Purchases",      href: "/admin/public-purchases",      icon: ShoppingCart },
  { label: "Clients",               href: "/admin/clients",              icon: Building2 },
  { label: "Roles",                 href: "/admin/roles",                icon: Briefcase },
  { label: "Candidates",            href: "/admin/candidates",           icon: Users },
  { label: "Automation",            href: "/admin/automation",           icon: Bot },
  { label: "Members",               href: "/admin/members",              icon: UserCheck },
  { label: "Accommodations",        href: "/admin/accommodations",       icon: HeartHandshake },
  { label: "Billing",               href: "/admin/billing",              icon: CreditCard },
  { label: "Audit Logs",            href: "/admin/audit-logs",           icon: ScrollText },
];

interface AdminLayoutProps {
  children: ReactNode;
  title: string;
}

function adminClientScopeLabel(client: AdminClient): string {
  if (client.id === "all") return "Platform view";
  const entityLabel = String(client.entity_label || "").trim();
  const parentName = String(client.parent_client_name || "").trim();
  if (client.is_child_client === true || client.parent_client_id) {
    if (entityLabel && parentName) return `${entityLabel} under ${parentName}`;
    if (entityLabel) return entityLabel;
    return "Child entity";
  }
  const childCount = typeof client.child_count === "number" && client.child_count > 0 ? client.child_count : 0;
  return childCount ? `Parent client · ${childCount} ${childCount === 1 ? "entity" : "entities"}` : "Parent client";
}

function adminClientSearchText(client: AdminClient): string {
  return [
    client.name,
    client.entity_label,
    client.parent_client_name,
    adminClientScopeLabel(client),
    client.id === "all" ? "all clients platform view" : "",
    client.is_child_client === true || client.parent_client_id ? "child entity" : "parent client",
  ].join(" ").toLowerCase();
}

export default function AdminLayout({ children, title }: AdminLayoutProps) {
  const [mobileOpen, setMobileOpen]           = useState(false);
  const [collapsed, setCollapsed]             = useState(false);
  const [clientDropdownOpen, setClientDropdownOpen] = useState(false);
  const [clientSearch, setClientSearch]       = useState("");
  const [location, setLocation]               = useLocation();
  const { logout }                            = useAuth();
  const { mode: appearanceMode, resolvedMode } = useAppearance();
  const { selectedClient, setSelectedClient, clients, loading: clientsLoading, error: clientsError } = useAdminClient();
  const dropdownRef                           = useRef<HTMLDivElement>(null);
  const availableClients                      = clients.length > 0 ? clients : [selectedClient];

  const handleSignOut = () => {
    logout();
    setLocation("/");
  };

  const isActive = (href: string) => {
    if (href === "/admin") return location === "/admin";
    return location.startsWith(href);
  };

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

  const sidebarW  = collapsed ? "w-[72px]" : "w-60";
  const contentML = collapsed ? "lg:ml-[72px]" : "lg:ml-60";
  const contentW  = collapsed ? "lg:w-[calc(100%-72px)]" : "lg:w-[calc(100%-15rem)]";
  const isOverview = location === "/admin";
  const clientSearchTerm = clientSearch.trim().toLowerCase();
  const filteredClients = clientSearchTerm
    ? availableClients.filter((client) => adminClientSearchText(client).includes(clientSearchTerm))
    : availableClients;
  return (
    <div
      className={`as-app-shell min-h-screen flex ${resolvedMode === "dark" ? "dark" : ""}`}
      data-theme={resolvedMode}
      data-appearance-mode={appearanceMode}
      style={{ fontFamily: "'Raleway', sans-serif" }}
    >

      {/* ── Sidebar ─────────────────────────────────────────── */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex flex-col
          transition-all duration-300 ease-in-out
          ${sidebarW}
          ${mobileOpen ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0`}
        style={{ overflow: "visible", backgroundColor: "#071033", borderRight: "1px solid rgba(255,255,255,0.06)" }}
      >
        {/* Logo / Collapse toggle */}
        <div
          className={`flex min-h-[76px] flex-shrink-0 items-center
          ${collapsed ? "justify-center px-0" : "justify-between px-4"}`}
          style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
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
              <Link href="/" onClick={() => setMobileOpen(false)} className="flex flex-col gap-0.5">
                <DashboardBrand mode="dark" variant="full" />
                <span className="pl-0.5 text-[9px] font-black uppercase tracking-[0.16em] text-emerald-400">Admin console</span>
              </Link>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  className="hidden lg:flex p-1.5 rounded-lg transition-colors"
                  style={{ color: "rgba(255,255,255,0.48)" }}
                  onClick={() => { setCollapsed(true); setClientDropdownOpen(false); }}
                  title="Collapse sidebar"
                >
                  <ChevronsLeft className="w-4 h-4" />
                </button>
                <button
                  className="lg:hidden p-1.5 rounded-lg"
                  style={{ color: "var(--as-text-muted)" }}
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
          className={`flex-shrink-0 relative ${collapsed ? "py-3 flex justify-center" : "px-3 py-3"}`}
          style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
          ref={dropdownRef}
        >
          {collapsed ? (
            <button
              onClick={() => setCollapsed(false)}
              title={selectedClient.name}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-black text-white flex-shrink-0 transition-transform hover:scale-105"
              style={{ backgroundColor: selectedClient.color === "#0A1547" ? "#A380F6" : selectedClient.color }}
            >
              {selectedClient.letter === "∗" ? "A" : selectedClient.letter}
            </button>
          ) : (
            <button
              onClick={() => setClientDropdownOpen((o) => !o)}
              className="w-full rounded-xl border px-3 py-2.5 text-left transition-all"
              style={{ backgroundColor: clientDropdownOpen ? "rgba(163,128,246,0.20)" : "rgba(255,255,255,0.08)", borderColor: clientDropdownOpen ? "rgba(163,128,246,0.42)" : "rgba(255,255,255,0.06)" }}
            >
              <div className="flex min-w-0 items-center gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-bold leading-tight text-white">{selectedClient.name}</p>
                  <p className="mt-1 truncate text-[10px] text-white/55">
                    {clientsLoading ? "Loading clients..." : clientsError ? "Client load error" : adminClientScopeLabel(selectedClient)}
                  </p>
                </div>
              <ChevronDown
                className={`w-3.5 h-3.5 flex-shrink-0 transition-transform duration-200 ${clientDropdownOpen ? "rotate-180" : ""}`}
                style={{ color: "rgba(255,255,255,0.46)" }}
              />
              </div>
            </button>
          )}

          {clientDropdownOpen && !collapsed && (
            <div
              className="absolute left-3 right-3 z-50 mt-1 max-h-64 overflow-y-auto rounded-xl border py-1 shadow-2xl"
              style={{ top: "100%", backgroundColor: "#0D1744", borderColor: "rgba(255,255,255,0.12)" }}
            >
              {!clientsLoading && !clientsError && availableClients.length > 1 && (
                <div className="px-2 py-1.5">
                  <div
                    className="flex items-center gap-1.5 rounded-lg border px-2 py-1.5"
                    style={{ backgroundColor: "rgba(255,255,255,0.06)", borderColor: "rgba(255,255,255,0.10)" }}
                  >
                    <Search className="w-3.5 h-3.5 flex-shrink-0 text-white/45" />
                    <input
                      value={clientSearch}
                      onChange={(event) => setClientSearch(event.target.value)}
                      placeholder="Search clients..."
                      className="min-w-0 flex-1 bg-transparent text-xs font-semibold outline-none"
                      style={{ color: "white" }}
                    />
                  </div>
                </div>
              )}
              {clientsLoading ? (
                <p className="px-3 py-2 text-xs font-semibold text-white/55">Loading clients...</p>
              ) : clientsError ? (
                <p className="px-3 py-2 text-xs font-semibold text-red-500">{clientsError}</p>
              ) : filteredClients.length === 0 ? (
                <p className="px-3 py-2 text-xs font-semibold text-white/55">No clients match your search.</p>
              ) : (
                filteredClients.map((client) => (
                  <button
                    key={client.id}
                    onClick={() => { setSelectedClient(client); setClientSearch(""); setClientDropdownOpen(false); }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-left text-white/75 transition-colors hover:bg-white/5 hover:text-white"
                  >
                    <div
                      className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 text-[10px] font-black text-white"
                      style={{ backgroundColor: client.color === "#0A1547" ? "#A380F6" : client.color }}
                    >
                      {client.letter === "∗" ? "✦" : client.letter}
                    </div>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-semibold">{client.name}</span>
                      <span className="block truncate text-[10px] text-white/45">{adminClientScopeLabel(client)}</span>
                    </span>
                    {selectedClient.id === client.id && (
                      <Check className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "#A380F6" }} />
                    )}
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {/* Nav links */}
        <nav className={`flex-1 py-2 space-y-0.5 overflow-y-auto overflow-x-hidden
          ${collapsed ? "px-0 flex flex-col items-center" : "px-3"}`}>
          {navItems.map((item) => {
            const active = isActive(item.href);
            if (collapsed) {
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  title={item.label}
                  className={`flex h-10 w-10 items-center justify-center rounded-xl transition-all duration-150 ${active ? "bg-[#A380F6] text-white" : "text-white/55 hover:bg-white/5 hover:text-white"}`}
                >
                  <item.icon className="w-[18px] h-[18px]" />
                </Link>
              );
            }
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-xs font-semibold transition-all duration-150 ${active ? "bg-[#A380F6] text-white shadow-[0_8px_20px_rgba(163,128,246,0.22)]" : "text-white/68 hover:bg-white/5 hover:text-white"}`}
              >
                <item.icon className="w-4 h-4 flex-shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Admin status and sign out */}
        <div
          className={`flex-shrink-0 ${collapsed ? "py-3 flex justify-center" : "px-3 pb-4 pt-2"}`}
          style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
        >
          {collapsed ? (
            <button
              onClick={handleSignOut}
              title="Sign Out"
              className="flex h-10 w-10 items-center justify-center rounded-xl text-white/55 transition-all duration-150 hover:bg-red-500/15 hover:text-red-300"
            >
              <LogOut className="w-[18px] h-[18px]" />
            </button>
          ) : (
            <div className="space-y-2">
              <Link href="/admin/interview-reliability" className="block rounded-xl border border-white/5 bg-white/[0.07] px-3 py-2.5 transition-colors hover:bg-white/10">
                <span className="block text-[9px] font-black uppercase tracking-[0.14em] text-emerald-400">System status</span>
                <span className="mt-1 block text-[10px] font-semibold text-white/65">Review reliability</span>
              </Link>
              <button onClick={handleSignOut} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-xs font-semibold text-white/55 transition-all duration-150 hover:bg-red-500/15 hover:text-red-300">
                <LogOut className="h-4 w-4 flex-shrink-0" /> Sign out
              </button>
            </div>
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

      {/* ── Main content ──────────────────────────────────────── */}
      <div className={`flex min-h-screen w-full min-w-0 flex-none flex-col transition-all duration-300 ${contentML} ${contentW}`}>
        {/* The overview owns its desktop Figma header; this bar remains on mobile for navigation and appearance. */}
        <header
          className={`sticky top-0 z-20 flex h-14 items-center px-5 ${isOverview ? "lg:hidden" : ""}`}
          style={{ backgroundColor: "var(--as-surface)", borderBottom: "1px solid var(--as-border)" }}
        >
          <button
            className="lg:hidden mr-3 p-1.5 rounded-lg transition-colors"
            style={{ color: "var(--as-text-muted)" }}
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex-1 flex items-center gap-2">
            <span className="text-sm font-bold" style={{ color: "var(--as-text)" }}>{title}</span>
            <span
              className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full"
              style={{ backgroundColor: "rgba(163,128,246,0.12)", color: "#7C5FCC" }}
            >
              Admin
            </span>
          </div>
          <div className="flex items-center gap-2">
            <AppearanceSelector />
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-black text-white flex-shrink-0"
              style={{ backgroundColor: "#A380F6" }}
            >
              A
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-5 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
