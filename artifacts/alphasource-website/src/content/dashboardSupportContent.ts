import { RUBRIC_FAQ } from "@/content/rubricGuidance";

export const DASHBOARD_SUPPORT_KNOWLEDGE_VERSION = "2026-08-26.1";

export const faqSections = [
  {
    title: "Getting started",
    items: [
      {
        question: "What is alphaScreen?",
        answer: "alphaScreen is an AI-powered screening platform that helps your team create roles, invite candidates, conduct structured screening interviews, and review candidate reports in one dashboard.",
      },
      {
        question: "What should I do first?",
        answer: "Start by confirming your client profile, team access, billing status, and active roles. Then create or review a role before sending candidates into the screening interview flow.",
      },
      {
        question: "Who should have dashboard access?",
        answer: "Give access only to team members who need to manage roles, review candidates, view reports, or support the hiring process. Keep access limited to the right people.",
      },
    ],
  },
  {
    title: "Profile and account security",
    items: [
      {
        question: "Where can I update my profile or sign-in settings?",
        answer: "Open the account menu from your initial in the upper-right corner, then choose Profile & security. From there you can update your name and verified email, choose Light, Dark, or System appearance, manage passkeys, or request a password reset email.",
      },
      {
        question: "How do I add and use a passkey?",
        answer: "Open Profile & security and choose Add a passkey. Follow your device prompt to use Face ID, Touch ID, Windows Hello, a device PIN, or a security key. After setup, choose Sign in with a passkey on the alphaSource sign-in form. Only add passkeys on devices or password managers you control.",
      },
      {
        question: "Does adding a passkey remove my password?",
        answer: "No. Your password remains available as a fallback. You can sign in with either method and can rename or remove saved passkeys from Profile & security.",
      },
      {
        question: "What happens when I change my account email?",
        answer: "For account protection, both your current inbox and the new inbox must confirm the change. Your current email remains active until both confirmations are complete.",
      },
    ],
  },
  {
    title: "Parent clients and entities",
    items: [
      {
        question: "What is a parent client?",
        answer: "The parent client is the main account for your organization. Billing, membership agreements, subscriptions, legal billing details, and plan settings are managed at the parent client level.",
      },
      {
        question: "What are child entities?",
        answer: "Child entities are operational scopes under the parent client, such as offices, locations, branches, companies, employers, or contractors. They help your team organize roles, candidates, screening interviews, and reports by the part of the organization doing the hiring.",
      },
      {
        question: "Who can see or manage entities?",
        answer: "Super Admins can see the parent client and its child entities. Managers and Members see only the scopes assigned to them. Super Admins can add child entities, import child entities from CSV, update child entity names and labels, and archive child entities that are no longer active.",
      },
      {
        question: "Where do roles, candidates, screening interviews, and reports belong?",
        answer: "Roles, candidates, screening interviews, and reports belong to the selected client or entity scope. Use the available client or entity selector before managing roles, reviewing candidates, or checking membership assignments.",
      },
      {
        question: "How does Entity filtering work on Roles, Candidates, and Members?",
        answer: "For parent/child entity clients, Roles, Candidates, and Members include an Entity selector. The parent/client-name option shows records assigned directly to the parent organization. All offices, All locations, or All entities shows parent plus child entity records. A specific entity option shows records assigned directly to that entity. The Entity column shows which entity each row belongs to. On Members, filtering shows direct assignments for the selected entity; inherited or effective access is not the same as direct assignment.",
      },
      {
        question: "How does entity CSV import work?",
        answer: "Use the CSV template from the Entities page when you need to create multiple child entities at once. Required columns currently include Name, Location type, Location user name, Location user email, and Manager/Member designation. Imported users are assigned directly to the child entity listed in their row. The import does not automatically send emails to imported members, and existing direct member assignments may be skipped instead of duplicated. Review imported member access after import.",
      },
      {
        question: "How should temporary credentials from import be handled?",
        answer: "If temporary credentials are generated during CSV import, they are shown only in the import results after submission. Download or store them securely right away, handle them according to your internal handoff process, and avoid re-importing large files before support has reviewed any mistakes.",
      },
      {
        question: "Can I archive an entity?",
        answer: "Child entities can be archived when they are no longer active. Archiving hides the child entity from normal active selectors and lists, but it does not delete historical roles, candidates, members, reports, billing, or agreements. Archived entity names may still appear on historical records. Contact support if an archived child entity needs to be restored.",
      },
      {
        question: "How do team members get access to entities?",
        answer: "Use the Members page to assign Managers or Members to the parent client or specific child entities. Entity management is handled on the Entities page, but member assignment is handled separately on the Members page. If member access looks wrong after an import, verify the entity assignment and role first, then contact support if it still does not look right.",
      },
    ],
  },
  {
    title: "Roles",
    items: [
      {
        question: "How do I create a role?",
        answer: "Go to Roles, choose Create Role, and enter the role details requested by the form. The better the role description and requirements, the stronger the screening interview structure and report quality will be.",
      },
      {
        question: "What information should I include in a role?",
        answer: "Include the role title, location or work setting if relevant, key responsibilities, required qualifications, preferred experience, schedule expectations, and any role-specific context candidates should know.",
      },
      {
        question: "Can I edit a role after it is created?",
        answer: "If role editing is available in your dashboard, use it carefully. Changes may affect future candidates. Avoid changing core requirements after candidates have already started screening interviews unless your hiring team understands the impact.",
      },
      {
        question: "What happens when a role reaches its screening interview capacity?",
        answer: "Candidate access may be limited until additional screening interview capacity is available or the role/client plan is updated. If a candidate cannot start because of capacity, check billing, role settings, or contact support.",
      },
    ],
  },
  {
    title: "Interview types, membership, and warm-up",
    items: [...RUBRIC_FAQ],
  },
  {
    title: "Candidates",
    items: [
      {
        question: "How do candidates start a screening interview?",
        answer: "Candidates use the screening interview link or flow provided for the role. They submit their information, verify access when prompted, and then start the AI screening interview.",
      },
      {
        question: "What verification choices are available to candidates?",
        answer: "Email verification is available for interview access. When Text Message is offered for an eligible U.S. mobile number, the candidate may choose it and review the consent disclosure before requesting a code. Text-message consent is optional, and Email remains available as the fallback.",
      },
      {
        question: "What if a candidate says they did not receive a one-time code?",
        answer: "For Email, ask the candidate to check spam or junk, confirm the address, and use the available resend option. For Text Message, confirm the displayed destination is correct and let the candidate choose Email if delivery cannot be confirmed. If the issue continues, contact support with the candidate name, email, role, approximate time, and selected delivery method.",
      },
      {
        question: "Can a candidate retake a screening interview?",
        answer: "Retakes should be handled carefully and consistently. If your dashboard supports retakes or re-invites, follow your company's policy. If not, contact support.",
      },
      {
        question: "What should candidates know before a screening interview?",
        answer: "Candidates should be in a quiet place, use a stable internet connection, allow camera and microphone permissions, and answer naturally. They should not rely on outside help during the screening interview.",
      },
    ],
  },
  {
    title: "Candidate automation",
    items: [
      {
        question: "What does Candidate Automation do?",
        answer: "Candidate Automation helps your team identify candidates who match configured criteria and prepare review items or next-step workflow actions for authorized users. It organizes candidates for client admin review and does not make final hiring decisions.",
      },
      {
        question: "Does automation email candidates before approval?",
        answer: "Candidate-facing scheduling emails or next-step communications remain governed by the configured review and approval workflow. Reviewers receive a Review Candidates link, and candidate outreach occurs only through the applicable approved workflow.",
      },
      {
        question: "What happens when we approve, reject, or do not approve a candidate?",
        answer: "Approving a candidate may send or prepare the configured scheduling link according to the workflow settings. Rejecting a candidate or leaving them unapproved does not approve candidate-facing outreach.",
      },
      {
        question: "Where does the scheduling link come from?",
        answer: "The scheduling link comes from the Automation page configuration for that role. Client admins can use the standard configuration controls for thresholds, reviewers, digest schedule, and scheduling link where available.",
      },
      {
        question: "What if an automation rule needs correction?",
        answer: "If a rule was created incorrectly or criteria need refinement, contact support. The alphaSource team can help update, pause, or remove a problematic rule when deeper corrections are needed.",
      },
    ],
  },
  {
    title: "Interviews",
    items: [
      {
        question: "What does the AI interviewer do?",
        answer: "The AI interviewer asks structured questions for the role, keeps the screening interview on track, and collects responses for review. The goal is consistency, not replacing the hiring manager.",
      },
      {
        question: "What if the candidate has technical issues during the screening interview?",
        answer: "Ask the candidate to refresh, check camera and microphone permissions, confirm internet stability, and try again if appropriate. If the issue continues, contact support with the candidate, role, screening interview time, and any error message.",
      },
      {
        question: "What if the screening interview ends early?",
        answer: "Review the candidate record to see whether a transcript or report was generated. If the screening interview did not complete or the report is missing, contact support.",
      },
      {
        question: "What if the candidate asks a question the AI cannot answer?",
        answer: "The interviewer is designed to answer from the available role and company information. Questions outside that information may be recorded for the hiring manager.",
      },
    ],
  },
  {
    title: "Reports and scoring",
    items: [
      {
        question: "What does the candidate report include?",
        answer: "Reports may include resume analysis, screening interview analysis, transcript-based scoring, perception-related signals, summary notes, and structured recommendations for review.",
      },
      {
        question: "What do the scores mean?",
        answer: "Scores are decision-support signals. They help your team compare candidate responses more consistently, but they should be reviewed alongside the resume, screening interview context, role requirements, and your hiring judgment.",
      },
      {
        question: "Does alphaScreen automatically reject candidates?",
        answer: "No. alphaScreen provides structured information. Your hiring team makes the decision.",
      },
      {
        question: "What should I do if a report seems incomplete?",
        answer: "Check whether the screening interview completed recently. Reports may take a short time to process. If the report remains incomplete, contact support with the candidate name, role, and screening interview time.",
      },
      {
        question: "Can I download or share reports?",
        answer: "If your dashboard includes PDF or report-sharing functionality, use it according to your company's privacy and hiring policies. Do not share candidate data with people who do not need access.",
      },
    ],
  },
  {
    title: "Billing and capacity",
    items: [
      {
        question: "Where do I see my plan or membership status?",
        answer: "Use the Billing or Account area of the dashboard if available. It may show your current plan, role capacity, screening interview usage, and available options.",
      },
      {
        question: "What happens if we need more screening interviews?",
        answer: "Depending on your plan, you may be able to purchase additional screening interview capacity or update your membership. If you do not see the option you need, contact support.",
      },
      {
        question: "Why can't a candidate start even though the role is active?",
        answer: "The most common reasons are verification issues, role capacity, billing status, duplicate candidate records, or technical issues. Check the role, candidate record, and billing status first.",
      },
    ],
  },
  {
    title: "Team members and permissions",
    items: [
      {
        question: "How do I add or remove team members?",
        answer: "Use the Members or Account area if available. Only give access to users who need it. If you need help changing access, contact support.",
      },
      {
        question: "What is the difference between an admin and a client member?",
        answer: "Admin users generally manage broader client, billing, and system settings. Client members usually access roles, candidates, and reports for their organization. Exact permissions may vary by account configuration.",
      },
    ],
  },
  {
    title: "Best practices",
    items: [
      {
        question: "How do we get better candidate reports?",
        answer: "Start with a clear role description, use consistent requirements, avoid vague qualifications, and make sure candidates understand the screening interview expectations.",
      },
      {
        question: "How should hiring managers use alphaScreen?",
        answer: "Use alphaScreen to reduce manual screening time and create a more consistent first look at candidates. Review the reports, but do not rely on any single score by itself.",
      },
      {
        question: "What should we avoid?",
        answer: "Avoid using alphaScreen as the only decision point. Avoid changing role criteria mid-process. Avoid sharing candidate reports outside the hiring team. Avoid comparing candidates without considering the full role context.",
      },
    ],
  },
  {
    title: "Getting help",
    items: [
      {
        question: "How do I contact support?",
        answer: "Contact alphaSource support through the support process provided to your organization. Include the role, candidate, email address, and a short description of the issue.",
      },
      {
        question: "What information should I include when reporting a problem?",
        answer: "Include your company name, role name, candidate name and email if relevant, approximate time of the issue, what the user was trying to do, and any error message. For entity import mistakes, include the CSV filename, affected entity names, and whether member assignments were created.",
      },
      {
        question: "When should I contact support before trying again?",
        answer: "Contact support before re-importing large entity files, when an archived entity needs restoration, when automation criteria need correction, or when member assignment problems remain after you have checked the selected entity and role.",
      },
      {
        question: "What happens after I leave a support message?",
        answer: "The support team will review the message and follow up. If the issue is urgent, include that clearly in your message.",
      },
    ],
  },
];

