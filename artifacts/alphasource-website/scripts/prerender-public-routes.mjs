import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const distRoot = path.join(projectRoot, "dist");
const indexPath = path.join(distRoot, "index.html");

const SITE_URL = "https://www.alphasourceai.com";
const LAST_UPDATED = "June 2026";

const publicRoutes = [
  "/",
  "/about",
  "/faq",
  "/support",
  "/alphascreen",
  "/alphascreen/pricing",
  "/alphascreen/how-it-works",
  "/alphascreen/security",
  "/alphascreen/candidate-experience",
  "/alphascreen/for-dental-groups",
  "/alphascreen/roi",
];

const trailingSlashPublicRoutes = new Set(publicRoutes.filter((route) => route !== "/"));

const navLinks = [
  ["Home", "/"],
  ["About", "/about"],
  ["alphaScreen", "/alphascreen"],
  ["How It Works", "/alphascreen/how-it-works"],
  ["Security", "/alphascreen/security"],
  ["Candidate Experience", "/alphascreen/candidate-experience"],
  ["For Dental Groups", "/alphascreen/for-dental-groups"],
  ["ROI", "/alphascreen/roi"],
  ["FAQ", "/faq"],
  ["Pricing / Get Started", "/alphascreen/pricing"],
  ["Contact", "/#contact"],
];

const footerLinks = [
  ["alphaScreen", "/alphascreen"],
  ["Pricing / Get Started", "/alphascreen/pricing"],
  ["Security", "/alphascreen/security"],
  ["Candidate Experience", "/alphascreen/candidate-experience"],
  ["For Dental Groups", "/alphascreen/for-dental-groups"],
  ["ROI", "/alphascreen/roi"],
  ["FAQ", "/faq"],
  ["Privacy", "/privacy"],
  ["Terms", "/terms"],
];

const faqItems = [
  {
    question: "What is alphaScreen?",
    answer:
      "alphaScreen is alphaSource AI's web-based candidate screening platform. It helps hiring teams create roles, invite candidates, run structured AI-assisted screening interviews, and review candidate reports before deciding what to do next.",
  },
  {
    question: "How does alphaScreen work?",
    answer:
      "Hiring teams choose a membership, complete agreement and checkout steps, set up dashboard access, create roles, invite candidates, and review structured reports after candidates complete screening interviews.",
  },
  {
    question: "Who is alphaScreen for?",
    answer:
      "alphaScreen is for employers and hiring teams that want a more consistent first-pass screening workflow before later-stage interviews and final hiring decisions.",
  },
  {
    question: "Is alphaScreen designed for dental groups?",
    answer:
      "alphaScreen is built for structured hiring teams broadly and is a strong fit for dental groups, DSOs, and multi-location operators that need consistent screening across practices or entities.",
  },
  {
    question: "How does pricing work?",
    answer:
      "Public Basic and Pro memberships include a platform membership fee plus a per-role fee. Basic is listed at $299 monthly or $3,299 annually plus $399 per role. Pro is listed at $599 monthly or $6,499 annually plus $699 per role.",
  },
  {
    question: "What is included in a membership?",
    answer:
      "Basic includes 20 interviews per role with a 10-minute interview cap. Pro includes 30 interviews per role with a 12-minute interview cap. Additional interviews are listed publicly at $30 for Basic and $35 for Pro.",
  },
  {
    question: "What is first-role prepay?",
    answer:
      "New self-serve buyers can optionally prepay the first role during signup at a one-time 10% discount. The prepaid first role is used when the first paid role is opened under the same billing account.",
  },
  {
    question: "Who makes the final hiring decision?",
    answer:
      "The employer makes final hiring decisions. alphaScreen organizes screening information and reports for review, but it does not make automatic employment decisions.",
  },
  {
    question: "How does alphaScreen protect candidate data?",
    answer:
      "alphaScreen is designed around authenticated access, role-based permissions, controlled file and report access, and privacy-conscious workflows for candidate and client information.",
  },
  {
    question: "Does alphaScreen support accommodations?",
    answer:
      "Accommodation requests remain part of the employer's hiring process. alphaScreen supports controlled workflows and human review so candidate needs can be routed appropriately.",
  },
  {
    question: "Can managers use alphaScreen across multiple locations or entities?",
    answer:
      "Authorized parent-level managers can work across assigned client or entity scopes. Access depends on the membership account structure and role permissions configured for that user.",
  },
  {
    question: "What happens after a candidate completes an interview?",
    answer:
      "The hiring team can review the candidate's available resume, interview responses, score context, and report information before choosing the next step.",
  },
  {
    question: "Does alphaScreen replace recruiters or hiring managers?",
    answer:
      "No. alphaScreen helps structure early screening work, but recruiters and hiring managers remain responsible for communication, review, accommodations, and final decisions.",
  },
  {
    question: "How are candidate reports used?",
    answer:
      "Candidate reports are review aids for authorized hiring team members. They help organize screening information so teams can compare candidates more consistently.",
  },
  {
    question: "How does alphaScreen handle automation and human review?",
    answer:
      "alphaScreen uses automation to collect, organize, score, and summarize screening information while keeping role setup, candidate review, and hiring decisions with people.",
  },
];

