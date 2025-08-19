import { useEffect, useState } from 'react'
import { apiPost } from '../lib/api'
import { supabase } from '../lib/supabaseClient'

export default function AcceptInvite() {
  const [status, setStatus] = useState('checking')
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    const url = new URL(window.location.href)
    const token = url.searchParams.get('token') || ''
    if (!token) {
      setStatus('error')
      setError('Missing token')
      return
    }

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) {
        setStatus('needs-login')
        return
      }
      setStatus('accepting')
      try {
        const res = await apiPost('/clients/accept-invite', { token })
        setStatus('accepted')
        setMsg(`Joined client ${res.client_id} as ${res.role}`)
      } catch (e) {
        setStatus('error')
        setError(String(e))
      }
    })
  }, [])

  const url = new URL(window.location.href)
  const next = url.pathname + url.search

  return (
    <div style={{ padding: 24, fontFamily: 'system-ui' }}>
      <h1>Accept Invite</h1>

      {status === 'checking' && <div>Checking session…</div>}

      {status === 'needs-login' && (
        <div>
          <p>Please sign in to accept this invite.</p>
          <a href={`/signin?next=${encodeURIComponent(next)}`}>Sign in</a>
        </div>
      )}

      {status === 'accepting' && <div>Accepting…</div>}

      {status === 'accepted' && (
        <div>
          <div>{msg}</div>
          <div style={{ marginTop: 12 }}>
            <a href="/">Go to dashboard</a>
          </div>
        </div>
      )}

      {status === 'error' && <div style={{ color: 'crimson' }}>{error}</div>}
    </div>
  )
}
