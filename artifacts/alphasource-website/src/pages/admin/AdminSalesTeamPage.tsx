import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import AdminLayout from "@/components/AdminLayout";
import { supabase } from "@/lib/supabaseClient";

type Representative = {
  name: string;
  workspace_email: string;
  member_status: string;
  dashboard_link_active: boolean;
  ghl_user_linked: boolean;
  slack_user_linked: boolean;
};
type Line = {
  slot: number;
  phone_number: string | null;
  phone_active: boolean;
  assignment_status: string;
  representative: Representative | null;
  voice_configuration: {
    status: string;
    current: boolean;
    email: boolean;
    slack: boolean;
    sms: boolean;
  } | null;
};
type Overview = {
  generated_at: string;
  call_policy: string;
  settings: Record<string, boolean>;
  lines: Line[];
  ghl_sync: {
    bindings_by_status: Record<string, number>;
    deliveries_by_status: Record<string, number>;
    manual_review_count: number;
  };
};

const env = typeof import.meta !== "undefined" && import.meta.env ? import.meta.env : {};
const backendBase = String(
  (env as Record<string, unknown>).VITE_BACKEND_URL ||
  (env as Record<string, unknown>).VITE_API_URL ||
  (env as Record<string, unknown>).VITE_PUBLIC_BACKEND_URL ||
  (env as Record<string, unknown>).PUBLIC_BACKEND_URL ||
  (env as Record<string, unknown>).BACKEND_URL ||
  "",
).trim().replace(/\/+$/, "");

function statusLabel(value: string | undefined) {
  return String(value || "Not configured").replace(/_/g, " ");
}

export default function AdminSalesTeamPage() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      if (!backendBase) throw new Error("The sales service URL is not configured.");
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Please sign in again to view sales operations.");
      const response = await fetch(`${backendBase}/admin/sales-team`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
        credentials: "omit",
        cache: "no-store",
      });
      if (!response.ok) throw new Error("Sales operations are temporarily unavailable.");
      setOverview(await response.json() as Overview);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Sales operations are temporarily unavailable.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  return (
    <AdminLayout title="Sales Team">
      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6" style={{ color: "var(--as-text)" }}>
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Sales operations</h1>
            <p className="mt-1 text-sm" style={{ color: "var(--as-muted)" }}>Production roster, call routing, and CRM handoff status.</p>
          </div>
          <button type="button" onClick={() => void load()} disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm disabled:opacity-50"
            style={{ borderColor: "var(--as-border)" }}>
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
        </header>

        {error && <p role="alert" className="rounded-lg border border-red-400/40 bg-red-400/10 px-4 py-3 text-sm">{error}</p>}
        {loading && !overview && <p className="text-sm">Loading sales operations…</p>}

        {overview && <>
          <section aria-label="Production switches" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              ["Sales dashboard writes", overview.settings.sales_writes_enabled],
              ["GHL opportunity import", overview.settings.ghl_import_enabled],
              ["Call route registration", overview.settings.voice_routes_enabled],
              ["AI voice handoff", overview.settings.voice_handoff_enabled],
            ].map(([label, enabled]) =>
              <div key={String(label)} className="rounded-xl border p-4" style={{ background: "var(--as-surface)", borderColor: "var(--as-border)" }}>
                <p className="text-sm" style={{ color: "var(--as-muted)" }}>{label}</p>
                <p className={`mt-1 text-lg font-bold ${enabled ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}`}>{enabled ? "On" : "Off"}</p>
              </div>)}
          </section>

          <section aria-labelledby="sales-lines-heading" className="rounded-xl border p-4 sm:p-5" style={{ background: "var(--as-surface)", borderColor: "var(--as-border)" }}>
            <h2 id="sales-lines-heading" className="text-lg font-bold">Call lines and assigned representatives</h2>
            <p className="mt-1 text-sm" style={{ color: "var(--as-muted)" }}>{overview.call_policy}. This page shows configuration; it does not prove a representative has accepted an invite or enabled GHL calling.</p>
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              {overview.lines.map((line) => <article key={line.slot} className="rounded-lg border p-4" style={{ borderColor: "var(--as-border)" }}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="font-bold">Line {line.slot} · {line.phone_number || "No number"}</h3>
                  <span className="text-sm font-semibold">{statusLabel(line.assignment_status)}</span>
                </div>
                {line.representative ? <>
                  <p className="mt-2 font-semibold">{line.representative.name}</p>
                  <p className="text-sm" style={{ color: "var(--as-muted)" }}>{line.representative.workspace_email}</p>
                  <p className="mt-2 text-sm">GHL {line.representative.ghl_user_linked ? "linked" : "missing"} · Sales dashboard {line.representative.dashboard_link_active ? "linked" : "pending"} · Slack {line.representative.slack_user_linked ? "linked" : "missing"}</p>
                  <p className="mt-1 text-sm">Voice {statusLabel(line.voice_configuration?.status)} · Email {line.voice_configuration?.email ? "on" : "off"} · Slack {line.voice_configuration?.slack ? "on" : "off"} · SMS {line.voice_configuration?.sms ? "on" : "off"}</p>
                </> : <p className="mt-2 text-sm" style={{ color: "var(--as-muted)" }}>Unassigned; no representative should receive calls.</p>}
              </article>)}
            </div>
          </section>

          <section aria-labelledby="ghl-sync-heading" className="rounded-xl border p-4 sm:p-5" style={{ background: "var(--as-surface)", borderColor: "var(--as-border)" }}>
            <h2 id="ghl-sync-heading" className="text-lg font-bold">GHL handoff</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <h3 className="text-sm font-semibold">Opportunity bindings by status</h3>
                {Object.keys(overview.ghl_sync.bindings_by_status).length === 0 && <p className="mt-1 text-sm">No bindings yet.</p>}
                {Object.entries(overview.ghl_sync.bindings_by_status).map(([status, count]) =>
                  <p key={status} className="mt-1 text-sm">{statusLabel(status)}: {count}</p>)}
              </div>
              <div>
                <h3 className="text-sm font-semibold">GHL delivery events by status</h3>
                {Object.keys(overview.ghl_sync.deliveries_by_status).length === 0 && <p className="mt-1 text-sm">No deliveries yet.</p>}
                {Object.entries(overview.ghl_sync.deliveries_by_status).map(([status, count]) =>
                  <p key={status} className="mt-1 text-sm">{statusLabel(status)}: {count}</p>)}
              </div>
            </div>
            <p className="mt-3 text-sm font-semibold">Manual review required: {overview.ghl_sync.manual_review_count}</p>
            <p className="mt-1 text-sm" style={{ color: "var(--as-muted)" }}>Closed Won updates occur only after confirmed payment and activation. This summary does not initiate a sync.</p>
          </section>
          <p className="text-xs" style={{ color: "var(--as-muted)" }}>Status refreshed {new Date(overview.generated_at).toLocaleString()}.</p>
        </>}
      </main>
    </AdminLayout>
  );
}
