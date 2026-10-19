import { useEffect, useState } from "react";
import { Switch } from "@/components/ui/switch";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

type Policy = { enabled: boolean; version: number; changed_at: string | null };
type Request = (path: string, body?: object) => Promise<unknown>;

function readPolicy(value: unknown): Policy {
  const policy = value as Policy;
  if (!policy || typeof policy.enabled !== "boolean" || !Number.isSafeInteger(policy.version) || policy.version < 0)
    throw new Error("Renewal commission settings are unavailable. Refresh before making a change.");
  return policy;
}

export default function SalesRenewalCommissionControl({ request }: { request: Request }) {
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [pending, setPending] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let current = true;
    void request("/renewal-commissions").then(value => { if (current) setPolicy(readPolicy(value)); })
      .catch(() => { if (current) setError("Renewal commission settings could not be loaded. Refresh this page to try again."); });
    return () => { current = false; };
  }, [request]);

  async function confirm() {
    if (!policy || pending === null || saving) return;
    setSaving(true); setError(""); setNotice("");
    try {
      const saved = readPolicy(await request("/renewal-commissions", {
        enabled: pending, expected_version: policy.version, confirmed: true,
      }));
      setPolicy(saved); setPending(null);
      setNotice(`Renewal commissions are ${saved.enabled ? "on" : "off"}. Recorded commissions were not changed.`);
    } catch (cause) {
      // An uncertain response must not be automatically retried or shown as saved.
      setPolicy(null); setPending(null);
      setError(`${cause instanceof Error ? cause.message : "The setting could not be confirmed."} Refresh to read the saved setting before trying again.`);
    } finally { setSaving(false); }
  }

  return <section className="rounded-2xl border p-5" style={{ backgroundColor: "var(--as-surface)", borderColor: "var(--as-border)" }}>
    <div className="flex items-start justify-between gap-4">
      <div><h2 id="renewal-commission-label" className="font-bold">Commission on renewals</h2>
        <p id="renewal-commission-description" className="mt-1 text-sm" style={{ color: "var(--as-text-muted)" }}>
          {policy ? (policy.enabled ? "On — eligible renewals can earn commission within the original first-year limit." : "Off — commission applies only to the initial membership term, including its monthly installments.") : "Loading renewal commission settings…"}
        </p>
        <p className="mt-2 text-xs" style={{ color: "var(--as-text-muted)" }}>Applies to new receipt approvals. Previously recorded commissions, adjustments, and locked statements stay unchanged. This does not change customer auto-renewal or send payments.</p>
      </div>
      <Switch checked={policy?.enabled ?? false} disabled={!policy || saving} aria-labelledby="renewal-commission-label" aria-describedby="renewal-commission-description" onCheckedChange={value => setPending(value)} />
    </div>
    {error && <p role="alert" className="mt-3 text-sm text-red-600">{error}</p>}
    {notice && <p role="status" className="mt-3 text-sm text-emerald-700">{notice}</p>}
    <AlertDialog open={pending !== null} onOpenChange={open => { if (!open && !saving) setPending(null); }}>
      <AlertDialogContent><AlertDialogHeader>
        <AlertDialogTitle>Turn renewal commissions {pending ? "on" : "off"}?</AlertDialogTitle>
        <AlertDialogDescription>
          {pending ? "Newly approved eligible renewal receipts can earn commission, subject to the existing original first-year and payment-verification limits." : "Newly approved renewal receipts will not earn commission. Payments within the initial membership term, including monthly installments, remain eligible."}
          {" "}Previously recorded commissions and locked statements will not change. Customer billing and auto-renewal are unaffected.
        </AlertDialogDescription>
      </AlertDialogHeader><AlertDialogFooter>
        <AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel>
        <AlertDialogAction disabled={saving} onClick={event => { event.preventDefault(); void confirm(); }}>{saving ? "Saving…" : `Confirm ${pending ? "on" : "off"}`}</AlertDialogAction>
      </AlertDialogFooter></AlertDialogContent>
    </AlertDialog>
  </section>;
}
