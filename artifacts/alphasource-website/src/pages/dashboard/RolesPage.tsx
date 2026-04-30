import { useEffect, useRef, useState } from "react";
import {
  FileText,
  Upload,
  Trash2,
  Copy,
  X,
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
} from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import InfoTooltip from "@/components/InfoTooltip";
import { useClient } from "@/context/ClientContext";
import { supabase } from "@/lib/supabaseClient";

type InterviewType = "Basic" | "Detailed" | "Technical";
type RoleSortKey = "name" | "type" | "left" | "used" | "date";
type SortDir = "asc" | "desc";

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <ChevronsUpDown className="w-3 h-3 text-[#0A1547]/20 flex-shrink-0" />;
  return dir === "asc"
    ? <ChevronUp className="w-3 h-3 text-[#A380F6] flex-shrink-0" />
    : <ChevronDown className="w-3 h-3 text-[#A380F6] flex-shrink-0" />;
}

interface Role {
  id: string;
  name: string;
  date: string;
  type: InterviewType;
  left: number;
  used: number;
  hasRubric: boolean;
  hasJD: boolean;
  sortDate: number;
  slugOrToken: string;
  rubric: unknown;
  jobDescriptionUrl: string;
}

interface RoleCheckoutResponse {
  url?: unknown;
  checkout_client_secret?: unknown;
}

interface EmbeddedCheckoutState {
  clientSecret: string;
  fallbackUrl: string;
}

const env =
  typeof import.meta !== "undefined" && import.meta.env ? import.meta.env : {};

function trimTrailingSlashes(value: unknown): string {
  return String(value || "").trim().replace(/\/+$/, "");
}

function firstBase(...values: unknown[]): string {
  for (const value of values) {
    const normalized = trimTrailingSlashes(value);
    if (normalized) return normalized;
  }
  return "";
}

function firstText(...values: unknown[]): string {
  for (const value of values) {
    const normalized = String(value || "").trim();
    if (normalized) return normalized;
  }
  return "";
}

const backendBase = firstBase(
  (env as Record<string, unknown>).VITE_BACKEND_URL,
  (env as Record<string, unknown>).VITE_API_URL,
  (env as Record<string, unknown>).VITE_PUBLIC_BACKEND_URL,
  (env as Record<string, unknown>).PUBLIC_BACKEND_URL,
  (env as Record<string, unknown>).BACKEND_URL,
);

const stripePublishableKey = firstText(
  (env as Record<string, unknown>).VITE_STRIPE_PUBLISHABLE_KEY,
  (env as Record<string, unknown>).VITE_STRIPE_PUBLIC_KEY,
  (env as Record<string, unknown>).STRIPE_PUBLISHABLE_KEY,
);

function openCheckoutUrl(checkoutUrl: string): void {
  const url = String(checkoutUrl || "").trim();
  if (!url) return;
  if (window?.parent && window.parent !== window) {
    try {
      if (window.top) {
        window.top.location.href = url;
        return;
      }
    } catch {
      // fallback below
    }
    window.open(url, "_blank", "noopener,noreferrer");
    return;
  }
  window.location.assign(url);
}

function mapInterviewType(value: unknown): InterviewType {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "detailed") return "Detailed";
  if (normalized === "technical") return "Technical";
  return "Basic";
}

function toWholeNonNegative(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.floor(n));
}

function formatRoleDate(value: unknown): { text: string; sortDate: number } {
  const raw = String(value || "").trim();
  if (!raw) return { text: "—", sortDate: 0 };
  const parsed = new Date(raw);
  const time = parsed.getTime();
  if (Number.isNaN(time)) return { text: "—", sortDate: 0 };
  const formatted = parsed.toLocaleString("en-US", {
    timeZone: "America/Chicago",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZoneName: "short",
  });
  const normalized = formatted
    .replace(/\sGMT[+-]\d{1,2}(?::\d{2})?/g, "")
    .replace(/\b(?:CDT|CST)\b/g, "CST");
  return { text: normalized.includes("CST") ? normalized : `${normalized} CST`, sortDate: time };
}

function extractErrorMessage(text: string): string {
  if (!text) return "Failed to load roles.";
  try {
    const data = JSON.parse(text) as { detail?: unknown; message?: unknown; error?: unknown };
    const candidate = data.detail ?? data.message ?? data.error;
    if (typeof candidate === "string" && candidate.trim()) return candidate;
  } catch {
    // ignore parse failure and fall back to raw text
  }
  return text;
}

function parseJsonSafe(text: string): unknown {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function buildInterviewShareUrl(token: string): string {
  const safeToken = encodeURIComponent(String(token || "").trim());
  if (!safeToken) return "";
  const origin =
    typeof window !== "undefined" && window.location
      ? trimTrailingSlashes(window.location.origin)
      : "";
  return origin ? `${origin}/interview-access/${safeToken}` : `/interview-access/${safeToken}`;
}

async function copyTextToClipboard(text: string): Promise<void> {
  const value = String(text || "");
  if (!value) throw new Error("Could not copy interview link.");
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(value);
      return;
    }
  } catch {
    // fall through to legacy copy path
  }

  const ta = document.createElement("textarea");
  ta.value = value;
  ta.style.position = "fixed";
  ta.style.left = "-9999px";
  ta.setAttribute("readonly", "");
  document.body.appendChild(ta);
  ta.select();
  const copied = document.execCommand("copy");
  document.body.removeChild(ta);
  if (!copied) throw new Error("Could not copy interview link.");
}

