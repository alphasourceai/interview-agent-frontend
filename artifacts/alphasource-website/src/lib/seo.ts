import { getPublicSiteBase } from "@/lib/urlConfig";
import { publicFaqItems } from "@/lib/publicContent";

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

const SITE_URL = "https://www.alphasourceai.com";
const TRAILING_SLASH_PUBLIC_PATHS = new Set([
  "/about",
  "/support",
  "/faq",
  "/alphascreen",
  "/alphascreen/pricing",
  "/alphascreen/how-it-works",
  "/alphascreen/security",
  "/alphascreen/candidate-experience",
  "/alphascreen/for-dental-groups",
  "/alphascreen/roi",
]);
const ORGANIZATION_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "alphaSource AI",
  alternateName: "alphaSource",
  url: `${SITE_URL}/`,
  logo: `${SITE_URL}/alpha-symbol.png`,
  contactPoint: {
    "@type": "ContactPoint",
    email: "info@alphasourceai.com",
    contactType: "sales and support",
  },
  sameAs: [
    "https://www.linkedin.com/company/alphasourceai",
    "https://www.facebook.com/alphasourceai",
  ],
};

const WEBSITE_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "alphaSource AI",
  url: `${SITE_URL}/`,
  description:
    "alphaSource AI builds practical AI tools, including alphaScreen for structured candidate screening, interview analysis, and hiring workflow support.",
  publisher: {
    "@type": "Organization",
    name: "alphaSource AI",
    url: `${SITE_URL}/`,
  },
};

function routeUrl(path = "/"): string {
  const canonicalPathname = toCanonicalPublicPath(path);
  return canonicalPathname === "/" ? `${SITE_URL}/` : `${SITE_URL}${canonicalPathname}`;
}

function breadcrumbSchema(items: Array<{ name: string; path: string }>): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: routeUrl(item.path),
    })),
  };
}

const HOMEPAGE_SCHEMA = [
  ORGANIZATION_SCHEMA,
  WEBSITE_SCHEMA,
  {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "alphaSource AI",
    url: routeUrl("/"),
    description:
      "Public homepage for alphaSource AI, a company building practical AI tools for candidate screening and business workflow support.",
    isPartOf: {
      "@type": "WebSite",
      name: "alphaSource AI",
      url: `${SITE_URL}/`,
    },
  },
];

const ALPHASCREEN_FEATURES = [
  "Role setup for hiring teams",
  "Structured AI avatar screening interviews",
  "Resume and interview review support",
  "Candidate scoring and report summaries",
  "Hiring team review workflow",
  "Basic, Pro, and Enterprise membership options",
];

const ALPHASCREEN_SOFTWARE_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "alphaScreen",
  applicationCategory: "BusinessApplication",
  applicationSubCategory: "Candidate screening software",
  operatingSystem: "Web",
  url: routeUrl("/alphascreen"),
  description:
    "alphaScreen is a web-based AI-assisted candidate screening platform for structured interviews, resume review support, candidate reports, and hiring team review workflows.",
  featureList: ALPHASCREEN_FEATURES,
  publisher: {
    "@type": "Organization",
    name: "alphaSource AI",
    url: `${SITE_URL}/`,
  },
};

const PRICING_OFFERS = [
  {
    "@type": "Offer",
    name: "alphaScreen Basic monthly membership",
    url: routeUrl("/alphascreen/pricing"),
    priceCurrency: "USD",
    description:
      "Basic monthly membership: $299 monthly platform membership plus $399 per role. Includes 20 interviews per role and $30 additional interviews.",
    priceSpecification: [
      { "@type": "UnitPriceSpecification", price: "299", priceCurrency: "USD", unitText: "monthly platform membership" },
      { "@type": "UnitPriceSpecification", price: "399", priceCurrency: "USD", unitText: "per role" },
      { "@type": "UnitPriceSpecification", price: "30", priceCurrency: "USD", unitText: "additional interview" },
    ],
  },
  {
    "@type": "Offer",
    name: "alphaScreen Basic annual membership",
    url: routeUrl("/alphascreen/pricing"),
    priceCurrency: "USD",
    description:
      "Basic annual membership: $3,299 annual platform membership plus $399 per role. Includes 20 interviews per role and $30 additional interviews.",
    priceSpecification: [
      { "@type": "UnitPriceSpecification", price: "3299", priceCurrency: "USD", unitText: "annual platform membership" },
      { "@type": "UnitPriceSpecification", price: "399", priceCurrency: "USD", unitText: "per role" },
      { "@type": "UnitPriceSpecification", price: "30", priceCurrency: "USD", unitText: "additional interview" },
    ],
  },
  {
    "@type": "Offer",
    name: "alphaScreen Pro monthly membership",
    url: routeUrl("/alphascreen/pricing"),
    priceCurrency: "USD",
    description:
      "Pro monthly membership: $599 monthly platform membership plus $699 per role. Includes 30 interviews per role and $35 additional interviews.",
    priceSpecification: [
      { "@type": "UnitPriceSpecification", price: "599", priceCurrency: "USD", unitText: "monthly platform membership" },
      { "@type": "UnitPriceSpecification", price: "699", priceCurrency: "USD", unitText: "per role" },
      { "@type": "UnitPriceSpecification", price: "35", priceCurrency: "USD", unitText: "additional interview" },
    ],
  },
  {
    "@type": "Offer",
    name: "alphaScreen Pro annual membership",
    url: routeUrl("/alphascreen/pricing"),
    priceCurrency: "USD",
    description:
      "Pro annual membership: $6,499 annual platform membership plus $699 per role. Includes 30 interviews per role and $35 additional interviews.",
    priceSpecification: [
      { "@type": "UnitPriceSpecification", price: "6499", priceCurrency: "USD", unitText: "annual platform membership" },
      { "@type": "UnitPriceSpecification", price: "699", priceCurrency: "USD", unitText: "per role" },
      { "@type": "UnitPriceSpecification", price: "35", priceCurrency: "USD", unitText: "additional interview" },
    ],
  },
];

