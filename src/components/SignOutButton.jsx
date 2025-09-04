import { supabase } from '../lib/supabaseClient';

export default function SignOutButton() {
  async function onClick(e) {
    e.preventDefault();

    try {
      // Supabase v2: clear local and revoke refresh token
      await supabase.auth.signOut({ scope: 'local' });
    } catch (_) {
      // ignore — we’ll still hard-reset below
    } finally {
      // hard reset any cached session
      try {
        localStorage.clear();
        sessionStorage.clear();
        // clear any sb-* cookies just in case
        document.cookie = 'sb-access-token=; Max-Age=0; path=/';
        document.cookie = 'sb-refresh-token=; Max-Age=0; path=/';
      } catch {}
      // send user to a safe landing route
      const redirect = import.meta.env.VITE_AUTH_REDIRECT_URL || '/';
      window.location.replace(redirect);
    }
  }

  return (
    <a href="/"
       onClick={onClick}
       style={{ textDecoration: 'none', border: '1px solid #e5e7eb', padding: '8px 12px', borderRadius: 8, background: '#fff' }}>
      Sign out
    </a>
  );
}
