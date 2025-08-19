import { supabase } from '../lib/supabaseClient'

export default function SignOutButton() {
  async function onClick(e) {
    e.preventDefault()
    await supabase.auth.signOut()
    window.location.href = '/signin'
  }
  return (
    <a href="/signin" onClick={onClick}
       style={{ textDecoration:'none', border:'1px solid #e5e7eb', padding:'8px 12px', borderRadius:8, background:'#fff' }}>
      Sign out
    </a>
  )
}
