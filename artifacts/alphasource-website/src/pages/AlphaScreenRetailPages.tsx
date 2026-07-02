import { useMemo, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  BadgeDollarSign,
  Building2,
  Calculator,
  CheckCircle,
  ClipboardCheck,
  Clock3,
  FileText,
  LineChart,
  LockKeyhole,
  ShieldCheck,
  Stethoscope,
  Users,
} from "lucide-react";
import { PUBLIC_CONTENT_LAST_UPDATED } from "@/lib/publicContent";

const EASE_OUT = "easeOut" as const;

const fadeUp = {
  hidden: { opacity: 0, y: 22 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.07, duration: 0.5, ease: EASE_OUT },
  }),
};

const alphaScreenLinks = [
  { label: "Overview", href: "/alphascreen" },
  { label: "Pricing", href: "/alphascreen/pricing" },
  { label: "How it works", href: "/alphascreen/how-it-works" },
  { label: "Security", href: "/alphascreen/security" },
  { label: "Candidate experience", href: "/alphascreen/candidate-experience" },
  { label: "Dental groups", href: "/alphascreen/for-dental-groups" },
  { label: "ROI estimator", href: "/alphascreen/roi" },
  { label: "FAQ", href: "/faq" },
];

const pricing = {
  basic: {
    name: "Basic",
    monthly: 299,
    annual: 3299,
    role: 399,
    included: 20,
    cap: 10,
    additional: 30,
  },
  pro: {
    name: "Pro",
    monthly: 599,
    annual: 6499,
    role: 699,
    included: 30,
    cap: 12,
    additional: 35,
  },
};

type MembershipKey = keyof typeof pricing;
type CadenceKey = "monthly" | "annual";

function formatUsd(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function PageHero({
  eyebrow,
  title,
  body,
  children,
}: {
  eyebrow: string;
  title: string;
  body: string;
  children?: ReactNode;
}) {
  return (
    <section className="relative overflow-hidden bg-[#F8F9FD] pt-28">
      <div
        className="absolute inset-0 opacity-25"
        style={{
          backgroundImage: "radial-gradient(circle at 1px 1px, rgba(10,21,71,0.14) 1px, transparent 0)",
          backgroundSize: "36px 36px",
        }}
      />
      <div className="relative mx-auto max-w-7xl px-6 pb-14 pt-10 lg:px-8 lg:pb-18">
        <motion.div initial="hidden" animate="visible" variants={fadeUp} className="max-w-4xl">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#A380F6]/25 bg-white px-3 py-1.5 text-sm font-bold text-[#A380F6] shadow-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-[#02D99D]" />
            {eyebrow}
          </div>
          <h1 className="max-w-4xl text-4xl font-black leading-[1.05] tracking-normal text-[#0A1547] lg:text-6xl">
            {title}
          </h1>
          <p className="mt-5 max-w-3xl text-lg leading-relaxed text-[#0A1547]/65">{body}</p>
          <p className="mt-4 text-sm font-semibold text-[#0A1547]/45">Last updated {PUBLIC_CONTENT_LAST_UPDATED}</p>
          {children ? <div className="mt-8">{children}</div> : null}
        </motion.div>
      </div>
    </section>
  );
}

function CtaRow() {
  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      <a
        href="/alphascreen/pricing"
        className="inline-flex items-center justify-center gap-2 rounded-full bg-[#0A1547] px-5 py-3 text-sm font-black text-white transition-opacity hover:opacity-90"
        data-analytics-cta="Compare alphaScreen memberships"
        data-analytics-placement="alphascreen-retail-page"
      >
        Compare memberships
        <ArrowRight className="h-4 w-4" />
      </a>
      <a
        href="/#contact"
        className="inline-flex items-center justify-center gap-2 rounded-full border border-[#0A1547]/12 bg-white px-5 py-3 text-sm font-black text-[#0A1547] transition-colors hover:border-[#A380F6] hover:text-[#A380F6]"
        data-analytics-cta="Request a Demo"
        data-analytics-placement="alphascreen-retail-page"
      >
        Request a demo
      </a>
    </div>
  );
}