const organizationSchema = {
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

const websiteSchema = {
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

const softwareSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "alphaScreen",
  applicationCategory: "BusinessApplication",
  applicationSubCategory: "Candidate screening software",
  operatingSystem: "Web",
  url: routeUrl("/alphascreen"),
  description:
    "alphaScreen is a web-based AI-assisted candidate screening platform for structured interviews, resume review support, candidate reports, and hiring team review workflows.",
  featureList: [
    "Role setup for hiring teams",
    "Structured AI avatar screening interviews",
    "Resume and interview review support",
    "Candidate scoring and report summaries",
    "Hiring team review workflow",
    "Basic, Pro, and Enterprise membership options",
  ],
  publisher: {
    "@type": "Organization",
    name: "alphaSource AI",
    url: `${SITE_URL}/`,
  },
};

const pricingSchema = {
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
  offers: [
    offer("alphaScreen Basic monthly membership", "299", "monthly platform membership"),
    offer("alphaScreen Basic annual membership", "3299", "annual platform membership"),
    offer("alphaScreen Basic role fee", "399", "per role"),
    offer("alphaScreen Basic first-role prepay", "359", "one-time discounted first role"),
    offer("alphaScreen Pro monthly membership", "599", "monthly platform membership"),
    offer("alphaScreen Pro annual membership", "6499", "annual platform membership"),
    offer("alphaScreen Pro role fee", "699", "per role"),
    offer("alphaScreen Pro first-role prepay", "629", "one-time discounted first role"),
  ],
};

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqItems.map((item) => ({
    "@type": "Question",
    name: item.question,
    acceptedAnswer: {
      "@type": "Answer",
      text: item.answer,
    },
  })),
};

