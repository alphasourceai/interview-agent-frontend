export interface EnterpriseAgreementFields {
  billingModel: "fixed" | "rollover" | "usage";
  rolloverDays: string;
  maxInterviewMinutes: string;
  scoredQuestionCount: string;
  usageInterviewFee: string;
  poolQuantity: string;
}

export function defaultEnterpriseAgreementFields(): EnterpriseAgreementFields {
  return { billingModel: "fixed", rolloverDays: "90", maxInterviewMinutes: "",
    scoredQuestionCount: "", usageInterviewFee: "", poolQuantity: "" };
}

function whole(value: string, min: number, max: number): number | null {
  if (!/^\d+$/.test(value.trim())) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= min && parsed <= max ? parsed : null;
}

function cents(value: string): number | null {
  const normalized = value.trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return null;
  const [dollars, fraction = ""] = normalized.split(".");
  const amount = BigInt(dollars) * 100n + BigInt(fraction.padEnd(2, "0"));
  return amount > 0n && amount <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(amount) : null;
}

export function enterpriseAgreementFieldError(fields: EnterpriseAgreementFields): string | null {
  if (!["fixed", "rollover", "usage"].includes(fields.billingModel)) return "Choose an Enterprise billing model.";
  if (whole(fields.maxInterviewMinutes, 5, 59) === null) return "Enter an interview length from 5 to 59 minutes.";
  if (whole(fields.scoredQuestionCount, 1, 7) === null) return "Enter a scored question count from 1 to 7.";
  if (fields.billingModel === "rollover" && whole(fields.rolloverDays, 1, 365) === null) {
    return "Enter a rollover validity from 1 to 365 days.";
  }
  if (fields.billingModel === "usage") {
    if (cents(fields.usageInterviewFee) === null) return "Enter a positive per-interview price with at most two decimal places.";
    if (fields.poolQuantity.trim() && whole(fields.poolQuantity, 0, Number.MAX_SAFE_INTEGER) === null) {
      return "Enter a whole number of prepaid interviews, or leave the pool empty.";
    }
  }
  return null;
}

// Shape matches Mihran's Enterprise agreement normalizer. Money is converted
// exactly, but only the server can price/approve the pool or create a charge.
export function enterpriseAgreementSettingsPayload(fields: EnterpriseAgreementFields) {
  const error = enterpriseAgreementFieldError(fields);
  if (error) throw new Error(error);
  const usage = fields.billingModel === "usage";
  return {
    billing_model: fields.billingModel,
    rollover_days: fields.billingModel === "rollover" ? Number(fields.rolloverDays) : null,
    max_interview_minutes: Number(fields.maxInterviewMinutes),
    scored_question_count: Number(fields.scoredQuestionCount),
    usage_interview_fee_cents: usage ? cents(fields.usageInterviewFee) : null,
    pool_quantity: usage && fields.poolQuantity.trim() && Number(fields.poolQuantity) > 0 ? Number(fields.poolQuantity) : null,
  };
}
