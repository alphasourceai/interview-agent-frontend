import { isGuardedPricingDev, isDevBillingSandbox, guardedPricingDevMessage } from "@/lib/guardedPricingDev";

export default function GuardedPricingDevBanner() {
  if (!isGuardedPricingDev) return null;
  return (
    <aside role="status" className="fixed bottom-3 left-3 right-3 z-[100] mx-auto max-w-3xl rounded-xl border border-[#A380F6]/40 bg-[#0A1547] px-4 py-3 text-white shadow-lg print:hidden">
      <p className="text-xs font-black uppercase tracking-wider text-[#C7B4FC]">{isDevBillingSandbox ? "Dev Sandbox billing test · no live payments" : "Dev pricing preview · no live payments"}</p>
      <p className="mt-1 text-xs leading-relaxed">{guardedPricingDevMessage}</p>
    </aside>
  );
}