function extractRubricQuestions(rubric: unknown): string[] {
  const out: string[] = [];
  const seen = new Set<string>();

  const pushQuestion = (value: unknown) => {
    const text = String(value || "").trim();
    if (!text) return;
    if (seen.has(text)) return;
    seen.add(text);
    out.push(text);
  };

  const visit = (value: unknown): void => {
    if (!value) return;
    if (typeof value === "string") {
      const raw = value.trim();
      if (!raw) return;
      if (raw.startsWith("{") || raw.startsWith("[")) {
        const parsed = parseJsonSafe(raw);
        if (parsed !== null) {
          visit(parsed);
          return;
        }
      }
      pushQuestion(raw);
      return;
    }
    if (Array.isArray(value)) {
      for (const entry of value) visit(entry);
      return;
    }
    if (typeof value === "object") {
      const record = value as Record<string, unknown>;
      if (typeof record.text === "string") pushQuestion(record.text);
      if (typeof record.question === "string") pushQuestion(record.question);
      if (Array.isArray(record.questions)) visit(record.questions);
    }
  };

  visit(rubric);
  return out;
}

const typeColors: Record<InterviewType, { bg: string; text: string }> = {
  Basic:     { bg: "rgba(163,128,246,0.10)", text: "#7C5FCC" },
  Detailed:  { bg: "rgba(2,171,224,0.10)",   text: "#0285B0" },
  Technical: { bg: "rgba(2,217,157,0.10)",   text: "#009E73" },
};

function TypeBadge({ type }: { type: InterviewType }) {
  const c = typeColors[type];
  return (
    <span
      className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold"
      style={{ backgroundColor: c.bg, color: c.text }}
    >
      {type}
    </span>
  );
}

function UsageBar({ left, used }: { left: number; used: number }) {
  const total = left + used;
  const pct = total > 0 ? (used / total) * 100 : 0;
  const hasLeft = left != null && Number.isFinite(left);
  const warningColor = hasLeft && left <= 1 ? "#EF4444" : hasLeft && left <= 3 ? "#D97706" : "#A380F6";
  const leftColor = warningColor === "#A380F6" ? "#0A1547" : warningColor;
  return (
    <div className="min-w-[90px]">
      <div className="flex items-baseline gap-1 mb-1.5">
        <span className="text-sm font-black" style={{ color: leftColor }}>{left}</span>
        <span className="text-[10px] text-[#0A1547]/40 font-semibold">left</span>
        <span className="text-[10px] text-[#0A1547]/25 mx-0.5">/</span>
        <span className="text-sm font-black text-[#0A1547]/60">{used}</span>
        <span className="text-[10px] text-[#0A1547]/40 font-semibold">used</span>
      </div>
      <div className="w-full bg-gray-100 rounded-full h-1">
        <div
          className="h-1 rounded-full"
          style={{ width: `${pct}%`, backgroundColor: warningColor }}
        />
      </div>
    </div>
  );
}

function DocButton({
  has,
  label,
  onClick,
  disabled,
}: {
  has: boolean;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  if (!has) return <span className="text-[#0A1547]/20 text-sm">—</span>;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={`View ${label}`}
      className="p-2 rounded-lg text-[#0A1547]/40 hover:text-[#A380F6] hover:bg-[#A380F6]/08 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
      aria-label={`View ${label}`}
    >
      <FileText className="w-4 h-4" />
    </button>
  );
}

