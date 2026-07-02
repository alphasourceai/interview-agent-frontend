import { useEffect } from "react";

const IDPIXEL_SCRIPT_ID = "idpixel-analytics-script";
const IDPIXEL_SCRIPT_SRC = "https://cdn.idpixel.app/v1/idp-analytics-6a3adb9a5c012440693ab1e2.min.js";

const IDPIXEL_ALLOWED_ROUTES = new Set([
  "/",
  "/alphascreen",
  "/alphascreen/pricing",
  "/alphascreen/how-it-works",
  "/alphascreen/security",
  "/alphascreen/candidate-experience",
  "/alphascreen/for-dental-groups",
  "/alphascreen/roi",
  "/faq",
  "/about",
  "/support",
  "/terms",
  "/privacy",
]);

function normalizePath(path: string): string {
  const clean = String(path || "/").split("?")[0].split("#")[0] || "/";
  return clean.length > 1 ? clean.replace(/\/+$/, "") : "/";
}

export default function IDPixelLoader({ location }: { location: string }) {
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (!IDPIXEL_ALLOWED_ROUTES.has(normalizePath(location))) return;
    if (document.getElementById(IDPIXEL_SCRIPT_ID)) return;

    const script = document.createElement("script");
    script.id = IDPIXEL_SCRIPT_ID;
    script.src = IDPIXEL_SCRIPT_SRC;
    script.defer = true;
    document.head.appendChild(script);
  }, [location]);

  return null;
}
