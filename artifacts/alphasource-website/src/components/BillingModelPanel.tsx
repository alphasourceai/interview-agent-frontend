import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getPublicBackendBase } from "@/lib/urlConfig";
import { useAuth } from "@/context/AuthContext";
import {
  modelLabel,
  moneyCents,
  moneyDollars,
  nonNegativeCount,
  hasPricedUsage,
  usageInvoiceStatusLabel,
  membershipTermEndDate,
} from "@/lib/billingDisplay";

type JsonRow = Record<string, unknown>;
const rows = (value: unknown): JsonRow[] =>
  Array.isArray(value) ? value.filter((v) => v && typeof v === "object") : [];
const count = (value: unknown) =>
  nonNegativeCount(value)?.toLocaleString() ?? "—";
const date = (value: unknown) => {
  const parsed = new Date(String(value ?? ""));
  return Number.isFinite(parsed.getTime())
    ? parsed.toLocaleDateString("en-US")
    : "—";
};
const cardStyle = {
  backgroundColor: "var(--as-surface)",
  border: "1px solid var(--as-border)",
  color: "var(--as-text)",
};

// Keying by scope prevents even a one-render flash of the previous client's billing.
export default function BillingModelPanel({
  clientId,
  admin = false,
}: {
  clientId: string;
  admin?: boolean;
}) {
  const { currentUser } = useAuth();
  if (!clientId || clientId === "all") return null;
  return (
    <BillingModelDetails
      key={`${currentUser?.id}:${admin}:${clientId}`}
      clientId={clientId}
      admin={admin}
    />
  );
}
function BillingModelDetails({
  clientId,
  admin,
}: {
  clientId: string;
  admin: boolean;
}) {
  const [data, setData] = useState<{
    pool: JsonRow;
    credits: JsonRow;
    usage: JsonRow;
    settings: JsonRow;
  } | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const abort = new AbortController();
    async function load() {
      const { data: auth } = await supabase.auth.getSession();
      if (!auth.session?.access_token)
        throw new Error("Sign in to view billing details.");
      const get = async (path: string) => {
        const response = await fetch(`${getPublicBackendBase()}${path}`, {
          signal: abort.signal,
          cache: "no-store",
          credentials: "omit",
          headers: { Authorization: `Bearer ${auth.session!.access_token}` },
        });
        if (!response.ok)
          throw new Error("Billing details are unavailable for this scope.");
        return (await response.json()) as JsonRow;
      };
      if (admin) {
        const summary = await get(
          `/admin/clients/${encodeURIComponent(clientId)}/billing-summary`,
        );
        if (!abort.signal.aborted)
          setData({
            pool: {
              ...(summary.interview_pool as JsonRow),
              billing_model: summary.billing_model,
            },
            credits: summary.credits as JsonRow,
            usage: {
              ...(summary.unbilled_usage as JsonRow),
              billed_invoices: summary.recent_usage_invoices,
            },
            settings: summary.plan_settings as JsonRow,
          });
      } else {
        const query = `?client_id=${encodeURIComponent(clientId)}`;
        const [pool, credits, usage] = await Promise.all([
          get(`/clients/billing/pool${query}`),
          get(`/clients/billing/credits${query}`),
          get(`/clients/billing/usage${query}`),
        ]);
        if (!abort.signal.aborted)
          setData({ pool, credits, usage, settings: {} });
      }
    }
    void load().catch(() => {
      if (!abort.signal.aborted)
        setError(
          "Billing details are unavailable for this scope. Existing balances have not been changed.",
        );
    });
    return () => abort.abort();
  }, [admin, clientId]);
  if (!data)
    return (
      <section className="rounded-2xl p-6 mb-6" style={cardStyle}>
        <h2 className="text-base font-black mb-2">
          Interview billing & capacity
        </h2>
        <p
          className="text-sm"
          style={{ color: "var(--as-text-muted)" }}
          role={error ? "alert" : "status"}
        >
          {error || "Loading billing model…"}
        </p>
      </section>
    );
  const model = data.pool?.billing_model;
  const credits = rows(data.credits?.items);
  const lines = rows(data.usage?.lines);
  const pricedUsage = hasPricedUsage(lines);
  const invoices = rows(data.usage?.billed_invoices);
  return (
    <section className="rounded-2xl p-6 mb-6" style={cardStyle}>
      <h2 className="text-base font-black">Interview billing & capacity</h2>
      <p
        className="text-sm mt-1 mb-4"
        style={{ color: "var(--as-text-muted)" }}
      >
        {modelLabel(model)}. Shared balances are shown once, not multiplied by
        the number of roles.
      </p>
      {admin && (
        <dl className="grid sm:grid-cols-3 gap-3 mb-4 text-sm">
          <div>
            <dt>Platform fee</dt>
            <dd className="font-bold">
              {moneyDollars(data.settings?.platform_fee)}
            </dd>
          </div>
          <div>
            <dt>Per-role fee</dt>
            <dd className="font-bold">
              {moneyDollars(data.settings?.per_role_fee)}
            </dd>
          </div>
          <div>
            <dt>Per-interview usage fee</dt>
            <dd className="font-bold">
              {moneyCents(data.settings?.usage_interview_fee_cents)}
            </dd>
          </div>
        </dl>
      )}
      {model === "rollover" && (
        <>
          <p className="font-bold text-sm mb-3">
            Shared rollover credits: {count(data.credits?.total_remaining)}
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr>
                  <th className="py-2">Source role</th>
                  <th>Remaining</th>
                  <th>Expires</th>
                </tr>
              </thead>
              <tbody>
                {credits.map((credit, index) => (
                  <tr
                    key={String(credit.id ?? index)}
                    className="border-t"
                    style={{ borderColor: "var(--as-border)" }}
                  >
                    <td className="py-2">
                      {String(
                        credit.role_title ??
                          credit.source_role_title ??
                          "Closed role",
                      )}
                    </td>
                    <td>{count(credit.remaining)}</td>
                    <td>{date(credit.expires_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!credits.length && (
            <p className="text-sm">No available rollover credits.</p>
          )}
        </>
      )}
      {model === "usage" && (
        <>
          <dl className="grid sm:grid-cols-3 gap-3 text-sm">
            <div>
              <dt>Shared pool purchased</dt>
              <dd className="font-bold">{count(data.pool?.purchased)}</dd>
            </div>
            <div>
              <dt>Pool used</dt>
              <dd className="font-bold">{count(data.pool?.used)}</dd>
            </div>
            <div>
              <dt>Pool remaining</dt>
              <dd className="font-bold">{count(data.pool?.remaining)}</dd>
            </div>
          </dl>
          <h3 className="font-bold text-sm mt-5">
            Usage preview — not an invoice
            {pricedUsage ? `: ${moneyCents(data.usage?.total_cents)}` : ""}
          </h3>
          <p
            className="text-xs mt-1 mb-3"
            style={{ color: "var(--as-text-muted)" }}
          >
            This is not an amount due. Signed terms and issued invoices
            determine payment obligations.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr>
                  <th className="py-2">Role</th>
                  <th>Interviews</th>
                  <th>Usage amount</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line, index) => (
                  <tr
                    key={String(line.role_id ?? index)}
                    className="border-t"
                    style={{ borderColor: "var(--as-border)" }}
                  >
                    <td className="py-2">
                      {String(line.role_title ?? "Role")}
                    </td>
                    <td>{count(line.quantity)}</td>
                    <td>{hasPricedUsage([line]) ? moneyCents(line.amount_cents) : "Price unavailable"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!lines.length && (
            <p className="text-sm">
              No priced usage recorded for this period. An unconfigured price is
              not a free-interview offer.
            </p>
          )}
          <h3 className="text-sm font-bold mt-4">Usage invoice history</h3>
          {invoices.length ? (
            <ul className="text-sm space-y-2 mt-2">
              {invoices.map((invoice, index) => (
                <li key={String(invoice.batch_id ?? invoice.stripe_invoice_id ?? index)}>
                  {invoice.period_start != null
                    ? membershipTermEndDate(invoice.period_start, "agreement_date")
                    : date(invoice.billed_at)} ·{" "}
                  {moneyCents(invoice.amount_cents)} ·{" "}
                  {count(invoice.interviews)} interviews · {usageInvoiceStatusLabel(invoice.billing_status)}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm mt-2">No usage invoices recorded.</p>
          )}
        </>
      )}
      {model === "fixed" && (
        <p className="text-sm">
          Interview allowances belong to individual roles. See Roles for each
          role’s remaining allowance.
        </p>
      )}
    </section>
  );
}
