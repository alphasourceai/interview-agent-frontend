import React, { useEffect, useMemo, useState } from 'react'
import { api, apiGet, apiPost, apiDelete } from '../lib/api' // keep legacy helpers + new api.upload
import { supabase } from '../lib/supabaseClient'
import '../styles/alphaTheme.css'

/* ---------- tiny SVG icons (inline, theme-friendly) ---------- */
const Chevron = ({ open }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" className="icon">
    <path d={open ? 'M6 15l6-6 6 6' : 'M6 9l6 6 6-6'} fill="none" stroke="currentColor" strokeWidth="2" />
  </svg>
)
const Trash = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" className="icon">
    <path d="M3 6h18M8 6V4h8v2m-1 0v14H8V6h8z" fill="none" stroke="currentColor" strokeWidth="2" />
  </svg>
)
const Check = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" className="icon">
    <path d="M20 6L9 17l-5-5" fill="none" stroke="currentColor" strokeWidth="2" />
  </svg>
)

/* ---------- localStorage helpers (persist per-user) ---------- */
function lsKey(userEmail, key) {
  return `admin_ui:${userEmail || 'anon'}:${key}`
}
function readBool(userEmail, key, fallback = false) {
  try {
    const v = localStorage.getItem(lsKey(userEmail, key))
    if (v === 'true') return true
    if (v === 'false') return false
    return fallback
  } catch { return fallback }
}
function writeBool(userEmail, key, val) {
  try { localStorage.setItem(lsKey(userEmail, key), String(!!val)) } catch {}
}

