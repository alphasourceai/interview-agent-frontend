// src/pages/Admin.jsx
import React, { useEffect, useMemo, useState, useRef } from 'react';
import { apiGet, apiPost, apiDelete, api } from '../lib/api';
import { supabase } from '../lib/supabaseClient';

import '../styles/adminTheme.css';

// Detect if running inside an iframe (Wix embed)
const EMBEDDED = typeof window !== 'undefined' && window !== window.parent;

// Add a marker class to <html> so CSS can disable inner scrollbars when embedded
if (typeof document !== 'undefined' && EMBEDDED) {
  try {
    document.documentElement.classList.add('embedded');
    // Add CSS override to disable scrollbars and auto height when embedded
    const style = document.createElement('style');
    style.innerHTML = `
      html.embedded, html.embedded body {
        overflow: visible !important;
        height: auto !important;
      }
    `;
    document.head.appendChild(style);
  } catch {}
}

/* bright white trash icon */
const IconTrash = ({ size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M3 6h18" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round"/>
    <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" stroke="#FFFFFF" strokeWidth="2"/>
    <path d="M6 6l1 14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-14" stroke="#FFFFFF" strokeWidth="2" strokeLinejoin="round"/>
    <path d="M10 11v6M14 11v6" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round"/>
  </svg>
);

const IconKey = ({ size = 24 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden="true"
  >
    <path d="M14 7a5 5 0 1 0-2.197 4.12L15 14h2v2h2v2h2v-3.172a2 2 0 0 0-.586-1.414l-4.828-4.828A4.98 4.98 0 0 0 14 7Z" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <circle cx="10" cy="7" r="1.5" fill="#FFFFFF"/>
  </svg>
);

export default function Admin() {
  const [session, setSession] = useState(null);
  const [me, setMe] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  // auth form
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // clients
  const [clients, setClients] = useState([]);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [newClientName, setNewClientName] = useState('');
  const [newClientAdminName, setNewClientAdminName] = useState('');
  const [newClientAdminEmail, setNewClientAdminEmail] = useState('');

  // roles
  const [roles, setRoles] = useState([]);
  const [newRoleTitle, setNewRoleTitle] = useState('');
  const [interviewType, setInterviewType] = useState('BASIC'); // BASIC | DETAILED | TECHNICAL
  const [jobFile, setJobFile] = useState(null);
  const [roleBusy, setRoleBusy] = useState(false);
  const fileInputRef = useRef(null);
  const [fileKey, setFileKey] = useState(0); // ensure full reset of file input

  // members
  const [members, setMembers] = useState([]);
  const [memberEmail, setMemberEmail] = useState('');
  const [memberName, setMemberName] = useState('');
  const [memberRole, setMemberRole] = useState('member'); // member | manager | admin

  // collapsibles — default collapsed unless user has toggled them on before
  const readToggle = (key) => (localStorage.getItem(key) === '1' ? true : false);
  const [showClients, setShowClients] = useState(readToggle('adm_show_clients'));
  const [showRoles, setShowRoles] = useState(readToggle('adm_show_roles'));
  const [showMembers, setShowMembers] = useState(readToggle('adm_show_members'));

  // --- Embedded (Wix) auto-resize helper ---
  // Posts the current document height to the parent (Wix) so the iframe resizes.
  // Now posts multiple times (immediate and delayed) to ensure resizes on both grow and shrink.
  const postEmbedSize = () => {
    if (typeof window === 'undefined') return;
    try {
      const send = () => {
        const h = Math.max(
          document.body?.scrollHeight || 0,
          document.documentElement?.scrollHeight || 0,
          document.body?.offsetHeight || 0,
          document.documentElement?.offsetHeight || 0
        );
        window.parent?.postMessage({ type: 'EMBED_SIZE', height: h }, '*');
      };
      send();
      setTimeout(send, 250);
    } catch (_) {}
  };

  // Notify parent (Wix) whenever key UI pieces change size/content
  // Keep session in sync with Supabase and handle fresh sign-ins
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess || null);
      // On a fresh sign-in inside an embed, do a hard replace to avoid stale state
      if (sess && window.location.pathname !== '/admin') {
        // Delay redirect slightly to allow Supabase session to settle
        setTimeout(() => {
          window.location.replace('/admin');
        }, 250);
      }
    });
    return () => {
      try {
        sub.subscription?.unsubscribe?.();
      } catch (e) {
        console.warn('Auth subscription cleanup error:', e);
      }
    };
  }, []);

  useEffect(() => {
    const t = setTimeout(postEmbedSize, 60);
    // also post again after a longer delay to ensure shrinkage is handled
    const t2 = setTimeout(postEmbedSize, 320);
    return () => { clearTimeout(t); clearTimeout(t2); };
  }, [loading, isAdmin, clients.length, roles.length, members.length, showClients, showRoles, showMembers, selectedClientId]);

  useEffect(() => localStorage.setItem('adm_show_clients', showClients ? '1' : '0'), [showClients]);
  useEffect(() => localStorage.setItem('adm_show_roles', showRoles ? '1' : '0'), [showRoles]);
  useEffect(() => localStorage.setItem('adm_show_members', showMembers ? '1' : '0'), [showMembers]);

  // --- 60-minute inactivity auto-logout ---
  useEffect(() => {
    const IDLE_LIMIT_MS = 60 * 60 * 1000; // 60 minutes
    let timer;

    const triggerLogout = async () => {
      try {
        await supabase.auth.signOut();
      } finally {
        // also clear section-state so a fresh login starts collapsed
        localStorage.removeItem('adm_show_clients');
        localStorage.removeItem('adm_show_roles');
        localStorage.removeItem('adm_show_members');
        window.location.replace('/admin');
      }
    };

    const resetTimer = () => {
      clearTimeout(timer);
      timer = setTimeout(triggerLogout, IDLE_LIMIT_MS);
    };

    // Reset on any user activity
    const activityEvents = [
      'mousemove',
      'mousedown',
      'keydown',
      'scroll',
      'touchstart',
      'visibilitychange',
      'click'
    ];

    activityEvents.forEach((ev) => window.addEventListener(ev, resetTimer));
    resetTimer(); // start on mount

    return () => {
      clearTimeout(timer);
      activityEvents.forEach((ev) => window.removeEventListener(ev, resetTimer));
    };
  }, []);

  const shareBase = 'https://interviews.alphasourceai.com/interview-host';

  useEffect(() => {
    let alive = true;
    let initializing = true;
    (async () => {
      // Only run if initializing is true
      if (!initializing) return;
      const { data } = await supabase.auth.getSession();
      if (!alive || !initializing) return;
      // Add a small delay to allow Supabase to settle
      await new Promise(res => setTimeout(res, 200));
      if (!alive || !initializing) return;
      setSession(data?.session || null);
      if (data?.session) {
        try {
          if (!alive || !initializing) return;
          const u = await apiGet('/auth/me');
          if (!alive || !initializing) return;
          setMe(u || null);
          const probe = await apiGet('/admin/clients');
          if (!alive || !initializing) return;
          const list = (probe?.items || []).sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''));
          setIsAdmin(true);
          setClients(list);
          if (list.length && !selectedClientId) setSelectedClientId(list[0].id);
        } catch {
          if (!alive || !initializing) return;
          setIsAdmin(false);
        }
      }
      if (alive && initializing) setLoading(false);
      initializing = false;
    })();
    return () => { alive = false; initializing = false; };
  }, []);

  async function refreshClients() {
    const probe = await apiGet('/admin/clients');
    const list = (probe?.items || []).sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''));
    setClients(list);
    postEmbedSize();
    setTimeout(postEmbedSize, 300);
  }

  async function refreshRoles(clientId = selectedClientId) {
    const r = await apiGet('/admin/roles' + (clientId ? ('?client_id=' + encodeURIComponent(clientId)) : ''));
    const items = r?.items || [];
    items.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    setRoles(items);
    postEmbedSize();
    setTimeout(postEmbedSize, 300);
  }

  async function refreshMembers(clientId = selectedClientId) {
    if (!clientId) { setMembers([]); postEmbedSize(); setTimeout(postEmbedSize, 300); return; }
    const m = await apiGet('/admin/client-members?client_id=' + encodeURIComponent(clientId));
    setMembers(m?.items || []);
    postEmbedSize();
    setTimeout(postEmbedSize, 300);
  }

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!isAdmin) return;
      if (!alive) return;
      await refreshRoles(selectedClientId);
      if (!alive) return;
      await refreshMembers(selectedClientId);
    })();
    return () => { alive = false; };
  }, [isAdmin, selectedClientId]);

  // Ask Safari/WebKit for storage access when embedded (fixes third‑party cookie auth inside Wix)
  async function requestSafariStorageAccess() {
    try {
      if (document.hasStorageAccess && document.requestStorageAccess) {
        const has = await document.hasStorageAccess();
        if (!has) {
          // Must be called in response to a user gesture (our sign‑in submit)
          await document.requestStorageAccess();
        }
      }
    } catch (e) {
      // non‑Safari or not needed
    }
  }

  const handleSignIn = async (e) => {
    e.preventDefault();
    try {
      await requestSafariStorageAccess();
    } catch {}
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return alert('Sign in failed: ' + error.message);
    setSession(data?.session || null);
    window.location.replace('/admin');
  };

  const startReset = async () => {
    if (!email) return alert('Enter your email above first.');
    const origin = window.location.origin;
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${origin}/set-password?mode=recovery`
    });
    if (error) return alert('Could not start reset: ' + error.message);
    alert('Check your email for a password reset link.');
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem('adm_show_clients');
    localStorage.removeItem('adm_show_roles');
    localStorage.removeItem('adm_show_members');
    window.location.replace('/admin');
  };

  async function resetMemberPassword(member) {
    try {
      const raw = (member && member.email) ? String(member.email) : '';
      const email = raw.trim().toLowerCase();
      if (!email) {
        alert('This member has no email address on file.');
        return;
      }

      console.debug('[resetMemberPassword] starting for', { id: member.id, email });

      // Primary path: backend email-based reset (preferred and simplest)
      try {
        await apiPost('/admin/reset-password', { email });
        alert(`Password reset email triggered for ${email}`);
        console.debug('[resetMemberPassword] success via /admin/reset-password');
        return;
      } catch (e1) {
        // If backend says user not found, surface that clearly
        const code = e1?.response?.data?.error || e1?.message || '';
        if (code && /user_email_not_found/i.test(code)) {
          alert(`No Supabase user exists for ${email}. Ask the user to accept their invite, or create an account for them.`);
          console.warn('[resetMemberPassword] user_email_not_found for', email);
          return;
        }
        // If the route is missing (404), fall back to id-based route
        if (e1?.response?.status !== 404) {
          throw e1;
        }
      }

      // Fallback path: id-based route, if supported
      try {
        await apiPost(`/admin/users/${encodeURIComponent(member.id)}/reset-password`, {});
        alert(`Password reset email triggered for ${email}`);
        console.debug('[resetMemberPassword] success via /admin/users/:id/reset-password');
        return;
      } catch (e2) {
        if (e2?.response?.status !== 404) throw e2;
      }

      // Last resort: client-side request (works only if backend allows public flow)
      try {
        const origin = window.location.origin;
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${origin}/set-password?mode=recovery`
        });
        if (error) throw error;
        alert(`Password reset email requested for ${email}`);
        console.debug('[resetMemberPassword] success via supabase.auth.resetPasswordForEmail');
      } catch (e3) {
        throw e3;
      }
    } catch (err) {
      const msg =
        (err?.response?.data?.error) ||
        err?.message ||
        'Could not initiate password reset. Please try again.';
      console.error('resetMemberPassword failed:', err);
      alert(msg);
    }
  }
  // ---------- Clients ----------
  const createClient = async () => {
    const name = newClientName.trim();
    const admin_name = newClientAdminName.trim();
    const admin_email = newClientAdminEmail.trim();
    if (!name) return;
    const resp = await apiPost('/admin/clients', { name, admin_name, admin_email });
    const item = resp?.item;
    if (item) {
      await refreshClients();
      setNewClientName('');
      setNewClientAdminName('');
      setNewClientAdminEmail('');
      setSelectedClientId(item.id);
      if (resp?.seeded_member) setMembers([resp.seeded_member, ...members]);
      postEmbedSize();
      setTimeout(postEmbedSize, 300);
    }
  };

  const deleteClient = async (id) => {
    if (!confirm('Delete this client?')) return;
    await apiDelete('/admin/clients/' + id);
    await refreshClients();
    if (selectedClientId === id) setSelectedClientId(clients[0]?.id || '');
    setRoles([]);
    setMembers([]);
    postEmbedSize();
    setTimeout(postEmbedSize, 300);
  };

  // Robust clipboard helper: tries modern Clipboard API, falls back to execCommand, then prompt
  async function safeCopy(text) {
    try {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        await navigator.clipboard.writeText(text);
        alert('Link copied to clipboard');
        return;
      }
    } catch (err) {
      console.warn('navigator.clipboard.writeText failed:', err);
    }
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      if (ok) {
        alert('Link copied to clipboard');
        return;
      }
    } catch (err2) {
      console.warn('document.execCommand copy failed:', err2);
    }
    // Last resort: show prompt so user can copy manually
    try {
      window.prompt('Copy this link:', text);
    } catch (_) {
      alert('Copy failed. Please copy this link manually: ' + text);
    }
  }

  // ---------- Roles ----------
  const uploadJDToBackend = async (roleId, file) => {
    const form = new FormData();
    form.append('file', file);
    const qs = new URLSearchParams({ client_id: selectedClientId, role_id: roleId }).toString();
    return api.upload(`/roles-upload/upload-jd?${qs}`, form);
  };

  const createRole = async () => {
    if (!selectedClientId) return;
    const title = newRoleTitle.trim();
    if (!title) return;
    if (!jobFile) {
      alert('Please choose a Job Description file (PDF or DOCX) before creating the role.');
      return;
    }
    setRoleBusy(true);
    try {
      const payload = { client_id: selectedClientId, title, interview_type: interviewType };
      const resp = await apiPost('/admin/roles', payload);
      const role = resp?.item;
      if (!role) { alert('Role create failed'); return; }
      try {
        const out = await uploadJDToBackend(role.id, jobFile);
        if (out?.parsed_text_preview) console.log('[JD preview]', out.parsed_text_preview);
      } catch (e) {
        console.error('uploadJDToBackend error', e);
        alert('Role created, but JD processing failed: ' + e.message);
      }
      await refreshRoles(selectedClientId);
      setNewRoleTitle('');
      setJobFile(null);
      postEmbedSize();
      setTimeout(postEmbedSize, 300);
    } finally {
      setRoleBusy(false);
    }
  };

  // Delete role: try canonical DELETE with query params, then fall back to POST if not available
  const deleteRole = async (id) => {
    if (!confirm('Delete this role?')) return;
    try {
      // Preferred: DELETE /admin/roles?id=...&client_id=...
      const url = `/admin/roles?id=${encodeURIComponent(id)}&client_id=${encodeURIComponent(selectedClientId)}`;
      let ok = false;
      try {
        await apiDelete(url);
        ok = true;
      } catch (e) {
        // If server doesn't support that yet, try POST /admin/roles/delete
        if (e?.response?.status === 404) {
          await apiPost('/admin/roles/delete', { id, client_id: selectedClientId });
          ok = true;
        } else {
          throw e;
        }
      }

      if (ok) {
        setRoles(prev => prev.filter(r => r.id !== id));
        postEmbedSize();
        setTimeout(postEmbedSize, 300);
      }
    } catch (err) {
      const msg =
        (err?.response?.data?.error) ||
        (err?.message) ||
        'Could not delete role. Please refresh and try again.';
      console.error('Role delete failed:', err);
      alert(msg);
    }
  };

  // ---------- Members ----------
  const addMember = async () => {
    if (!selectedClientId) return;
    const e = memberEmail.trim();
    const n = memberName.trim();
    if (!e || !n) return;
    const resp = await apiPost('/admin/client-members', { client_id: selectedClientId, email: e, name: n, role: memberRole });
    if (resp?.item) {
      setMembers([resp.item, ...members]);
      setMemberEmail('');
      setMemberName('');
      setMemberRole('member');
      postEmbedSize();
      setTimeout(postEmbedSize, 300);
      alert('Invite sent and member added');
    }
  };

  const removeMember = async (member) => {
    if (!member || !confirm('Remove this member?')) return;
    try {
      const payload = {};
      const clientId = selectedClientId || member.client_id || '';
      if (clientId) payload.client_id = clientId;
      if (member.user_id) payload.user_id = member.user_id;
      const email = typeof member.email === 'string' ? member.email.trim().toLowerCase() : '';
      if (email) payload.email = email;

      if (!payload.user_id && !payload.email) {
        alert('This member is missing identifiers and cannot be removed.');
        return;
      }

      const resp = await apiDelete('/admin/client-members', payload);
      if (!resp?.ok) {
        throw new Error(resp?.error || 'Remove member failed');
      }

      setMembers(prev => prev.filter(m => m.id !== member.id));
      postEmbedSize();
      setTimeout(postEmbedSize, 300);
    } catch (err) {
      const msg =
        err?.response?.data?.error ||
        err?.message ||
        'Could not remove member. Please refresh and try again.';
      console.error('removeMember failed:', err);
      alert(msg);
    }
  };

  const selectedClient = useMemo(() => clients.find(c => c.id === selectedClientId) || null, [clients, selectedClientId]);

  if (loading) {
    return <div className="alpha-container admin-page" style={EMBEDDED ? { overflow: 'visible' } : undefined}><div className="alpha-card"><h2>Loading…</h2></div></div>;
  }

  // ---------- Reset UI ----------
  // ---------- Auth screens ----------
  if (!loading && !session) {
    return (
      <div className="alpha-container admin-page" style={EMBEDDED ? { overflow: 'visible' } : undefined}>
        <div className="alpha-card auth-wrap admin-auth">
          <div className="auth-head">
            <h2>Admin Sign In</h2>
          </div>
          <form onSubmit={handleSignIn}>
            <label htmlFor="admin-email">Email</label>
            <input id="admin-email" className="alpha-input" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
            <label htmlFor="admin-password">Password</label>
            <input id="admin-password" className="alpha-input" type="password" value={password} onChange={e => setPassword(e.target.value)} required />
            <button type="submit" style={{ width: '100%' }}>Sign In</button>
            <div style={{ marginTop: 10 }}>
              <button
                type="button"
                onClick={startReset}
                className="btn-ghost"
                style={{ background: 'none', border: 'none', padding: 0, textDecoration: 'underline', cursor: 'pointer', font: 'inherit' }}
              >
                Forgot password?
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  if (!loading && !isAdmin) {
    return (
      <div className="alpha-container admin-page" style={EMBEDDED ? { overflow: 'visible' } : undefined}>
        <div className="alpha-card">
          <h2>Access denied</h2>
          <p>Your account is not an admin.</p>
          <button className="signout-btn" onClick={handleSignOut}>Sign Out</button>
        </div>
      </div>
    );
  }

  // ---------- Admin app ----------
  return (
    <div className="alpha-container admin-page" style={EMBEDDED ? { overflow: 'visible' } : undefined}>
      {/* Header with logo (left), title, and account (right) */}
      <div className="alpha-header alpha-header--dash">
        <div className="alpha-header-left">
          <h1>Admin Dashboard</h1>
        </div>
        <div className="alpha-actions">
          <span>{me?.user?.email || me?.email}</span>
          <button onClick={handleSignOut}>Sign Out</button>
        </div>
      </div>

      {/* current client selector under header */}
      <div className="alpha-card alpha-card--bar">
        <div className="row">
          <label className="mr-2">Current client</label>
          <select className="alpha-input alpha-select" value={selectedClientId} onChange={e => setSelectedClientId(e.target.value)}>
            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </div>

      <div className="alpha-grid">
        {/* Clients */}
        <div className="alpha-card">
          <div style={{ height: 12 }} />
          <div className="section-head">
            <h2 className="section-title">Clients</h2>
          </div>

          {/* create row */}
          <div className="row">
            <input className="alpha-input" placeholder="Client name" value={newClientName} onChange={e => setNewClientName(e.target.value)} />
            <input className="alpha-input" placeholder="Client admin name" value={newClientAdminName} onChange={e => setNewClientAdminName(e.target.value)} />
            <input className="alpha-input" placeholder="Admin email" value={newClientAdminEmail} onChange={e => setNewClientAdminEmail(e.target.value)} />
            <button onClick={createClient}>Create</button>
          </div>

          {/* toggle UNDER inputs */}
          <div className="toggle-row">
            <button
              type="button"
              className="toggle"
              aria-pressed={showClients}
              onClick={() => {
                setShowClients(v => !v);
                postEmbedSize();
                setTimeout(postEmbedSize, 300);
              }}
            >
              {showClients ? 'Hide clients' : 'Show clients'}
            </button>
          </div>

          {showClients && (
            <div className="list list--rows" id="clients-list">
              {clients.map(c => (
                <div key={c.id} className="list-row">
                  <div className="grow">
                    <div className="title">{c.name}</div>
                    <div className="sub">Created {new Date(c.created_at).toLocaleString()}</div>
                  </div>
                  <button className="btn-icon" onClick={() => deleteClient(c.id)} title="Delete client">
                    <IconTrash size={24} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Roles */}
        <div className="alpha-card">
          <div style={{ height: 12 }} />
          <div className="section-head">
            <h2 className="section-title">Roles</h2>
          </div>

          <div className="row">
            <input className="alpha-input" placeholder="Role title" value={newRoleTitle} onChange={e => setNewRoleTitle(e.target.value)} />
            <select className="alpha-input alpha-select" value={interviewType} onChange={e => setInterviewType(e.target.value)}>
              <option value="BASIC">BASIC</option>
              <option value="DETAILED">DETAILED</option>
              <option value="TECHNICAL">TECHNICAL</option>
            </select>

            {/* file picker + clear */}
            <div className="file-stack">
              <input
                key={fileKey}
                className="alpha-input file"
                type="file"
                accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={e => setJobFile(e.target.files?.[0] || null)}
                aria-label="Job Description file (PDF or DOCX)"
                ref={fileInputRef}
              />
              {jobFile && (
                <button
                  className="btn-icon file-clear"
                  onClick={() => {
                    if (fileInputRef.current) fileInputRef.current.value = '';
                    setJobFile(null);
                    setFileKey(k => k + 1); // fully reset the input element
                  }}
                  title="Remove file"
                >
                  <IconTrash size={24} />
                </button>
              )}
            </div>

            <button
              disabled={!selectedClientId || roleBusy || !newRoleTitle.trim() || !jobFile}
              onClick={createRole}
              title={!jobFile ? 'Choose a PDF or DOCX to enable Create' : 'Create role'}
            >
              {roleBusy ? 'Creating…' : 'Create'}
            </button>
          </div>

          {/* toggle UNDER inputs */}
          <div className="toggle-row">
            <button
              type="button"
              className="toggle"
              aria-pressed={showRoles}
              onClick={() => {
                setShowRoles(v => !v);
                postEmbedSize();
                setTimeout(postEmbedSize, 300);
              }}
            >
              {showRoles ? 'Hide roles' : 'Show roles'}
            </button>
          </div>

          {showRoles && (
            <div className="table like" id="roles-table">
              <div className="t-head">
                <div>Role</div><div>Created</div><div>KB</div><div>JD</div><div>Link</div><div>Delete</div>
              </div>
              <div className="t-body">
                {roles.map(r => {
                  const hasKB = !!r.kb_document_id;
                  const hasJD = !!r.job_description_url || !!r.description;
                  return (
                    <div key={r.id} className="t-row">
                      <div>
                        <div className="title">{r.title}</div>
                        <div className="sub">Type: {r.interview_type || '—'} • Token: {r.slug_or_token}</div>
                      </div>
                      <div>{r.created_at ? new Date(r.created_at).toLocaleString() : '—'}</div>
                      <div className="center">{hasKB ? '✓' : '—'}</div>
                      <div className="center">{hasJD ? '✓' : '—'}</div>
                      <div>
                        <button onClick={() => safeCopy(`${shareBase}/${r.slug_or_token}`)}>Copy link</button>
                      </div>
                      <div className="center">
                        <button className="btn-icon" onClick={() => deleteRole(r.id)} title="Delete role">
                          <IconTrash size={24} />
                        </button>
                      </div>
                    </div>
                  );
                })}
                {roles.length === 0 && <div className="t-empty muted">No roles yet</div>}
              </div>
            </div>
          )}
        </div>

        {/* Members */}
        <div className="alpha-card">
          <div style={{ height: 12 }} />
          <div className="section-head">
            <h2 className="section-title">Client Members</h2>
          </div>

          <div className="row">
            <input className="alpha-input" placeholder="Member name" value={memberName} onChange={e => setMemberName(e.target.value)} />
            <input className="alpha-input" placeholder="Member email" value={memberEmail} onChange={e => setMemberEmail(e.target.value)} />
            <select className="alpha-input alpha-select" value={memberRole} onChange={e => setMemberRole(e.target.value)}>
              <option value="member">Member</option>
              <option value="manager">Manager</option>
              <option value="admin">Admin</option>
            </select>
            <button disabled={!selectedClientId} onClick={addMember}>Add</button>
          </div>

          {/* toggle UNDER inputs */}
          <div className="toggle-row">
            <button
              type="button"
              className="toggle"
              aria-pressed={showMembers}
              onClick={() => {
                setShowMembers(v => !v);
                postEmbedSize();
                setTimeout(postEmbedSize, 300);
              }}
            >
              {showMembers ? 'Hide members' : 'Show members'}
            </button>
          </div>

          {showMembers && (
            <div className="list list--rows" id="members-list">
              {members.map(m => (
                <div key={m.id} className="list-row">
                  <div className="grow">
                    <div className="title">{m.name}</div>
                    <div className="sub">{m.email} • {m.role || 'member'}</div>
                  </div>
                  <div className="row" style={{ gap: 8 }}>
                    <button
                      className="btn-icon"
                      onClick={() => resetMemberPassword(m)}
                      title={m.email ? `Send password reset email to ${m.email}` : 'No email on file'}
                      aria-label="Send password reset email"
                      disabled={!m.email}
                    >
                      <IconKey size={24} />
                    </button>
                    <button
                      className="btn-icon"
                      onClick={() => removeMember(m)}
                      title="Remove member"
                      aria-label="Remove member"
                    >
                      <IconTrash size={24} />
                    </button>
                  </div>
                </div>
              ))}
              {members.length === 0 && <div className="muted">No members for this client</div>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
