import { useEffect, useState } from "react";
import { Trash2, UserPlus, ChevronDown, ChevronUp, ChevronsUpDown, Key } from "lucide-react";
import CurrentScopeBanner from "@/components/CurrentScopeBanner";
import DashboardLayout from "@/components/DashboardLayout";
import { useClient, type Client, type ClientMembership } from "@/context/ClientContext";
import { supabase } from "@/lib/supabaseClient";

type MemberRole = "Manager" | "Member";
type SortKey = "name" | "email" | "role";
type SortDir = "asc" | "desc";

interface Member {
  id: string | number;
  name: string;
  email: string;
  role: MemberRole;
}

interface BatchMemberResult {
  client_id?: string;
  ok?: boolean;
  status?: string;
  detail?: string;
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

const backendBase = firstBase(
  (env as Record<string, unknown>).VITE_BACKEND_URL,
  (env as Record<string, unknown>).VITE_API_URL,
  (env as Record<string, unknown>).VITE_PUBLIC_BACKEND_URL,
  (env as Record<string, unknown>).PUBLIC_BACKEND_URL,
  (env as Record<string, unknown>).BACKEND_URL,
);

function extractErrorMessage(text: string): string {
  if (!text) return "Failed to load members.";
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

function toMemberRole(value: unknown): MemberRole {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "manager" || normalized === "admin") return "Manager";
  return "Member";
}

function fallbackNameFromEmail(email: string): string {
  const local = String(email || "").split("@")[0] || "";
  return local.trim() || "Unnamed Member";
}

const roleStyle: Record<MemberRole, { bg: string; text: string }> = {
  Manager: { bg: "rgba(163,128,246,0.12)", text: "#7C5FCC" },
  Member:  { bg: "rgba(2,171,224,0.12)",   text: "#0285B0" },
};

const surfaceCardStyle = {
  backgroundColor: "var(--as-surface)",
  border: "1px solid var(--as-border)",
  boxShadow: "var(--as-shadow)",
};
const modalSurfaceStyle = {
  backgroundColor: "var(--as-surface)",
  border: "1px solid var(--as-border)",
  boxShadow: "0 20px 60px rgba(10,21,71,0.22)",
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

function RoleBadge({ role }: { role: MemberRole }) {
  const s = roleStyle[role];
  return (
    <span
      className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold"
      style={{ backgroundColor: s.bg, color: s.text }}
    >
      {role}
    </span>
  );
}

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <ChevronsUpDown className="w-3 h-3 flex-shrink-0" style={subtleTextStyle} />;
  return dir === "asc"
    ? <ChevronUp   className="w-3 h-3 text-[#A380F6] flex-shrink-0" />
    : <ChevronDown className="w-3 h-3 text-[#A380F6] flex-shrink-0" />;
}

function isValidEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}

function isMemberManagerFallbackRole(role: string): boolean {
  return ["manager", "admin", "owner", "super_admin"].includes(normalizeClientRole(role));
}

