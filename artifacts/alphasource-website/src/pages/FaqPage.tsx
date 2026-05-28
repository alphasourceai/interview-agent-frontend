import { motion } from "framer-motion";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const EASE_OUT = "easeOut" as const;

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.5, ease: EASE_OUT },
  }),
};

const faqSections = [
  {
    title: "About alphaSource",
    items: [
      {
        question: "What does alphaSource do?",
        answer: "alphaSource builds practical AI tools and custom AI workflows for companies that want to reduce repetitive work, improve decision-making, and give their teams more time for the work only people can do.",
      },
      {
        question: "Are you only a hiring technology company?",
        answer: "No. alphaScreen is one of our core products, but alphaSource is broader than hiring. We build AI-powered solutions for screening, operations, analysis, reporting, workflow support, and custom business needs.",
      },
      {
        question: "What makes alphaSource different?",
        answer: "We build from real operational experience. Our goal is not to replace human judgment. It is to organize the work, surface better signal, and help leaders act with more confidence.",
      },
      {
        question: "What industries do you serve?",
        answer: "We started with deep experience in dental operations and people-driven businesses, but our AI tools can be adapted for companies that need better workflows, stronger insight, and less manual effort.",
      },
      {
        question: "Do you build custom AI tools?",
        answer: "Yes. We work with companies to understand their process, identify where time is being wasted, and build AI tools that fit the way their team actually works.",
      },
    ],
  },
  {
    title: "Products and services",
    items: [
      {
        question: "What is alphaScreen?",
        answer: "alphaScreen is an AI-powered interview and candidate screening platform. It helps teams create roles, screen candidates consistently, capture structured interview insights, and give hiring managers more time to focus on the best-fit candidates.",
      },
      {
        question: "Does alphaScreen make hiring decisions?",
        answer: "No. alphaScreen supports the hiring process with structured information and consistent screening. Final hiring decisions remain with the employer.",
      },
      {
        question: "Do you offer consulting?",
        answer: "Yes. Our sister company, alphaSource Consulting, provides consulting specifically for dental companies. Visit www.alphasourceconsulting.com to learn more.",
      },
    ],
  },
  {
    title: "Working with alphaSource",
    items: [
      {
        question: "How does a custom AI project start?",
        answer: "It usually starts with a conversation. We learn where your team is losing time, what decisions need better information, and what workflows could be improved with AI.",
      },
      {
        question: "Do we need to know exactly what we want built?",
        answer: "No. Many clients know the problem before they know the solution. We can help define the opportunity, shape the workflow, and decide what kind of AI tool makes sense.",
      },
      {
        question: "How long does a rollout take?",
        answer: "It depends on the complexity of the workflow, the information involved, and the level of customization needed. Smaller tools can move quickly. Larger systems require more planning, testing, and rollout support.",
      },
      {
        question: "Can alphaSource connect with our current tools?",
        answer: "Often, yes. The best approach depends on the tools your team uses, the access available, permissions, and security requirements. We evaluate this during discovery.",
      },
      {
        question: "How do you handle privacy and sensitive information?",
        answer: "We design AI workflows with privacy, security, and appropriate access controls in mind. The exact approach depends on the project, the information involved, and the systems involved.",
      },
    ],
  },
  {
    title: "Getting started",
    items: [
      {
        question: "How do we contact alphaSource?",
        answer: "You can use the contact form on the website or email info@alphasourceai.com.",
      },
      {
        question: "Can we request a demo?",
        answer: "Yes. Use the request demo or contact form and tell us what you are interested in. We will follow up to understand your needs and recommend the right next step.",
      },
      {
        question: "What should we include in our message?",
        answer: "Tell us what kind of problem you are trying to solve, what team or workflow it affects, and whether you are interested in alphaScreen, consulting, analysis tools, or a custom AI solution.",
      },
    ],
  },
];

const releaseNotes = [
  {
    version: "alphaScreen v1.5",
    name: "Dashboard Appearance Modes",
    summary: "Added dashboard appearance options and improved support navigation.",
    bullets: [
      "Light, Dark, and System appearance modes",
      "Appearance preference persists in the dashboard",
      "Improved readability across dashboard surfaces",
      "Public Support hub introduced for product guidance and release notes",
    ],
  },
  {
    version: "alphaScreen v1.4",
    name: "Enterprise Organization Support",
    summary: "Added support for larger organizations with multiple operating scopes.",
    bullets: [
      "Parent client and child entity organization",
      "Entity-aware role and candidate review",
      "Scoped team access by organization area",
      "Clearer dashboard context for selected client/entity",
    ],
  },
  {
    version: "alphaScreen v1.3",
    name: "Role Management and Interview Records",
    summary: "Added stronger role lifecycle controls and authorized interview record access.",
    bullets: [
      "Role close and reopen controls",
      "Clear inactive-role indicators",
      "Authorized access to interview records where available",
      "Clearer retention and availability messaging",
    ],
  },
  {
    version: "alphaScreen v1.2",
    name: "Membership and Billing Workflow",
    summary: "Added structured account access and membership workflow support.",
    bullets: [
      "Membership and agreement support",
      "Billing visibility for authorized users",
      "Additional interview capacity workflow",
      "Improved account and team access management",
    ],
  },
  {
    version: "alphaScreen v1.1",
    name: "Candidate Review Improvements",
    summary: "Improved candidate review clarity and dashboard usability.",
    bullets: [
      "Improved candidate list and expanded candidate details",
      "Clearer score and status presentation",
      "Better filtering and search behavior",
      "Improved report access and review flow",
    ],
  },
  {
    version: "alphaScreen v1.0",
    name: "Core Screening Platform",
    summary: "First full platform version for structured candidate screening.",
    bullets: [
      "Role setup and candidate invitation workflows",
      "Structured interview experience",
      "Resume and interview review support",
      "Candidate reporting and dashboard review tools",
    ],
  },
  {
    version: "alphaScreen v0.5",
    name: "Early Access Preview",
    summary: "Early preview used to validate the structured candidate screening workflow.",
    bullets: [
      "Early role and candidate workflow",
      "Candidate interview link experience",
      "Initial AI-assisted candidate review concept",
    ],
  },
];

