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
        question: "What does alphaSource AI do?",
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
        question: "What is the Dental Operations Analyzer?",
        answer: "The Dental Operations Analyzer is an AI-powered analysis tool designed to help leaders identify trends, performance issues, and opportunities from operational and financial data.",
      },
      {
        question: "Do you offer consulting?",
        answer: "Yes. alphaSource Consulting combines AI-powered insight with hands-on operational experience. We help leaders understand what is happening, why it matters, and what to do next.",
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
        question: "How long does implementation take?",
        answer: "It depends on the complexity of the workflow, the data involved, and the level of customization needed. Smaller tools can move quickly. Larger systems require more planning, testing, and rollout support.",
      },
      {
        question: "Can alphaSource integrate with our existing systems?",
        answer: "Often, yes. Integration depends on the tools you use, available APIs, data access, permissions, and security requirements. We evaluate this during discovery.",
      },
      {
        question: "How do you handle privacy and sensitive data?",
        answer: "We design AI workflows with privacy, security, and appropriate access controls in mind. The exact approach depends on the project, the data involved, and the systems we connect to.",
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

export default function FaqPage() {
  return (
    <div className="min-h-screen bg-[#F8F9FD]">
      <div className="relative pt-32 pb-16 overflow-hidden">
        <div className="absolute inset-0 gradient-hero-bg" />
        <div className="relative max-w-4xl mx-auto px-6 lg:px-8">
          <motion.div
            initial="hidden"
            animate="visible"
            variants={fadeUp}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-[#A380F6]/30 text-sm font-medium text-[#A380F6] mb-5 shadow-sm">
              FAQ
            </div>
            <h1 className="text-4xl lg:text-5xl font-black text-[#0A1547] leading-tight mb-4">
              Frequently Asked Questions
            </h1>
            <p className="text-base lg:text-lg text-[#0A1547]/60 leading-relaxed max-w-3xl">
              AI should give your team time back, not add another system to manage. Here are the questions we hear most often about alphaSource, our products, and how we work with clients.
            </p>
          </motion.div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 lg:px-8 pb-24">
        <motion.div
          initial="hidden"
          animate="visible"
          custom={1}
          variants={fadeUp}
          className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 lg:p-10"
          style={{ color: "#0A1547" }}
        >
          <div className="space-y-9">
            {faqSections.map((section, sectionIndex) => (
              <section
                key={section.title}
                className={sectionIndex === faqSections.length - 1 ? "" : "pb-9 border-b border-gray-100"}
              >
                <h2 className="text-lg font-black text-[#0A1547] mb-4">{section.title}</h2>
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
        </motion.div>
      </div>
    </div>
  );
}
