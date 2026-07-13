import { useEffect } from "react";

interface PublicTawkWidgetProps {
  enabled: boolean;
  propertyId?: string;
  widgetId?: string;
}

interface TawkApi {
  shutdown?: () => void;
}

declare global {
  interface Window {
    Tawk_API?: TawkApi;
    Tawk_LoadStart?: Date;
  }
}

const TAWK_SCRIPT_ID = "alphasource-public-tawk-script";

function cleanupPublicTawk() {
  if (typeof window !== "undefined") {
    try {
      window.Tawk_API?.shutdown?.();
    } catch {
      // Tawk can be unavailable while its script is still loading.
    }
    delete window.Tawk_API;
    delete window.Tawk_LoadStart;
  }

  if (typeof document !== "undefined") {
    document.getElementById(TAWK_SCRIPT_ID)?.remove();
  }
}

export default function PublicTawkWidget({ enabled, propertyId, widgetId }: PublicTawkWidgetProps) {
  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") return;

    const normalizedPropertyId = String(propertyId || "").trim();
    const normalizedWidgetId = String(widgetId || "").trim();
    if (!enabled || !normalizedPropertyId || !normalizedWidgetId) return;

    const src = `https://embed.tawk.to/${normalizedPropertyId}/${normalizedWidgetId}`;
    const existing = document.getElementById(TAWK_SCRIPT_ID) as HTMLScriptElement | null;
    if (existing) {
      if (existing.src === src) return cleanupPublicTawk;
      cleanupPublicTawk();
    }

    window.Tawk_API = {};
    window.Tawk_LoadStart = new Date();

    const script = document.createElement("script");
    script.id = TAWK_SCRIPT_ID;
    script.async = true;
    script.src = src;
    script.charset = "UTF-8";
    script.setAttribute("crossorigin", "*");
    document.head.appendChild(script);

    return cleanupPublicTawk;
  }, [enabled, propertyId, widgetId]);

  return null;
}
