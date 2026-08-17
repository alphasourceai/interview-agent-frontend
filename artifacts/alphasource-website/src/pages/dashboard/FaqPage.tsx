import DashboardLayout from "@/components/DashboardLayout";
import {
  DASHBOARD_SUPPORT_KNOWLEDGE_VERSION,
  dataPracticeSections,
  faqSections as supportFaqSections,
  guidanceCards,
  productUpdates,
} from "@/content/dashboardSupportContent";
import { RUBRIC_FAQ } from "@/content/rubricGuidance";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const surfaceCardStyle = {
  backgroundColor: "var(--as-surface)",
  border: "1px solid var(--as-border)",
  boxShadow: "var(--as-shadow)",
};

const mutedPanelStyle = {
  backgroundColor: "var(--as-surface-muted)",
  borderColor: "var(--as-border)",
};

const primaryTextStyle = { color: "var(--as-text)" };
const mutedTextStyle = { color: "var(--as-text)", opacity: 0.65 };
const subtleTextStyle = { color: "var(--as-text-subtle)" };

const faqSections = supportFaqSections.map((section) => (
  section.title === "Interview types, membership, and warm-up"
    ? { ...section, items: [...RUBRIC_FAQ] }
    : section
));

export default function DashboardFaqPage() {
  return (
    <DashboardLayout title="Support">
      <div data-support-knowledge-version={DASHBOARD_SUPPORT_KNOWLEDGE_VERSION} />

      <div
        className="rounded-2xl p-4 mb-5"
        style={{ backgroundColor: "rgba(163,128,246,0.10)", border: "1px solid rgba(163,128,246,0.20)" }}
      >
        <p className="text-sm font-semibold text-[#0A1547]/70 leading-relaxed" style={{ color: "var(--as-text)", opacity: 0.7 }}>
          alphaScreen supports your hiring process with structured screening interview insight. It does not replace your hiring judgment or make final employment decisions.
        </p>
      </div>

      <section
        className="rounded-2xl p-6 mb-5"
        style={surfaceCardStyle}
      >
        <div className="flex flex-col gap-1 mb-5">
          <p className="text-[10px] font-black uppercase tracking-widest" style={subtleTextStyle}>
            Support Guide
          </p>
          <h3 className="text-base font-black" style={primaryTextStyle}>Quick guidance</h3>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {guidanceCards.map((card) => (
            <div
              key={card.title}
              className="rounded-xl border p-4"
              style={mutedPanelStyle}
            >
              <h4 className="text-sm font-black mb-2" style={primaryTextStyle}>{card.title}</h4>
              <p className="text-xs leading-relaxed" style={mutedTextStyle}>{card.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section
        className="rounded-2xl p-6 mb-5"
        style={surfaceCardStyle}
      >
        <div className="flex flex-col gap-1 mb-5">
          <p className="text-[10px] font-black uppercase tracking-widest" style={subtleTextStyle}>
            Security and Data Practices
          </p>
          <h3 className="text-base font-black" style={primaryTextStyle}>Client data guidance</h3>
          <p className="text-sm leading-relaxed" style={mutedTextStyle}>
            Client-facing documentation for retention, deletion, incident response, and notification practices.
          </p>
        </div>
        <div className="grid gap-3">
          {dataPracticeSections.map((section) => (
            <article
              key={section.title}
              className="rounded-xl border p-4"
              style={mutedPanelStyle}
            >
              <h4 className="text-sm font-black mb-2" style={primaryTextStyle}>{section.title}</h4>
              <p className="text-xs leading-relaxed mb-3" style={mutedTextStyle}>
                {section.body}
              </p>
              <ul className="grid gap-1.5">
                {section.bullets.map((bullet) => (
                  <li key={bullet} className="text-xs leading-relaxed" style={mutedTextStyle}>
                    • {bullet}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section
        className="rounded-2xl p-6 mb-5"
        style={surfaceCardStyle}
      >
        <div className="flex flex-col gap-1 mb-5">
          <p className="text-[10px] font-black uppercase tracking-widest" style={subtleTextStyle}>
            Product Updates
          </p>
          <h3 className="text-base font-black" style={primaryTextStyle}>alphaScreen updates</h3>
          <p className="text-sm leading-relaxed" style={mutedTextStyle}>
            Client-facing highlights from recent alphaScreen releases.
          </p>
        </div>
        <div className="grid gap-3">
          {productUpdates.map((update) => (
            <article
              key={update.version}
              className="rounded-xl border p-4"
              style={mutedPanelStyle}
            >
              <h4 className="text-sm font-black mb-2" style={primaryTextStyle}>
                {update.version} — {update.title}
              </h4>
              <p className="text-xs leading-relaxed mb-3" style={mutedTextStyle}>
                {update.summary}
              </p>
              <ul className="grid gap-1.5 md:grid-cols-2">
                {update.bullets.map((bullet) => (
                  <li key={bullet} className="text-xs leading-relaxed" style={mutedTextStyle}>
                    • {bullet}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <div className="mb-5">
        <p className="text-[10px] font-black uppercase tracking-widest mb-1" style={subtleTextStyle}>
          Help Center
        </p>
        <h3 className="text-base font-black" style={primaryTextStyle}>Common questions</h3>
      </div>

      <div className="grid gap-5">
        {faqSections.map((section) => (
          <section
            key={section.title}
            className="rounded-2xl p-6"
            style={surfaceCardStyle}
          >
            <h3 className="text-base font-black mb-4" style={primaryTextStyle}>{section.title}</h3>
            <Accordion type="single" collapsible className="space-y-2">
              {section.items.map((item) => (
                <AccordionItem
                  key={item.question}
                  value={item.question}
                  className="rounded-xl border px-4"
                  style={mutedPanelStyle}
                >
                  <AccordionTrigger className="py-4 text-sm font-bold hover:no-underline" style={primaryTextStyle}>
                    {item.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-sm leading-relaxed" style={mutedTextStyle}>
                    {item.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </section>
        ))}
      </div>
    </DashboardLayout>
  );
}
