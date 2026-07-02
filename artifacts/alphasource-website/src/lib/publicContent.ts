export const PUBLIC_CONTENT_LAST_UPDATED = "June 25, 2026";

export type PublicFaqItem = {
  question: string;
  answer: string;
};

export type PublicFaqSection = {
  title: string;
  intro: string;
  items: PublicFaqItem[];
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
        question: "How does alphaScreen evaluate candidates?",
        answer:
          "alphaScreen combines role criteria, resume information, structured interview responses, and available interview signals into organized reports and scores. The output is designed to help hiring teams review candidates more consistently, not to make final hiring decisions automatically.",
      },
      {
        question: "Does alphaScreen replace recruiters or hiring managers?",
        answer:
          "No. alphaScreen supports screening and review, but recruiters and hiring managers remain responsible for communication, accommodations, next steps, and final hiring decisions.",
      },
    ],
  },
  {
    title: "Candidate Experience",
    intro: "How the screening workflow works from the candidate side.",
    items: [
      {
        question: "What types of interviews does alphaScreen support?",
        answer:
          "alphaScreen supports structured AI avatar screening interviews tied to a specific role. Candidates can complete the screening interview from a web link on their own schedule, subject to the employer's role setup and instructions.",
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
    ],
  },
  {
    title: "Security & Data",
    intro: "How alphaSource frames privacy, access, and responsible use.",
    items: [
      {
        question: "How does alphaSource protect candidate data?",
        answer:
          "alphaSource designs alphaScreen around authenticated access, role-based permissions, controlled file and report access, and privacy-conscious workflows for candidate and client information.",
      },
      {
        question: "Who can access candidate reports?",
        answer:
          "Candidate reports are intended for authorized users within the employer account or approved alphaSource support workflows. Access should be limited to people who need the information for the hiring process.",
      },
      {
        question: "Does alphaScreen support accommodations?",
        answer:
          "Accommodation requests remain part of the employer's hiring process. alphaScreen supports controlled workflows and human review so candidate needs can be routed appropriately.",
      },
    ],
  },
  {
    title: "Memberships & Billing",
    intro: "How public alphaScreen membership pricing works.",
    items: [
      {
        question: "How do memberships and role pricing work?",
        answer:
          "Public Basic and Pro memberships include a platform membership fee plus a per-role fee. Basic is listed at $299 monthly or $3,299 annually plus $399 per role. Pro is listed at $599 monthly or $6,499 annually plus $699 per role.",
      },
      {
        question: "What is included in Basic and Pro memberships?",
        answer:
          "Basic includes 20 interviews per role with a 10-minute interview cap. Pro includes 30 interviews per role with a 12-minute interview cap. Additional interviews are listed publicly at $30 for Basic and $35 for Pro.",
      },
      {
        question: "What is first-role prepay?",
        answer:
          "New self-serve buyers can optionally prepay the first role during signup at a one-time 10% discount. The prepaid first role is used when the first paid role is opened under the same billing account.",
      },
      {
        question: "What happens after a company signs up?",
        answer:
          "A company starts membership signup, reviews and signs the membership agreement, completes secure checkout, and then finishes account setup before creating roles and inviting candidates.",
      },
      {
        question: "What if our team needs custom volume or rollout support?",
        answer:
          "Teams with larger volume, custom terms, or implementation needs can request a demo or contact alphaSource about Enterprise options.",
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
    title: "Automation & Workflow",
    intro: "How alphaScreen uses structured automation while keeping people in control.",
    items: [
      {
        question: "How does structured interview scoring work?",
        answer:
          "alphaScreen uses role-specific criteria and structured interview responses to organize scoring and report information. The scoring is a review aid for hiring teams, not an automatic employment decision.",
      },
      {
        question: "How does alphaScreen handle automation and human review?",
        answer:
          "alphaScreen is designed so people configure roles, review candidate information, decide next steps, and manage communication. AI assists with structure, consistency, and summarization.",
      },
    ],
  },
];

export const publicFaqItems: PublicFaqItem[] = publicFaqSections.flatMap((section) => section.items);
