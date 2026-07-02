import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabaseClient";
import { buildPwResetUrl } from "@/lib/urlConfig";

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
  const [location, setLocation] = useLocation();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const signInInFlightRef = useRef(false);
  const { login, clientLoginLoading, clientLoginError } = useAuth();

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

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (signInInFlightRef.current || clientLoginLoading) return;

    setResetError("");
    setResetSuccess("");
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
    { label: "About", href: "/about" },
    { label: "alphaScreen", href: "/alphascreen" },
    { label: "How It Works", href: "/alphascreen/how-it-works" },
    { label: "Get in Touch", href: "/#contact" },
    { label: "FAQ", href: "/faq" },
  ];

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-white/95 backdrop-blur-md shadow-sm border-b border-gray-100"
          : "bg-white/80 backdrop-blur-sm"
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-0" data-testid="nav-logo">
            <img
              src="/logo-dark-text-clear.png"
              alt="alphaSource AI"
              className="h-8 w-auto"
            />
          </Link>

          {/* Desktop Links */}
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                  location === link.href
                    ? "text-[#A380F6]"
                    : "text-[#0A1547] hover:text-[#A380F6]"
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
          <div className="hidden md:flex items-center gap-3" ref={dropdownRef}>
            <div className="relative">
              <button
                onClick={() => setLoginOpen(!loginOpen)}
                className="px-5 py-2.5 text-sm font-semibold text-[#0A1547] border border-[#0A1547]/15 rounded-full transition-all duration-200 hover:border-[#A380F6] hover:text-[#A380F6] hover:shadow-sm active:scale-95 flex items-center gap-2"
                data-testid="nav-login-button"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/>
                  <polyline points="10 17 15 12 10 7"/>
                  <line x1="15" y1="12" x2="3" y2="12"/>
                </svg>
                Log In
              </button>

              {loginOpen && (
                <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-2xl shadow-xl border border-gray-100 p-6 z-50">
                  <div className="mb-5">
                    <h3 className="text-base font-black text-[#0A1547] mb-1">Sign In to alphaSource</h3>
                    <p className="text-xs text-[#0A1547]/50">Access your client dashboard</p>
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
                      className="w-full px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-[#0A1547] text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#A380F6]/30 focus:border-[#A380F6] transition-all"
                    />
                    <input
                      type="password"
                      placeholder="Password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-[#0A1547] text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#A380F6]/30 focus:border-[#A380F6] transition-all"
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
                      style={{ background: "none", border: "none", padding: 0, cursor: "pointer", font: "inherit" }}
                    >
                      Forgot password?
                    </button>
                  </form>
                  {clientLoginError && (
                    <p className="mt-2 text-xs text-red-500">{clientLoginError}</p>
                  )}
                  {emailError && (
                    <p className="mt-2 text-xs text-red-500">{emailError}</p>
                  )}
                  {resetError && (
                    <p className="mt-2 text-xs text-red-500">{resetError}</p>
                  )}
                  {resetSuccess && (
                    <p className="mt-2 text-xs text-[#02D99D]">{resetSuccess}</p>
                  )}

                  <p className="mt-4 text-center text-xs text-[#0A1547]/40">
                    Need access?{" "}
                    <a href="/#contact" className="text-[#A380F6] hover:underline" onClick={() => setLoginOpen(false)}>
                      Get in touch
                    </a>
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Mobile hamburger */}
          <button
            className="md:hidden p-2 rounded-lg text-[#0A1547]"
            onClick={() => setMobileOpen(!mobileOpen)}
            data-testid="nav-mobile-menu-button"
            aria-label="Toggle menu"
          >
            <svg width="22" height="22" fill="none" viewBox="0 0 24 24">
              {mobileOpen ? (
                <path
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeWidth="2"
                  d="M6 6l12 12M6 18L18 6"
                />
              ) : (
                <path
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeWidth="2"
                  d="M4 6h16M4 12h16M4 18h16"
                />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden bg-white border-t border-gray-100 px-6 py-4 space-y-1">
          {navLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="block px-3 py-2.5 text-sm font-medium text-[#0A1547] hover:text-[#A380F6] hover:bg-purple-50 rounded-lg transition-colors"
              onClick={() => setMobileOpen(false)}
              data-analytics-cta={link.label}
              data-analytics-placement="mobile-nav"
            >
              {link.label}
            </a>
          ))}
          <div className="pt-3 border-t border-gray-100 mt-3">
            <p className="text-xs font-semibold text-[#0A1547]/40 uppercase tracking-wider mb-3 px-3">Client Login</p>
            <form onSubmit={handleSignIn} className="space-y-2 px-3">
              <input
                type="email"
                placeholder="Email address"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setEmailError("");
                }}
                className="w-full px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-[#0A1547] text-sm placeholder-gray-400 focus:outline-none"
              />
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-[#0A1547] text-sm placeholder-gray-400 focus:outline-none"
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
                style={{ background: "none", border: "none", padding: 0, cursor: "pointer", font: "inherit" }}
              >
                Forgot password?
              </button>
              {clientLoginError && (
                <p className="text-xs text-red-500">{clientLoginError}</p>
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
  );
}