const ALPHASCREEN_PRICING_SCHEMA = {
  "@context": "https://schema.org",
  "@type": ["SoftwareApplication", "Product"],
  name: "alphaScreen",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  brand: {
    "@type": "Brand",
    name: "alphaSource AI",
  },
  category: "AI-assisted candidate screening software",
  description:
    "Public alphaScreen Basic and Pro membership pricing for structured AI-assisted candidate screening.",
  url: routeUrl("/alphascreen/pricing"),
  featureList: ALPHASCREEN_FEATURES,
  offers: PRICING_OFFERS,
};

const FAQ_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: publicFaqItems.map((item) => ({
    "@type": "Question",
    name: item.question,
    acceptedAnswer: {
      "@type": "Answer",
      text: item.answer,
    },
  })),
};

function alphaScreenWebPageSchema(path: string, name: string, description: string): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name,
    description,
    url: routeUrl(path),
    isPartOf: WEBSITE_SCHEMA,
    about: {
      "@type": "SoftwareApplication",
      name: "alphaScreen",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      url: routeUrl("/alphascreen"),
    },
    publisher: {
      "@type": "Organization",
      name: "alphaSource AI",
      url: `${SITE_URL}/`,
    },
  };
}

const PUBLIC_ROUTES: Record<string, Omit<SeoConfig, "robots" | "imagePath" | "type">> = {
  "/": {
    title: "alphaSource AI | AI Candidate Screening and Workflow Automation",
    description:
      "alphaSource AI builds practical AI tools, including alphaScreen for structured candidate screening, interview analysis, and hiring workflow support.",
    path: "/",
    jsonLd: HOMEPAGE_SCHEMA,
  },
  "/alphascreen": {
    title: "alphaScreen | AI Candidate Screening and Interview Analysis",
    description:
      "alphaScreen helps employers create roles, invite candidates, run structured AI-assisted interviews, and review resume and interview insights with human oversight.",
    path: "/alphascreen",
    jsonLd: [
      ALPHASCREEN_SOFTWARE_SCHEMA,
      breadcrumbSchema([
        { name: "Home", path: "/" },
        { name: "alphaScreen", path: "/alphascreen" },
      ]),
    ],
  },
  "/alphascreen/pricing": {
    title: "alphaScreen Pricing | AI Interview Screening Memberships",
    description:
      "Compare alphaScreen Basic, Pro, and Enterprise membership options for structured AI-assisted interview screening, included interviews, duration caps, and additional interview pricing.",
    path: "/alphascreen/pricing",
    jsonLd: [
      ALPHASCREEN_PRICING_SCHEMA,
      breadcrumbSchema([
        { name: "Home", path: "/" },
        { name: "alphaScreen", path: "/alphascreen" },
        { name: "Pricing", path: "/alphascreen/pricing" },
      ]),
    ],
  },
  "/alphascreen/how-it-works": {
    title: "How alphaScreen Works | Self-Serve AI Screening Workflow",
    description:
      "See how alphaScreen self-serve signup, agreement review, Stripe Checkout, account setup, role creation, candidate invitations, and structured reports work.",
    path: "/alphascreen/how-it-works",
    jsonLd: [
      alphaScreenWebPageSchema(
        "/alphascreen/how-it-works",
        "How alphaScreen Works",
        "Self-serve alphaScreen workflow from membership selection to structured candidate review.",
      ),
      breadcrumbSchema([
        { name: "Home", path: "/" },
        { name: "alphaScreen", path: "/alphascreen" },
        { name: "How It Works", path: "/alphascreen/how-it-works" },
      ]),
    ],
  },
  "/alphascreen/security": {
    title: "alphaScreen Security | Candidate Data and Human Review",
    description:
      "Review alphaScreen public security and data protection positioning for candidate data, authorized access, reports, privacy, and human hiring decisions.",
    path: "/alphascreen/security",
    jsonLd: [
      alphaScreenWebPageSchema(
        "/alphascreen/security",
        "alphaScreen Security and Data Protection",
        "Public alphaScreen data protection overview covering candidate data, access control, reports, privacy, and human review.",
      ),
      breadcrumbSchema([
        { name: "Home", path: "/" },
        { name: "alphaScreen", path: "/alphascreen" },
        { name: "Security", path: "/alphascreen/security" },
      ]),
    ],
  },
  "/alphascreen/candidate-experience": {
    title: "alphaScreen Candidate Experience | Structured AI Screening",
    description:
      "Learn how candidates experience alphaScreen structured AI avatar screening interviews and how hiring teams review results.",
    path: "/alphascreen/candidate-experience",
    jsonLd: [
      alphaScreenWebPageSchema(
        "/alphascreen/candidate-experience",
        "alphaScreen Candidate Experience",
        "Public overview of the candidate experience in alphaScreen structured AI-assisted screening interviews.",
      ),
      breadcrumbSchema([
        { name: "Home", path: "/" },
        { name: "alphaScreen", path: "/alphascreen" },
        { name: "Candidate Experience", path: "/alphascreen/candidate-experience" },
      ]),
    ],
  },
  "/alphascreen/for-dental-groups": {
    title: "alphaScreen for Dental Groups | DSO and Multi-Location Hiring",
    description:
      "See how alphaScreen supports structured candidate screening for dental groups, DSOs, multi-location operators, and broader hiring teams.",
    path: "/alphascreen/for-dental-groups",
    jsonLd: [
      alphaScreenWebPageSchema(
        "/alphascreen/for-dental-groups",
        "alphaScreen for Dental Groups",
        "Public alphaScreen use case page for dental groups, DSOs, multi-location operators, and other structured hiring teams.",
      ),
      breadcrumbSchema([
        { name: "Home", path: "/" },
        { name: "alphaScreen", path: "/alphascreen" },
        { name: "Dental Groups", path: "/alphascreen/for-dental-groups" },
      ]),
    ],
  },
  "/alphascreen/roi": {
    title: "alphaScreen Value Estimator | Screening Time and Membership Cost",
    description:
      "Estimate manual screening time, initial-screening labor cost, membership platform cost, role fees, and additional interview fees for alphaScreen Basic and Pro memberships.",
    path: "/alphascreen/roi",
    jsonLd: [
      alphaScreenWebPageSchema(
        "/alphascreen/roi",
        "alphaScreen Value Estimator",
        "Estimate screening time, initial-screening labor cost, and alphaScreen membership costs without guarantee of savings or outcomes.",
      ),
      breadcrumbSchema([
        { name: "Home", path: "/" },
        { name: "alphaScreen", path: "/alphascreen" },
        { name: "ROI Estimator", path: "/alphascreen/roi" },
      ]),
    ],
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
    jsonLd: [
      FAQ_SCHEMA,
      breadcrumbSchema([
        { name: "Home", path: "/" },
        { name: "Support", path: "/support" },
      ]),
    ],
  },
  "/faq": {
    title: "alphaSource AI FAQ | alphaScreen Questions and Support",
    description:
      "Answers to common questions about alphaSource AI, alphaScreen, candidate screening workflows, and getting started.",
    path: "/faq",
    jsonLd: [
      FAQ_SCHEMA,
      breadcrumbSchema([
        { name: "Home", path: "/" },
        { name: "FAQ", path: "/faq" },
      ]),
    ],
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

function toCanonicalPublicPath(pathname: string): string {
  const normalizedPath = normalizePath(pathname);
  if (normalizedPath === "/") return "/";
  return TRAILING_SLASH_PUBLIC_PATHS.has(normalizedPath) ? `${normalizedPath}/` : normalizedPath;
}

export function canonicalUrl(path = "/"): string {
  const base = getPublicSiteBase() || "https://www.alphasourceai.com";
  const canonicalPathname = toCanonicalPublicPath(path);
  return canonicalPathname === "/" ? `${base}/` : `${base}${canonicalPathname}`;
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
