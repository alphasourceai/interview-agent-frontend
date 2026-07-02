import { motion } from "framer-motion";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { PUBLIC_CONTENT_LAST_UPDATED, publicFaqItems, publicFaqSections } from "@/lib/publicContent";

const EASE_OUT = "easeOut" as const;

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.5, ease: EASE_OUT },
  }),
};

const resourceLinks = [
  { label: "alphaScreen overview", href: "/alphascreen" },
  { label: "Pricing / Get Started", href: "/alphascreen/pricing" },
  { label: "Security overview", href: "/alphascreen/security" },
  { label: "Candidate experience", href: "/alphascreen/candidate-experience" },
  { label: "For dental groups", href: "/alphascreen/for-dental-groups" },
  { label: "Value estimator", href: "/alphascreen/roi" },
  { label: "Support", href: "/support" },
];

export default function FaqPage() {
  return (
    <div className="min-h-screen bg-[#F8F9FD]">
      <section className="relative overflow-hidden pt-32 pb-16">
        <div className="absolute inset-0 gradient-hero-bg" />
        <div className="relative mx-auto max-w-5xl px-6 lg:px-8">
          <motion.div initial="hidden" animate="visible" variants={fadeUp}>
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#A380F6]/30 bg-white px-3 py-1.5 text-sm font-bold text-[#A380F6] shadow-sm">
              alphaScreen FAQ
            </div>
            <h1 className="max-w-4xl text-4xl font-black leading-tight text-[#0A1547] lg:text-5xl">
              alphaScreen frequently asked questions
            </h1>
            <p className="mt-4 max-w-3xl text-base leading-relaxed text-[#0A1547]/65 lg:text-lg">
              Clear answers about alphaScreen memberships, pricing, first-role prepay, candidate links, security, human review, and setup support.
            </p>
            <p className="mt-4 text-sm font-semibold text-[#0A1547]/45">
              Last updated {PUBLIC_CONTENT_LAST_UPDATED}. {publicFaqItems.length} public questions answered.
            </p>
          </motion.div>
        </div>
      </section>

      <main className="mx-auto max-w-5xl px-6 pb-24 lg:px-8">
        <motion.section
          initial="hidden"
          animate="visible"
          custom={1}
          variants={fadeUp}
          className="grid gap-6 rounded-lg border border-gray-100 bg-white p-6 shadow-sm lg:grid-cols-[1.15fr_0.85fr] lg:p-8"
          style={{ color: "#0A1547" }}
        >
          <div>
            <p className="mb-3 text-xs font-black uppercase tracking-[0.24em] text-[#A380F6]">
              Buyer-friendly answers
            </p>
            <h2 className="mb-3 text-2xl font-black text-[#0A1547]">
              What buyers can understand before signup
            </h2>
            <p className="text-sm leading-relaxed text-[#0A1547]/65">
              This FAQ is written for hiring teams evaluating alphaScreen. It avoids guarantees and keeps human hiring decisions, accommodations, and final review with the employer.
            </p>
          </div>
          <nav aria-label="Related alphaScreen pages" className="rounded-lg border border-[#A380F6]/20 bg-[#F8F9FD] p-5">
            <h2 className="mb-3 text-sm font-black text-[#0A1547]">Related public pages</h2>
            <div className="grid gap-2">
              {resourceLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="rounded-md border border-[#0A1547]/8 bg-white px-3 py-2 text-sm font-black text-[#0A1547]/70 transition-colors hover:border-[#A380F6]/45 hover:text-[#A380F6]"
                  data-analytics-cta={link.label}
                  data-analytics-placement="faq-resource-links"
                >
                  {link.label}
                </a>
              ))}
            </div>
          </nav>
        </motion.section>

        <motion.section
          initial="hidden"
          animate="visible"
          custom={2}
          variants={fadeUp}
          className="mt-8 rounded-lg border border-gray-100 bg-white p-6 shadow-sm lg:p-10"
          style={{ color: "#0A1547" }}
        >
          <div className="mb-8">
            <p className="mb-3 text-xs font-black uppercase tracking-[0.24em] text-[#A380F6]">
              Common questions
            </p>
            <h2 className="mb-3 text-2xl font-black text-[#0A1547]">Public alphaScreen FAQ</h2>
            <p className="max-w-3xl text-sm leading-relaxed text-[#0A1547]/60">
              Short, extractable answers for AI search, buyer review, and public alphaScreen education.
            </p>
          </div>

          <div className="space-y-9">
            {publicFaqSections.map((section, sectionIndex) => (
              <section
                key={section.title}
                className={sectionIndex === publicFaqSections.length - 1 ? "" : "border-b border-gray-100 pb-9"}
              >
                <h2 className="mb-3 text-lg font-black text-[#0A1547]">{section.title}</h2>
                <p className="mb-4 text-sm leading-relaxed text-[#0A1547]/55">{section.intro}</p>
                <Accordion type="single" collapsible className="space-y-2">
                  {section.items.map((item) => (
                    <AccordionItem
                      key={item.question}
                      value={item.question}
                      className="rounded-lg border border-gray-100 bg-[#F8F9FD] px-4"
                    >
                      <AccordionTrigger className="py-4 text-left text-sm font-bold text-[#0A1547] hover:no-underline">
                        {item.question}
                      </AccordionTrigger>
                      <AccordionContent className="text-sm leading-relaxed text-[#0A1547]/65">
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
          className="mt-8 rounded-lg border border-[#A380F6]/20 bg-white p-6 shadow-sm lg:p-8"
          style={{ color: "#0A1547" }}
        >
          <h2 className="text-2xl font-black text-[#0A1547]">Need help after purchase?</h2>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-[#0A1547]/65">
            The support page covers account setup, password setup, billing questions, first-role prepay, role creation, candidate links, and agreement or checkout recovery.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <a href="/support" className="rounded-full bg-[#0A1547] px-5 py-3 text-sm font-black text-white">
              Visit support
            </a>
            <a href="/alphascreen/pricing" className="rounded-full border border-[#0A1547]/12 bg-white px-5 py-3 text-sm font-black text-[#0A1547]">
              Compare memberships
            </a>
          </div>
        </motion.section>
      </main>
    </div>
  );
}
