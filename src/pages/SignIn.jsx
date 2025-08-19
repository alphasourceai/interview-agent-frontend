import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function SignIn() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [err, setErr] = useState('')

  const url = new URL(window.location.href)
  const next = url.searchParams.get('next') || '/'
  const redirectTo = window.location.origin + next

  async function onSubmit(e) {
    e.preventDefault()
    setErr('')
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo }
    })
    if (error) setErr(error.message)
    else setSent(true)
  }

  if (sent) return (
    <div style={{ maxWidth:360, margin:'64px auto', fontFamily:'system-ui' }}>
      Check your email for the sign-in link.
    </div>
  )

  return (
    <div style={{ maxWidth:360, margin:'64px auto', fontFamily:'system-ui' }}>
      <h1>Sign in</h1>
      <form onSubmit={onSubmit}>
        <input
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={e => setEmail(e.target.value)}
          style={{ width:'100%', padding:'12px', marginBottom:'12px' }}
          required
        />
        <button type="submit" style={{ width:'100%', padding:'12px' }}>Send magic link</button>
      </form>
      {err && <div style={{ color:'crimson', marginTop:12 }}>{err}</div>}
    </div>
  )
}