export default function Admin() {
  /* ---------- auth / session ---------- */
  const [session, setSession] = useState(null)
  const [me, setMe] = useState(null)
  const userEmail = me?.user?.email || me?.email || ''

  /* ---------- page state ---------- */
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)

  // sign-in form
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  // reset flow
  const [showReset, setShowReset] = useState(false)
  const [newPass1, setNewPass1] = useState('')
  const [newPass2, setNewPass2] = useState('')

  // data: clients / roles / members
  const [clients, setClients] = useState([])
  const [selectedClientId, setSelectedClientId] = useState('')
  const [roles, setRoles] = useState([])
  const [members, setMembers] = useState([])

  // create client
  const [newClientName, setNewClientName] = useState('')
  const [newClientAdminName, setNewClientAdminName] = useState('')
  const [newClientAdminEmail, setNewClientAdminEmail] = useState('')

  // create role
  const [newRoleTitle, setNewRoleTitle] = useState('')
  const [interviewType, setInterviewType] = useState('BASIC')
  const [jobFile, setJobFile] = useState(null)
  const [roleBusy, setRoleBusy] = useState(false)

  // add member
  const [memberEmail, setMemberEmail] = useState('')
  const [memberName, setMemberName] = useState('')
  const [memberRole, setMemberRole] = useState('member')

  // expand/collapse (persisted per-user)
  const [openClients, setOpenClients] = useState(false)
  const [openRoles, setOpenRoles] = useState(false)
  const [openMembers, setOpenMembers] = useState(false)

  // share link base
  const shareBase = 'https://www.alphasourceai.com/interview-agent'

  /* ---------- init reset detection ---------- */
  useEffect(() => {
    const url = new URL(window.location.href)
    const needsReset =
      url.searchParams.get('pwreset') === '1' ||
      window.location.hash.includes('type=recovery') ||
      window.location.hash.includes('recovery')
    if (needsReset) setShowReset(true)
  }, [])

  /* ---------- load session & bootstrap ---------- */
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
          // admin probe
          await apiGet('/admin/clients')
          if (!alive) return
          setIsAdmin(true)
        } catch {
          if (!alive) return
          setIsAdmin(false)
        }
      }
      if (alive) setLoading(false)
    })()
    return () => { alive = false }
  }, [])

  /* ---------- after we know user email: restore expand states ---------- */
  useEffect(() => {
    if (!userEmail) return
    setOpenClients(readBool(userEmail, 'openClients', false))
    setOpenRoles(readBool(userEmail, 'openRoles', false))
    setOpenMembers(readBool(userEmail, 'openMembers', false))
  }, [userEmail])

  /* ---------- load initial data once admin ---------- */
  async function refreshClients() {
    const r = await apiGet('/admin/clients')
    const list = r?.items || []
    // newest first
    list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    setClients(list)
    if (!selectedClientId && list[0]?.id) setSelectedClientId(list[0].id)
  }
  async function refreshRoles(clientId) {
    if (!clientId) { setRoles([]); return }
    const r = await apiGet('/admin/roles?client_id=' + encodeURIComponent(clientId))
    const list = r?.items || []
    list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    setRoles(list)
  }
  async function refreshMembers(clientId) {
    if (!clientId) { setMembers([]); return }
    const r = await apiGet('/admin/client-members?client_id=' + encodeURIComponent(clientId))
    setMembers(r?.items || [])
  }
  useEffect(() => {
    let alive = true
    ;(async () => {
      if (!isAdmin) return
      await refreshClients()
    })()
    return () => { alive = false }
  }, [isAdmin])

  useEffect(() => {
    let alive = true
    ;(async () => {
      if (!isAdmin) return
      await refreshRoles(selectedClientId)
      await refreshMembers(selectedClientId)
    })()
    return () => { alive = false }
  }, [isAdmin, selectedClientId])

  /* ---------- handlers ---------- */
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
    // clear persisted expand state on logout
    writeBool(userEmail, 'openClients', false)
    writeBool(userEmail, 'openRoles', false)
    writeBool(userEmail, 'openMembers', false)
    await supabase.auth.signOut()
    window.location.href = '/admin'
  }

  const createClient = async () => {
    const name = newClientName.trim()
    const admin_name = newClientAdminName.trim()
    const admin_email = newClientAdminEmail.trim()
    if (!name) return
    const resp = await apiPost('/admin/clients', { name, admin_name, admin_email })
    const item = resp?.item
    if (item) {
      await refreshClients()
      setNewClientName(''); setNewClientAdminName(''); setNewClientAdminEmail('')
      setSelectedClientId(item.id)
      if (resp?.seeded_member) setMembers(m => [resp.seeded_member, ...m])
    }
  }

  const deleteClient = async (id) => {
    if (!confirm('Delete this client?')) return
    await apiDelete('/admin/clients/' + id)
    await refreshClients()
    if (selectedClientId === id) {
      setSelectedClientId(clients[0]?.id || '')
      await refreshRoles(clients[0]?.id || '')
      await refreshMembers(clients[0]?.id || '')
    }
  }

  const clearFile = () => setJobFile(null)

  const jdUploadToBackend = async (roleId, file) => {
    const form = new FormData()
    form.append('file', file)
    const qs = new URLSearchParams({ client_id: selectedClientId, role_id: roleId }).toString()
    return api.upload(`/roles-upload/upload-jd?${qs}`, form)
  }

  const createRole = async () => {
    if (!selectedClientId) return
    const title = newRoleTitle.trim()
    if (!title) return
    if (!jobFile) return alert('Please choose a PDF/DOCX first.')

    setRoleBusy(true)
    try {
      const payload = { client_id: selectedClientId, title, interview_type: interviewType }
      const resp = await apiPost('/admin/roles', payload)
      const role = resp?.item
      if (!role) throw new Error('Role create failed')

      // Upload JD right after create
      await jdUploadToBackend(role.id, jobFile)

      await refreshRoles(selectedClientId)
      setNewRoleTitle(''); setJobFile(null)
    } catch (e) {
      console.error(e)
      alert(e.message || 'Failed to create role')
    } finally {
      setRoleBusy(false)
    }
  }

  const deleteRole = async (id) => {
    if (!confirm('Delete this role?')) return
    await apiDelete('/admin/roles/' + id)
    await refreshRoles(selectedClientId)
  }

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

  /* ---------- helpers ---------- */
  const fmtDate = (s) => {
    if (!s) return ''
    const d = new Date(s)
    return d.toLocaleString([], { month: 'short', day: '2-digit', year: 'numeric', hour: 'numeric', minute: '2-digit' })
  }
  const copyLink = async (slug) => {
    const url = `${shareBase}?role=${slug}`
    try {
      await navigator.clipboard.writeText(url)
      alert('Copied!')
    } catch {
      prompt('Copy link:', url)
    }
  }

  const clientOptions = useMemo(() =>
    clients.map(c => ({ id: c.id, name: c.name })), [clients])

  /* ---------- UI ---------- */

  if (loading) {
    return <div className="alpha-container"><div className="alpha-card"><h2>Loading…</h2></div></div>
  }

  if (showReset) {
    return (
      <div className="alpha-container">
        <div className="alpha-header">
          <h1>Admin</h1>
          <div />
        </div>
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
        <div className="alpha-header">
          <h1>Admin</h1>
          <div />
        </div>
        <div className="alpha-card alpha-form">
          <h2>Admin Sign In</h2>
          <form onSubmit={handleSignIn}>
            <label>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required />
            <label>Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required />
            <div className="row">
              <button type="submit">Sign In</button>
              <button type="button" className="linklike" onClick={startReset}>Forgot password?</button>
            </div>
          </form>
        </div>
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="alpha-container">
        <div className="alpha-header">
          <h1>Admin</h1>
          <div className="alpha-actions">
            <button onClick={handleSignOut}>Sign Out</button>
          </div>
        </div>
        <div className="alpha-card">
          <h2>Access denied</h2>
          <p>Your account is not an admin.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="alpha-container">
      {/* Header with email + sign out on the right */}
      <div className="alpha-header">
        <h1>Admin</h1>
        <div className="alpha-actions">
          <span className="muted">{userEmail}</span>
          <button onClick={handleSignOut}>Sign Out</button>
        </div>
      </div>

      {/* Current client selector (bigger) */}
      <div className="alpha-card">
        <div className="row">
          <label className="mr-8">Current client</label>
          <select
            className="select-lg"
            value={selectedClientId}
            onChange={e => setSelectedClientId(e.target.value)}
          >
            {clientOptions.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </div>

      <div className="alpha-grid">
        {/* Clients Section */}
        <div className="alpha-card">
          <div className="section-header">
            <h3>Clients</h3>
          </div>

          <div className="row">
            <input placeholder="Client name" value={newClientName} onChange={e => setNewClientName(e.target.value)} />
            <input placeholder="Client admin name" value={newClientAdminName} onChange={e => setNewClientAdminName(e.target.value)} />
            <input placeholder="Admin email" value={newClientAdminEmail} onChange={e => setNewClientAdminEmail(e.target.value)} />
            <button onClick={createClient}>Create</button>
          </div>

          <div className="section">
            <button
              className="toggle"
              onClick={() => { const v = !openClients; setOpenClients(v); writeBool(userEmail, 'openClients', v) }}
              aria-expanded={openClients}
            >
              <Chevron open={openClients} /> <span className="ml-2">Show all clients</span>
            </button>

            {openClients && (
              <div className="list compact">
                {clients.map(c => (
                  <div key={c.id} className="list-row">
                    <div className="grow">
                      <div className="title">{c.name}</div>
                      <div className="sub">Created: {fmtDate(c.created_at)}</div>
                    </div>
                    <button
                      title="Delete client"
                      className="icon-btn"
                      onClick={() => deleteClient(c.id)}
                    >
                      <Trash />
                    </button>
                  </div>
                ))}
                {clients.length === 0 && <div className="muted">No clients yet</div>}
              </div>
            )}
          </div>
        </div>

        {/* Roles Section */}
        <div className="alpha-card">
          <div className="section-header">
            <h3>Roles</h3>
          </div>

          <div className="row">
            <input placeholder="Role title" value={newRoleTitle} onChange={e => setNewRoleTitle(e.target.value)} />
            <select className="select-lg" value={interviewType} onChange={e => setInterviewType(e.target.value)}>
              <option value="BASIC">BASIC</option>
              <option value="DETAILED">DETAILED</option>
              <option value="TECHNICAL">TECHNICAL</option>
            </select>

            <div className="file-wrap">
              <input
                type="file"
                accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={e => setJobFile(e.target.files?.[0] || null)}
              />
              {jobFile && (
                <button type="button" className="icon-btn ml-2" title="Clear file" onClick={clearFile}>
                  <Trash />
                </button>
              )}
            </div>

            <button disabled={!selectedClientId || roleBusy || !jobFile || !newRoleTitle.trim()} onClick={createRole}>
              {roleBusy ? 'Creating…' : 'Create'}
            </button>
          </div>

          <div className="section">
            <button
              className="toggle"
              onClick={() => { const v = !openRoles; setOpenRoles(v); writeBool(userEmail, 'openRoles', v) }}
              aria-expanded={openRoles}
            >
              <Chevron open={openRoles} /> <span className="ml-2">Show roles</span>
            </button>

            {openRoles && (
              <div className="list">
                {/* header row */}
                <div className="list-row header">
                  <div className="grow">Role</div>
                  <div className="col">Created</div>
                  <div className="col center">KB</div>
                  <div className="col center">JD</div>
                  <div className="col">Link</div>
                  <div className="col">Delete</div>
                </div>

                {roles.map(r => {
                  const hasKB = !!r.kb_document_id
                  const hasJD = !!(r.job_description_url && r.description)
                  return (
                    <div key={r.id} className="list-row">
                      <div className="grow">
                        <div className="title">{r.title}</div>
                        <div className="sub">Type: {r.interview_type || '—'} • Token: {r.slug_or_token}</div>
                      </div>
                      <div className="col">{fmtDate(r.created_at)}</div>
                      <div className="col center">{hasKB ? <Check /> : '—'}</div>
                      <div className="col center">{hasJD ? <Check /> : '—'}</div>
                      <div className="col">
                        <button onClick={() => copyLink(r.slug_or_token)}>Copy link</button>
                      </div>
                      <div className="col">
                        <button className="danger" onClick={() => deleteRole(r.id)}>Delete</button>
                      </div>
                    </div>
                  )
                })}
                {roles.length === 0 && <div className="muted">No roles yet</div>}
              </div>
            )}
          </div>
        </div>

        {/* Members Section */}
        <div className="alpha-card">
          <div className="section-header">
            <h3>Client Members</h3>
          </div>

          <div className="row">
            <input placeholder="Member name" value={memberName} onChange={e => setMemberName(e.target.value)} />
            <input placeholder="Member email" value={memberEmail} onChange={e => setMemberEmail(e.target.value)} />
            <select className="select-lg" value={memberRole} onChange={e => setMemberRole(e.target.value)}>
              <option value="member">Member</option>
              <option value="manager">Manager</option>
              <option value="admin">Admin</option>
            </select>
            <button disabled={!selectedClientId} onClick={addMember}>Add</button>
          </div>

          <div className="section">
            <button
              className="toggle"
              onClick={() => { const v = !openMembers; setOpenMembers(v); writeBool(userEmail, 'openMembers', v) }}
              aria-expanded={openMembers}
            >
              <Chevron open={openMembers} /> <span className="ml-2">Show members</span>
            </button>

            {openMembers && (
              <div className="list">
                {members.map(m => (
                  <div key={m.id} className="list-row">
                    <div className="grow">
                      <div className="title">{m.name}</div>
                      <div className="sub">{m.email} • {m.role || 'member'}</div>
                    </div>
                    <button className="danger" onClick={() => removeMember(m.id)}>Remove</button>
                  </div>
                ))}
                {members.length === 0 && <div className="muted">No members for this client</div>}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}