import React, { useEffect, useMemo, useState } from 'react'
import { apiGet, apiPost, apiDelete } from '../lib/api'
import { supabase } from '../lib/supabaseClient'
import '../styles/alphaTheme.css'

export default function Admin() {
  const [session, setSession] = useState(null)
  const [me, setMe] = useState(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const [clients, setClients] = useState([])
  const [selectedClientId, setSelectedClientId] = useState('')
  const [newClientName, setNewClientName] = useState('')

  const [roles, setRoles] = useState([])
  const [newRoleTitle, setNewRoleTitle] = useState('')

  const [members, setMembers] = useState([])
  const [memberEmail, setMemberEmail] = useState('')
  const [memberName, setMemberName] = useState('')

  const shareBase = 'https://www.alphasourceai.com/interview-agent'

  useEffect(() => {
    let alive = true
    ;(async () => {
      const { data } = await supabase.auth.getSession()
      setSession(data?.session || null)
      if (data?.session) {
        try {
          const u = await apiGet('/auth/me')
          setMe(u || null)
          // Probe admin by hitting list clients
          const probe = await apiGet('/admin/clients')
          setIsAdmin(true)
          setClients(probe?.items || [])
          if ((probe?.items || []).length && !selectedClientId) {
            setSelectedClientId(probe.items[0].id)
          }
        } catch {
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
    if (error) return alert('Sign in failed')
    setSession(data?.session || null)
    window.location.reload()
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    window.location.href = 'https://www.alphasourceai.com/account?logged_out=1'
  }

  const createClient = async () => {
    const name = newClientName.trim()
    if (!name) return
    const resp = await apiPost('/admin/clients', { name })
    const item = resp?.item
    if (item) {
      const next = [item, ...clients].sort((a, b) => a.name.localeCompare(b.name))
      setClients(next)
      setNewClientName('')
      setSelectedClientId(item.id)
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

  const createRole = async () => {
    if (!selectedClientId) return
    const title = newRoleTitle.trim()
    if (!title) return
    const resp = await apiPost('/admin/roles', { client_id: selectedClientId, title })
    if (resp?.item) {
      setRoles([resp.item, ...roles])
      setNewRoleTitle('')
    }
  }

  const deleteRole = async (id) => {
    if (!confirm('Delete this role?')) return
    await apiDelete('/admin/roles/' + id)
    setRoles(roles.filter(r => r.id !== id))
  }

  const addMember = async () => {
    if (!selectedClientId) return
    const e = memberEmail.trim()
    const n = memberName.trim()
    if (!e || !n) return
    const resp = await apiPost('/admin/client-members', { client_id: selectedClientId, email: e, name: n })
    if (resp?.item) {
      setMembers([resp.item, ...members])
      setMemberEmail('')
      setMemberName('')
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
          </form>
        </div>
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="alpha-container">
        <div className="alpha-card"><h2>Access denied</h2><p>Your account is not an admin.</p><button onClick={handleSignOut}>Sign Out</button></div>
      </div>
    )
  }

  return (
    <div className="alpha-container">
      <div className="alpha-header">
        <h1>Admin</h1>
        <div className="alpha-actions">
          <span>{me?.email}</span>
          <button onClick={handleSignOut}>Sign Out</button>
        </div>
      </div>

      <div className="alpha-grid">
        <div className="alpha-card">
          <h3>Clients</h3>
          <div className="row">
            <input placeholder="New client name" value={newClientName} onChange={e => setNewClientName(e.target.value)} />
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

        <div className="alpha-card">
          <h3>Roles</h3>
          <div className="row">
            <input placeholder="Role title" value={newRoleTitle} onChange={e => setNewRoleTitle(e.target.value)} />
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

        <div className="alpha-card">
          <h3>Client Members</h3>
          <div className="row">
            <input placeholder="Member name" value={memberName} onChange={e => setMemberName(e.target.value)} />
            <input placeholder="Member email" value={memberEmail} onChange={e => setMemberEmail(e.target.value)} />
            <button disabled={!selectedClientId} onClick={addMember}>Add</button>
          </div>
          <div className="list">
            {members.map(m => (
              <div key={m.id} className="list-row">
                <div className="grow">
                  <div className="title">{m.name}</div>
                  <div className="sub">{m.email}</div>
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
