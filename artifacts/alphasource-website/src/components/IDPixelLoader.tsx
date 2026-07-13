import { useEffect } from "react";
import { isPublicOptionalTrackingRoute, useTrackingConsent } from "@/context/TrackingConsentContext";

const IDPIXEL_SCRIPT_ID = "idpixel-analytics-script";
const IDPIXEL_SCRIPT_SRC = "https://cdn.idpixel.app/v1/idp-analytics-6a3adb9a5c012440693ab1e2.min.js";

export default function IDPixelLoader({ location }: { location: string }) {
  const { marketingAttributionEnabled } = useTrackingConsent();

  useEffect(() => {
    if (typeof document === "undefined") return;
    if (!marketingAttributionEnabled || !isPublicOptionalTrackingRoute(location)) return;
    if (document.getElementById(IDPIXEL_SCRIPT_ID)) return;

    const script = document.createElement("script");
    script.id = IDPIXEL_SCRIPT_ID;
    script.src = IDPIXEL_SCRIPT_SRC;
    script.defer = true;
    script.onerror = () => script.remove();
    document.head.appendChild(script);
    return () => script.remove();
  }, [location, marketingAttributionEnabled]);

  return null;
}