export interface SupportGuidanceCard {
  title: string;
  body: string;
  href?: string;
  linkLabel?: string;
}

export const guidanceCards: SupportGuidanceCard[] = [
  {
    title: "Getting started",
    body: "Confirm your profile, team access, billing status, and active roles before sending candidates into the screening interview flow.",
  },
  {
    title: "Roles, candidates, and entities",
    body: "Create clear role requirements, invite candidates consistently, and use entity filters to review records from the correct parent or child entity scope.",
  },
  {
    title: "Automation and approvals",
    body: "Use Candidate Automation to gather matching candidates for client admin review through configured approval and next-step workflow controls.",
  },
  {
    title: "Reports and scoring",
    body: "Use reports and scores as structured decision-support signals alongside the resume, screening interview context, role requirements, and hiring judgment.",
  },
  {
    title: "Billing, capacity, and team access",
    body: "Review membership status, screening interview capacity, and team permissions so the right users can support the hiring workflow.",
  },
  {
    title: "Profile and account security",
    body: "Use Profile & security to update your identity, choose an appearance mode, manage passkeys, or request a password reset.",
    href: "/dashboard/profile",
    linkLabel: "Open profile & security",
  },
];

export const dataPracticeSections = [
  {
    title: "Data Retention and Deletion",
    body: "alphaSource generally retains client, candidate, hiring workflow, media, report, operational, billing, and account records only as needed to provide and support the service, maintain security and auditability, administer client accounts, comply with legal or contractual obligations, resolve disputes, and preserve business records where appropriate.",
    bullets: [
      "Candidate, screening interview media, transcripts, analysis, reports, and related hiring records are handled under alphaSource's retention and deletion procedures.",
      "Retention periods may vary based on client agreement, service configuration, legal requirements, operational needs, security needs, backup lifecycle, dispute preservation, and account administration.",
      "Billing, agreement, tax, payment, and account records may be retained where needed for legal, accounting, contractual, or business recordkeeping purposes.",
      "Operational, audit, access, delivery, diagnostic, and security logs may be retained as needed for security, reliability, troubleshooting, auditability, abuse prevention, and compliance support.",
      "Clients may request deletion or export of eligible records through support or the agreed administrative process.",
      "Deletion and export requests are reviewed for authorization, scope, legal or contractual exceptions, security obligations, backup lifecycle, and operational feasibility.",
      "Some information may be retained where required or appropriate for legal, contractual, financial, backup, security, abuse-prevention, or dispute-related reasons.",
      "Deleted data may persist for a period in backups or disaster recovery systems until normal backup lifecycle processes complete.",
    ],
  },
  {
    title: "Incident Response and Client Notification",
    body: "alphaSource maintains incident response procedures for identifying, escalating, investigating, containing, remediating, and reviewing suspected security or privacy incidents.",
    bullets: [
      "Incidents are assessed based on severity, affected systems, data involved, client impact, legal or contractual obligations, and remediation needs.",
      "Where alphaSource confirms an incident that materially affects client or candidate data, affected clients are notified as appropriate and in accordance with applicable legal, contractual, and operational requirements.",
      "Notice timing and content may vary based on investigation status, scope, legal requirements, security considerations, and available facts.",
      "Communications may include relevant information about affected systems or data categories, mitigation steps, recommended client actions, and support contact information where appropriate.",
      "Details may be limited during an active investigation or where disclosure could increase security risk.",
      "For security or privacy questions, contact support at the designated alphaSource support channel.",
    ],
  },
];

