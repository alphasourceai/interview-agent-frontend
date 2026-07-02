import { ArrowLeft, ArrowRight, ShieldCheck } from "lucide-react";

const DEFAULT_RETURN_PATH = "/checkout/subscription-success?status=password_required&set_password_url=https%3A%2F%2Fexample.com%2Fpwreset";

function readReturnPath(): string {
  if (typeof window === "undefined") return DEFAULT_RETURN_PATH;
  const raw = String(new URLSearchParams(window.location.search || "").get("return_to") || "").trim();
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return DEFAULT_RETURN_PATH;
  return raw;
}

export default function PasswordSetupPreviewPage() {
  const returnPath = readReturnPath();

  return (
    <section className="min-h-[calc(100vh-160px)] bg-[#F8F9FD] px-6 py-16 lg:py-20">
      <div className="mx-auto max-w-3xl">
        <div className="rounded-lg border border-[#0A1547]/10 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-[#A380F6]/10 text-[#A380F6]">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-black uppercase tracking-[0.18em] text-[#A380F6]">QA preview</p>
              <h1 className="mt-3 text-3xl font-black leading-tight text-[#0A1547] sm:text-4xl">
                Password setup preview
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-relaxed text-[#0A1547]/60">
                This is a QA preview of the post-checkout password setup step. In a real checkout,
                this button opens the secure password setup link created for the buyer after payment confirmation.
              </p>
            </div>
          </div>

          <div className="mt-8 rounded-lg border border-[#0A1547]/10 bg-[#F8F9FD] p-4">
            <p className="text-sm font-semibold leading-relaxed text-[#0A1547]/60">
              No account setup happened from this preview. Use a real checkout return to open the buyer-specific password setup screen.
            </p>
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <a
              href={returnPath}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-[#0A1547] px-6 py-3.5 text-sm font-black text-white transition-opacity hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[#A380F6] focus:ring-offset-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to checkout success preview
            </a>
            <a
              href="/alphascreen/pricing"
              className="inline-flex items-center justify-center gap-2 rounded-full border border-[#0A1547]/12 bg-white px-6 py-3.5 text-sm font-black text-[#0A1547] transition-colors hover:border-[#A380F6] hover:text-[#A380F6] focus:outline-none focus:ring-2 focus:ring-[#A380F6] focus:ring-offset-2"
            >
              View alphaScreen pricing
              <ArrowRight className="h-4 w-4" />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