const routeContent = {
  "/": {
    title: "alphaSource AI | AI Candidate Screening and Workflow Automation",
    description:
      "alphaSource AI builds practical AI tools, including alphaScreen for structured candidate screening, interview analysis, and hiring workflow support.",
    eyebrow: "alphaSource AI",
    h1: "AI tools that help hiring teams reclaim time and review candidates with more structure.",
    intro:
      "alphaSource AI builds practical workflow tools, including alphaScreen for structured candidate screening, interview analysis, and human-reviewed hiring workflows.",
    sections: [
      section("What is alphaScreen?", [
        "alphaScreen is a membership-based candidate screening platform that helps employers create roles, invite candidates, run structured AI-assisted interviews, and review reports before deciding next steps.",
      ]),
      section("Who is alphaScreen for?", [
        "alphaScreen is built for hiring teams that want a more consistent first-pass screen, including dental groups, DSOs, multi-location teams, and other operators with repeated hiring needs.",
      ]),
      section("How does alphaScreen protect candidate and client data?", [
        "The platform uses authenticated dashboard access, role-based permissions, controlled report access, and client or entity scope checks to keep screening information available to authorized users.",
      ]),
    ],
    links: [
      ["/alphascreen", "Explore alphaScreen"],
      ["/alphascreen/how-it-works", "See how alphaScreen works"],
      ["/alphascreen/security", "Review security and data practices"],
      ["/faq", "Read the FAQ"],
    ],
    schemas: [
      organizationSchema,
      websiteSchema,
      webPageSchema("/", "alphaSource AI", "Public homepage for alphaSource AI and alphaScreen."),
    ],
  },
  "/about": {
    title: "About alphaSource AI | Practical AI Built Around Human Judgment",
    description:
      "Meet alphaSource AI, the team building practical AI tools that help leaders reclaim time, improve decisions, and keep people in control.",
    eyebrow: "About alphaSource AI",
    h1: "Practical AI built by operators around human judgment.",
    intro:
      "alphaSource AI builds tools that help teams organize work, surface useful signal, and keep people responsible for the decisions that matter.",
    sections: [
      section("Company overview", [
        "alphaSource AI focuses on practical AI workflows for hiring and business operations. alphaScreen is the public candidate screening product.",
      ]),
      section("Founder and operator experience", [
        "Founder Jason Gardner brings dental operations experience and firsthand understanding of hiring workflow strain. Partner Brent Ford supports product and market work with a focus on clear communication and opportunity.",
      ]),
      section("How to contact alphaSource AI", [
        "Prospective clients can contact alphaSource AI at info@alphasourceai.com or through the public contact form.",
      ]),
    ],
    links: [
      ["/alphascreen", "Explore alphaScreen"],
      ["/alphascreen/for-dental-groups", "Dental group use case"],
      ["/faq", "Read common questions"],
    ],
    schemas: [
      organizationSchema,
      websiteSchema,
      webPageSchema("/about", "About alphaSource AI", "Company overview for alphaSource AI."),
      breadcrumbSchema([
        ["Home", "/"],
        ["About", "/about"],
      ]),
    ],
  },
  "/faq": faqRoute("FAQ"),
  "/support": faqRoute("Support"),
  "/alphascreen": {
    title: "alphaScreen | AI Candidate Screening and Interview Analysis",
    description:
      "alphaScreen helps employers create roles, invite candidates, run structured AI-assisted interviews, and review resume and interview insights with human oversight.",
    eyebrow: "alphaScreen",
    h1: "Structured AI candidate screening with human hiring teams in control.",
    intro:
      "alphaScreen helps employers create roles, invite candidates, run structured AI-assisted interviews, and review candidate reports before choosing the next step.",
    sections: [
      section("What is alphaScreen?", [
        "alphaScreen is a web-based candidate screening platform from alphaSource AI. It organizes early candidate review around role criteria, structured interview responses, and hiring team review.",
      ]),
      section("How does alphaScreen work for hiring teams?", [
        "Teams set up a membership, create a role, invite candidates, review structured reports, and decide whether to advance, pause, or reject each candidate.",
      ]),
      section("How does alphaScreen pricing work?", [
        "Basic and Pro memberships include a platform membership fee plus a standard role fee. New self-serve buyers can optionally prepay the first role during signup and save 10% on that first role.",
      ]),
    ],
    links: [
      ["/alphascreen/how-it-works", "How it works"],
      ["/alphascreen/security", "Security"],
      ["/alphascreen/candidate-experience", "Candidate experience"],
      ["/alphascreen/roi", "ROI estimator"],
      ["/faq", "FAQ"],
    ],
    schemas: [
      organizationSchema,
      websiteSchema,
      softwareSchema,
      webPageSchema("/alphascreen", "alphaScreen", "AI-assisted candidate screening overview."),
      breadcrumbSchema([
        ["Home", "/"],
        ["alphaScreen", "/alphascreen"],
      ]),
    ],
  },
  "/alphascreen/pricing": {
    title: "alphaScreen Pricing | AI Interview Screening Memberships",
    description:
      "Compare alphaScreen Basic, Pro, and Enterprise membership options for structured AI-assisted interview screening, included interviews, duration caps, and additional interview pricing.",
    eyebrow: "alphaScreen pricing",
    h1: "Compare alphaScreen memberships and get started.",
    intro:
      "Basic and Pro self-serve memberships include a platform membership fee, role fees, included interviews per role, and optional first-role prepay during signup.",
    sections: [
      section("How does alphaScreen pricing work?", [
        "Basic is listed at $299 monthly or $3,299 annually plus $399 per role. Pro is listed at $599 monthly or $6,499 annually plus $699 per role.",
      ]),
      section("What is first-role prepay?", [
        "New self-serve buyers can optionally add their first role to the initial checkout at a one-time 10% discount: $359 for Basic or $629 for Pro. Additional roles use the standard role fee.",
      ]),
      section("What is included in a membership?", [
        "Basic includes 20 interviews per role with a 10-minute interview cap. Pro includes 30 interviews per role with a 12-minute interview cap. Enterprise options are available for custom volume or rollout needs.",
      ]),
    ],
    links: [
      ["/alphascreen/how-it-works", "Review the signup workflow"],
      ["/alphascreen/roi", "Estimate value"],
      ["/faq", "Read pricing FAQ"],
    ],
    schemas: [
      organizationSchema,
      websiteSchema,
      pricingSchema,
      webPageSchema("/alphascreen/pricing", "alphaScreen Pricing", "alphaScreen membership and role pricing."),
      breadcrumbSchema([
        ["Home", "/"],
        ["alphaScreen", "/alphascreen"],
        ["Pricing", "/alphascreen/pricing"],
      ]),
    ],
  },
  "/alphascreen/how-it-works": {
    title: "How alphaScreen Works | Self-Serve AI Screening Workflow",
    description:
      "See how alphaScreen self-serve signup, agreement review, Stripe Checkout, account setup, role creation, candidate invitations, and structured reports work.",
    eyebrow: "How alphaScreen works",
    h1: "From membership signup to first candidate review.",
    intro:
      "alphaScreen separates membership setup, agreement review, secure checkout, dashboard setup, role creation, candidate invitations, and report review into a clear workflow.",
    sections: [
      section("How does alphaScreen work?", [
        "The buyer selects a membership, completes agreement and checkout steps, sets a password, creates roles, invites candidates, and reviews candidate reports in the dashboard.",
      ]),
      section("What happens after a candidate completes an interview?", [
        "Authorized hiring users can review the candidate's available resume, structured interview responses, score context, and report information before choosing next steps.",
      ]),
      section("Who makes the final hiring decision?", [
        "The employer remains responsible for candidate communication, accommodations, next steps, and final hiring decisions.",
      ]),
    ],
    links: [
      ["/alphascreen/pricing", "Compare memberships"],
      ["/alphascreen/candidate-experience", "Candidate experience"],
      ["/alphascreen/security", "Security"],
      ["/faq", "FAQ"],
    ],
    schemas: [
      organizationSchema,
      websiteSchema,
      softwareSchema,
      webPageSchema("/alphascreen/how-it-works", "How alphaScreen Works", "alphaScreen workflow from signup to candidate review."),
      breadcrumbSchema([
        ["Home", "/"],
        ["alphaScreen", "/alphascreen"],
        ["How It Works", "/alphascreen/how-it-works"],
      ]),
    ],
  },
  "/alphascreen/security": {
    title: "alphaScreen Security | Candidate Data and Human Review",
    description:
      "Review alphaScreen public security and data protection positioning for candidate data, authorized access, reports, privacy, and human hiring decisions.",
    eyebrow: "Security and data",
    h1: "Candidate data protection, access controls, and human review.",
    intro:
      "alphaScreen is designed to support structured screening while keeping candidate information, account access, billing access, entity access, and hiring decisions handled through controlled workflows.",
    sections: [
      section("How does alphaScreen protect candidate and client data?", [
        "alphaScreen uses authenticated dashboard access, role-based permissions, assigned client or entity scope, controlled file and report access, and backend authorization checks.",
      ]),
      section("Who can access candidate reports?", [
        "Candidate reports are intended for authorized hiring users within the employer account or approved alphaSource support workflows.",
      ]),
      section("Does alphaScreen replace legal or compliance review?", [
        "No. Buyers should review the Privacy Policy, membership agreement, and their own hiring obligations for specific privacy, legal, or compliance requirements.",
      ]),
    ],
    links: [
      ["/faq", "Security FAQ"],
      ["/alphascreen/candidate-experience", "Candidate experience"],
      ["/alphascreen", "alphaScreen overview"],
      ["/privacy", "Privacy Policy"],
    ],
    schemas: [
      organizationSchema,
      websiteSchema,
      webPageSchema("/alphascreen/security", "alphaScreen Security", "Public alphaScreen security and data protection overview."),
      breadcrumbSchema([
        ["Home", "/"],
        ["alphaScreen", "/alphascreen"],
        ["Security", "/alphascreen/security"],
      ]),
    ],
  },
  "/alphascreen/candidate-experience": {
    title: "alphaScreen Candidate Experience | Structured AI Screening",
    description:
      "Learn how candidates experience alphaScreen structured AI avatar screening interviews and how hiring teams review results.",
    eyebrow: "Candidate experience",
    h1: "A structured screening experience candidates can understand.",
    intro:
      "alphaScreen gives candidates a clear web-based screening interview tied to a specific role while giving employers a more consistent record to review.",
    sections: [
      section("What do candidates experience?", [
        "Candidates receive a link, complete a structured role-based interview, and provide information that the hiring team can review in an organized report.",
      ]),
      section("Does alphaScreen support accommodations?", [
        "Accommodation requests remain part of the employer's hiring process. alphaScreen supports controlled workflows and human review instead of removing judgment from that process.",
      ]),
      section("What does the hiring team see?", [
        "Depending on account and role configuration, hiring teams may review resume information, interview responses, scores, summaries, and candidate reports.",
      ]),
    ],
    links: [
      ["/alphascreen/security", "Security and data"],
      ["/alphascreen/how-it-works", "How it works"],
      ["/faq", "FAQ"],
    ],
    schemas: [
      organizationSchema,
      websiteSchema,
      softwareSchema,
      webPageSchema("/alphascreen/candidate-experience", "alphaScreen Candidate Experience", "Candidate-facing alphaScreen workflow overview."),
      breadcrumbSchema([
        ["Home", "/"],
        ["alphaScreen", "/alphascreen"],
        ["Candidate Experience", "/alphascreen/candidate-experience"],
      ]),
    ],
  },
  "/alphascreen/for-dental-groups": {
    title: "alphaScreen for Dental Groups | DSO and Multi-Location Hiring",
    description:
      "See how alphaScreen supports structured candidate screening for dental groups, DSOs, multi-location operators, and broader hiring teams.",
    eyebrow: "Dental and multi-location hiring",
    h1: "Structured screening for dental groups, DSOs, and multi-location teams.",
    intro:
      "alphaScreen is built for structured hiring teams broadly, with strong fit for dental and healthcare-adjacent operators that need consistent screening across locations.",
    sections: [
      section("How does alphaScreen support dental groups?", [
        "Dental groups often screen repeated practice-level roles across multiple locations. alphaScreen helps standardize first-pass review without making final decisions for the employer.",
      ]),
      section("Can managers use alphaScreen across multiple locations or entities?", [
        "Authorized parent-level managers can manage work across assigned client or entity scopes, while child-only access remains scoped to the assigned entity.",
      ]),
      section("Who else can use alphaScreen?", [
        "alphaScreen can also support other teams with repeated frontline hiring needs, multiple managers, or a need for more consistent first-pass screening.",
      ]),
    ],
    links: [
      ["/alphascreen", "alphaScreen overview"],
      ["/alphascreen/how-it-works", "How it works"],
      ["/alphascreen/security", "Security"],
      ["/alphascreen/roi", "ROI estimator"],
    ],
    schemas: [
      organizationSchema,
      websiteSchema,
      softwareSchema,
      webPageSchema("/alphascreen/for-dental-groups", "alphaScreen for Dental Groups", "alphaScreen use case page for dental and multi-location hiring teams."),
      breadcrumbSchema([
        ["Home", "/"],
        ["alphaScreen", "/alphascreen"],
        ["Dental Groups", "/alphascreen/for-dental-groups"],
      ]),
    ],
  },
  "/alphascreen/roi": {
    title: "alphaScreen Value Estimator | Screening Time and Membership Cost",
    description:
      "Estimate manual screening time, initial-screening labor cost, membership platform cost, role fees, and additional interview fees for alphaScreen Basic and Pro memberships.",
    eyebrow: "Value estimator",
    h1: "Estimate screening time, labor cost, and alphaScreen membership cost.",
    intro:
      "The alphaScreen value estimator helps teams compare manual first-pass screening time with membership, role, and additional-interview assumptions.",
    sections: [
      section("What does the ROI estimator calculate?", [
        "It estimates screening hours represented, labor cost of initial screening, platform membership cost, role fees, additional interview fees, and estimated comparison value.",
      ]),
      section("Does the estimator guarantee savings?", [
        "No. The estimator is a planning tool. It does not guarantee savings, hiring outcomes, offer acceptance, retention, or candidate quality.",
      ]),
      section("How should teams use the estimate?", [
        "Teams can use the estimate to discuss manager time, screening volume, membership fit, and whether structured first-pass screening may reduce repetitive work.",
      ]),
    ],
    links: [
      ["/alphascreen/pricing", "Compare memberships"],
      ["/faq", "Read FAQ"],
      ["/alphascreen/how-it-works", "How it works"],
    ],
    schemas: [
      organizationSchema,
      websiteSchema,
      softwareSchema,
      webPageSchema("/alphascreen/roi", "alphaScreen Value Estimator", "alphaScreen screening time and membership cost estimator."),
      breadcrumbSchema([
        ["Home", "/"],
        ["alphaScreen", "/alphascreen"],
        ["ROI Estimator", "/alphascreen/roi"],
      ]),
    ],
  },
};

