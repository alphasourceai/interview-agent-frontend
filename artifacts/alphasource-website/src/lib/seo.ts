import { getPublicSiteBase } from "@/lib/urlConfig";

type JsonLdValue = Record<string, unknown> | Array<Record<string, unknown>>;

export type SeoConfig = {
  title: string;
  description: string;
  path?: string;
  robots: string;
  imagePath: string;
  type: "website" | "article";
  jsonLd?: JsonLdValue;
};

const PUBLIC_ROUTES: Record<string, Omit<SeoConfig, "robots" | "imagePath" | "type">> = {
  "/": {
    title: "alphaSource AI | AI Candidate Screening and Workflow Automation",
    description:
      "alphaSource AI builds practical AI tools, including alphaScreen for structured candidate screening, interview analysis, and hiring workflow support.",
    path: "/",
    jsonLd: [
      {
        "@context": "https://schema.org",
        "@type": "Organization",
        name: "alphaSource AI",
        url: "https://www.alphasourceai.com/",
        logo: "https://www.alphasourceai.com/alpha-symbol.png",
        sameAs: [
          "https://www.linkedin.com/company/alphasourceai",
          "https://www.facebook.com/alphasourceai",
        ],
      },
      {
        "@context": "https://schema.org",
        "@type": "WebSite",
        name: "alphaSource AI",
        url: "https://www.alphasourceai.com/",
      },
    ],
  },
  "/alphascreen": {
    title: "alphaScreen | AI Candidate Screening and Interview Analysis",
    description:
      "alphaScreen helps employers create roles, invite candidates, run structured AI-assisted interviews, and review resume and interview insights with human oversight.",
    path: "/alphascreen",
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: "alphaScreen",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      url: "https://www.alphasourceai.com/alphascreen",
      description:
        "AI-assisted candidate screening software for structured interviews, resume analysis, candidate reports, and hiring workflow support.",
      publisher: {
        "@type": "Organization",
        name: "alphaSource AI",
        url: "https://www.alphasourceai.com/",
      },
    },
  },
  "/about": {
    title: "About alphaSource AI | Practical AI Built Around Human Judgment",
    description:
      "Meet alphaSource AI, the team building practical AI tools that help leaders reclaim time, improve decisions, and keep people in control.",
    path: "/about",
  },
  "/support": {
    title: "alphaSource AI Support | alphaScreen FAQ and Release Notes",
    description:
      "Find public support information, alphaScreen FAQs, release notes, and guidance for getting started with alphaSource AI.",
    path: "/support",
  },
  "/faq": {
    title: "alphaSource AI FAQ | alphaScreen Questions and Support",
    description:
      "Answers to common questions about alphaSource AI, alphaScreen, candidate screening workflows, and getting started.",
    path: "/faq",
  },
  "/terms": {
    title: "Terms and Conditions | alphaSource AI",
    description:
      "Review alphaSource AI terms for AI-assisted interviewing, candidate data, human review, accommodations, and responsible use.",
    path: "/terms",
  },
  "/privacy": {
    title: "Privacy Policy | alphaSource AI",
    description:
      "Learn how alphaSource AI handles public website analytics, contact and demo form lead capture, alphaScreen product data, and privacy requests.",
    path: "/privacy",
  },
};

const DEFAULT_NO_INDEX: SeoConfig = {
  title: "alphaSource AI",
  description: "alphaSource AI application page.",
  robots: "noindex,nofollow,noarchive",
  imagePath: "/opengraph.jpg",
  type: "website",
};

function normalizePath(pathname: string): string {
  const path = String(pathname || "/").split("?")[0].split("#")[0] || "/";
  return path.length > 1 ? path.replace(/\/+$/, "") : "/";
}

export function canonicalUrl(path = "/"): string {
  const base = getPublicSiteBase() || "https://www.alphasourceai.com";
  const normalizedPath = normalizePath(path);
  return normalizedPath === "/" ? `${base}/` : `${base}${normalizedPath}`;
}

export function assetUrl(path = "/opengraph.jpg"): string {
  const base = getPublicSiteBase() || "https://www.alphasourceai.com";
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${base}${normalizedPath}`;
}

export function getSeoConfig(pathname: string): SeoConfig {
  const path = normalizePath(pathname);
  const publicConfig = PUBLIC_ROUTES[path];
  if (!publicConfig) return DEFAULT_NO_INDEX;

  return {
    ...publicConfig,
    robots: "index,follow",
    imagePath: "/opengraph.jpg",
    type: "website",
  };
}
