import { motion } from "framer-motion";
import { ArrowRight, CheckCircle, Target, Sprout, Clock, Scale } from "lucide-react";
import LeadCaptureForm from "@/components/LeadCaptureForm";

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
      <div className="absolute inset-0 gradient-lilac-glow" />
      <div
        className="absolute inset-0 opacity-40"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, rgba(10,21,71,0.07) 1px, transparent 0)`,
          backgroundSize: "36px 36px",
        }}
      />

      <div className="relative max-w-7xl mx-auto px-6 lg:px-8 pt-20 pb-16 lg:pt-28 lg:pb-28 w-full">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left */}
          <div>
            <motion.div
              initial="hidden"
              animate="visible"
              custom={0}
              variants={fadeUp}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-[#A380F6]/30 text-sm font-medium text-[#A380F6] mb-6 shadow-sm"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[#02D99D] animate-pulse" />
              AI-Powered Solutions
            </motion.div>

            <motion.h1
              initial="hidden"
              animate="visible"
              custom={1}
              variants={fadeUp}
              className="text-5xl lg:text-6xl xl:text-7xl font-black text-[#0A1547] leading-[1.05] tracking-tight mb-3"
            >
              Unleash Your
              <br />
              Talent
            </motion.h1>

            <motion.h2
              initial="hidden"
              animate="visible"
              custom={2}
              variants={fadeUp}
              className="text-2xl lg:text-3xl font-bold mb-5"
              style={{ color: "#A380F6" }}
            >
              Amplify What Matters
            </motion.h2>

            <motion.p
              initial="hidden"
              animate="visible"
              custom={3}
              variants={fadeUp}
              className="text-lg text-[#0A1547]/60 leading-relaxed mb-3 max-w-lg"
            >
              Custom AI tools that give your team hours back.
            </motion.p>

            <motion.p
              initial="hidden"
              animate="visible"
              custom={3.5}
              variants={fadeUp}
              className="text-base text-[#0A1547]/50 leading-relaxed mb-8 max-w-lg"
            >
              AI-powered solutions that amplify human talent. We don't replace judgment. We enhance it.
            </motion.p>

            <motion.div
              initial="hidden"
              animate="visible"
              custom={4}
              variants={fadeUp}
              className="flex flex-col sm:flex-row gap-4 mb-10"
            >
              <a
                href="#contact"
                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 text-base font-semibold text-white rounded-full transition-all hover:opacity-90 hover:shadow-lg active:scale-95"
                style={{ backgroundColor: "#A380F6" }}
                data-testid="hero-cta-primary"
                data-analytics-cta="Get in Touch"
                data-analytics-placement="home-hero"
              >
                Get in Touch
                <ArrowRight className="w-4 h-4" />
              </a>
              <a
                href="/alphascreen"
                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 text-base font-semibold text-[#0A1547] bg-white border border-[#0A1547]/10 rounded-full transition-all hover:border-[#A380F6] hover:text-[#A380F6] hover:shadow-md active:scale-95"
                data-testid="hero-cta-secondary"
                data-analytics-cta="Explore alphaScreen"
                data-analytics-placement="home-hero"
              >
                Explore alphaScreen
              </a>
            </motion.div>

            {/* Trust indicators */}
            <motion.div
              initial="hidden"
              animate="visible"
              custom={5}
              variants={fadeUp}
              className="flex flex-col gap-3 border-t border-[#0A1547]/8 pt-8"
            >
              {[
                { Icon: Clock, label: "Reclaim Your Time", sub: "Hours back for higher-value work", color: "#A380F6" },
                { Icon: Scale, label: "Consistent Support", sub: "Repeatable workflows and clearer handoffs", color: "#02ABE0" },
                { Icon: Target, label: "Clearer Insight", sub: "Organized signal for better decisions", color: "#02D99D" },
              ].map(({ Icon, label, sub, color }) => (
                <div key={label} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${color}14` }}>
                    <Icon className="w-4 h-4" style={{ color }} strokeWidth={1.75} />
                  </div>
                  <div>
                    <span className="text-sm font-semibold text-[#0A1547]">{label}</span>
                    <span className="text-sm text-[#0A1547]/40 ml-2">{sub}</span>
                  </div>
                </div>
              ))}
            </motion.div>
          </div>

          {/* Right — AI Agent Panel */}
          <motion.div
            initial={{ opacity: 0, x: 36, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            transition={{ delay: 0.3, duration: 0.7, ease: "easeOut" }}
            className="relative px-6 py-8"
          >
            {/* Main floating card */}
            <motion.div
              animate={{ y: [0, -10, 0] }}
              transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
              style={{ rotate: -2 }}
              className="relative"
            >
              <div
                className="bg-white rounded-2xl overflow-hidden"
                style={{ boxShadow: "0 28px 80px rgba(10,21,71,0.18), 0 0 0 1px rgba(10,21,71,0.06)" }}
              >
                {/* Window chrome */}
                <div className="bg-gray-50 border-b border-gray-100 px-4 py-3 flex items-center gap-3">
                  <div className="flex gap-1.5 flex-shrink-0">
                    <div className="w-3 h-3 rounded-full bg-[#FF5F57]" />
                    <div className="w-3 h-3 rounded-full bg-[#FFBD2E]" />
                    <div className="w-3 h-3 rounded-full bg-[#28C840]" />
                  </div>
                  <div className="flex-1 text-center">
                    <span className="text-xs font-semibold text-gray-400">alphaSource AI Workflow Panel</span>
                  </div>
                </div>

                {/* Body */}
                <div className="p-4 space-y-3">
                  {/* Agent row */}
                  <div className="flex items-start gap-3 p-3 bg-[#F8F9FD] rounded-xl">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: "#A380F615" }}>
                      <img src="/alpha-symbol.png" alt="alpha" className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-[#0A1547]">Custom AI Agent</div>
                      <div className="text-xs text-gray-400 mt-0.5">Organizing work into insight.</div>
                    </div>
                  </div>

                  {/* Active evaluations */}
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Active Workflows</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: "#02D99D18", color: "#02D99D" }}>Insight Ready</span>
                  </div>

                  <div className="space-y-2">
                    {[
                      { label: "Workflow Analysis", pct: 78, from: "#A380F6", to: "#c8a8f8", icon: (
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#A380F6" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
                      )},
                      { label: "Operational Signal", pct: 91, from: "#02ABE0", to: "#02D99D", icon: (
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#02ABE0" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
                      )},
                    ].map((row, i) => (
                      <motion.div
                        key={row.label}
                        initial={{ opacity: 0, x: 8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.7 + i * 0.15, duration: 0.4 }}
                        className="bg-white border border-gray-100 rounded-xl p-2.5"
                      >
                        <div className="flex items-center gap-2 mb-1.5">
                          <div className="w-5 h-5 rounded-md flex items-center justify-center" style={{ backgroundColor: `${row.from}18` }}>
                            {row.icon}
                          </div>
                          <span className="text-xs font-semibold text-[#0A1547]">{row.label}</span>
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${row.pct}%` }}
                            transition={{ delay: 0.9 + i * 0.15, duration: 0.8, ease: "easeOut" }}
                            className="h-full rounded-full"
                            style={{ background: `linear-gradient(90deg, ${row.from}, ${row.to})` }}
                          />
                        </div>
                      </motion.div>
                    ))}
                  </div>

                  {/* Terminal */}
                  <div className="bg-[#0A1547] rounded-xl p-3">
                    <div className="flex items-center gap-1.5 mb-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#02D99D]" />
                      <span className="text-[10px] font-bold font-mono tracking-wide" style={{ color: "#02D99D" }}>System Logs</span>
                    </div>
                    {[
                      { text: "> Mapping workflow context...", color: "rgba(255,255,255,0.5)", delay: 1.0 },
                      { text: "> Decision support ready.", color: "#02D99D", delay: 1.2 },
                      { text: "> Organizing next-step insight.", color: "rgba(255,255,255,0.5)", delay: 1.4 },
                    ].map((line) => (
                      <motion.div
                        key={line.text}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: line.delay, duration: 0.4 }}
                        className="text-[10px] font-mono leading-relaxed"
                        style={{ color: line.color }}
                      >
                        {line.text}
                      </motion.div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Floating badge — top right */}
            <motion.div
              initial={{ opacity: 0, x: 12, scale: 0.85 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              transition={{ delay: 0.9, duration: 0.5 }}
              className="absolute top-0 right-0"
            >
              <motion.div
                animate={{ y: [0, -7, 0] }}
                transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut", delay: 0.8 }}
                className="bg-white rounded-2xl shadow-xl px-4 py-3 flex items-center gap-3 border border-gray-100"
              >
                <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ border: "2px solid #A380F6" }}>
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: "#A380F6" }} />
                </div>
                <div>
                  <div className="text-[9px] uppercase tracking-widest font-bold text-gray-400">Insight Status</div>
                  <div className="text-sm font-black text-[#0A1547]">Ready to Review</div>
                </div>
              </motion.div>
            </motion.div>

            {/* Floating badge — bottom left */}
            <motion.div
              initial={{ opacity: 0, x: -12, scale: 0.85 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              transition={{ delay: 1.1, duration: 0.5 }}
              className="absolute bottom-0 left-0"
            >
              <motion.div
                animate={{ y: [0, -7, 0] }}
                transition={{ duration: 3.8, repeat: Infinity, ease: "easeInOut", delay: 1.5 }}
                className="bg-white rounded-2xl shadow-xl px-4 py-3 flex items-center gap-2 border border-gray-100"
              >
                <div className="w-2 h-2 rounded-full bg-[#02D99D] animate-pulse flex-shrink-0" />
                <span className="text-sm font-bold text-[#0A1547]">Workflows Active</span>
              </motion.div>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

function PeopleDrivenSection() {
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
              People-Driven
            </div>
            <h2 className="text-4xl lg:text-5xl font-black text-[#0A1547] leading-tight mb-6">
              Obsessed with People. Powered by AI.
            </h2>
            <p className="text-lg text-[#0A1547]/70 leading-relaxed mb-4">
              We're obsessed with people. Their grit, their gifts, what they're capable of when nobody's wasting their time.
            </p>
            <p className="text-base text-[#0A1547]/60 leading-relaxed mb-4">
              Every company has work that eats time, hides insight, or slows good people down. From automated candidate screening to operational analysis and custom AI workflows, alphaSource creates technology that fits your team, your process, and your goals.
            </p>
            <p className="text-base font-semibold text-[#0A1547] leading-relaxed">
              We're here to make work feel human again.
            </p>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.3 }}
            custom={1}
            variants={fadeUp}
          >
            <div className="grid grid-cols-2 gap-5">
              {[
                {
                  Icon: Target,
                  title: "Custom AI Solutions",
                  description: "Practical tools built around the workflows your team already runs.",
                  color: "#A380F6",
                },
                {
                  Icon: Sprout,
                  title: "alphaScreen",
                  description: "Structured AI interview support for teams that need clearer candidate signal.",
                  color: "#02D99D",
                },
                {
                  Icon: Clock,
                  title: "AI-Powered Analysis",
                  description: "Turn documents, conversations, and operating data into usable insight.",
                  color: "#02ABE0",
                },
                {
                  Icon: Scale,
                  title: "Consulting + Implementation",
                  description: "Hands-on help connecting AI to the way your business actually works.",
                  color: "#A380F6",
                },
              ].map((card, i) => (
                <motion.div
                  key={card.title}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1, duration: 0.5 }}
                  className="bg-gray-50 rounded-2xl p-6"
                  data-testid={`pillar-card-${i}`}
                >
                  <card.Icon
                    className="mb-5"
                    style={{ color: card.color, width: 28, height: 28, strokeWidth: 1.75 }}
                  />
                  <h3 className="text-[15px] font-bold text-[#0A1547] mb-2">{card.title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{card.description}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

function AlphaScreenFeatureSection() {
  const logLines = [
    { text: "> Loading candidate profile...", color: "rgba(255,255,255,0.55)", delay: 0.2 },
    { text: "> Analyzing interview responses...", color: "rgba(255,255,255,0.55)", delay: 0.7 },
    { text: "> 94% match confidence detected.", color: "#02D99D", delay: 1.2 },
    { text: "> Cross-referencing resume data...", color: "rgba(255,255,255,0.55)", delay: 1.7 },
  ];

  const featureCards = [
    {
      title: "A Clearer Picture",
      description: "Providing a clearer picture of more candidates — freeing up your time to focus on what you do best.",
    },
    {
      title: "Part of a Broader Suite",
      description: "alphaScreen is one part of a broader suite of AI tools and consulting services we build for leaders who want their hours back.",
    },
    {
      title: "More Time for What Matters",
      description: "Less time on the grind. More time on what actually matters.",
    },
  ];

  return (
    <section id="agents" className="py-24 bg-[#F8F9FD]">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">

          {/* Left — terminal card */}
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.3 }}
            custom={1}
            variants={fadeUp}
            className="order-2 lg:order-1"
          >
            <div
              className="bg-white rounded-2xl p-5"
              style={{ boxShadow: "0 8px 40px rgba(10,21,71,0.10), 0 0 0 1px rgba(10,21,71,0.05)" }}
            >
              {/* Card header */}
              <div className="flex items-center gap-3 pb-4 mb-4 border-b border-gray-100">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: "#A380F618" }}>
                  <img src="/alpha-symbol.png" alt="alpha" className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-sm font-bold text-[#0A1547]">alphaScreen</div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#02D99D] animate-pulse" />
                    <span className="text-xs font-semibold" style={{ color: "#02D99D" }}>Executing analysis</span>
                  </div>
                </div>
              </div>

              {/* Dark terminal container — single block with rounded corners inside the card */}
              <div className="bg-[#0D1A5C] rounded-xl px-5 pt-5 pb-4 font-mono">
                <div className="space-y-3 mb-4">
                  {logLines.map((line, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -8 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: line.delay, duration: 0.4 }}
                      className="text-[12px] leading-relaxed"
                      style={{ color: line.color }}
                    >
                      {line.text}
                    </motion.div>
                  ))}
                </div>

                {/* Insight box — nested inside the dark block */}
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 2.2, duration: 0.5 }}
                  className="rounded-lg px-4 py-3"
                  style={{ backgroundColor: "#1E2E7A" }}
                >
                  <div className="text-[9px] font-bold uppercase tracking-widest mb-1.5" style={{ color: "#A380F6" }}>
                    Screening Complete
                  </div>
                  <p className="text-[12px] leading-relaxed text-white/85">
                    Candidate ranks in top 8%. Recommend advancing to final interview round.
                  </p>
                </motion.div>
              </div>
            </div>
          </motion.div>

          {/* Right — text + feature cards */}
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.3 }}
            variants={fadeUp}
            className="order-1 lg:order-2"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#A380F6]/10 text-sm font-medium text-[#A380F6] mb-5">
              Featured Solution
            </div>
            <h2 className="text-4xl lg:text-5xl font-black text-[#0A1547] leading-tight mb-5">
              Meet alphaScreen
            </h2>
            <p className="text-lg text-[#0A1547]/60 leading-relaxed mb-6">
              alphaScreen is our AI-powered interview and candidate evaluation product for teams that need a clearer, more consistent screening process.
            </p>

            <div className="space-y-3 mb-7">
              {featureCards.map((card, i) => (
                <motion.div
                  key={card.title}
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1, duration: 0.4 }}
                  className="flex items-start gap-3 bg-white rounded-xl px-4 py-3.5 border border-gray-100"
                >
                  <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5" style={{ backgroundColor: "#02D99D18" }}>
                    <CheckCircle className="w-4 h-4" style={{ color: "#02D99D" }} />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-[#0A1547] mb-0.5">{card.title}</div>
                    <div className="text-sm text-gray-500 leading-relaxed">{card.description}</div>
                  </div>
                </motion.div>
              ))}
            </div>

            <a
              href="/alphascreen"
              className="inline-flex items-center gap-1.5 text-base font-semibold transition-all hover:gap-2.5"
              style={{ color: "#A380F6" }}
              data-testid="alphascreen-section-cta"
              data-analytics-cta="See alphaScreen"
              data-analytics-placement="home-alphascreen-section"
            >
              See alphaScreen <ArrowRight className="w-4 h-4" />
            </a>
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
      title: "Map the Workflow",
      description: "Identify the repeated work, decision points, and context your team relies on.",
      color: "#A380F6",
    },
    {
      number: "02",
      title: "Build the AI Tool",
      description: "Create a practical workflow, agent, or analysis layer around your actual process.",
      color: "#02ABE0",
    },
    {
      number: "03",
      title: "Organize the Signal",
      description: "Turn scattered information into clear summaries, patterns, and next-step support.",
      color: "#02D99D",
    },
    {
      number: "04",
      title: "Your Team Decides",
      description: "Keep people in control while AI handles the repetitive lift.",
      color: "#A380F6",
    },
  ];

  return (
    <section id="how-it-works" className="py-24 bg-white">
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
            From Manual Work to Usable Insight,
            <br />
            <span style={{ color: "#A380F6" }}>Without the Grind</span>
          </h2>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {steps.map((step, i) => (
            <motion.div
              key={step.number}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.2 }}
              custom={i}
              variants={fadeUp}
              className="relative bg-[#F8F9FD] rounded-2xl p-6 border border-gray-100"
              data-testid={`step-card-${step.number}`}
            >
              <div className="text-4xl font-black mb-4 leading-none" style={{ color: `${step.color}30` }}>
                {step.number}
              </div>
              <h3 className="text-lg font-bold text-[#0A1547] mb-2">{step.title}</h3>
              <p className="text-sm text-[#0A1547]/60 leading-relaxed">{step.description}</p>
              <div
                className="absolute bottom-0 left-6 right-6 h-0.5 rounded-full opacity-50"
                style={{ backgroundColor: step.color }}
              />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function AboutSnippetSection() {
  return (
    <section className="py-24 bg-[#0A1547]">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.3 }}
            variants={fadeUp}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 text-sm font-medium text-white mb-5">
              About Us
            </div>
            <h2 className="text-4xl lg:text-5xl font-black text-white leading-tight mb-6">
              Born from a Shared Frustration with Wasted Time
            </h2>
            <p className="text-white/70 leading-relaxed mb-4">
              Founded by hands-on leaders with decades in operations, alphaSource was born from a shared frustration with wasted time.
            </p>
            <p className="text-white/70 leading-relaxed mb-4">
              We build AI tools and deliver consulting that give leaders their hours back. Uncover insight. Improve decisions. Sharpen strategy.
            </p>
            <p className="text-white font-semibold leading-relaxed mb-8">
              Create lasting impact. We're here to make work feel human again.
            </p>
            <a
              href="/about"
              className="inline-flex items-center gap-2 text-sm font-semibold"
              style={{ color: "#A380F6" }}
              data-testid="about-snippet-link"
              data-analytics-cta="Meet the team"
              data-analytics-placement="home-about-section"
            >
              Meet the team <ArrowRight className="w-3.5 h-3.5" />
            </a>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.3 }}
            custom={1}
            variants={fadeUp}
          >
            {/* Testimonial */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-8">
              <div className="flex gap-0.5 mb-5">
                {[...Array(5)].map((_, i) => (
                  <svg key={i} className="w-4 h-4" viewBox="0 0 20 20" fill="#A380F6">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>
              <blockquote className="text-xl text-white font-medium leading-relaxed mb-6 italic">
                Your talent. Our tech. Practical AI built around the real work your team does and the decisions people still need to make.
              </blockquote>
              <div className="border-t border-white/10 pt-5">
                <div className="text-sm font-semibold text-white/80">alphaSource AI</div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

function CTASection() {
  return (
    <section id="contact" className="py-24 bg-[#F8F9FD]">
      <div className="max-w-5xl mx-auto px-6 lg:px-8">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          variants={fadeUp}
          className="overflow-hidden rounded-2xl flex flex-col lg:flex-row"
          style={{ boxShadow: "0 12px 48px rgba(10,21,71,0.13), 0 0 0 1px rgba(10,21,71,0.06)" }}
        >
          {/* Left — dark navy panel */}
          <div
            className="lg:w-[40%] flex-shrink-0 p-10 flex flex-col justify-between"
            style={{ background: "linear-gradient(145deg, #1B2B7A 0%, #0A1547 55%, #070E36 100%)" }}
          >
            <div>
              <h2 className="text-3xl font-black text-white leading-tight mb-4">
                Want to See What AI Could Take Off Your Plate?
              </h2>
              <p className="text-white/60 text-sm leading-relaxed mb-8">
                Tell us where work is slowing your team down. We'll help identify the practical AI workflow or product that fits.
              </p>
              <div className="space-y-3">
                {[
                  "Talk through your current workflow",
                  "Explore custom AI tools and implementation support",
                  "See alphaScreen if hiring is your priority",
                  "No commitment required",
                ].map((item) => (
                  <div key={item} className="flex items-center gap-3">
                    <CheckCircle className="w-4 h-4 flex-shrink-0" style={{ color: "#02D99D" }} />
                    <span className="text-white/70 text-sm">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right — white form panel */}
          <div className="flex-1 bg-white p-10">
            <LeadCaptureForm
              formId="home-contact"
              formType="contact"
              formTestId="contact-form"
              productInterest="general-ai-workflows"
              successTitle="Thanks! We'll be in touch."
              successBody="Our team will reach out to schedule a demo with you."
            />
          </div>
        </motion.div>
      </div>
    </section>
  );
}

export default function HomePage() {
  return (
    <div>
      <HeroSection />
      <PeopleDrivenSection />
      <AlphaScreenFeatureSection />
      <HowItWorksSection />
      <AboutSnippetSection />
      <CTASection />
    </div>
  );
}
