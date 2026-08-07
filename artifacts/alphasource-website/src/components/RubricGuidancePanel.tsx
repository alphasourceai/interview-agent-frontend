import {
  INTERVIEW_TYPE_CAUTIONS,
  INTERVIEW_TYPE_SELECTION_GUIDE,
  RUBRIC_FAQ,
} from "@/content/rubricGuidance";

export default function RubricGuidancePanel({ compact = false }: { compact?: boolean }) {
  return (
    <details
      className={`rounded-xl border ${compact ? "mt-3 px-3 py-2" : "mt-4 px-4 py-3"}`}
      style={{ backgroundColor: "var(--as-surface-muted)", borderColor: "var(--as-border)" }}
    >
      <summary className="cursor-pointer text-sm font-black" style={{ color: "var(--as-text)" }}>
        Interview type selection guide and FAQ
      </summary>
      <div className={`mt-4 grid gap-5 leading-relaxed ${compact ? "text-xs" : "text-sm"}`} style={{ color: "var(--as-text-muted)" }}>
        <section aria-labelledby="selection-guide-heading">
          <h3 id="selection-guide-heading" className="mb-2 font-black" style={{ color: "var(--as-text)" }}>Selection guide</h3>
          <div className="grid gap-4 lg:grid-cols-3">
            {INTERVIEW_TYPE_SELECTION_GUIDE.map((guide) => (
              <div key={guide.value}>
                <strong style={{ color: "var(--as-text)" }}>{guide.heading}</strong>
                <ul className="mt-1.5 list-disc space-y-1 pl-5">
                  {guide.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}
                </ul>
              </div>
            ))}
          </div>
          <ul className="mt-4 list-disc space-y-1 pl-5">
            {INTERVIEW_TYPE_CAUTIONS.map((caution) => <li key={caution}><strong>{caution}</strong></li>)}
          </ul>
        </section>
        <section aria-labelledby="rubric-faq-heading">
          <h3 id="rubric-faq-heading" className="mb-2 font-black" style={{ color: "var(--as-text)" }}>FAQ</h3>
          <div className="grid gap-3 md:grid-cols-2">
            {RUBRIC_FAQ.map((item) => (
              <div key={item.question}>
                <strong style={{ color: "var(--as-text)" }}>{item.question}</strong>
                <div>{item.answer}</div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </details>
  );
}
