import React, { useEffect, useMemo, useRef, useState } from 'react'
import { apiGet, apiPost, apiDelete, api } from '../lib/api'
import { supabase } from '../lib/supabaseClient'
import '../styles/alphaTheme.css'

/* ---------- small UI helpers ---------- */

function useStickyToggle(key, defaultOn = false) {
  const [open, setOpen] = useState(() => {
    try {
      const raw = localStorage.getItem(key)
      return raw === null ? defaultOn : raw === '1'
    } catch { return defaultOn }
  })
  useEffect(() => {
    try { localStorage.setItem(key, open ? '1' : '0') } catch {}
  }, [key, open])
  return [open, setOpen]
}

const IconTrash = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="white" aria-hidden="true">
    <path d="M9 3h6a1 1 0 0 1 1 1v1h4v2H4V5h4V4a1 1 0 0 1 1-1zm1 5h2v10h-2V8zm4 0h2v10h-2V8zM7 8h2v10H7V8z"/>
  </svg>
)

const IconCheck = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M20.285 6.708l-11.01 11.01-5.657-5.657 1.414-1.415 4.243 4.243 9.596-9.596z"/>
  </svg>
)

const Chip = ({ children, onClick, title, danger }) => (
  <button
    type="button"
    className="alpha-chip"
    onClick={onClick}
    title={title}
    style={danger ? { background: '#a45ad9' } : undefined}
  >
    {children}
  </button>
)

/* ===================================================================== */

