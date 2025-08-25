import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function SignIn() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) window.location.assign("/roles");
    });
    return () => sub?.subscription?.unsubscribe();
  }, []);

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    try {
      const redirectTo =
        import.meta.env.VITE_AUTH_REDIRECT_URL ||
        `${window.location.origin}/auth/callback`;

      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: redirectTo },
      });
      if (error) throw error;
      setSent(true);
    } catch (err) {
      setError(err.message || "Unable to send magic link");
    }
  }

  return (
    <div className="mx-auto max-w-md p-6">
      <h1 className="text-2xl font-semibold mb-4">Sign in</h1>
      {sent ? (
        <div className="border rounded p-4">
          <div className="mb-2">Check your email for a magic link.</div>
          <div className="text-sm text-gray-600">{email}</div>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-3">
          <div>
            <label className="block text-sm mb-1">Work email</label>
            <input
              type="email"
              required
              className="w-full border rounded p-2"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
            />
          </div>
          {error && <div className="text-red-600 text-sm">{error}</div>}
          <button className="border rounded px-3 py-1.5" type="submit">
            Send magic link
          </button>
        </form>
      )}
    </div>
  );
}