export default function SupportPage() {
  return (
    <div className="min-h-screen bg-[#F8F9FD]">
      <div className="relative pt-32 pb-16 overflow-hidden">
        <div className="absolute inset-0 gradient-hero-bg" />
        <div className="relative max-w-5xl mx-auto px-6 lg:px-8">
          <motion.div
            initial="hidden"
            animate="visible"
            variants={fadeUp}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-[#A380F6]/30 text-sm font-medium text-[#A380F6] mb-5 shadow-sm">
              Support
            </div>
            <h1 className="text-4xl lg:text-5xl font-black text-[#0A1547] leading-tight mb-4">
              Support
            </h1>
            <p className="text-base lg:text-lg text-[#0A1547]/60 leading-relaxed max-w-3xl">
              Product guidance, common questions, and public release notes for alphaSource products, starting with alphaScreen.
            </p>
          </motion.div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 lg:px-8 pb-24 space-y-8">
        <motion.section
          initial="hidden"
          animate="visible"
          custom={1}
          variants={fadeUp}
          className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 lg:p-8"
          style={{ color: "#0A1547" }}
        >
          <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.24em] text-[#A380F6] mb-3">
                alphaScreen support
              </p>
              <h2 className="text-2xl font-black text-[#0A1547] mb-3">
                Help for structured candidate screening
              </h2>
              <p className="text-sm text-[#0A1547]/65 leading-relaxed">
                Use this hub to understand alphaScreen at a high level, review common questions, and follow customer-facing product updates.
              </p>
            </div>
            <div className="rounded-2xl border border-[#A380F6]/20 bg-[#F8F9FD] p-5">
              <h3 className="text-sm font-black text-[#0A1547] mb-3">Available here</h3>
              <ul className="space-y-2 text-sm text-[#0A1547]/65">
                <li>• Product overview and common questions</li>
                <li>• Public alphaScreen release history</li>
                <li>• Visual examples coming soon</li>
              </ul>
            </div>
          </div>
        </motion.section>

        <motion.section
          initial="hidden"
          animate="visible"
          custom={2}
          variants={fadeUp}
          className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 lg:p-10"
          style={{ color: "#0A1547" }}
        >
          <div className="mb-8">
            <p className="text-xs font-black uppercase tracking-[0.24em] text-[#A380F6] mb-3">
              Common questions
            </p>
            <h2 className="text-2xl font-black text-[#0A1547] mb-3">Public FAQ</h2>
            <p className="text-sm text-[#0A1547]/60 leading-relaxed max-w-3xl">
              Answers to common questions about alphaSource, alphaScreen, and getting started.
            </p>
          </div>
          <div className="space-y-9">
            {faqSections.map((section, sectionIndex) => (
              <section
                key={section.title}
                className={sectionIndex === faqSections.length - 1 ? "" : "pb-9 border-b border-gray-100"}
              >
                <h3 className="text-lg font-black text-[#0A1547] mb-4">{section.title}</h3>
                <Accordion type="single" collapsible className="space-y-2">
                  {section.items.map((item) => (
                    <AccordionItem
                      key={item.question}
                      value={item.question}
                      className="rounded-xl border border-gray-100 bg-[#F8F9FD] px-4"
                    >
                      <AccordionTrigger className="py-4 text-sm font-bold text-[#0A1547] hover:no-underline">
                        {item.question}
                      </AccordionTrigger>
                      <AccordionContent className="text-sm text-[#0A1547]/65 leading-relaxed">
                        {item.answer}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </section>
            ))}
          </div>
        </motion.section>

        <motion.section
          initial="hidden"
          animate="visible"
          custom={3}
          variants={fadeUp}
          className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 lg:p-10"
          style={{ color: "#0A1547" }}
        >
          <div className="mb-8">
            <p className="text-xs font-black uppercase tracking-[0.24em] text-[#A380F6] mb-3">
              alphaScreen release notes
            </p>
            <h2 className="text-2xl font-black text-[#0A1547] mb-3">Public release history</h2>
            <p className="text-sm text-[#0A1547]/60 leading-relaxed max-w-3xl">
              A customer-facing summary of major alphaScreen updates. This history is intentionally high-level and focused on product value.
            </p>
          </div>

          <div className="space-y-4">
            {releaseNotes.map((release) => (
              <article
                key={release.version}
                className="rounded-2xl border border-gray-100 bg-[#F8F9FD] p-5"
              >
                <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between mb-3">
                  <h3 className="text-base font-black text-[#0A1547]">
                    {release.version} — {release.name}
                  </h3>
                </div>
                <p className="text-sm text-[#0A1547]/65 leading-relaxed mb-4">
                  {release.summary}
                </p>
                <ul className="grid gap-2 sm:grid-cols-2 text-sm text-[#0A1547]/65">
                  {release.bullets.map((bullet) => (
                    <li key={bullet}>• {bullet}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </motion.section>
      </div>
    </div>
  );
}
