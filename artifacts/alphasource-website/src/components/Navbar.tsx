import { useState, useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { Link, useLocation } from "wouter";
import { Check, KeyRound, LogIn, Menu, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useAppearance } from "@/context/AppearanceContext";
import { PASSKEYS_ENABLED, supabase } from "@/lib/supabaseClient";
import { buildPwResetUrl } from "@/lib/urlConfig";
import { alphaSourceLogo, alphaSourceLogoDark } from "@/assets/branding";
import AppearanceSelector from "@/components/AppearanceSelector";

export default function Navbar() {
  const isValidEmail = (value: string) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());

  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailError, setEmailError] = useState("");
  const [resetError, setResetError] = useState("");
  const [resetSuccess, setResetSuccess] = useState("");
  const [passkeyNotice, setPasskeyNotice] = useState("");
  const [setupSpotlightVisible, setSetupSpotlightVisible] = useState(false);
  const [location, setLocation] = useLocation();
  const setupSpotlightDescriptionId = useId();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const signInInFlightRef = useRef(false);
  const { login, loginWithPasskey, clientLoginLoading, clientLoginError } = useAuth();
  const { resolvedMode } = useAppearance();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setLoginOpen(false);
      }
    };
    if (loginOpen) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [loginOpen]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search || "");
    const normalizedPath = window.location.pathname.replace(/\/+$/, "") || "/";
    setSetupSpotlightVisible(normalizedPath === "/" && params.get("setup") === "complete");
  }, [location]);

  useEffect(() => {
    if (!setupSpotlightVisible || typeof window === "undefined") return undefined;

    const timer = window.setTimeout(() => setSetupSpotlightVisible(false), 3000);
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSetupSpotlightVisible(false);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [setupSpotlightVisible]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (signInInFlightRef.current || clientLoginLoading) return;

    setResetError("");
    setResetSuccess("");
    setPasskeyNotice("");
    const normalizedEmail = email.trim();
    if (!normalizedEmail || !password) return;
    if (!isValidEmail(normalizedEmail)) {
      setEmailError("Please enter a valid email address.");
      return;
    }
    setEmailError("");

    signInInFlightRef.current = true;
    const { error } = await login(normalizedEmail, password);
    signInInFlightRef.current = false;
    if (error) return;

    setLoginOpen(false);
    setMobileOpen(false);
    const next = new URL(window.location.href).searchParams.get("next");
    setLocation(next || "/dashboard");
  };

  const handlePasskeySignIn = async () => {
    if (signInInFlightRef.current || clientLoginLoading) return;
    setEmailError("");
    setResetError("");
    setResetSuccess("");
    setPasskeyNotice("");
    signInInFlightRef.current = true;
    const { error, cancelled } = await loginWithPasskey();
    signInInFlightRef.current = false;
    if (cancelled) {
      setPasskeyNotice("Passkey sign-in was cancelled. You can try again or use your password.");
      return;
    }
    if (error) return;
    setLoginOpen(false);
    setMobileOpen(false);
    const next = new URL(window.location.href).searchParams.get("next");
    setLocation(next || "/dashboard");
  };

  const startReset = async () => {
    setResetError("");
    setResetSuccess("");

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

    const redirectTo = buildPwResetUrl({ origin: "client" });
    const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
      redirectTo,
    });

    if (error) {
      setResetError(`Could not start reset: ${error.message}`);
      return;
    }
    setResetSuccess("Check your email for a password reset link.");
  };

  const navLinks = [
    { label: "Home", href: "/" },
    { label: "About", href: "/about/" },
    { label: "alphaScreen", href: "/alphascreen" },
    { label: "How It Works", href: "/alphascreen/how-it-works" },
    { label: "Get in Touch", href: "/#contact" },
    { label: "FAQ", href: "/faq" },
  ];
  const pageDimOverlay = setupSpotlightVisible && typeof document !== "undefined"
    ? createPortal(
        <button
          type="button"
          aria-label="Dismiss sign-in guidance"
          className="fixed inset-0 z-40 cursor-default bg-slate-900/35 backdrop-grayscale"
          onClick={() => setSetupSpotlightVisible(false)}
        />,
        document.body,
      )
    : null;

  return (
    <>
      {pageDimOverlay}
      <nav
        className={`fixed top-0 left-0 right-0 z-50 overflow-visible transition-all duration-300 ${
          scrolled
            ? "bg-white/95 backdrop-blur-md shadow-sm border-b border-[#DCE3F3] dark:bg-[#070E36]/95 dark:border-[#2A3568]"
            : "bg-white/90 backdrop-blur-sm border-b border-transparent dark:bg-[#070E36]/90"
        }`}
      >
        {setupSpotlightVisible && (
          <button
            type="button"
            aria-label="Dismiss sign-in guidance"
            className="absolute inset-0 z-10 cursor-default bg-slate-900/30 backdrop-grayscale"
            onClick={() => setSetupSpotlightVisible(false)}
          />
        )}
        <div className="max-w-[1440px] mx-auto px-6 lg:px-10 xl:px-[72px]">
          <div className="flex items-center justify-between h-[88px]">
            {/* Logo */}
            <Link
              href="/"
              className="flex items-center gap-0"
              data-testid="nav-logo"
            >
              <img
                src={
                  resolvedMode === "dark"
                    ? alphaSourceLogoDark
                    : alphaSourceLogo
                }
                alt="alphaSource AI"
                className="h-10 w-auto"
              />
            </Link>

            {/* Desktop Links */}
            <div className="hidden xl:flex items-center gap-2">
              {navLinks.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  className={`px-2.5 py-2 text-[13px] xl:px-3 xl:text-sm font-semibold rounded-lg transition-colors ${
                    location === link.href
                      ? "text-[#A380F6]"
                      : "text-[#0A1547] hover:text-[#A380F6] dark:text-white/80 dark:hover:text-[#A380F6]"
                  }`}
                  data-testid={`nav-link-${link.label.toLowerCase().replace(/\s+/g, "-")}`}
                  data-analytics-cta={link.label}
                data-analytics-placement="primary-nav"
              >
                {link.label}
              </a>
            ))}
          </div>

            {/* Log In button + popout */}
            <div
              className={`${setupSpotlightVisible ? "relative z-30 flex" : "hidden"} items-center gap-3 xl:flex`}
              ref={dropdownRef}
            >
              <AppearanceSelector />
              <div className="relative">
                <button
                  onClick={() => {
                    if (setupSpotlightVisible) setSetupSpotlightVisible(false);
                    setLoginOpen(!loginOpen);
                  }}
                  className={`relative h-10 px-4 text-sm font-semibold text-[#0A1547] border rounded-full transition-all duration-200 hover:border-[#A380F6] hover:text-[#A380F6] hover:shadow-sm active:scale-95 flex items-center gap-2 sm:px-5 dark:text-white dark:hover:text-[#A380F6] ${
                    setupSpotlightVisible
                      ? "border-[#A380F6] bg-white shadow-[0_0_0_6px_rgba(163,128,246,0.22),0_12px_28px_rgba(10,21,71,0.16)] dark:bg-[#111E57]"
                      : "border-[#0A1547]/15 bg-white dark:border-[#A380F6]/45 dark:bg-[#111E57]"
                  }`}
                  data-testid="nav-login-button"
                  aria-describedby={
                    setupSpotlightVisible
                      ? setupSpotlightDescriptionId
                      : undefined
                  }
                >
                  <LogIn aria-hidden="true" className="h-3.5 w-3.5" />
                  Sign In
                </button>

              {setupSpotlightVisible && (
                <div
                  role="status"
                  id={setupSpotlightDescriptionId}
                  className="absolute right-0 top-full z-40 mt-3 w-72 rounded-lg border border-[#A380F6]/35 bg-white p-4 shadow-xl sm:w-80"
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[#02D99D]/10 text-[#02D99D]">
                        <Check
                          aria-hidden="true"
                          className="h-4 w-4"
                          strokeWidth={2.5}
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-black leading-snug text-[#0A1547]">
                          Your password is set.
                        </p>
                        <p className="mt-1 text-xs font-semibold leading-relaxed text-[#0A1547]/65">
                          Use Sign In to access your alphaScreen dashboard.
                        </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSetupSpotlightVisible(false)}
                        className="inline-flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border border-[#0A1547]/10 text-[#0A1547]/55 transition-colors hover:border-[#A380F6] hover:text-[#A380F6] focus:outline-none focus:ring-2 focus:ring-[#A380F6]"
                        aria-label="Dismiss sign-in guidance"
                      >
                        <X aria-hidden="true" className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                )}

                {loginOpen && (
                  <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-2xl shadow-xl border border-gray-100 p-6 z-50 dark:bg-[#111E57] dark:border-[#2A3568]">
                    <div className="mb-5">
                      <h3 className="text-base font-black text-[#0A1547] mb-1 dark:text-white">
                        Sign In to alphaSource
                      </h3>
                      <p className="text-xs text-[#0A1547]/50 dark:text-white/55">
                        Access your client dashboard
                      </p>
                    </div>

                    <form onSubmit={handleSignIn} className="space-y-3">
                    <input
                      type="email"
                      placeholder="Email address"
                      value={email}
                      onChange={(e) => {
                          setEmail(e.target.value);
                          setEmailError("");
                        }}
                        className="w-full px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-[#0A1547] text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#A380F6]/30 focus:border-[#A380F6] transition-all dark:bg-[#0D1A4A] dark:border-[#2A3568] dark:text-white dark:placeholder:text-white/35"
                      />
                      <input
                        type="password"
                        placeholder="Password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-[#0A1547] text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#A380F6]/30 focus:border-[#A380F6] transition-all dark:bg-[#0D1A4A] dark:border-[#2A3568] dark:text-white dark:placeholder:text-white/35"
                      />
                      <button
                        type="submit"
                      disabled={clientLoginLoading || !email || !password}
                      className="w-full py-2.5 text-sm font-semibold text-white rounded-full transition-all hover:opacity-90 active:scale-[0.99]"
                      style={{ backgroundColor: "#A380F6" }}
                    >
                      {clientLoginLoading ? "Signing in..." : "Sign In"}
                    </button>
                    <button
                        type="button"
                        onClick={startReset}
                        className="text-xs text-[#A380F6] hover:underline"
                        style={{
                          background: "none",
                          border: "none",
                          padding: 0,
                          cursor: "pointer",
                          font: "inherit",
                        }}
                      >
                        Forgot password?
                      </button>
                    </form>
                    {PASSKEYS_ENABLED && (
                      <>
                        <div className="my-4 flex items-center gap-3 text-[10px] font-bold uppercase tracking-wider text-[#0A1547]/35 dark:text-white/35">
                          <span className="h-px flex-1 bg-[#0A1547]/10 dark:bg-white/10" />or<span className="h-px flex-1 bg-[#0A1547]/10 dark:bg-white/10" />
                        </div>
                        <button type="button" disabled={clientLoginLoading} onClick={() => void handlePasskeySignIn()} className="flex w-full items-center justify-center gap-2 rounded-full border border-[#A380F6]/40 px-4 py-2.5 text-sm font-semibold text-[#0A1547] transition-colors hover:border-[#A380F6] hover:text-[#A380F6] disabled:opacity-50 dark:text-white dark:hover:text-[#A380F6]">
                          <KeyRound className="h-4 w-4" />
                          Sign in with a passkey
                        </button>
                      </>
                    )}
                    {clientLoginError && (
                      <p className="mt-2 text-xs text-red-500">
                        {clientLoginError}
                      </p>
                    )}
                    {passkeyNotice && (
                      <p role="status" className="mt-2 text-xs text-[#0A1547]/60 dark:text-white/65">
                        {passkeyNotice}
                      </p>
                    )}
                    {emailError && (
                      <p className="mt-2 text-xs text-red-500">{emailError}</p>
                  )}
                  {resetError && (
                      <p className="mt-2 text-xs text-red-500">{resetError}</p>
                    )}
                    {resetSuccess && (
                      <p className="mt-2 text-xs text-[#02D99D]">
                        {resetSuccess}
                      </p>
                    )}

                    <p className="mt-4 text-center text-xs text-[#0A1547]/40 dark:text-white/45">
                      Need access?{" "}
                      <a
                        href="/#contact"
                        className="text-[#A380F6] hover:underline"
                        onClick={() => setLoginOpen(false)}
                      >
                        Get in touch
                      </a>
                    </p>
                </div>
              )}
            </div>
          </div>

            {/* Mobile hamburger */}
            <button
              className={`xl:hidden p-2 rounded-lg text-[#0A1547] dark:text-white ${setupSpotlightVisible ? "hidden" : ""}`}
              onClick={() => setMobileOpen(!mobileOpen)}
              data-testid="nav-mobile-menu-button"
              aria-label="Toggle menu"
            >
              {mobileOpen ? (
                <X aria-hidden="true" className="h-[22px] w-[22px]" />
              ) : (
                <Menu aria-hidden="true" className="h-[22px] w-[22px]" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="xl:hidden bg-white border-t border-gray-100 px-6 py-4 space-y-1 dark:bg-[#070E36] dark:border-[#2A3568]">
            <div className="mb-3 px-3">
              <AppearanceSelector alwaysShowLabel />
            </div>
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="block px-3 py-2.5 text-sm font-medium text-[#0A1547] hover:text-[#A380F6] hover:bg-purple-50 rounded-lg transition-colors dark:text-white/80 dark:hover:bg-white/5 dark:hover:text-[#A380F6]"
                onClick={() => setMobileOpen(false)}
                data-analytics-cta={link.label}
                data-analytics-placement="mobile-nav"
            >
                {link.label}
              </a>
            ))}
            <div className="pt-3 border-t border-gray-100 mt-3 dark:border-[#2A3568]">
              <p className="text-xs font-semibold text-[#0A1547]/40 uppercase tracking-wider mb-3 px-3 dark:text-white/45">
                Client Login
              </p>
              <form onSubmit={handleSignIn} className="space-y-2 px-3">
                <input
                  type="email"
                placeholder="Email address"
                value={email}
                onChange={(e) => {
                    setEmail(e.target.value);
                    setEmailError("");
                  }}
                  className="w-full px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-[#0A1547] text-sm placeholder-gray-400 focus:outline-none dark:bg-[#0D1A4A] dark:border-[#2A3568] dark:text-white dark:placeholder:text-white/35"
                />
                <input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-[#0A1547] text-sm placeholder-gray-400 focus:outline-none dark:bg-[#0D1A4A] dark:border-[#2A3568] dark:text-white dark:placeholder:text-white/35"
                />
                <button
                  type="submit"
                disabled={clientLoginLoading || !email || !password}
                className="w-full py-2.5 text-sm font-semibold text-white rounded-full"
                style={{ backgroundColor: "#A380F6" }}
              >
                {clientLoginLoading ? "Signing in..." : "Sign In"}
              </button>
              <button
                  type="button"
                  onClick={startReset}
                  className="text-xs text-[#A380F6] hover:underline"
                  style={{
                    background: "none",
                    border: "none",
                    padding: 0,
                    cursor: "pointer",
                    font: "inherit",
                  }}
                >
                  Forgot password?
                </button>
                {PASSKEYS_ENABLED && (
                  <button type="button" disabled={clientLoginLoading} onClick={() => void handlePasskeySignIn()} className="flex w-full items-center justify-center gap-2 rounded-full border border-[#A380F6]/40 px-4 py-2.5 text-sm font-semibold text-[#0A1547] dark:text-white">
                    <KeyRound className="h-4 w-4" />
                    Sign in with a passkey
                  </button>
                )}
              {clientLoginError && (
                <p className="text-xs text-red-500">{clientLoginError}</p>
              )}
              {passkeyNotice && (
                <p role="status" className="text-xs text-[#0A1547]/60 dark:text-white/65">{passkeyNotice}</p>
              )}
              {emailError && (
                <p className="text-xs text-red-500">{emailError}</p>
              )}
              {resetError && (
                <p className="text-xs text-red-500">{resetError}</p>
              )}
              {resetSuccess && (
                <p className="text-xs text-[#02D99D]">{resetSuccess}</p>
              )}
            </form>
          </div>
        </div>
      )}
    </nav>
    </>
  );
}
