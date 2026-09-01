import { RUBRIC_FAQ } from "@/content/rubricGuidance";

export const PUBLIC_CONTENT_LAST_UPDATED = "September 1, 2026";

export type PublicFaqItem = {
  question: string;
  answer: string;
};

export type PublicFaqSection = {
  title: string;
  intro: string;
  items: PublicFaqItem[];
};

export type PublicSupportTopic = {
  title: string;
  body: string;
  links?: Array<{ label: string; href: string }>;
};

export type PublicProductUpdate = {
  date: string;
  title: string;
  summary: string;
  bullets: string[];
};

export const publicFaqSections: PublicFaqSection[] = [
  {
    title: "Hiring Teams",
    intro: "Plain-language answers for employers evaluating alphaScreen for candidate screening.",
    items: [
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
        question: "Who makes final hiring decisions?",
        answer:
          "Employers make final hiring decisions. alphaScreen organizes screening information and reports for review, but it does not make automatic employment decisions.",
      },
      {
        question: "Does alphaScreen replace recruiters or hiring managers?",
        answer:
          "No. alphaScreen supports early screening and review, but recruiters and hiring managers remain responsible for communication, accommodations, next steps, and final decisions.",
      },
    ],
  },
  {
    title: "Memberships & Billing",
    intro: "How public alphaScreen membership pricing works.",
    items: [
      {
        question: "How does pricing work?",
        answer:
          "Public Essential and Pro memberships include a platform membership fee plus a per-role fee. Essential is listed at $299 monthly or $3,299 annually plus $399 per role. Pro is listed at $599 monthly or $6,499 annually plus $699 per role.",
      },
      {
        question: "What is included in a membership?",
        answer:
          "Essential includes 20 interviews per role with a 10-minute interview cap. Pro includes 30 interviews per role with a 12-minute interview cap. Additional interviews are listed publicly at $30 for Essential and $35 for Pro.",
      },
      {
        question: "How do billing and role fees work?",
        answer:
          "The membership fee covers platform access for the selected cadence. Role fees are charged when paid roles are opened, and additional interviews are billed only when extra interview capacity is needed for a role.",
      },
      {
        question: "What is first-role prepay?",
        answer:
          "New self-serve buyers can optionally prepay the first role during signup at a one-time 10% discount. The prepaid first role is used when the first paid role is opened under the same billing account.",
      },
    ],
  },
  {
    title: "Setup & Support",
    intro: "Where buyers can get help after starting a membership.",
    items: [
      {
        question: "How do I get help during setup?",
        answer:
          "Use the public support page or contact alphaSource at info@alphasourceai.com with the buyer email, company name, and a short description of the setup issue.",
      },
      {
        question: "Can client users sign in with a passkey?",
        answer:
          "Yes. Client dashboard users can optionally add a passkey from Profile & security and then use a supported device unlock method or security key at sign-in. Password sign-in remains available as a fallback.",
      },
      {
        question: "Where do client users manage profile and security settings?",
        answer:
          "After signing in, open the account menu from the initial in the upper-right corner and choose Profile & security. That page includes name, verified email, appearance, passkey, and password-reset controls.",
      },
    ],
  },
  {
    title: "Candidate Workflow",
    intro: "How candidate invitations, interviews, and reports work.",
    items: [
      {
        question: "How are candidate links sent and managed?",
        answer:
          "Hiring teams create roles and invite candidates through role-specific screening links or dashboard workflows. Teams should verify candidate email addresses and manage communication consistently with their hiring process.",
      },
      {
        question: "What interview-access verification options can candidates use?",
        answer:
          "Email verification is available. When Text Message is offered for an eligible U.S. mobile number, the candidate can choose it after reviewing the consent disclosure. Text-message consent is optional, and Email remains available as the alternative.",
      },
      {
        question: "What happens after a candidate completes an interview?",
        answer:
          "The hiring team can review the candidate's available resume, interview responses, score context, and report information before choosing the next step.",
      },
      {
        question: "How are candidate reports used?",
        answer:
          "Candidate reports are review aids for authorized hiring team members. They help organize screening information so teams can compare candidates more consistently.",
      },
      {
        question: "Does alphaScreen support accommodations?",
        answer:
          "Accommodation requests remain part of the employer's hiring process. alphaScreen supports controlled workflows and human review so candidate needs can be routed appropriately.",
      },
    ],
  },
  {
    title: "Interview Types, Membership & Warm-up",
    intro: "How membership capacity and role-specific interview types work together.",
    items: [...RUBRIC_FAQ],
  },
  {
    title: "Security, Data & Review",
    intro: "How alphaSource frames privacy, access, and responsible use.",
    items: [
      {
        question: "How does alphaScreen protect candidate data?",
        answer:
          "alphaScreen is designed around authenticated access, role-based permissions, controlled file and report access, and privacy-conscious workflows for candidate and client information.",
      },
      {
        question: "How does alphaScreen handle automation and human review?",
        answer:
          "alphaScreen uses automation to collect, organize, score, and summarize screening information while keeping role setup, candidate review, and hiring decisions with people.",
      },
    ],
  },
  {
    title: "Dental Groups & Multi-Location Teams",
    intro: "How alphaScreen fits dental, DSO, and entity-scoped hiring teams.",
    items: [
      {
        question: "Is alphaScreen designed for dental groups?",
        answer:
          "alphaScreen is built for structured hiring teams broadly and is a strong fit for dental groups, DSOs, and multi-location operators that need consistent screening across practices or entities.",
      },
      {
        question: "Can managers use alphaScreen across multiple locations or entities?",
        answer:
          "Authorized parent-level managers can work across assigned client or entity scopes. Access depends on the membership account structure and role permissions configured for that user.",
      },
    ],
  },
  {
    title: "Workflow Fit",
    intro: "How alphaScreen fits specialized and multi-location teams.",
    items: [
      {
        question: "How does alphaScreen evaluate candidates?",
        answer:
          "alphaScreen combines role criteria, resume information, structured interview responses, and available interview signals into organized reports and scores. The output is designed to help hiring teams review candidates more consistently, not to make final hiring decisions automatically.",
      },
    ],
  },
];