export const productUpdates = [
  {
    version: "alphaScreen v2.0",
    title: "Profile and Passkey Security",
    summary: "Added a focused client profile area with optional passwordless sign-in.",
    bullets: [
      "Profile & security is available from the account menu in the upper-right corner",
      "Client users can update their name and verified email",
      "Passkeys can use supported device unlock methods or security keys",
      "Password sign-in remains available as a fallback",
    ],
  },
  {
    version: "alphaScreen v1.9",
    title: "Optional Text-Message Verification",
    summary: "Expanded candidate interview-access verification while preserving Email as the default alternative.",
    bullets: [
      "Eligible candidates may choose Email or Text Message when both options are offered",
      "Text-message consent is optional and shown before a code is requested",
      "Email remains available when text delivery cannot be confirmed",
      "Clearer resend and recovery guidance keeps candidates in the same interview flow",
    ],
  },
  {
    version: "alphaScreen v1.8",
    title: "Dashboard and Support Refresh",
    summary: "Refreshed the client workspace and expanded guided support access.",
    bullets: [
      "Updated Overview and dashboard navigation for clearer day-to-day work",
      "Talk with Support remains available without leaving the client workspace",
      "The dashboard tour remains available from the sidebar quick guide",
      "Public phone and email support guidance is easier to find",
    ],
  },
  {
    version: "alphaScreen v1.7",
    title: "Entity Import and Archive Support",
    summary: "Expanded client entity tools and support guidance for multi-location teams.",
    bullets: [
      "Entities page supports CSV import for child entities and direct member assignments",
      "Imported members are not emailed automatically",
      "Temporary credentials appear only in import results and should be handled securely",
      "Child entities can be archived without deleting historical records",
    ],
  },
  {
    version: "alphaScreen v1.6",
    title: "Candidate Automation and Entity Filtering",
    summary: "Added client admin approval workflow guidance and clearer organization filtering support.",
    bullets: [
      "Candidate Automation gathers threshold-matching candidates for review",
      "Review Candidates digest link supports controlled approval before candidate outreach",
      "Roles, Candidates, and Members include parent/client-name, all-entity, and specific-entity filtering",
      "Members filtering clarifies direct assignments by selected entity",
    ],
  },
  {
    version: "alphaScreen v1.5",
    title: "Dashboard Appearance and Support",
    summary: "Added dashboard appearance options and expanded client support guidance.",
    bullets: [
      "Light, Dark, and System appearance modes",
      "Appearance preference persists in the dashboard",
      "Improved readability across client dashboard surfaces",
      "Support navigation added inside the client portal",
      "Product Updates added to the client Support page",
    ],
  },
  {
    version: "alphaScreen v1.4",
    title: "Organization Scope Support",
    summary: "Added support for larger organizations with multiple operating scopes.",
    bullets: [
      "Parent client and child entity support",
      "Clearer selected client/entity dashboard context",
      "Entity-aware roles, candidates, and reports",
      "Scoped team access by organization area",
    ],
  },
  {
    version: "alphaScreen v1.3",
    title: "Role Lifecycle and Screening Interview Records",
    summary: "Added stronger role lifecycle controls and authorized screening interview record access.",
    bullets: [
      "Role close and reopen controls",
      "Clear inactive-role indicators",
      "Authorized screening interview record access where available",
      "Clearer availability and retention messaging",
    ],
  },
  {
    version: "alphaScreen v1.2",
    title: "Membership and Capacity Workflows",
    summary: "Added account, membership, and screening interview capacity workflow support.",
    bullets: [
      "Membership and agreement guidance",
      "Billing visibility for authorized users",
      "Additional screening interview capacity workflow",
      "Improved account and team access management",
    ],
  },
  {
    version: "alphaScreen v1.1",
    title: "Candidate Review Improvements",
    summary: "Improved candidate review clarity and dashboard usability.",
    bullets: [
      "Improved candidate list usability",
      "Expanded candidate detail review",
      "Clearer score and status presentation",
      "Better filtering, search, and report access",
    ],
  },
  {
    version: "alphaScreen v1.0",
    title: "Core Screening Platform",
    summary: "Initial client dashboard platform for structured candidate screening.",
    bullets: [
      "Role setup and candidate invitations",
      "Structured screening interview workflow",
      "Resume and screening interview review support",
      "Candidate dashboard and report review tools",
    ],
  },
];
