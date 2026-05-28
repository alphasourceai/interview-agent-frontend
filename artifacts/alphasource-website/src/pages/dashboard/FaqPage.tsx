import DashboardLayout from "@/components/DashboardLayout";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const faqSections = [
  {
    title: "Getting started",
    items: [
      {
        question: "What is alphaScreen?",
        answer: "alphaScreen is an AI-powered screening platform that helps your team create roles, invite candidates, conduct structured AI interviews, and review candidate reports in one dashboard.",
      },
      {
        question: "What should I do first?",
        answer: "Start by confirming your client profile, team access, billing status, and active roles. Then create or review a role before sending candidates into the interview flow.",
      },
      {
        question: "Who should have dashboard access?",
        answer: "Give access only to team members who need to manage roles, review candidates, view reports, or support the hiring process. Keep access limited to the right people.",
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
        answer: "Child entities are operational scopes under the parent client, such as offices, locations, branches, companies, employers, or contractors. They help your team organize roles, candidates, interviews, and reports by the part of the organization doing the hiring.",
      },
      {
        question: "Who can see or manage entities?",
        answer: "Super Admins can see the parent client and its child entities. Managers and Members see only the scopes assigned to them. Super Admins can add child entities and edit child entity names and labels from the Entities page.",
      },
      {
        question: "Where do roles, candidates, interviews, and reports belong?",
        answer: "Roles, candidates, interviews, and reports belong to the selected client or entity scope. Use the client selector to choose the parent client or child entity before managing roles or reviewing candidates.",
      },
      {
        question: "Can I delete or archive an entity?",
        answer: "No. Entity delete and archive actions are not available yet. If an entity was created by mistake or needs to be removed, contact alphaSource support.",
      },
      {
        question: "How do team members get access to entities?",
        answer: "Use the Members page to assign Managers or Members to the parent client or specific child entities. Entity management is handled on the Entities page, but member assignment is handled separately on the Members page.",
      },
    ],
  },
  {
    title: "Roles",
    items: [
      {
        question: "How do I create a role?",
        answer: "Go to Roles, choose Create Role, and enter the role details requested by the form. The better the role description and requirements, the stronger the interview structure and report quality will be.",
      },
      {
        question: "What information should I include in a role?",
        answer: "Include the role title, location or work setting if relevant, key responsibilities, required qualifications, preferred experience, schedule expectations, and any role-specific context candidates should know.",
      },
      {
        question: "Can I edit a role after it is created?",
        answer: "If role editing is available in your dashboard, use it carefully. Changes may affect future candidates. Avoid changing core requirements after candidates have already started interviewing unless your hiring team understands the impact.",
      },
      {
        question: "What happens when a role reaches its interview capacity?",
        answer: "Candidate access may be limited until additional interview capacity is available or the role/client plan is updated. If a candidate cannot start because of capacity, check billing, role settings, or contact support.",
      },
    ],
  },
  {
    title: "Candidates",
    items: [
      {
        question: "How do candidates start an interview?",
        answer: "Candidates use the interview link or flow provided for the role. They submit their information, verify access when prompted, and then start the AI interview.",
      },
      {
        question: "What if a candidate says they did not receive an OTP or verification email?",
        answer: "Ask them to check spam or junk first. If they still cannot access the interview, verify the email address and try the available resend or support process. If the issue continues, contact support with the candidate name, email, and role.",
      },
      {
        question: "Can a candidate retake an interview?",
        answer: "Retakes should be handled carefully and consistently. If your dashboard supports retakes or re-invites, follow your company's policy. If not, contact support.",
      },
      {
        question: "What should candidates know before interviewing?",
        answer: "Candidates should be in a quiet place, use a stable internet connection, allow camera and microphone permissions, and answer naturally. They should not rely on outside help during the interview.",
      },
    ],
  },
  {
    title: "Interviews",
    items: [
      {
        question: "What does the AI interviewer do?",
        answer: "The AI interviewer asks structured questions for the role, keeps the interview on track, and collects responses for review. The goal is consistency, not replacing the hiring manager.",
      },
      {
        question: "What if the candidate has technical issues during the interview?",
        answer: "Ask the candidate to refresh, check camera and microphone permissions, confirm internet stability, and try again if appropriate. If the issue continues, contact support with the candidate, role, time of issue, and any error message.",
      },
      {
        question: "What if the interview ends early?",
        answer: "Review the candidate record to see whether a transcript or report was generated. If the interview did not complete or the report is missing, contact support.",
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
        answer: "Reports may include resume analysis, interview analysis, transcript-based scoring, perception-related signals, summary notes, and structured recommendations for review.",
      },
      {
        question: "What do the scores mean?",
        answer: "Scores are decision-support signals. They help your team compare candidate responses more consistently, but they should be reviewed alongside the resume, interview context, role requirements, and your hiring judgment.",
      },
      {
        question: "Does alphaScreen automatically reject candidates?",
        answer: "No. alphaScreen provides structured information. Your hiring team makes the decision.",
      },
      {
        question: "What should I do if a report seems incomplete?",
        answer: "Check whether the interview completed recently. Reports may take a short time to process. If the report remains incomplete, contact support with the candidate name, role, and interview time.",
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
        answer: "Use the Billing or Account area of the dashboard if available. It may show your current plan, role capacity, interview usage, and available options.",
      },
      {
        question: "What happens if we need more interviews?",
        answer: "Depending on your plan, you may be able to purchase additional interview capacity or update your membership. If you do not see the option you need, contact support.",
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
        answer: "Start with a clear role description, use consistent requirements, avoid vague qualifications, and make sure candidates understand the interview expectations.",
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
        answer: "Contact alphaSource at info@alphasourceai.com. Include the role, candidate, email address, and a short description of the issue.",
      },
      {
        question: "What information should I include when reporting a problem?",
        answer: "Include your company name, role name, candidate name and email if relevant, approximate time of the issue, what the user was trying to do, and any error message.",
      },
      {
        question: "What happens after I leave a support message?",
        answer: "The support team will review the message and follow up. If the issue is urgent, include that clearly in your message.",
      },
    ],
  },
];

