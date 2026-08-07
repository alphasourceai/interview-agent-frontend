import {
  INTERVIEW_TYPE_CAUTIONS,
  INTERVIEW_TYPE_SELECTION_GUIDE,
} from "@/content/rubricGuidance";

export default function RubricGuidancePanel({ compact = false }: { compact?: boolean }) {
  return (
    <details
      className={`rounded-xl border ${compact ? "mt-3 px-3 py-2" : "mt-4 px-4 py-3"}`}
      style={{ backgroundColor: "var(--as-surface-muted)", borderColor: "var(--as-border)" }}
    >
      <summary className="cursor-pointer text-sm font-black" style={{ color: "var(--as-text)" }}>
        Interview Type Selection Guide
      </summary>
      <div className={`mt-3 leading-relaxed ${compact ? "text-xs" : "text-sm"}`} style={{ color: "var(--as-text-muted)" }}>
        <section aria-labelledby="selection-guide-heading">
          <h3 id="selection-guide-heading" className="sr-only">Interview Type Selection Guide</h3>
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
      </div>
    </details>
  );
}
