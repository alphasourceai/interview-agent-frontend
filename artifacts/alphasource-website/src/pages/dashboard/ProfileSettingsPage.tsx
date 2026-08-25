import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
  Check,
  KeyRound,
  Laptop,
  Mail,
  Monitor,
  Moon,
  Pencil,
  ShieldCheck,
  Sun,
  Trash2,
  UserRound,
} from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { useAppearance, type AppearanceMode } from "@/context/AppearanceContext";
import { useAuth } from "@/context/AuthContext";
import { useClient } from "@/context/ClientContext";
import { PASSKEYS_ENABLED, supabase } from "@/lib/supabaseClient";
import { buildPwResetUrl, getPublicBackendBase } from "@/lib/urlConfig";

interface PasskeyRecord {
  id: string;
  friendlyName: string;
  createdAt: string;
  lastUsedAt: string;
}

interface Notice {
  tone: "success" | "error" | "info";
  text: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function profileName(user: ReturnType<typeof useAuth>["currentUser"]): string {
  const metadata = user?.user_metadata || {};
  const explicit = String(metadata.full_name || metadata.name || "").trim();
  if (explicit) return explicit;
  const fromParts = [metadata.first_name, metadata.last_name]
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .join(" ");
  return fromParts || String(user?.email || "").split("@")[0] || "";
}

function normalizePasskey(value: unknown): PasskeyRecord | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  const id = String(item.id || "").trim();
  if (!id) return null;
  return {
    id,
    friendlyName: String(item.friendly_name || item.friendlyName || "Passkey").trim() || "Passkey",
    createdAt: String(item.created_at || item.createdAt || "").trim(),
    lastUsedAt: String(item.last_used_at || item.lastUsedAt || "").trim(),
  };
}

function formatDate(value: string): string {
  if (!value) return "Not yet";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not yet";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(date);
}