const guidanceCards = [
  {
    title: "Getting started",
    body: "Confirm your profile, team access, billing status, and active roles before sending candidates into the interview flow.",
  },
  {
    title: "Roles and candidates",
    body: "Create clear role requirements, invite candidates consistently, and review candidate details from the selected client or entity scope.",
  },
  {
    title: "Reports and scoring",
    body: "Use reports and scores as structured decision-support signals alongside the resume, interview context, role requirements, and hiring judgment.",
  },
  {
    title: "Billing, capacity, and team access",
    body: "Review membership status, interview capacity, and team permissions so the right users can support the hiring workflow.",
  },
];

const productUpdates = [
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
    title: "Role Lifecycle and Interview Records",
    summary: "Added stronger role lifecycle controls and authorized interview record access.",
    bullets: [
      "Role close and reopen controls",
      "Clear inactive-role indicators",
      "Authorized interview record access where available",
      "Clearer availability and retention messaging",
    ],
  },
  {
    version: "alphaScreen v1.2",
    title: "Membership and Capacity Workflows",
    summary: "Added account, membership, and interview-capacity workflow support.",
    bullets: [
      "Membership and agreement guidance",
      "Billing visibility for authorized users",
      "Additional interview capacity workflow",
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
      "Structured interview workflow",
      "Resume and interview review support",
      "Candidate dashboard and report review tools",
    ],
  },
];

const surfaceCardStyle = {
  backgroundColor: "var(--as-surface)",
  border: "1px solid var(--as-border)",
  boxShadow: "var(--as-shadow)",
};

const mutedPanelStyle = {
  backgroundColor: "var(--as-surface-muted)",
  borderColor: "var(--as-border)",
};

const primaryTextStyle = { color: "var(--as-text)" };
const mutedTextStyle = { color: "var(--as-text)", opacity: 0.65 };
const subtleTextStyle = { color: "var(--as-text-subtle)" };

