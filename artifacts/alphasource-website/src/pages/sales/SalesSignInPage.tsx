import { useRef, useState } from "react";
import { ArrowRight, LockKeyhole } from "lucide-react";
import DashboardBrand from "@/components/DashboardBrand";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabaseClient";
import { buildPwResetUrl } from "@/lib/urlConfig";
import { useLocation } from "wouter";

export default function SalesSignInPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [resetMode, setResetMode] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState("");
  const [resetSent, setResetSent] = useState(false);
  const resetInFlightRef = useRef(false);
  const { loginSales, salesLoginLoading, salesLoginError } = useAuth();
  const [, setLocation] = useLocation();

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (resetMode) {
      if (resetInFlightRef.current || resetSent) return;
      const normalizedEmail = email.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
        setResetError("Enter a valid work email.");
        return;
      }
      resetInFlightRef.current = true;
      setResetLoading(true);
      setResetError("");
      try {
        const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
          redirectTo: buildPwResetUrl({ origin: "sales" }),
        });
        if (error) throw error;
        setResetSent(true);
      } catch {
        setResetError("Could not request a reset right now. Please try again shortly.");
      } finally {
        resetInFlightRef.current = false;
        setResetLoading(false);
      }
      return;
    }
    const result = await loginSales(email, password);
    if (!result.error) setLocation("/sales/home");
  };

  return (
    <div className="min-h-screen bg-[#F4F6FB] px-4 py-10" style={{ fontFamily: "'Raleway', sans-serif" }}>
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-md items-center">
        <div className="w-full rounded-2xl border border-[#0A1547]/[0.07] bg-white p-6 shadow-[0_24px_70px_rgba(10,21,71,0.10)] sm:p-8">
          <DashboardBrand mode="light" variant="full" />
          <div className="mt-8 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-[#A380F6]">
            <LockKeyhole className="h-3.5 w-3.5" /> Sales workspace
          </div>
          <h1 className="mt-3 text-2xl font-black tracking-[-0.03em] text-[#0A1547]">{resetMode ? "Reset your password" : "Sign in to continue"}</h1>
          <p className="mt-2 text-sm font-semibold leading-relaxed text-[#0A1547]/50">{resetMode ? "Enter your work email. If it has an account, we’ll send a reset link." : "Use your authorized alphaSource work email and password."}</p>

          <form onSubmit={submit} className="mt-7 space-y-4">
            <label className="block text-xs font-black text-[#0A1547]">
              Work email
              <input type="email" required autoComplete="email" value={email} onChange={(event) => { setEmail(event.target.value); setResetSent(false); setResetError(""); }} className="mt-2 h-11 w-full rounded-[10px] border border-[#0A1547]/10 px-3.5 text-sm font-semibold outline-none transition focus:border-[#A380F6] focus:ring-4 focus:ring-[#A380F6]/10" placeholder="name@alphasourceai.com" />
            </label>
            {!resetMode ? <label className="block text-xs font-black text-[#0A1547]">
              Password
              <input type="password" required autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} className="mt-2 h-11 w-full rounded-[10px] border border-[#0A1547]/10 px-3.5 text-sm font-semibold outline-none transition focus:border-[#A380F6] focus:ring-4 focus:ring-[#A380F6]/10" />
            </label> : null}
            {!resetMode && salesLoginError ? <p role="alert" className="rounded-[10px] border border-red-200 bg-red-50 px-3 py-2.5 text-xs font-bold text-red-700">{salesLoginError}</p> : null}
            {resetMode && resetError ? <p role="alert" className="rounded-[10px] border border-red-200 bg-red-50 px-3 py-2.5 text-xs font-bold text-red-700">{resetError}</p> : null}
            {resetMode && resetSent ? <p role="status" className="rounded-[10px] border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs font-bold text-emerald-800">If this email has an account, a reset link is on its way.</p> : null}
            <button type="submit" disabled={salesLoginLoading || resetLoading || (resetMode && resetSent)} className="flex h-11 w-full items-center justify-center gap-2 rounded-[10px] bg-[#0A1547] text-sm font-black text-white transition hover:bg-[#111f5f] disabled:cursor-not-allowed disabled:opacity-55">
              {resetMode ? (resetLoading ? "Requesting…" : "Send reset link") : (salesLoginLoading ? "Verifying access…" : "Sign in")}
              {!salesLoginLoading && !resetLoading ? <ArrowRight className="h-4 w-4" /> : null}
            </button>
            <button type="button" disabled={resetLoading} onClick={() => { setResetMode(!resetMode); setResetError(""); setResetSent(false); }} className="text-xs font-bold text-[#7251c5] hover:underline disabled:cursor-not-allowed disabled:opacity-55">
              {resetMode ? "Back to sales sign in" : "Forgot password?"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
