export default function CandidateTermsPage() {
  return (
    <div className="min-h-screen bg-[#F8F9FD] flex flex-col" style={{ fontFamily: "'Raleway', sans-serif" }}>
      <header
        className="bg-white flex-shrink-0 flex items-center px-6 h-14"
        style={{ borderBottom: "1px solid rgba(10,21,71,0.07)" }}
      >
        <img src="/logo-dark-text.png" alt="alphaSource AI" className="h-8 w-auto" />
      </header>

      <main className="flex-1 flex items-start justify-center px-4 py-10 sm:py-12">
        <div
          className="bg-white rounded-2xl p-6 sm:p-8 w-full max-w-3xl"
          style={{
            border: "1px solid rgba(10,21,71,0.07)",
            boxShadow: "0 4px 24px rgba(10,21,71,0.08)",
          }}
        >
          <h1 className="text-2xl sm:text-3xl font-black text-[#0A1547] leading-tight">Candidate Terms &amp; Conditions</h1>
          <p className="mt-2 text-xs sm:text-sm text-[#0A1547]/50 font-semibold">Effective date: April 22, 2026</p>

          <section className="mt-7 space-y-5 text-sm text-[#0A1547]/75 leading-relaxed">
            <div>
              <h2 className="text-base font-black text-[#0A1547] mb-1.5">1. Participation and Consent</h2>
              <p>
                By using this interview flow, you confirm that you are voluntarily participating and consent to this interview process.
              </p>
            </div>

            <div>
              <h2 className="text-base font-black text-[#0A1547] mb-1.5">2. AI-Assisted Interview and Recording</h2>
              <p>
                This experience may include AI-assisted video, audio, and text analysis, and interview activity may be recorded for evaluation by the hiring organization.
              </p>
            </div>

            <div>
              <h2 className="text-base font-black text-[#0A1547] mb-1.5">3. Use of Candidate Data</h2>
              <p>
                Your resume, interview responses, recordings, and related metadata may be processed and shared with the employer for evaluation and hiring purposes.
              </p>
            </div>

            <div>
              <h2 className="text-base font-black text-[#0A1547] mb-1.5">4. Candidate Responsibility</h2>
              <p>
                You agree to provide truthful information and not impersonate another person or use misleading content during the interview process.
              </p>
            </div>

            <div>
              <h2 className="text-base font-black text-[#0A1547] mb-1.5">5. Technical Issues and Accommodations</h2>
              <p>
                For technical issues, contact{" "}
                <a href="mailto:info@alphasourceai.com" className="text-[#A380F6] hover:underline font-semibold">
                  info@alphasourceai.com
                </a>
                . If you need accommodations, use the accommodation request path in the interview flow.
              </p>
            </div>

            <div>
              <h2 className="text-base font-black text-[#0A1547] mb-1.5">6. No Guarantee of Employment</h2>
              <p>
                Completing this interview does not guarantee an interview outcome, offer, or employment decision.
              </p>
            </div>

            <div>
              <h2 className="text-base font-black text-[#0A1547] mb-1.5">7. Acceptance</h2>
              <p>
                By continuing in the interview flow, you acknowledge and accept these Candidate Terms &amp; Conditions.
              </p>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