export default function DashboardFaqPage() {
  return (
    <DashboardLayout title="Support">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-7">
        <div className="max-w-3xl">
          <p className="text-[10px] font-black uppercase tracking-widest text-[#0A1547]/35 mb-1" style={{ color: "var(--as-text)", opacity: 0.35 }}>
            Client Support
          </p>
          <h2 className="text-2xl font-black text-[#0A1547] leading-tight mb-3" style={{ color: "var(--as-text)" }}>
            Support
          </h2>
          <p className="text-sm text-[#0A1547]/60 leading-relaxed" style={{ color: "var(--as-text)", opacity: 0.6 }}>
            Practical alphaScreen guidance for managing roles, candidates, reports, membership workflows, and team access inside the client dashboard.
          </p>
        </div>
      </div>

      <div
        className="rounded-2xl p-4 mb-5"
        style={{ backgroundColor: "rgba(163,128,246,0.10)", border: "1px solid rgba(163,128,246,0.20)" }}
      >
        <p className="text-sm font-semibold text-[#0A1547]/70 leading-relaxed" style={{ color: "var(--as-text)", opacity: 0.7 }}>
          alphaScreen supports your hiring process with structured screening and interview insight. It does not replace your hiring judgment or make final employment decisions.
        </p>
      </div>

      <section
        className="rounded-2xl p-6 mb-5"
        style={surfaceCardStyle}
      >
        <div className="flex flex-col gap-1 mb-5">
          <p className="text-[10px] font-black uppercase tracking-widest" style={subtleTextStyle}>
            Support Guide
          </p>
          <h3 className="text-base font-black" style={primaryTextStyle}>Quick guidance</h3>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {guidanceCards.map((card) => (
            <div
              key={card.title}
              className="rounded-xl border p-4"
              style={mutedPanelStyle}
            >
              <h4 className="text-sm font-black mb-2" style={primaryTextStyle}>{card.title}</h4>
              <p className="text-xs leading-relaxed" style={mutedTextStyle}>{card.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section
        className="rounded-2xl p-6 mb-5"
        style={surfaceCardStyle}
      >
        <div className="flex flex-col gap-1 mb-5">
          <p className="text-[10px] font-black uppercase tracking-widest" style={subtleTextStyle}>
            Product Updates
          </p>
          <h3 className="text-base font-black" style={primaryTextStyle}>alphaScreen updates</h3>
          <p className="text-sm leading-relaxed" style={mutedTextStyle}>
            Client-facing highlights from recent alphaScreen releases.
          </p>
        </div>
        <div className="grid gap-3">
          {productUpdates.map((update) => (
            <article
              key={update.version}
              className="rounded-xl border p-4"
              style={mutedPanelStyle}
            >
              <h4 className="text-sm font-black mb-2" style={primaryTextStyle}>
                {update.version} — {update.title}
              </h4>
              <p className="text-xs leading-relaxed mb-3" style={mutedTextStyle}>
                {update.summary}
              </p>
              <ul className="grid gap-1.5 md:grid-cols-2">
                {update.bullets.map((bullet) => (
                  <li key={bullet} className="text-xs leading-relaxed" style={mutedTextStyle}>
                    • {bullet}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <div className="mb-5">
        <p className="text-[10px] font-black uppercase tracking-widest mb-1" style={subtleTextStyle}>
          Help Center
        </p>
        <h3 className="text-base font-black" style={primaryTextStyle}>Common questions</h3>
      </div>

      <div className="grid gap-5">
        {faqSections.map((section) => (
          <section
            key={section.title}
            className="rounded-2xl p-6"
            style={surfaceCardStyle}
          >
            <h3 className="text-base font-black mb-4" style={primaryTextStyle}>{section.title}</h3>
            <Accordion type="single" collapsible className="space-y-2">
              {section.items.map((item) => (
                <AccordionItem
                  key={item.question}
                  value={item.question}
                  className="rounded-xl border px-4"
                  style={mutedPanelStyle}
                >
                  <AccordionTrigger className="py-4 text-sm font-bold hover:no-underline" style={primaryTextStyle}>
                    {item.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-sm leading-relaxed" style={mutedTextStyle}>
                    {item.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </section>
        ))}
      </div>
    </DashboardLayout>
  );
}