function normalizeClientRole(role: unknown): string {
  const normalized = String(role || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  return normalized === "superadmin" ? "super_admin" : normalized;
}

function getClientMembershipRole(client: Client, memberships: ClientMembership[]): string {
  const membershipRole = memberships.find((membership) => membership.client_id === client.id)?.role;
  return normalizeClientRole(membershipRole || client.role || "");
}

function canManageClientScope(client: Client, memberships: ClientMembership[], isGlobalAdmin: boolean): boolean {
  if (!client.id || client.id === "all") return false;
  if (isGlobalAdmin) return true;
  const permission = client.permissions?.can_manage_members;
  if (permission === true) return true;
  if (permission === false) return false;
  return isMemberManagerFallbackRole(getClientMembershipRole(client, memberships));
}

function displayEntityLabel(label: unknown): string {
  const normalized = String(label || "").trim();
  if (!normalized) return "";
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function scopeMetadata(client: Client): string {
  const parts: string[] = [];
  if (client.is_child_client || client.parent_client_id) {
    parts.push(displayEntityLabel(client.entity_label) || "Child entity");
  } else {
    parts.push("Parent client");
  }
  if (client.inherited) parts.push("Inherited access");
  return parts.join(" · ");
}

function scopeSearchText(client: Client): string {
  return [
    client.name,
    client.role,
    client.entity_label,
    client.is_child_client || client.parent_client_id ? "child entity" : "parent client",
    client.inherited ? "inherited access" : "",
  ]
    .join(" ")
    .toLowerCase();
}

function countBatchStatuses(items: BatchMemberResult[]) {
  return items.reduce(
    (counts, item) => {
      const status = String(item.status || "").trim();
      if (status === "created") counts.created += 1;
      else if (status === "already_exists") counts.alreadyExists += 1;
      else if (status === "forbidden") counts.forbidden += 1;
      else if (status === "failed") counts.failed += 1;
      return counts;
    },
    { created: 0, alreadyExists: 0, forbidden: 0, failed: 0 },
  );
}

function buildBatchSummary(items: BatchMemberResult[]): string {
  const counts = countBatchStatuses(items);
  const parts: string[] = [];
  if (counts.created) parts.push(`${counts.created} created`);
  if (counts.alreadyExists) parts.push(`${counts.alreadyExists} already assigned`);
  if (counts.forbidden) parts.push(`${counts.forbidden} forbidden`);
  if (counts.failed) parts.push(`${counts.failed} failed`);
  return parts.length ? parts.join(" · ") : "No scopes were updated.";
}

export default function MembersPage() {
  const {
    clients,
    selectedClient,
    selectedClientId,
    loading: clientLoading,
    error: clientError,
    memberships,
    isGlobalAdmin,
  } = useClient();
  const selectedMembershipRole = String(
    memberships.find((membership) => membership.client_id === selectedClientId)?.role ||
      selectedClient.role ||
      "",
  )
    .trim()
    .toLowerCase();
  const memberManagementPermission = selectedClient.permissions?.can_manage_members;
  const canManageMembers =
    isGlobalAdmin ||
    memberManagementPermission === true ||
    (memberManagementPermission !== false && isMemberManagerFallbackRole(selectedMembershipRole));
  const canResetPassword = canManageMembers;

  const [members, setMembers]   = useState<Member[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [membersError, setMembersError] = useState("");
  const [currentUserId, setCurrentUserId] = useState("");
  const [currentUserEmail, setCurrentUserEmail] = useState("");
  const [name, setName]         = useState("");
  const [email, setEmail]       = useState("");
  const [role, setRole]         = useState<MemberRole>("Member");
  const [submitted, setSubmitted] = useState(false);
  const [memberModalOpen, setMemberModalOpen] = useState(false);
  const [modalNotice, setModalNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [scopeSearch, setScopeSearch] = useState("");
  const [selectedScopeIds, setSelectedScopeIds] = useState<string[]>([]);
  const [sortKey, setSortKey]   = useState<SortKey | null>(null);
  const [sortDir, setSortDir]   = useState<SortDir>("asc");
  const [addingMember, setAddingMember] = useState(false);
  const [removingMembers, setRemovingMembers] = useState<Record<string, boolean>>({});
  const [resettingPasswords, setResettingPasswords] = useState<Record<string, boolean>>({});
  const [actionNotice, setActionNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [membersReloadKey, setMembersReloadKey] = useState(0);

  const nameErr  = submitted && name.trim() === "";
  const emailErr = submitted && !isValidEmail(email);
  const assignableScopes = clients.filter((client) => canManageClientScope(client, memberships, isGlobalAdmin));
  const assignableScopeIdSet = new Set(assignableScopes.map((client) => client.id));
  const selectedAssignableScopeIds = selectedScopeIds.filter((clientId) => assignableScopeIdSet.has(clientId));
  const scopeErr = submitted && selectedAssignableScopeIds.length === 0;
  const normalizedScopeSearch = scopeSearch.trim().toLowerCase();
  const filteredAssignableScopes = normalizedScopeSearch
    ? assignableScopes.filter((client) => scopeSearchText(client).includes(normalizedScopeSearch))
    : assignableScopes;

  useEffect(() => {
    let alive = true;

    const loadMembers = async () => {
      if (clientLoading) return;
      if (!canManageMembers) {
        if (!alive) return;
        setMembers([]);
        setMembersError("");
        setMembersLoading(false);
        return;
      }
      if (clientError) {
        if (!alive) return;
        setMembers([]);
        setMembersError(clientError);
        setMembersLoading(false);
        return;
      }
      if (!selectedClientId) {
        if (!alive) return;
        setMembers([]);
        setMembersError("");
        setMembersLoading(false);
        return;
      }
      if (!backendBase) {
        if (!alive) return;
        setMembers([]);
        setMembersError("Missing backend base URL configuration.");
        setMembersLoading(false);
        return;
      }

      if (!alive) return;
      setMembersLoading(true);
      setMembersError("");

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const activeUserId = String(session?.user?.id || "").trim();
        const activeUserEmail = String(session?.user?.email || "").trim().toLowerCase();
        if (alive) {
          setCurrentUserId(activeUserId);
          setCurrentUserEmail(activeUserEmail);
        }
        const token = String(session?.access_token || "").trim();
        if (!token) throw new Error("Missing session token.");

        const response = await fetch(
          `${backendBase}/client-members?client_id=${encodeURIComponent(selectedClientId)}`,
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
          ? (payload as { items: unknown[] }).items
          : [];

        const mappedMembers: Member[] = items
          .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"))
          .map((item, index) => {
            const rawEmail = String(item.email || "").trim();
            const rawId = item.id ?? item.user_id ?? rawEmail;
            const rawIdText =
              typeof rawId === "string" || typeof rawId === "number"
                ? String(rawId).trim()
                : "";
            const id = rawIdText || `member-${index + 1}`;
            const nameValue = String(item.name || "").trim() || fallbackNameFromEmail(rawEmail);
            return {
              id,
              name: nameValue,
              email: rawEmail || "—",
              role: toMemberRole(item.role),
            };
          });

        if (!alive) return;
        setMembers(mappedMembers);
      } catch (error) {
        if (!alive) return;
        setMembers([]);
        setMembersError(error instanceof Error ? error.message : "Failed to load members.");
      } finally {
        if (alive) setMembersLoading(false);
      }
    };

    void loadMembers();
    return () => {
      alive = false;
    };
  }, [selectedClientId, clientLoading, clientError, canManageMembers, membersReloadKey]);

  useEffect(() => {
    setActionNotice(null);
    setRemovingMembers({});
    setResettingPasswords({});
    setAddingMember(false);
    setMemberModalOpen(false);
    setScopeSearch("");
    setSubmitted(false);
    setModalNotice(null);
  }, [selectedClientId, clientLoading, clientError, canManageMembers]);

  useEffect(() => {
    if (!actionNotice) return;
    const timer = setTimeout(() => setActionNotice(null), 3200);
    return () => clearTimeout(timer);
  }, [actionNotice]);

  const getSessionToken = async (): Promise<string> => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const token = String(session?.access_token || "").trim();
    if (!token) throw new Error("Missing session token.");
    return token;
  };

  const resetAddMemberForm = () => {
    setName("");
    setEmail("");
    setRole("Member");
    setSubmitted(false);
    setScopeSearch("");
    setSelectedScopeIds([]);
    setModalNotice(null);
  };

  const openAddMemberModal = () => {
    setActionNotice(null);
    setModalNotice(null);
    setSubmitted(false);
    setScopeSearch("");
    const defaultScopeId = assignableScopes.some((client) => client.id === selectedClientId)
      ? selectedClientId
      : "";
    setSelectedScopeIds(defaultScopeId ? [defaultScopeId] : []);
    setMemberModalOpen(true);
  };

  const closeAddMemberModal = () => {
    if (addingMember) return;
    setMemberModalOpen(false);
    resetAddMemberForm();
  };

  const toggleScope = (clientId: string) => {
    setModalNotice(null);
    setSelectedScopeIds((prev) => (
      prev.includes(clientId)
        ? prev.filter((id) => id !== clientId)
        : [...prev, clientId]
    ));
  };

  const handleAdd = async () => {
    if (!canManageMembers) return;
    setSubmitted(true);
    if (!name.trim() || !isValidEmail(email)) return;
    const submitScopeIds = Array.from(
      new Set(
        selectedScopeIds
          .map((clientId) => String(clientId || "").trim())
          .filter((clientId) => clientId && assignableScopeIdSet.has(clientId)),
      ),
    );
    if (submitScopeIds.length === 0) {
      setModalNotice({ tone: "error", text: "Select at least one manageable scope." });
      return;
    }
    if (!backendBase) {
      setModalNotice({ tone: "error", text: "Missing backend base URL configuration." });
      return;
    }

    const memberName = name.trim();
    const memberEmail = email.trim();
    setActionNotice(null);
    setModalNotice(null);
    setAddingMember(true);

    try {
      const token = await getSessionToken();
      const response = await fetch(`${backendBase}/client-members/batch`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        credentials: "omit",
        body: JSON.stringify({
          client_ids: submitScopeIds,
          email: memberEmail,
          name: memberName,
          role: role.toLowerCase(),
        }),
      });

      const text = await response.text();
      const data = parseJsonSafe(text) as { items?: unknown; error?: unknown; code?: unknown } | null;
      const code = typeof data?.code === "string"
        ? data.code
        : (typeof data?.error === "string" ? data.error : "");
      const items = Array.isArray(data?.items)
        ? data.items.filter((item): item is BatchMemberResult => Boolean(item && typeof item === "object"))
        : [];
      const counts = countBatchStatuses(items);
      const summary = buildBatchSummary(items);

      if (!response.ok) {
        if (items.length > 0) {
          setMembersReloadKey((value) => value + 1);
          if (counts.created > 0) {
            setMemberModalOpen(false);
            resetAddMemberForm();
            setActionNotice({ tone: "success", text: `Member assignment complete: ${summary}.` });
          } else {
            setModalNotice({ tone: "error", text: `No memberships created: ${summary}.` });
          }
          return;
        }
        if (response.status === 409 || code === "email_in_use" || code === "client_admin_email_in_use") {
          setModalNotice({ tone: "error", text: "Email address already exists" });
          return;
        }
        setModalNotice({ tone: "error", text: extractErrorMessage(text) || "Could not add member." });
        return;
      }

      setMembersReloadKey((value) => value + 1);
      if (counts.created > 0) {
        setMemberModalOpen(false);
        resetAddMemberForm();
        setActionNotice({ tone: "success", text: `Member assignment complete: ${summary}.` });
      } else {
        setModalNotice({ tone: "error", text: `No memberships created: ${summary}.` });
      }
    } catch (error) {
      setModalNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "Could not add member.",
      });
    } finally {
      setAddingMember(false);
    }
  };

  const handleRemove = async (id: string | number) => {
    if (!canManageMembers) return;
    if (!selectedClientId) return;
    if (!backendBase) {
      setActionNotice({ tone: "error", text: "Missing backend base URL configuration." });
      return;
    }

    const memberId = String(id);
    setActionNotice(null);
    setRemovingMembers((prev) => ({ ...prev, [memberId]: true }));

    try {
      const token = await getSessionToken();
      const response = await fetch(
        `${backendBase}/client-members/${encodeURIComponent(memberId)}?client_id=${encodeURIComponent(selectedClientId)}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
          credentials: "omit",
        },
      );

      const text = await response.text();
      const data = parseJsonSafe(text) as { code?: unknown; error?: unknown } | null;
      const code = typeof data?.code === "string" ? data.code : "";

      if (!response.ok) {
        if (code === "self_delete_forbidden") {
          throw new Error("Not allowed to delete yourself");
        }
        throw new Error(extractErrorMessage(text) || "Could not remove member.");
      }

      setMembers((prev) => prev.filter((m) => String(m.id) !== memberId));
      setActionNotice({ tone: "success", text: "Member removed." });
    } catch (error) {
      setActionNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "Could not remove member.",
      });
    } finally {
      setRemovingMembers((prev) => ({ ...prev, [memberId]: false }));
    }
  };

  const handleResetPassword = async (id: string | number, emailValue: string) => {
    if (!canResetPassword) return;
    if (!selectedClientId) return;
    if (!backendBase) {
      setActionNotice({ tone: "error", text: "Missing backend base URL configuration." });
      return;
    }

    const memberId = String(id || "").trim();
    const email = String(emailValue || "").trim();
    if (!memberId || !email || email === "—") {
      setActionNotice({ tone: "error", text: "Member email is required for password reset." });
      return;
    }

    setActionNotice(null);
    setResettingPasswords((prev) => ({ ...prev, [memberId]: true }));

    try {
      const token = await getSessionToken();
      const response = await fetch(`${backendBase}/client-members/send-password-reset`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        credentials: "omit",
        body: JSON.stringify({
          client_id: selectedClientId,
          email,
        }),
      });
      const text = await response.text();
      if (!response.ok) {
        throw new Error(extractErrorMessage(text) || "Could not send password reset.");
      }
      setActionNotice({ tone: "success", text: "Password reset email sent." });
    } catch (error) {
      setActionNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "Could not send password reset.",
      });
    } finally {
      setResettingPasswords((prev) => ({ ...prev, [memberId]: false }));
    }
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const sorted = sortKey
    ? [...members].sort((a, b) => {
        const av = a[sortKey];
        const bv = b[sortKey];
        const cmp = av.localeCompare(bv);
        return sortDir === "asc" ? cmp : -cmp;
      })
    : members;
  const isSelfMember = (member: Member): boolean => {
    const memberId = String(member.id || "").trim();
    const memberEmail = String(member.email || "").trim().toLowerCase();
    return Boolean(
      (currentUserId && memberId === currentUserId) ||
      (currentUserEmail && memberEmail !== "—" && memberEmail === currentUserEmail)
    );
  };

  const ThSort = ({ col, label, className = "" }: { col: SortKey; label: string; className?: string }) => (
    <th className={`px-4 py-3.5 whitespace-nowrap text-left ${className}`}>
      <button
        onClick={() => handleSort(col)}
        className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest transition-colors"
        style={mutedTextStyle}
      >
        {label}
        <SortIcon active={sortKey === col} dir={sortDir} />
      </button>
    </th>
  );

  const columnCount = canManageMembers ? 5 : 3;

  if (clientLoading) {
    return (
      <DashboardLayout title="Members">
        <div
          className="rounded-2xl p-6"
          style={surfaceCardStyle}
        >
          <p className="text-sm font-semibold" style={mutedTextStyle}>Loading member access...</p>
        </div>
      </DashboardLayout>
    );
  }

  if (!canManageMembers) {
    return (
      <DashboardLayout title="Members">
        <div
          className="rounded-2xl p-6"
          style={surfaceCardStyle}
        >
          <h2 className="text-base font-black mb-2" style={primaryTextStyle}>Members unavailable</h2>
          <p className="text-sm font-semibold" style={mutedTextStyle}>
            You do not have permission to manage members for this client.
          </p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Members">
      <CurrentScopeBanner client={selectedClient} />

      <div
        className="rounded-2xl overflow-hidden"
        style={surfaceCardStyle}
      >
        {/* Panel header */}
        <div className="px-6 pt-6 pb-5 border-b" style={dividerStyle}>
          <h2 className="text-base font-black mb-4" style={primaryTextStyle}>
            Client Members
          </h2>
          {actionNotice && (
            <div
              className={`mb-4 rounded-xl px-3.5 py-2 text-xs font-semibold ${
                actionNotice.tone === "success"
                  ? "text-[#009E73] bg-[#02D99D]/10 border border-[#02D99D]/25"
                  : "text-red-500 bg-red-50 border border-red-200 dark:text-red-300 dark:bg-red-500/10 dark:border-red-500/25"
              }`}
              role="status"
              aria-live="polite"
            >
              {actionNotice.text}
            </div>
          )}

          {canManageMembers && (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs font-semibold" style={mutedTextStyle}>
                Add managers or members to one or more client scopes.
              </p>
              <button
                onClick={openAddMemberModal}
                className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white rounded-full transition-all hover:opacity-90 active:scale-[0.97] flex-shrink-0"
                style={{ backgroundColor: "#A380F6" }}
              >
                <UserPlus className="w-4 h-4" />
                Add member
              </button>
            </div>
          )}
        </div>

        {/* Members table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b" style={dividerStyle}>
                <ThSort col="name"  label="Name"   className="pl-6" />
                <ThSort col="email" label="Email"  />
                <ThSort col="role"  label="Role"   />
                {canManageMembers && (
                  <th className="px-4 py-3.5 text-center text-[10px] font-black uppercase tracking-widest whitespace-nowrap" style={mutedTextStyle}>
                    Reset Password
                  </th>
                )}
                {canManageMembers && (
                  <th className="px-4 py-3.5 pr-6 text-center text-[10px] font-black uppercase tracking-widest whitespace-nowrap" style={mutedTextStyle}>
                    Remove
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {clientLoading || membersLoading ? (
                <tr>
                  <td colSpan={columnCount} className="text-center py-14 text-sm font-semibold" style={subtleTextStyle}>
                    Loading members...
                  </td>
                </tr>
              ) : clientError || membersError ? (
                <tr>
                  <td colSpan={columnCount} className="text-center py-14 text-sm text-red-500 font-semibold">
                    {clientError || membersError}
                  </td>
                </tr>
              ) : sorted.length === 0 ? (
                <tr>
                  <td colSpan={columnCount} className="text-center py-14 text-sm font-semibold" style={subtleTextStyle}>
                    No members yet — add one above.
                  </td>
                </tr>
              ) : (
                sorted.map((m, idx) => {
                  const selfMember = isSelfMember(m);
                  return (
                  <tr
                    key={m.id}
                    className="border-b as-shell-dropdown-item transition-colors"
                    style={idx === sorted.length - 1 ? { borderBottom: "none" } : dividerStyle}
                  >
                    {/* Name + email sub-line */}
                    <td className="px-4 py-4 pl-6">
                      <p className="font-bold text-sm leading-snug" style={primaryTextStyle}>{m.name}</p>
                      <p className="text-[11px] mt-0.5 md:hidden" style={subtleTextStyle}>{m.email}</p>
                    </td>

                    {/* Email */}
                    <td className="px-4 py-4 hidden md:table-cell">
                      <span className="text-sm font-medium" style={mutedTextStyle}>{m.email}</span>
                    </td>

                    {/* Role badge */}
                    <td className="px-4 py-4">
                      <RoleBadge role={m.role} />
                    </td>

                    {canManageMembers && (
                      <td className="px-4 py-4 text-center">
                        <button
                          onClick={() => { void handleResetPassword(m.id, m.email); }}
                          disabled={Boolean(resettingPasswords[String(m.id)])}
                          className="p-2 rounded-lg text-[#0A1547]/25 dark:text-slate-400/45 hover:text-[#A380F6] hover:bg-[#A380F6]/10 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                          title={resettingPasswords[String(m.id)] ? "Sending password reset..." : `Send password reset to ${m.name}`}
                          aria-label={resettingPasswords[String(m.id)] ? `Sending password reset to ${m.name}` : `Send password reset to ${m.name}`}
                        >
                          <Key className={`w-4 h-4 ${resettingPasswords[String(m.id)] ? "animate-spin" : ""}`} />
                        </button>
                      </td>
                    )}

                    {/* Remove */}
                    {canManageMembers && (
                      <td className="px-4 py-4 pr-6 text-center">
                        <button
                          onClick={() => { void handleRemove(m.id); }}
                          disabled={selfMember || Boolean(removingMembers[String(m.id)])}
                          className="p-2 rounded-lg text-[#0A1547]/25 dark:text-slate-400/45 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                          aria-label={selfMember ? `Cannot remove ${m.name}` : `Remove ${m.name}`}
                          title={selfMember ? "You cannot remove yourself" : `Remove ${m.name}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    )}
                  </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer count */}
        <div className="px-6 py-3 border-t" style={dividerStyle}>
          <p className="text-[11px] font-semibold" style={subtleTextStyle}>
            {sorted.length} member{sorted.length !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {memberModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#0A1547]/35 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Add member"
        >
          <div
            className="w-full max-w-2xl rounded-2xl overflow-hidden"
            style={modalSurfaceStyle}
          >
            <div className="flex items-center justify-between gap-4 px-6 py-4 border-b" style={dividerStyle}>
              <div>
                <h3 className="text-base font-black" style={primaryTextStyle}>Add member</h3>
                <p className="text-xs font-semibold mt-0.5" style={mutedTextStyle}>
                  Assign direct access to selected client scopes.
                </p>
              </div>
              <button
                type="button"
                onClick={closeAddMemberModal}
                disabled={addingMember}
                className="px-3 py-1.5 rounded-lg text-xs font-bold text-[#0A1547]/45 dark:text-slate-300/65 hover:text-[#0A1547] dark:hover:text-white hover:bg-gray-50 dark:hover:bg-white/5 disabled:opacity-50"
              >
                Close
              </button>
            </div>

            <div className="max-h-[72vh] overflow-y-auto px-6 py-5 space-y-4">
              {modalNotice && (
                <div
                  className={`rounded-xl px-3.5 py-2 text-xs font-semibold ${
                    modalNotice.tone === "success"
                      ? "text-[#009E73] bg-[#02D99D]/10 border border-[#02D99D]/25"
                      : "text-red-500 bg-red-50 border border-red-200 dark:text-red-300 dark:bg-red-500/10 dark:border-red-500/25"
                  }`}
                  role="status"
                  aria-live="polite"
                >
                  {modalNotice.text}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest mb-1.5" style={mutedTextStyle}>
                    Name
                  </label>
                  <input
                    type="text"
                    placeholder="Member name"
                    value={name}
                    onChange={(e) => {
                      setModalNotice(null);
                      setName(e.target.value);
                    }}
                    disabled={addingMember}
                    className="w-full px-4 py-2.5 rounded-xl text-sm border placeholder-gray-400 dark:placeholder:text-slate-400/45 focus:outline-none focus:ring-2 focus:ring-[#A380F6]/25 focus:border-[#A380F6] transition-all"
                    style={nameErr ? { ...fieldSurfaceStyle, borderColor: "#FCA5A5" } : fieldSurfaceStyle}
                  />
                  {nameErr && (
                    <p className="mt-1 text-[10px] text-red-500 font-semibold px-1">Name is required</p>
                  )}
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest mb-1.5" style={mutedTextStyle}>
                    Email
                  </label>
                  <input
                    type="email"
                    placeholder="Member email"
                    value={email}
                    onChange={(e) => {
                      setModalNotice(null);
                      setEmail(e.target.value);
                    }}
                    disabled={addingMember}
                    className="w-full px-4 py-2.5 rounded-xl text-sm border placeholder-gray-400 dark:placeholder:text-slate-400/45 focus:outline-none focus:ring-2 focus:ring-[#A380F6]/25 focus:border-[#A380F6] transition-all"
                    style={emailErr ? { ...fieldSurfaceStyle, borderColor: "#FCA5A5" } : fieldSurfaceStyle}
                  />
                  {emailErr && (
                    <p className="mt-1 text-[10px] text-red-500 font-semibold px-1">Valid email required</p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest mb-1.5" style={mutedTextStyle}>
                  Role
                </label>
                <div className="w-full md:w-48 relative">
                  <select
                    value={role}
                    onChange={(e) => {
                      setModalNotice(null);
                      setRole(e.target.value as MemberRole);
                    }}
                    disabled={addingMember}
                    className="w-full appearance-none px-4 py-2.5 rounded-xl border text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#A380F6]/25 focus:border-[#A380F6] transition-all cursor-pointer pr-9"
                    style={fieldSurfaceStyle}
                  >
                    <option value="Member">Member</option>
                    <option value="Manager">Manager</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none" style={mutedTextStyle} />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between gap-3 mb-2">
                  <label className="block text-[10px] font-black uppercase tracking-widest" style={mutedTextStyle}>
                    Assign scopes
                  </label>
                  <span className="text-[10px] font-bold" style={subtleTextStyle}>
                    {selectedAssignableScopeIds.length} selected
                  </span>
                </div>
                <input
                  type="search"
                  placeholder="Search clients..."
                  value={scopeSearch}
                  onChange={(e) => {
                    setModalNotice(null);
                    setScopeSearch(e.target.value);
                  }}
                  disabled={addingMember}
                  className="w-full px-4 py-2.5 rounded-xl text-sm border placeholder-gray-400 dark:placeholder:text-slate-400/45 focus:outline-none focus:ring-2 focus:ring-[#A380F6]/25 focus:border-[#A380F6] transition-all mb-2"
                  style={fieldSurfaceStyle}
                />
                <div
                  className="rounded-xl border max-h-56 overflow-y-auto"
                  style={scopeErr ? { ...mutedPanelStyle, borderColor: "#FCA5A5" } : mutedPanelStyle}
                >
                  {filteredAssignableScopes.length === 0 ? (
                    <div className="px-4 py-6 text-center text-xs font-semibold" style={subtleTextStyle}>
                      No manageable scopes found.
                    </div>
                  ) : (
                    filteredAssignableScopes.map((client) => {
                      const checked = selectedScopeIds.includes(client.id);
                      return (
                        <label
                          key={client.id}
                          className="flex items-start gap-3 px-4 py-3 border-b last:border-b-0 as-shell-dropdown-item transition-colors cursor-pointer"
                          style={dividerStyle}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleScope(client.id)}
                            disabled={addingMember}
                            className="mt-1 h-4 w-4 rounded border-gray-300 text-[#A380F6] focus:ring-[#A380F6]"
                          />
                          <span className="min-w-0">
                            <span className="block text-sm font-bold truncate" style={primaryTextStyle}>{client.name}</span>
                            <span className="block text-[11px] font-semibold mt-0.5" style={mutedTextStyle}>
                              {scopeMetadata(client)}
                            </span>
                          </span>
                        </label>
                      );
                    })
                  )}
                </div>
                {scopeErr && (
                  <p className="mt-1 text-[10px] text-red-500 font-semibold px-1">Select at least one scope</p>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t" style={{ ...dividerStyle, backgroundColor: "var(--as-surface-muted)" }}>
              <button
                type="button"
                onClick={closeAddMemberModal}
                disabled={addingMember}
                className="px-4 py-2 rounded-full text-sm font-bold text-[#0A1547]/55 dark:text-slate-300/70 hover:text-[#0A1547] dark:hover:text-white hover:bg-white dark:hover:bg-white/5 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => { void handleAdd(); }}
                disabled={addingMember}
                className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white rounded-full transition-all hover:opacity-90 active:scale-[0.97] disabled:opacity-60"
                style={{ backgroundColor: "#A380F6" }}
              >
                <UserPlus className="w-4 h-4" />
                {addingMember ? "Adding..." : "Add member"}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
