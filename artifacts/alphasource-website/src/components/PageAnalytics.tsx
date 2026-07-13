import { useEffect } from "react";
import { trackCtaClick, trackPageView } from "@/lib/analytics";
import {
  isPublicOptionalTrackingRoute,
  normalizeTrackingPath,
  useTrackingConsent,
} from "@/context/TrackingConsentContext";

type PageAnalyticsProps = { location: string };

export default function PageAnalytics({ location }: PageAnalyticsProps) {
  const { analyticsEnabled } = useTrackingConsent();

  useEffect(() => {
    const path = normalizeTrackingPath(location);
    if (analyticsEnabled && isPublicOptionalTrackingRoute(path)) trackPageView(path);
  }, [analyticsEnabled, location]);

  useEffect(() => {
    if (!analyticsEnabled) return;
    const onClick = (event: MouseEvent) => {
      if (!isPublicOptionalTrackingRoute(window.location.pathname || "/")) return;
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
  }, [analyticsEnabled]);

  return null;
}
