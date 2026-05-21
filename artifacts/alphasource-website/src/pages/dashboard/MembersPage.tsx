import { useEffect, useState } from "react";
import { Trash2, UserPlus, ChevronDown, ChevronUp, ChevronsUpDown, Key } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { useClient } from "@/context/ClientContext";
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
  if (!active) return <ChevronsUpDown className="w-3 h-3 text-[#0A1547]/20 flex-shrink-0" />;
  return dir === "asc"
    ? <ChevronUp   className="w-3 h-3 text-[#A380F6] flex-shrink-0" />
    : <ChevronDown className="w-3 h-3 text-[#A380F6] flex-shrink-0" />;
}

function isValidEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}

function isMemberManagerFallbackRole(role: string): boolean {
  return ["manager", "admin", "owner", "super_admin"].includes(role);
}

export default function MembersPage() {
  const {
    selectedClient,
    selectedClientId,
    loading: clientLoading,
    error: clientError,
    memberships,
    isGlobalAdmin,
  } = useClient();
  const clientName = selectedClient.id === "all" ? "All Clients" : selectedClient.name;
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
  const [sortKey, setSortKey]   = useState<SortKey | null>(null);
  const [sortDir, setSortDir]   = useState<SortDir>("asc");
  const [addingMember, setAddingMember] = useState(false);
  const [removingMembers, setRemovingMembers] = useState<Record<string, boolean>>({});
  const [resettingPasswords, setResettingPasswords] = useState<Record<string, boolean>>({});
  const [actionNotice, setActionNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  const nameErr  = submitted && name.trim() === "";
  const emailErr = submitted && !isValidEmail(email);

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
  }, [selectedClientId, clientLoading, clientError, canManageMembers]);

  useEffect(() => {
    setActionNotice(null);
    setRemovingMembers({});
    setResettingPasswords({});
    setAddingMember(false);
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

  const handleAdd = async () => {
    if (!canManageMembers) return;
    setSubmitted(true);
    if (!name.trim() || !isValidEmail(email)) return;
    if (!selectedClientId) return;
    if (!backendBase) {
      setActionNotice({ tone: "error", text: "Missing backend base URL configuration." });
      return;
    }

    const memberName = name.trim();
    const memberEmail = email.trim();
    setActionNotice(null);
    setAddingMember(true);

    try {
      const token = await getSessionToken();
      const response = await fetch(`${backendBase}/client-members`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        credentials: "omit",
        body: JSON.stringify({
          client_id: selectedClientId,
          email: memberEmail,
          name: memberName,
          role: role.toLowerCase(),
        }),
      });

      const text = await response.text();
      const data = parseJsonSafe(text) as { item?: unknown; error?: unknown; code?: unknown } | null;
      const code = typeof data?.code === "string"
        ? data.code
        : (typeof data?.error === "string" ? data.error : "");

      if (!response.ok) {
        if (response.status === 409 || code === "email_in_use" || code === "client_admin_email_in_use") {
          throw new Error("Email address already exists");
        }
        throw new Error(extractErrorMessage(text) || "Could not add member.");
      }

      const item = data && typeof data.item === "object" && data.item
        ? (data.item as Record<string, unknown>)
        : null;

      if (item) {
        const rawEmail = String(item.email || "").trim();
        const rawId = item.id ?? item.user_id ?? rawEmail;
        const rawIdText =
          typeof rawId === "string" || typeof rawId === "number"
            ? String(rawId).trim()
            : "";
        const nextMember: Member = {
          id: rawIdText || rawEmail || memberEmail,
          name: String(item.name || "").trim() || fallbackNameFromEmail(rawEmail || memberEmail),
          email: rawEmail || memberEmail,
          role: toMemberRole(item.role),
        };
        setMembers((prev) => [nextMember, ...prev.filter((m) => String(m.id) !== String(nextMember.id))]);
      } else {
        setMembers((prev) => [
          {
            id: memberEmail,
            name: memberName,
            email: memberEmail,
            role,
          },
          ...prev.filter((m) => String(m.id) !== memberEmail),
        ]);
      }

      setName("");
      setEmail("");
      setRole("Member");
      setSubmitted(false);
      setActionNotice({ tone: "success", text: "Member added." });
    } catch (error) {
      setActionNotice({
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
        className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-[#0A1547]/40 hover:text-[#0A1547]/70 transition-colors"
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
          className="bg-white rounded-2xl p-6"
          style={{ border: "1px solid rgba(10,21,71,0.07)", boxShadow: "0 2px 12px rgba(10,21,71,0.05)" }}
        >
          <p className="text-sm text-[#0A1547]/45 font-semibold">Loading member access...</p>
        </div>
      </DashboardLayout>
    );
  }

  if (!canManageMembers) {
    return (
      <DashboardLayout title="Members">
        <div
          className="bg-white rounded-2xl p-6"
          style={{ border: "1px solid rgba(10,21,71,0.07)", boxShadow: "0 2px 12px rgba(10,21,71,0.05)" }}
        >
          <h2 className="text-base font-black text-[#0A1547] mb-2">Members unavailable</h2>
          <p className="text-sm text-[#0A1547]/45 font-semibold">
            You do not have permission to manage members for this client.
          </p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Members">
      <div
        className="bg-white rounded-2xl overflow-hidden"
        style={{ border: "1px solid rgba(10,21,71,0.07)", boxShadow: "0 2px 12px rgba(10,21,71,0.05)" }}
      >
        {/* Panel header */}
        <div className="px-6 pt-6 pb-5 border-b border-gray-100">
          <h2 className="text-base font-black text-[#0A1547] mb-4">
            Client Members
            {selectedClient.id !== "all" && (
              <span className="ml-2 text-base font-semibold text-[#0A1547]/40">
                for {clientName}
              </span>
            )}
          </h2>
          {actionNotice && (
            <div
              className={`mb-4 rounded-xl px-3.5 py-2 text-xs font-semibold ${
                actionNotice.tone === "success"
                  ? "text-[#009E73] bg-[#02D99D]/10 border border-[#02D99D]/25"
                  : "text-red-500 bg-red-50 border border-red-200"
              }`}
              role="status"
              aria-live="polite"
            >
              {actionNotice.text}
            </div>
          )}

          {canManageMembers && (
            <div className="flex flex-wrap gap-3 items-start">
              {/* Name */}
              <div className="flex-1 min-w-[160px]">
                <input
                  type="text"
                  placeholder="Member name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") void handleAdd(); }}
                  disabled={addingMember}
                  className={`w-full px-4 py-2.5 rounded-xl text-sm bg-gray-50 border placeholder-gray-400 text-[#0A1547] focus:outline-none focus:ring-2 focus:ring-[#A380F6]/25 focus:border-[#A380F6] transition-all ${
                    nameErr ? "border-red-300 bg-red-50/40" : "border-gray-200"
                  }`}
                />
                {nameErr && (
                  <p className="mt-1 text-[10px] text-red-500 font-semibold px-1">Name is required</p>
                )}
              </div>

              {/* Email */}
              <div className="flex-1 min-w-[200px]">
                <input
                  type="email"
                  placeholder="Member email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") void handleAdd(); }}
                  disabled={addingMember}
                  className={`w-full px-4 py-2.5 rounded-xl text-sm bg-gray-50 border placeholder-gray-400 text-[#0A1547] focus:outline-none focus:ring-2 focus:ring-[#A380F6]/25 focus:border-[#A380F6] transition-all ${
                    emailErr ? "border-red-300 bg-red-50/40" : "border-gray-200"
                  }`}
                />
                {emailErr && (
                  <p className="mt-1 text-[10px] text-red-500 font-semibold px-1">Valid email required</p>
                )}
              </div>

              {/* Role */}
              <div className="w-40 relative">
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as MemberRole)}
                  disabled={addingMember}
                  className="w-full appearance-none px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-[#0A1547] text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#A380F6]/25 focus:border-[#A380F6] transition-all cursor-pointer pr-9"
                >
                  <option value="Member">Member</option>
                  <option value="Manager">Manager</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#0A1547]/40 pointer-events-none" />
              </div>

              {/* Add button */}
              <button
                onClick={() => { void handleAdd(); }}
                disabled={addingMember}
                className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white rounded-full transition-all hover:opacity-90 active:scale-[0.97] flex-shrink-0"
                style={{ backgroundColor: "#A380F6" }}
              >
                <UserPlus className="w-4 h-4" />
                {addingMember ? "Adding..." : "Add"}
              </button>
            </div>
          )}
        </div>

        {/* Members table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <ThSort col="name"  label="Name"   className="pl-6" />
                <ThSort col="email" label="Email"  />
                <ThSort col="role"  label="Role"   />
                {canManageMembers && (
                  <th className="px-4 py-3.5 text-center text-[10px] font-black uppercase tracking-widest text-[#0A1547]/40 whitespace-nowrap">
                    Reset Password
                  </th>
                )}
                {canManageMembers && (
                  <th className="px-4 py-3.5 pr-6 text-center text-[10px] font-black uppercase tracking-widest text-[#0A1547]/40 whitespace-nowrap">
                    Remove
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {clientLoading || membersLoading ? (
                <tr>
                  <td colSpan={columnCount} className="text-center py-14 text-sm text-[#0A1547]/30 font-semibold">
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
                  <td colSpan={columnCount} className="text-center py-14 text-sm text-[#0A1547]/30 font-semibold">
                    No members yet — add one above.
                  </td>
                </tr>
              ) : (
                sorted.map((m, idx) => {
                  const selfMember = isSelfMember(m);
                  return (
                  <tr
                    key={m.id}
                    className="border-b border-gray-50 hover:bg-gray-50/60 transition-colors"
                    style={idx === sorted.length - 1 ? { borderBottom: "none" } : {}}
                  >
                    {/* Name + email sub-line */}
                    <td className="px-4 py-4 pl-6">
                      <p className="font-bold text-[#0A1547] text-sm leading-snug">{m.name}</p>
                      <p className="text-[11px] text-[#0A1547]/35 mt-0.5 md:hidden">{m.email}</p>
                    </td>

                    {/* Email */}
                    <td className="px-4 py-4 hidden md:table-cell">
                      <span className="text-sm text-[#0A1547]/55 font-medium">{m.email}</span>
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
                          className="p-2 rounded-lg text-[#0A1547]/25 hover:text-[#A380F6] hover:bg-[#A380F6]/10 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
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
                          className="p-2 rounded-lg text-[#0A1547]/25 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
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
        <div className="px-6 py-3 border-t border-gray-100">
          <p className="text-[11px] text-[#0A1547]/35 font-semibold">
            {sorted.length} member{sorted.length !== 1 ? "s" : ""}
          </p>
        </div>
      </div>
    </DashboardLayout>
  );
}
