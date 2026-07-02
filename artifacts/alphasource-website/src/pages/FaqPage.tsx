import { motion } from "framer-motion";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { PUBLIC_CONTENT_LAST_UPDATED, publicFaqSections } from "@/lib/publicContent";

const EASE_OUT = "easeOut" as const;

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.5, ease: EASE_OUT },
  }),
};

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
  const resourceLinks = [
    { label: "Explore alphaScreen", href: "/alphascreen" },
    { label: "Compare memberships", href: "/alphascreen/pricing" },
    { label: "How alphaScreen works", href: "/alphascreen/how-it-works" },
    { label: "Security and data", href: "/alphascreen/security" },
    { label: "Candidate experience", href: "/alphascreen/candidate-experience" },
    { label: "ROI estimator", href: "/alphascreen/roi" },
    { label: "Read the Privacy Policy", href: "/privacy" },
    { label: "Request a demo", href: "/#contact" },
  ];

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
              FAQ
            </div>
            <h1 className="text-4xl lg:text-5xl font-black text-[#0A1547] leading-tight mb-4">
              FAQ and Support
            </h1>
            <p className="text-base lg:text-lg text-[#0A1547]/60 leading-relaxed max-w-3xl">
              Direct answers, product guidance, and public release notes for alphaSource AI products, starting with alphaScreen.
            </p>
            <p className="mt-4 text-sm font-semibold text-[#0A1547]/45">
              Last updated {PUBLIC_CONTENT_LAST_UPDATED}
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
                alphaScreen FAQ
              </p>
              <h2 className="text-2xl font-black text-[#0A1547] mb-3">
                Answers for structured candidate screening
              </h2>
              <p className="text-sm text-[#0A1547]/65 leading-relaxed">
                Use this hub to understand alphaScreen, compare membership options, review candidate workflow basics, and find the public privacy and contact links that support the buying process.
              </p>
            </div>
            <div className="rounded-2xl border border-[#A380F6]/20 bg-[#F8F9FD] p-5">
              <h3 className="text-sm font-black text-[#0A1547] mb-3">Related public pages</h3>
              <div className="grid gap-2">
                {resourceLinks.map((link) => (
                  <a
                    key={link.href}
                    href={link.href}
                    className="rounded-lg border border-[#0A1547]/8 bg-white px-3 py-2 text-sm font-black text-[#0A1547]/70 transition-colors hover:border-[#A380F6]/45 hover:text-[#A380F6]"
                    data-analytics-cta={link.label}
                    data-analytics-placement="faq-resource-links"
                  >
                    {link.label}
                  </a>
                ))}
              </div>
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
            <h2 className="text-2xl font-black text-[#0A1547] mb-3">Public alphaScreen FAQ</h2>
            <p className="text-sm text-[#0A1547]/60 leading-relaxed max-w-3xl">
              Short, extractable answers about alphaScreen, candidate review, memberships, security, and human decision control.
            </p>
          </div>
          <div className="space-y-9">
            {publicFaqSections.map((section, sectionIndex) => (
              <section
                key={section.title}
                className={sectionIndex === publicFaqSections.length - 1 ? "" : "pb-9 border-b border-gray-100"}
              >
                <h3 className="text-lg font-black text-[#0A1547] mb-4">{section.title}</h3>
                <p className="mb-4 text-sm leading-relaxed text-[#0A1547]/55">{section.intro}</p>
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
              Explore recent alphaScreen updates that help teams manage roles, review candidates, and keep their screening workflow organized as the platform evolves.
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