if (!fs.existsSync(indexPath)) {
  throw new Error(`Build output not found at ${indexPath}. Run Vite build before prerendering public routes.`);
}

const baseHtml = fs.readFileSync(indexPath, "utf8");

for (const route of publicRoutes) {
  const content = routeContent[route];
  if (!content) throw new Error(`Missing prerender content for ${route}`);
  writeRoute(route, renderRouteHtml(baseHtml, route, content));
}

writeStaticRoutingFile();

console.log(`Prerendered ${publicRoutes.length} public route HTML snapshots.`);

function faqRoute(label) {
  const path = label === "Support" ? "/support" : "/faq";
  return {
    title: label === "Support" ? "alphaSource AI Support | alphaScreen FAQ and Release Notes" : "alphaSource AI FAQ | alphaScreen Questions and Support",
    description:
      "Answers to common questions about alphaSource AI, alphaScreen, candidate screening workflows, pricing, security, and getting started.",
    eyebrow: label,
    h1: label === "Support" ? "alphaScreen FAQ and support." : "alphaScreen frequently asked questions.",
    intro:
      "Direct answers about alphaScreen, candidate screening workflows, dental groups, membership pricing, first-role prepay, security, and human review.",
    sections: [
      {
        heading: "Common alphaScreen questions",
        paragraphs: [
          "These concise answers are written for employers evaluating alphaScreen before signup.",
        ],
        qa: faqItems,
      },
    ],
    links: [
      ["/alphascreen", "alphaScreen overview"],
      ["/alphascreen/pricing", "Pricing / Get Started"],
      ["/alphascreen/how-it-works", "How it works"],
      ["/alphascreen/security", "Security"],
      ["/alphascreen/candidate-experience", "Candidate experience"],
      ["/alphascreen/for-dental-groups", "For dental groups"],
      ["/alphascreen/roi", "ROI estimator"],
    ],
    schemas: [
      organizationSchema,
      websiteSchema,
      faqSchema,
      webPageSchema(path, label === "Support" ? "alphaSource AI Support" : "alphaSource AI FAQ", "alphaScreen public FAQ and support answers."),
      breadcrumbSchema([
        ["Home", "/"],
        [label, path],
      ]),
    ],
  };
}