export const publicFaqItems: PublicFaqItem[] = publicFaqSections.flatMap((section) => section.items);

export const publicProductUpdates: PublicProductUpdate[] = [
  {
    date: "September 2026",
    title: "Essential membership naming",
    summary: "The entry alphaScreen membership now uses the clearer Essential name across signup, billing, and support.",
    bullets: [
      "Pricing, included interviews, duration caps, and role fees are unchanged",
      "Existing memberships continue without any account or billing migration",
      "Checkout and agreement screens now show Essential consistently",
    ],
  },
  {
    date: "August 2026",
    title: "Passkeys and profile settings",
    summary: "Client users now have one place to manage personal account settings and optional passkey sign-in.",
    bullets: [
      "Update a name or verified email from Profile & security",
      "Choose Light, Dark, or System appearance",
      "Add, rename, or remove supported passkeys",
      "Continue using a password as a fallback",
    ],
  },
  {
    date: "August 2026",
    title: "Optional text-message verification",
    summary: "Candidate interview-access verification now supports another optional delivery method when it is available.",
    bullets: [
      "Eligible candidates may choose Email or Text Message when both are offered",
      "Text-message consent is optional and shown before requesting a code",
      "Email remains available if text delivery cannot be confirmed",
    ],
  },
  {
    date: "August 2026",
    title: "Dashboard and support improvements",
    summary: "The client workspace and support paths were refreshed for clearer navigation and help.",
    bullets: [
      "Updated dashboard overview and navigation",
      "Talk with Support remains available inside the client workspace",
      "Public phone and email support guidance is easier to find",
    ],
  },
];

export const publicSupportTopics: PublicSupportTopic[] = [
  {
    title: "Setup help",
    body:
      "Use support when the buyer cannot finish account setup, does not know the next step after checkout, or needs help understanding the first role workflow.",
    links: [
      { label: "How alphaScreen works", href: "/alphascreen/how-it-works" },
      { label: "Pricing / Get Started", href: "/alphascreen/pricing" },
    ],
  },
  {
    title: "Account, password, and passkey setup",
    body:
      "If a setup email does not arrive, check spam or junk first, then contact alphaSource with the buyer email and company name. Existing client users can manage optional passkeys from Profile & security. Do not share password setup links publicly.",
  },
  {
    title: "Memberships, billing, and first-role prepay",
    body:
      "Support can help explain membership cadence, role fees, additional interviews, and first-role prepay status. Billing access remains limited to authorized account users.",
    links: [
      { label: "Membership pricing", href: "/alphascreen/pricing" },
      { label: "Value estimator", href: "/alphascreen/roi" },
    ],
  },
  {
    title: "Role creation and candidate links",
    body:
      "For role setup or candidate link issues, include the role name, candidate email if relevant, and a short description of the problem so support can triage the workflow.",
    links: [
      { label: "Candidate experience", href: "/alphascreen/candidate-experience" },
    ],
  },
  {
    title: "Agreement and checkout recovery",
    body:
      "If agreement signing or checkout is interrupted, return to the original buyer email flow when possible or contact support with the buyer email and approximate signup time.",
  },
  {
    title: "Security and privacy questions",
    body:
      "Use the public security and privacy pages for high-level review. Specific legal, privacy, or security questions can be routed to alphaSource support before purchase.",
    links: [
      { label: "Security overview", href: "/alphascreen/security" },
      { label: "Privacy Policy", href: "/privacy/" },
    ],
  },
];

export const publicSupportQuestions: PublicFaqItem[] = [
  {
    question: "How do I get help during alphaScreen setup?",
    answer:
      "Contact alphaSource at info@alphasourceai.com with your company name, buyer email, and a brief description of the setup issue.",
  },
  {
    question: "What should I do if the account or password setup email is missing?",
    answer:
      "Check spam or junk first. If it still is not available, contact support with the buyer email and company name so alphaSource can review the setup status.",
  },
  {
    question: "Where do I set up a passkey?",
    answer:
      "Sign in with your password, open the account menu from the initial in the upper-right corner, choose Profile & security, and then choose Add a passkey. Password sign-in remains available as a fallback.",
  },
  {
    question: "What if a candidate does not receive a verification code?",
    answer:
      "For Email, check spam or junk and use the available resend option. If Text Message was selected and delivery cannot be confirmed, choose Email instead. Contact support if the candidate still cannot continue.",
  },
  {
    question: "How do I get help with membership or billing questions?",
    answer:
      "Use the support contact with your company name and buyer email. Billing and agreement details are handled through authorized account and support workflows.",
  },
  {
    question: "What if first-role prepay does not appear when opening the first role?",
    answer:
      "Contact support before opening another paid role. Include the buyer email, company name, and whether first-role prepay was selected during signup.",
  },
  {
    question: "What should I include when reporting candidate link issues?",
    answer:
      "Include the role name, candidate email if relevant, what the candidate saw, and whether the candidate checked browser permissions or retried the link.",
  },
  {
    question: "What if the agreement or checkout step gets stuck?",
    answer:
      "Refresh once and use the original buyer email flow if available. If the issue continues, contact support with the buyer email and approximate signup time.",
  },
];
