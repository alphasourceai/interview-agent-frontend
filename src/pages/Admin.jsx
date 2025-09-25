// src/pages/Admin.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { apiGet, apiPost, apiDelete, api } from '../lib/api';
import { supabase } from '../lib/supabaseClient';
import '../styles/alphaTheme.css';

/* bright white trash icon, +~30% size */
const IconTrash = ({ size = 36 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M3 6h18" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round"/>
    <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" stroke="#FFFFFF" strokeWidth="2"/>
    <path d="M6 6l1 14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-14" stroke="#FFFFFF" strokeWidth="2" strokeLinejoin="round"/>
    <path d="M10 11v6M14 11v6" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round"/>
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

  // forgot/reset password
  const [showReset, setShowReset] = useState(false);
  const [newPass1, setNewPass1] = useState('');
  const [newPass2, setNewPass2] = useState('');

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

  useEffect(() => localStorage.setItem('adm_show_clients', showClients ? '1' : '0'), [showClients]);
  useEffect(() => localStorage.setItem('adm_show_roles', showRoles ? '1' : '0'), [showRoles]);
  useEffect(() => localStorage.setItem('adm_show_members', showMembers ? '1' : '0'), [showMembers]);

  const shareBase = 'https://www.alphasourceai.com/interview-agent';

  // Detect Supabase recovery redirect
  useEffect(() => {
    const url = new URL(window.location.href);
    const needsReset =
      url.searchParams.get('pwreset') === '1' ||
      window.location.hash.includes('type=recovery') ||
      window.location.hash.includes('recovery');
    if (needsReset) setShowReset(true);
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!alive) return;
      setSession(data?.session || null);
      if (data?.session) {
        try {
          const u = await apiGet('/auth/me');
          if (!alive) return;
          setMe(u || null);
          const probe = await apiGet('/admin/clients');
          const list = (probe?.items || []).sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''));
          if (!alive) return;
          setIsAdmin(true);
          setClients(list);
          if (list.length && !selectedClientId) setSelectedClientId(list[0].id);
        } catch {
          if (!alive) return;
          setIsAdmin(false);
        }
      }
      if (alive) setLoading(false);
    })();
    return () => { alive = false; };
  }, []);

  async function refreshClients() {
    const probe = await apiGet('/admin/clients');
    const list = (probe?.items || []).sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''));
    setClients(list);
  }

  async function refreshRoles(clientId = selectedClientId) {
    const r = await apiGet('/admin/roles' + (clientId ? ('?client_id=' + encodeURIComponent(clientId)) : ''));
    const items = r?.items || [];
    items.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    setRoles(items);
  }

  async function refreshMembers(clientId = selectedClientId) {
    if (!clientId) { setMembers([]); return; }
    const m = await apiGet('/admin/client-members?client_id=' + encodeURIComponent(clientId));
    setMembers(m?.items || []);
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

  const handleSignIn = async (e) => {
    e.preventDefault();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return alert('Sign in failed: ' + error.message);
    setSession(data?.session || null);
    window.location.reload();
  };

  const startReset = async () => {
    if (!email) return alert('Enter your email above first.');
    const origin = window.location.origin;
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${origin}/admin?pwreset=1`
    });
    if (error) return alert('Could not start reset: ' + error.message);
    alert('Check your email for a password reset link.');
  };

  const submitReset = async (e) => {
    e.preventDefault();
    if (!newPass1 || newPass1 !== newPass2) return alert('Passwords do not match.');
    const { error } = await supabase.auth.updateUser({ password: newPass1 });
    if (error) return alert('Could not update password: ' + error.message);
    alert('Password updated. You can sign in now.');
    setShowReset(false);
    setNewPass1(''); setNewPass2('');
    const url = new URL(window.location.href);
    url.searchParams.delete('pwreset');
    window.history.replaceState({}, '', url.toString());
    await supabase.auth.signOut();
    // collapse sections for next login
    localStorage.removeItem('adm_show_clients');
    localStorage.removeItem('adm_show_roles');
    localStorage.removeItem('adm_show_members');
    window.location.href = '/admin';
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem('adm_show_clients');
    localStorage.removeItem('adm_show_roles');
    localStorage.removeItem('adm_show_members');
    window.location.href = '/admin';
  };

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
    }
  };

  const deleteClient = async (id) => {
    if (!confirm('Delete this client?')) return;
    await apiDelete('/admin/clients/' + id);
    await refreshClients();
    if (selectedClientId === id) setSelectedClientId(clients[0]?.id || '');
    setRoles([]);
    setMembers([]);
  };

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
    } finally {
      setRoleBusy(false);
    }
  };

  const deleteRole = async (id) => {
    if (!confirm('Delete this role?')) return;
    await apiDelete('/admin/roles/' + id);
    setRoles(roles.filter(r => r.id !== id));
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
      alert('Invite sent and member added');
    }
  };

  const removeMember = async (id) => {
    if (!confirm('Remove this member?')) return;
    await apiDelete('/admin/client-members/' + id);
    setMembers(members.filter(m => m.id !== id));
  };

  const selectedClient = useMemo(() => clients.find(c => c.id === selectedClientId) || null, [clients, selectedClientId]);

  if (loading) {
    return <div className="alpha-container"><div className="alpha-card"><h2>Loading…</h2></div></div>;
  }

  // ---------- Reset UI ----------
  if (showReset) {
    return (
      <div className="alpha-container">
        <div className="alpha-card alpha-form">
          <h2>Reset Password</h2>
          <form onSubmit={submitReset}>
            <label>New password</label>
            <input className="alpha-input" type="password" value={newPass1} onChange={e => setNewPass1(e.target.value)} required />
            <label>Confirm new password</label>
            <input className="alpha-input" type="password" value={newPass2} onChange={e => setNewPass2(e.target.value)} required />
            <button type="submit">Update Password</button>
            <div style={{ marginTop: 8 }}>
              <button type="button" onClick={() => { setShowReset(false); window.location.href = '/admin'; }}>
                Back to sign in
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // ---------- Auth screens ----------
  if (!session) {
    return (
      <div className="alpha-container">
        <div className="alpha-card alpha-form">
          <h2>Admin Sign In</h2>
          <form onSubmit={handleSignIn}>
            <label>Email</label>
            <input className="alpha-input" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
            <label>Password</label>
            <input className="alpha-input" type="password" value={password} onChange={e => setPassword(e.target.value)} required />
            <button type="submit">Sign In</button>
            <div style={{ marginTop: 10 }}>
              <button
                type="button"
                onClick={startReset}
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

  if (!isAdmin) {
    return (
      <div className="alpha-container">
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
    <div className="alpha-container">
      {/* Header with logo (left), title, and account (right) */}
      <div className="alpha-header alpha-header--dash">
        <div className="alpha-header-left">
          {/* place the file at /public/alpha-symbol.png */}
          <img src="/alpha-symbol.png" alt="AlphaSourceAI" className="alpha-logo" />
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
            <button type="button" className="toggle" aria-pressed={showClients} onClick={() => setShowClients(v => !v)}>
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
                  <button className="btn-icon lilac" onClick={() => deleteClient(c.id)} title="Delete client">
                    <IconTrash />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Roles */}
        <div className="alpha-card">
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
                className="alpha-input file"
                type="file"
                accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={e => setJobFile(e.target.files?.[0] || null)}
                aria-label="Job Description file (PDF or DOCX)"
              />
              {jobFile && (
                <button className="btn-icon lilac file-clear" onClick={() => setJobFile(null)} title="Remove file">
                  <IconTrash />
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
            <button type="button" className="toggle" aria-pressed={showRoles} onClick={() => setShowRoles(v => !v)}>
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
                        <button onClick={() => navigator.clipboard.writeText(`${shareBase}?role=${r.slug_or_token}`)}>Copy link</button>
                      </div>
                      <div className="center">
                        <button className="btn-icon lilac" onClick={() => deleteRole(r.id)} title="Delete role">
                          <IconTrash />
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
            <button type="button" className="toggle" aria-pressed={showMembers} onClick={() => setShowMembers(v => !v)}>
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
                  <button onClick={() => removeMember(m.id)}>Remove</button>
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