function section(heading, paragraphs) {
  return { heading, paragraphs };
}

function offer(name, price, unitText) {
  return {
    "@type": "Offer",
    name,
    url: routeUrl("/alphascreen/pricing"),
    price,
    priceCurrency: "USD",
    priceSpecification: {
      "@type": "UnitPriceSpecification",
      price,
      priceCurrency: "USD",
      unitText,
    },
  };
}

function routeUrl(routePath = "/") {
  const href = crawlableHref(routePath);
  return href === "/" ? `${SITE_URL}/` : `${SITE_URL}${href}`;
}

function webPageSchema(routePath, name, description) {
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name,
    description,
    url: routeUrl(routePath),
    isPartOf: {
      "@type": "WebSite",
      name: "alphaSource AI",
      url: `${SITE_URL}/`,
    },
    publisher: {
      "@type": "Organization",
      name: "alphaSource AI",
      url: `${SITE_URL}/`,
    },
  };
}

function breadcrumbSchema(items) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map(([name, routePath], index) => ({
      "@type": "ListItem",
      position: index + 1,
      name,
      item: routeUrl(routePath),
    })),
  };
}

function renderRouteHtml(html, route, content) {
  const snapshot = renderSnapshot(route, content);
  const rootHtml = `<div id="root">${snapshot}</div>`;
  let next = html.replace(/<div id="root"><\/div>/, rootHtml);
  next = replaceOrInsertTitle(next, content.title);
  next = replaceOrInsertMeta(next, 'meta[name="description"]', `<meta name="description" content="${escapeAttr(content.description)}" />`);
  next = replaceOrInsertMeta(next, 'meta[name="robots"]', '<meta name="robots" content="index,follow" />');
  next = replaceOrInsertMeta(next, 'link[rel="canonical"]', `<link rel="canonical" href="${routeUrl(route)}" />`);
  next = replaceOrInsertMeta(next, 'meta[property="og:type"]', '<meta property="og:type" content="website" />');
  next = replaceOrInsertMeta(next, 'meta[property="og:site_name"]', '<meta property="og:site_name" content="alphaSource AI" />');
  next = replaceOrInsertMeta(next, 'meta[property="og:title"]', `<meta property="og:title" content="${escapeAttr(content.title)}" />`);
  next = replaceOrInsertMeta(next, 'meta[property="og:description"]', `<meta property="og:description" content="${escapeAttr(content.description)}" />`);
  next = replaceOrInsertMeta(next, 'meta[property="og:url"]', `<meta property="og:url" content="${routeUrl(route)}" />`);
  next = replaceOrInsertMeta(next, 'meta[property="og:image"]', `<meta property="og:image" content="${SITE_URL}/opengraph.jpg" />`);
  next = replaceOrInsertMeta(next, 'meta[name="twitter:card"]', '<meta name="twitter:card" content="summary_large_image" />');
  next = replaceOrInsertMeta(next, 'meta[name="twitter:title"]', `<meta name="twitter:title" content="${escapeAttr(content.title)}" />`);
  next = replaceOrInsertMeta(next, 'meta[name="twitter:description"]', `<meta name="twitter:description" content="${escapeAttr(content.description)}" />`);
  next = replaceOrInsertMeta(next, 'meta[name="twitter:image"]', `<meta name="twitter:image" content="${SITE_URL}/opengraph.jpg" />`);
  next = next.replace("</head>", `${renderSnapshotHead(content.schemas)}\n  </head>`);
  return next;
}

