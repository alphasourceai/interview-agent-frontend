import { useEffect, useRef, useState, type FormEvent } from "react";
import { useLocation } from "wouter";

function trimTrailingSlashes(value: string): string {
  return String(value || "").trim().replace(/\/+$/, "");
}

function firstBase(...values: Array<string | undefined>): string {
  for (const value of values) {
    const normalized = trimTrailingSlashes(value || "");
    if (normalized) return normalized;
  }
  return "";
}

function joinUrl(base: string, path: string): string {
  if (!base) return path;
  if (base.endsWith("/") && path.startsWith("/")) return `${base.slice(0, -1)}${path}`;
  if (!base.endsWith("/") && !path.startsWith("/")) return `${base}/${path}`;
  return `${base}${path}`;
}

function readRoleToken(params?: { role_token?: string }): string {
  const fromParams = String(params?.role_token || "").trim();
  if (fromParams) return fromParams;
  if (typeof window === "undefined") return "";
  try {
    const url = new URL(window.location.href);
    return (
      String(url.searchParams.get("role_token") || "").trim() ||
      String(url.searchParams.get("role") || "").trim() ||
      String(url.searchParams.get("token") || "").trim()
    );
  } catch {
    return "";
  }
}

const env = (
  typeof import.meta !== "undefined" && import.meta.env ? import.meta.env : {}
) as Record<string, string | undefined>;

const backendBase = firstBase(
  env.VITE_BACKEND_URL,
  env.VITE_API_URL,
  env.VITE_PUBLIC_BACKEND_URL,
  env.PUBLIC_BACKEND_URL,
  env.BACKEND_URL,
);

const inputCls =
  "w-full px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-[#0A1547] text-sm " +
  "placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#A380F6]/20 " +
  "focus:border-[#A380F6] transition-all";

const errorCls = "text-red-500 text-[10px] mt-1 font-semibold";
const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
const isValidPhone = (value: string) =>
  /^(\d{10}|\(\d{3}\)\s?\d{3}-\d{4}|\d{3}-\d{3}-\d{4}|\d{3}\.\d{3}\.\d{4})$/.test(String(value || "").trim());
const MAX_REQUEST_CHARS = 200;

type FormState = {
  candidate_name: string;
  candidate_email: string;
  candidate_phone: string;
  accommodation_request_text: string;
  resume: File | null;
};

