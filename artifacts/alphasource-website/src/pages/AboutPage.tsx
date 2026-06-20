import { motion } from "framer-motion";
import { CheckCircle, Users, BarChart2, Scale, Zap, Shield, Globe } from "lucide-react";
import { ArrowRight } from "lucide-react";
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
    <section className="relative pt-32 pb-20 overflow-hidden">
      <div className="absolute inset-0 gradient-hero-bg" />
      <div className="absolute inset-0 gradient-lilac-glow" />
      <div className="relative max-w-7xl mx-auto px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center max-w-3xl mx-auto"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-[#A380F6]/30 text-sm font-medium text-[#A380F6] mb-6 shadow-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-[#A380F6]" />
            About Us
          </div>
          <h1 className="text-5xl lg:text-6xl font-black text-[#0A1547] leading-[1.05] tracking-tight mb-6">
            Meet the alphaSource Team
          </h1>
          <p className="text-xl text-[#0A1547]/60 leading-relaxed">
            Hands-on leaders who've lived the problem — and built the solution.
          </p>
        </motion.div>
      </div>
    </section>
  );
}

function TeamSection() {
  const team = [
    {
      name: "Jason Gardner",
      role: "Founder",
      photo: "/headshot-jason.jpg",
      bio: "Dental operations veteran with deep tech insight. Jason saw the talent gaps and time drains up close — and decided to do something about it.",
      color: "#A380F6",
    },
    {
      name: "Brent Ford",
      role: "Partner",
      photo: "/headshot-brent.jpg",
      bio: "Brings a gift for connecting with and engaging diverse audiences. Brent widens the bridge between opportunity and the people who deserve a shot.",
      color: "#02ABE0",
    },
  ];

  return (
    <section className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="grid md:grid-cols-2 gap-6 max-w-2xl mx-auto">
          {team.map((member, i) => (
            <motion.div
              key={member.name}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.2 }}
              custom={i}
              variants={fadeUp}
              className="bg-[#F8F9FD] rounded-2xl overflow-hidden"
              data-testid={`team-member-${i}`}
            >
              <div className="relative h-56 overflow-hidden">
                <img
                  src={member.photo}
                  alt={member.name}
                  className="w-full h-full object-cover object-top"
                />
                <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-[#F8F9FD] to-transparent" />
              </div>
              <div className="px-6 pb-6 pt-3 text-center">
                <h3 className="text-lg font-bold text-[#0A1547] mb-0.5">{member.name}</h3>
                <div className="text-sm font-semibold mb-3" style={{ color: member.color }}>
                  {member.role}
                </div>
                <p className="text-sm text-[#0A1547]/60 leading-relaxed">{member.bio}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function MissionSection() {
  const values = [
    {
      Icon: Users,
      label: "Human-First, Always",
      description: "AI should amplify human judgment, not replace it. We hold this line firmly in everything we build.",
      color: "#A380F6",
    },
    {
      Icon: BarChart2,
      label: "Insight Over Information",
      description: "We translate raw data into clear, reasoned, actionable intelligence that helps teams make better decisions faster.",
      color: "#02ABE0",
    },
    {
      Icon: Scale,
      label: "Fairness by Design",
      description: "Structured, consistent evaluation frameworks that help teams assess on merit — opening doors for job seekers who deserve a real shot.",
      color: "#02D99D",
    },
    {
      Icon: Zap,
      label: "Speed Without Sacrifice",
      description: "Moving faster should not mean cutting corners on quality or candidate experience. We believe in both.",
      color: "#A380F6",
    },
  ];

  return (
    <section className="py-24 bg-[#F8F9FD]">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-start">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.3 }}
            variants={fadeUp}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#A380F6]/10 text-sm font-medium text-[#A380F6] mb-5">
              Our Mission
            </div>
            <h2 className="text-4xl font-black text-[#0A1547] leading-tight mb-6">
              We Exist to Give People the Freedom to Chase What Lights Them Up
            </h2>
            <div className="space-y-4">
              {[
                { text: "Through AI that amplifies human judgment, we create pathways where talent finds its place. Not by chance, but by design.", color: "#A380F6" },
                { text: "Every tool, every conversation, every insight is built to deliver real impact: hours reclaimed, opportunities opened, and partnerships that endure.", color: "#02ABE0" },
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="w-1.5 h-1.5 rounded-full mt-2.5 flex-shrink-0" style={{ backgroundColor: item.color }} />
                  <p className="text-[#0A1547]/70 leading-relaxed">{item.text}</p>
                </div>
              ))}
              <p
                className="text-[#0A1547] font-semibold leading-relaxed pl-4 border-l-2 py-1"
                style={{ borderColor: "#02D99D" }}
              >
                Because when you put the right people in position to succeed, everyone rises.
              </p>
            </div>
          </motion.div>

          <div className="grid grid-cols-2 gap-4">
            {values.map((val, i) => (
              <motion.div
                key={val.label}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, duration: 0.5 }}
                className="bg-white rounded-2xl p-5"
                data-testid={`value-item-${i}`}
              >
                <val.Icon
                  className="mb-4"
                  style={{ color: val.color, width: 24, height: 24, strokeWidth: 1.75 }}
                />
                <div className="text-[14px] font-bold text-[#0A1547] mb-1.5">{val.label}</div>
                <div className="text-xs text-gray-500 leading-relaxed">{val.description}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function StorySection() {
  return (
    <section className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="grid lg:grid-cols-[1fr_1fr] gap-10 lg:gap-16 items-start">

          {/* Left — prominent testimonial card */}
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.3 }}
            variants={fadeUp}
            className="relative overflow-hidden rounded-3xl p-10 lg:p-12"
            style={{ background: "linear-gradient(145deg, #1B2B7A 0%, #0A1547 55%, #070E36 100%)" }}
          >
            <div
              className="absolute top-4 right-6 font-serif text-white/5 select-none leading-none"
              style={{ fontSize: "10rem" }}
            >
              "
            </div>
            <img src="/alpha-symbol.png" alt="alphaSource" className="h-10 w-auto mb-8" />
            <blockquote className="text-2xl font-medium leading-relaxed italic text-white/90 mb-8 relative z-10">
              "alphaSource cut our screening time in half and uncovered candidates we'd have missed — people with real spark. They overdeliver every time."
            </blockquote>
            <div className="flex items-center gap-3">
              <div className="w-8 h-px bg-white/30" />
              <span className="text-sm font-semibold text-white/50">alphaSource Client</span>
            </div>
          </motion.div>

          {/* Right — scannable story beats */}
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.3 }}
            custom={1}
            variants={fadeUp}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#0A1547]/8 text-sm font-medium text-[#0A1547] mb-5">
              Our Story
            </div>
            <h2 className="text-4xl font-black text-[#0A1547] leading-tight mb-8">
              Born from Real-World Frustration
            </h2>
            <div className="space-y-6">
              {[
                {
                  text: "Brilliant people sidelined by endless screening calls. Leaders buried in resumes instead of strategy. It started with a frustration we couldn't ignore.",
                  color: "#A380F6",
                },
                {
                  text: "Jason, a dental operations veteran, saw the talent gaps and data fatigue up close. Brent widened the bridge between opportunity and the people who deserve a real shot.",
                  color: "#02ABE0",
                },
                {
                  text: "Together we're turning real-world problems into action — opening doors for job seekers and freeing focus for teams.",
                  color: "#02D99D",
                },
              ].map((beat, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: 12 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1, duration: 0.5 }}
                  className="pl-5"
                  style={{ borderLeft: `2.5px solid ${beat.color}` }}
                >
                  <p className="text-[#0A1547]/70 leading-relaxed">{beat.text}</p>
                </motion.div>
              ))}
              <p className="text-[#0A1547] font-semibold leading-relaxed pt-1">
                alphaSource is our promise to make work feel human again.
              </p>
            </div>
          </motion.div>

        </div>
      </div>
    </section>
  );
}

