import { useEffect } from "react";
import { assetUrl, canonicalUrl, getSeoConfig } from "@/lib/seo";

type SeoProps = {
  location: string;
};

function upsertMeta(selector: string, createAttrs: Record<string, string>, content: string) {
  let element = document.head.querySelector<HTMLMetaElement>(selector);
  if (!element) {
    element = document.createElement("meta");
    Object.entries(createAttrs).forEach(([key, value]) => element?.setAttribute(key, value));
    document.head.appendChild(element);
  }
  element.setAttribute("content", content);
}

function upsertCanonical(href: string | null) {
  let element = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!href) {
    element?.remove();
    return;
  }
  if (!element) {
    element = document.createElement("link");
    element.setAttribute("rel", "canonical");
    document.head.appendChild(element);
  }
  element.setAttribute("href", href);
}

function upsertJsonLd(data: unknown) {
  const idPrefix = "alphasource-route-jsonld";
  const existing = Array.from(document.querySelectorAll<HTMLScriptElement>(`script[id^="${idPrefix}"]`));
  const entries = Array.isArray(data) ? data : data ? [data] : [];
  if (entries.length === 0) {
    existing.forEach((element) => element.remove());
    return;
  }

  entries.forEach((entry, index) => {
    const id = index === 0 ? idPrefix : `${idPrefix}-${index}`;
    let element = document.getElementById(id) as HTMLScriptElement | null;
    if (!element) {
      element = document.createElement("script");
      element.id = id;
      element.type = "application/ld+json";
      document.head.appendChild(element);
    }
    element.type = "application/ld+json";
    element.textContent = JSON.stringify(entry);
  });

  existing.slice(entries.length).forEach((element) => element.remove());
}

export default function Seo({ location }: SeoProps) {
  useEffect(() => {
    const config = getSeoConfig(location);
    const isIndexable = config.robots.startsWith("index");
    const url = isIndexable && config.path ? canonicalUrl(config.path) : null;
    const image = assetUrl(config.imagePath);

    document.title = config.title;
    upsertMeta('meta[name="description"]', { name: "description" }, config.description);
    upsertMeta('meta[name="robots"]', { name: "robots" }, config.robots);
    upsertMeta('meta[property="og:type"]', { property: "og:type" }, config.type);
    upsertMeta('meta[property="og:site_name"]', { property: "og:site_name" }, "alphaSource AI");
    upsertMeta('meta[property="og:title"]', { property: "og:title" }, config.title);
    upsertMeta('meta[property="og:description"]', { property: "og:description" }, config.description);
    upsertMeta('meta[property="og:image"]', { property: "og:image" }, image);
    upsertMeta('meta[name="twitter:card"]', { name: "twitter:card" }, "summary_large_image");
    upsertMeta('meta[name="twitter:title"]', { name: "twitter:title" }, config.title);
    upsertMeta('meta[name="twitter:description"]', { name: "twitter:description" }, config.description);
    upsertMeta('meta[name="twitter:image"]', { name: "twitter:image" }, image);

    if (url) {
      upsertCanonical(url);
      upsertMeta('meta[property="og:url"]', { property: "og:url" }, url);
    } else {
      upsertCanonical(null);
      upsertMeta('meta[property="og:url"]', { property: "og:url" }, assetUrl("/"));
    }

    upsertJsonLd(config.jsonLd || null);
  }, [location]);

  return null;
}
