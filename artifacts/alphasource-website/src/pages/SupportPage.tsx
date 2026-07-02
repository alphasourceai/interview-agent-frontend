import { motion } from "framer-motion";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { PUBLIC_CONTENT_LAST_UPDATED, publicSupportQuestions, publicSupportTopics } from "@/lib/publicContent";

const EASE_OUT = "easeOut" as const;

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.5, ease: EASE_OUT },
  }),
};

const supportLinks = [
  { label: "Read FAQ", href: "/faq" },
  { label: "Pricing / Get Started", href: "/alphascreen/pricing" },
  { label: "Security overview", href: "/alphascreen/security" },
  { label: "alphaScreen overview", href: "/alphascreen" },
];

export default function SupportPage() {
  return (
    <div className="min-h-screen bg-[#F8F9FD]">
      <section className="relative overflow-hidden pt-32 pb-16">
        <div className="absolute inset-0 gradient-hero-bg" />
        <div className="relative mx-auto max-w-5xl px-6 lg:px-8">
          <motion.div initial="hidden" animate="visible" variants={fadeUp}>
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#A380F6]/30 bg-white px-3 py-1.5 text-sm font-bold text-[#A380F6] shadow-sm">
              alphaScreen Support
            </div>
            <h1 className="max-w-4xl text-4xl font-black leading-tight text-[#0A1547] lg:text-5xl">
              alphaScreen support and setup help
            </h1>
            <p className="mt-4 max-w-3xl text-base leading-relaxed text-[#0A1547]/65 lg:text-lg">
              Public guidance for setup help, account access, memberships, billing, first-role prepay, role creation, candidate links, agreement recovery, and support contact.
            </p>
            <p className="mt-4 text-sm font-semibold text-[#0A1547]/45">
              Last updated {PUBLIC_CONTENT_LAST_UPDATED}
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
              Contact support
            </p>
            <h2 className="mb-3 text-2xl font-black text-[#0A1547]">
              Include enough context to help support triage
            </h2>
            <p className="text-sm leading-relaxed text-[#0A1547]/65">
              Email <a href="mailto:info@alphasourceai.com" className="font-black text-[#0A1547] underline decoration-[#A380F6]/35 underline-offset-4">info@alphasourceai.com</a> with your company name, buyer email, role name if relevant, and a short description of the issue. Do not send passwords, setup tokens, or private candidate details unless support specifically requests them through an approved channel.
            </p>
          </div>
          <nav aria-label="Support quick links" className="rounded-lg border border-[#A380F6]/20 bg-[#F8F9FD] p-5">
            <h2 className="mb-3 text-sm font-black text-[#0A1547]">Useful public links</h2>
            <div className="grid gap-2">
              {supportLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="rounded-md border border-[#0A1547]/8 bg-white px-3 py-2 text-sm font-black text-[#0A1547]/70 transition-colors hover:border-[#A380F6]/45 hover:text-[#A380F6]"
                  data-analytics-cta={link.label}
                  data-analytics-placement="support-quick-links"
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
              Support areas
            </p>
            <h2 className="mb-3 text-2xl font-black text-[#0A1547]">Where alphaSource can help</h2>
            <p className="max-w-3xl text-sm leading-relaxed text-[#0A1547]/60">
              Use these areas to decide what information to include when asking for help.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {publicSupportTopics.map((topic) => (
              <article key={topic.title} className="rounded-lg border border-gray-100 bg-[#F8F9FD] p-5">
                <h2 className="text-base font-black text-[#0A1547]">{topic.title}</h2>
                <p className="mt-3 text-sm leading-relaxed text-[#0A1547]/65">{topic.body}</p>
                {topic.links?.length ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {topic.links.map((link) => (
                      <a
                        key={link.href}
                        href={link.href}
                        className="rounded-full border border-[#0A1547]/10 bg-white px-3 py-1.5 text-xs font-black text-[#0A1547]/70 transition-colors hover:border-[#A380F6]/45 hover:text-[#A380F6]"
                      >
                        {link.label}
                      </a>
                    ))}
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        </motion.section>

        <motion.section
          initial="hidden"
          animate="visible"
          custom={3}
          variants={fadeUp}
          className="mt-8 rounded-lg border border-gray-100 bg-white p-6 shadow-sm lg:p-10"
          style={{ color: "#0A1547" }}
        >
          <div className="mb-8">
            <p className="mb-3 text-xs font-black uppercase tracking-[0.24em] text-[#A380F6]">
              Support FAQ
            </p>
            <h2 className="mb-3 text-2xl font-black text-[#0A1547]">Common setup and recovery questions</h2>
            <p className="max-w-3xl text-sm leading-relaxed text-[#0A1547]/60">
              These answers are for buyer and account setup support. Product and workflow questions are covered in the main FAQ.
            </p>
          </div>

          <Accordion type="single" collapsible className="space-y-2">
            {publicSupportQuestions.map((item) => (
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
        </motion.section>
      </main>
    </div>
  );
}
