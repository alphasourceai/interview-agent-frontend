import { useEffect, useMemo, useRef, useState } from "react";
import {
  FileText,
  Upload,
  Trash2,
  X,
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
} from "lucide-react";
import CurrentScopeBanner from "@/components/CurrentScopeBanner";
import DashboardLayout from "@/components/DashboardLayout";
import InfoTooltip from "@/components/InfoTooltip";
import RoleActionsMenu from "@/components/roles/RoleActionsMenu";
import ReplaceJobDescriptionModal from "@/components/roles/ReplaceJobDescriptionModal";
import {
  ROLE_TABLE_CLIENT_COLUMNS,
  roleTableAlignmentClass,
} from "@/components/roles/roleTableLayout";
import { useClient } from "@/context/ClientContext";
import { buildEntityFilterOptions, defaultEntityFilterValue, entityFilterHelpText, entityFilterQueryValue, type EntityFilterValue } from "@/lib/entityFilters";
import { normalizeRoleJdReplacementEligibility, type RoleJdReplacementEligibility } from "@/lib/roleJdReplacementEligibility";
import { supabase } from "@/lib/supabaseClient";

type InterviewType = "Basic" | "Detailed" | "Technical";
type RoleSortKey = "name" | "entity" | "type" | "left" | "used" | "date";
type SortDir = "asc" | "desc";
type RoleStatusFilter = "active" | "inactive" | "all";

const surfaceCardStyle = {
  backgroundColor: "var(--as-surface)",
  border: "1px solid var(--as-border)",
  boxShadow: "var(--as-shadow)",
};
const compactSurfaceStyle = {
  backgroundColor: "var(--as-surface)",
  border: "1px solid var(--as-border)",
  boxShadow: "0 1px 6px rgba(10,21,71,0.05)",
};
const modalSurfaceStyle = {
  backgroundColor: "var(--as-surface)",
  border: "1px solid var(--as-border)",
  boxShadow: "0 20px 44px rgba(10,21,71,0.24)",
};
const fieldSurfaceStyle = {
  backgroundColor: "var(--as-surface-muted)",
  borderColor: "var(--as-border)",
  color: "var(--as-text)",
};
const mutedPanelStyle = {
  backgroundColor: "var(--as-surface-muted)",
  borderColor: "var(--as-border)",
};
const dividerStyle = { borderColor: "var(--as-border)" };
const primaryTextStyle = { color: "var(--as-text)" };
const mutedTextStyle = { color: "var(--as-text-muted)" };
const subtleTextStyle = { color: "var(--as-text-subtle)" };
const progressTrackStyle = { backgroundColor: "var(--as-surface-muted)" };

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <ChevronsUpDown className="w-3 h-3 flex-shrink-0" style={subtleTextStyle} />;
  return dir === "asc"
    ? <ChevronUp className="w-3 h-3 text-[#A380F6] flex-shrink-0" />
    : <ChevronDown className="w-3 h-3 text-[#A380F6] flex-shrink-0" />;
}

interface Role {
  id: string;
  clientId: string;
  name: string;
  entityName: string;
  createdDate: string;
  createdTime: string;
  type: InterviewType;
  left: number;
  used: number;
  hasRubric: boolean;
  hasJD: boolean;
  sortDate: number;
  slugOrToken: string;
  rubric: unknown;
  jobDescriptionUrl: string;
  jobDescriptionReplacement: RoleJdReplacementEligibility;
  status?: string | null;
  closedAt?: string | null;
  closedBy?: string | null;
  isInactive?: boolean;
}

