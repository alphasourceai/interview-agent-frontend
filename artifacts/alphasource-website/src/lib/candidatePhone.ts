export type CandidatePhoneCountry = "US" | "PH";

export const candidatePhoneCountries: Array<{
  value: CandidatePhoneCountry;
  label: string;
}> = [
  { value: "US", label: "United States" },
  { value: "PH", label: "Philippines" },
];

const PHONE_ALLOWED_CHARS_RE = /^[+\d\s().-]+$/;

function digitsOnly(value: string): string {
  return String(value || "").replace(/\D/g, "");
}

function hasValidPlusPlacement(value: string): boolean {
  const trimmed = String(value || "").trim();
  const plusCount = (trimmed.match(/\+/g) || []).length;
  return plusCount <= 1 && (!trimmed.includes("+") || trimmed.startsWith("+"));
}

export function normalizeCandidatePhoneCountry(value: string): CandidatePhoneCountry {
  return value === "PH" ? "PH" : "US";
}

export function normalizeCandidatePhone(value: string, country: CandidatePhoneCountry): string | null {
  const trimmed = String(value || "").trim();
  if (!trimmed || !PHONE_ALLOWED_CHARS_RE.test(trimmed) || !hasValidPlusPlacement(trimmed)) return null;

  const digits = digitsOnly(trimmed);
  if (country === "PH") {
    let national = "";
    if (digits.length === 12 && digits.startsWith("63")) {
      national = digits.slice(2);
    } else if (digits.length === 11 && digits.startsWith("0")) {
      national = digits.slice(1);
    } else if (digits.length === 10) {
      national = digits;
    }
    return /^9\d{9}$/.test(national) ? `63${national}` : null;
  }

  const national = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  return national.length === 10 ? national : null;
}

export function isValidCandidatePhone(value: string, country: CandidatePhoneCountry): boolean {
  return normalizeCandidatePhone(value, country) !== null;
}

export function getCandidatePhoneError(country: CandidatePhoneCountry): string {
  return country === "PH" ? "Enter a valid Philippine phone number." : "Enter a valid US phone number.";
}

export function getCandidatePhoneHelperText(country: CandidatePhoneCountry): string {
  return country === "PH"
    ? "Philippines examples: +63 917 123 4567 or 0917 123 4567."
    : "US examples: (555) 123-4567, 555-123-4567, or +1 555 123 4567.";
}

export function getCandidatePhonePlaceholder(country: CandidatePhoneCountry): string {
  return country === "PH" ? "+63 917 123 4567" : "(555) 123-4567";
}
