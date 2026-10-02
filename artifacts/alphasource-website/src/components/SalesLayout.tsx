import { useEffect, useState, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import {
  BriefcaseBusiness,
  Building2,
  ChevronRight,
  Handshake,
  LayoutDashboard,
  LayoutList,
  LogOut,
  Menu,
  Plus,
  X,
} from "lucide-react";
import DashboardBrand from "@/components/DashboardBrand";
import AppearanceSelector from "@/components/AppearanceSelector";
import { useAppearance } from "@/context/AppearanceContext";
import { useAuth } from "@/context/AuthContext";
import type { SalesRep } from "@/features/sales/types";
import { salesUsesMockApi } from "@/features/sales/salesApi";

interface SalesLayoutProps {
  children: ReactNode;
  rep: SalesRep;
}

const navigation = [
  { label: "My deals", href: "/sales", icon: LayoutList },
  { label: "New sale", href: "/sales/new", icon: Plus },
  { label: "Enterprise handoff", href: "/sales/enterprise", icon: Handshake },
];

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "AS";
}

export default function SalesLayout({ children, rep }: SalesLayoutProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [location, setLocation] = useLocation();
  const { logout } = useAuth();
  const { resolvedMode } = useAppearance();

  useEffect(() => setMobileOpen(false), [location]);

  const handleSignOut = () => {
    logout();
    setLocation("/");
  };

  const active = (href: string) => href === "/sales" ? location === "/sales" : location.startsWith(href);

  return (
    <div className={`as-app-shell min-h-screen ${resolvedMode === "dark" ? "dark" : ""}`} data-theme={resolvedMode}>
      {mobileOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-[#071033]/45 backdrop-blur-[2px] lg:hidden"
          aria-label="Close navigation"
          onClick={() => setMobileOpen(false)}
        />
      ) : null}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-[264px] flex-col bg-[#071033] text-white transition-transform duration-200 lg:translate-x-0 ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="flex h-[76px] items-center justify-between border-b border-white/[0.07] px-5">
          <Link href="/sales" className="flex items-center gap-3">
            <DashboardBrand mode="dark" variant="full" />
          </Link>
          <button type="button" onClick={() => setMobileOpen(false)} className="rounded-lg p-2 text-white/60 hover:bg-white/10 hover:text-white lg:hidden" aria-label="Close navigation">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-5 pb-3 pt-5">
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-emerald-300">
            <BriefcaseBusiness className="h-3.5 w-3.5" />
            Sales workspace
          </div>
          <p className="mt-2 text-xs font-semibold leading-relaxed text-white/48">Agreements, payment progress, and handoffs.</p>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-3" aria-label="Sales workspace">
          {navigation.map((item) => {
            const Icon = item.icon;
            const selected = active(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`group flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-bold transition-colors ${selected ? "bg-[#A380F6] text-white shadow-[0_10px_24px_rgba(163,128,246,0.24)]" : "text-white/62 hover:bg-white/[0.07] hover:text-white"}`}
              >
                <Icon className="h-[18px] w-[18px]" />
                <span className="flex-1">{item.label}</span>
                <ChevronRight className={`h-4 w-4 transition-opacity ${selected ? "opacity-80" : "opacity-0 group-hover:opacity-50"}`} />
              </Link>
            );
          })}
          {rep.access_role === "global_admin" ? (
            <Link
              href="/admin"
              className="group mt-3 flex items-center gap-3 border-t border-white/[0.07] px-3 py-3 text-sm font-bold text-white/62 transition-colors hover:bg-white/[0.07] hover:text-white"
            >
              <LayoutDashboard className="h-[18px] w-[18px]" />
              <span className="flex-1">Admin console</span>
              <ChevronRight className="h-4 w-4 opacity-0 transition-opacity group-hover:opacity-50" />
            </Link>
          ) : null}
        </nav>

        <div className="border-t border-white/[0.07] p-4">
          <div className="flex items-center gap-3 rounded-xl bg-white/[0.055] p-3">
            <div className="grid h-9 w-9 flex-none place-items-center rounded-[10px] bg-[#02ABE0] text-xs font-black text-white">
              {initials(rep.display_name)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-black text-white">{rep.display_name}</p>
              <p className="truncate text-[10px] font-semibold text-white/42">{rep.email}</p>
              {rep.access_role === "global_admin" ? <p className="mt-1 text-[9px] font-black uppercase tracking-[0.12em] text-emerald-300">Global admin access</p> : null}
            </div>
            {!salesUsesMockApi ? (
              <button type="button" onClick={handleSignOut} className="rounded-lg p-2 text-white/45 hover:bg-white/10 hover:text-white" title="Sign out" aria-label="Sign out of the sales workspace">
                <LogOut className="h-4 w-4" />
              </button>
            ) : null}
          </div>
        </div>
      </aside>

      <div className="min-h-screen lg:pl-[264px]" style={{ backgroundColor: "var(--as-page)" }}>
        <header className="sticky top-0 z-20 flex h-[70px] items-center justify-between border-b px-4 backdrop-blur-xl sm:px-6 lg:px-8" style={{ backgroundColor: "color-mix(in srgb, var(--as-page) 88%, transparent)", borderColor: "var(--as-border)" }}>
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => setMobileOpen(true)} className="rounded-[10px] border p-2 lg:hidden" style={{ borderColor: "var(--as-border)", color: "var(--as-text)" }} aria-label="Open navigation">
              <Menu className="h-5 w-5" />
            </button>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#A380F6]">alphaScreen</p>
              <p className="text-sm font-black" style={{ color: "var(--as-text)" }}>Sales workspace</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {salesUsesMockApi ? (
              <span className="hidden rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-amber-700 sm:inline-flex">Prototype data</span>
            ) : null}
            <AppearanceSelector />
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}

export function SalesPageHeading({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-2xl">
        <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#A380F6]">{eyebrow}</p>
        <h1 className="mt-2 text-2xl font-black tracking-[-0.03em] sm:text-3xl" style={{ color: "var(--as-text)" }}>{title}</h1>
        <p className="mt-2 text-sm font-semibold leading-relaxed" style={{ color: "var(--as-text-muted)" }}>{description}</p>
      </div>
      {action}
    </div>
  );
}

export function SalesEmptyPanel({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="rounded-2xl border border-dashed px-6 py-12 text-center" style={{ borderColor: "var(--as-border)", backgroundColor: "var(--as-surface)" }}>
      <div className="mx-auto grid h-11 w-11 place-items-center rounded-xl bg-[#A380F6]/10 text-[#A380F6]"><Building2 className="h-5 w-5" /></div>
      <h2 className="mt-4 text-base font-black" style={{ color: "var(--as-text)" }}>{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm font-semibold leading-relaxed" style={{ color: "var(--as-text-muted)" }}>{detail}</p>
    </div>
  );
}