function RelatedLinks({ current }: { current: string }) {
  return (
    <section className="bg-white py-12">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="rounded-lg border border-[#0A1547]/10 bg-[#F8F9FD] p-5">
          <p className="mb-3 text-xs font-black uppercase tracking-[0.18em] text-[#A380F6]">Related alphaScreen pages</p>
          <div className="flex flex-wrap gap-2">
            {alphaScreenLinks
              .filter((link) => link.href !== current)
              .map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="rounded-full border border-[#0A1547]/10 bg-white px-3 py-2 text-xs font-black text-[#0A1547]/65 transition-colors hover:border-[#A380F6]/45 hover:text-[#A380F6]"
                  data-analytics-cta={link.label}
                  data-analytics-placement="alphascreen-related-links"
                >
                  {link.label}
                </a>
              ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function CardGrid({
  items,
  columns = "lg:grid-cols-3",
}: {
  items: Array<{ icon?: ReactNode; title: string; body: string }>;
  columns?: string;
}) {
  return (
    <div className={`grid gap-4 md:grid-cols-2 ${columns}`}>
      {items.map((item, index) => (
        <motion.article
          key={item.title}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          variants={fadeUp}
          custom={index}
          className="rounded-lg border border-[#0A1547]/10 bg-white p-5 shadow-sm"
        >
          {item.icon ? (
            <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-[#A380F6]/10 text-[#A380F6]">
              {item.icon}
            </div>
          ) : null}
          <h3 className="text-base font-black leading-snug text-[#0A1547]">{item.title}</h3>
          <p className="mt-3 text-sm leading-relaxed text-[#0A1547]/60">{item.body}</p>
        </motion.article>
      ))}
    </div>
  );
}

export function AlphaScreenHowItWorksPage() {
  const steps = [
    ["1", "Choose a membership", "Compare Basic, Pro, or Enterprise options and select the membership that fits your hiring volume."],
    ["2", "Add role needs", "Enter the company and buyer details needed to prepare the membership signup workflow."],
    ["3", "Sign agreement", "Review and sign the membership agreement before payment is collected."],
    ["4", "Complete Stripe Checkout", "Finish secure checkout after agreement signing."],
    ["5", "Set your password", "Use the account setup flow to create access for your alphaScreen dashboard."],
    ["6", "Create roles", "Configure role criteria, interview needs, and what good looks like for the hiring team."],
    ["7", "Invite candidates", "Send candidates into a structured AI avatar screening interview tied to the role."],
    ["8", "Review reports", "Review candidate reports and decide next steps. The hiring team stays in control."],
  ];

  return (
    <div className="bg-white">
      <PageHero
        eyebrow="alphaScreen workflow"
        title="How alphaScreen self-serve signup and screening work."
        body="A simple public workflow for moving from membership selection to structured candidate review, while keeping agreement review, payment, setup, and hiring decisions clear."
      >
        <CtaRow />
      </PageHero>

      <section className="bg-white py-16 lg:py-20">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mb-8 max-w-3xl">
            <p className="text-sm font-black uppercase tracking-[0.18em] text-[#02ABE0]">Step by step</p>
            <h2 className="mt-3 text-3xl font-black leading-tight text-[#0A1547] lg:text-4xl">From membership to first candidate review</h2>
            <p className="mt-4 text-sm leading-relaxed text-[#0A1547]/60">
              alphaScreen separates commercial setup from hiring review so buyers know what happens before and after checkout.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map(([step, title, body]) => (
              <article key={step} className="rounded-lg border border-[#0A1547]/10 bg-[#F8F9FD] p-5">
                <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-full bg-[#0A1547] text-sm font-black text-white">
                  {step}
                </div>
                <h3 className="text-base font-black text-[#0A1547]">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[#0A1547]/60">{body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#F8F9FD] py-16 lg:py-20">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mb-8 max-w-3xl">
            <p className="text-sm font-black uppercase tracking-[0.18em] text-[#A380F6]">After signup</p>
            <h2 className="mt-3 text-3xl font-black leading-tight text-[#0A1547]">What happens after the company signs up?</h2>
          </div>
          <CardGrid
            items={[
              { icon: <LockKeyhole className="h-5 w-5" />, title: "Account access is set up", body: "The buyer completes password setup and receives access to the alphaScreen dashboard." },
              { icon: <ClipboardCheck className="h-5 w-5" />, title: "Roles are configured", body: "Hiring teams create roles with criteria that support structured, consistent screening." },
              { icon: <Users className="h-5 w-5" />, title: "Candidates are invited", body: "Candidates receive a screening interview link and complete the interview on their own schedule." },
              { icon: <FileText className="h-5 w-5" />, title: "Reports support review", body: "Reports organize resume and interview information so the team can decide next steps." },
              { icon: <ShieldCheck className="h-5 w-5" />, title: "Humans remain responsible", body: "alphaScreen supports review. Employers still manage communication, accommodation, and hiring decisions." },
              { icon: <ArrowRight className="h-5 w-5" />, title: "Next page to review", body: "Compare candidate experience, data handling, ROI, and pricing before starting a membership." },
            ]}
            columns="lg:grid-cols-3"
          />
        </div>
      </section>

      <RelatedLinks current="/alphascreen/how-it-works" />
    </div>
  );
}

export function AlphaScreenSecurityPage() {
  return (
    <div className="bg-white">
      <PageHero
        eyebrow="Security and data"
        title="Candidate data protection, access, and human review."
        body="alphaScreen is designed to support structured screening while keeping candidate information, account access, and hiring decisions handled through controlled workflows."
      >
        <CtaRow />
      </PageHero>

      <section className="bg-white py-16 lg:py-20">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mb-8 max-w-3xl">
            <p className="text-sm font-black uppercase tracking-[0.18em] text-[#02ABE0]">What alphaScreen handles</p>
            <h2 className="mt-3 text-3xl font-black leading-tight text-[#0A1547]">Data collected for screening and review</h2>
            <p className="mt-4 text-sm leading-relaxed text-[#0A1547]/60">
              The exact information depends on role setup and account configuration, but public buyer expectations should be clear before signup.
            </p>
          </div>
          <CardGrid
            items={[
              { icon: <Users className="h-5 w-5" />, title: "Candidate and role details", body: "Candidate contact details, role context, and employer-provided screening criteria support the review workflow." },
              { icon: <FileText className="h-5 w-5" />, title: "Resume and interview information", body: "Resume content, interview responses, and report summaries may be available for authorized review." },
              { icon: <ClipboardCheck className="h-5 w-5" />, title: "Reports and scoring support", body: "Reports organize information for hiring teams. They do not make the final employment decision." },
            ]}
          />
        </div>
      </section>

      <section className="bg-[#F8F9FD] py-16 lg:py-20">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.18em] text-[#A380F6]">Trust posture</p>
              <h2 className="mt-3 text-3xl font-black leading-tight text-[#0A1547]">Designed for controlled hiring access</h2>
              <p className="mt-4 text-sm leading-relaxed text-[#0A1547]/60">
                alphaSource avoids public claims about certifications or legal compliance that are not published. Buyers should use the Privacy Policy, agreement, and support process for specific requirements.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {[
                "Access is intended for authorized hiring users and admins.",
                "Candidate reports are review aids for employer decision-makers.",
                "Hiring teams remain responsible for candidate communication and decisions.",
                "Privacy and data questions can be routed through alphaSource support.",
                "Published privacy terms should be reviewed before signup.",
                "No certification, audit, or legal compliance claim is made on this page.",
              ].map((item) => (
                <div key={item} className="flex gap-3 rounded-lg border border-[#0A1547]/10 bg-white p-4">
                  <CheckCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#02D99D]" />
                  <p className="text-sm font-semibold leading-relaxed text-[#0A1547]/65">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white py-12">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="rounded-lg border border-[#0A1547]/10 bg-[#F8F9FD] p-6">
            <h2 className="text-2xl font-black text-[#0A1547]">Need a security or privacy answer before buying?</h2>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-[#0A1547]/60">
              Review the public Privacy Policy, read the FAQ, or contact alphaSource with your data protection questions before starting a membership.
            </p>
            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <a href="/privacy" className="inline-flex items-center justify-center rounded-full bg-[#0A1547] px-5 py-3 text-sm font-black text-white">Read Privacy Policy</a>
              <a href="/faq" className="inline-flex items-center justify-center rounded-full border border-[#0A1547]/12 bg-white px-5 py-3 text-sm font-black text-[#0A1547]">Read FAQ</a>
            </div>
          </div>
        </div>
      </section>

      <RelatedLinks current="/alphascreen/security" />
    </div>
  );
}

export function AlphaScreenCandidateExperiencePage() {
  return (
    <div className="bg-white">
      <PageHero
        eyebrow="Candidate experience"
        title="A structured interview experience candidates can understand."
        body="alphaScreen gives candidates a clear role-based screening interview while giving employers a more consistent record to review."
      >
        <CtaRow />
      </PageHero>

      <section className="bg-white py-16 lg:py-20">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mb-8 max-w-3xl">
            <p className="text-sm font-black uppercase tracking-[0.18em] text-[#02ABE0]">Candidate journey</p>
            <h2 className="mt-3 text-3xl font-black leading-tight text-[#0A1547]">What candidates experience</h2>
          </div>
          <CardGrid
            items={[
              { icon: <ArrowRight className="h-5 w-5" />, title: "They receive an interview link", body: "Candidates are invited to a web-based structured screening interview for a specific role." },
              { icon: <ClipboardCheck className="h-5 w-5" />, title: "They answer role-based questions", body: "The interview is organized around consistent criteria instead of a loose first-pass phone screen." },
              { icon: <Clock3 className="h-5 w-5" />, title: "They complete it on their schedule", body: "Candidates can complete the screening interview from a web link, subject to the employer's instructions." },
              { icon: <FileText className="h-5 w-5" />, title: "The team reviews the report", body: "Hiring teams review the generated report and decide whether to advance, pause, or reject the candidate." },
            ]}
            columns="lg:grid-cols-4"
          />
        </div>
      </section>

      <section className="bg-[#F8F9FD] py-16 lg:py-20">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mb-8 max-w-3xl">
            <p className="text-sm font-black uppercase tracking-[0.18em] text-[#A380F6]">Buyer questions</p>
            <h2 className="mt-3 text-3xl font-black leading-tight text-[#0A1547]">Common candidate-experience concerns</h2>
          </div>
          <CardGrid
            items={[
              { title: "Will candidates understand what to do?", body: "The workflow is designed around a clear interview link and role-based screening experience. Employers should still provide any company-specific instructions candidates need." },
              { title: "Does this replace human review?", body: "No. alphaScreen supports structured review, but the hiring team remains responsible for follow-up, accommodations, and final decisions." },
              { title: "What if a candidate needs accommodation?", body: "Accommodation requests should be handled by the employer's hiring process and any available alphaScreen support path. The platform should not remove human judgment from that process." },
              { title: "What does the hiring team see?", body: "Hiring teams may review resume analysis, interview response information, scores, summaries, and reports, depending on the role and account configuration." },
            ]}
            columns="lg:grid-cols-4"
          />
        </div>
      </section>

      <RelatedLinks current="/alphascreen/candidate-experience" />
    </div>
  );
}

export function AlphaScreenDentalGroupsPage() {
  return (
    <div className="bg-white">
      <PageHero
        eyebrow="Dental and multi-location hiring"
        title="Structured hiring for dental groups, DSOs, and multi-location teams."
        body="alphaScreen is built for structured hiring teams broadly, with strong fit for dental and healthcare-adjacent operators that need consistent screening across locations."
      >
        <CtaRow />
      </PageHero>

      <section className="bg-white py-16 lg:py-20">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mb-8 max-w-3xl">
            <p className="text-sm font-black uppercase tracking-[0.18em] text-[#02ABE0]">Strong fit use case</p>
            <h2 className="mt-3 text-3xl font-black leading-tight text-[#0A1547]">Why dental groups often need structured screening</h2>
            <p className="mt-4 text-sm leading-relaxed text-[#0A1547]/60">
              Dental and multi-location operators often screen high-volume roles across practices, regions, and managers. alphaScreen helps standardize the first-pass review without making the whole product dental-only.
            </p>
          </div>
          <CardGrid
            items={[
              { icon: <Stethoscope className="h-5 w-5" />, title: "Practice-level hiring", body: "Useful for roles such as front desk, dental assistant, hygienist, treatment coordinator, office manager, and regional support." },
              { icon: <Building2 className="h-5 w-5" />, title: "Multi-location consistency", body: "Standardized screening helps operators compare candidates across locations without relying only on uneven phone screens." },
              { icon: <Users className="h-5 w-5" />, title: "Manager time pressure", body: "Hiring managers can spend less time on repetitive first-pass screens and more time with candidates worth deeper review." },
            ]}
          />
        </div>
      </section>

      <section className="bg-[#F8F9FD] py-16 lg:py-20">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.18em] text-[#A380F6]">Broader market</p>
              <h2 className="mt-3 text-3xl font-black leading-tight text-[#0A1547]">Also useful outside dental</h2>
              <p className="mt-4 text-sm leading-relaxed text-[#0A1547]/60">
                This page speaks directly to dental operators because they are a strong fit. alphaScreen also supports other teams that need structured, repeatable screening.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {[
                "People-driven teams with repeated frontline hiring needs.",
                "Organizations where multiple managers screen for similar roles.",
                "Teams that want consistent first-pass criteria before later interviews.",
                "Operators that need clearer candidate records across locations.",
              ].map((item) => (
                <div key={item} className="flex gap-3 rounded-lg border border-[#0A1547]/10 bg-white p-4">
                  <CheckCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#02D99D]" />
                  <p className="text-sm font-semibold leading-relaxed text-[#0A1547]/65">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <RelatedLinks current="/alphascreen/for-dental-groups" />
    </div>
  );
}

export function AlphaScreenRoiPage() {
  const [roles, setRoles] = useState(4);
  const [candidatesPerRole, setCandidatesPerRole] = useState(25);
  const [minutesPerScreen, setMinutesPerScreen] = useState(60);
  const [hourlyCost, setHourlyCost] = useState(55);
  const [membership, setMembership] = useState<MembershipKey>("basic");
  const [cadence, setCadence] = useState<CadenceKey>("monthly");

  const estimate = useMemo(() => {
    const selected = pricing[membership];
    const safeRoles = Math.max(0, roles);
    const safeCandidates = Math.max(0, candidatesPerRole);
    const safeMinutes = Math.max(0, minutesPerScreen);
    const safeHourly = Math.max(0, hourlyCost);
    const hours = (safeRoles * safeCandidates * safeMinutes) / 60;
    const value = hours * safeHourly;
    const platformMonthly = cadence === "annual" ? selected.annual / 12 : selected.monthly;
    const roleFees = safeRoles * selected.role;
    const additionalInterviews = Math.max(0, safeCandidates - selected.included) * safeRoles;
    const additionalFees = additionalInterviews * selected.additional;
    const totalCost = platformMonthly + roleFees + additionalFees;

    return {
      selected,
      hours,
      value,
      platformMonthly,
      roleFees,
      additionalInterviews,
      additionalFees,
      totalCost,
      net: value - totalCost,
    };
  }, [cadence, candidatesPerRole, hourlyCost, membership, minutesPerScreen, roles]);

  const numericInputs: Array<{ label: string; value: number; setValue: (value: number) => void }> = [
    { label: "Roles opened per month", value: roles, setValue: setRoles },
    { label: "Candidates screened per role", value: candidatesPerRole, setValue: setCandidatesPerRole },
    { label: "Average minutes per initial screen, including pre- and post-call admin time", value: minutesPerScreen, setValue: setMinutesPerScreen },
    { label: "Manager or recruiter hourly cost", value: hourlyCost, setValue: setHourlyCost },
  ];

  const resultCards: Array<{ label: string; value: string; icon: ReactNode }> = [
    { label: "Screening hours represented", value: `${estimate.hours.toFixed(1)} hrs`, icon: <Clock3 className="h-4 w-4" /> },
    { label: "Estimated labor cost of initial screening", value: formatUsd(estimate.value), icon: <BadgeDollarSign className="h-4 w-4" /> },
    {
      label: "Platform cost",
      value: `${formatUsd(estimate.platformMonthly)} / mo${cadence === "annual" ? " equivalent" : ""}`,
      icon: <Calculator className="h-4 w-4" />,
    },
    { label: "Role fees", value: formatUsd(estimate.roleFees), icon: <ClipboardCheck className="h-4 w-4" /> },
    { label: "Additional interviews", value: `${estimate.additionalInterviews} x ${formatUsd(estimate.selected.additional)}`, icon: <Users className="h-4 w-4" /> },
    { label: "Total estimated alphaScreen cost", value: formatUsd(estimate.totalCost), icon: <BadgeDollarSign className="h-4 w-4" /> },
  ];
  const potentialSavings = Math.max(0, estimate.net);

  return (
    <div className="bg-white">
      <PageHero
        eyebrow="Value estimator"
        title="alphaScreen Value Estimator"
        body="Estimate how much manual screening time and labor cost your team may be able to redirect with structured AI-assisted screenings."
      >
        <CtaRow />
      </PageHero>

      <section className="bg-white py-16 lg:py-20">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="grid items-stretch gap-8 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="flex h-full flex-col rounded-lg border border-[#0A1547]/10 bg-[#F8F9FD] p-6">
              <div className="mb-6 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#A380F6]/10 text-[#A380F6]">
                  <Calculator className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-[#0A1547]">Screening estimate inputs</h2>
                  <p className="text-sm font-semibold text-[#0A1547]/50">Adjust these values for a typical month.</p>
                </div>
              </div>

              <div className="flex flex-1 flex-col gap-4">
                {numericInputs.map((input) => (
                  <label key={input.label} className="grid gap-2">
                    <span className="text-sm font-black text-[#0A1547]">{input.label}</span>
                    <input
                      type="number"
                      min="0"
                      value={input.value}
                      onChange={(event) => input.setValue(Number(event.target.value))}
                      className="min-h-11 rounded-lg border border-[#0A1547]/12 bg-white px-3 text-sm font-bold text-[#0A1547] outline-none transition-colors focus:border-[#A380F6]"
                    />
                  </label>
                ))}

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="grid gap-2">
                    <span className="text-sm font-black text-[#0A1547]">Membership</span>
                    <select
                      value={membership}
                      onChange={(event) => setMembership(event.target.value as MembershipKey)}
                      className="min-h-11 rounded-lg border border-[#0A1547]/12 bg-white px-3 text-sm font-bold text-[#0A1547] outline-none transition-colors focus:border-[#A380F6]"
                    >
                      <option value="basic">Basic</option>
                      <option value="pro">Pro</option>
                    </select>
                  </label>
                  <label className="grid gap-2">
                    <span className="text-sm font-black text-[#0A1547]">Billing cadence</span>
                    <select
                      value={cadence}
                      onChange={(event) => setCadence(event.target.value as CadenceKey)}
                      className="min-h-11 rounded-lg border border-[#0A1547]/12 bg-white px-3 text-sm font-bold text-[#0A1547] outline-none transition-colors focus:border-[#A380F6]"
                    >
                      <option value="monthly">Monthly</option>
                      <option value="annual">Annual</option>
                    </select>
                  </label>
                </div>

                <div className="mt-auto rounded-lg border border-[#0A1547]/10 bg-white p-4">
                  <p className="text-sm font-black text-[#0A1547]">{estimate.selected.name} membership assumptions</p>
                  <p className="mt-2 text-sm leading-relaxed text-[#0A1547]/60">
                    Includes {estimate.selected.included} interviews per role, {estimate.selected.cap}-minute interview cap, {formatUsd(estimate.selected.role)} per role, and {formatUsd(estimate.selected.additional)} per additional interview.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex h-full flex-col rounded-lg border border-[#0A1547]/10 bg-white p-6 shadow-sm">
              <div className="mb-6 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#02D99D]/10 text-[#02D99D]">
                  <LineChart className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-[#0A1547]">Estimated monthly comparison</h2>
                  <p className="text-sm font-semibold text-[#0A1547]/50">Based on the values entered in the calculator.</p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {resultCards.map((card) => (
                  <div key={card.label} className="rounded-lg border border-[#0A1547]/10 bg-[#F8F9FD] p-4">
                    <div className="mb-2 text-[#A380F6]">{card.icon}</div>
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-[#0A1547]/45">{card.label}</p>
                    <p className="mt-1 text-xl font-black text-[#0A1547]">{card.value}</p>
                  </div>
                ))}
              </div>

              <div className="mt-5 rounded-lg border border-[#02D99D]/25 bg-[#02D99D]/10 p-5">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-[#0A1547]/45">Estimated potential savings</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="text-3xl font-black text-[#0A1547]">{formatUsd(potentialSavings)}</p>
                    <p className="mt-1 text-xs font-black uppercase tracking-[0.14em] text-[#0A1547]/45">Estimated cost savings</p>
                  </div>
                  <div>
                    <p className="text-3xl font-black text-[#0A1547]">{estimate.hours.toFixed(1)} hrs</p>
                    <p className="mt-1 text-xs font-black uppercase tracking-[0.14em] text-[#0A1547]/45">Estimated team hours saved</p>
                  </div>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-[#0A1547]/60">
                  Estimated screening time represented by the inputs above. Actual time recovered depends on your review process, role complexity, and candidate volume.
                </p>
                <p className="mt-3 text-sm font-semibold leading-relaxed text-[#0A1547]/60">
                  <strong>Additional value</strong> may also come from <strong>efficiency gains</strong> when hiring managers can spend recovered screening time on higher-value work.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-6 rounded-lg border border-[#0A1547]/10 bg-[#F8F9FD] p-4">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[#0A1547]/45">Supporting notes</p>
            <p className="mt-2 text-xs font-semibold leading-relaxed text-[#0A1547]/55">
              alphaScreen can collect structured candidate responses outside normal working hours, while hiring managers are typically limited to business-hour review time.
            </p>
            <p className="mt-2 text-[11px] font-semibold leading-relaxed text-[#0A1547]/45">
              * This estimate does not include downstream hiring outcomes, offer acceptance, retention, or the operational value of faster manager review.
            </p>
            <p className="mt-2 text-[11px] font-semibold leading-relaxed text-[#0A1547]/45">
              * This estimate compares the labor cost of manual initial screening against the selected alphaScreen membership and role costs. It is not a guarantee of savings, hiring outcomes, or candidate quality.
            </p>
          </div>
        </div>
      </section>

      <RelatedLinks current="/alphascreen/roi" />
    </div>
  );
}
