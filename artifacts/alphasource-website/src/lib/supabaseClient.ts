import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const PASSKEYS_ENABLED =
  String(import.meta.env.VITE_PASSKEYS_ENABLED || "").trim().toLowerCase() === "true";

if (!url || !anonKey) {
  throw new Error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY");
}

export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    experimental: { passkey: true },
  },
});