function renderSnapshot(route, content) {
  return `
    <div class="as-crawler-snapshot" data-public-prerender-route="${escapeAttr(route)}">
      ${renderNav()}
      <main>
        <section class="as-snapshot-hero">
          <p class="as-eyebrow">${escapeHtml(content.eyebrow)}</p>
          <h1>${escapeHtml(content.h1)}</h1>
          <p class="as-intro">${escapeHtml(content.intro)}</p>
          <p class="as-updated">Last updated: ${LAST_UPDATED}</p>
        </section>
        ${content.sections.map(renderContentSection).join("\n")}
        ${renderRelatedLinks(content.links)}
      </main>
      ${renderFooter()}
    </div>`;
}

function renderNav() {
  return `
      <nav class="as-snapshot-nav" aria-label="Public navigation">
        <a class="as-brand" href="/">alphaSource AI</a>
        <div>
          ${navLinks.map(([label, href]) => `<a href="${escapeAttr(crawlableHref(href))}">${escapeHtml(label)}</a>`).join("\n          ")}
        </div>
      </nav>`;
}

function renderFooter() {
  return `
      <footer class="as-snapshot-footer">
        <div>
          <strong>alphaSource AI</strong>
          <p>alphaScreen is a structured AI-assisted candidate screening platform for hiring teams.</p>
          <p><a href="mailto:info@alphasourceai.com">info@alphasourceai.com</a></p>
          <p><a href="https://www.linkedin.com/company/alphasourceai">LinkedIn</a> <a href="https://www.facebook.com/alphasourceai">Facebook</a></p>
        </div>
        <nav aria-label="Footer navigation">
          ${footerLinks.map(([label, href]) => `<a href="${escapeAttr(crawlableHref(href))}">${escapeHtml(label)}</a>`).join("\n          ")}
        </nav>
      </footer>`;
}

