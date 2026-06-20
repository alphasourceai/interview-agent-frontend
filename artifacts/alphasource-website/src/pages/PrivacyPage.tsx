import { motion } from "framer-motion";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#F8F9FD]">
      <div className="relative pt-32 pb-16 overflow-hidden">
        <div className="absolute inset-0 gradient-hero-bg" />
        <div className="relative max-w-4xl mx-auto px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-[#0A1547]/10 text-sm font-medium text-[#0A1547]/60 mb-5 shadow-sm">
              Privacy
            </div>
            <h1 className="text-4xl lg:text-5xl font-black text-[#0A1547] leading-tight mb-3">
              Privacy Policy
            </h1>
            <p className="text-base text-[#0A1547]/50">Effective Date: 6/20/2026</p>
          </motion.div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 lg:px-8 pb-24">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.5 }}
          className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 lg:p-12 prose prose-sm max-w-none"
          style={{ color: "#0A1547" }}
        >
          <p className="text-[#0A1547]/70 leading-relaxed mb-8">
            This Privacy Policy explains how alphaSource Network, LLC, doing business as alphaSource AI, collects and uses limited information through the public website, alphaScreen, and related product workflows. It focuses on public website analytics, contact and demo form behavior, and high-level product data practices.
          </p>

          <Section number="1" title="OVERVIEW">
            <p>
              alphaSource AI collects limited information to operate the public website, respond to inquiries, understand interest in alphaScreen, support product workflows, and improve our services. The information collected depends on how a visitor or customer interacts with the website or product.
            </p>
            <p>
              Public website activity is separate from authenticated dashboard, client, candidate, and account activity. Product and account data is handled according to applicable agreements, product controls, and customer configuration.
            </p>
          </Section>

          <Section number="2" title="PUBLIC WEBSITE ANALYTICS">
            <p>
              We may collect public page view information for pages such as the home page, alphaScreen page, about page, support and FAQ pages, terms and privacy pages, and other public landing pages. This may include page path, timestamp, referrer or source, campaign parameters, CTA interactions, device and browser-level technical information, and similar site-performance signals.
            </p>
            <p>
              We use this information to understand site performance, improve product messaging, measure interest, troubleshoot abuse or spam, and prepare self-serve purchasing workflows.
            </p>
            <p>
              Analytics events should not include names, email addresses, phone numbers, freeform message text, passwords, candidate interview responses, dashboard content, or private customer account data.
            </p>
          </Section>

          <Section number="3" title="CTA AND EVENT TRACKING">
            <p>
              Public call-to-action interactions may be tracked, including demo requests, contact links, signup or self-serve interest, navigation links, footer links, and hero calls to action. We use this information to understand visitor interest and improve the public website experience.
            </p>
          </Section>

          <Section number="4" title="LEAD DRAFT AND ABANDONED FORM CAPTURE">
            <p>
              If a visitor begins completing a public contact, demo, or inquiry form and enters usable business contact information, alphaSource AI may save a partial business-contact lead record even if the visitor does not complete the form.
            </p>
            <p>
              Message or freeform inquiry text is saved only when the visitor intentionally submits the form. Partial lead draft capture is used for business follow-up, assisting with inquiries, spam prevention, and service improvement.
            </p>
            <p>
              Visitors may ask us to delete their business contact information or ask not to be contacted.
            </p>
          </Section>

          <Section number="5" title="COOKIES AND SIMILAR TECHNOLOGIES">
            <p>
              The current public analytics and lead-capture workflow is designed not to require non-essential advertising cookies, ad pixels, retargeting cookies, cross-site tracking pixels, or session replay.
            </p>
            <p>
              If optional analytics, advertising, or similar technologies are added later, we will update disclosures and consent or opt-out controls where required.
            </p>
          </Section>

          <Section number="6" title="PRODUCT AND ACCOUNT DATA">
            <p>
              Authenticated dashboard, client, candidate, and product workflows may involve information that is different from public website analytics and public lead capture. That information is handled according to applicable agreements, product controls, access permissions, and operational requirements.
            </p>
            <p>
              This notice is not intended to replace customer agreements, product-specific notices, or security documentation that may apply to a particular alphaScreen deployment.
            </p>
          </Section>

          <Section number="7" title="CANDIDATE DATA">
            <p>
              Candidate, interview, and report data is used to provide screening and hiring workflow services requested by the client or employer. This may include information submitted by the candidate, interview responses, resume materials, transcripts, recordings where used, reports, and related workflow information.
            </p>
            <p>
              Final hiring decisions remain with the employer or hiring team. alphaSource AI does not sell candidate information or use candidate information for unrelated marketing purposes.
            </p>
          </Section>

          <Section number="8" title="SERVICE PROVIDERS AND DATA SHARING">
            <p>
              alphaSource AI uses service providers for hosting, analytics infrastructure, email, database and storage, payment, AI and video services, error monitoring, support, security, and related operations. These providers help us operate the website and services.
            </p>
            <p>
              We may share information when needed to provide services, support customers, comply with legal obligations, protect rights and security, or complete normal business operations.
            </p>
          </Section>

          <Section number="9" title="USER CHOICES AND CONTACT">
            <p>
              You may contact us with privacy questions, deletion requests, or requests not to be contacted. The best public contact method is email at{" "}
              <a href="mailto:info@alphasourceai.com" className="text-[#A380F6] hover:underline">
                info@alphasourceai.com
              </a>
              .
            </p>
            <p>
              We may need enough information to identify the relevant record and verify the request before taking action.
            </p>
          </Section>

          <Section number="10" title="CHANGES TO THIS NOTICE" last>
            <p>
              We may update this Privacy Policy as our website, products, services, and workflows evolve. The effective date above shows when this notice was last updated.
            </p>
          </Section>
        </motion.div>
      </div>
    </div>
  );
}

function Section({
  number,
  title,
  children,
  last = false,
}: {
  number: string;
  title: string;
  children: React.ReactNode;
  last?: boolean;
}) {
  return (
    <div className={`${last ? "" : "mb-10 pb-10 border-b border-gray-100"}`}>
      <h2 className="text-lg font-black text-[#0A1547] mb-4 flex items-baseline gap-3">
        <span
          className="text-sm font-bold px-2 py-0.5 rounded-md flex-shrink-0"
          style={{ backgroundColor: "#A380F615", color: "#A380F6" }}
        >
          {number}
        </span>
        {title}
      </h2>
      <div className="space-y-3 text-sm text-[#0A1547]/70 leading-relaxed [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1.5 [&_p]:leading-relaxed">
        {children}
      </div>
    </div>
  );
}
