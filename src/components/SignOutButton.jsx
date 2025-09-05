import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function SignOutButton() {
  const [hasSession, setHasSession] = useState(false);

  // Only render when a session exists
  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setHasSession(!!data?.session);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
      setHasSession(!!session);
    });

    return () => sub?.subscription?.unsubscribe?.();
  }, []);

  if (!hasSession) return null;

  async function onClick(e) {
    e.preventDefault();

    try {
      // Supabase v2: clear local and revoke refresh token (local scope for browser apps)
      await supabase.auth.signOut({ scope: 'local' });
    } catch (_) {
      // ignore — we'll still hard-reset below
    } finally {
      // Hard reset any cached session state
      try {
        localStorage.clear();
        sessionStorage.clear();
        document.cookie = 'sb-access-token=; Max-Age=0; path=/';
        document.cookie = 'sb-refresh-token=; Max-Age=0; path=/';
      } catch (_) {}

      // Send user to a safe landing route
      const redirect = import.meta.env.VITE_AUTH_REDIRECT_URL || '/';
      window.location.replace(redirect);
    }
  }

  return (
    <button
      onClick={onClick}
      className="btn"
      style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 12px', background: '#fff' }}
    >
      Sign out
    </button>
  );
}