function Card({ title, description, icon, children }: {
  title: string;
  description: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border p-5 sm:p-6" style={{ backgroundColor: "var(--as-surface)", borderColor: "var(--as-border)" }}>
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-[#A380F6]/10 text-[#A380F6]">{icon}</span>
        <div>
          <h2 className="text-base font-black" style={{ color: "var(--as-text)" }}>{title}</h2>
          <p className="mt-1 text-xs leading-relaxed" style={{ color: "var(--as-text-muted)" }}>{description}</p>
        </div>
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function NoticeBanner({ notice }: { notice: Notice | null }) {
  if (!notice) return null;
  const colors = notice.tone === "success"
    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
    : notice.tone === "error"
      ? "border-red-200 bg-red-50 text-red-700"
      : "border-sky-200 bg-sky-50 text-sky-800";
  return <p role="status" className={`mt-4 rounded-xl border px-3 py-2.5 text-xs font-semibold ${colors}`}>{notice.text}</p>;
}

export default function ProfileSettingsPage() {
  const { currentUser } = useAuth();
  const { selectedClient } = useClient();
  const { mode, setMode } = useAppearance();
  const [fullName, setFullName] = useState(() => profileName(currentUser));
  const [email, setEmail] = useState(() => String(currentUser?.email || ""));
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileNotice, setProfileNotice] = useState<Notice | null>(null);
  const [resettingPassword, setResettingPassword] = useState(false);
  const [passwordNotice, setPasswordNotice] = useState<Notice | null>(null);
  const [passkeys, setPasskeys] = useState<PasskeyRecord[]>([]);
  const [passkeysLoading, setPasskeysLoading] = useState(PASSKEYS_ENABLED);
  const [passkeyBusy, setPasskeyBusy] = useState(false);
  const [passkeyNotice, setPasskeyNotice] = useState<Notice | null>(null);
  const [editingPasskeyId, setEditingPasskeyId] = useState("");
  const [passkeyNameDraft, setPasskeyNameDraft] = useState("");

  const pendingEmail = String((currentUser as { new_email?: string } | null)?.new_email || "").trim();
  const passkeySupported = typeof window !== "undefined" && "PublicKeyCredential" in window;
  const currentEmail = String(currentUser?.email || "").trim();

  useEffect(() => {
    setFullName(profileName(currentUser));
    setEmail(String(currentUser?.email || ""));
  }, [currentUser]);

  const syncMemberProfile = useCallback(async (nextFullName: string) => {
    const backendBase = getPublicBackendBase();
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    const token = String(sessionData.session?.access_token || "").trim();
    if (sessionError || !token || !backendBase) throw new Error("Could not synchronize the member profile.");
    const response = await fetch(`${backendBase}/auth/profile/sync`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      credentials: "omit",
      body: JSON.stringify({ full_name: nextFullName }),
    });
    if (!response.ok) throw new Error("Could not synchronize the member profile.");
  }, []);

  useEffect(() => {
    const existingName = profileName(currentUser);
    if (!currentUser?.id || !existingName) return;
    void syncMemberProfile(existingName).catch(() => {});
  }, [currentUser?.email, currentUser?.id, syncMemberProfile]);

  const loadPasskeys = useCallback(async () => {
    if (!PASSKEYS_ENABLED) {
      setPasskeysLoading(false);
      return;
    }
    setPasskeysLoading(true);
    const { data, error } = await supabase.auth.passkey.list();
    if (error) {
      setPasskeyNotice({ tone: "error", text: error.message || "Could not load passkeys." });
      setPasskeysLoading(false);
      return;
    }
    const rawItems = Array.isArray(data)
      ? data
      : Array.isArray((data as { passkeys?: unknown[] } | null)?.passkeys)
        ? (data as { passkeys: unknown[] }).passkeys
        : [];
    setPasskeys(rawItems.map(normalizePasskey).filter((item): item is PasskeyRecord => Boolean(item)));
    setPasskeysLoading(false);
  }, []);

  useEffect(() => {
    void loadPasskeys();
  }, [loadPasskeys]);

  const saveProfile = async (event: FormEvent) => {
    event.preventDefault();
    const nextName = fullName.trim().replace(/\s+/g, " ");
    const nextEmail = email.trim().toLowerCase();
    setProfileNotice(null);
    if (!nextName || nextName.length > 120) {
      setProfileNotice({ tone: "error", text: "Enter a name between 1 and 120 characters." });
      return;
    }
    if (!EMAIL_RE.test(nextEmail)) {
      setProfileNotice({ tone: "error", text: "Enter a valid email address." });
      return;
    }

    setSavingProfile(true);
    try {
      const { error: nameError } = await supabase.auth.updateUser({ data: { full_name: nextName } });
      if (nameError) throw nameError;
      await syncMemberProfile(nextName);

      if (nextEmail !== currentEmail.toLowerCase()) {
        const { error: emailError } = await supabase.auth.updateUser({ email: nextEmail });
        if (emailError) throw emailError;
        setProfileNotice({
          tone: "info",
          text: "Your name was saved. Check your email to confirm the new address; the current address remains active until confirmation is complete.",
        });
      } else {
        setProfileNotice({ tone: "success", text: "Profile changes saved." });
      }
    } catch (error) {
      setProfileNotice({ tone: "error", text: error instanceof Error ? error.message : "Could not save profile changes." });
    } finally {
      setSavingProfile(false);
    }
  };

  const sendPasswordReset = async () => {
    if (!currentEmail) return;
    setResettingPassword(true);
    setPasswordNotice(null);
    const { error } = await supabase.auth.resetPasswordForEmail(currentEmail, {
      redirectTo: buildPwResetUrl({ origin: "client" }),
    });
    setResettingPassword(false);
    setPasswordNotice(error
      ? { tone: "error", text: error.message || "Could not send a password reset email." }
      : { tone: "success", text: "Password reset email sent." });
  };

  const addPasskey = async () => {
    setPasskeyBusy(true);
    setPasskeyNotice(null);
    try {
      const { error } = await supabase.auth.registerPasskey();
      if (error) throw error;
      setPasskeyNotice({ tone: "success", text: "Passkey added successfully." });
      await loadPasskeys();
    } catch (error) {
      const message = error instanceof Error && error.name !== "NotAllowedError"
        ? error.message
        : "Passkey setup was cancelled or unavailable.";
      setPasskeyNotice({ tone: "error", text: message });
    } finally {
      setPasskeyBusy(false);
    }
  };

  const savePasskeyName = async (passkeyId: string) => {
    const friendlyName = passkeyNameDraft.trim();
    if (!friendlyName || friendlyName.length > 120) {
      setPasskeyNotice({ tone: "error", text: "Passkey names must be between 1 and 120 characters." });
      return;
    }
    setPasskeyBusy(true);
    const { error } = await supabase.auth.passkey.update({ passkeyId, friendlyName });
    setPasskeyBusy(false);
    if (error) {
      setPasskeyNotice({ tone: "error", text: error.message || "Could not rename this passkey." });
      return;
    }
    setEditingPasskeyId("");
    setPasskeyNameDraft("");
    setPasskeyNotice({ tone: "success", text: "Passkey renamed." });
    await loadPasskeys();
  };

  const removePasskey = async (passkey: PasskeyRecord) => {
    if (!window.confirm(`Remove “${passkey.friendlyName}” from your account?`)) return;
    setPasskeyBusy(true);
    const { error } = await supabase.auth.passkey.delete({ passkeyId: passkey.id });
    setPasskeyBusy(false);
    if (error) {
      setPasskeyNotice({ tone: "error", text: error.message || "Could not remove this passkey." });
      return;
    }
    setPasskeyNotice({ tone: "success", text: "Passkey removed. Your password remains available as a fallback." });
    await loadPasskeys();
  };

  const appearanceOptions = useMemo<Array<{ value: AppearanceMode; label: string; icon: ReactNode }>>(() => [
    { value: "light", label: "Light", icon: <Sun className="h-4 w-4" /> },
    { value: "dark", label: "Dark", icon: <Moon className="h-4 w-4" /> },
    { value: "system", label: "System", icon: <Monitor className="h-4 w-4" /> },
  ], []);

  return (
    <DashboardLayout title="Profile Settings">
      <div className="mx-auto grid max-w-5xl gap-5 lg:grid-cols-2">
        <Card title="Personal information" description="Update the name and verified email associated with your account." icon={<UserRound className="h-5 w-5" />}>
          <form onSubmit={saveProfile} className="space-y-4">
            <label className="block">
              <span className="text-xs font-black" style={{ color: "var(--as-text)" }}>Name</span>
              <input value={fullName} onChange={(event) => setFullName(event.target.value)} autoComplete="name" maxLength={120} className="mt-1.5 w-full rounded-xl border px-3 py-2.5 text-sm outline-none transition-colors focus:border-[#A380F6]" style={{ backgroundColor: "var(--as-surface-muted)", borderColor: "var(--as-border)", color: "var(--as-text)" }} />
            </label>
            <label className="block">
              <span className="flex items-center gap-2 text-xs font-black" style={{ color: "var(--as-text)" }}>
                Email address
                {currentUser?.email_confirmed_at && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] text-emerald-700"><Check className="h-3 w-3" /> Verified</span>}
              </span>
              <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="email" className="mt-1.5 w-full rounded-xl border px-3 py-2.5 text-sm outline-none transition-colors focus:border-[#A380F6]" style={{ backgroundColor: "var(--as-surface-muted)", borderColor: "var(--as-border)", color: "var(--as-text)" }} />
            </label>
            {pendingEmail && pendingEmail !== currentEmail && <p className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-semibold text-sky-800">Pending confirmation: {pendingEmail}</p>}
            <button type="submit" disabled={savingProfile} className="rounded-full bg-[#A380F6] px-5 py-2.5 text-xs font-black text-white transition-opacity hover:opacity-90 disabled:opacity-50">{savingProfile ? "Saving…" : "Save changes"}</button>
            <NoticeBanner notice={profileNotice} />
          </form>
        </Card>

        <Card title="Appearance" description="Choose how the dashboard looks on this browser. System is the default." icon={<Monitor className="h-5 w-5" />}>
          <div className="grid grid-cols-3 gap-2">
            {appearanceOptions.map((option) => (
              <button key={option.value} type="button" onClick={() => setMode(option.value)} aria-pressed={mode === option.value} className={`flex flex-col items-center gap-2 rounded-xl border px-3 py-4 text-xs font-black transition-colors ${mode === option.value ? "border-[#A380F6] bg-[#A380F6]/10 text-[#A380F6]" : "hover:border-[#A380F6]/45"}`} style={mode === option.value ? undefined : { borderColor: "var(--as-border)", color: "var(--as-text-muted)" }}>
                {option.icon}
                {option.label}
              </button>
            ))}
          </div>
          <p className="mt-3 text-[11px] leading-relaxed" style={{ color: "var(--as-text-muted)" }}>System follows your device’s light or dark appearance automatically.</p>
        </Card>

        <Card title="Passkeys" description="Use Face ID, Touch ID, Windows Hello, a device PIN, or a security key to sign in." icon={<KeyRound className="h-5 w-5" />}>
          {!PASSKEYS_ENABLED ? (
            <p className="rounded-xl border px-3 py-3 text-xs font-semibold" style={{ borderColor: "var(--as-border)", backgroundColor: "var(--as-surface-muted)", color: "var(--as-text-muted)" }}>Passkeys are not enabled for this environment yet. Your password sign-in remains unchanged.</p>
          ) : !passkeySupported ? (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-xs font-semibold text-amber-800">This browser or device does not support passkeys.</p>
          ) : (
            <>
              <div className="space-y-2">
                {passkeysLoading && <p className="text-xs font-semibold" style={{ color: "var(--as-text-muted)" }}>Loading passkeys…</p>}
                {!passkeysLoading && passkeys.length === 0 && <p className="rounded-xl border border-dashed px-3 py-4 text-center text-xs font-semibold" style={{ borderColor: "var(--as-border)", color: "var(--as-text-muted)" }}>No passkeys added yet.</p>}
                {passkeys.map((passkey) => (
                  <div key={passkey.id} className="rounded-xl border p-3" style={{ borderColor: "var(--as-border)", backgroundColor: "var(--as-surface-muted)" }}>
                    {editingPasskeyId === passkey.id ? (
                      <div className="flex gap-2">
                        <input autoFocus value={passkeyNameDraft} onChange={(event) => setPasskeyNameDraft(event.target.value)} maxLength={120} aria-label="Passkey name" className="min-w-0 flex-1 rounded-lg border px-2.5 py-2 text-xs outline-none focus:border-[#A380F6]" style={{ backgroundColor: "var(--as-surface)", borderColor: "var(--as-border)", color: "var(--as-text)" }} />
                        <button type="button" disabled={passkeyBusy} onClick={() => void savePasskeyName(passkey.id)} className="rounded-lg bg-[#A380F6] px-3 text-xs font-black text-white">Save</button>
                      </div>
                    ) : (
                      <div className="flex items-start gap-3">
                        <Laptop className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#A380F6]" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-black" style={{ color: "var(--as-text)" }}>{passkey.friendlyName}</p>
                          <p className="mt-1 text-[10px]" style={{ color: "var(--as-text-muted)" }}>Added {formatDate(passkey.createdAt)} · Last used {formatDate(passkey.lastUsedAt)}</p>
                        </div>
                        <button type="button" onClick={() => { setEditingPasskeyId(passkey.id); setPasskeyNameDraft(passkey.friendlyName); }} aria-label={`Rename ${passkey.friendlyName}`} className="rounded-lg p-1.5 text-[#A380F6] hover:bg-[#A380F6]/10"><Pencil className="h-3.5 w-3.5" /></button>
                        <button type="button" onClick={() => void removePasskey(passkey)} aria-label={`Remove ${passkey.friendlyName}`} className="rounded-lg p-1.5 text-red-500 hover:bg-red-50"><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <button type="button" disabled={passkeyBusy} onClick={() => void addPasskey()} className="mt-4 inline-flex items-center gap-2 rounded-full bg-[#0A1547] px-5 py-2.5 text-xs font-black text-white transition-opacity hover:opacity-90 disabled:opacity-50"><KeyRound className="h-4 w-4" />{passkeyBusy ? "Working…" : "Add a passkey"}</button>
              <NoticeBanner notice={passkeyNotice} />
            </>
          )}
        </Card>

        <Card title="Password and account" description="Your password remains available as a fallback. Account scope is managed by your organization." icon={<ShieldCheck className="h-5 w-5" />}>
          <dl className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-2 text-xs">
            <dt className="font-bold" style={{ color: "var(--as-text-muted)" }}>Organization</dt>
            <dd className="truncate text-right font-black" style={{ color: "var(--as-text)" }}>{selectedClient.name}</dd>
            <dt className="font-bold" style={{ color: "var(--as-text-muted)" }}>Role</dt>
            <dd className="text-right font-black capitalize" style={{ color: "var(--as-text)" }}>{String(selectedClient.role || "member").replace(/_/g, " ")}</dd>
          </dl>
          <div className="mt-5 border-t pt-4" style={{ borderColor: "var(--as-border)" }}>
            <button type="button" disabled={resettingPassword} onClick={() => void sendPasswordReset()} className="inline-flex items-center gap-2 rounded-full border px-4 py-2.5 text-xs font-black transition-colors hover:border-[#A380F6] hover:text-[#A380F6] disabled:opacity-50" style={{ borderColor: "var(--as-border)", color: "var(--as-text)" }}><Mail className="h-4 w-4" />{resettingPassword ? "Sending…" : "Send password reset email"}</button>
            <NoticeBanner notice={passwordNotice} />
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
}