function TechnologySection() {
  return (
    <section className="py-24 bg-[#F8F9FD]">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.3 }}
            variants={fadeUp}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#A380F6]/10 text-sm font-medium text-[#A380F6] mb-5">
              Technology
            </div>
            <h2 className="text-4xl font-black text-[#0A1547] leading-tight mb-5">
              Tech That Stays in the Background
            </h2>
            <p className="text-lg text-[#0A1547]/70 leading-relaxed">
              Our tech isn't the star. It's the quiet partner that steps in for the grind so you can lead with brilliance. Think smart agents that converse like colleagues, sorting through possibilities with precision while you zero in on potential.
            </p>
          </motion.div>

          <div className="space-y-4">
            {[
              {
                Icon: Shield,
                color: "#02ABE0",
                text: "No black boxes or buzzwords. Just reliable tools that handle the tedious, grounded in real-world proof.",
                weight: "medium",
              },
              {
                Icon: Globe,
                color: "#02D99D",
                text: "We're generous with what works and upfront about what doesn't — because tech should expand your world, not complicate it.",
                weight: "semibold",
              },
            ].map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15, duration: 0.5 }}
                className="bg-white rounded-2xl p-6"
              >
                <item.Icon
                  className="mb-4"
                  style={{ color: item.color, width: 24, height: 24, strokeWidth: 1.75 }}
                />
                <p
                  className="text-sm leading-relaxed"
                  style={{
                    color: item.weight === "semibold" ? "#0A1547" : "rgba(10,21,71,0.7)",
                    fontWeight: item.weight === "semibold" ? 600 : 400,
                  }}
                >
                  {item.text}
                </p>
              </motion.div>
            ))}
          </div>
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
          <div
            className="lg:w-[40%] flex-shrink-0 p-10 flex flex-col justify-between"
            style={{ background: "linear-gradient(145deg, #1B2B7A 0%, #0A1547 55%, #070E36 100%)" }}
          >
            <div>
              <h2 className="text-3xl font-black text-white leading-tight mb-4">
                To Schedule a Demo or Learn More
              </h2>
              <p className="text-white/60 text-sm leading-relaxed mb-8">
                Provide your contact details and our team will reach out to schedule with you.
              </p>
              <div className="space-y-3">
                {[
                  "Personalized demo at your convenience",
                  "No commitment required",
                  "Backed by real-world experience",
                  "We make work feel human again",
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
              formId="about-contact"
              formType="contact"
              formTestId="about-contact-form"
              productInterest="company-demo"
              successTitle="Thanks! We'll be in touch."
              successBody="Our team will reach out to schedule with you."
            />
          </div>
        </motion.div>
      </div>
    </section>
  );
}

export default function AboutPage() {
  return (
    <div>
      <HeroSection />
      <TeamSection />
      <MissionSection />
      <StorySection />
      <TechnologySection />
      <CTASection />
    </div>
  );
}