function renderContentSection(item) {
  const paragraphs = item.paragraphs.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("\n          ");
  const qa = item.qa
    ? `<div class="as-faq-list">${item.qa.map((entry) => `
          <article>
            <h3>${escapeHtml(entry.question)}</h3>
            <p>${escapeHtml(entry.answer)}</p>
          </article>`).join("\n")}</div>`
    : "";
  return `
        <section class="as-snapshot-section">
          <h2>${escapeHtml(item.heading)}</h2>
          ${paragraphs}
          ${qa}
        </section>`;
}

function renderRelatedLinks(links) {
  if (!links?.length) return "";
  return `
        <section class="as-snapshot-section as-related-links">
          <h2>Related alphaScreen pages</h2>
          <p>Use these public pages to compare alphaScreen workflows, security, pricing, candidate experience, and FAQ answers.</p>
          <nav aria-label="Related public pages">
            ${links.map(([href, label]) => `<a href="${escapeAttr(crawlableHref(href))}">${escapeHtml(label)}</a>`).join("\n            ")}
          </nav>
        </section>`;
}

function renderSnapshotHead(schemas) {
  const routeList = JSON.stringify(publicRoutes);
  const schemaTags = schemas
    .map((schema, index) => {
      const json = JSON.stringify(schema).replace(/</g, "\\u003c");
      return `    <script type="application/ld+json" data-prerender-jsonld="${index}">${json}</script>`;
    })
    .join("\n");
  return `
    <script>
      (function () {
        var publicRoutes = ${routeList};
        var path = window.location.pathname.replace(/\\/+$/, "") || "/";
        if (publicRoutes.indexOf(path) === -1) {
          document.documentElement.classList.add("as-hide-static-snapshot");
        }
      })();
    </script>
    <style>
      .as-hide-static-snapshot .as-crawler-snapshot { display: none !important; }
      .as-crawler-snapshot { font-family: Inter, Arial, sans-serif; color: #0A1547; background: #F8F9FD; line-height: 1.6; }
      .as-crawler-snapshot a { color: #5d43cc; text-decoration: none; }
      .as-crawler-snapshot a:hover { text-decoration: underline; }
      .as-snapshot-nav, .as-snapshot-footer { display: flex; flex-wrap: wrap; gap: 1rem; justify-content: space-between; padding: 1.25rem 2rem; background: #ffffff; border-bottom: 1px solid rgba(10, 21, 71, 0.1); }
      .as-snapshot-nav div, .as-snapshot-footer nav { display: flex; flex-wrap: wrap; gap: 0.75rem; }
      .as-brand { font-weight: 800; color: #0A1547 !important; }
      .as-snapshot-hero, .as-snapshot-section { max-width: 960px; margin: 0 auto; padding: 2.5rem 1.5rem; }
      .as-snapshot-hero h1 { max-width: 880px; margin: 0.4rem 0 1rem; font-size: clamp(2.25rem, 5vw, 4rem); line-height: 1.05; letter-spacing: 0; color: #0A1547; }
      .as-eyebrow { margin: 0; color: #7c5fcc; font-size: 0.85rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.14em; }
      .as-intro { max-width: 760px; font-size: 1.08rem; color: rgba(10, 21, 71, 0.68); }
      .as-updated { font-size: 0.9rem; font-weight: 700; color: rgba(10, 21, 71, 0.5); }
      .as-snapshot-section { background: #ffffff; border-top: 1px solid rgba(10, 21, 71, 0.08); }
      .as-snapshot-section h2 { margin: 0 0 0.75rem; font-size: 1.55rem; line-height: 1.2; color: #0A1547; }
      .as-snapshot-section h3 { margin: 0 0 0.4rem; font-size: 1rem; color: #0A1547; }
      .as-snapshot-section p { margin: 0.5rem 0; color: rgba(10, 21, 71, 0.68); }
      .as-faq-list { display: grid; gap: 1rem; margin-top: 1.25rem; }
      .as-faq-list article { padding: 1rem; border: 1px solid rgba(10, 21, 71, 0.1); border-radius: 8px; background: #F8F9FD; }
      .as-related-links nav { display: flex; flex-wrap: wrap; gap: 0.65rem; margin-top: 1rem; }
      .as-related-links a { display: inline-flex; border: 1px solid rgba(10, 21, 71, 0.12); border-radius: 999px; padding: 0.55rem 0.85rem; background: #ffffff; font-weight: 800; }
      .as-snapshot-footer { border-top: 1px solid rgba(10, 21, 71, 0.1); border-bottom: 0; background: #0A1547; color: #ffffff; }
      .as-snapshot-footer p { margin: 0.35rem 0; color: rgba(255, 255, 255, 0.72); }
      .as-snapshot-footer a { color: #c7b4ff; }
    </style>
${schemaTags}`;
}

