import React, { useEffect, useState } from 'react'
import { apiGet, apiPost, apiDelete } from '../lib/api'
import { supabase } from '../lib/supabaseClient'
import '../styles/alphaTheme.css'

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
  const [jobFile, setJobFile] = useState(null)

  // members
  const [members, setMembers] = useState([])
  const [memberEmail, setMemberEmail] = useState('')
  const [memberName, setMemberName] = useState('')
  const [memberRole, setMemberRole] = useState('member') // member | manager | admin

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

  useEffect(() => {
    let alive = true
    ;(async () => {
      if (!isAdmin) return
      const r = await apiGet('/admin/roles' + (selectedClientId ? ('?client_id=' + encodeURIComponent(selectedClientId)) : ''))
      if (alive) setRoles(r?.items || [])
      if (selectedClientId) {
        const m = await apiGet('/admin/client-members?client_id=' + encodeURIComponent(selectedClientId))
        if (alive) setMembers(m?.items || [])
      } else {
        if (alive) setMembers([])
      }
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
    // optional: sign out to force a clean login
    await supabase.auth.signOut()
    window.location.href = '/admin'
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
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
  async function uploadJobDescription(file) {
  if (!file) return null
  const ext = (file.name.split('.').pop() || 'pdf').toLowerCase()
  // Path **inside** the bucket (no bucket prefix here)
  const objectPath = `${Date.now()}-${(crypto?.randomUUID?.() || Math.random().toString(36)).slice(0,8)}.${ext}`

  const { error } = await supabase.storage
    .from('job-descriptions')
    .upload(objectPath, file, {
      upsert: true,
      contentType: file.type || 'application/octet-stream'
    })

  if (error) { alert('Job description upload failed'); return null }

  // Store with bucket prefix in DB to match your existing rows
  return `job-descriptions/${objectPath}`
}


  const createRole = async () => {
    if (!selectedClientId) return
    const title = newRoleTitle.trim()
    if (!title) return
    let jdPath = null
    if (jobFile) jdPath = await uploadJobDescription(jobFile)
    const payload = {
      client_id: selectedClientId,
      title,
      interview_type: interviewType,
      job_description_url: jdPath || null
    }
    const resp = await apiPost('/admin/roles', payload)
    if (resp?.item) {
      setRoles([resp.item, ...roles])
      setNewRoleTitle('')
      setJobFile(null)
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

  /* ---------- Force the RESET UI whenever showReset is true ----------
     Supabase recovery links create a temporary session.
     We still want to render the password reset form, not the dashboard. */
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

  // ---------- Auth screens ----------
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
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  textDecoration: 'underline',
                  cursor: 'pointer',
                  font: 'inherit'
                }}
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

  // ---------- Admin app ----------
  return (
    <div className="alpha-container">
      <div className="alpha-header">
        <h1>Admin</h1>
        <div className="alpha-actions">
          <span>{me?.user?.email || me?.email}</span>
          <button onClick={handleSignOut}>Sign Out</button>
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
          <div className="row">
            <select value={selectedClientId} onChange={e => setSelectedClientId(e.target.value)}>
              <option value="">Select a client</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            {selectedClientId && <button onClick={() => deleteClient(selectedClientId)}>Delete</button>}
          </div>
        </div>

        {/* Roles */}
        <div className="alpha-card">
          <h3>Roles</h3>
          <div className="row">
            <input placeholder="Role title" value={newRoleTitle} onChange={e => setNewRoleTitle(e.target.value)} />
            <select value={interviewType} onChange={e => setInterviewType(e.target.value)}>
              <option value="BASIC">BASIC</option>
              <option value="DETAILED">DETAILED</option>
              <option value="TECHNICAL">TECHNICAL</option>
            </select>
            <input type="file" accept=".pdf,.doc,.docx,.txt" onChange={e => setJobFile(e.target.files?.[0] || null)} />
            <button disabled={!selectedClientId} onClick={createRole}>Create</button>
          </div>

          <div className="list">
            {roles.map(r => (
              <div key={r.id} className="list-row">
                <div className="grow">
                  <div className="title">{r.title}</div>
                  <div className="sub">{`${shareBase}?role=${r.slug_or_token}`}</div>
                </div>
                <button onClick={() => navigator.clipboard.writeText(`${shareBase}?role=${r.slug_or_token}`)}>Copy link</button>
                <button onClick={() => deleteRole(r.id)}>Delete</button>
              </div>
            ))}
            {roles.length === 0 && <div className="muted">No roles yet</div>}
          </div>
        </div>

        {/* Members */}
        <div className="alpha-card">
          <h3>Client Members</h3>
          <div className="row">
            <input placeholder="Member name" value={memberName} onChange={e => setMemberName(e.target.value)} />
            <input placeholder="Member email" value={memberEmail} onChange={e => setMemberEmail(e.target.value)} />
            <select value={memberRole} onChange={e => setMemberRole(e.target.value)}>
              <option value="member">Member</option>
              <option value="manager">Manager</option>
              <option value="admin">Admin</option>
            </select>
            <button disabled={!selectedClientId} onClick={addMember}>Add</button>
          </div>
          <div className="list">
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
        </div>
      </div>
    </div>
  )
}