export default function RolesPage() {
  const { selectedClient, selectedClientId, loading: clientLoading, error: clientError, isGlobalAdmin, memberships } = useClient();
  const selectedMembershipRole = String(
    memberships.find((membership) => membership.client_id === selectedClientId)?.role ||
      selectedClient.role ||
      "",
  )
    .trim()
    .toLowerCase();
  const canManageRoles = isGlobalAdmin || selectedMembershipRole === "manager" || selectedMembershipRole === "admin";
  const [roleTitle, setRoleTitle] = useState("");
  const [interviewType, setInterviewType] = useState<InterviewType>("Basic");
  const [jdFile, setJdFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [sortKey, setSortKey] = useState<RoleSortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [roleSearch, setRoleSearch] = useState("");
  const [roles, setRoles] = useState<Role[]>([]);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [rolesError, setRolesError] = useState("");
  const [rolesReloadNonce, setRolesReloadNonce] = useState(0);
  const [actionNotice, setActionNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [createBusy, setCreateBusy] = useState(false);
  const [openingJd, setOpeningJd] = useState<Record<string, boolean>>({});
  const [deletingRoles, setDeletingRoles] = useState<Record<string, boolean>>({});
  const [rubricModalRole, setRubricModalRole] = useState<Role | null>(null);
  const [rubricQuestions, setRubricQuestions] = useState<string[]>([]);
  const [rubricNotes, setRubricNotes] = useState("");
  const [rubricError, setRubricError] = useState("");
  const [rubricSending, setRubricSending] = useState(false);
  const [embeddedCheckout, setEmbeddedCheckout] = useState<EmbeddedCheckoutState | null>(null);
  const [embeddedCheckoutLoading, setEmbeddedCheckoutLoading] = useState(false);
  const [embeddedCheckoutError, setEmbeddedCheckoutError] = useState("");
  const roleCheckoutReturnHandledRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const embeddedCheckoutContainerRef = useRef<HTMLDivElement>(null);
  const embeddedCheckoutInstanceRef = useRef<{ unmount?: () => void; destroy?: () => void } | null>(null);

  useEffect(() => {
    setActionNotice(null);
    setCreateBusy(false);
    setOpeningJd({});
    setDeletingRoles({});
    setRubricModalRole(null);
    setRubricQuestions([]);
    setRubricNotes("");
    setRubricError("");
    setRubricSending(false);
    if (embeddedCheckoutInstanceRef.current) {
      try {
        embeddedCheckoutInstanceRef.current.unmount?.();
      } catch {
        // no-op
      }
      try {
        embeddedCheckoutInstanceRef.current.destroy?.();
      } catch {
        // no-op
      }
      embeddedCheckoutInstanceRef.current = null;
    }
    setEmbeddedCheckout(null);
    setEmbeddedCheckoutLoading(false);
    setEmbeddedCheckoutError("");
  }, [selectedClientId, clientLoading, clientError]);

  useEffect(() => {
    setRoleSearch("");
  }, [selectedClientId]);

  useEffect(() => {
    if (!actionNotice) return;
    const timer = setTimeout(() => setActionNotice(null), 3200);
    return () => clearTimeout(timer);
  }, [actionNotice]);

  useEffect(() => {
    if (roleCheckoutReturnHandledRef.current) return;
    if (!selectedClientId) return;
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search || "");
    const roleCheckout = String(params.get("role_checkout") || "").trim().toLowerCase();
    const returnClientId = String(params.get("client_id") || "").trim();
    const returnRoleId = String(params.get("role_id") || "").trim();

    if (roleCheckout !== "success" && roleCheckout !== "cancel") return;
    if (!returnClientId || returnClientId !== selectedClientId) return;

    roleCheckoutReturnHandledRef.current = true;

    if (roleCheckout === "success" && returnRoleId) {
      setRolesReloadNonce((value) => value + 1);
    }

    setActionNotice({
      tone: roleCheckout === "success" ? "success" : "error",
      text: roleCheckout === "success" ? "Role checkout completed." : "Role checkout canceled.",
    });
  }, [selectedClientId]);

  const closeEmbeddedCheckout = () => {
    if (embeddedCheckoutInstanceRef.current) {
      try {
        embeddedCheckoutInstanceRef.current.unmount?.();
      } catch {
        // no-op
      }
      try {
        embeddedCheckoutInstanceRef.current.destroy?.();
      } catch {
        // no-op
      }
      embeddedCheckoutInstanceRef.current = null;
    }
    setEmbeddedCheckout(null);
    setEmbeddedCheckoutLoading(false);
    setEmbeddedCheckoutError("");
  };

  useEffect(() => {
    const clientSecret = String(embeddedCheckout?.clientSecret || "").trim();
    if (!clientSecret) return;
    let alive = true;
    let embeddedInstance: { unmount?: () => void; destroy?: () => void } | null = null;

    const mountEmbeddedCheckout = async () => {
      setEmbeddedCheckoutLoading(true);
      setEmbeddedCheckoutError("");
      try {
        if (!stripePublishableKey) throw new Error("Missing Stripe publishable key.");
        const { loadStripe } = await import("@stripe/stripe-js");
        const stripe = await loadStripe(stripePublishableKey);
        if (!stripe) throw new Error("Could not initialize Stripe checkout.");
        if (!alive) return;

        const checkout = await stripe.initEmbeddedCheckout({
          clientSecret,
          onComplete: () => {
            setRolesReloadNonce((value) => value + 1);
            setActionNotice({ tone: "success", text: "Role checkout completed." });
            setEmbeddedCheckout(null);
            setEmbeddedCheckoutError("");
          },
        });
        if (!alive) {
          try {
            checkout.destroy?.();
          } catch {
            // no-op
          }
          return;
        }
        if (!embeddedCheckoutContainerRef.current) throw new Error("Checkout container unavailable.");
        checkout.mount(embeddedCheckoutContainerRef.current);
        embeddedInstance = checkout;
        embeddedCheckoutInstanceRef.current = checkout;
      } catch (error) {
        if (!alive) return;
        const message = error instanceof Error ? error.message : "Could not load embedded checkout.";
        setEmbeddedCheckoutError(message);
        const fallbackUrl = String(embeddedCheckout?.fallbackUrl || "").trim();
        if (fallbackUrl) {
          closeEmbeddedCheckout();
          openCheckoutUrl(fallbackUrl);
        }
      } finally {
        if (alive) setEmbeddedCheckoutLoading(false);
      }
    };

    void mountEmbeddedCheckout();
    return () => {
      alive = false;
      if (embeddedInstance) {
        try {
          embeddedInstance.unmount?.();
        } catch {
          // no-op
        }
        try {
          embeddedInstance.destroy?.();
        } catch {
          // no-op
        }
      }
      if (embeddedCheckoutInstanceRef.current) {
        try {
          embeddedCheckoutInstanceRef.current.unmount?.();
        } catch {
          // no-op
        }
        try {
          embeddedCheckoutInstanceRef.current.destroy?.();
        } catch {
          // no-op
        }
        embeddedCheckoutInstanceRef.current = null;
      }
    };
  }, [embeddedCheckout?.clientSecret, embeddedCheckout?.fallbackUrl]);

  const handleSort = (key: RoleSortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const roleSearchTerm = roleSearch.trim().toLowerCase();
  const filteredRoles = roleSearchTerm
    ? roles.filter((role) => role.name.toLowerCase().includes(roleSearchTerm))
    : roles;

  const sortedRoles = sortKey
    ? [...filteredRoles].sort((a, b) => {
        let av: string | number;
        let bv: string | number;
        switch (sortKey) {
          case "name": av = a.name; bv = b.name; break;
          case "type": av = a.type; bv = b.type; break;
          case "left": av = a.left; bv = b.left; break;
          case "used": av = a.used; bv = b.used; break;
          case "date": av = a.sortDate; bv = b.sortDate; break;
          default:     av = 0; bv = 0;
        }
        const cmp = typeof av === "string" ? av.localeCompare(bv as string) : (av - (bv as number));
        return sortDir === "asc" ? cmp : -cmp;
      })
    : filteredRoles;

  const isSupportedJdFile = (file: File): boolean => {
    const name = String(file?.name || "").trim().toLowerCase();
    return name.endsWith(".pdf") || name.endsWith(".docx");
  };

  const handleFile = (file: File) => {
    if (!isSupportedJdFile(file)) {
      setJdFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setActionNotice({ tone: "error", text: "Job Description must be a PDF or DOCX file." });
      return;
    }
    setJdFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (createBusy) return;
    setActionNotice(null);
    if (!canManageRoles) {
      setActionNotice({ tone: "error", text: "You have read-only access for this client." });
      return;
    }

    if (!selectedClientId) {
      setActionNotice({ tone: "error", text: "Select a client before creating a role." });
      return;
    }

    const title = roleTitle.trim();
    if (!title) {
      setActionNotice({ tone: "error", text: "Role title is required." });
      return;
    }
    if (!interviewType) {
      setActionNotice({ tone: "error", text: "Interview type is required." });
      return;
    }
    if (!jdFile) {
      setActionNotice({ tone: "error", text: "Please attach a Job Description file." });
      return;
    }
    if (!isSupportedJdFile(jdFile)) {
      setActionNotice({ tone: "error", text: "Job Description must be a PDF or DOCX file." });
      return;
    }

    setCreateBusy(true);
    try {
      if (!backendBase) throw new Error("Missing backend base URL configuration.");
      const token = await getSessionToken();
      const formData = new FormData();
      formData.append("client_id", selectedClientId);
      formData.append("role_title", title);
      formData.append("interview_type", String(interviewType).toUpperCase());
      formData.append("tab", "roles");
      formData.append("embedded", "true");
      formData.append("file", jdFile);

      const response = await fetch(`${backendBase}/clients/roles/checkout-session`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        credentials: "omit",
        body: formData,
      });

      const text = await response.text();
      if (!response.ok) throw new Error(extractErrorMessage(text));

      const data = parseJsonSafe(text) as RoleCheckoutResponse | null;
      const checkoutUrl = typeof data?.url === "string" ? data.url.trim() : "";
      const checkoutClientSecret =
        typeof data?.checkout_client_secret === "string" ? data.checkout_client_secret.trim() : "";

      if (checkoutClientSecret && stripePublishableKey) {
        setEmbeddedCheckout({
          clientSecret: checkoutClientSecret,
          fallbackUrl: checkoutUrl,
        });
        return;
      }

      if (!checkoutUrl) throw new Error("Missing checkout URL.");
      setRolesReloadNonce((value) => value + 1);
      openCheckoutUrl(checkoutUrl);
      return;
    } catch (error) {
      setActionNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "Failed to start role checkout.",
      });
    } finally {
      setCreateBusy(false);
    }
  };

  useEffect(() => {
    let alive = true;

    const loadRoles = async () => {
      if (clientLoading) return;
      if (clientError) {
        if (!alive) return;
        setRoles([]);
        setRolesError(clientError);
        setRolesLoading(false);
        return;
      }
      if (!selectedClientId) {
        if (!alive) return;
        setRoles([]);
        setRolesError("");
        setRolesLoading(false);
        return;
      }
      if (!backendBase) {
        if (!alive) return;
        setRoles([]);
        setRolesError("Missing backend base URL configuration.");
        setRolesLoading(false);
        return;
      }

      if (!alive) return;
      setRolesLoading(true);
      setRolesError("");

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const token = String(session?.access_token || "").trim();
        if (!token) throw new Error("Missing session token.");

        const response = await fetch(
          `${backendBase}/roles?client_id=${encodeURIComponent(selectedClientId)}`,
          {
            method: "GET",
            headers: { Authorization: `Bearer ${token}` },
            credentials: "omit",
          },
        );

        const text = await response.text();
        if (!response.ok) {
          throw new Error(extractErrorMessage(text));
        }

        let payload: unknown = null;
        try {
          payload = text ? JSON.parse(text) : {};
        } catch {
          payload = {};
        }

        const items = payload && typeof payload === "object" && Array.isArray((payload as { items?: unknown }).items)
          ? ((payload as { items: unknown[] }).items)
          : [];

        const mappedRoles: Role[] = items
          .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"))
          .map((item) => {
            const date = formatRoleDate(item.created_at);
            const rubric = item.rubric ?? null;
            const questions = extractRubricQuestions(rubric);
            const jobDescriptionUrl = String(item.job_description_url || "").trim();
            return {
              id: String(item.id || ""),
              name: String(item.title || "").trim() || "Untitled Role",
              date: date.text,
              type: mapInterviewType(item.interview_type),
              left: toWholeNonNegative(item.remaining_interviews),
              used: toWholeNonNegative(item.used_interviews),
              hasRubric: questions.length > 0,
              hasJD: Boolean(jobDescriptionUrl),
              sortDate: date.sortDate,
              slugOrToken: String(item.slug_or_token || "").trim(),
              rubric,
              jobDescriptionUrl,
            };
          })
          .filter((item) => Boolean(item.id));

        if (!alive) return;
        setRoles(mappedRoles);
      } catch (error) {
        if (!alive) return;
        setRoles([]);
        setRolesError(error instanceof Error ? error.message : "Failed to load roles.");
      } finally {
        if (alive) setRolesLoading(false);
      }
    };

    void loadRoles();
    return () => {
      alive = false;
    };
  }, [selectedClientId, clientLoading, clientError, rolesReloadNonce]);

  const getSessionToken = async (): Promise<string> => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const token = String(session?.access_token || "").trim();
    if (!token) throw new Error("Missing session token.");
    return token;
  };

  const openRubricModal = (role: Role) => {
    setRubricModalRole(role);
    setRubricQuestions(extractRubricQuestions(role.rubric));
    setRubricNotes("");
    setRubricError("");
  };

  const closeRubricModal = () => {
    setRubricModalRole(null);
    setRubricQuestions([]);
    setRubricNotes("");
    setRubricError("");
  };

  const openRoleJd = async (role: Role) => {
    if (!role.id || !role.hasJD) return;
    setActionNotice(null);
    setOpeningJd((prev) => ({ ...prev, [role.id]: true }));
    try {
      if (!backendBase) throw new Error("Missing backend base URL configuration.");
      const token = await getSessionToken();
      const response = await fetch(
        `${backendBase}/roles/${encodeURIComponent(role.id)}/jd-signed-url`,
        {
          method: "GET",
          headers: { Authorization: `Bearer ${token}` },
          credentials: "omit",
        },
      );
      const text = await response.text();
      if (!response.ok) throw new Error(extractErrorMessage(text));
      const data = parseJsonSafe(text) as { url?: unknown } | null;
      const url = typeof data?.url === "string" ? data.url.trim() : "";
      if (!url) throw new Error("Could not open Job Description.");
      const opened = window.open(url, "_blank", "noopener,noreferrer");
      if (!opened) throw new Error("Could not open Job Description.");
      setActionNotice({ tone: "success", text: "Job description opened." });
    } catch (error) {
      setActionNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "Could not open Job Description.",
      });
    } finally {
      setOpeningJd((prev) => ({ ...prev, [role.id]: false }));
    }
  };

  const copyInterviewLink = async (role: Role) => {
    setActionNotice(null);
    try {
      const url = buildInterviewShareUrl(role.slugOrToken);
      if (!url) throw new Error("Interview link unavailable for this role.");
      await copyTextToClipboard(url);
      setActionNotice({ tone: "success", text: "Interview link copied." });
    } catch (error) {
      setActionNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "Could not copy interview link.",
      });
    }
  };

  const requestRubricChanges = async () => {
    if (!rubricModalRole?.id || !selectedClientId) return;
    setRubricSending(true);
    setRubricError("");
    setActionNotice(null);
    try {
      if (!backendBase) throw new Error("Missing backend base URL configuration.");
      const token = await getSessionToken();
      const response = await fetch(
        `${backendBase}/roles/${encodeURIComponent(rubricModalRole.id)}/rubric-request-changes`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          credentials: "omit",
          body: JSON.stringify({
            client_id: selectedClientId,
            notes: rubricNotes,
            questions: rubricQuestions,
          }),
        },
      );
      const text = await response.text();
      if (!response.ok) throw new Error(extractErrorMessage(text));
      setActionNotice({ tone: "success", text: "Rubric change request sent." });
      closeRubricModal();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Request failed.";
      setRubricError(message);
      setActionNotice({ tone: "error", text: message });
    } finally {
      setRubricSending(false);
    }
  };

  const deleteRole = async (role: Role) => {
    if (!role.id || !selectedClientId) return;
    if (!canManageRoles) {
      setActionNotice({
        tone: "error",
        text: "Role deletion is not available in this dashboard.",
      });
      return;
    }
    const confirmed = window.confirm(`Delete role "${role.name}"?`);
    if (!confirmed) return;
    setActionNotice(null);
    setDeletingRoles((prev) => ({ ...prev, [role.id]: true }));
    try {
      if (!backendBase) throw new Error("Missing backend base URL configuration.");
      const token = await getSessionToken();
      const query = `id=${encodeURIComponent(role.id)}&client_id=${encodeURIComponent(selectedClientId)}`;
      const headers = { Authorization: `Bearer ${token}` };

      let response = await fetch(`${backendBase}/roles/admin/roles?${query}`, {
        method: "DELETE",
        headers,
        credentials: "omit",
      });
      let text = await response.text();

      if (!response.ok) {
        const legacyDisabled =
          response.status === 404 ||
          response.status === 405 ||
          /legacy_route_disabled/i.test(text);
        if (legacyDisabled) {
          response = await fetch(`${backendBase}/admin/roles?${query}`, {
            method: "DELETE",
            headers,
            credentials: "omit",
          });
          text = await response.text();
        }
      }

      if (!response.ok) {
        throw new Error(extractErrorMessage(text) || "Could not delete role.");
      }

      setRoles((prev) => prev.filter((item) => item.id !== role.id));
      setActionNotice({ tone: "success", text: "Role deleted." });
    } catch (error) {
      setActionNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "Could not delete role.",
      });
    } finally {
      setDeletingRoles((prev) => ({ ...prev, [role.id]: false }));
    }
  };

  const roleTableColumnCount = canManageRoles ? 7 : 6;

  return (
    <DashboardLayout title="Roles">
      {canManageRoles && (
        <div
          className="bg-white rounded-2xl p-6 mb-6"
          style={{ border: "1px solid rgba(10,21,71,0.07)", boxShadow: "0 2px 12px rgba(10,21,71,0.05)" }}
        >
          <h2 className="text-base font-black text-[#0A1547] mb-4">Create Role</h2>

          <form onSubmit={handleCreate}>
            <div className="flex flex-wrap gap-3 items-end">
              {/* Role Title */}
              <div className="flex-1 min-w-[200px]">
                <label className="text-[10px] font-black uppercase tracking-widest text-[#0A1547]/40 flex items-center gap-1 mb-1.5">
                  Role Title
                  <InfoTooltip
                    content="Role title is used in candidate-facing interview context, rubric generation, and dashboard reporting."
                    side="bottom"
                  />
                </label>
                <input
                  type="text"
                  placeholder="e.g. Dental Hygienist"
                  value={roleTitle}
                  onChange={(e) => setRoleTitle(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-[#0A1547] text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#A380F6]/25 focus:border-[#A380F6] transition-all"
                />
              </div>

              {/* Interview Type */}
              <div className="w-44">
                <label className="text-[10px] font-black uppercase tracking-widest text-[#0A1547]/40 flex items-center gap-1 mb-1.5">
                  Interview Type
                  <InfoTooltip
                    content="Basic: shorter screening focused on core fit and relevant experience. Detailed: deeper behavioral and situational interview. Technical: skill-heavy interview focused on role-specific reasoning and execution."
                    side="bottom"
                  />
                </label>
                <div className="relative">
                  <select
                    value={interviewType}
                    onChange={(e) => setInterviewType(e.target.value as InterviewType)}
                    className="w-full appearance-none px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-[#0A1547] text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#A380F6]/25 focus:border-[#A380F6] transition-all cursor-pointer pr-9"
                  >
                    <option value="Basic">Basic</option>
                    <option value="Detailed">Detailed</option>
                    <option value="Technical">Technical</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#0A1547]/40 pointer-events-none" />
                </div>
              </div>

              {/* JD File Drop zone */}
              <div className="flex-1 min-w-[200px]">
                <label className="text-[10px] font-black uppercase tracking-widest text-[#0A1547]/40 flex items-center gap-1 mb-1.5">
                  Job Description
                  <InfoTooltip
                    content="The job description helps generate the role rubric, interview questions, and candidate evaluation context. Use the clearest current version available."
                    side="bottom"
                  />
                </label>
                <div className="flex items-center gap-2">
                  <div
                    className={`flex-1 flex items-center gap-2.5 px-3 py-2.5 rounded-xl border-2 border-dashed cursor-pointer transition-all text-sm ${
                      dragging
                        ? "border-[#A380F6] bg-[#A380F6]/05"
                        : "border-gray-200 hover:border-[#A380F6]/50 hover:bg-gray-50"
                    }`}
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={handleDrop}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,.docx"
                      className="hidden"
                      onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }}
                    />
                    {jdFile ? (
                      <>
                        <FileText className="w-4 h-4 flex-shrink-0" style={{ color: "#A380F6" }} />
                        <span className="text-xs font-semibold text-[#0A1547] truncate">{jdFile.name}</span>
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4 flex-shrink-0 text-gray-400" />
                        <span className="text-xs text-gray-400">PDF or DOCX — drag here or click to browse</span>
                      </>
                    )}
                  </div>
                  {jdFile && (
                    <button
                      type="button"
                      onClick={() => setJdFile(null)}
                      className="p-2 rounded-lg text-[#0A1547]/30 hover:text-red-500 hover:bg-red-50 transition-colors flex-shrink-0"
                      aria-label="Remove file"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Create button */}
              <button
                type="submit"
                disabled={createBusy}
                className="px-6 py-2.5 text-sm font-bold text-white rounded-full transition-all hover:opacity-90 active:scale-[0.98] flex-shrink-0"
                style={{ backgroundColor: "#A380F6" }}
              >
                {createBusy ? "Creating..." : "Create"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Search */}
      <div
        className="bg-white rounded-2xl px-5 py-3.5 mb-5 flex flex-wrap items-center gap-3"
        style={{ border: "1px solid rgba(10,21,71,0.07)", boxShadow: "0 2px 12px rgba(10,21,71,0.04)" }}
      >
        <input
          className="w-full max-w-sm px-4 py-2 rounded-xl bg-gray-50 border border-gray-200 text-[#0A1547] text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#A380F6]/25 focus:border-[#A380F6] transition-all"
          placeholder="Search role name..."
          value={roleSearch}
          onChange={(e) => setRoleSearch(e.target.value)}
        />
        {roleSearch && (
          <button
            type="button"
            className="px-3 py-2 rounded-full text-xs font-bold text-[#0A1547]/55 bg-[#0A1547]/5 hover:bg-[#0A1547]/10 transition-colors"
            onClick={() => setRoleSearch("")}
          >
            Clear
          </button>
        )}
        <p className="text-xs text-[#0A1547]/35 font-semibold ml-auto">
          {sortedRoles.length} of {roles.length} role{roles.length !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Roles table */}
      <div
        className="bg-white rounded-2xl overflow-hidden"
        style={{ border: "1px solid rgba(10,21,71,0.07)", boxShadow: "0 2px 12px rgba(10,21,71,0.05)" }}
      >
        {!rolesLoading && !rolesError && actionNotice && (
          <div className="px-6 pt-4">
            <div
              className={`rounded-xl px-3.5 py-2 text-xs font-semibold ${
                actionNotice.tone === "success"
                  ? "text-[#009E73] bg-[#02D99D]/10 border border-[#02D99D]/25"
                  : "text-red-500 bg-red-50 border border-red-200"
              }`}
              role="status"
              aria-live="polite"
            >
              {actionNotice.text}
            </div>
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                {/* Role — sortable */}
                <th className="text-left px-6 py-3.5 whitespace-nowrap">
                  <button
                    onClick={() => handleSort("name")}
                    className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-[#0A1547]/40 hover:text-[#0A1547]/70 transition-colors"
                  >
                    Role
                    <SortIcon active={sortKey === "name"} dir={sortDir} />
                  </button>
                </th>
                {/* Type — sortable */}
                <th className="text-left px-4 py-3.5 whitespace-nowrap">
                  <button
                    onClick={() => handleSort("type")}
                    className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-[#0A1547]/40 hover:text-[#0A1547]/70 transition-colors"
                  >
                    Type
                    <SortIcon active={sortKey === "type"} dir={sortDir} />
                  </button>
                </th>
                {/* Usage — sortable */}
                <th className="text-left px-4 py-3.5 whitespace-nowrap">
                  <button
                    onClick={() => handleSort("left")}
                    className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-[#0A1547]/40 hover:text-[#0A1547]/70 transition-colors"
                  >
                    Usage
                    <InfoTooltip content="Interviews used vs. remaining quota for this role" />
                    <SortIcon active={sortKey === "left"} dir={sortDir} />
                  </button>
                </th>
                {/* Rubric — not sortable (boolean doc) */}
                <th className="text-center px-4 py-3.5 whitespace-nowrap">
                  <span className="flex items-center justify-center gap-1 text-[10px] font-black uppercase tracking-widest text-[#0A1547]/40">
                    Rubric
                    <InfoTooltip content="Role-specific interview question set and scoring rubric generated for this role" />
                  </span>
                </th>
                {/* JD — not sortable */}
                <th className="text-center px-4 py-3.5 whitespace-nowrap">
                  <span className="flex items-center justify-center gap-1 text-[10px] font-black uppercase tracking-widest text-[#0A1547]/40">
                    JD
                    <InfoTooltip content="Job description file used as source input to generate this role's rubric" />
                  </span>
                </th>
                {/* Interview Link */}
                <th className="text-left px-4 py-3.5 whitespace-nowrap">
                  <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-[#0A1547]/40">
                    Interview Link
                    <InfoTooltip content="Shareable link for candidates to start their AI interview" />
                  </span>
                </th>
                {/* Delete */}
                {canManageRoles && (
                  <th className="text-center px-4 py-3.5 pr-6 text-[10px] font-black uppercase tracking-widest text-[#0A1547]/40 whitespace-nowrap">
                    Delete
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {rolesLoading && (
                <tr>
                  <td colSpan={roleTableColumnCount} className="px-6 py-12 text-center text-sm text-[#0A1547]/35 font-semibold">
                    Loading roles...
                  </td>
                </tr>
              )}
              {!rolesLoading && rolesError && (
                <tr>
                  <td colSpan={roleTableColumnCount} className="px-6 py-12 text-center text-sm text-red-500 font-semibold">
                    {rolesError}
                  </td>
                </tr>
              )}
              {!rolesLoading && !rolesError && sortedRoles.length === 0 && (
                <tr>
                  <td colSpan={roleTableColumnCount} className="px-6 py-12 text-center text-sm text-[#0A1547]/35 font-semibold">
                    {roles.length === 0 ? "No roles yet." : "No roles match your search."}
                  </td>
                </tr>
              )}
              {!rolesLoading && !rolesError && sortedRoles.map((role, idx) => (
                <tr
                  key={role.id}
                  className="border-b border-gray-50 hover:bg-gray-50/60 transition-colors"
                  style={idx === sortedRoles.length - 1 ? { borderBottom: "none" } : {}}
                >
                  {/* Role name + date */}
                  <td className="px-6 py-4">
                    <p className="font-bold text-[#0A1547] text-sm leading-snug">{role.name}</p>
                    <p className="text-[11px] text-[#0A1547]/35 mt-0.5">{role.date}</p>
                  </td>

                  {/* Type */}
                  <td className="px-4 py-4">
                    <TypeBadge type={role.type} />
                  </td>

                  {/* Usage */}
                  <td className="px-4 py-4">
                    <UsageBar left={role.left} used={role.used} />
                  </td>

                  {/* Rubric */}
                  <td className="px-4 py-4 text-center">
                    <DocButton
                      has={role.hasRubric}
                      label="Rubric"
                      onClick={() => openRubricModal(role)}
                    />
                  </td>

                  {/* JD */}
                  <td className="px-4 py-4 text-center">
                    <DocButton
                      has={role.hasJD}
                      label="JD"
                      onClick={() => { void openRoleJd(role); }}
                      disabled={Boolean(openingJd[role.id])}
                    />
                  </td>

                  {/* Interview Link */}
                  <td className="px-4 py-4">
                    <button
                      type="button"
                      onClick={() => { void copyInterviewLink(role); }}
                      disabled={!role.slugOrToken}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all hover:opacity-85 active:scale-[0.97]"
                      style={{ backgroundColor: "rgba(163,128,246,0.12)", color: "#7C5FCC" }}
                    >
                      <Copy className="w-3 h-3" />
                      Copy link
                    </button>
                  </td>

                  {/* Delete */}
                  {canManageRoles && (
                    <td className="px-4 py-4 pr-6 text-center">
                      <button
                        type="button"
                        onClick={() => { void deleteRole(role); }}
                        disabled={Boolean(deletingRoles[role.id])}
                        className="p-2 rounded-lg text-[#0A1547]/25 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                        aria-label="Delete role"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {rubricModalRole && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 sm:p-6">
          <button
            type="button"
            onClick={closeRubricModal}
            className="absolute inset-0 bg-[#0A1547]/45"
            aria-label="Close rubric modal"
          />
          <div
            className="relative w-full max-w-2xl max-h-[85vh] bg-white rounded-2xl overflow-hidden"
            style={{ border: "1px solid rgba(10,21,71,0.10)", boxShadow: "0 20px 44px rgba(10,21,71,0.24)" }}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-[#0A1547]/40">Rubric</p>
                <h3 className="text-sm font-black text-[#0A1547] leading-snug">{rubricModalRole.name}</h3>
              </div>
              <button
                type="button"
                onClick={closeRubricModal}
                className="w-8 h-8 rounded-lg inline-flex items-center justify-center text-[#0A1547]/40 hover:text-[#0A1547] hover:bg-gray-100 transition-colors"
                aria-label="Close rubric modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-5 py-4 overflow-y-auto max-h-[calc(85vh-72px)]">
              {rubricQuestions.length === 0 ? (
                <p className="text-sm text-[#0A1547]/45 font-semibold">No rubric questions available.</p>
              ) : (
                <ol className="list-decimal pl-5 text-sm text-[#0A1547]/80 space-y-2 font-semibold">
                  {rubricQuestions.map((question, idx) => (
                    <li key={`${rubricModalRole.id}-${idx}`}>{question}</li>
                  ))}
                </ol>
              )}
              <div className="mt-4">
                <label className="text-[10px] font-black uppercase tracking-widest text-[#0A1547]/40 block mb-1.5">
                  Request Changes
                </label>
                <textarea
                  value={rubricNotes}
                  onChange={(e) => setRubricNotes(e.target.value)}
                  placeholder="Add optional notes for rubric updates"
                  className="w-full min-h-[92px] px-3 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-[#0A1547] text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#A380F6]/25 focus:border-[#A380F6] transition-all"
                />
                {rubricError && (
                  <p className="mt-2 text-xs text-red-500 font-semibold">{rubricError}</p>
                )}
              </div>
              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={closeRubricModal}
                  className="px-4 py-2 text-xs font-bold rounded-full border border-gray-200 text-[#0A1547]/70 hover:bg-gray-50 transition-colors"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => { void requestRubricChanges(); }}
                  disabled={rubricSending}
                  className="px-4 py-2 text-xs font-bold text-white rounded-full transition-all hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed"
                  style={{ backgroundColor: "#A380F6" }}
                >
                  {rubricSending ? "Sending…" : "Request changes"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {embeddedCheckout && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 sm:p-6">
          <button
            type="button"
            onClick={closeEmbeddedCheckout}
            className="absolute inset-0 bg-[#0A1547]/45"
            aria-label="Close checkout"
          />
          <div
            className="relative w-full max-w-5xl max-h-[92vh] bg-white rounded-2xl overflow-hidden"
            style={{ border: "1px solid rgba(10,21,71,0.10)", boxShadow: "0 20px 44px rgba(10,21,71,0.24)" }}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-[#0A1547]/40">Checkout</p>
                <h3 className="text-sm font-black text-[#0A1547] leading-snug">Complete role creation purchase</h3>
              </div>
              <button
                type="button"
                onClick={closeEmbeddedCheckout}
                className="w-8 h-8 rounded-lg inline-flex items-center justify-center text-[#0A1547]/40 hover:text-[#0A1547] hover:bg-gray-100 transition-colors"
                aria-label="Close checkout"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-5 py-4 overflow-y-auto max-h-[calc(92vh-72px)]">
              {embeddedCheckoutLoading && (
                <p className="mb-3 text-xs font-semibold text-[#0A1547]/45">Loading checkout…</p>
              )}
              {embeddedCheckoutError && (
                <p className="mb-3 text-xs font-semibold text-red-500">{embeddedCheckoutError}</p>
              )}
              <div ref={embeddedCheckoutContainerRef} className="min-h-[520px]" />
              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={closeEmbeddedCheckout}
                  className="px-4 py-2 text-xs font-bold rounded-full border border-gray-200 text-[#0A1547]/70 hover:bg-gray-50 transition-colors"
                >
                  Close
                </button>
                {embeddedCheckout.fallbackUrl ? (
                  <button
                    type="button"
                    onClick={() => {
                      const fallbackUrl = embeddedCheckout.fallbackUrl;
                      closeEmbeddedCheckout();
                      openCheckoutUrl(fallbackUrl);
                    }}
                    className="px-4 py-2 text-xs font-bold text-white rounded-full transition-all hover:opacity-90"
                    style={{ backgroundColor: "#A380F6" }}
                  >
                    Open hosted checkout
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
