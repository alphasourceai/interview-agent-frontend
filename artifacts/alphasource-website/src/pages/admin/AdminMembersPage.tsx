import { useState, useEffect, useMemo } from "react";
import { Trash2, ChevronDown, ChevronUp, Key } from "lucide-react";
import AdminLayout from "@/components/AdminLayout";
import { useAdminClient, type AdminClient } from "@/context/AdminClientContext";
import { supabase } from "@/lib/supabaseClient";

/* ── Types ───────────────────────────────────────────────────── */
type MemberRole = "Super Admin" | "Manager" | "Member";
type SortKey    = "name" | "role" | "client";
type SortDir    = "asc"  | "desc";

interface Member {
  id: string;
  rowKey: string;
  clientId: string;
  clientName: string;
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

function parseJsonSafe(text: string): unknown {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function extractErrorMessage(text: string): string {
  if (!text) return "Failed to load members.";
  const data = parseJsonSafe(text);
  const detail =
    data && typeof data === "object"
      ? (data as { detail?: unknown }).detail ??
        (data as { message?: unknown }).message ??
        (data as { error?: unknown }).error
      : null;
  if (typeof detail === "string" && detail.trim()) return detail;
  return text;
}

function normalizeMemberRole(value: unknown): MemberRole {
  const role = String(value || "").trim().toLowerCase();
  if (role === "super_admin" || role === "superadmin") return "Super Admin";
  if (role === "manager" || role === "admin" || role === "tester") return "Manager";
  return "Member";
}

function isValidEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}

const roleStyle: Record<MemberRole, { bg: string; text: string }> = {
  "Super Admin": { bg: "rgba(10,21,71,0.09)", text: "#0A1547" },
  Manager:       { bg: "rgba(163,128,246,0.12)", text: "#7C5FCC" },
  Member:        { bg: "rgba(2,171,224,0.12)",   text: "#0285B0" },
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

const inputCls =
  "w-full px-3 py-2.5 rounded-xl text-sm bg-gray-50 border text-[#0A1547] font-medium " +
  "placeholder:text-[#0A1547]/30 focus:outline-none focus:ring-2 focus:ring-[#A380F6]/20 " +
  "focus:border-[#A380F6] transition-all";

function displayEntityLabel(label: unknown): string {
  const value = String(label || "").trim();
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : "Entity";
}

function roleToPayload(role: MemberRole): "member" | "manager" | "super_admin" {
  if (role === "Super Admin") return "super_admin";
  if (role === "Manager") return "manager";
  return "member";
}

function summarizeBatchItems(items: unknown[]): { created: number; alreadyExists: number; failed: number } {
  return items.reduce<{ created: number; alreadyExists: number; failed: number }>(
    (counts, item) => {
      const row = item && typeof item === "object" ? (item as { ok?: unknown; status?: unknown }) : null;
      const status = String(row?.status || "").trim();
      if (status === "created" || row?.ok === true) counts.created += 1;
      else if (status === "already_exists") counts.alreadyExists += 1;
      else counts.failed += 1;
      return counts;
    },
    { created: 0, alreadyExists: 0, failed: 0 },
  );
}

function formatBatchSummary(counts: { created: number; alreadyExists: number; failed: number }): string {
  const parts = [];
  if (counts.created) parts.push(`${counts.created} created`);
  if (counts.alreadyExists) parts.push(`${counts.alreadyExists} already assigned`);
  if (counts.failed) parts.push(`${counts.failed} failed`);
  return parts.length ? parts.join(", ") : "No memberships created";
}

export default function AdminMembersPage() {
  const {
    selectedClientId,
    clients: adminClients,
    loading: adminClientsLoading,
    error: adminClientsError,
  } = useAdminClient();

  const [members, setMembers]     = useState<Member[]>([]);
  const [membersLoading, setMembersLoading] = useState<boolean>(false);
  const [membersError, setMembersError] = useState<string>("");
  const [memberSearch, setMemberSearch] = useState("");
  const [name, setName]           = useState("");
  const [email, setEmail]         = useState("");
  const [role, setRole]           = useState<MemberRole>("Member");
  const [submitted, setSubmitted] = useState(false);
  const [memberModalOpen, setMemberModalOpen] = useState(false);
  const [selectedScopeIds, setSelectedScopeIds] = useState<string[]>([]);
  const [scopeSearch, setScopeSearch] = useState("");
  const [modalNotice, setModalNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [sortKey, setSortKey]     = useState<SortKey | null>(null);
  const [sortDir, setSortDir]     = useState<SortDir>("asc");
  const [actionNotice, setActionNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [addingMember, setAddingMember] = useState<boolean>(false);
  const [membersReloadKey, setMembersReloadKey] = useState(0);
  const [removingMembers, setRemovingMembers] = useState<Record<string, boolean>>({});
  const [resettingMembers, setResettingMembers] = useState<Record<string, boolean>>({});
  const activeClientId = String(selectedClientId || "").trim();
  const isAllClientsView = activeClientId === "all";
  const clientById = useMemo(
    () =>
      Object.fromEntries(
        adminClients
          .filter((client) => client.id !== "all")
          .map((client) => [client.id, client]),
      ) as Record<string, AdminClient>,
    [adminClients],
  );
  const assignableScopes = useMemo(
    () => adminClients.filter((client) => String(client.id || "").trim() && client.id !== "all"),
    [adminClients],
  );

  useEffect(() => {
    setMemberSearch("");
  }, [activeClientId]);

  /* Reset local form/sort state whenever selected client changes */
  useEffect(() => {
    setMembers([]);
    setName("");
    setEmail("");
    setMemberSearch("");
    setRole("Member");
    setSubmitted(false);
    setSortKey(null);
    setSortDir("asc");
    setActionNotice(null);
    setAddingMember(false);
    setMemberModalOpen(false);
    setSelectedScopeIds([]);
    setScopeSearch("");
    setModalNotice(null);
    setRemovingMembers({});
    setResettingMembers({});
  }, [selectedClientId]);

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

  useEffect(() => {
    let alive = true;

    const fetchMembersForClient = async (clientId: string, clientName: string, token: string): Promise<Member[]> => {
      const response = await fetch(
        `${backendBase}/admin/client-members?client_id=${encodeURIComponent(clientId)}`,
        {
          method: "GET",
          headers: { Authorization: `Bearer ${token}` },
          credentials: "omit",
        },
      );
      const text = await response.text();
      if (!response.ok) throw new Error(extractErrorMessage(text));
      const payload = parseJsonSafe(text);
      const items =
        payload && typeof payload === "object" && Array.isArray((payload as { items?: unknown }).items)
          ? ((payload as { items: unknown[] }).items || [])
          : [];
      return items
        .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"))
        .map((item, index) => {
          const memberId = String(item.id || item.user_id || item.email || `${clientId}:${index}`);
          const memberEmail = String(item.email || "").trim() || "—";
          const createdAt = String(item.created_at || "").trim();
          const rowKey = `${clientId}:${memberId}:${createdAt || `idx:${index}`}:${memberEmail}`;
          return {
            id: memberId,
            rowKey,
            clientId,
            clientName: String(item.client_name || clientName || "—").trim() || "—",
            name: String(item.name || "").trim() || "—",
            email: memberEmail,
            role: normalizeMemberRole(item.role),
          };
        });
    };

    const loadMembers = async () => {
      if (adminClientsLoading) return;
      if (adminClientsError) {
        if (!alive) return;
        setMembers([]);
        setMembersError(adminClientsError);
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
        const token = String(session?.access_token || "").trim();
        if (!token) throw new Error("Missing session token.");

        let nextMembers: Member[] = [];
        if (activeClientId === "all") {
          const scopedClients = adminClients
            .map((client) => ({
              id: String(client.id || "").trim(),
              name: String(client.name || "").trim(),
            }))
            .filter((client) => client.id && client.id !== "all");

          const bundles = await Promise.all(
            scopedClients.map(async (client) => {
              try {
                return await fetchMembersForClient(client.id, client.name || "—", token);
              } catch {
                return [];
              }
            }),
          );
          nextMembers = bundles.flat();
        } else if (activeClientId) {
          const selectedClientName =
            adminClients.find((client) => String(client.id || "").trim() === activeClientId)?.name || "—";
          nextMembers = await fetchMembersForClient(activeClientId, selectedClientName, token);
        }

        if (!alive) return;
        setMembers(nextMembers);
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
  }, [selectedClientId, adminClients, adminClientsLoading, adminClientsError, membersReloadKey]);

  const nameErr  = submitted && name.trim() === "";
  const emailErr = submitted && !isValidEmail(email);
  const scopeErr = submitted && selectedScopeIds.length === 0;

  const getScopeMeta = (client: AdminClient) => {
    const parentId = String(client.parent_client_id || "").trim();
    const parentName = String(client.parent_client_name || (parentId ? clientById[parentId]?.name : "") || "").trim();
    if (client.is_child_client === true || parentId) {
      return parentName ? `${displayEntityLabel(client.entity_label)} under ${parentName}` : "Child entity";
    }
    return "Parent client";
  };

  const scopeSearchTerm = scopeSearch.trim().toLowerCase();
  const filteredScopes = scopeSearchTerm
    ? assignableScopes.filter((client) =>
        [
          client.name,
          client.entity_label,
          client.parent_client_name,
          client.parent_client_id ? clientById[client.parent_client_id]?.name : "",
          getScopeMeta(client),
        ].some((value) => String(value || "").toLowerCase().includes(scopeSearchTerm)),
      )
    : assignableScopes;

  const resetAddMemberForm = () => {
    setName("");
    setEmail("");
    setRole("Member");
    setSubmitted(false);
    setSelectedScopeIds([]);
    setScopeSearch("");
    setModalNotice(null);
  };

  const openAddMemberModal = () => {
    resetAddMemberForm();
    setSelectedScopeIds(activeClientId && activeClientId !== "all" ? [activeClientId] : []);
    setMemberModalOpen(true);
  };

  const closeAddMemberModal = () => {
    setMemberModalOpen(false);
    resetAddMemberForm();
  };

  const toggleScope = (clientId: string) => {
    setModalNotice(null);
    setSelectedScopeIds((prev) =>
      prev.includes(clientId) ? prev.filter((id) => id !== clientId) : [...prev, clientId],
    );
  };

  const handleAdd = async () => {
    setSubmitted(true);
    if (!name.trim() || !isValidEmail(email)) return;
    if (!backendBase) {
      setModalNotice({ tone: "error", text: "Missing backend base URL configuration." });
      return;
    }
    const validScopeIds = new Set(assignableScopes.map((client) => client.id));
    const submitScopeIds = Array.from(new Set(selectedScopeIds.map((id) => id.trim()).filter((id) => id && validScopeIds.has(id))));
    if (submitScopeIds.length === 0) {
      setModalNotice({ tone: "error", text: "Select at least one client or entity scope." });
      return;
    }

    setModalNotice(null);
    setAddingMember(true);
    try {
      const token = await getSessionToken();
      const response = await fetch(`${backendBase}/admin/client-members/batch`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        credentials: "omit",
        body: JSON.stringify({
          client_ids: submitScopeIds,
          email: email.trim(),
          name: name.trim(),
          role: roleToPayload(role),
        }),
      });
      const text = await response.text();
      const payload = parseJsonSafe(text) as { items?: unknown[] } | null;
      const items = Array.isArray(payload?.items) ? payload.items : [];
      const counts = summarizeBatchItems(items);
      const summary = formatBatchSummary(counts);

      if (!response.ok) {
        setModalNotice({ tone: "error", text: items.length ? summary : extractErrorMessage(text) });
        return;
      }

      if (counts.created > 0) {
        closeAddMemberModal();
        setActionNotice({ tone: "success", text: `Member assignment updated: ${summary}.` });
        setMembersReloadKey((value) => value + 1);
      } else {
        setModalNotice({ tone: "error", text: `No new memberships created: ${summary}.` });
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

  const handleRemove = async (member: Member) => {
    const id = member.id;
    const rowKey = member.rowKey;
    if (!id) return;
    if (!backendBase) {
      setActionNotice({ tone: "error", text: "Missing backend base URL configuration." });
      return;
    }
    if (!activeClientId || activeClientId === "all") {
      setActionNotice({ tone: "error", text: "Select a client to perform this action." });
      return;
    }
    if (removingMembers[rowKey]) return;

    setActionNotice(null);
    setRemovingMembers((prev) => ({ ...prev, [rowKey]: true }));
    try {
      const token = await getSessionToken();
      const response = await fetch(
        `${backendBase}/admin/client-members/${encodeURIComponent(id)}?client_id=${encodeURIComponent(activeClientId)}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
          credentials: "omit",
        },
      );
      const text = await response.text();
      if (!response.ok) throw new Error(extractErrorMessage(text));
      setMembers((prev) => prev.filter((m) => !(m.clientId === member.clientId && m.id === id)));
      setActionNotice({ tone: "success", text: "Member removed." });
    } catch (error) {
      setActionNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "Could not remove member.",
      });
    } finally {
      setRemovingMembers((prev) => ({ ...prev, [rowKey]: false }));
    }
  };

  const handleSendPasswordReset = async (member: Member) => {
    const key = member.rowKey || member.id || member.email;
    if (!key || !member.email) return;
    if (!backendBase) {
      setActionNotice({ tone: "error", text: "Missing backend base URL configuration." });
      return;
    }
    if (resettingMembers[key]) return;

    setActionNotice(null);
    setResettingMembers((prev) => ({ ...prev, [key]: true }));
    try {
      const token = await getSessionToken();
      const response = await fetch(`${backendBase}/admin/send-password-reset`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        credentials: "omit",
        body: JSON.stringify({ email: member.email }),
      });
      const text = await response.text();
      if (!response.ok) throw new Error(extractErrorMessage(text));
      setActionNotice({ tone: "success", text: "Password reset email sent." });
    } catch (error) {
      setActionNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "Failed to send password reset email.",
      });
    } finally {
      setResettingMembers((prev) => ({ ...prev, [key]: false }));
    }
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  };

  const visibleMembers = isAllClientsView
    ? members
    : members.filter((member) => member.clientId === activeClientId);

  const memberSearchTerm = memberSearch.trim().toLowerCase();
  const filteredMembers = memberSearchTerm
    ? visibleMembers.filter((member) =>
        [
          member.name,
          member.email,
        ].some((value) => String(value || "").toLowerCase().includes(memberSearchTerm)),
      )
    : visibleMembers;

  const sorted = sortKey
    ? [...filteredMembers].sort((a, b) => {
        const av = (sortKey === "client" ? a.clientName : a[sortKey]).toLowerCase();
        const bv = (sortKey === "client" ? b.clientName : b[sortKey]).toLowerCase();
        const cmp = av.localeCompare(bv);
        return sortDir === "asc" ? cmp : -cmp;
      })
    : filteredMembers;

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <ChevronDown className="w-3 h-3 text-[#0A1547]/20 ml-0.5 flex-shrink-0" />;
    return sortDir === "asc"
      ? <ChevronUp   className="w-3 h-3 text-[#A380F6] ml-0.5 flex-shrink-0" />
      : <ChevronDown className="w-3 h-3 text-[#A380F6] ml-0.5 flex-shrink-0" />;
  }

  return (
    <AdminLayout title="Members">
      {memberModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: "rgba(10,21,71,0.55)", backdropFilter: "blur(4px)" }}
          onClick={(event) => {
            if (event.target === event.currentTarget && !addingMember) closeAddMemberModal();
          }}
        >
          <div
            className="w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-2xl bg-white flex flex-col"
            style={{ border: "1px solid rgba(10,21,71,0.09)", boxShadow: "0 24px 64px rgba(10,21,71,0.18)" }}
          >
            <div className="px-6 pt-5 pb-4 border-b border-gray-100">
              <p className="text-[10px] font-black uppercase tracking-widest text-[#0A1547]/35 mb-1">Add Member</p>
              <h3 className="text-lg font-black text-[#0A1547]">Assign member scopes</h3>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
              {modalNotice && (
                <div
                  className="px-4 py-2.5 rounded-xl text-sm font-semibold"
                  style={{
                    border: modalNotice.tone === "error" ? "1px solid rgba(239,68,68,0.25)" : "1px solid rgba(2,217,157,0.25)",
                    backgroundColor: modalNotice.tone === "error" ? "rgba(239,68,68,0.08)" : "rgba(2,217,157,0.10)",
                    color: modalNotice.tone === "error" ? "#DC2626" : "#047857",
                  }}
                >
                  {modalNotice.text}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <input
                    type="text"
                    placeholder="Member name"
                    value={name}
                    onChange={(event) => {
                      setName(event.target.value);
                      setModalNotice(null);
                    }}
                    className={inputCls + (nameErr ? " border-red-300 bg-red-50/40" : " border-gray-200")}
                  />
                  {nameErr && <p className="mt-1 text-[10px] text-red-500 font-semibold px-1">Name required</p>}
                </div>
                <div>
                  <input
                    type="email"
                    placeholder="Member email"
                    value={email}
                    onChange={(event) => {
                      setEmail(event.target.value);
                      setModalNotice(null);
                    }}
                    className={inputCls + (emailErr ? " border-red-300 bg-red-50/40" : " border-gray-200")}
                  />
                  {emailErr && <p className="mt-1 text-[10px] text-red-500 font-semibold px-1">Valid email required</p>}
                </div>
              </div>

              <div className="relative max-w-xs">
                <select
                  value={role}
                  onChange={(event) => {
                    setRole(event.target.value as MemberRole);
                    setModalNotice(null);
                  }}
                  className={inputCls + " border-gray-200 appearance-none pr-8 cursor-pointer"}
                >
                  <option value="Member">Member</option>
                  <option value="Manager">Manager</option>
                  <option value="Super Admin">Super Admin</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#0A1547]/30 pointer-events-none" />
              </div>

              <div>
                <div className="flex items-center justify-between gap-3 mb-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-[#0A1547]/40">Scopes</label>
                  <span className="text-[11px] font-bold text-[#0A1547]/35">
                    {selectedScopeIds.length} selected
                  </span>
                </div>
                <input
                  type="text"
                  placeholder="Search clients or entities..."
                  value={scopeSearch}
                  onChange={(event) => {
                    setScopeSearch(event.target.value);
                    setModalNotice(null);
                  }}
                  className={inputCls + " border-gray-200 mb-3"}
                />
                <div className={(scopeErr ? "border-red-300 bg-red-50/20 " : "border-gray-100 ") + "max-h-64 overflow-y-auto rounded-2xl border divide-y divide-gray-50"}>
                  {filteredScopes.length === 0 ? (
                    <p className="px-4 py-6 text-center text-sm font-semibold text-[#0A1547]/35">
                      No matching client or entity scopes.
                    </p>
                  ) : (
                    filteredScopes.map((client) => {
                      const checked = selectedScopeIds.includes(client.id);
                      return (
                        <label
                          key={client.id}
                          className="flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleScope(client.id)}
                            className="mt-1 h-4 w-4 rounded border-gray-300 text-[#A380F6] focus:ring-[#A380F6]"
                          />
                          <span className="min-w-0">
                            <span className="block text-sm font-bold text-[#0A1547] truncate">{client.name}</span>
                            <span className="block text-[11px] font-semibold text-[#0A1547]/40 truncate">{getScopeMeta(client)}</span>
                          </span>
                        </label>
                      );
                    })
                  )}
                </div>
                {scopeErr && <p className="mt-1 text-[10px] text-red-500 font-semibold px-1">Select at least one scope</p>}
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
              <button
                type="button"
                className="px-4 py-2 rounded-full text-xs font-bold text-[#0A1547]/45 hover:text-[#0A1547]/70 hover:bg-gray-100 transition-all"
                onClick={closeAddMemberModal}
                disabled={addingMember}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  void handleAdd();
                }}
                disabled={addingMember}
                className="px-5 py-2.5 rounded-full text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                style={{ backgroundColor: "#A380F6" }}
              >
                {addingMember ? "Adding..." : "Add member"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-black text-[#0A1547]">Members</h2>
      </div>
      {actionNotice && (
        <div
          className="mb-4 px-4 py-2.5 rounded-xl text-sm font-semibold"
          style={{
            border: actionNotice.tone === "error" ? "1px solid rgba(239,68,68,0.25)" : "1px solid rgba(2,217,157,0.25)",
            backgroundColor: actionNotice.tone === "error" ? "rgba(239,68,68,0.08)" : "rgba(2,217,157,0.10)",
            color: actionNotice.tone === "error" ? "#DC2626" : "#047857",
          }}
        >
          {actionNotice.text}
        </div>
      )}

      <div
        className="bg-white rounded-2xl overflow-hidden"
        style={{ border: "1px solid rgba(10,21,71,0.07)", boxShadow: "0 2px 12px rgba(10,21,71,0.04)" }}
      >
        {/* Panel header + add form */}
        <div className="px-5 py-5 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3">
          <p className="text-base font-black text-[#0A1547]">Client Members</p>
          <button
            type="button"
            onClick={openAddMemberModal}
            className="px-5 py-2.5 rounded-full text-sm font-bold text-white transition-opacity hover:opacity-90 active:scale-[0.97]"
            style={{ backgroundColor: "#A380F6" }}
          >
            Add Member
          </button>
        </div>

        <div className="px-5 py-3.5 border-b border-gray-100 flex flex-wrap items-center gap-3">
          <input
            type="text"
            placeholder="Search member name or email..."
            value={memberSearch}
            onChange={(e) => setMemberSearch(e.target.value)}
            className={inputCls + " border-gray-200 max-w-sm"}
          />
          {memberSearch && (
            <button
              type="button"
              className="px-3 py-2 rounded-full text-xs font-bold text-[#0A1547]/55 bg-[#0A1547]/5 hover:bg-[#0A1547]/10 transition-colors"
              onClick={() => setMemberSearch("")}
            >
              Clear
            </button>
          )}
          <p className="text-xs text-[#0A1547]/35 font-semibold ml-auto">
            {sorted.length} of {visibleMembers.length} member{visibleMembers.length !== 1 ? "s" : ""}
          </p>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="px-5 py-3.5 text-left">
                  <button
                    className="flex items-center text-[10px] font-black uppercase tracking-widest text-[#0A1547]/40 hover:text-[#0A1547]/70 transition-colors"
                    onClick={() => handleSort("name")}
                  >
                    Name <SortIcon col="name" />
                  </button>
                </th>
                <th className="px-4 py-3.5 text-left">
                  <button
                    className="flex items-center text-[10px] font-black uppercase tracking-widest text-[#0A1547]/40 hover:text-[#0A1547]/70 transition-colors"
                    onClick={() => handleSort("role")}
                  >
                    Role <SortIcon col="role" />
                  </button>
                </th>
                {isAllClientsView && (
                  <th className="px-4 py-3.5 text-left">
                    <button
                      className="flex items-center text-[10px] font-black uppercase tracking-widest text-[#0A1547]/40 hover:text-[#0A1547]/70 transition-colors"
                      onClick={() => handleSort("client")}
                    >
                      Client <SortIcon col="client" />
                    </button>
                  </th>
                )}
                <th className="px-4 py-3.5 text-center text-[10px] font-black uppercase tracking-widest text-[#0A1547]/40">
                  Reset
                </th>
                <th className="px-4 py-3.5 pr-5 text-center text-[10px] font-black uppercase tracking-widest text-[#0A1547]/40">
                  Remove
                </th>
              </tr>
            </thead>
            <tbody>
              {membersLoading ? (
                <tr>
                  <td colSpan={isAllClientsView ? 5 : 4} className="text-center py-14 text-sm text-[#0A1547]/30 font-semibold">
                    Loading members...
                  </td>
                </tr>
              ) : membersError ? (
                <tr>
                  <td colSpan={isAllClientsView ? 5 : 4} className="text-center py-14 text-sm text-red-500 font-semibold">
                    {membersError}
                  </td>
                </tr>
              ) : sorted.length === 0 ? (
                <tr>
                  <td colSpan={isAllClientsView ? 5 : 4} className="text-center py-14 text-sm text-[#0A1547]/30 font-semibold">
                    {memberSearchTerm && visibleMembers.length > 0 ? "No members match your search." : "No members yet — add one above."}
                  </td>
                </tr>
              ) : (
                sorted.map((m, idx) => (
                  <tr
                    key={m.rowKey}
                    className="border-b border-gray-50 hover:bg-gray-50/60 transition-colors"
                    style={idx === sorted.length - 1 ? { borderBottom: "none" } : {}}
                  >
                    {/* Name + email */}
                    <td className="px-5 py-4">
                      <p className="font-bold text-[#0A1547] text-sm leading-snug">{m.name}</p>
                      <p className="text-[11px] text-[#0A1547]/35 mt-0.5">{m.email}</p>
                    </td>

                    {/* Role badge */}
                    <td className="px-4 py-4">
                      <RoleBadge role={m.role} />
                    </td>

                    {/* Client */}
                    {isAllClientsView && (
                      <td className="px-4 py-4">
                        <p className="text-sm font-semibold text-[#0A1547]/75">{m.clientName}</p>
                      </td>
                    )}

                    {/* Reset */}
                    <td className="px-4 py-4 text-center">
                      <button
                        onClick={() => {
                          void handleSendPasswordReset(m);
                        }}
                        disabled={resettingMembers[m.rowKey || m.id || m.email] === true}
                        className="inline-flex items-center justify-center p-2 rounded-lg text-[#0A1547]/25 hover:text-[#A380F6] hover:bg-[#A380F6]/10 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                        title={resettingMembers[m.rowKey || m.id || m.email] === true ? "Sending password reset..." : `Send password reset to ${m.name}`}
                      >
                        <Key className={`w-4 h-4 ${resettingMembers[m.rowKey || m.id || m.email] === true ? "animate-spin" : ""}`} />
                      </button>
                    </td>

                    {/* Remove */}
                    <td className="px-4 py-4 pr-5 text-center">
                      <button
                        onClick={() => {
                          void handleRemove(m);
                        }}
                        disabled={removingMembers[m.rowKey] === true}
                        className="inline-flex items-center justify-center p-2 rounded-lg text-[#0A1547]/25 hover:text-red-500 hover:bg-red-50 transition-colors"
                        title={`Remove ${m.name}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer count */}
        <div className="px-5 py-3 border-t border-gray-100">
          <p className="text-[11px] text-[#0A1547]/35 font-semibold">
            {sorted.length} member{sorted.length !== 1 ? "s" : ""}
          </p>
        </div>
      </div>
    </AdminLayout>
  );
}
