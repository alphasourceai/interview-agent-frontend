import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function SignOutButton() {
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setHasSession(!!data.session);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setHasSession(!!session);
    });
    return () => sub?.subscription?.unsubscribe();
  }, []);

  if (!hasSession) return null;

  async function signOut() {
    await supabase.auth.signOut();
    window.location.assign("/signin");
  }

  return (
    <button
      onClick={signOut}
      style={{ border: "1px solid #d1d5db", borderRadius: 6, padding: "6px 10px", background: "#fff" }}
    >
      Sign out
    </button>
  );
}
