import { CheckCircle2, MessageSquareText, PhoneCall, ShieldCheck } from "lucide-react";

const VERBAL_CONSENT_SCRIPT =
  "Before I text you, do you agree to receive text messages from alphaSource Network LLC about alphaScreen, including the information you requested, demo scheduling and reminders, and occasional promotional follow-ups? Message frequency varies. Message and data rates may apply. Consent is not a condition of purchase. Reply STOP to opt out or HELP for help. Do I have your permission to text this number?";

export default function SalesSmsConsentPage() {
  return (
    <div className="min-h-screen bg-[#F8F9FD] text-[#0A1547]">
      <section className="relative overflow-hidden pb-14 pt-32">
        <div className="absolute inset-0 gradient-hero-bg" />
        <div className="relative mx-auto max-w-4xl px-6 lg:px-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#A380F6]/25 bg-white px-3 py-1.5 text-sm font-bold text-[#7554CE] shadow-sm">
            <ShieldCheck className="h-4 w-4" />
            SMS consent and your choices
          </div>
          <h1 className="mt-5 text-4xl font-black leading-tight lg:text-5xl">
            Text messages from alphaScreen sales
          </h1>
          <p className="mt-4 max-w-3xl text-base font-medium leading-relaxed text-[#0A1547]/65">
            If you speak with us about alphaScreen, we may ask whether you would like a text with product information or demo details. We text only after you clearly agree and confirm your mobile number. Visiting this page does not opt you in.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-4xl space-y-6 px-6 pb-24 lg:px-8">
        <section className="rounded-3xl border border-[#A380F6]/20 bg-white p-7 shadow-[0_20px_60px_rgba(10,21,71,0.08)] sm:p-10">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#A380F6]/10 text-[#7554CE]">
              <PhoneCall className="h-5 w-5" />
            </span>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-[#7554CE]">What you will hear on a call</p>
              <h2 className="mt-1 text-2xl font-black">We ask for permission first</h2>
            </div>
          </div>
          <blockquote className="mt-6 rounded-2xl border-l-4 border-[#A380F6] bg-[#F7F4FF] p-6 text-base font-bold leading-8 text-[#0A1547]">
            “{VERBAL_CONSENT_SCRIPT}”
          </blockquote>
          <a
            href="/sales-sms-verbal-consent-script.png"
            className="mt-5 inline-flex text-sm font-black text-[#7554CE] underline underline-offset-4"
          >
            View a copy of the spoken consent prompt
          </a>
        </section>

        <section className="grid gap-6 md:grid-cols-2">
          <div className="rounded-3xl border border-[#0A1547]/10 bg-white p-7">
            <div className="flex items-center gap-2 text-[#7554CE]">
              <CheckCircle2 className="h-5 w-5" />
              <h2 className="text-lg font-black text-[#0A1547]">Your choice and our records</h2>
            </div>
            <div className="mt-5 space-y-3 text-sm font-medium leading-relaxed text-[#0A1547]/70">
              <p>Texting is optional. If you say no, your answer is unclear, or you withdraw consent, we will not text you. You can reply STOP at any time to opt out; we honor STOP requests immediately. Reply HELP for help.</p>
              <p>After a clear yes, we confirm your mobile number. We document the consent date, time, representative, number, verbal source, and call recording reference in our contact record. The recorded call supports that record. HELP requests go to our sales or support team.</p>
            </div>
          </div>

          <div className="rounded-3xl border border-[#0A1547]/10 bg-white p-7">
            <div className="flex items-center gap-2 text-[#7554CE]">
              <MessageSquareText className="h-5 w-5" />
              <h2 className="text-lg font-black text-[#0A1547]">Messages you can expect</h2>
            </div>
            <ul className="mt-5 list-disc space-y-3 pl-5 text-sm font-medium leading-relaxed text-[#0A1547]/70">
              <li>Information you requested about alphaScreen.</li>
              <li>Demo scheduling and reminders.</li>
              <li>Occasional promotional follow-ups about alphaScreen.</li>
              <li>Message frequency varies. Message and data rates may apply.</li>
              <li>Consent is optional and is not a condition of purchase.</li>
            </ul>
          </div>
        </section>

        <section className="rounded-3xl bg-[#0A1547] p-7 text-white sm:p-9">
          <h2 className="text-xl font-black">Business and policy information</h2>
          <div className="mt-5 grid gap-5 text-sm font-semibold leading-relaxed text-white/75 sm:grid-cols-2">
            <div>
              <p className="font-black text-white">alphaSource Network LLC</p>
              <p>30 N Gould St Ste R</p>
              <p>Sheridan, WY 82801</p>
            </div>
            <div>
              <p><a className="underline underline-offset-4" href="mailto:info@alphasourceai.com">info@alphasourceai.com</a></p>
              <p><a className="underline underline-offset-4" href="tel:+17207667817">(720) 766-7817</a></p>
              <p className="mt-2">
                <a className="underline underline-offset-4" href="/privacy/">Privacy Policy</a>
                {" · "}
                <a className="underline underline-offset-4" href="/terms/">Terms &amp; Conditions</a>
              </p>
            </div>
          </div>
          <p className="mt-6 text-sm font-semibold leading-relaxed text-white/75">
            We may retain the recorded call and contact-record details to document and honor the prospect&apos;s choice. Mobile information and SMS consent records are not sold or shared with third parties for their own marketing purposes. We disclose only the minimum necessary information to contracted messaging providers, carriers, hosting providers, and service providers that help deliver messages, maintain records, prevent abuse, and honor opt-outs.
          </p>
        </section>
      </div>
    </div>
  );
}
