import { lazy, Suspense, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { supportVoiceOrigin } from "@/lib/supportVoiceOrigin";
const SupportVoicePopover = lazy(
  () => import("@/components/SupportVoicePopover"),
);

export default function EligibleSupportVoice({
  clientId,
  collapsed,
}: {
  clientId: string;
  collapsed: boolean;
}) {
  if (
    import.meta.env.VITE_SUPPORT_VOICE_ENABLED !== "true" ||
    !supportVoiceOrigin(
      import.meta.env.VITE_BACKEND_URL,
      import.meta.env.VITE_APP_ENV,
    )
  )
    return null;
  return (
    <ScopedSupportVoice
      key={clientId}
      clientId={clientId}
      collapsed={collapsed}
    />
  );
}
function ScopedSupportVoice({
  clientId,
  collapsed,
}: {
  clientId: string;
  collapsed: boolean;
}) {
  const [eligible, setEligible] = useState(false);
  useEffect(() => {
    const abort = new AbortController();
    let busy = false;
    const check = async () => {
      if (busy || !clientId) return;
      busy = true;
      try {
        const { data } = await supabase.auth.getSession();
        if (!data.session?.access_token) {
          setEligible(false);
          return;
        }
        const origin = supportVoiceOrigin(
          import.meta.env.VITE_BACKEND_URL,
          import.meta.env.VITE_APP_ENV,
        );
        if (!origin) {
          setEligible(false);
          return;
        }
        const response = await fetch(
          `${origin}/api/support/voice/eligibility?client_id=${encodeURIComponent(clientId)}`,
          {
            signal: abort.signal,
            cache: "no-store",
            credentials: "omit",
            headers: { Authorization: `Bearer ${data.session.access_token}` },
          },
        );
        const body = response.ok ? await response.json() : null;
        if (!abort.signal.aborted)
          setEligible(body?.client_id === clientId && body?.eligible === true);
      } catch {
        if (!abort.signal.aborted) setEligible(false);
      } finally {
        busy = false;
      }
    };
    void check();
    const timer = setInterval(() => {
      void check();
    }, 30_000);
    return () => {
      abort.abort();
      clearInterval(timer);
    };
  }, [clientId]);
  return eligible ? (
    <Suspense fallback={null}>
      <SupportVoicePopover
        clientId={clientId}
        placement="sidebar"
        collapsed={collapsed}
      />
    </Suspense>
  ) : null;
}
