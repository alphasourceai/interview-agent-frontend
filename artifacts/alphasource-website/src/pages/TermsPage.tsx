import { motion } from "framer-motion";

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[#F8F9FD]">
      {/* Hero */}
      <div className="relative pt-32 pb-16 overflow-hidden">
        <div className="absolute inset-0 gradient-hero-bg" />
        <div className="relative max-w-4xl mx-auto px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-[#0A1547]/10 text-sm font-medium text-[#0A1547]/60 mb-5 shadow-sm">
              Legal
            </div>
            <h1 className="text-4xl lg:text-5xl font-black text-[#0A1547] leading-tight mb-3">
              Terms &amp; Conditions
            </h1>
            <p className="text-base text-[#0A1547]/50">Effective Date: 12/8/2025</p>
          </motion.div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-6 lg:px-8 pb-24">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.5 }}
          className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 lg:p-12 prose prose-sm max-w-none"
          style={{ color: "#0A1547" }}
        >
          <p className="text-[#0A1547]/70 leading-relaxed mb-8">
            These Terms &amp; Conditions ("Terms") govern your use of the AI Interviewer platform and related services ("Service") provided by alphaSource AI, LLC ("Company," "we," "our"). By accessing or using the Service—whether as a client/employer or as a candidate—you agree to these Terms. If you do not agree, do not use the Service.
          </p>

          <Section number="1" title="PURPOSE OF THE SERVICE">
            <p>The Service provides AI-assisted interviewing, assessments, analysis, and reporting. It is designed to support—but not replace—human evaluation. Employers remain fully responsible for their hiring decisions.</p>
            <p>Candidates understand that the Service uses artificial intelligence to record, process, evaluate, and analyze interview responses and related data.</p>
          </Section>

          <Section number="2" title="ELIGIBILITY">
            <ul>
              <li>You must be at least 18 years old and legally permitted to use the Service.</li>
              <li>Clients/employers confirm they are authorized by their organization to use this platform for interviewing and evaluation purposes.</li>
              <li>Candidates confirm they are voluntarily participating in an interview facilitated through the platform.</li>
            </ul>
          </Section>

          <Section number="3" title="USER RESPONSIBILITIES">
            <p>All users agree to:</p>
            <ul>
              <li>Provide complete and accurate information.</li>
              <li>Use the Service only for lawful purposes.</li>
              <li>Comply with all applicable employment, privacy, and data protection laws.</li>
              <li>Not disrupt, misuse, reverse engineer, or overload the Service.</li>
            </ul>
            <p>Clients/employers additionally agree to:</p>
            <ul>
              <li>Use the data and AI insights responsibly and legally.</li>
              <li>Obtain all necessary permissions before submitting candidate data.</li>
              <li>Ensure compliance with EEOC, ADA, FCRA (when applicable), and all hiring regulations.</li>
            </ul>
            <p>Candidates additionally agree to:</p>
            <ul>
              <li>Provide truthful information during submission and interviews.</li>
              <li>Not impersonate others or attempt to deceive the system.</li>
            </ul>
          </Section>

          <Section number="4" title="CANDIDATE DATA, PRIVACY & CONSENT">
            <p>By using the Service, candidates and clients/employers acknowledge that:</p>
            <ul>
              <li>The platform processes resumes, interview responses, video/audio recordings, transcripts, behavioral analytics, and scoring data.</li>
              <li>Candidate data is used ONLY for interview, evaluation, and reporting purposes.</li>
              <li>Candidates grant permission for their data to be recorded, analyzed by AI, and reviewed by the hiring organization.</li>
              <li>Candidates may request deletion of their data to the extent permitted by law.</li>
            </ul>
            <p>We do NOT sell candidate data.</p>
            <p>We may retain anonymized or aggregated data to improve the Service.</p>
          </Section>

          <Section number="5" title="AI-GENERATED ANALYSIS & LIMITATIONS">
            <p>The Service uses AI models to provide insights, scoring, behavioral analysis, and summaries.</p>
            <p>Users understand and agree:</p>
            <ul>
              <li>AI outputs may contain inaccuracies or omissions.</li>
              <li>Outputs are informational only and not definitive evaluations of skills, personality, or suitability.</li>
              <li>Employers must not use AI outputs as the sole basis for hiring decisions.</li>
              <li>Candidates should not interpret AI-generated feedback as a guarantee of job outcome or performance measure.</li>
            </ul>
            <p>The Company does not guarantee the accuracy, completeness, or suitability of AI results.</p>
          </Section>

          <Section number="6" title="COMPLIANCE WITH EMPLOYMENT & ANTI-DISCRIMINATION LAWS">
            <p>Clients/employers agree they are solely responsible for ensuring:</p>
            <ul>
              <li>Interview, analysis, scoring, and hiring decisions comply with all applicable laws.</li>
              <li>Candidates are notified when AI is used (where required).</li>
              <li>Human oversight is always applied in the final hiring decision.</li>
            </ul>
            <p>The Company is NOT responsible for any compliance failures by clients/employers.</p>
            <p className="font-semibold mt-4">Accessibility &amp; Accommodations (ADA)</p>
            <p>alphaSource AI is committed to providing reasonable accommodations to qualified individuals with disabilities so they can participate in the interview process. If you need an accommodation to complete your interview (for example, a text-based alternative to a video interview, additional time, or another adjustment), please request one using the "Need an accommodation?" link on this page.</p>
            <p>Accommodation requests are reviewed by the hiring team and/or their designated representative. If approved, we will provide an alternate interview option or other reasonable adjustment. We may ask for information needed to evaluate and implement the request, but we do not require disclosure of confidential medical details.</p>
            <p>Requests should be submitted as soon as possible. We will respond within 48 business hours. If you have immediate accessibility issues, contact <a href="mailto:info@alphasourceai.com" className="text-[#A380F6] hover:underline">info@alphasourceai.com</a>.</p>
            <p>Submitting an accommodation request will not negatively impact your candidacy.</p>
          </Section>

          <Section number="7" title="INTELLECTUAL PROPERTY">
            <p>All platform software, scoring logic, models, prompts, workflows, and designs belong to the Company.</p>
            <p>Users receive a limited, revocable license to use the Service for legitimate business or interview participation only.</p>
            <p>Candidate-uploaded materials (e.g., resumes) remain the property of the candidate and are licensed to the employer and the Company for the purpose of providing the Service.</p>
          </Section>

          <Section number="8" title="PROHIBITED USES">
            <p>No user may:</p>
            <ul>
              <li>Use the Service for automated decision-making unrelated to interviewing.</li>
              <li>Use data from the Service to develop competing products.</li>
              <li>Attempt to bypass security or access controls.</li>
              <li>Submit malicious code or harmful content.</li>
            </ul>
            <p>The Company may suspend or terminate access for violations.</p>
          </Section>

          <Section number="9" title="SERVICE AVAILABILITY & MODIFICATIONS">
            <p>The Company may modify, update, or discontinue components of the Service at any time.</p>
            <p>We do not guarantee uninterrupted uptime or compatibility with all devices.</p>
          </Section>

          <Section number="10" title="DISCLAIMERS">
            <p>THE SERVICE IS PROVIDED "AS-IS" AND "AS-AVAILABLE."</p>
            <p>WE DISCLAIM ALL WARRANTIES, INCLUDING FITNESS FOR A PARTICULAR PURPOSE, ACCURACY, NON-INFRINGEMENT, AND RELIABILITY.</p>
            <p>AI-GENERATED OUTPUTS MAY CONTAIN ERRORS.</p>
            <p>USERS ACCEPT FULL RESPONSIBILITY FOR HOW THEY INTERPRET OR USE RESULTS.</p>
          </Section>

          <Section number="11" title="LIMITATION OF LIABILITY">
            <p>TO THE MAXIMUM EXTENT PERMITTED BY LAW:</p>
            <p>IN NO EVENT SHALL WE BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, EXEMPLARY, OR PUNITIVE DAMAGES, INCLUDING WITHOUT LIMITATION LOSS OF PROFITS, REVENUE, DATA, OR USE, OR THE COST OF SUBSTITUTE SERVICES, ARISING OUT OF OR RELATED TO THE PLATFORM, THE AI INTERVIEWER, ANY ASSESSMENTS OR RECOMMENDATIONS GENERATED, OR ANY HIRING DECISIONS MADE BY CLIENTS.</p>
            <p>OUR TOTAL AGGREGATE LIABILITY FOR ANY CLAIM ARISING OUT OF OR RELATED TO THESE TERMS OR THE USE OF THE PLATFORM SHALL NOT EXCEED THE TOTAL FEES PAID TO US BY THE CLIENT IN THE TWELVE (12) MONTHS PRECEDING THE EVENT GIVING RISE TO THE CLAIM. FOR CANDIDATE USERS, OUR TOTAL AGGREGATE LIABILITY SHALL NOT EXCEED ONE HUNDRED U.S. DOLLARS (USD $100).</p>
            <p>THE PARTIES ACKNOWLEDGE THAT THIS LIMITATION OF LIABILITY IS A FUNDAMENTAL BASIS OF THE BARGAIN AND REFLECTS A FAIR ALLOCATION OF RISK. NO ACTION, REGARDLESS OF FORM, MAY BE BROUGHT BY ANY USER MORE THAN ONE (1) YEAR AFTER THE CAUSE OF ACTION HAS ACCRUED.</p>
            <p>The Company is NOT liable for:</p>
            <ul>
              <li>Hiring outcomes or employment decisions.</li>
              <li>Misuse of AI outputs.</li>
              <li>Unauthorized access caused by user actions.</li>
              <li>Losses resulting from inaccurate or incomplete AI-generated content.</li>
            </ul>
          </Section>

          <Section number="12" title="INDEMNIFICATION">
            <p>Clients/employers agree to indemnify the Company against claims arising from:</p>
            <ul>
              <li>Their hiring decisions or compliance failures.</li>
              <li>Their misuse of candidate data.</li>
              <li>Violations of these Terms.</li>
            </ul>
            <p>Candidates agree to indemnify the Company for:</p>
            <ul>
              <li>Misuse of the Service.</li>
              <li>Providing false information or uploading unauthorized content.</li>
            </ul>
          </Section>

          <Section number="13" title="TERMINATION">
            <p>We may suspend or terminate access for any user at our discretion.</p>
            <p>Upon termination, all rights to use the Service cease immediately.</p>
          </Section>

          <Section number="14" title="GOVERNING LAW">
            <p>These Terms are governed by the laws of the State of Wyoming.</p>
            <p>Disputes will be resolved exclusively in the courts located in Wyoming.</p>
          </Section>

          <Section number="15" title="UPDATES TO THESE TERMS">
            <p>We may update or revise these Terms at any time.</p>
            <p>Continued use of the Service constitutes acceptance of any updated Terms.</p>
          </Section>

          <Section number="16" title="CONTACT INFORMATION" last>
            <p>alphaSource Network, LLC (dba alphaSource AI)</p>
            <p>Email: <a href="mailto:info@alphasourceai.com" className="text-[#A380F6] hover:underline">info@alphasourceai.com</a></p>
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
