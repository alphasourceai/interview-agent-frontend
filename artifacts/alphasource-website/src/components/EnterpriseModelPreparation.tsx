import type { EnterpriseAgreementFields } from "@/lib/enterpriseAgreementFields";

interface Props {
  value: EnterpriseAgreementFields;
  onChange: (value: EnterpriseAgreementFields) => void;
}

const inputClass = "block w-full rounded-lg border p-2 mt-1 text-sm";
const inputStyle = { backgroundColor: "var(--as-surface)", borderColor: "var(--as-border)", color: "var(--as-text)" };

export default function EnterpriseModelPreparation({ value, onChange }: Props) {
  const update = <K extends keyof EnterpriseAgreementFields>(key: K, next: EnterpriseAgreementFields[K]) => {
    onChange({ ...value, [key]: next });
  };
  return (
    <section className="rounded-xl p-4 border mb-3" onClick={(event) => event.stopPropagation()}
      style={{ backgroundColor: "var(--as-surface-muted)", borderColor: "var(--as-border)", color: "var(--as-text)" }}>
      <h3 className="text-sm font-black mb-2">Enterprise commercial model</h3>
      <label className="block text-xs font-bold">
        Billing model
        <select className={inputClass} style={inputStyle} value={value.billingModel}
          onChange={(event) => update("billingModel", event.target.value as EnterpriseAgreementFields["billingModel"])}>
          <option value="fixed">Standard — platform + per-role fee</option>
          <option value="rollover">Standard with rollover — platform + per-role fee</option>
          <option value="usage">Usage-based — platform + completed-interview fee</option>
        </select>
      </label>
      <div className="grid sm:grid-cols-2 gap-3 mt-3">
        <label className="text-xs font-bold">Interview length (minutes)
          <input className={inputClass} style={inputStyle} type="number" min="5" max="59" step="1"
            value={value.maxInterviewMinutes} onChange={(event) => update("maxInterviewMinutes", event.target.value)} />
        </label>
        <label className="text-xs font-bold">Scored questions
          <input className={inputClass} style={inputStyle} type="number" min="1" max="7" step="1"
            value={value.scoredQuestionCount} onChange={(event) => update("scoredQuestionCount", event.target.value)} />
        </label>
        {value.billingModel === "rollover" ? (
          <label className="text-xs font-bold">Unused interview credit validity (days)
            <input className={inputClass} style={inputStyle} type="number" min="1" max="365" step="1"
              value={value.rolloverDays} onChange={(event) => update("rolloverDays", event.target.value)} />
          </label>
        ) : null}
        {value.billingModel === "usage" ? <>
          <label className="text-xs font-bold">Completed-interview fee ($)
            <input className={inputClass} style={inputStyle} type="number" min="0.01" step="0.01"
              value={value.usageInterviewFee} onChange={(event) => update("usageInterviewFee", event.target.value)} />
          </label>
          <label className="text-xs font-bold">Optional prepaid interview pool
            <input className={inputClass} style={inputStyle} type="number" min="0" step="1" placeholder="No pool"
              value={value.poolQuantity} onChange={(event) => update("poolQuantity", event.target.value)} />
          </label>
        </> : null}
      </div>
      <p className="text-xs mt-3" style={{ color: "var(--as-text-muted)" }}>
        {value.billingModel === "usage"
          ? "Usage-based agreements have no role-opening fee. The server calculates any pool discount in the agreement preview."
          : "Standard agreements use the role fees and included interviews below."}
        {" "}These settings are included in the generated agreement. Enterprise is fully customizable, with a dedicated Client Support Agent.
      </p>
    </section>
  );
}
