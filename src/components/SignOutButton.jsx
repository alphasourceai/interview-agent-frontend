import { supabase } from '../lib/supabaseClient';

export default function SignOutButton() {
  async function onClick(e) {
    e.preventDefault();
    try {
      await supabase.auth.signOut();
    } finally {
      // Always land users on signin
      window.location.assign('/signin');
    }
  }

  return (
    <button className="btn" onClick={onClick}>
      Sign out
    </button>
  );
}
