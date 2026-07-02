import { motion } from "framer-motion";
import { ArrowRight, CheckCircle } from "lucide-react";
import LeadCaptureForm from "@/components/LeadCaptureForm";
import { PUBLIC_CONTENT_LAST_UPDATED } from "@/lib/publicContent";

const EASE_OUT = "easeOut" as const;

const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.55, ease: EASE_OUT },
  }),
};

function HeroSection() {
  return (
    <section className="relative pt-16 overflow-hidden">
      <div className="absolute inset-0 gradient-hero-bg" />
      <div
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, rgba(163,128,246,0.2) 1px, transparent 0)`,
          backgroundSize: "40px 40px",
        }}
      />

      <div className="relative max-w-7xl mx-auto px-6 lg:px-8 py-20 lg:py-24 w-full">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left — text */}
          <div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-[#A380F6]/30 text-sm font-medium text-[#A380F6] mb-6 shadow-sm"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[#02D99D] animate-pulse" />
              AI Interview Agent
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.6 }}
              className="text-5xl lg:text-6xl xl:text-7xl font-black text-[#0A1547] leading-[1.05] tracking-tight mb-4"
            >
              alphaScreen
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15, duration: 0.6 }}
              className="text-2xl font-semibold mb-5"
              style={{ color: "#A380F6" }}
            >
              Providing a clearer picture of more candidates.
            </motion.p>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.6 }}
              className="text-lg text-[#0A1547]/60 leading-relaxed mb-4"
            >
              Freeing up your time to focus on what you do best.
            </motion.p>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25, duration: 0.6 }}
              className="text-base text-[#0A1547]/50 leading-relaxed mb-8"
            >
              A membership-based AI interview agent that lets you create job roles and conduct automated screening interviews with AI avatars. The platform leverages advanced AI to comprehensively evaluate candidates — with flexible scheduling so candidates can interview anytime, day or night.
            </motion.p>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.27, duration: 0.6 }}
              className="mb-8 text-sm font-semibold text-[#0A1547]/42"
            >
              Last updated {PUBLIC_CONTENT_LAST_UPDATED}
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.6 }}
              className="flex flex-col sm:flex-row gap-4"
            >
              <a
                href="#how-it-works"
                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 text-base font-semibold text-white rounded-full transition-all hover:opacity-90 hover:shadow-lg active:scale-95"
                style={{ backgroundColor: "#A380F6" }}
                data-testid="alphascreen-how-it-works"
                data-analytics-cta="See How It Works"
                data-analytics-placement="alphascreen-hero"
              >
                See How It Works
                <ArrowRight className="w-4 h-4" />
              </a>
            </motion.div>
          </div>

          {/* Right — video */}
          <motion.div
            initial={{ opacity: 0, x: 30, scale: 0.97 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            transition={{ delay: 0.3, duration: 0.7, ease: "easeOut" }}
          >
            <div
              className="bg-white rounded-2xl overflow-hidden"
              style={{ boxShadow: "0 24px 64px rgba(10,21,71,0.14), 0 0 0 1px rgba(10,21,71,0.06)" }}
            >
              <div className="bg-gray-50 border-b border-gray-100 px-4 py-3 flex items-center gap-3">
                <div className="flex gap-1.5 flex-shrink-0">
                  <div className="w-3 h-3 rounded-full bg-[#FF5F57]" />
                  <div className="w-3 h-3 rounded-full bg-[#FFBD2E]" />
                  <div className="w-3 h-3 rounded-full bg-[#28C840]" />
                </div>
                <div className="flex-1 text-center">
                  <span className="text-xs font-semibold text-gray-400">alphaScreen Demo</span>
                </div>
              </div>
              <video
                src="/alphascreen-demo.mp4"
                autoPlay
                muted
                loop
                playsInline
                className="w-full block"
              />
              <div className="flex flex-col gap-3 border-t border-[#0A1547]/8 bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm font-semibold leading-relaxed text-[#0A1547]/55">
                  Want to see it with your hiring workflow?
                </p>
                <a
                  href="#request-demo"
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-[#0A1547]/10 bg-[#F8F9FD] px-4 py-2.5 text-sm font-black text-[#0A1547] transition-colors hover:border-[#A380F6] hover:text-[#A380F6]"
                  data-testid="alphascreen-video-demo-cta"
                  data-analytics-cta="Request a Demo"
                  data-analytics-placement="alphascreen-video-card"
                >
                  Request demo
                </a>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

function DirectAnswerSection() {
  const answers = [
    {
      question: "What is AI candidate screening?",
      answer:
        "AI candidate screening uses structured software workflows to collect, organize, and summarize early candidate information so hiring teams can review applicants more consistently.",
    },
    {
      question: "How does alphaScreen help hiring teams?",
      answer:
        "alphaScreen helps teams create roles, invite candidates, run structured AI avatar interviews, and review resume plus interview information in one organized workflow.",
    },
    {
      question: "How does structured interview scoring work?",
      answer:
        "Scores are based on role-specific criteria and structured interview responses. They give hiring teams a consistent review aid, not an automatic employment decision.",
    },
    {
      question: "Why use alphaScreen instead of only resumes or phone screens?",
      answer:
        "Resumes and phone screens can miss context and vary by reviewer. alphaScreen gives each candidate a more comparable first-pass screen before the team spends time on later-stage conversations.",
    },
    {
      question: "How does alphaScreen keep humans in control?",
      answer:
        "People configure roles, review candidate reports, decide next steps, and manage hiring communication. AI supports consistency, structure, and summarization.",
    },
  ];
  const relatedLinks = [
    { label: "How alphaScreen works", href: "/alphascreen/how-it-works" },
    { label: "Security and data", href: "/alphascreen/security" },
    { label: "Candidate experience", href: "/alphascreen/candidate-experience" },
    { label: "Dental groups", href: "/alphascreen/for-dental-groups" },
    { label: "ROI estimator", href: "/alphascreen/roi" },
  ];

  return (
    <section className="bg-[#F8F9FD] py-16 lg:py-20">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
          variants={fadeUp}
          className="mb-8 max-w-3xl"
        >
          <p className="text-sm font-black uppercase tracking-[0.18em] text-[#02ABE0]">
            Direct answers
          </p>
          <h2 className="mt-3 text-3xl font-black leading-tight text-[#0A1547] lg:text-4xl">
            What hiring teams ask about AI screening
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-[#0A1547]/60">
            alphaScreen is designed to organize early screening signal, support consistent review, and keep hiring decisions with the people responsible for them.
          </p>
        </motion.div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {answers.map((item, index) => (
            <motion.article
              key={item.question}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.25 }}
              variants={fadeUp}
              custom={index * 0.3}
              className="rounded-lg border border-[#0A1547]/10 bg-white p-5 shadow-sm"
            >
              <h3 className="text-base font-black leading-snug text-[#0A1547]">{item.question}</h3>
              <p className="mt-3 text-sm leading-relaxed text-[#0A1547]/60">{item.answer}</p>
            </motion.article>
          ))}
        </div>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <a
            href="/alphascreen/pricing"
            className="inline-flex items-center justify-center gap-2 rounded-full bg-[#0A1547] px-5 py-3 text-sm font-black text-white transition-opacity hover:opacity-90"
            data-analytics-cta="Compare alphaScreen memberships"
            data-analytics-placement="alphascreen-direct-answers"
          >
            Compare memberships
            <ArrowRight className="h-4 w-4" />
          </a>
          <a
            href="/faq"
            className="inline-flex items-center justify-center gap-2 rounded-full border border-[#0A1547]/12 bg-white px-5 py-3 text-sm font-black text-[#0A1547] transition-colors hover:border-[#A380F6] hover:text-[#A380F6]"
            data-analytics-cta="Read alphaScreen FAQ"
            data-analytics-placement="alphascreen-direct-answers"
          >
            Read the FAQ
          </a>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          {relatedLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="rounded-full border border-[#0A1547]/10 bg-white px-3 py-2 text-xs font-black text-[#0A1547]/65 transition-colors hover:border-[#A380F6]/45 hover:text-[#A380F6]"
              data-analytics-cta={link.label}
              data-analytics-placement="alphascreen-direct-answers"
            >
              {link.label}
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}

function PricingSignupSection() {
  const memberships = [
    {
      name: "Basic",
      description: "For teams that want consistent screening for focused hiring needs.",
      details: "20 interviews per role · 10-minute interviews",
    },
    {
      name: "Pro",
      description: "For teams with more active roles and higher candidate volume.",
      details: "30 interviews per role · 12-minute interviews",
    },
  ];

  return (
    <section className="bg-white py-16 lg:py-20">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-[0.88fr_1.12fr] lg:items-center">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.3 }}
            variants={fadeUp}
          >
            <p className="text-sm font-black uppercase tracking-[0.18em] text-[#02ABE0]">PRICING AND SIGNUP</p>
            <h2 className="mt-3 text-3xl lg:text-4xl font-black text-[#0A1547] leading-tight">
              Choose the membership that best fits your team.
            </h2>
            <p className="mt-4 text-base leading-relaxed text-[#0A1547]/60">
              Start with Basic or Pro, then complete agreement review and secure checkout when you are ready. Each membership includes structured AI-assisted interviews, candidate scoring, and on-demand reports for your hiring team.
            </p>
            <div className="mt-6">
              <a
                href="#request-demo"
                className="inline-flex items-center gap-2 text-sm font-black text-[#0A1547]/65 underline decoration-[#A380F6]/35 underline-offset-4 transition-colors hover:text-[#A380F6] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#A380F6]"
                data-analytics-cta="Talk to Sales"
                data-analytics-placement="alphascreen-pricing-section"
              >
                Talk to sales
                <ArrowRight className="w-4 h-4" />
              </a>
            </div>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.25 }}
            variants={fadeUp}
            custom={1}
            className="grid gap-4"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              {memberships.map((item) => (
                <div key={item.name} className="flex h-full flex-col rounded-lg border border-[#0A1547]/10 bg-[#F8F9FD] p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#A380F6]">{item.name}</p>
                      <p className="mt-2 min-h-[3.5rem] text-sm font-semibold leading-relaxed text-[#0A1547]/60">{item.description}</p>
                    </div>
                    <div className="h-9 w-9 rounded-lg bg-white flex items-center justify-center text-[#02D99D]">
                      <CheckCircle className="h-5 w-5" />
                    </div>
                  </div>
                  <div className="mt-auto flex items-start gap-2 pt-5 text-sm font-black leading-snug text-[#0A1547]/70">
                    <CheckCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#02D99D]" />
                    <span>{item.details}</span>
                  </div>
                </div>
              ))}
            </div>
            <a
              href="/alphascreen/pricing"
              className="alphascreen-membership-cta group mt-1 block rounded-xl px-5 py-4 text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#A380F6]"
              data-testid="alphascreen-signup-pricing-cta"
              data-analytics-cta="See Memberships and Pricing"
              data-analytics-placement="alphascreen-pricing-section"
            >
              <span className="relative z-10 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <span>
                  <span className="block text-base font-black tracking-normal">See memberships and pricing</span>
                  <span className="mt-1 block text-sm font-semibold text-white/65">Compare Basic, Pro, and Enterprise options.</span>
                </span>
                <span className="inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-white/10 text-white transition-colors group-hover:bg-white group-hover:text-[#0A1547]">
                  <ArrowRight className="h-4 w-4" />
                </span>
              </span>
            </a>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

function SmartSection() {
  return (
    <section className="py-24 bg-[#0A1547]">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">

          {/* Left — cards (swapped to first) */}
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.3 }}
            custom={1}
            variants={fadeUp}
            className="order-1"
          >
            <div className="grid grid-cols-1 gap-4">
              {[
                {
                  icon: "🤖",
                  title: "AI Avatar Interviews",
                  description: "Every candidate gets a structured, professional interview through a consistent AI interviewer — no scheduling required.",
                  color: "#A380F6",
                },
                {
                  icon: "📄",
                  title: "Resume + Interview Analysis",
                  description: "alphaScreen evaluates both the candidate's submitted resume and their interview performance together for a complete picture.",
                  color: "#02D99D",
                },
                {
                  icon: "👁",
                  title: "Non-verbal Cue Detection",
                  description: "Advanced AI reads beyond words to give you the full context of every candidate interaction.",
                  color: "#02ABE0",
                },
              ].map((card, i) => (
                <motion.div
                  key={card.title}
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1, duration: 0.5 }}
                  className="bg-white/5 border border-white/10 rounded-2xl p-5 flex items-start gap-4"
                  data-testid={`smart-card-${i}`}
                >
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-lg"
                    style={{ backgroundColor: `${card.color}20` }}
                  >
                    {card.icon}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white mb-1">{card.title}</h3>
                    <p className="text-xs text-white/60 leading-relaxed">{card.description}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Right — text (swapped to second) */}
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.3 }}
            variants={fadeUp}
            className="order-2"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 text-sm font-medium text-white mb-6">
              Smart
            </div>
            <h2 className="text-4xl lg:text-5xl font-black text-white leading-tight mb-5">
              Every Candidate Gets the Same Interview
            </h2>
            <p className="text-lg text-white/70 leading-relaxed mb-5">
              Through an AI interviewer that's consistent, thorough, and unbiased every single time.
            </p>
            <p className="text-base text-white/60 leading-relaxed">
              alphaScreen analyzes resumes, interview content, and non-verbal cues to give hiring managers a complete, unbiased read on every applicant.
            </p>
          </motion.div>

        </div>
      </div>
    </section>
  );
}

function AboutAlphaScreenSection() {
  return (
    <section className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.3 }}
            variants={fadeUp}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#A380F6]/10 text-sm font-medium text-[#A380F6] mb-5">
              About alphaScreen
            </div>
            <h2 className="text-4xl lg:text-5xl font-black text-[#0A1547] leading-tight mb-5">
              Evaluate Faster.
              <br />
              Hire with Confidence.
            </h2>
            <p className="text-lg text-[#0A1547]/60 leading-relaxed mb-5">
              alphaScreen helps hiring managers evaluate candidates faster and hire with confidence.
            </p>
            <p className="text-xl font-semibold text-[#0A1547] leading-relaxed mb-8">
              Less time screening. More time on the people who matter.
            </p>
            <div className="space-y-3">
              {[
                "Subscription-based — predictable, scalable pricing",
                "Create and configure roles to match your exact needs",
                "Candidates interview on their own schedule, 24/7",
                "Consistent evaluation across every single applicant",
              ].map((item) => (
                <div key={item} className="flex items-start gap-3">
                  <CheckCircle className="w-4 h-4 text-[#02D99D] flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-[#0A1547]/70">{item}</span>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.3 }}
            custom={1}
            variants={fadeUp}
          >
            <div
              className="bg-white rounded-2xl overflow-hidden"
              style={{ boxShadow: "0 0 0 1.5px rgba(163,128,246,0.2), 0 24px 64px rgba(10,21,71,0.1)" }}
            >
              <div className="bg-[#0A1547] px-6 py-5 flex items-center gap-3">
                <img src="/alpha-symbol.png" alt="Alpha" className="h-8 w-8" />
                <div>
                  <div className="text-sm font-bold text-white">alphaScreen</div>
                  <div className="text-xs text-white/50">Candidate Evaluation Report</div>
                </div>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <div className="text-xs text-[#0A1547]/40 mb-1 font-medium uppercase tracking-wider">Candidate</div>
                  <div className="text-base font-bold text-[#0A1547]">Sarah K.</div>
                </div>
                {[
                  { label: "Resume Match", score: 92, color: "#A380F6" },
                  { label: "Interview Performance", score: 87, color: "#02D99D" },
                  { label: "Communication", score: 94, color: "#02ABE0" },
                  { label: "Overall Fit", score: 90, color: "#A380F6" },
                ].map((metric) => (
                  <div key={metric.label}>
                    <div className="flex justify-between items-center mb-1.5">
                      <span className="text-xs font-medium text-[#0A1547]/70">{metric.label}</span>
                      <span className="text-xs font-bold" style={{ color: metric.color }}>{metric.score}%</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-1.5">
                      <motion.div
                        className="h-1.5 rounded-full"
                        initial={{ width: 0 }}
                        whileInView={{ width: `${metric.score}%` }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                        style={{ backgroundColor: metric.color }}
                      />
                    </div>
                  </div>
                ))}
                <div className="pt-2 border-t border-gray-100">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[#0A1547]/50">Recommendation</span>
                    <span className="text-xs font-bold px-2.5 py-1 rounded-full" style={{ backgroundColor: "#02D99D20", color: "#02D99D" }}>
                      Advance to Interview
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

function HowItWorksSection() {
  const steps = [
    {
      number: "01",
      title: "Create Your Role",
      description: "Set up the job role in alphaScreen with your specific criteria — skills, experience level, and what good looks like for your team.",
      color: "#A380F6",
    },
    {
      number: "02",
      title: "Invite Candidates",
      description: "Applicants receive a link to complete their AI avatar interview on their own schedule — day or night, from any device.",
      color: "#02ABE0",
    },
    {
      number: "03",
      title: "AI Evaluates Comprehensively",
      description: "alphaScreen analyzes resumes, interview responses, and non-verbal cues to build a complete, unbiased picture of every candidate.",
      color: "#02D99D",
    },
    {
      number: "04",
      title: "Review and Decide",
      description: "Access clear candidate summaries and spend your time on the conversations that actually move people forward.",
      color: "#A380F6",
    },
  ];

  return (
    <section id="how-it-works" className="py-24 bg-[#F8F9FD]">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
          variants={fadeUp}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#0A1547]/8 text-sm font-medium text-[#0A1547] mb-5">
            How It Works
          </div>
          <h2 className="text-4xl lg:text-5xl font-black text-[#0A1547] leading-tight">
            Simple to Set Up.
            <br />
            <span style={{ color: "#A380F6" }}>Powerful in Practice.</span>
          </h2>
        </motion.div>

        {/* Horizontal timeline */}
        <div className="relative">
          {/* Connecting line */}
          <div
            className="hidden lg:block absolute h-px bg-gray-200 z-0"
            style={{ top: "24px", left: "calc(12.5% + 4px)", right: "calc(12.5% + 4px)" }}
          />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-4">
            {steps.map((step, i) => (
              <motion.div
                key={step.number}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.12, duration: 0.5 }}
                className="flex flex-col items-center"
                data-testid={`how-it-works-step-${step.number}`}
              >
                {/* Circle number */}
                <div
                  className="relative z-10 w-12 h-12 rounded-full bg-white border-2 flex items-center justify-center text-sm font-black mb-6 flex-shrink-0"
                  style={{ borderColor: step.color, color: step.color }}
                >
                  {step.number}
                </div>
                {/* Card */}
                <div className="bg-white rounded-2xl p-5 border border-gray-100 w-full text-center">
                  <h3 className="text-sm font-bold text-[#0A1547] mb-2">{step.title}</h3>
                  <p className="text-xs text-[#0A1547]/60 leading-relaxed">{step.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function DemoSection() {
  return (
    <section id="request-demo" className="py-24 bg-white">
      <div className="max-w-5xl mx-auto px-6 lg:px-8">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          variants={fadeUp}
          className="overflow-hidden rounded-2xl flex flex-col lg:flex-row"
          style={{ boxShadow: "0 12px 48px rgba(10,21,71,0.13), 0 0 0 1px rgba(10,21,71,0.06)" }}
        >
          <div
            className="lg:w-[40%] flex-shrink-0 p-10 flex flex-col justify-between"
            style={{ background: "linear-gradient(145deg, #1B2B7A 0%, #0A1547 55%, #070E36 100%)" }}
          >
            <div>
              <h2 className="text-3xl font-black text-white leading-tight mb-4">
                Ready to See What alphaScreen Can Do?
              </h2>
              <p className="text-white/60 text-sm leading-relaxed mb-8">
                Leave your info and we'll get a demo on the calendar.
              </p>
              <div className="space-y-3">
                {[
                  "Personalized demo at your convenience",
                  "See alphaScreen evaluate real candidates",
                  "No commitment required",
                  "Backed by real-world experience",
                ].map((item) => (
                  <div key={item} className="flex items-center gap-3">
                    <CheckCircle className="w-4 h-4 flex-shrink-0" style={{ color: "#02D99D" }} />
                    <span className="text-white/70 text-sm">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex-1 bg-white p-10">
            <LeadCaptureForm
              formId="alphascreen-demo"
              formType="demo"
              formTestId="demo-form"
              productInterest="alphascreen"
              successTitle="We'll be in touch!"
              successBody="Our team will reach out to schedule your alphaScreen demo."
            />
          </div>
        </motion.div>
      </div>
    </section>
  );
}

export default function AlphaScreenPage() {
  return (
    <div>
      <HeroSection />
      <PricingSignupSection />
      <SmartSection />
      <AboutAlphaScreenSection />
      <DirectAnswerSection />
      <HowItWorksSection />
      <DemoSection />
    </div>
  );
}