export default function AccommodationRequestPage({ params }: { params?: { role_token?: string } }) {
  const [, setLocation] = useLocation();
  const [roleToken, setRoleToken] = useState(() => readRoleToken(params));
  const [form, setForm] = useState<FormState>({
    candidate_name: "",
    candidate_email: "",
    candidate_phone: "",
    accommodation_request_text: "",
    resume: null,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setRoleToken(readRoleToken(params));
  }, [params?.role_token]);

  function handleChange(field: keyof FormState, value: string | File | null) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: "" }));
  }

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (!String(form.candidate_name || "").trim()) next.candidate_name = "Required";
    if (!isValidEmail(form.candidate_email)) next.candidate_email = "Enter a valid email address";
    if (!isValidPhone(form.candidate_phone)) next.candidate_phone = "Enter a valid phone number";
    const requestText = String(form.accommodation_request_text || "").trim();
    if (!requestText) next.accommodation_request_text = "Please describe your request";
    if (requestText.length > MAX_REQUEST_CHARS) next.accommodation_request_text = `Keep it under ${MAX_REQUEST_CHARS} characters`;
    if (!String(roleToken || "").trim()) next.role_token = "Missing role link. Please use the interview URL you were sent.";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setServerError("");
    if (!validate()) return;
    if (!backendBase) {
      setServerError("Accommodation service is not configured. Please try again later.");
      return;
    }

    setSubmitting(true);
    try {
      const body = new FormData();
      body.append("candidate_name", form.candidate_name.trim());
      body.append("candidate_email", form.candidate_email.trim());
      body.append("candidate_phone", String(form.candidate_phone || "").replace(/\D/g, ""));
      body.append("accommodation_request_text", form.accommodation_request_text.trim());
      body.append("role_token", String(roleToken || "").trim());
      if (form.resume) body.append("resume", form.resume);

      const resp = await fetch(joinUrl(backendBase, "/api/accommodations/request"), {
        method: "POST",
        body,
        credentials: "omit",
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        const detail = String(data?.detail || "").trim();
        const error = String(data?.error || "").trim();
        if (error === "request_failed") {
          setServerError("We could not process this request. Please review your information and try again.");
        } else {
          setServerError(detail || error || "Could not submit your request. Please try again.");
        }
        return;
      }

      setSubmitted(true);
    } catch {
      setServerError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#F8F9FD] flex flex-col" style={{ fontFamily: "'Raleway', sans-serif" }}>
      <header
        className="bg-white flex-shrink-0 flex items-center px-6 h-14"
        style={{ borderBottom: "1px solid rgba(10,21,71,0.07)" }}
      >
        <img src="/logo-dark-text.png" alt="alphaSource AI" className="h-8 w-auto" />
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div
          className="bg-white rounded-2xl p-8 w-full max-w-md"
          style={{
            border: "1px solid rgba(10,21,71,0.07)",
            boxShadow: "0 4px 24px rgba(10,21,71,0.08)",
          }}
        >
          <h1 className="text-xl font-black text-[#0A1547] mb-2">Need an accommodation?</h1>
          <p className="text-sm text-[#0A1547]/65 leading-relaxed mb-6">
            Submit your request and our team will follow up.
          </p>

          {submitted ? (
            <div className="space-y-3">
              <p className="text-sm text-emerald-700 font-semibold">
                Thank you. Your accommodation request has been received.
              </p>
              <p className="text-xs text-[#0A1547]/55">
                We will respond within 48 business hours.
              </p>
              <button
                type="button"
                onClick={() => setLocation(roleToken ? `/interview/${encodeURIComponent(roleToken)}` : "/interview")}
                className="mt-2 w-full rounded-xl bg-[#A380F6] text-white text-sm font-bold py-2.5 hover:opacity-95 transition-opacity"
              >
                Return to interview
              </button>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-4">
              <div>
                <label className="block text-[11px] uppercase tracking-wide font-bold text-[#0A1547]/65 mb-1.5">
                  Full name
                </label>
                <input
                  type="text"
                  value={form.candidate_name}
                  onChange={(e) => handleChange("candidate_name", e.target.value)}
                  className={inputCls}
                  disabled={submitting}
                  required
                />
                {errors.candidate_name && <p className={errorCls}>{errors.candidate_name}</p>}
              </div>

              <div>
                <label className="block text-[11px] uppercase tracking-wide font-bold text-[#0A1547]/65 mb-1.5">
                  Email
                </label>
                <input
                  type="email"
                  value={form.candidate_email}
                  onChange={(e) => handleChange("candidate_email", e.target.value)}
                  className={inputCls}
                  disabled={submitting}
                  required
                />
                {errors.candidate_email && <p className={errorCls}>{errors.candidate_email}</p>}
              </div>

              <div>
                <label className="block text-[11px] uppercase tracking-wide font-bold text-[#0A1547]/65 mb-1.5">
                  Phone
                </label>
                <input
                  type="tel"
                  value={form.candidate_phone}
                  onChange={(e) => handleChange("candidate_phone", e.target.value)}
                  className={inputCls}
                  disabled={submitting}
                  placeholder="(555) 123-4567"
                  required
                />
                {errors.candidate_phone && <p className={errorCls}>{errors.candidate_phone}</p>}
              </div>

              <div>
                <label className="block text-[11px] uppercase tracking-wide font-bold text-[#0A1547]/65 mb-1.5">
                  Accommodation request
                </label>
                <textarea
                  value={form.accommodation_request_text}
                  onChange={(e) => handleChange("accommodation_request_text", e.target.value)}
                  className={inputCls}
                  rows={4}
                  maxLength={MAX_REQUEST_CHARS}
                  disabled={submitting}
                  required
                />
                <div className="mt-1 text-[10px] text-[#0A1547]/45 text-right">
                  {form.accommodation_request_text.length}/{MAX_REQUEST_CHARS}
                </div>
                {errors.accommodation_request_text && <p className={errorCls}>{errors.accommodation_request_text}</p>}
              </div>

              <div>
                <label className="block text-[11px] uppercase tracking-wide font-bold text-[#0A1547]/65 mb-1.5">
                  Resume (optional)
                </label>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  onChange={(e) => handleChange("resume", e.target.files?.[0] || null)}
                  className="hidden"
                  disabled={submitting}
                />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="w-full px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-[#0A1547] text-sm text-left hover:bg-gray-100 transition-colors"
                  disabled={submitting}
                >
                  {form.resume ? form.resume.name : "Upload resume (PDF, DOC, or DOCX)"}
                </button>
              </div>

              {errors.role_token && <p className={errorCls}>{errors.role_token}</p>}
              {serverError && <p className="text-red-600 text-xs font-semibold">{serverError}</p>}

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-xl bg-[#A380F6] text-white text-sm font-bold py-2.5 hover:opacity-95 transition-opacity disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {submitting ? "Submitting..." : "Submit request"}
              </button>

              {roleToken && (
                <p className="mt-2 text-[11px] text-[#0A1547]/35">
                  Role token: <span className="font-mono">{roleToken}</span>
                </p>
              )}
            </form>
          )}
        </div>
      </main>
    </div>
  );
}
