// src/pages/Admin.jsx
import React, { useEffect, useRef, useState } from 'react'
import { apiGet, apiPost, apiDelete, api } from '../lib/api'
import { supabase } from '../lib/supabaseClient'
import '../styles/alphaTheme.css'

// ---- tiny icons (inline SVG so no extra deps) ----
function IconChevron({ open }) {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d={open ? 'M6 15l6-6 6 6' : 'M6 9l6 6 6-6'}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
function IconTrash() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M3 6h18M9 6v12m6-12v12M8 6l1-2h6l1 2M6 6l1 14h10l1-14"
        fill="none"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
function IconCheck() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M20 6L9 17l-5-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export default function Admin() {
  const [session, setSession] = useState(null)
  const [me, setMe] = useState(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)

  // auth form
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  // forgot/reset password
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
  const [roleBusy, setRoleBusy] = useState(false)

  // JD file input (with bullet-proof clear)
  const [jobFile, setJobFile] = useState(null)
  const fileInputRef = useRef(null)
  const [fileKey, setFileKey] = useState(0)

  // members
  const [members, setMembers] = useState([])
  const [memberEmail, setMemberEmail] = useState('')
  const [memberName, setMemberName] = useState('')
  const [memberRole, setMemberRole] = useState('member') // member | manager | admin

  // collapsible sections (persist across refresh; default collapsed on new auth)
  const [showClients, setShowClients] = useState(
    localStorage.getItem('adm_show_clients') === '1'
  )
  const [showRoles, setShowRoles] = useState(
    localStorage.getItem('adm_show_roles') === '1'
  )
  const [showMembers, setShowMembers] = useState(
    localStorage.getItem('adm_show_members') === '1'
  )

  useEffect(() => { localStorage.setItem('adm_show_clients', showClients ? '1' : '0') }, [showClients])
  useEffect(() => { localStorage.setItem('adm_show_roles', showRoles ? '1' : '0') }, [showRoles])
  useEffect(() => { localStorage.setItem('adm_show_members', showMembers ? '1' : '0') }, [showMembers])

  const shareBase = 'https://www.alphasourceai.com/interview-agent'

  // Detect Supabase recovery redirect (?pwreset=1 or hash type=recovery)
  useEffect(() => {
    const url = new URL(window.location.href)
    const needsReset =
      url.searchParams.get('pwreset') === '1' ||
      window.location.hash.includes('type=recovery') ||
      window.location.hash.includes('recovery')
    if (needsReset) setShowReset(true)
  }, [])

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
    // Collapse sections on fresh auth next time
    localStorage.setItem('adm_show_clients', '0')
    localStorage.setItem('adm_show_roles', '0')
    localStorage.setItem('adm_show_members', '0')
    window.location.href = '/admin'
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    localStorage.setItem('adm_show_clients', '0')
    localStorage.setItem('adm_show_roles', '0')
    localStorage.setItem('adm_show_members', '0')
    window.location.href = '/admin'
  }

  // ---------- Clients ----------
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

  // ---------- Roles ----------
  const uploadJDToBackend = async (roleId, file) => {
    const form = new FormData()
    form.append('file', file)
    const qs = new URLSearchParams({
      client_id: selectedClientId,
      role_id: roleId
    }).toString()
    return api.upload(`/roles-upload/upload-jd?${qs}`, form)
  }

  const clearJD = () => {
    setJobFile(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
    setFileKey(k => k + 1) // remount ensures filename clears in all browsers
  }

  const createRole = async () => {
    if (!selectedClientId) return
    const title = newRoleTitle.trim()
    if (!title) return

    // REQUIRE a JD file for role creation
    if (!jobFile) {
      alert('Please choose a Job Description file (PDF or DOCX) before creating the role.')
      return
    }

    setRoleBusy(true)
    try {
      // 1) Create role
      const payload = {
        client_id: selectedClientId,
        title,
        interview_type: interviewType
      }
      const resp = await apiPost('/admin/roles', payload)
      const role = resp?.item
      if (!role) {
        alert('Role create failed')
        return
      }

      // 2) Upload JD (required)
      try {
        const out = await uploadJDToBackend(role.id, jobFile)
        if (out?.parsed_text_preview) {
          console.log('[JD preview]', out.parsed_text_preview)
        }
      } catch (e) {
        console.error('uploadJDToBackend error', e)
        alert('Role created, but JD processing failed: ' + e.message)
      }

      // 3) Refresh roles and reset inputs/File
      await refreshRoles(selectedClientId)
      setNewRoleTitle('')
      clearJD()
    } finally {
      setRoleBusy(false)
    }
  }

  const deleteRole = async (id) => {
    if (!confirm('Delete this role?')) return
    await apiDelete('/admin/roles/' + id)
    setRoles(roles.filter(r => r.id !== id))
  }

  // ---------- Members ----------
  const addMember = async () => {
    if (!selectedClientId) return
    const e = memberEmail.trim()
    const n = memberName.trim()
    if (!e || !n) return
    const resp = await apiPost('/admin/client-members', {
      client_id: selectedClientId,
      email: e,
      name: n,
      role: memberRole
    })
    if (resp?.item) {
      setMembers([resp.item, ...members])
      setMemberEmail('')
      setMemberName('')
      setMemberRole('member')
      alert('Invite sent and member added')
    }
  }

  const removeMember = async (id) => {
    if (!confirm('Remove this member?')) return
    await apiDelete('/admin/client-members/' + id)
    setMembers(members.filter(m => m.id !== id))
  }

  if (loading) {
    return <div className="alpha-container"><div className="alpha-card"><h2>Loading…</h2></div></div>
  }

  // ---------- Reset UI ----------
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

  // ---------- Admin app ----------
  return (
    <div className="alpha-container">
      {/* Header */}
      <div className="alpha-header">
        <div className="left">
          <img src="/alpha-symbol.png" alt="AlphaSourceAI" className="alpha-logo" />
          <h1>Admin Dashboard</h1>
        </div>
        <div className="alpha-actions">
          <span>{me?.user?.email || me?.email}</span>
          <button onClick={handleSignOut}>Sign Out</button>
        </div>
      </div>

      {/* Current client selector */}
      <div className="alpha-card">
        <label className="block text-sm mb-1">Current client</label>
        <select
          className="alpha-input tall"
          value={selectedClientId}
          onChange={e => setSelectedClientId(e.target.value)}
        >
          {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      <div className="alpha-grid">
        {/* Clients */}
        <div className="alpha-card">
          <h3 className="alpha-section-title">Clients</h3>
          <div className="row">
            <input className="alpha-input" placeholder="Client name" value={newClientName} onChange={e => setNewClientName(e.target.value)} />
            <input className="alpha-input" placeholder="Client admin name" value={newClientAdminName} onChange={e => setNewClientAdminName(e.target.value)} />
            <input className="alpha-input" placeholder="Admin email" value={newClientAdminEmail} onChange={e => setNewClientAdminEmail(e.target.value)} />
            <button onClick={createClient}>Create</button>
          </div>

          <button className="alpha-disclosure" onClick={() => setShowClients(v => !v)}>
            <IconChevron open={showClients} /> <span>{showClients ? 'Hide' : 'Show'} all clients</span>
          </button>

          {showClients && (
            <div className="alpha-table">
              {clients.map(c => (
                <div key={c.id} className="alpha-row">
                  <div className="grow">
                    <div className="title">{c.name}</div>
                  </div>
                  <button
                    className="btn-icon lilac"
                    title="Delete client"
                    onClick={() => deleteClient(c.id)}
                  >
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
          <h3 className="alpha-section-title">Roles</h3>

          <div className="row">
            <input className="alpha-input" placeholder="Role title" value={newRoleTitle} onChange={e => setNewRoleTitle(e.target.value)} />
            <select className="alpha-input tall" value={interviewType} onChange={e => setInterviewType(e.target.value)}>
              <option value="BASIC">BASIC</option>
              <option value="DETAILED">DETAILED</option>
              <option value="TECHNICAL">TECHNICAL</option>
            </select>

            <div className="file-stack">
              <input
                className="alpha-input file"
                type="file"
                accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={e => setJobFile(e.target.files?.[0] || null)}
                aria-label="Job Description file (PDF or DOCX)"
                ref={fileInputRef}
                key={fileKey}
              />
              {jobFile && (
                <button
                  type="button"
                  className="btn-icon lilac file-clear"
                  title="Remove file"
                  onClick={clearJD}
                >
                  <IconTrash />
                </button>
              )}
              <span className="muted note">*.pdf or *.docx</span>
            </div>

            <button
              disabled={!selectedClientId || roleBusy || !newRoleTitle.trim() || !jobFile}
              onClick={createRole}
              title={!jobFile ? 'Choose a PDF or DOCX to enable Create' : 'Create role'}
            >
              {roleBusy ? 'Creating…' : 'Create'}
            </button>
          </div>

          <button className="alpha-disclosure" onClick={() => setShowRoles(v => !v)}>
            <IconChevron open={showRoles} /> <span>{showRoles ? 'Hide' : 'Show'} roles</span>
          </button>

          {showRoles && (
            <div className="alpha-table header-cols">
              <div className="alpha-row header">
                <div className="grow">Role</div>
                <div className="col small">Created</div>
                <div className="col tiny center">KB</div>
                <div className="col tiny center">JD</div>
                <div className="col small center">Link</div>
                <div className="col tiny center">Delete</div>
              </div>

              {roles.map(r => {
                const created = r.created_at ? new Date(r.created_at).toLocaleString() : '—'
                const hasKB = !!r.kb_document_id
                const hasJD = !!(r.job_description_url && r.description)
                const link = `${shareBase}?role=${r.slug_or_token}`
                return (
                  <div key={r.id} className="alpha-row">
                    <div className="grow">
                      <div className="title">{r.title}</div>
                      <div className="sub">Type: {r.interview_type || '—'} • Token: {r.slug_or_token}</div>
                    </div>
                    <div className="col small">{created}</div>
                    <div className="col tiny center">{hasKB ? <IconCheck /> : '—'}</div>
                    <div className="col tiny center">{hasJD ? <IconCheck /> : '—'}</div>
                    <div className="col small center">
                      <button onClick={() => navigator.clipboard.writeText(link)}>Copy link</button>
                    </div>
                    <div className="col tiny center">
                      <button className="btn-icon lilac" onClick={() => deleteRole(r.id)} title="Delete role">
                        <IconTrash />
                      </button>
                    </div>
                  </div>
                )
              })}
              {roles.length === 0 && <div className="muted">No roles yet</div>}
            </div>
          )}
        </div>

        {/* Members */}
        <div className="alpha-card">
          <h3 className="alpha-section-title">Client Members</h3>
          <div className="row">
            <input className="alpha-input" placeholder="Member name" value={memberName} onChange={e => setMemberName(e.target.value)} />
            <input className="alpha-input" placeholder="Member email" value={memberEmail} onChange={e => setMemberEmail(e.target.value)} />
            <select className="alpha-input tall" value={memberRole} onChange={e => setMemberRole(e.target.value)}>
              <option value="member">Member</option>
              <option value="manager">Manager</option>
              <option value="admin">Admin</option>
            </select>
            <button disabled={!selectedClientId} onClick={addMember}>Add</button>
          </div>

          <button className="alpha-disclosure" onClick={() => setShowMembers(v => !v)}>
            <IconChevron open={showMembers} /> <span>{showMembers ? 'Hide' : 'Show'} members</span>
          </button>

          {showMembers && (
            <div className="alpha-table">
              {members.map(m => (
                <div key={m.id} className="alpha-row">
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
  )
}