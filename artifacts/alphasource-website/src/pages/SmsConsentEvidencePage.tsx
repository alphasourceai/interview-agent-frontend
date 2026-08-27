import { useEffect, useState } from "react";
import { Check, Mail, MessageSquareText, ShieldCheck } from "lucide-react";
import CandidateHeader from "@/components/CandidateHeader";
import { SMS_CONSENT_COPY_VERSION, SMS_CONSENT_DISCLOSURE } from "../lib/smsOtp";

type DeliveryChannel = "email" | "sms";

function DeliveryChoice({
  channel,
  selected,
  title,
  destination,
  icon,
  onSelect,
}: {
  channel: DeliveryChannel;
  selected: boolean;
  title: string;
  destination: string;
  icon: React.ReactNode;
  onSelect: (channel: DeliveryChannel) => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={() => onSelect(channel)}
      className={`flex w-full items-center gap-3 rounded-2xl border-2 p-4 text-left transition-colors ${
        selected
          ? "border-[#A380F6] bg-[#A380F6]/[0.06]"
          : "border-[#E4E7F1] bg-white hover:border-[#A380F6]/45"
      }`}
    >
      <span
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
          selected ? "bg-[#A380F6] text-white" : "bg-[#F0F2F8] text-[#0A1547]/55"
        }`}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-black text-[#0A1547]">{title}</span>
        <span className="mt-0.5 block text-xs font-semibold text-[#0A1547]/50">{destination}</span>
      </span>
      <span
        aria-hidden="true"
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
          selected ? "border-[#A380F6] bg-[#A380F6]" : "border-[#B8BECE] bg-white"
        }`}
      >
        {selected && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
      </span>
    </button>
  );
}

export default function SmsConsentEvidencePage() {
  const [channel, setChannel] = useState<DeliveryChannel>("sms");
  const [previewMessage, setPreviewMessage] = useState("");

  useEffect(() => {
    document.title = "SMS Opt-In Workflow | alphaScreen";
  }, []);

  return (
    <div
      className="min-h-screen bg-[#F7F8FC] text-[#0A1547]"
      style={{ fontFamily: "'Raleway', sans-serif" }}
      data-consent-copy-version={SMS_CONSENT_COPY_VERSION}
    >
      <CandidateHeader className="h-16 px-5 sm:px-8">
        <span className="ml-auto rounded-full bg-[#0A1547]/[0.06] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-[#0A1547]/55">
          Carrier review preview
        </span>
      </CandidateHeader>

      <main className="mx-auto flex w-full max-w-5xl flex-col items-center px-4 py-8 sm:px-8 sm:py-12">
        <div className="mb-6 flex items-center gap-2 rounded-full border border-[#F1C75B]/50 bg-[#FFF9E9] px-4 py-2 text-xs font-bold text-[#765711]">
          <ShieldCheck className="h-4 w-4" />
          SMS sending is disabled on this compliance-evidence page.
        </div>

        <section
          className="w-full max-w-xl overflow-hidden rounded-3xl border border-[#0A1547]/[0.08] bg-white shadow-[0_20px_60px_rgba(10,21,71,0.10)]"
          aria-labelledby="delivery-heading"
        >
          <div className="border-b border-[#0A1547]/[0.07] px-6 py-5 sm:px-8">
            <div className="flex items-center justify-center gap-0" aria-label="Candidate progress">
              {[
                { label: "Your Info", complete: true },
                { label: "Verify", complete: false },
                { label: "Start", complete: false },
              ].map((step, index) => (
                <div key={step.label} className="flex items-center">
                  <div className="flex flex-col items-center gap-1.5">
                    <span
                      className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-black ${
                        index <= 1 ? "bg-[#A380F6] text-white" : "border-2 border-[#D1D5DB] text-[#9CA3AF]"
                      }`}
                    >
                      {step.complete ? <Check className="h-3.5 w-3.5" /> : index + 1}
                    </span>
                    <span className={`text-[10px] font-bold ${index === 1 ? "text-[#A380F6]" : "text-[#0A1547]/45"}`}>
                      {step.label}
                    </span>
                  </div>
                  {index < 2 && (
                    <span className={`mx-2 mb-5 h-0.5 w-14 rounded-full ${index === 0 ? "bg-[#A380F6]" : "bg-[#E5E7EB]"}`} />
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="px-6 py-7 sm:px-8 sm:py-8">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#A380F6]">Identity verification</p>
            <h1 id="delivery-heading" className="mt-2 text-2xl font-black leading-tight text-[#0A1547]">
              How should we send your code?
            </h1>
            <p className="mt-2 text-sm font-medium leading-relaxed text-[#0A1547]/55">
              Choose one delivery method. Email remains available at any time.
            </p>

            <div className="mt-6 space-y-3" role="radiogroup" aria-label="Verification code delivery method">
              <DeliveryChoice
                channel="email"
                selected={channel === "email"}
                title="Email"
                destination="j•••••@example.com"
                icon={<Mail className="h-5 w-5" />}
                onSelect={setChannel}
              />
              <DeliveryChoice
                channel="sms"
                selected={channel === "sms"}
                title="Text Message"
                destination="(***) ***-0184"
                icon={<MessageSquareText className="h-5 w-5" />}
                onSelect={setChannel}
              />
            </div>

            {channel === "sms" && (
              <div className="mt-5 rounded-2xl border border-[#A380F6]/20 bg-[#A380F6]/[0.05] p-4">
                <p className="text-xs font-semibold leading-relaxed text-[#0A1547]/75">
                  {SMS_CONSENT_DISCLOSURE}
                </p>
                <p className="mt-3 text-[11px] font-semibold text-[#0A1547]/55">
                  Review our{" "}
                  <a href="/terms/" className="text-[#7554CE] underline underline-offset-2">Terms &amp; Conditions</a>
                  {" "}and{" "}
                  <a href="/privacy/" className="text-[#7554CE] underline underline-offset-2">Privacy Policy</a>.
                </p>
              </div>
            )}

            <button
              type="button"
              onClick={() => setPreviewMessage("Preview confirmed. No verification code was sent.")}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-[#A380F6] px-6 py-3 text-sm font-black text-white transition-colors hover:bg-[#9270E6]"
            >
              Send verification code
            </button>

            {previewMessage && (
              <p role="status" className="mt-3 text-center text-xs font-bold text-[#0A1547]/55">
                {previewMessage}
              </p>
            )}

            <p className="mt-4 text-center text-[10px] font-semibold leading-relaxed text-[#0A1547]/35">
              Verification codes expire after 10 minutes. alphaScreen never sends marketing messages through this flow.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
