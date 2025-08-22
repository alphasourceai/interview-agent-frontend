// src/pages/Account.jsx
import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { supabase } from '../lib/supabaseClient'

async function getToken() {
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token || null
}

export default function Account() {
  const [clients, setClients] = useState([])
  const [clientId, setClientId] = useState('')
  const [members, setMembers] = useState([])
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('member')
  const [msg, setMsg] = useState('')

  async function load(cid) {
    setMsg('')
    const { clients } = await api.getMyClients(getToken)
    setClients(clients || [])
    const useId = cid || clients?.[0]?.client_id || ''
    setClientId(useId)
    if (useId) {
      const { members } = await api.getMembers(useId, getToken)
      setMembers(members || [])
    }
  }

  useEffect(() => { load() }, [])

  async function invite() {
    try {
      await api.createInvite({ client_id: clientId, email: inviteEmail, role: inviteRole }, getToken)
      setInviteEmail('')
      setMsg('Invite sent.')
    } catch (e) {
      setMsg(e.message)
    }
  }
  async function revoke(user_id) {
    if (!confirm('Remove this member?')) return
    try {
      await api.revokeMember({ client_id: clientId, user_id }, getToken)
      await load(clientId)
    } catch (e) {
      setMsg(e.message)
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-semibold mb-4">Account</h1>

      <div className="mb-4">
        <label className="block text-sm mb-1">Client</label>
        <select className="border rounded p-2" value={clientId} onChange={e=>load(e.target.value)}>
          {clients.map(c => <option key={c.client_id} value={c.client_id}>{c.client_name || c.client_id}</option>)}
        </select>
      </div>

      <h2 className="text-xl font-semibold mb-2">Members</h2>
      <div className="border rounded mb-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50">
              <th className="p-2 text-left">Email</th>
              <th className="p-2 text-left">Role</th>
              <th className="p-2 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {members.map(m => (
              <tr key={m.user_id} className="border-t">
                <td className="p-2">{m.email || m.user_id}</td>
                <td className="p-2">{m.role}</td>
                <td className="p-2">
                  <button className="border rounded px-2 py-1" onClick={() => revoke(m.user_id)}>Remove</button>
                </td>
              </tr>
            ))}
            {members.length === 0 && <tr><td className="p-2" colSpan={3}>No members yet.</td></tr>}
          </tbody>
        </table>
      </div>

      <h3 className="text-lg font-semibold mb-2">Invite a member</h3>
      <div className="flex gap-2 items-center">
        <input className="border rounded p-2 flex-1" placeholder="email@example.com" value={inviteEmail} onChange={e=>setInviteEmail(e.target.value)} />
        <select className="border rounded p-2" value={inviteRole} onChange={e=>setInviteRole(e.target.value)}>
          <option value="member">member</option>
          <option value="admin">admin</option>
          <option value="owner">owner</option>
        </select>
        <button className="border rounded px-3 py-2" onClick={invite} disabled={!clientId || !inviteEmail}>Invite</button>
      </div>

      {msg && <div className="mt-3 text-sm">{msg}</div>}
    </div>
  )
}