interface RoleCheckoutResponse {
  ok?: unknown;
  credit_applied?: unknown;
  role_id?: unknown;
  message?: unknown;
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

function formatRoleCreated(value: unknown): { date: string; time: string; sortDate: number } {
  const raw = String(value || "").trim();
  if (!raw) return { date: "—", time: "—", sortDate: 0 };
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return { date: "—", time: "—", sortDate: 0 };
  return {
    date: parsed.toLocaleDateString(),
    time: parsed.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
    sortDate: parsed.getTime(),
  };
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
  const leftColor = warningColor === "#A380F6" ? "var(--as-text)" : warningColor;
  return (
    <div className="min-w-[90px]">
      <div className="flex items-baseline gap-1 mb-1.5">
        <span className="text-sm font-black" style={{ color: leftColor }}>{left}</span>
        <span className="text-[10px] font-semibold" style={mutedTextStyle}>left</span>
        <span className="text-[10px] mx-0.5" style={subtleTextStyle}>/</span>
        <span className="text-sm font-black" style={mutedTextStyle}>{used}</span>
        <span className="text-[10px] font-semibold" style={mutedTextStyle}>used</span>
      </div>
      <div className="w-full rounded-full h-1" style={progressTrackStyle}>
        <div
          className="h-1 rounded-full"
          style={{ width: `${pct}%`, backgroundColor: warningColor }}
        />
      </div>
    </div>
  );
}

export default function RolesPage() {
  const { clients, selectedClient, selectedClientId, loading: clientLoading, error: clientError, isGlobalAdmin, memberships } = useClient();
  const selectedMembershipRoleValue = String(
    memberships.find((membership) => membership.client_id === selectedClientId)?.role ||
      selectedClient.role ||
      "",
  )
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  const selectedMembershipRole = selectedMembershipRoleValue === "superadmin"
    ? "super_admin"
    : selectedMembershipRoleValue;
  const canManageRoles = isGlobalAdmin || ["manager", "admin", "owner", "super_admin"].includes(selectedMembershipRole);
  const [roleTitle, setRoleTitle] = useState("");
  const [interviewType, setInterviewType] = useState<InterviewType>("Basic");
  const [jdFile, setJdFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [sortKey, setSortKey] = useState<RoleSortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [roleSearch, setRoleSearch] = useState("");
  const [roleStatusFilter, setRoleStatusFilter] = useState<RoleStatusFilter>("active");
  const [entityFilter, setEntityFilter] = useState<EntityFilterValue>("parent");
  const [roles, setRoles] = useState<Role[]>([]);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [rolesError, setRolesError] = useState("");
  const [rolesReloadNonce, setRolesReloadNonce] = useState(0);
  const [actionNotice, setActionNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [createBusy, setCreateBusy] = useState(false);
  const [openingJd, setOpeningJd] = useState<Record<string, boolean>>({});
  const [deletingRoles, setDeletingRoles] = useState<Record<string, boolean>>({});
  const [updatingRoleStatus, setUpdatingRoleStatus] = useState<Record<string, boolean>>({});
  const [roleStatusConfirm, setRoleStatusConfirm] = useState<{ role: Role; nextStatus: "active" | "inactive" } | null>(null);
  const [roleDeleteConfirm, setRoleDeleteConfirm] = useState<{ role: Role } | null>(null);
  const [replacementRole, setReplacementRole] = useState<Role | null>(null);
  const [openRoleActionsId, setOpenRoleActionsId] = useState<string | null>(null);
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
  const replacementTriggerRef = useRef<HTMLButtonElement>(null);
  const entityOptions = useMemo(
    () => buildEntityFilterOptions(clients, selectedClientId, { useParentNameLabel: true }),
    [clients, selectedClientId],
  );
  const entityHelpText = useMemo(() => entityFilterHelpText(entityOptions), [entityOptions]);

  useEffect(() => {
    setEntityFilter(defaultEntityFilterValue(clients, selectedClientId));
  }, [clients, selectedClientId]);

  useEffect(() => {
    setActionNotice(null);
    setCreateBusy(false);
    setOpeningJd({});
    setDeletingRoles({});
    setUpdatingRoleStatus({});
    setRoleStatusConfirm(null);
    setRoleDeleteConfirm(null);
    setReplacementRole(null);
    setOpenRoleActionsId(null);
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
          case "entity": av = a.entityName; bv = b.entityName; break;
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
      if (data?.credit_applied === true) {
        setRoleTitle("");
        setInterviewType("Basic");
        setJdFile(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
        setRolesReloadNonce((value) => value + 1);
        setActionNotice({
          tone: "success",
          text: "First-role prepay credit applied. Your role has been created.",
        });
        return;
      }

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

        const params = new URLSearchParams({
          client_id: selectedClientId,
          status: roleStatusFilter,
        });
        if (entityOptions.length > 0) params.set("entity_filter", entityFilterQueryValue(entityFilter));

        const response = await fetch(`${backendBase}/roles?${params.toString()}`, {
          method: "GET",
          headers: { Authorization: `Bearer ${token}` },
          credentials: "omit",
        });

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
            const created = formatRoleCreated(item.created_at);
            const rubric = item.rubric ?? null;
            const questions = extractRubricQuestions(rubric);
            const jobDescriptionUrl = String(item.job_description_url || "").trim();
            const status = String(item.status || "active").trim().toLowerCase() || "active";
            return {
              id: String(item.id || ""),
              clientId: String(item.client_id || "").trim(),
              name: String(item.title || "").trim() || "Untitled Role",
              entityName: String(item.entity_name || "").trim() || selectedClient.name || "—",
              createdDate: created.date,
              createdTime: created.time,
              type: mapInterviewType(item.interview_type),
              left: toWholeNonNegative(item.remaining_interviews),
              used: toWholeNonNegative(item.used_interviews),
              hasRubric: questions.length > 0,
              hasJD: Boolean(jobDescriptionUrl),
              sortDate: created.sortDate,
              slugOrToken: String(item.slug_or_token || "").trim(),
              rubric,
              jobDescriptionUrl,
              jobDescriptionReplacement: normalizeRoleJdReplacementEligibility(item.job_description_replacement),
              status,
              closedAt: String(item.closed_at || "").trim() || null,
              closedBy: String(item.closed_by || "").trim() || null,
              isInactive: status === "inactive",
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
  }, [selectedClientId, selectedClient.name, clientLoading, clientError, roleStatusFilter, entityFilter, entityOptions.length, rolesReloadNonce]);

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
      // Some browsers return null even when the new tab opens; signed-url failures above remain hard errors.
      window.open(url, "_blank", "noopener,noreferrer");
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
      if (role.isInactive) throw new Error("Inactive roles cannot accept new candidates.");
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
    const roleClientId = rubricModalRole.clientId || selectedClientId;
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
            client_id: roleClientId,
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
    const roleClientId = role.clientId || selectedClientId;
    if (!canManageRoles) {
      setActionNotice({
        tone: "error",
        text: "Role deletion is not available in this dashboard.",
      });
      return;
    }
    setActionNotice(null);
    setDeletingRoles((prev) => ({ ...prev, [role.id]: true }));
    try {
      if (!backendBase) throw new Error("Missing backend base URL configuration.");
      const token = await getSessionToken();
      const query = `id=${encodeURIComponent(role.id)}&client_id=${encodeURIComponent(roleClientId)}`;
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

  const updateRoleStatus = async (role: Role, nextStatus: "active" | "inactive") => {
    if (!role.id || !selectedClientId || updatingRoleStatus[role.id]) return;
    const roleClientId = role.clientId || selectedClientId;
    if (!canManageRoles) {
      setActionNotice({
        tone: "error",
        text: "Role updates are not available in this dashboard.",
      });
      return;
    }
    setActionNotice(null);
    setUpdatingRoleStatus((prev) => ({ ...prev, [role.id]: true }));
    try {
      if (!backendBase) throw new Error("Missing backend base URL configuration.");
      const token = await getSessionToken();
      const response = await fetch(
        `${backendBase}/roles/${encodeURIComponent(role.id)}/status?client_id=${encodeURIComponent(roleClientId)}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          credentials: "omit",
          body: JSON.stringify(
            nextStatus === "inactive"
              ? { status: "inactive", inactive_reason: "Closed by client" }
              : { status: "active" },
          ),
        },
      );
      const text = await response.text();
      if (!response.ok) throw new Error(extractErrorMessage(text) || "Could not update role.");
      setRolesReloadNonce((value) => value + 1);
      setActionNotice({
        tone: "success",
        text: nextStatus === "inactive" ? "Role closed." : "Role reopened.",
      });
    } catch (error) {
      setActionNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "Could not update role.",
      });
    } finally {
      setUpdatingRoleStatus((prev) => ({ ...prev, [role.id]: false }));
    }
  };

  const roleTableColumnCount = 6;

  return (
    <DashboardLayout title="Roles">
      <CurrentScopeBanner client={selectedClient} />

      {canManageRoles && (
        <div
          className="rounded-2xl p-6 mb-6"
          style={surfaceCardStyle}
        >
          <h2 className="text-base font-black mb-4" style={primaryTextStyle}>Create Role</h2>

          <form onSubmit={handleCreate}>
            <div className="flex flex-wrap gap-3 items-end">
              {/* Role Title */}
              <div className="flex-1 min-w-[200px]">
                <label className="text-[10px] font-black uppercase tracking-widest flex items-center gap-1 mb-1.5" style={mutedTextStyle}>
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
                  className="w-full px-4 py-2.5 rounded-xl border text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#A380F6]/25 focus:border-[#A380F6] transition-all"
                  style={fieldSurfaceStyle}
                />
              </div>

              {/* Interview Type */}
              <div className="w-44">
                <label className="text-[10px] font-black uppercase tracking-widest flex items-center gap-1 mb-1.5" style={mutedTextStyle}>
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
                    className="w-full appearance-none px-4 py-2.5 rounded-xl border text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#A380F6]/25 focus:border-[#A380F6] transition-all cursor-pointer pr-9"
                    style={fieldSurfaceStyle}
                  >
                    <option value="Basic">Basic</option>
                    <option value="Detailed">Detailed</option>
                    <option value="Technical">Technical</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none" style={mutedTextStyle} />
                </div>
              </div>

              {/* JD File Drop zone */}
              <div className="flex-1 min-w-[200px]">
                <label className="text-[10px] font-black uppercase tracking-widest flex items-center gap-1 mb-1.5" style={mutedTextStyle}>
                  Job Description
                  <InfoTooltip
                    content="The job description helps generate the role rubric, interview questions, and candidate evaluation context. Use the clearest current version available."
                    side="bottom"
                  />
                </label>
                <div className="flex items-center gap-2">
                  <div
                    className="flex-1 flex items-center gap-2.5 px-3 py-2.5 rounded-xl border-2 border-dashed cursor-pointer transition-all text-sm hover:border-[#A380F6]/50"
                    style={{
                      backgroundColor: dragging ? "var(--as-accent-soft)" : "var(--as-surface-muted)",
                      borderColor: dragging ? "#A380F6" : "var(--as-border)",
                    }}
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
                        <span className="text-xs font-semibold truncate" style={primaryTextStyle}>{jdFile.name}</span>
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4 flex-shrink-0" style={subtleTextStyle} />
                        <span className="text-xs" style={subtleTextStyle}>PDF or DOCX — drag here or click to browse</span>
                      </>
                    )}
                  </div>
                  {jdFile && (
                    <button
                      type="button"
                      onClick={() => setJdFile(null)}
                      className="p-2 rounded-lg hover:text-red-500 transition-colors flex-shrink-0"
                      style={subtleTextStyle}
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
        className="rounded-2xl px-5 py-3.5 mb-5 flex flex-wrap items-center gap-3"
        style={compactSurfaceStyle}
      >
        <input
          className="w-full max-w-sm px-4 py-2 rounded-xl border text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#A380F6]/25 focus:border-[#A380F6] transition-all"
          style={fieldSurfaceStyle}
          placeholder="Search role name..."
          value={roleSearch}
          onChange={(e) => setRoleSearch(e.target.value)}
        />
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-black uppercase tracking-widest" style={mutedTextStyle}>Status</span>
          <div className="inline-flex items-center rounded-full p-1" style={{ backgroundColor: "var(--as-surface-muted)" }}>
            {(["active", "inactive", "all"] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setRoleStatusFilter(value)}
                className="px-3 py-1.5 rounded-full text-xs font-bold transition-colors"
                style={roleStatusFilter === value
                  ? { backgroundColor: "var(--as-surface)", color: "var(--as-text)", boxShadow: "0 1px 3px rgba(10,21,71,0.08)" }
                  : mutedTextStyle}
              >
                {value === "active" ? "Active" : value === "inactive" ? "Inactive" : "All"}
              </button>
            ))}
          </div>
        </div>
        {entityOptions.length > 0 && (
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest" style={mutedTextStyle}>Entity</label>
              <InfoTooltip content={entityHelpText} side="bottom" iconClassName="w-3 h-3 text-[#0A1547]/35 dark:text-white/45" />
            </div>
            <div className="relative">
              <select
                value={entityFilter}
                onChange={(event) => setEntityFilter(event.target.value)}
                className="appearance-none w-44 px-4 py-2 rounded-xl border text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#A380F6]/25 focus:border-[#A380F6] transition-all cursor-pointer pr-9"
                style={fieldSurfaceStyle}
              >
                {entityOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none" style={mutedTextStyle} />
            </div>
          </div>
        )}
        {roleSearch && (
          <button
            type="button"
            className="px-3 py-2 rounded-full text-xs font-bold transition-colors"
            style={{ backgroundColor: "var(--as-surface-muted)", color: "var(--as-text-muted)" }}
            onClick={() => setRoleSearch("")}
          >
            Clear
          </button>
        )}
        <p className="text-xs font-semibold ml-auto" style={subtleTextStyle}>
          {sortedRoles.length} of {roles.length} role{roles.length !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Roles table */}
      <div
        className="rounded-2xl overflow-hidden"
        style={surfaceCardStyle}
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
          <table className="min-w-[960px] w-full table-fixed text-sm">
            <colgroup>
              <col className={ROLE_TABLE_CLIENT_COLUMNS.role.width} />
              <col className={ROLE_TABLE_CLIENT_COLUMNS.created.width} />
              <col className={ROLE_TABLE_CLIENT_COLUMNS.entity.width} />
              <col className={ROLE_TABLE_CLIENT_COLUMNS.type.width} />
              <col className={ROLE_TABLE_CLIENT_COLUMNS.usage.width} />
              <col className={ROLE_TABLE_CLIENT_COLUMNS.actions.width} />
            </colgroup>
            <thead>
              <tr className="border-b" style={dividerStyle}>
                {/* Role — sortable */}
                <th className={`${ROLE_TABLE_CLIENT_COLUMNS.role.horizontalPadding} py-3.5 whitespace-nowrap`}>
                  <div className={roleTableAlignmentClass("role")}>
                    <button
                      onClick={() => handleSort("name")}
                      className="inline-flex items-center justify-center gap-1 text-[10px] font-black uppercase tracking-widest transition-colors"
                      style={mutedTextStyle}
                    >
                      Role
                      <SortIcon active={sortKey === "name"} dir={sortDir} />
                    </button>
                  </div>
                </th>
                <th className={`${ROLE_TABLE_CLIENT_COLUMNS.created.horizontalPadding} py-3.5 whitespace-nowrap`}>
                  <div className={roleTableAlignmentClass("created")}>
                    <button
                      onClick={() => handleSort("date")}
                      className="inline-flex items-center justify-center gap-1 text-[10px] font-black uppercase tracking-widest transition-colors"
                      style={mutedTextStyle}
                    >
                      Created
                      <SortIcon active={sortKey === "date"} dir={sortDir} />
                    </button>
                  </div>
                </th>
                <th className={`${ROLE_TABLE_CLIENT_COLUMNS.entity.horizontalPadding} py-3.5 whitespace-nowrap`}>
                  <div className={roleTableAlignmentClass("entity")}>
                    <button
                      onClick={() => handleSort("entity")}
                      className="inline-flex items-center justify-center gap-1 text-[10px] font-black uppercase tracking-widest transition-colors"
                      style={mutedTextStyle}
                    >
                      Entity
                      <SortIcon active={sortKey === "entity"} dir={sortDir} />
                    </button>
                  </div>
                </th>
                <th className={`${ROLE_TABLE_CLIENT_COLUMNS.type.horizontalPadding} py-3.5 whitespace-nowrap`}>
                  <div className={roleTableAlignmentClass("type")}>
                    <button
                      onClick={() => handleSort("type")}
                      className="inline-flex items-center justify-center gap-1 text-[10px] font-black uppercase tracking-widest transition-colors"
                      style={mutedTextStyle}
                    >
                      Type
                      <SortIcon active={sortKey === "type"} dir={sortDir} />
                    </button>
                  </div>
                </th>
                {/* Usage — sortable */}
                <th className={`${ROLE_TABLE_CLIENT_COLUMNS.usage.horizontalPadding} py-3.5 whitespace-nowrap`}>
                  <div className={roleTableAlignmentClass("usage")}>
                    <button
                      onClick={() => handleSort("left")}
                      className="inline-flex items-center justify-center gap-1 text-[10px] font-black uppercase tracking-widest transition-colors"
                      style={mutedTextStyle}
                    >
                      Usage
                      <InfoTooltip content="Interviews used vs. remaining quota for this role" />
                      <SortIcon active={sortKey === "left"} dir={sortDir} />
                    </button>
                  </div>
                </th>
                <th className={`${ROLE_TABLE_CLIENT_COLUMNS.actions.horizontalPadding} py-3.5 whitespace-nowrap`}>
                  <div className={roleTableAlignmentClass("actions")}>
                    <span className="inline-flex items-center justify-center text-[10px] font-black uppercase tracking-widest" style={mutedTextStyle}>Actions</span>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {rolesLoading && (
                <tr>
                  <td colSpan={roleTableColumnCount} className="px-6 py-12 text-center text-sm font-semibold" style={subtleTextStyle}>
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
                  <td colSpan={roleTableColumnCount} className="px-6 py-12 text-center text-sm font-semibold" style={subtleTextStyle}>
                    {roles.length === 0
                      ? roleStatusFilter === "inactive" ? "No inactive roles." : roleStatusFilter === "active" ? "No active roles." : "No roles yet."
                      : "No roles match your search."}
                  </td>
                </tr>
              )}
              {!rolesLoading && !rolesError && sortedRoles.map((role, idx) => (
                <tr
                  key={role.id}
                  className="border-b transition-colors as-shell-dropdown-item"
                  style={idx === sortedRoles.length - 1 ? { borderBottom: "none" } : dividerStyle}
                >
                  {/* Role */}
                  <td className={`${ROLE_TABLE_CLIENT_COLUMNS.role.horizontalPadding} py-4`}>
                    <div className={roleTableAlignmentClass("role")}>
                      <div className="min-w-0 w-full">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="break-words font-bold text-sm leading-snug" style={primaryTextStyle}>{role.name}</p>
                          {role.isInactive && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black" style={{ backgroundColor: "var(--as-surface-muted)", color: "var(--as-text-muted)" }}>
                              Inactive
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Created */}
                  <td className={`${ROLE_TABLE_CLIENT_COLUMNS.created.horizontalPadding} py-4`}>
                    <div className={roleTableAlignmentClass("created")}>
                      <div className="w-full">
                        <p className="text-xs font-bold leading-snug" style={mutedTextStyle}>{role.createdDate}</p>
                        <p className="text-[10px] font-semibold mt-0.5" style={subtleTextStyle}>{role.createdTime}</p>
                      </div>
                    </div>
                  </td>

                  <td className={`${ROLE_TABLE_CLIENT_COLUMNS.entity.horizontalPadding} py-4`}>
                    <div className={roleTableAlignmentClass("entity")}>
                      <span className="block w-full truncate text-sm font-semibold" title={role.entityName} style={mutedTextStyle}>{role.entityName}</span>
                    </div>
                  </td>

                  {/* Type */}
                  <td className={`${ROLE_TABLE_CLIENT_COLUMNS.type.horizontalPadding} py-4`}>
                    <div className={roleTableAlignmentClass("type")}>
                      <TypeBadge type={role.type} />
                    </div>
                  </td>

                  {/* Usage */}
                  <td className={`${ROLE_TABLE_CLIENT_COLUMNS.usage.horizontalPadding} py-4`}>
                    <div className={roleTableAlignmentClass("usage")}>
                      <UsageBar left={role.left} used={role.used} />
                    </div>
                  </td>

                  <td className={`${ROLE_TABLE_CLIENT_COLUMNS.actions.horizontalPadding} py-4`}>
                    <div className={roleTableAlignmentClass("actions")}>
                      <RoleActionsMenu
                        open={openRoleActionsId === role.id}
                        onOpenChange={(open) => setOpenRoleActionsId(open ? role.id : null)}
                        roleTitle={role.name}
                        canManageRole={canManageRoles}
                        canCopyInterviewLink={Boolean(role.slugOrToken) && !role.isInactive}
                        copyDisabledReason={role.isInactive ? "Inactive roles cannot accept new candidates." : "Interview link unavailable."}
                        hasJobDescription={role.hasJD}
                        hasRubric={role.hasRubric}
                        openingJobDescription={Boolean(openingJd[role.id])}
                        loadingRubric={false}
                        replacementEligibility={role.jobDescriptionReplacement}
                        updatingStatus={Boolean(updatingRoleStatus[role.id])}
                        deleting={Boolean(deletingRoles[role.id])}
                        isInactive={Boolean(role.isInactive)}
                        onTriggerFocus={(trigger) => { replacementTriggerRef.current = trigger; }}
                        onCopyInterviewLink={() => { void copyInterviewLink(role); }}
                        onViewJobDescription={() => { void openRoleJd(role); }}
                        onViewRubric={() => openRubricModal(role)}
                        onReplaceJobDescription={() => {
                          if (!role.jobDescriptionReplacement.eligible) return;
                          setOpenRoleActionsId(null);
                          setReplacementRole(role);
                        }}
                        onToggleRoleStatus={() => setRoleStatusConfirm({ role, nextStatus: role.isInactive ? "active" : "inactive" })}
                        onDeleteRole={() => setRoleDeleteConfirm({ role })}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <ReplaceJobDescriptionModal
        open={Boolean(replacementRole)}
        role={replacementRole ? {
          id: replacementRole.id,
          clientId: replacementRole.clientId || selectedClientId,
          title: replacementRole.name,
          status: replacementRole.status,
          jobDescriptionUrl: replacementRole.jobDescriptionUrl,
        } : null}
        getSessionToken={getSessionToken}
        onClose={() => setReplacementRole(null)}
        onSuccess={() => {
          setRolesReloadNonce((value) => value + 1);
          setActionNotice({ tone: "success", text: "Job description replaced and role configuration rebuilt." });
        }}
        getRestoreFocusTarget={() => replacementTriggerRef.current}
      />
      {roleStatusConfirm && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 sm:p-6">
          <button
            type="button"
            onClick={() => setRoleStatusConfirm(null)}
            className="absolute inset-0 bg-[#0A1547]/45"
            aria-label="Cancel role status change"
          />
          <div
            className="relative w-full max-w-md rounded-2xl overflow-hidden"
            style={modalSurfaceStyle}
            role="dialog"
            aria-modal="true"
            aria-labelledby="role-status-confirm-title"
          >
            <div className="px-6 py-5 border-b" style={dividerStyle}>
              <h3 id="role-status-confirm-title" className="text-base font-black" style={primaryTextStyle}>
                {roleStatusConfirm.nextStatus === "inactive" ? "Close role" : "Reopen role"}
              </h3>
            </div>
            <div className="px-6 py-5">
              {roleStatusConfirm.nextStatus === "inactive" ? (
                <div className="space-y-3 text-sm leading-6 font-medium" style={mutedTextStyle}>
                  <p>{`Close "${roleStatusConfirm.role.name}"? This role will stop accepting new candidates/interviews. Existing candidates, reports, and interviews will remain viewable.`}</p>
                  <p>
                    Recordings associated with this role will remain available for <span className="font-bold">14 days</span> after closure, then will be <span className="font-bold">permanently deleted</span> if the role remains inactive.
                  </p>
                </div>
              ) : (
                <p className="text-sm leading-6 font-medium" style={mutedTextStyle}>
                  {`Reopen "${roleStatusConfirm.role.name}" and allow new candidates/interviews?`}
                </p>
              )}
            </div>
            <div className="px-6 py-4 border-t flex items-center justify-end gap-2" style={mutedPanelStyle}>
              <button
                type="button"
                onClick={() => setRoleStatusConfirm(null)}
                className="px-4 py-2 rounded-full text-xs font-bold border transition-colors"
                style={{ backgroundColor: "var(--as-surface)", borderColor: "var(--as-border)", color: "var(--as-text-muted)" }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  void updateRoleStatus(roleStatusConfirm.role, roleStatusConfirm.nextStatus);
                  setRoleStatusConfirm(null);
                }}
                className={`px-4 py-2 rounded-full text-xs font-bold text-white transition-opacity hover:opacity-90 ${
                  roleStatusConfirm.nextStatus === "inactive" ? "bg-[#0A1547]" : "bg-[#A380F6]"
                }`}
              >
                {roleStatusConfirm.nextStatus === "inactive" ? "Close Role" : "Reopen Role"}
              </button>
            </div>
          </div>
        </div>
      )}
      {roleDeleteConfirm && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 sm:p-6">
          <button
            type="button"
            onClick={() => setRoleDeleteConfirm(null)}
            className="absolute inset-0 bg-[#0A1547]/45"
            aria-label="Cancel role delete"
          />
          <div
            className="relative w-full max-w-md rounded-2xl overflow-hidden"
            style={modalSurfaceStyle}
            role="dialog"
            aria-modal="true"
            aria-labelledby="role-delete-confirm-title"
          >
            <div className="px-6 py-5 border-b" style={dividerStyle}>
              <h3 id="role-delete-confirm-title" className="text-base font-black" style={primaryTextStyle}>
                Delete role
              </h3>
            </div>
            <div className="px-6 py-5">
              <p className="text-sm leading-6 font-medium" style={mutedTextStyle}>
                {`Delete "${roleDeleteConfirm.role.name}"? This permanently removes the role. Existing related records may no longer be connected to this role in the same way. Use Close instead if you only want to stop accepting new candidates.`}
              </p>
            </div>
            <div className="px-6 py-4 border-t flex items-center justify-end gap-2" style={mutedPanelStyle}>
              <button
                type="button"
                onClick={() => setRoleDeleteConfirm(null)}
                className="px-4 py-2 rounded-full text-xs font-bold border transition-colors"
                style={{ backgroundColor: "var(--as-surface)", borderColor: "var(--as-border)", color: "var(--as-text-muted)" }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  void deleteRole(roleDeleteConfirm.role);
                  setRoleDeleteConfirm(null);
                }}
                className="px-4 py-2 rounded-full text-xs font-bold text-white bg-red-500 hover:bg-red-600 transition-colors"
              >
                Delete Role
              </button>
            </div>
          </div>
        </div>
      )}
      {rubricModalRole && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 sm:p-6">
          <button
            type="button"
            onClick={closeRubricModal}
            className="absolute inset-0 bg-[#0A1547]/45"
            aria-label="Close rubric modal"
          />
          <div
            className="relative w-full max-w-2xl max-h-[85vh] rounded-2xl overflow-hidden"
            style={modalSurfaceStyle}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b" style={dividerStyle}>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest" style={mutedTextStyle}>Rubric</p>
                <h3 className="text-sm font-black leading-snug" style={primaryTextStyle}>{rubricModalRole.name}</h3>
              </div>
              <button
                type="button"
                onClick={closeRubricModal}
                className="w-8 h-8 rounded-lg inline-flex items-center justify-center transition-colors as-shell-dropdown-item"
                style={mutedTextStyle}
                aria-label="Close rubric modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-5 py-4 overflow-y-auto max-h-[calc(85vh-72px)]">
              {rubricQuestions.length === 0 ? (
                <p className="text-sm font-semibold" style={mutedTextStyle}>No rubric questions available.</p>
              ) : (
                <ol className="list-decimal pl-5 text-sm space-y-2 font-semibold" style={primaryTextStyle}>
                  {rubricQuestions.map((question, idx) => (
                    <li key={`${rubricModalRole.id}-${idx}`}>{question}</li>
                  ))}
                </ol>
              )}
              <div className="mt-4">
                <label className="text-[10px] font-black uppercase tracking-widest block mb-1.5" style={mutedTextStyle}>
                  Request Changes
                </label>
                <textarea
                  value={rubricNotes}
                  onChange={(e) => setRubricNotes(e.target.value)}
                  placeholder="Add optional notes for rubric updates"
                  className="w-full min-h-[92px] px-3 py-2.5 rounded-xl border text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#A380F6]/25 focus:border-[#A380F6] transition-all"
                  style={fieldSurfaceStyle}
                />
                {rubricError && (
                  <p className="mt-2 text-xs text-red-500 font-semibold">{rubricError}</p>
                )}
              </div>
              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={closeRubricModal}
                  className="px-4 py-2 text-xs font-bold rounded-full border transition-colors"
                  style={{ backgroundColor: "var(--as-surface)", borderColor: "var(--as-border)", color: "var(--as-text-muted)" }}
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
            className="relative w-full max-w-5xl max-h-[92vh] rounded-2xl overflow-hidden"
            style={modalSurfaceStyle}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b" style={dividerStyle}>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest" style={mutedTextStyle}>Checkout</p>
                <h3 className="text-sm font-black leading-snug" style={primaryTextStyle}>Complete role creation purchase</h3>
              </div>
              <button
                type="button"
                onClick={closeEmbeddedCheckout}
                className="w-8 h-8 rounded-lg inline-flex items-center justify-center transition-colors as-shell-dropdown-item"
                style={mutedTextStyle}
                aria-label="Close checkout"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-5 py-4 overflow-y-auto max-h-[calc(92vh-72px)]">
              {embeddedCheckoutLoading && (
                <p className="mb-3 text-xs font-semibold" style={mutedTextStyle}>Loading checkout…</p>
              )}
              {embeddedCheckoutError && (
                <p className="mb-3 text-xs font-semibold text-red-500">{embeddedCheckoutError}</p>
              )}
              <div ref={embeddedCheckoutContainerRef} className="min-h-[520px]" />
              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={closeEmbeddedCheckout}
                  className="px-4 py-2 text-xs font-bold rounded-full border transition-colors"
                  style={{ backgroundColor: "var(--as-surface)", borderColor: "var(--as-border)", color: "var(--as-text-muted)" }}
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