function replaceOrInsertTitle(html, title) {
  const tag = `<title>${escapeHtml(title)}</title>`;
  if (/<title>[\s\S]*?<\/title>/.test(html)) {
    return html.replace(/<title>[\s\S]*?<\/title>/, tag);
  }
  return html.replace("</head>", `    ${tag}\n  </head>`);
}

function replaceOrInsertMeta(html, selector, tag) {
  const patterns = {
    'meta[name="description"]': /<meta\s+name=["']description["'][\s\S]*?>/i,
    'meta[name="robots"]': /<meta\s+name=["']robots["'][\s\S]*?>/i,
    'link[rel="canonical"]': /<link\s+rel=["']canonical["'][\s\S]*?>/i,
    'meta[property="og:type"]': /<meta\s+property=["']og:type["'][\s\S]*?>/i,
    'meta[property="og:site_name"]': /<meta\s+property=["']og:site_name["'][\s\S]*?>/i,
    'meta[property="og:title"]': /<meta\s+property=["']og:title["'][\s\S]*?>/i,
    'meta[property="og:description"]': /<meta\s+property=["']og:description["'][\s\S]*?>/i,
    'meta[property="og:url"]': /<meta\s+property=["']og:url["'][\s\S]*?>/i,
    'meta[property="og:image"]': /<meta\s+property=["']og:image["'][\s\S]*?>/i,
    'meta[name="twitter:card"]': /<meta\s+name=["']twitter:card["'][\s\S]*?>/i,
    'meta[name="twitter:title"]': /<meta\s+name=["']twitter:title["'][\s\S]*?>/i,
    'meta[name="twitter:description"]': /<meta\s+name=["']twitter:description["'][\s\S]*?>/i,
    'meta[name="twitter:image"]': /<meta\s+name=["']twitter:image["'][\s\S]*?>/i,
  };
  const pattern = patterns[selector];
  if (!pattern) throw new Error(`Unknown meta selector ${selector}`);
  if (pattern.test(html)) return html.replace(pattern, tag);
  return html.replace("</head>", `    ${tag}\n  </head>`);
}

function writeRoute(route, html) {
  const target = route === "/"
    ? indexPath
    : path.join(distRoot, ...route.split("/").filter(Boolean), "index.html");
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, html);
}

function writeStaticRoutingFile() {
  const lines = [
    "# Public prerendered routes. Keep these before the SPA fallback.",
    ...publicRoutes
      .filter((route) => route !== "/")
      .flatMap((route) => [
        `${route} ${crawlableHref(route)} 301`,
        `${route}/ ${route}/index.html 200`,
        `${route}/index.html ${route}/index.html 200`,
      ]),
    "",
    "# Authenticated and dynamic app routes remain client-rendered SPA routes.",
    "/dashboard/* /index.html 200",
    "/admin/* /index.html 200",
    "/checkout/* /index.html 200",
    "/membership-agreement/* /index.html 200",
    "/interview/* /index.html 200",
    "/interview-access/* /index.html 200",
    "/interview-host/* /index.html 200",
    "/text-interview/* /index.html 200",
    "/automation/* /index.html 200",
    "/pwreset /index.html 200",
    "/accommodation-request/* /index.html 200",
    "/* /index.html 200",
    "",
  ];
  fs.writeFileSync(path.join(distRoot, "_redirects"), lines.join("\n"));
}

function crawlableHref(href) {
  const value = String(href || "").trim();
  if (!value || !value.startsWith("/") || value === "/" || value.startsWith("/#")) return value;
  const match = value.match(/^([^?#]*)([?#].*)?$/);
  const pathPart = (match?.[1] || value).replace(/\/+$/, "") || "/";
  const suffix = match?.[2] || "";
  if (trailingSlashPublicRoutes.has(pathPart)) return `${pathPart}/${suffix}`;
  return value;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttr(value) {
  return escapeHtml(value);
}
