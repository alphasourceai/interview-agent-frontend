import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { useTrackingConsent } from "@/context/TrackingConsentContext";
import { supabase } from "@/lib/supabaseClient";
import { buildPwResetUrl } from "@/lib/urlConfig";
import {
  AI_SUPPORT_PHONE_DISPLAY,
  AI_SUPPORT_PHONE_LABEL,
  AI_SUPPORT_PHONE_URI,
} from "@/lib/supportContact";
import { alphaSourceLogoDark } from "@/assets/branding";

const EXPLORE_LINKS = [
  { label: "Home", href: "/" },
  { label: "About Us", href: "/about" },
  { label: "alphaScreen", href: "/alphascreen" },
  { label: "Pricing", href: "/alphascreen/pricing" },
  { label: "FAQ", href: "/faq" },
  { label: "Support", href: "/support" },
];

const PRODUCT_LINKS = [
  { label: "How It Works", href: "/alphascreen/how-it-works" },
  { label: "Security", href: "/alphascreen/security" },
  { label: "Candidate Experience", href: "/alphascreen/candidate-experience" },
  { label: "Dental Groups", href: "/alphascreen/for-dental-groups" },
  { label: "ROI Estimator", href: "/alphascreen/roi" },
];

export default function Footer() {
  const isValidEmail = (value: string) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());

  const [adminLoginOpen, setAdminLoginOpen] = useState(false);
  const [email, setEmail]                   = useState("");
  const [password, setPassword]             = useState("");
  const [emailError, setEmailError]         = useState("");
  const [resetError, setResetError]         = useState("");
  const [resetSuccess, setResetSuccess]     = useState("");
  const dropdownRef                         = useRef<HTMLDivElement>(null);
  const { loginAdmin, adminLoginLoading, adminLoginError, clearAdminLoginError } = useAuth();
  const { openTrackingPreferences } = useTrackingConsent();
  const [location, setLocation]             = useLocation();
  const normalizedPath = String(location || "/").split("?")[0].replace(/\/$/, "") || "/";
  const showPatentNotice =
    normalizedPath !== "/" &&
    !normalizedPath.startsWith("/checkout") &&
    !normalizedPath.startsWith("/membership-agreement");

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setAdminLoginOpen(false);
      }
    };
    if (adminLoginOpen) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [adminLoginOpen]);

  const handleAdminSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError("");
    setResetSuccess("");
    const normalizedEmail = email.trim();
    if (!normalizedEmail || !password) {
      setEmailError("Email and password are required.");
      clearAdminLoginError();
      return;
    }
    if (!isValidEmail(normalizedEmail)) {
      setEmailError("Please enter a valid email address.");
      clearAdminLoginError();
      return;
    }
    setEmailError("");
    const { error } = await loginAdmin(normalizedEmail, password);
    if (error) return;
    setAdminLoginOpen(false);
    setLocation("/admin");
  };

  const startAdminReset = async () => {
    setResetError("");
    setResetSuccess("");
    clearAdminLoginError();

    const normalizedEmail = email.trim();
    if (!normalizedEmail) {
      setResetError("Enter your email first.");
      return;
    }
    if (!isValidEmail(normalizedEmail)) {
      setEmailError("Please enter a valid email address.");
      return;
    }
    setEmailError("");

    const redirectTo = buildPwResetUrl({ origin: "admin" });
    const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
      redirectTo,
    });
    if (error) {
      setResetError(`Could not start reset: ${error.message}`);
      return;
    }

    setResetSuccess("Check your email for a password reset link.");
  };

  return (
    <footer className="border-t border-[#A380F6]/25 bg-[#070E36] text-white">
      <div className="mx-auto max-w-7xl px-6 py-14 lg:px-8">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-[1.25fr_0.72fr_0.92fr_1.05fr] lg:gap-12">
          {/* Brand */}
          <div>
            <div className="mb-4">
              <img src={alphaSourceLogoDark} alt="alphaSource AI" className="h-9 w-auto" />
            </div>
            <p className="max-w-xs text-sm leading-relaxed text-white/60">
              Agentic AI that enhances human judgment — helping teams reclaim time and spot potential in every talent interaction.
            </p>
            <div className="flex gap-3 mt-6">
              <a
                href="https://www.linkedin.com/company/alphasourceai"
                target="_blank"
                rel="noopener noreferrer"
                className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center hover:bg-[#A380F6]/30 transition-colors"
                aria-label="LinkedIn"
              >
                <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                </svg>
              </a>
              <a
                href="https://www.facebook.com/alphasourceai"
                target="_blank"
                rel="noopener noreferrer"
                className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center hover:bg-[#A380F6]/30 transition-colors"
                aria-label="Facebook"
              >
                <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.414c0-3.025 1.792-4.697 4.533-4.697 1.312 0 2.686.236 2.686.236v2.971h-1.513c-1.491 0-1.956.931-1.956 1.886v2.263h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z"/>
                </svg>
              </a>
            </div>
          </div>

          {/* Explore links */}
          <div>
            <h4 className="mb-4 text-[11px] font-black uppercase tracking-[0.16em] text-[#A380F6]">Explore</h4>
            <ul className="space-y-3">
              {EXPLORE_LINKS.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    className="text-sm font-medium text-white/70 transition-colors hover:text-[#A380F6]"
                    data-analytics-cta={link.label}
                    data-analytics-placement="footer"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Product links */}
          <div>
            <h4 className="mb-4 text-[11px] font-black uppercase tracking-[0.16em] text-[#A380F6]">Product</h4>
            <ul className="space-y-3">
              {PRODUCT_LINKS.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    className="text-sm font-medium text-white/70 transition-colors hover:text-[#A380F6]"
                    data-analytics-cta={link.label}
                    data-analytics-placement="footer"
                  >
                    {link.label}
                </a>
              </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <div className="space-y-7">
              <div>
                <p className="mb-2 text-[11px] font-black uppercase tracking-[0.16em] text-[#A380F6]">Email us</p>
                <a href="mailto:info@alphasourceai.com" className="text-sm font-semibold text-white transition-colors hover:text-[#A380F6]">
                  info@alphasourceai.com
                </a>
              </div>
              <div>
                <p className="mb-2 text-[11px] font-black uppercase tracking-[0.16em] text-[#A380F6]">AI Customer Support</p>
                <a
                  href={AI_SUPPORT_PHONE_URI}
                  aria-label={AI_SUPPORT_PHONE_LABEL}
                  className="inline-flex min-h-6 items-center whitespace-nowrap text-sm font-semibold text-white transition-colors hover:text-[#A380F6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A380F6]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#070E36]"
                >
                  {AI_SUPPORT_PHONE_DISPLAY}
                </a>
              </div>
              <a
                href="/#contact"
                className="inline-flex text-sm font-bold text-[#A380F6] transition-colors hover:text-white"
                data-analytics-cta="Request a Demo"
                data-analytics-placement="footer-contact"
              >
                Request a Demo →
              </a>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-8 sm:flex-row">
          <div className="text-center sm:text-left">
            <p className="text-white/40 text-sm">
              &copy; {new Date().getFullYear()} alphaSource AI. All rights reserved.
            </p>
            {showPatentNotice ? (
              <p className="mt-1.5 text-xs font-semibold tracking-[0.02em] text-white/50">
                alphaScreen technology — Patent Pending
              </p>
            ) : null}
          </div>
          <div className="flex items-center gap-6">
            <a href="/privacy/" className="text-white/40 text-sm hover:text-white/70 transition-colors">
              Privacy Policy
            </a>
            <button
              type="button"
              onClick={openTrackingPreferences}
              className="text-white/40 text-sm hover:text-white/70 transition-colors"
            >
              Privacy choices
            </button>
            <a href="/terms/" className="text-white/40 text-sm hover:text-white/70 transition-colors">
              Terms &amp; Conditions
            </a>

            {/* Admin Login */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => {
                  setAdminLoginOpen((o) => !o);
                  setEmailError("");
                  setResetError("");
                  setResetSuccess("");
                  clearAdminLoginError();
                }}
                className="text-white/25 text-xs hover:text-white/50 transition-colors font-semibold"
              >
                Admin Login
              </button>

              {adminLoginOpen && (
                <div
                  className="absolute right-0 bottom-full mb-3 w-72 bg-white rounded-2xl shadow-2xl border border-gray-100 p-5 z-50"
                  style={{ fontFamily: "'Raleway', sans-serif" }}
                >
                  {/* Small arrow pointing down */}
                  <div
                    className="absolute bottom-[-6px] right-4 w-3 h-3 bg-white border-b border-r border-gray-100 rotate-45"
                  />
                  <div className="mb-4">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-sm font-black text-[#0A1547]">Admin Sign In</h3>
                      <span
                        className="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full"
                        style={{ backgroundColor: "rgba(163,128,246,0.12)", color: "#7C5FCC" }}
                      >
                        Admin
                      </span>
                    </div>
                    <p className="text-[10px] text-[#0A1547]/45">Access the alphaSource admin dashboard</p>
                  </div>

                  <form onSubmit={handleAdminSignIn} className="space-y-2.5">
                    <input
                      type="email"
                      placeholder="Email address"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        setEmailError("");
                        setResetError("");
                        setResetSuccess("");
                        clearAdminLoginError();
                      }}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-[#0A1547] text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#A380F6]/25 focus:border-[#A380F6] transition-all"
                    />
                    <input
                      type="password"
                      placeholder="Password"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        clearAdminLoginError();
                      }}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-[#0A1547] text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#A380F6]/25 focus:border-[#A380F6] transition-all"
                    />
                    <button
                      type="submit"
                      disabled={adminLoginLoading}
                      className="w-full py-2.5 text-sm font-bold text-white rounded-full transition-all hover:opacity-90 active:scale-[0.99]"
                      style={{ backgroundColor: "#A380F6" }}
                    >
                      {adminLoginLoading ? "Signing in..." : "Sign In"}
                    </button>
                    <button
                      type="button"
                      onClick={startAdminReset}
                      className="text-xs text-[#A380F6] hover:underline text-left"
                      style={{ background: "none", border: "none", padding: 0, cursor: "pointer", font: "inherit" }}
                    >
                      Forgot password?
                    </button>
                  </form>
                  {emailError && (
                    <p className="mt-2 text-xs text-red-500">{emailError}</p>
                  )}
                  {adminLoginError && (
                    <p className="mt-2 text-xs text-red-500">{adminLoginError}</p>
                  )}
                  {resetError && (
                    <p className="mt-2 text-xs text-red-500">{resetError}</p>
                  )}
                  {resetSuccess && (
                    <p className="mt-2 text-xs text-[#02D99D]">{resetSuccess}</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
