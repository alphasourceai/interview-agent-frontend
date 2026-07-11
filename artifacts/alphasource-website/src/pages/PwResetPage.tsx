import { FormEvent, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

const RESET_ORIGIN_STORAGE_KEY = "pwreset_origin";

type ResetOrigin = "admin" | "client" | "";

function readResetOrigin(): ResetOrigin {
  if (typeof window === "undefined") return "";
  try {
    const url = new URL(window.location.href);
    const originParam = String(url.searchParams.get("origin") || "").trim().toLowerCase();
    if (originParam === "admin" || originParam === "client") {
      try {
        window.localStorage.setItem(RESET_ORIGIN_STORAGE_KEY, originParam);
      } catch {
        // no-op
      }
      return originParam;
    }
  } catch {
    // no-op
  }

  try {
    const stored = String(window.localStorage.getItem(RESET_ORIGIN_STORAGE_KEY) || "").trim().toLowerCase();
    if (stored === "admin" || stored === "client") return stored;
  } catch {
    // no-op
  }
  return "";
}

export default function PwResetPage() {
  const [processing, setProcessing] = useState(true);
  const [readyForPassword, setReadyForPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const requestId = useMemo(() => {
    try {
      return crypto.randomUUID();
    } catch {
      return `pwreset_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    }
  }, []);

  const resetOrigin = useMemo(() => readResetOrigin(), []);
  const signInPath = resetOrigin === "admin" ? "/admin" : "/";
  const successRedirectPath = resetOrigin === "admin" ? "/admin" : "/?setup=complete";
  const signInLabel = resetOrigin === "admin" ? "Back to Admin Sign In" : "Back to Home";

  useEffect(() => {
    let alive = true;
    const url = new URL(window.location.href);
    const hashParams = new URLSearchParams((url.hash || "").replace(/^#/, ""));

    const code = url.searchParams.get("code");
    const tokenHash = url.searchParams.get("token_hash") || hashParams.get("token_hash");
    const typeParam = url.searchParams.get("type") || hashParams.get("type");
    const accessToken = hashParams.get("access_token");
    const refreshToken = hashParams.get("refresh_token");
    const hasTokenPair = Boolean(accessToken && refreshToken);

    const handleRecovery = async () => {
      try {
        if (code) {
          const { error: exchangeErr } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeErr) throw exchangeErr;
        } else if (hasTokenPair) {
          const { error: setSessionErr } = await supabase.auth.setSession({
            access_token: String(accessToken),
            refresh_token: String(refreshToken),
          });
          if (setSessionErr) throw setSessionErr;
        } else if (tokenHash) {
          const { error: verifyErr } = await supabase.auth.verifyOtp({
            type: (typeParam || "recovery") as "recovery",
            token_hash: tokenHash,
          });
          if (verifyErr) throw verifyErr;
        }

        const { data } = await supabase.auth.getSession();
        if (!alive) return;
        if (data?.session) {
          setReadyForPassword(true);
          setError("");
        } else {
          setError("Invalid or expired reset link.");
        }
      } catch {
        if (!alive) return;
        setError("Invalid or expired reset link.");
      } finally {
        if (alive) setProcessing(false);
      }
    };

    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (!alive) return;
      if (event === "PASSWORD_RECOVERY") {
        setReadyForPassword(true);
        setProcessing(false);
        setError("");
      }
    });

    void handleRecovery();

    return () => {
      alive = false;
      sub?.subscription?.unsubscribe();
    };
  }, [requestId]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSuccess("");
    setError("");

    if (!password || password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    try {
      const { error: updateErr } = await supabase.auth.updateUser({ password });
      if (updateErr) {
        setError(updateErr.message || "Could not update password.");
        return;
      }

      setSuccess("Password updated. Redirecting…");

      const cleanUrl = new URL(window.location.href);
      ["pwreset", "code", "token_hash", "type", "origin"].forEach((key) =>
        cleanUrl.searchParams.delete(key),
      );
      window.history.replaceState({}, "", cleanUrl.toString().split("#")[0]);

      try {
        window.localStorage.removeItem(RESET_ORIGIN_STORAGE_KEY);
      } catch {
        // no-op
      }

      await supabase.auth.signOut({ scope: "local" });
      window.setTimeout(() => {
        window.location.replace(successRedirectPath);
      }, 900);
    } catch {
      setError("Could not update password.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FD] flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div
          className="bg-white rounded-2xl p-7 sm:p-8"
          style={{ border: "1px solid rgba(10,21,71,0.08)", boxShadow: "0 20px 44px rgba(10,21,71,0.12)" }}
        >
          <div className="mb-6">
            <p className="text-[10px] font-black uppercase tracking-widest text-[#0A1547]/35 mb-1.5">
              Account Recovery
            </p>
            <h1 className="text-[24px] font-black text-[#0A1547] leading-tight">Set Your Password</h1>
            <p className="text-sm text-[#0A1547]/55 mt-2 leading-relaxed">
              Enter a new password to finish account recovery and continue to your dashboard.
            </p>
          </div>

          {processing && (
            <div className="text-sm font-medium text-[#0A1547]/60 mb-4">Preparing your reset link…</div>
          )}

          {!!error && (
            <div
              className="mb-4 px-3.5 py-2.5 rounded-xl text-sm font-semibold"
              style={{
                border: "1px solid rgba(239,68,68,0.25)",
                backgroundColor: "rgba(239,68,68,0.08)",
                color: "#DC2626",
              }}
            >
              {error}
            </div>
          )}

          {!!success && (
            <div
              className="mb-4 px-3.5 py-2.5 rounded-xl text-sm font-semibold"
              style={{
                border: "1px solid rgba(2,217,157,0.25)",
                backgroundColor: "rgba(2,217,157,0.10)",
                color: "#047857",
              }}
            >
              {success}
            </div>
          )}

          {!processing && readyForPassword && !error && (
            <form onSubmit={handleSubmit} className="space-y-3.5">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-[#0A1547]/40 mb-1.5">
                  New Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl text-sm text-[#0A1547] font-medium border border-[rgba(10,21,71,0.10)] bg-white focus:outline-none focus:border-[#A380F6] transition-colors"
                  autoComplete="new-password"
                  required
                />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-[#0A1547]/40 mb-1.5">
                  Confirm Password
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl text-sm text-[#0A1547] font-medium border border-[rgba(10,21,71,0.10)] bg-white focus:outline-none focus:border-[#A380F6] transition-colors"
                  autoComplete="new-password"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full mt-1 px-4 py-2.5 rounded-full text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                style={{ backgroundColor: "#A380F6" }}
              >
                {submitting ? "Updating..." : "Update Password"}
              </button>
            </form>
          )}

          {!processing && !readyForPassword && !error && (
            <div className="text-sm text-[#0A1547]/60">Waiting for recovery session…</div>
          )}

          <div className="mt-5 pt-4 border-t border-gray-100">
            <a
              href={signInPath}
              className="text-sm font-semibold text-[#A380F6] hover:underline"
            >
              {signInLabel}
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