export default function Admin() {
  const [session, setSession] = useState(null)
  const [me, setMe] = useState(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)

  // login
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  // reset password
  const [showReset, setShowReset] = useState(false)
  const [newPass1, setNewPass1] = useState('')
  const [newPass2, setNewPass2] = useState('')

  // clients
  const [clients, setClients] = useState([])
  const [selectedClientId, setSelectedClientId] = useState('')
  const [newClientName, setNewClientName] = useState('')
  const [newClientAdminName, setNewClientAdminName] = useState('')
  const [newClientAdminEmail, setNewClientAdminEmail] = useState('')

  // roles
  const [roles, setRoles] = useState([])
  const [newRoleTitle, setNewRoleTitle] = useState('')
  const [interviewType, setInterviewType] = useState('BASIC') // BASIC | DETAILED | TECHNICAL
  const [jobFile, setJobFile] = useState(null)
  const [roleBusy, setRoleBusy] = useState(false)

  // members
  const [members, setMembers] = useState([])
  const [memberEmail, setMemberEmail] = useState('')
  const [memberName, setMemberName] = useState('')
  const [memberRole, setMemberRole] = useState('member')

  // collapsibles (persisted)
  const [showClients, setShowClients] = useStickyToggle('adm_clients_open', false)
  const [showRoles, setShowRoles] = useStickyToggle('adm_roles_open', false)
  const [showMembers, setShowMembers] = useStickyToggle('adm_members_open', false)

  // “clear file” UI (to fully reset <input type=file>)
  const fileInputRef = useRef(null)
  const [fileClearedToken, setFileClearedToken] = useState(0)

  const shareBase = 'https://www.alphasourceai.com/interview-agent'

  /* ---------- detect Supabase recovery redirect ---------- */
  useEffect(() => {
    const url = new URL(window.location.href)
    const needsReset =
      url.searchParams.get('pwreset') === '1' ||
      window.location.hash.includes('type=recovery') ||
      window.location.hash.includes('recovery')
    if (needsReset) setShowReset(true)
  }, [])

  /* ---------- boot/auth/load lists ---------- */
  useEffect(() => {
    let alive = true
    ;(async () => {
      const { data } = await supabase.auth.getSession()
      if (!alive) return
      setSession(data?.session || null)
      if (data?.session) {
        try {
          const u = await apiGet('/auth/me')
          if (!alive) return
          setMe(u || null)

          const probe = await apiGet('/admin/clients')
          const list = probe?.items || []
          if (!alive) return
          setIsAdmin(true)
          setClients(list)
          if (list.length && !selectedClientId) setSelectedClientId(list[0].id)
        } catch {
          if (!alive) return
          setIsAdmin(false)
        }
      }
      if (alive) setLoading(false)
    })()
    return () => { alive = false }
  }, [])

  async function refreshRoles(clientId = selectedClientId) {
    const r = await apiGet('/admin/roles' + (clientId ? ('?client_id=' + encodeURIComponent(clientId)) : ''))
    setRoles(r?.items || [])
  }

  async function refreshMembers(clientId = selectedClientId) {
    if (!clientId) { setMembers([]); return }
    const m = await apiGet('/admin/client-members?client_id=' + encodeURIComponent(clientId))
    setMembers(m?.items || [])
  }

  useEffect(() => {
    let alive = true
    ;(async () => {
      if (!isAdmin) return
      if (!alive) return
      await refreshRoles(selectedClientId)
      if (!alive) return
      await refreshMembers(selectedClientId)
    })()
    return () => { alive = false }
  }, [isAdmin, selectedClientId])

  /* ---------- auth handlers ---------- */
  const handleSignIn = async (e) => {
    e.preventDefault()
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return alert('Sign in failed: ' + error.message)
    setSession(data?.session || null)
    window.location.reload()
  }

  const startReset = async () => {
    if (!email) return alert('Enter your email above first.')
    const origin = window.location.origin
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${origin}/admin?pwreset=1`
    })
    if (error) return alert('Could not start reset: ' + error.message)
    alert('Check your email for a password reset link.')
  }

  const submitReset = async (e) => {
    e.preventDefault()
    if (!newPass1 || newPass1 !== newPass2) return alert('Passwords do not match.')
    const { error } = await supabase.auth.updateUser({ password: newPass1 })
    if (error) return alert('Could not update password: ' + error.message)
    alert('Password updated. You can sign in now.')
    setShowReset(false)
    setNewPass1(''); setNewPass2('')
    const url = new URL(window.location.href)
    url.searchParams.delete('pwreset')
    window.history.replaceState({}, '', url.toString())
    await supabase.auth.signOut()
    window.location.href = '/admin'
  }

  const handleSignOut = async () => {
    try { localStorage.removeItem('adm_clients_open'); localStorage.removeItem('adm_roles_open'); localStorage.removeItem('adm_members_open'); } catch {}
    await supabase.auth.signOut()
    window.location.href = '/admin'
  }

  /* ---------- Clients ---------- */
  const createClient = async () => {
    const name = newClientName.trim()
    const admin_name = newClientAdminName.trim()
    const admin_email = newClientAdminEmail.trim()
    if (!name) return
    const resp = await apiPost('/admin/clients', { name, admin_name, admin_email })
    const item = resp?.item
    if (item) {
      const next = [item, ...clients].sort((a, b) => a.name.localeCompare(b.name))
      setClients(next)
      setNewClientName('')
      setNewClientAdminName('')
      setNewClientAdminEmail('')
      setSelectedClientId(item.id)
      if (resp?.seeded_member) setMembers([resp.seeded_member, ...members])
    }
  }

  const deleteClient = async (id) => {
    if (!confirm('Delete this client?')) return
    await apiDelete('/admin/clients/' + id)
    const next = clients.filter(c => c.id !== id)
    setClients(next)
    if (selectedClientId === id) setSelectedClientId(next[0]?.id || '')
    setRoles([])
    setMembers([])
  }

  /* ---------- Roles ---------- */
  const uploadJDToBackend = async (roleId, file) => {
    const form = new FormData()
    form.append('file', file)
    const qs = new URLSearchParams({
      client_id: selectedClientId,
      role_id: roleId
    }).toString()
    return api.upload(`/roles-upload/upload-jd?${qs}`, form)
  }

  const createRole = async () => {
    if (!selectedClientId) return
    const title = newRoleTitle.trim()
    if (!title) return

    if (!jobFile) {
      alert('Please choose a Job Description file (PDF or DOCX) before creating the role.')
      return
    }

    setRoleBusy(true)
    try {
      const payload = { client_id: selectedClientId, title, interview_type: interviewType }
      const resp = await apiPost('/admin/roles', payload)
      const role = resp?.item
      if (!role) { alert('Role create failed'); return }

      try {
        const out = await uploadJDToBackend(role.id, jobFile)
        if (out?.parsed_text_preview) console.log('[JD preview]', out.parsed_text_preview)
      } catch (e) {
        console.error('uploadJDToBackend error', e)
        alert('Role created, but JD processing failed: ' + e.message)
      }

      await refreshRoles(selectedClientId)
      setNewRoleTitle('')
      setJobFile(null)
      // fully clear the file input
      if (fileInputRef.current) fileInputRef.current.value = ''
      setFileClearedToken(x => x + 1)
    } finally {
      setRoleBusy(false)
    }
  }

  const deleteRole = async (id) => {
    if (!confirm('Delete this role?')) return
    await apiDelete('/admin/roles/' + id)
    setRoles(roles.filter(r => r.id !== id))
  }

  /* ---------- Members ---------- */
  const addMember = async () => {
    if (!selectedClientId) return
    const e = memberEmail.trim()
    const n = memberName.trim()
    if (!e || !n) return
    const resp = await apiPost('/admin/client-members', {
      client_id: selectedClientId, email: e, name: n, role: memberRole
    })
    if (resp?.item) {
      setMembers([resp.item, ...members])
      setMemberEmail(''); setMemberName(''); setMemberRole('member')
      alert('Invite sent and member added')
    }
  }

  const removeMember = async (id) => {
    if (!confirm('Remove this member?')) return
    await apiDelete('/admin/client-members/' + id)
    setMembers(members.filter(m => m.id !== id))
  }

  /* ---------- Render screens ---------- */

  if (loading) {
    return <div className="alpha-container"><div className="alpha-card"><h2>Loading…</h2></div></div>
  }

  if (showReset) {
    return (
      <div className="alpha-container">
        <div className="alpha-card alpha-form">
          <h2>Reset Password</h2>
          <form onSubmit={submitReset}>
            <label>New password</label>
            <input type="password" value={newPass1} onChange={e => setNewPass1(e.target.value)} required />
            <label>Confirm new password</label>
            <input type="password" value={newPass2} onChange={e => setNewPass2(e.target.value)} required />
            <button type="submit">Update Password</button>
            <div style={{ marginTop: 8 }}>
              <button type="button" onClick={() => { setShowReset(false); window.location.href = '/admin' }}>
                Back to sign in
              </button>
            </div>
          </form>
        </div>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="alpha-container">
        <div className="alpha-card alpha-form">
          <h2>Admin Sign In</h2>
          <form onSubmit={handleSignIn}>
            <label>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required />
            <label>Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required />
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
    )
  }

  if (!isAdmin) {
    return (
      <div className="alpha-container">
        <div className="alpha-card">
          <h2>Access denied</h2>
          <p>Your account is not an admin.</p>
          <button onClick={handleSignOut}>Sign Out</button>
        </div>
      </div>
    )
  }

  const selectedClient = useMemo(
    () => clients.find(c => c.id === selectedClientId) || null,
    [clients, selectedClientId]
  )

  return (
    <div className="alpha-container">
      {/* Header with logo (enlarged + aligned) */}
      <div className="alpha-header" style={{ alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <img src="/symbol.png" width="28" height="28" alt="AlphaSourceAI" style={{ display: 'block' }} />
          <h1 style={{ margin: 0 }}>Admin Dashboard</h1>
        </div>
        <div className="alpha-actions">
          <span>{me?.user?.email || me?.email}</span>
          <button onClick={handleSignOut}>Sign Out</button>
        </div>
      </div>

      {/* Current client selector (top, larger control) */}
      <div className="alpha-card" style={{ marginTop: 12, paddingTop: 12 }}>
        <div className="row" style={{ alignItems: 'center' }}>
          <div style={{ fontSize: 12, opacity: 0.85, marginRight: 8 }}>Current client</div>
          <select
            value={selectedClientId}
            onChange={e => setSelectedClientId(e.target.value)}
            style={{ height: 34, fontSize: 14, padding: '6px 8px', minWidth: 220 }}
          >
            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </div>

      <div className="alpha-grid">
        {/* Clients */}
        <div className="alpha-card">
          <h3>Clients</h3>
          <div className="row">
            <input placeholder="Client name" value={newClientName} onChange={e => setNewClientName(e.target.value)} />
            <input placeholder="Client admin name" value={newClientAdminName} onChange={e => setNewClientAdminName(e.target.value)} />
            <input placeholder="Admin email" value={newClientAdminEmail} onChange={e => setNewClientAdminEmail(e.target.value)} />
            <button onClick={createClient}>Create</button>
          </div>

          <div className="row" style={{ marginTop: 8 }}>
            <Chip onClick={() => setShowClients(v => !v)} title={showClients ? 'Hide clients' : 'Show clients'}>
              {showClients ? 'Hide clients' : 'Show all clients'}
            </Chip>
          </div>

          {showClients && (
            <div className="list" style={{ marginTop: 8 }}>
              {clients.map(c => (
                <div key={c.id} className="list-row">
                  <div className="grow">
                    <div className="title">{c.name}</div>
                    <div className="sub">Created {new Date(c.created_at).toLocaleString()}</div>
                  </div>
                  <button className="alpha-chip" title="Delete client" onClick={() => deleteClient(c.id)}>
                    <IconTrash />
                  </button>
                </div>
              ))}
              {clients.length === 0 && <div className="muted">No clients yet</div>}
            </div>
          )}
        </div>

        {/* Roles */}
        <div className="alpha-card">
          <h3>Roles</h3>
          <div className="row">
            <input
              placeholder="Role title"
              value={newRoleTitle}
              onChange={e => setNewRoleTitle(e.target.value)}
            />
            <select value={interviewType} onChange={e => setInterviewType(e.target.value)} style={{ height: 34 }}>
              <option value="BASIC">BASIC</option>
              <option value="DETAILED">DETAILED</option>
              <option value="TECHNICAL">TECHNICAL</option>
            </select>

            <input
              key={fileClearedToken} // forces DOM refresh after clear
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx"
              onChange={e => setJobFile(e.target.files?.[0] || null)}
              aria-label="Job Description file (PDF or DOCX)"
            />

            {/* white trash in lilac button to clear selected file */}
            <button
              type="button"
              className="alpha-chip"
              title="Clear selected file"
              onClick={() => {
                setJobFile(null)
                if (fileInputRef.current) fileInputRef.current.value = ''
                setFileClearedToken(x => x + 1)
              }}
              aria-label="Clear selected JD file"
            >
              <IconTrash />
            </button>

            <button
              disabled={!selectedClientId || roleBusy || !newRoleTitle.trim() || !jobFile}
              onClick={createRole}
              title={!jobFile ? 'Choose a PDF or DOCX to enable Create' : 'Create role'}
            >
              {roleBusy ? 'Creating…' : 'Create'}
            </button>
          </div>

          <div className="row" style={{ marginTop: 8 }}>
            <Chip onClick={() => setShowRoles(v => !v)} title={showRoles ? 'Hide roles' : 'Show roles'}>
              {showRoles ? 'Hide roles' : 'Show roles'}
            </Chip>
          </div>

          {showRoles && (
            <>
              <div className="tableHeader" style={{ display: 'grid', gridTemplateColumns: '1fr 180px 60px 60px 90px 64px', gap: 8, padding: '10px 8px', opacity: 0.8 }}>
                <div>Role</div>
                <div>Created</div>
                <div>KB</div>
                <div>JD</div>
                <div>Link</div>
                <div>Delete</div>
              </div>
              <div className="list">
                {roles.map(r => (
                  <div key={r.id} className="list-row" style={{ display: 'grid', gridTemplateColumns: '1fr 180px 60px 60px 90px 64px', gap: 8 }}>
                    <div className="grow" style={{ minWidth: 0 }}>
                      <div className="title">{r.title}</div>
                      <div className="sub">Type: {r.interview_type || '—'} • Token: {r.slug_or_token}</div>
                    </div>
                    <div className="sub" style={{ alignSelf: 'center' }}>
                      {r.created_at ? new Date(r.created_at).toLocaleString() : '—'}
                    </div>
                    <div style={{ alignSelf: 'center', color: '#a0ffb3' }}>
                      {r.kb_document_id ? <IconCheck /> : '—'}
                    </div>
                    <div style={{ alignSelf: 'center', color: '#a0ffb3' }}>
                      {r.job_description_url ? <IconCheck /> : '—'}
                    </div>
                    <div style={{ alignSelf: 'center' }}>
                      <Chip onClick={() => navigator.clipboard.writeText(`${shareBase}?role=${r.slug_or_token}`)}>Copy link</Chip>
                    </div>
                    <div style={{ alignSelf: 'center' }}>
                      <button className="alpha-chip" title="Delete role" onClick={() => deleteRole(r.id)}>
                        <IconTrash />
                      </button>
                    </div>
                  </div>
                ))}
                {roles.length === 0 && <div className="muted">No roles yet</div>}
              </div>
            </>
          )}
        </div>

        {/* Members */}
        <div className="alpha-card">
          <h3>Client Members</h3>
          <div className="row">
            <input placeholder="Member name" value={memberName} onChange={e => setMemberName(e.target.value)} />
            <input placeholder="Member email" value={memberEmail} onChange={e => setMemberEmail(e.target.value)} />
            <select value={memberRole} onChange={e => setMemberRole(e.target.value)} style={{ height: 34 }}>
              <option value="member">Member</option>
              <option value="manager">Manager</option>
              <option value="admin">Admin</option>
            </select>
            <button disabled={!selectedClientId} onClick={addMember}>Add</button>
          </div>

          <div className="row" style={{ marginTop: 8 }}>
            <Chip onClick={() => setShowMembers(v => !v)} title={showMembers ? 'Hide members' : 'Show members'}>
              {showMembers ? 'Hide members' : 'Show members'}
            </Chip>
          </div>

          {showMembers && (
            <div className="list" style={{ marginTop: 8 }}>
              {members.map(m => (
                <div key={m.id} className="list-row">
                  <div className="grow">
                    <div className="title">{m.name}</div>
                    <div className="sub">{m.email} • {m.role || 'member'}</div>
                  </div>
                  <Chip onClick={() => removeMember(m.id)}>Remove</Chip>
                </div>
              ))}
              {members.length === 0 && <div className="muted">No members for this client</div>}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}