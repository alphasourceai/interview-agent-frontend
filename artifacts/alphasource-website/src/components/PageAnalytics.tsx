import { useEffect } from "react";
import { trackCtaClick, trackPageView } from "@/lib/analytics";

type PageAnalyticsProps = {
  location: string;
};

const PUBLIC_ANALYTICS_ROUTES = new Set([
  "/",
  "/alphascreen",
  "/alphascreen/pricing",
  "/alphascreen/how-it-works",
  "/alphascreen/security",
  "/alphascreen/candidate-experience",
  "/alphascreen/for-dental-groups",
  "/alphascreen/roi",
  "/about",
  "/support",
  "/faq",
  "/privacy",
  "/terms",
]);

function normalizePath(path: string): string {
  const clean = String(path || "/").split("?")[0].split("#")[0] || "/";
  return clean.length > 1 ? clean.replace(/\/+$/, "") : "/";
}

export default function PageAnalytics({ location }: PageAnalyticsProps) {
  useEffect(() => {
    const path = normalizePath(location);
    if (PUBLIC_ANALYTICS_ROUTES.has(path)) trackPageView(path);
  }, [location]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (!PUBLIC_ANALYTICS_ROUTES.has(normalizePath(window.location.pathname || "/"))) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const cta = target.closest<HTMLElement>("[data-analytics-cta]");
      if (!cta) return;
      const label = String(cta.dataset.analyticsCta || cta.textContent || "").trim();
      const href = cta instanceof HTMLAnchorElement ? cta.href : String(cta.dataset.analyticsTarget || "");
      trackCtaClick(label, href, cta.dataset.analyticsPlacement || undefined);
    };

    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  return null;
}
