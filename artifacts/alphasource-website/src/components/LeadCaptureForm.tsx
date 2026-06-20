import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { CheckCircle } from "lucide-react";
import { getLeadDraftId, hasUsableContact, saveLeadDraft, type LeadDraftFields } from "@/lib/leadCapture";
import { trackEvent } from "@/lib/analytics";

type LeadCaptureFormProps = {
  formId: string;
  formType: "contact" | "demo";
  formTestId: string;
  productInterest: string;
  successTitle: string;
  successBody: string;
  ctaLabel?: string;
};

const emptyFields: LeadDraftFields = {
  first_name: "",
  last_name: "",
  email: "",
  phone: "",
  message: "",
};

function completedFields(fields: LeadDraftFields): string[] {
  return Object.entries(fields)
    .filter(([, value]) => String(value || "").trim())
    .map(([key]) => key);
}

function fieldLabel(fieldName: keyof LeadDraftFields): string {
  return fieldName;
}

export default function LeadCaptureForm({
  formId,
  formType,
  formTestId,
  productInterest,
  successTitle,
  successBody,
  ctaLabel = "Submit",
}: LeadCaptureFormProps) {
  const draftId = useMemo(() => getLeadDraftId(formId), [formId]);
  const formRef = useRef<HTMLFormElement>(null);
  const viewedRef = useRef(false);
  const startedRef = useRef(false);
  const submittedRef = useRef(false);
  const lastFieldRef = useRef("");
  const [fields, setFields] = useState<LeadDraftFields>(emptyFields);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState("");

  useEffect(() => {
    const node = formRef.current;
    if (!node || typeof IntersectionObserver === "undefined") {
      if (!viewedRef.current) {
        viewedRef.current = true;
        trackEvent("lead_form_viewed", { form_id: formId, form_type: formType });
      }
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      if (viewedRef.current) return;
      if (entries.some((entry) => entry.isIntersecting)) {
        viewedRef.current = true;
        trackEvent("lead_form_viewed", { form_id: formId, form_type: formType });
        observer.disconnect();
      }
    }, { threshold: 0.35 });

    observer.observe(node);
    return () => observer.disconnect();
  }, [formId, formType]);

  useEffect(() => {
    if (submittedRef.current || !startedRef.current || !hasUsableContact(fields)) return;
    const timeout = window.setTimeout(() => {
      void saveLeadDraft({
        draftId,
        formId,
        formType,
        productInterest,
        status: "partial",
        fields,
        fieldsCompleted: completedFields(fields).filter((field) => field !== "message"),
        lastField: lastFieldRef.current,
      });
    }, 900);
    return () => window.clearTimeout(timeout);
  }, [draftId, fields, formId, formType, productInterest]);

  useEffect(() => {
    const markAbandoned = () => {
      if (submittedRef.current || !startedRef.current || !hasUsableContact(fields)) return;
      void saveLeadDraft({
        draftId,
        formId,
        formType,
        productInterest,
        status: "abandoned",
        fields,
        fieldsCompleted: completedFields(fields).filter((field) => field !== "message"),
        lastField: lastFieldRef.current,
        keepalive: true,
      });
      trackEvent("lead_form_abandoned", {
        form_id: formId,
        form_type: formType,
        fields_completed: completedFields(fields).filter((field) => field !== "message"),
      });
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") markAbandoned();
    };

    window.addEventListener("pagehide", markAbandoned);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("pagehide", markAbandoned);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [draftId, fields, formId, formType, productInterest]);

  const updateField = (fieldName: keyof LeadDraftFields, value: string) => {
    lastFieldRef.current = fieldName;
    if (!startedRef.current) {
      startedRef.current = true;
      trackEvent("lead_form_started", { form_id: formId, form_type: formType, first_field: fieldName });
    }
    setSubmitError("");
    setFields((prev) => ({ ...prev, [fieldName]: value }));
  };

  const trackFieldBlur = (fieldName: keyof LeadDraftFields) => {
    if (!String(fields[fieldName] || "").trim()) return;
    trackEvent("lead_form_field_completed", {
      form_id: formId,
      form_type: formType,
      field_name: fieldLabel(fieldName),
    });
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitError("");
    trackEvent("lead_form_submit_attempted", { form_id: formId, form_type: formType });
    const ok = await saveLeadDraft({
      draftId,
      formId,
      formType,
      productInterest,
      status: "submitted",
      fields,
      fieldsCompleted: completedFields(fields),
      lastField: lastFieldRef.current,
      cta: ctaLabel,
    });
    if (!ok) {
      setSubmitError("We could not submit this request. Please email info@alphasourceai.com.");
      trackEvent("lead_form_submit_failed", { form_id: formId, form_type: formType, error_type: "backend" });
      return;
    }
    submittedRef.current = true;
    setSubmitted(true);
    trackEvent("lead_form_submit_succeeded", { form_id: formId, form_type: formType });
  };

  if (submitted) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center py-8">
        <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: "#02D99D18" }}>
          <CheckCircle className="w-7 h-7" style={{ color: "#02D99D" }} />
        </div>
        <h3 className="text-xl font-bold text-[#0A1547] mb-2">{successTitle}</h3>
        <p className="text-[#0A1547]/60 text-sm">{successBody}</p>
      </div>
    );
  }

  return (
    <>
      <h3 className="text-xl font-bold text-[#0A1547] mb-2">Request a Demo</h3>
      <p className="text-xs text-[#0A1547]/50 leading-relaxed mb-6">
        We may save the business contact details you enter so we can respond, help you finish this request, or prepare a future membership signup. Message details are saved only when you submit.
      </p>
      <form ref={formRef} onSubmit={handleSubmit} className="space-y-4" data-testid={formTestId}>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-[#0A1547] mb-1.5">First Name</label>
            <input
              type="text"
              required
              value={fields.first_name}
              onChange={(e) => updateField("first_name", e.target.value)}
              onBlur={() => trackFieldBlur("first_name")}
              placeholder="Jane"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm text-[#0A1547] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#A380F6]/40 focus:border-[#A380F6] transition-all"
              data-testid="input-first-name"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#0A1547] mb-1.5">Last Name</label>
            <input
              type="text"
              required
              value={fields.last_name}
              onChange={(e) => updateField("last_name", e.target.value)}
              onBlur={() => trackFieldBlur("last_name")}
              placeholder="Smith"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm text-[#0A1547] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#A380F6]/40 focus:border-[#A380F6] transition-all"
              data-testid="input-last-name"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-[#0A1547] mb-1.5">Email</label>
          <input
            type="email"
            required
            value={fields.email}
            onChange={(e) => updateField("email", e.target.value)}
            onBlur={() => trackFieldBlur("email")}
            placeholder="jane@company.com"
            className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm text-[#0A1547] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#A380F6]/40 focus:border-[#A380F6] transition-all"
            data-testid="input-email"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-[#0A1547] mb-1.5">Phone</label>
          <input
            type="tel"
            value={fields.phone}
            onChange={(e) => updateField("phone", e.target.value)}
            onBlur={() => trackFieldBlur("phone")}
            placeholder="+1 (555) 000-0000"
            className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm text-[#0A1547] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#A380F6]/40 focus:border-[#A380F6] transition-all"
            data-testid="input-phone"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-[#0A1547] mb-1.5">How can we help?</label>
          <textarea
            value={fields.message || ""}
            onChange={(e) => updateField("message", e.target.value)}
            onBlur={() => trackFieldBlur("message")}
            rows={3}
            placeholder="Let us know how we can help..."
            className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm text-[#0A1547] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#A380F6]/40 focus:border-[#A380F6] transition-all resize-none"
            data-testid="input-message"
          />
        </div>
        {submitError && (
          <p className="text-xs font-semibold text-red-500" role="alert">
            {submitError}
          </p>
        )}
        <button
          type="submit"
          className="w-full py-3.5 text-sm font-semibold text-white rounded-full transition-all hover:opacity-90 hover:shadow-md active:scale-[0.99]"
          style={{ backgroundColor: "#A380F6" }}
          data-testid="button-submit"
          data-analytics-cta={ctaLabel}
          data-analytics-placement={`${formId}-form`}
        >
          {ctaLabel}
        </button>
      </form>
    </>
  );
}
