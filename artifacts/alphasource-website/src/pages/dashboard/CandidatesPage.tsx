import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  RefreshCw,
  FileText,
  Download,
  FileDown,
  Copy,
  X,
} from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import InfoTooltip from "@/components/InfoTooltip";
import { useClient } from "@/context/ClientContext";
import { supabase } from "@/lib/supabaseClient";

/* ── Types ──────────────────────────────────────────── */
interface SubScore {
  label: string;
  score: number | null;
  color: string;
  state?: "available" | "unavailable" | "not_applicable";
}

interface InterviewAnalysisV2 {
  scores?: {
    response_specificity?: number | null;
    answer_directness?: number | null;
    answer_consistency?: number | null;
    communication_structure?: number | null;
  };
  conditions?: {
    evaluation_conditions?: string;
    signal_confidence?: string;
    audio_quality_issues?: string;
    distraction_risk?: string;
  };
  risk?: {
    integrity_risk?: string;
    reason?: string;
  };
  evidence_summary?: string;
  evidence?: string[];
  limitations?: string[];
}

interface Candidate {
  id: string | number;
  candidateId?: string;
  roleId?: string;
  interviewId?: string;
  insufficientInterview?: boolean;
  hasTranscript?: boolean;
  transcriptText?: string;
  name: string;
  email: string;
  role: string;
  resume: number | null;
  interview: number | null;
  overall: number | null;
  created: string;
  resumeSubs: SubScore[];
  resumeSummary: string;
  interviewSubs: SubScore[];
  interviewSummary: string;
  interviewAnalysisV2?: InterviewAnalysisV2 | null;
  unanswered: string;
  reliability: number | null;
  reliabilityState?: "available" | "unavailable" | "not_applicable";
  risk: "Low" | "Medium" | "High" | null;
  riskText: string;
  createdSort?: number;
}

interface ClientRoleOption {
  id: string;
  title: string;
}

type SortKey = "name" | "email" | "role" | "resume" | "interview" | "overall" | "created";
type SortDir = "asc" | "desc";

const env =
  typeof import.meta !== "undefined" && import.meta.env ? import.meta.env : {};

function trimTrailingSlashes(value: unknown): string {
  return String(value || "").trim().replace(/\/+$/, "");
}

function firstBase(...values: unknown[]): string {
  for (const value of values) {
    const normalized = trimTrailingSlashes(value);
    if (normalized) return normalized;
  }
  return "";
}

const backendBase = firstBase(
  (env as Record<string, unknown>).VITE_BACKEND_URL,
  (env as Record<string, unknown>).VITE_API_URL,
  (env as Record<string, unknown>).VITE_PUBLIC_BACKEND_URL,
  (env as Record<string, unknown>).PUBLIC_BACKEND_URL,
  (env as Record<string, unknown>).BACKEND_URL,
);

function extractErrorMessage(text: string): string {
  if (!text) return "Failed to load candidates.";
  try {
    const data = JSON.parse(text) as { detail?: unknown; message?: unknown; error?: unknown };
    const candidate = data.detail ?? data.message ?? data.error;
    if (typeof candidate === "string" && candidate.trim()) return candidate;
  } catch {
    // ignore parse failure and fall back to raw text
  }
  return text;
}

function parseJsonSafe(text: string): unknown {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function parseObjectSafe(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value === "string") {
    const parsed = parseJsonSafe(value);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  }
  return {};
}

async function copyTextToClipboard(text: string): Promise<void> {
  const value = String(text || "");
  if (!value) throw new Error("Transcript is empty.");
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(value);
      return;
    }
  } catch {
    // fall through to legacy copy path
  }

  const ta = document.createElement("textarea");
  ta.value = value;
  ta.style.position = "fixed";
  ta.style.left = "-9999px";
  ta.setAttribute("readonly", "");
  document.body.appendChild(ta);
  ta.select();
  const copied = document.execCommand("copy");
  document.body.removeChild(ta);
  if (!copied) throw new Error("Could not copy transcript.");
}

function downloadTranscriptText(candidateName: string, transcript: string): void {
  const safeBase = String(candidateName || "candidate")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "candidate";
  const blob = new Blob([String(transcript || "")], { type: "text/plain;charset=utf-8" });
  const objectUrl = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = `${safeBase}-transcript.txt`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(objectUrl);
}

function toScoreOrNull(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" && value.trim() === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const clamped = Math.max(0, Math.min(100, n));
  return Math.round(clamped);
}

function toSortDate(value: unknown): number {
  const raw = String(value || "").trim();
  if (!raw) return 0;
  const parsed = new Date(raw).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

function normalizeQuestionList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || "").trim()).filter(Boolean);
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return normalizeQuestionList(parsed);
    } catch {
      // fall through to plain string
    }
    return [trimmed];
  }
  return [];
}

const V2_FORBIDDEN_TEXT_RE =
  /\b(honesty|truthfulness|deception|appearance|gaze|attractiveness|race|ethnicity|gender|age|disability|trustworthiness|likability|personality|motivation)\b/i;

function safeV2Text(value: unknown): string {
  const text = String(value || "").trim();
  if (!text || V2_FORBIDDEN_TEXT_RE.test(text)) return "";
  return text;
}

function safeV2List(value: unknown): string[] {
  return normalizeQuestionList(value).filter((item) => Boolean(safeV2Text(item)));
}

function safeMeaningfulV2List(value: unknown): string[] {
  const emptyValues = new Set(["none", "n/a", "na", "not applicable", "unavailable"]);
  return safeV2List(value).filter((item) => !emptyValues.has(item.toLowerCase()));
}

function normalizeInterviewAnalysisV2(value: unknown): InterviewAnalysisV2 | null {
  const raw = parseObjectSafe(value);
  if (!Object.keys(raw).length) return null;

  const scores = parseObjectSafe(raw.scores);
  const conditions = parseObjectSafe(raw.conditions);
  const risk = parseObjectSafe(raw.risk);

  return {
    scores: {
      response_specificity: toScoreOrNull(scores.response_specificity),
      answer_directness: toScoreOrNull(scores.answer_directness),
      answer_consistency: toScoreOrNull(scores.answer_consistency),
      communication_structure: toScoreOrNull(scores.communication_structure),
    },
    conditions: {
      evaluation_conditions: String(conditions.evaluation_conditions || "").trim(),
      signal_confidence: String(conditions.signal_confidence || "").trim(),
      audio_quality_issues: String(conditions.audio_quality_issues || "").trim(),
      distraction_risk: String(conditions.distraction_risk || "").trim(),
    },
    risk: {
      integrity_risk: String(risk.integrity_risk || "").trim(),
      reason: String(risk.reason || "").trim(),
    },
    evidence_summary: String(raw.evidence_summary || "").trim(),
    evidence: normalizeQuestionList(raw.evidence),
    limitations: normalizeQuestionList(raw.limitations),
  };
}

function hasUsableInterviewAnalysisV2(value: InterviewAnalysisV2 | null | undefined): boolean {
  if (!value) return false;
  const scores = value.scores || {};
  const hasNumericScore = [
    scores.response_specificity,
    scores.answer_directness,
    scores.answer_consistency,
    scores.communication_structure,
  ].some((score) => typeof score === "number");

  return hasNumericScore
    || Boolean(safeV2Text(value.evidence_summary))
    || safeV2List(value.evidence).length > 0
    || safeMeaningfulV2List(value.limitations).length > 0;
}

function formatCreated(value: unknown): string {
  const raw = String(value || "").trim();
  if (!raw) return "—";
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return "—";

  const date = parsed.toLocaleDateString("en-US", {
    timeZone: "America/Chicago",
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  const time = parsed.toLocaleTimeString("en-US", {
    timeZone: "America/Chicago",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZoneName: "short",
  });

  const normalizedTime = time
    .replace(/\sGMT[+-]\d{1,2}(?::\d{2})?/g, "")
    .replace(/\b(?:CDT|CST)\b/g, "CST");

  return `${date} · ${normalizedTime.includes("CST") ? normalizedTime : `${normalizedTime} CST`}`;
}

function mapRowToCandidate(item: Record<string, unknown>, index: number): Candidate {
  const candidate = item.candidate && typeof item.candidate === "object"
    ? (item.candidate as Record<string, unknown>)
    : {};
  const role = item.role && typeof item.role === "object"
    ? (item.role as Record<string, unknown>)
    : {};
  const resumeAnalysis = item.resume_analysis && typeof item.resume_analysis === "object"
    ? (item.resume_analysis as Record<string, unknown>)
    : {};
  const interviewAnalysis = item.interview_analysis && typeof item.interview_analysis === "object"
    ? (item.interview_analysis as Record<string, unknown>)
    : {};
  const perceptionScores = item.perception_scores && typeof item.perception_scores === "object"
    ? (item.perception_scores as Record<string, unknown>)
    : {};
  const transcriptScores = item.transcript_scores && typeof item.transcript_scores === "object"
    ? (item.transcript_scores as Record<string, unknown>)
    : {};
  const interviewAnalysisV2 = normalizeInterviewAnalysisV2(item.interview_analysis_v2);

  const resumeScore = toScoreOrNull(item.resume_score);
  const interviewScore = toScoreOrNull(item.interview_score);
  const overallScore = toScoreOrNull(item.overall_score);

  const rawId = candidate.id ?? item.id ?? `candidate-${index + 1}`;
  const id = typeof rawId === "string" || typeof rawId === "number"
    ? rawId
    : `candidate-${index + 1}`;
  const candidateId = String(candidate.id || "").trim();
  const roleId = String(role.id || "").trim();
  const interviewId = String(item.id || "").trim();
  const hasTranscript = Boolean(item.has_transcript) || Boolean(String(item.transcript_url || "").trim());
  const transcriptText = typeof item.transcript === "string" ? item.transcript.trim() : "";

  const resumeSummaryRaw = String(resumeAnalysis.summary || "").trim();
  const interviewSummaryRaw = String(interviewAnalysis.summary || "").trim();
  const riskRaw = String(transcriptScores.ai_aided_risk || "").trim().toLowerCase();
  const riskFromTranscript: Candidate["risk"] | null =
    riskRaw === "high" ? "High" : riskRaw === "medium" ? "Medium" : riskRaw === "low" ? "Low" : null;
  const riskReasonFromTranscript = String(transcriptScores.ai_aided_risk_reason || "").trim();
  const reliabilityFromTranscript = toScoreOrNull(transcriptScores.confidence);
  const perceptionMode = String(perceptionScores.mode || "").trim().toLowerCase();
  const isTextInterview = perceptionMode === "text" || perceptionScores.unavailable === true;
  const perceptionUnavailable = perceptionMode === "text" || perceptionScores.unavailable === true;
  const interviewSummaryLower = interviewSummaryRaw.toLowerCase();
  const insufficientInterview =
    !isTextInterview &&
    (
      interviewSummaryLower.includes("before any substantive responses were recorded") ||
      interviewSummaryLower.includes("before substantive responses were captured") ||
      interviewSummaryLower.includes("insufficient data")
    );
  const hasInterview = interviewScore !== null || Object.keys(transcriptScores).length > 0 || insufficientInterview;
  const displayedInterviewScore = insufficientInterview ? null : interviewScore;
  const displayedOverallScore = insufficientInterview ? null : overallScore;
  const clarityScore = insufficientInterview || perceptionUnavailable ? null : toScoreOrNull(interviewAnalysis.clarity);
  const confidenceScore = insufficientInterview || perceptionUnavailable ? null : toScoreOrNull(interviewAnalysis.confidence);
  const engagementFromInterview = toScoreOrNull(interviewAnalysis.engagement);
  const engagementLegacyFallback = engagementFromInterview === null ? toScoreOrNull(interviewAnalysis.body_language) : null;
  const engagementCanonical = engagementFromInterview !== null ? engagementFromInterview : engagementLegacyFallback;
  const engagementScore = insufficientInterview || perceptionUnavailable ? null : engagementCanonical;
  const displayedRisk = insufficientInterview ? null : (hasInterview ? riskFromTranscript : null);
  const displayedRiskReason = insufficientInterview ? "" : riskReasonFromTranscript;
  const reliabilityState: Candidate["reliabilityState"] =
    !hasInterview ? "unavailable" : isTextInterview ? "not_applicable" : reliabilityFromTranscript !== null ? "available" : "unavailable";
  const unansweredQuestions = normalizeQuestionList(item.unanswered_candidate_questions);

  return {
    id,
    candidateId,
    roleId,
    interviewId,
    hasTranscript,
    transcriptText,
    name: String(candidate.name || "").trim() || "Unnamed Candidate",
    email: String(candidate.email || "").trim() || "—",
    role: String(role.title || "").trim() || "—",
    resume: resumeScore,
    interview: displayedInterviewScore,
    overall: displayedOverallScore,
    insufficientInterview,
    created: formatCreated(item.created_at),
    createdSort: toSortDate(item.created_at),
    resumeSubs: [
      { label: "Experience", score: toScoreOrNull(resumeAnalysis.experience), color: "#A380F6" },
      { label: "Skills", score: toScoreOrNull(resumeAnalysis.skills), color: "#02ABE0" },
      { label: "Education", score: toScoreOrNull(resumeAnalysis.education), color: "#02D99D" },
    ],
    resumeSummary: resumeSummaryRaw || "No resume summary available yet.",
    interviewSubs: [
      { label: "Clarity", score: clarityScore, color: "#02ABE0", state: clarityScore === null ? "unavailable" : "available" },
      { label: "Confidence", score: confidenceScore, color: "#A380F6", state: confidenceScore === null ? "unavailable" : "available" },
      {
        label: "Engagement",
        score: engagementScore,
        color: "#02D99D",
        state: isTextInterview ? "not_applicable" : engagementScore !== null ? "available" : "unavailable",
      },
    ],
    interviewSummary: hasInterview
      ? (interviewSummaryRaw || "No interview summary available yet.")
      : "Interview not yet completed.",
    interviewAnalysisV2: hasInterview && hasUsableInterviewAnalysisV2(interviewAnalysisV2) ? interviewAnalysisV2 : null,
    unanswered: hasInterview
      ? (unansweredQuestions.length ? unansweredQuestions.join("\n") : "No unanswered questions captured.")
      : "Interview not yet completed.",
    reliability: reliabilityState === "available" ? reliabilityFromTranscript : null,
    reliabilityState,
    risk: displayedRisk,
    riskText: insufficientInterview ? "" : displayedRiskReason,
  };
}

/* ── Placeholder data ───────────────────────────────── */
const CANDIDATES: Candidate[] = [
  {
    id: 1,
    name: "Jordan Kim",
    email: "jordan.kim@email.com",
    role: "Dental Hygienist",
    resume: 80,
    interview: 75,
    overall: 78,
    created: "Apr 1, 2026 · 9:12 AM CST",
    resumeSubs: [
      { label: "Experience", score: 82, color: "#A380F6" },
      { label: "Skills",     score: 78, color: "#02ABE0" },
      { label: "Education",  score: 88, color: "#02D99D" },
    ],
    resumeSummary:
      "Jordan brings 6 years of clinical hygiene experience with expertise in patient care and Eaglesoft charting. Educational credentials meet requirements and the skills profile is well-rounded.",
    interviewSubs: [
      { label: "Clarity",     score: 85, color: "#02ABE0" },
      { label: "Confidence",  score: 72, color: "#A380F6" },
      { label: "Engagement",  score: 80, color: "#02D99D" },
    ],
    interviewSummary:
      "Jordan communicated clearly with strong preparation. Showed genuine enthusiasm for the role. Confidence could be stronger on technical questions but overall a solid performance.",
    unanswered: "None captured.",
    reliability: 78,
    risk: "Low",
    riskText: "Responses were consistent, specific, and authentic throughout the interview. No patterns of scripted or rehearsed answers detected.",
  },
  {
    id: 2,
    name: "Marcy O'Brien",
    email: "marcy.obrien@email.com",
    role: "Front Desk Coordinator",
    resume: 85,
    interview: null,
    overall: null,
    created: "Mar 28, 2026 · 2:15 PM CST",
    resumeSubs: [
      { label: "Experience", score: 88, color: "#A380F6" },
      { label: "Skills",     score: 82, color: "#02ABE0" },
      { label: "Education",  score: 79, color: "#02D99D" },
    ],
    resumeSummary:
      "Marcy has 4 years of front-desk experience in dental and urgent care settings, with strong command of scheduling systems and patient communication.",
    interviewSubs: [
      { label: "Clarity",    score: 0, color: "#02ABE0" },
      { label: "Confidence", score: 0, color: "#A380F6" },
      { label: "Engagement", score: 0, color: "#02D99D" },
    ],
    interviewSummary: "Interview not yet completed.",
    unanswered: "Interview not yet completed.",
    reliability: 0,
    risk: "Low",
    riskText: "Interview not yet completed. Risk analysis will populate after the interview is finished.",
  },
  {
    id: 3,
    name: "Devon Watts",
    email: "devon.watts@email.com",
    role: "Dental Assistant",
    resume: 60,
    interview: 55,
    overall: 58,
    created: "Mar 15, 2026 · 11:30 AM CST",
    resumeSubs: [
      { label: "Experience", score: 62, color: "#A380F6" },
      { label: "Skills",     score: 58, color: "#02ABE0" },
      { label: "Education",  score: 65, color: "#02D99D" },
    ],
    resumeSummary:
      "Devon shows entry-level experience with a dental assisting certificate. Limited hands-on clinical exposure so far but demonstrates basic knowledge of chairside procedures.",
    interviewSubs: [
      { label: "Clarity",    score: 60, color: "#02ABE0" },
      { label: "Confidence", score: 48, color: "#A380F6" },
      { label: "Engagement", score: 58, color: "#02D99D" },
    ],
    interviewSummary:
      "Devon gave somewhat vague responses on technical questions. Enthusiasm was present but answers lacked depth. Some responses lacked specificity suggesting limited preparation.",
    unanswered: "Q: Describe your sterilization process. — Response was incomplete.",
    reliability: 55,
    risk: "Medium",
    riskText: "Several responses lacked specificity and occasionally repeated phrasing across multiple questions. Recommend a follow-up conversation to clarify key answers.",
  },
  {
    id: 4,
    name: "Ashley Norris",
    email: "ashley.norris@email.com",
    role: "Office Manager",
    resume: 92,
    interview: 88,
    overall: 90,
    created: "Feb 20, 2026 · 4:00 PM CST",
    resumeSubs: [
      { label: "Experience", score: 95, color: "#A380F6" },
      { label: "Skills",     score: 90, color: "#02ABE0" },
      { label: "Education",  score: 88, color: "#02D99D" },
    ],
    resumeSummary:
      "Ashley has 9 years of dental practice management with demonstrated success reducing overhead and improving patient flow. Strong leadership and operations credentials.",
    interviewSubs: [
      { label: "Clarity",    score: 90, color: "#02ABE0" },
      { label: "Confidence", score: 92, color: "#A380F6" },
      { label: "Engagement", score: 85, color: "#02D99D" },
    ],
    interviewSummary:
      "Ashley delivered well-structured, specific responses with compelling examples of practice improvement initiatives. Demonstrated strong strategic thinking and team leadership instincts.",
    unanswered: "None captured.",
    reliability: 91,
    risk: "Low",
    riskText: "High response quality with detailed, role-specific examples throughout. Answers were natural and varied in structure, strongly indicating authentic, unprompted responses.",
  },
  {
    id: 5,
    name: "Marcus Bell",
    email: "marcus.bell@email.com",
    role: "Dental Hygienist",
    resume: 35,
    interview: 40,
    overall: 38,
    created: "Mar 10, 2026 · 8:45 AM CST",
    resumeSubs: [
      { label: "Experience", score: 30, color: "#A380F6" },
      { label: "Skills",     score: 40, color: "#02ABE0" },
      { label: "Education",  score: 45, color: "#02D99D" },
    ],
    resumeSummary:
      "Marcus's resume shows limited clinical experience and no dental-specific credentials. Background is primarily in general healthcare support roles.",
    interviewSubs: [
      { label: "Clarity",    score: 42, color: "#02ABE0" },
      { label: "Confidence", score: 38, color: "#A380F6" },
      { label: "Engagement", score: 44, color: "#02D99D" },
    ],
    interviewSummary:
      "Responses were frequently off-topic or generic. Marcus struggled to demonstrate relevant knowledge of dental hygiene procedures. Several responses lacked depth.",
    unanswered:
      "Q: Describe your patient charting workflow. — No substantive response given.\nQ: How do you handle nervous patients? — Response was incomplete.",
    reliability: 42,
    risk: "High",
    riskText: "Multiple responses exhibited repeated generic phrasing and lacked role-specific detail. Patterns are consistent with scripted or AI-assisted answers. A live screening call is strongly recommended before proceeding.",
  },
  {
    id: 6,
    name: "Priya Sharma",
    email: "priya.sharma@email.com",
    role: "Front Desk Coordinator",
    resume: 73,
    interview: 68,
    overall: 71,
    created: "Mar 5, 2026 · 1:00 PM CST",
    resumeSubs: [
      { label: "Experience", score: 70, color: "#A380F6" },
      { label: "Skills",     score: 75, color: "#02ABE0" },
      { label: "Education",  score: 72, color: "#02D99D" },
    ],
    resumeSummary:
      "Priya has 3 years of front-desk experience in a multi-provider dental office. Demonstrates proficiency with scheduling software and bilingual communication (English/Hindi).",
    interviewSubs: [
      { label: "Clarity",    score: 72, color: "#02ABE0" },
      { label: "Confidence", score: 62, color: "#A380F6" },
      { label: "Engagement", score: 75, color: "#02D99D" },
    ],
    interviewSummary:
      "Priya gave solid responses with reasonable depth. Some hesitation around conflict-resolution scenarios. Bilingual skills noted as a genuine differentiator for patient communication.",
    unanswered: "None captured.",
    reliability: 70,
    risk: "Low",
    riskText: "Responses were generally authentic and well-grounded. Minor hesitations were contextually appropriate and not indicative of scripted patterns.",
  },
];

/* ── Utilities ──────────────────────────────────────── */
function scoreColor(score: number | null): string {
  if (score === null) return "#0A1547";
  if (score >= 75) return "#02D99D";
  if (score >= 60) return "#F0A500";
  return "#FF6B6B";
}

function scoreBg(score: number | null): string {
  if (score === null) return "rgba(10,21,71,0.05)";
  if (score >= 75) return "rgba(2,217,157,0.10)";
  if (score >= 60) return "rgba(240,165,0,0.10)";
  return "rgba(255,107,107,0.10)";
}

function riskColor(risk: Candidate["risk"]): string {
  return risk === "Low" ? "#02D99D" : risk === "Medium" ? "#F0A500" : risk === "High" ? "#FF6B6B" : "rgba(10,21,71,0.35)";
}

function formatV2BadgeValue(value: unknown): string {
  const raw = String(value || "").trim();
  if (!raw) return "Unavailable";
  return raw
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function v2BadgeColor(label: string, value: unknown): string {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized || normalized === "unavailable" || normalized === "unknown") return "rgba(10,21,71,0.35)";
  if (label === "Signal Confidence") {
    if (normalized === "high" || normalized === "good") return "#02D99D";
    if (normalized === "medium" || normalized === "mixed" || normalized === "limited") return "#F0A500";
    return "#FF6B6B";
  }
  if (normalized === "none" || normalized === "low" || normalized === "good") return "#02D99D";
  if (normalized === "medium" || normalized === "mixed" || normalized === "limited") return "#F0A500";
  if (normalized === "high" || normalized === "poor") return "#FF6B6B";
  return "#0A1547";
}

function v2BadgeBg(color: string): string {
  if (color === "#02D99D") return "rgba(2,217,157,0.10)";
  if (color === "#F0A500") return "rgba(240,165,0,0.12)";
  if (color === "#FF6B6B") return "rgba(255,107,107,0.10)";
  return "rgba(10,21,71,0.05)";
}

/* ── Score number color: dynamic by value ───────────── */
function subScoreNumColor(score: number | null): string {
  if (score === null) return "rgba(10,21,71,0.25)";
  if (score === 0) return "rgba(10,21,71,0.25)";
  if (score >= 80) return "#02D99D";
  if (score >= 70) return "#F0A500";
  return "#FF6B6B";
}

const LABEL_TOOLTIPS: Record<string, string> = {
  Experience:  "Depth and relevance of prior work history to this role",
  Skills:      "Technical and role-specific competency alignment",
  Education:   "Credential match against stated educational requirements",
  Clarity:     "How clearly the candidate expressed their thoughts",
  Confidence:  "Composure and assurance demonstrated throughout the interview",
  Engagement:  "Responsiveness and participation during the interview, supported by observable interview behavior such as attention to the conversation, relevant answers, and professional presence.",
  "Response Specificity": "How concrete, detailed, and example-backed the candidate's answers were",
  "Answer Directness": "Whether answers directly addressed the question asked instead of drifting or avoiding",
  "Answer Consistency": "Whether answers stayed logically consistent across the interview",
  "Communication Structure": "Organization, clarity of flow, and whether answers were easy to follow",
};

/* ── Sub-components ─────────────────────────────────── */
function ScoreBar({ label, score, barColor }: SubScore & { barColor: string }) {
  const numColor = subScoreNumColor(score);
  const tip = LABEL_TOOLTIPS[label];
  const hasScore = typeof score === "number";
  const scoreText = hasScore ? `${score}%` : "—";
  return (
    <div className="mb-3 last:mb-0">
      <div className="flex items-center justify-between mb-1">
        <span className="flex items-center gap-1 text-xs font-semibold text-[#0A1547]/60">
          {label}
          {tip && <InfoTooltip content={tip} side="top" iconClassName="w-2.5 h-2.5 text-[#0A1547]/20" />}
        </span>
        <span className="text-xs font-black" style={{ color: numColor }}>{scoreText}</span>
      </div>
      <div className="w-full bg-gray-100 rounded-full h-1.5">
        <div
          className="h-1.5 rounded-full transition-all duration-500"
          style={{ width: hasScore ? `${score}%` : "0%", backgroundColor: hasScore ? barColor : "transparent" }}
        />
      </div>
    </div>
  );
}

function ScoreCell({ score }: { score: number | null }) {
  if (score === null) return <span className="text-[#0A1547]/25 text-sm font-semibold">—</span>;
  const color = scoreColor(score);
  return (
    <div className="min-w-[52px]">
      <p className="text-sm font-black leading-none mb-1.5" style={{ color }}>{score}%</p>
      <div className="w-full bg-gray-100 rounded-full h-1">
        <div className="h-1 rounded-full" style={{ width: `${score}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

/* ── Sort icon ──────────────────────────────────────── */
function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <ChevronsUpDown className="w-3 h-3 text-[#0A1547]/20 flex-shrink-0" />;
  return dir === "asc"
    ? <ChevronUp className="w-3 h-3 text-[#A380F6] flex-shrink-0" />
    : <ChevronDown className="w-3 h-3 text-[#A380F6] flex-shrink-0" />;
}

/* ── Expanded row panel ─────────────────────────────── */
function ExpandedPanel({
  c,
  onRefresh,
  onOpenTranscript,
  onOpenResume,
  onDownloadPdf,
  actionLoading,
  actionError,
}: {
  c: Candidate;
  onRefresh: (candidate: Candidate) => void;
  onOpenTranscript: (candidate: Candidate) => void;
  onOpenResume: (candidate: Candidate) => void;
  onDownloadPdf: (candidate: Candidate) => void;
  actionLoading: Record<string, boolean>;
  actionError?: string;
}) {
  const hasInterview = c.interview !== null || c.risk !== null || c.reliabilityState === "not_applicable" || c.insufficientInterview === true;
  const [advancedExpanded, setAdvancedExpanded] = useState(true);
  const refreshing = Boolean(actionLoading[`${String(c.id)}:refresh`]);
  const openingTranscript = Boolean(actionLoading[`${String(c.id)}:transcript`]);
  const openingResume = Boolean(actionLoading[`${String(c.id)}:resume`]);
  const openingPdf = Boolean(actionLoading[`${String(c.id)}:pdf`]);
  const transcriptDisabled = openingTranscript || !c.transcriptText;
  const resumeDisabled = openingResume || !c.candidateId;
  const pdfDisabled = openingPdf || (!c.candidateId && !c.interviewId);
  const advancedAnalysis = hasInterview ? c.interviewAnalysisV2 : null;
  const showAdvancedAnalysis = hasUsableInterviewAnalysisV2(advancedAnalysis);
  const advancedScores: NonNullable<InterviewAnalysisV2["scores"]> = advancedAnalysis?.scores || {};
  const advancedConditions: NonNullable<InterviewAnalysisV2["conditions"]> = advancedAnalysis?.conditions || {};
  const advancedRisk: NonNullable<InterviewAnalysisV2["risk"]> = advancedAnalysis?.risk || {};
  const advancedEvidenceSummary = safeV2Text(advancedAnalysis?.evidence_summary);
  const advancedEvidence = safeV2List(advancedAnalysis?.evidence);
  const advancedLimitations = safeMeaningfulV2List(advancedAnalysis?.limitations);
  const advancedScoreRows: SubScore[] = [
    { label: "Response Specificity", score: advancedScores.response_specificity ?? null, color: "#02ABE0" },
    { label: "Answer Directness", score: advancedScores.answer_directness ?? null, color: "#A380F6" },
    { label: "Answer Consistency", score: advancedScores.answer_consistency ?? null, color: "#02D99D" },
    { label: "Communication Structure", score: advancedScores.communication_structure ?? null, color: "#F0A500" },
  ];
  const advancedBadges = [
    {
      label: "Evaluation Conditions",
      value: advancedConditions.evaluation_conditions,
      tooltip: "Whether the interview conditions provided enough usable signal for evaluation",
    },
    {
      label: "Signal Confidence",
      value: advancedConditions.signal_confidence,
      tooltip: "Confidence in this analysis based on available transcript and perception evidence",
    },
    {
      label: "Audio Quality Issues",
      value: advancedConditions.audio_quality_issues,
      tooltip: "Whether audio or transcript quality may have reduced scoring reliability",
    },
    {
      label: "Distraction Risk",
      value: advancedConditions.distraction_risk,
      tooltip: "Transcript/perception-based signs that focus may have been interrupted, without visual-trait assumptions",
    },
    {
      label: "Integrity Risk",
      value: advancedRisk.integrity_risk,
      tooltip: "Content/process-based concerns such as generic, evasive, inconsistent, or scripted-style responses",
    },
  ];

  return (
    <div className="border-t border-gray-100 bg-[#F8F9FD] px-6 py-5">
      {/* Action buttons */}
      <div className="flex flex-wrap gap-2 mb-5">
        <button
          onClick={() => onRefresh(c)}
          disabled={refreshing}
          className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-full border transition-all hover:shadow-sm active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
          style={{ backgroundColor: "white", borderColor: "rgba(10,21,71,0.12)", color: "#0A1547" }}
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
          {refreshing ? "Refreshing…" : "Refresh"}
        </button>
        <button
          onClick={() => onOpenTranscript(c)}
          disabled={transcriptDisabled}
          className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-full border transition-all hover:shadow-sm active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
          style={{ backgroundColor: "white", borderColor: "rgba(10,21,71,0.12)", color: "#0A1547" }}
        >
          <FileText className="w-3.5 h-3.5" />
          {openingTranscript ? "Opening…" : "Transcript"}
        </button>
        <button
          onClick={() => onOpenResume(c)}
          disabled={resumeDisabled}
          className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-full border transition-all hover:shadow-sm active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
          style={{ backgroundColor: "white", borderColor: "rgba(10,21,71,0.12)", color: "#0A1547" }}
        >
          <Download className="w-3.5 h-3.5" />
          {openingResume ? "Opening…" : "Resume"}
        </button>
        <button
          onClick={() => onDownloadPdf(c)}
          disabled={pdfDisabled}
          className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-full border transition-all hover:shadow-sm active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
          style={{ backgroundColor: "white", borderColor: "rgba(10,21,71,0.12)", color: "#0A1547" }}
        >
          <FileDown className="w-3.5 h-3.5" />
          {openingPdf ? "Generating…" : "Download PDF"}
        </button>
      </div>
      {actionError && (
        <p className="text-xs font-semibold text-red-500 -mt-2 mb-4">{actionError}</p>
      )}

      {/* 2×2 analysis grid */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Resume Analysis */}
        <div
          className="bg-white rounded-2xl p-5"
          style={{ border: "1px solid rgba(10,21,71,0.07)", boxShadow: "0 2px 10px rgba(10,21,71,0.04)" }}
        >
          <div className="flex items-center gap-1.5 mb-4">
            <p className="text-xs font-black uppercase tracking-widest text-[#0A1547]/75">Resume Analysis</p>
            <InfoTooltip content="AI analysis of the candidate's submitted resume across key evaluation dimensions" side="bottom" />
          </div>
          <div className="mb-4">
            {c.resumeSubs.map((s) => <ScoreBar key={s.label} {...s} barColor="#02ABE0" />)}
          </div>
          <p className="text-xs leading-relaxed text-[#0A1547]/60">
            <span className="font-black text-[#0A1547]/80">Summary: </span>
            {c.resumeSummary}
          </p>
        </div>

        {/* Interview Analysis */}
        <div
          className="bg-white rounded-2xl p-5"
          style={{ border: "1px solid rgba(10,21,71,0.07)", boxShadow: "0 2px 10px rgba(10,21,71,0.04)" }}
        >
          <div className="flex items-center gap-1.5 mb-4">
            <p className="text-xs font-black uppercase tracking-widest text-[#0A1547]/75">Interview Analysis</p>
            <InfoTooltip content="AI-scored evaluation of the candidate's interview performance across verbal and communication dimensions" side="bottom" />
          </div>
          {hasInterview ? (
            <>
              <div className="mb-4">
                {c.interviewSubs.map((s) => <ScoreBar key={s.label} {...s} barColor="#A380F6" />)}
              </div>
              <p className="text-xs leading-relaxed text-[#0A1547]/60">
                <span className="font-black text-[#0A1547]/80">Summary: </span>
                {c.interviewSummary}
              </p>
            </>
          ) : (
            <p className="text-xs text-[#0A1547]/40 italic">Interview not yet completed.</p>
          )}
        </div>

        {/* Unanswered Questions */}
        <div
          className="bg-white rounded-2xl p-5"
          style={{ border: "1px solid rgba(10,21,71,0.07)", boxShadow: "0 2px 10px rgba(10,21,71,0.04)" }}
        >
          <div className="flex items-center gap-1.5 mb-3">
            <p className="text-xs font-black uppercase tracking-widest text-[#0A1547]/75">Unanswered Questions</p>
            <InfoTooltip content="Interview questions the candidate did not answer or skipped during the AI session" side="bottom" />
          </div>
          <p className="text-xs leading-relaxed text-[#0A1547]/60 whitespace-pre-line">{c.unanswered}</p>
        </div>

        {/* Signals */}
        <div
          className="bg-white rounded-2xl p-5"
          style={{ border: "1px solid rgba(10,21,71,0.07)", boxShadow: "0 2px 10px rgba(10,21,71,0.04)" }}
        >
          <div className="flex items-center gap-1.5 mb-4">
            <p className="text-xs font-black uppercase tracking-widest text-[#0A1547]/75">Signals</p>
            <InfoTooltip content="Interview signals based on transcript evidence strength and AI-aided response-risk indicators" side="bottom" />
          </div>
          {hasInterview ? (
            <div className="space-y-3">
              {/* Evaluation Reliability */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="flex items-center gap-1 text-xs font-semibold text-[#0A1547]/60">
                    Evaluation Reliability
                    <InfoTooltip content="Strength of transcript evidence supporting the interview score, not a verdict by itself" side="top" />
                  </span>
                  <span className="text-xs font-black text-[#0A1547]">
                    {typeof c.reliability === "number" ? `${c.reliability}%` : "—"}
                  </span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-1.5">
                  <div
                    className="h-1.5 rounded-full"
                    style={{
                      width: typeof c.reliability === "number" ? `${c.reliability}%` : "0%",
                      backgroundColor: typeof c.reliability === "number"
                        ? (c.reliability >= 70 ? "#02D99D" : c.reliability >= 55 ? "#F0A500" : "#FF6B6B")
                        : "transparent",
                    }}
                  />
                </div>
                {typeof c.reliability !== "number" && (
                  <p className="text-[11px] text-[#0A1547]/45 mt-2">
                    {c.reliabilityState === "not_applicable" ? "Not applicable for text interviews." : "Not yet available."}
                  </p>
                )}
              </div>

              {/* AI-aided interview risk */}
              <div className="flex items-center gap-2 pt-1">
                <span className="flex items-center gap-1 text-xs font-semibold text-[#0A1547]/60">
                  AI-aided interview risk
                  <InfoTooltip content="Probabilistic cue of possible AI-assisted responses for follow-up, not a definitive judgment" side="top" />
                </span>
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: c.insufficientInterview ? "rgba(10,21,71,0.35)" : riskColor(c.risk) }}
                />
                <span className="text-xs font-bold" style={{ color: c.insufficientInterview ? "rgba(10,21,71,0.65)" : riskColor(c.risk) }}>
                  {c.insufficientInterview ? "—" : (c.risk ?? "—")}
                </span>
              </div>

              {/* Risk narrative text */}
              {c.riskText && (
                <p className="text-[11px] text-[#0A1547]/50 leading-relaxed border-t border-gray-100 pt-3">
                  {c.riskText}
                </p>
              )}
            </div>
          ) : (
            <p className="text-xs text-[#0A1547]/40 italic">Signals will appear after the interview is completed.</p>
          )}
        </div>

        {showAdvancedAnalysis && (
          <div
            className="bg-white rounded-2xl p-5 md:col-span-2"
            style={{ border: "1px solid rgba(10,21,71,0.07)", boxShadow: "0 2px 10px rgba(10,21,71,0.04)" }}
          >
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                setAdvancedExpanded((expanded) => !expanded);
              }}
              className="w-full flex items-center justify-between gap-3 text-left"
            >
              <span className="flex items-center gap-1.5">
                <span className="text-xs font-black uppercase tracking-widest text-[#0A1547]/75">Advanced Interview Analysis</span>
                <InfoTooltip content="Evidence-backed analysis of interview response quality and evaluation conditions" side="bottom" />
              </span>
              <span className="text-[11px] font-black text-[#0A1547]/45 hover:text-[#0A1547]/70">
                {advancedExpanded ? "Collapse" : "Expand"}
              </span>
            </button>
            {advancedExpanded && (
              <div className="mt-4">
                <div className="grid md:grid-cols-2 gap-5 items-stretch">
                  <div className="h-full">
                    {advancedScoreRows.map((s) => <ScoreBar key={s.label} {...s} barColor={s.color} />)}
                  </div>
                  <div className="h-full flex flex-col justify-between gap-2">
                    {advancedBadges.map((badge) => {
                      const color = v2BadgeColor(badge.label, badge.value);
                      return (
                        <div key={badge.label} className="grid grid-cols-[minmax(0,12rem)_8.5rem] items-center gap-3">
                          <span className="flex items-center gap-1.5 min-w-0 text-xs font-semibold text-[#0A1547]/65">
                            <span className="truncate">{badge.label}</span>
                            <InfoTooltip content={badge.tooltip} side="top" iconClassName="w-2.5 h-2.5 text-[#0A1547]/25" />
                          </span>
                          <span
                            className="inline-flex items-center gap-1.5 rounded-full border px-3 py-0.5 text-xs font-black whitespace-nowrap"
                            style={{ color, backgroundColor: v2BadgeBg(color), borderColor: "rgba(10,21,71,0.08)" }}
                          >
                            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                            {formatV2BadgeValue(badge.value)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
                {advancedEvidenceSummary && (
                  <div
                    className="mt-4 rounded-xl border p-4"
                    style={{ backgroundColor: "rgba(10,21,71,0.02)", borderColor: "rgba(10,21,71,0.07)" }}
                  >
                    <p className="text-xs leading-relaxed text-[#0A1547]/60">
                      <span className="font-black text-[#0A1547]/80">Evidence Summary: </span>
                      {advancedEvidenceSummary}
                    </p>
                  </div>
                )}
                {(advancedEvidence.length > 0 || advancedLimitations.length > 0) && (
                  <div className="grid md:grid-cols-2 gap-4 mt-4">
                    {advancedEvidence.length > 0 && (
                      <div className={advancedLimitations.length > 0 ? "" : "md:col-span-2"}>
                        <p className="text-[11px] font-black uppercase tracking-widest text-[#0A1547]/55 mb-2">Evidence</p>
                        <ul className="space-y-1.5 text-xs leading-relaxed text-[#0A1547]/60 list-disc pl-4">
                          {advancedEvidence.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}
                        </ul>
                      </div>
                    )}
                    {advancedLimitations.length > 0 && (
                      <div className={advancedEvidence.length > 0 ? "" : "md:col-span-2"}>
                        <p className="text-[11px] font-black uppercase tracking-widest text-[#0A1547]/55 mb-2">Limitations</p>
                        <ul className="space-y-1.5 text-xs leading-relaxed text-[#0A1547]/60 list-disc pl-4">
                          {advancedLimitations.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Main page ──────────────────────────────────────── */
export default function CandidatesPage() {
  const { selectedClientId, loading: clientLoading, error: clientError } = useClient();
  const [expandedId, setExpandedId] = useState<string | number | null>(null);
  const [minScore, setMinScore]         = useState("");
  const [sortKey, setSortKey]           = useState<SortKey | null>(null);
  const [sortDir, setSortDir]           = useState<SortDir>("asc");
  const [clientRoles, setClientRoles] = useState<ClientRoleOption[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState("all");
  const [candidateSearch, setCandidateSearch] = useState("");
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [candidatesLoading, setCandidatesLoading] = useState(false);
  const [candidatesError, setCandidatesError] = useState("");
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});
  const [actionErrors, setActionErrors] = useState<Record<string, string>>({});
  const [transcriptModal, setTranscriptModal] = useState<{ candidateName: string; transcript: string } | null>(null);
  const [transcriptModalNotice, setTranscriptModalNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const minScoreInputRef                = useRef<HTMLInputElement>(null);

  const minScoreNum = minScore === "" ? null : parseInt(minScore, 10);

  const toggle = (id: string | number) => setExpandedId((prev) => (prev === id ? null : id));

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const loadCandidates = useCallback(async (options: { showPageLoader?: boolean; preserveOnError?: boolean } = {}) => {
    const showPageLoader = options.showPageLoader !== false;
    const preserveOnError = options.preserveOnError === true;

    if (clientLoading) return;
    if (clientError) {
      if (!preserveOnError) {
        setCandidates([]);
        setCandidatesError(clientError);
      }
      throw new Error(clientError);
    }
    if (!selectedClientId) {
      if (!preserveOnError) {
        setCandidates([]);
        setCandidatesError("");
      }
      return;
    }
    if (!backendBase) {
      const message = "Missing backend base URL configuration.";
      if (!preserveOnError) {
        setCandidates([]);
        setCandidatesError(message);
      }
      throw new Error(message);
    }

    if (showPageLoader) setCandidatesLoading(true);
    if (!preserveOnError) setCandidatesError("");

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = String(session?.access_token || "").trim();
      if (!token) throw new Error("Missing session token.");

      const response = await fetch(
        `${backendBase}/dashboard/rows?client_id=${encodeURIComponent(selectedClientId)}`,
        {
          method: "GET",
          headers: { Authorization: `Bearer ${token}` },
          credentials: "omit",
        },
      );

      const text = await response.text();
      if (!response.ok) {
        throw new Error(extractErrorMessage(text));
      }

      const payload = parseJsonSafe(text);
      const items = payload && typeof payload === "object" && Array.isArray((payload as { items?: unknown }).items)
        ? (payload as { items: unknown[] }).items
        : [];

      const mapped = items
        .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"))
        .map(mapRowToCandidate);

      setCandidates(mapped);
      if (!preserveOnError) setCandidatesError("");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load candidates.";
      if (!preserveOnError) {
        setCandidates([]);
        setCandidatesError(message);
      }
      throw new Error(message);
    } finally {
      if (showPageLoader) setCandidatesLoading(false);
    }
  }, [selectedClientId, clientLoading, clientError]);

  const withCandidateAction = useCallback(async (
    candidate: Candidate,
    action: "refresh" | "transcript" | "resume" | "pdf",
    runner: () => Promise<void>,
  ) => {
    const candidateKey = String(candidate.id);
    const loadingKey = `${candidateKey}:${action}`;
    setActionLoading((prev) => ({ ...prev, [loadingKey]: true }));
    setActionErrors((prev) => {
      const next = { ...prev };
      delete next[candidateKey];
      return next;
    });
    try {
      await runner();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Action failed.";
      setActionErrors((prev) => ({ ...prev, [candidateKey]: message }));
    } finally {
      setActionLoading((prev) => ({ ...prev, [loadingKey]: false }));
    }
  }, []);

  const openTranscriptForCandidate = useCallback((candidate: Candidate) => {
    void withCandidateAction(candidate, "transcript", async () => {
      const transcript = String(candidate.transcriptText || "").trim();
      if (!transcript) {
        throw new Error("Transcript is not available yet.");
      }
      setTranscriptModal({
        candidateName: String(candidate.name || "").trim() || "Candidate",
        transcript,
      });
    });
  }, [withCandidateAction]);

  const openResumeForCandidate = useCallback((candidate: Candidate) => {
    void withCandidateAction(candidate, "resume", async () => {
      if (!candidate.candidateId) throw new Error("Resume is not available.");
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = String(session?.access_token || "").trim();
      if (!token) throw new Error("Missing session token.");

      const response = await fetch(
        `${backendBase}/files/resume-signed-url?candidate_id=${encodeURIComponent(candidate.candidateId)}`,
        {
          method: "GET",
          headers: { Authorization: `Bearer ${token}` },
          credentials: "omit",
        },
      );
      const text = await response.text();
      if (!response.ok) throw new Error(extractErrorMessage(text));
      const data = parseJsonSafe(text) as { url?: unknown } | null;
      const url = typeof data?.url === "string" ? data.url.trim() : "";
      if (!url) throw new Error("Could not open resume.");
      window.open(url, "_blank", "noopener,noreferrer");
    });
  }, [withCandidateAction]);

  const downloadPdfForCandidate = useCallback((candidate: Candidate) => {
    void withCandidateAction(candidate, "pdf", async () => {
      if (!candidate.candidateId && !candidate.interviewId) {
        throw new Error("Report cannot be generated for this candidate.");
      }
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = String(session?.access_token || "").trim();
      if (!token) throw new Error("Missing session token.");

      const response = await fetch(`${backendBase}/reports/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        credentials: "omit",
        body: JSON.stringify({
          candidate_id: candidate.candidateId || null,
          role_id: candidate.roleId || null,
          interview_id: candidate.interviewId || null,
        }),
      });
      const text = await response.text();
      if (!response.ok) throw new Error(extractErrorMessage(text));
      const data = parseJsonSafe(text) as { signed_url?: unknown; url?: unknown; report_url?: unknown; report_id?: unknown } | null;
      const directUrl =
        (typeof data?.signed_url === "string" && data.signed_url.trim()) ||
        (typeof data?.url === "string" && data.url.trim()) ||
        (typeof data?.report_url === "string" && data.report_url.trim()) ||
        "";
      if (/^https?:\/\//i.test(directUrl)) {
        window.open(directUrl, "_blank", "noopener,noreferrer");
        return;
      }

      const downloadId = String(data?.report_id || candidate.interviewId || "").trim();
      if (!downloadId) throw new Error("Report URL not available.");

      const downloadResponse = await fetch(
        `${backendBase}/reports/${encodeURIComponent(downloadId)}/download`,
        {
          method: "GET",
          headers: { Authorization: `Bearer ${token}` },
          credentials: "omit",
        },
      );
      if (!downloadResponse.ok) {
        const downloadText = await downloadResponse.text();
        throw new Error(extractErrorMessage(downloadText));
      }
      const blob = await downloadResponse.blob();
      const objectUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = `Candidate_Report_${downloadId}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(objectUrl);
    });
  }, [withCandidateAction]);

  const refreshCandidatesFromRow = useCallback((candidate: Candidate) => {
    void withCandidateAction(candidate, "refresh", async () => {
      await loadCandidates({ showPageLoader: false, preserveOnError: true });
    });
  }, [loadCandidates, withCandidateAction]);

  const copyTranscriptFromModal = useCallback(async () => {
    if (!transcriptModal) return;
    try {
      await copyTextToClipboard(transcriptModal.transcript);
      setTranscriptModalNotice({ tone: "success", text: "Transcript copied." });
    } catch (error) {
      setTranscriptModalNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "Could not copy transcript.",
      });
    }
  }, [transcriptModal]);

  const downloadTranscriptFromModal = useCallback(() => {
    if (!transcriptModal) return;
    try {
      downloadTranscriptText(transcriptModal.candidateName, transcriptModal.transcript);
      setTranscriptModalNotice({ tone: "success", text: "Transcript downloaded." });
    } catch (error) {
      setTranscriptModalNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "Could not download transcript.",
      });
    }
  }, [transcriptModal]);

  useEffect(() => {
    void loadCandidates({ showPageLoader: true }).catch(() => {});
  }, [loadCandidates]);

  useEffect(() => {
    let alive = true;

    const loadRoles = async () => {
      if (clientLoading) return;
      if (clientError || !selectedClientId || !backendBase) {
        if (!alive) return;
        setClientRoles([]);
        return;
      }

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const token = String(session?.access_token || "").trim();
        if (!token) throw new Error("Missing session token.");

        const response = await fetch(
          `${backendBase}/roles?client_id=${encodeURIComponent(selectedClientId)}`,
          {
            method: "GET",
            headers: { Authorization: `Bearer ${token}` },
            credentials: "omit",
          },
        );
        const text = await response.text();
        if (!response.ok) throw new Error(extractErrorMessage(text));

        const payload = parseJsonSafe(text);
        const items = payload && typeof payload === "object" && Array.isArray((payload as { items?: unknown }).items)
          ? (payload as { items: unknown[] }).items
          : [];

        const mapped = items
          .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"))
          .map((item) => ({
            id: String(item.id || "").trim(),
            title: String(item.title || "").trim() || "Untitled Role",
          }))
          .filter((item) => Boolean(item.id));

        if (!alive) return;
        setClientRoles(mapped);
      } catch {
        if (!alive) return;
        setClientRoles([]);
      }
    };

    void loadRoles();
    return () => {
      alive = false;
    };
  }, [selectedClientId, clientLoading, clientError]);

  useEffect(() => {
    setSelectedRoleId("all");
    setCandidateSearch("");
  }, [selectedClientId]);

  useEffect(() => {
    setCandidateSearch("");
  }, [selectedRoleId]);

  useEffect(() => {
    if (selectedRoleId === "all") return;
    if (!clientRoles.some((role) => role.id === selectedRoleId)) {
      setSelectedRoleId("all");
    }
  }, [clientRoles, selectedRoleId]);

  useEffect(() => {
    if (expandedId === null) return;
    const hasExpanded = candidates.some((candidate) => candidate.id === expandedId);
    if (!hasExpanded) setExpandedId(null);
  }, [candidates, expandedId]);

  useEffect(() => {
    setTranscriptModalNotice(null);
  }, [transcriptModal]);

  /* Filter */
  const filteredByControls = candidates.filter((c) => {
    if (selectedRoleId !== "all" && c.roleId !== selectedRoleId) {
      return false;
    }
    if (minScoreNum !== null && !isNaN(minScoreNum)) {
      if (c.overall === null || c.overall < minScoreNum) return false;
    }
    return true;
  });
  const candidateSearchTerm = candidateSearch.trim().toLowerCase();
  const filtered = candidateSearchTerm
    ? filteredByControls.filter((candidate) =>
        [candidate.name, candidate.email].some((value) =>
          String(value || "").toLowerCase().includes(candidateSearchTerm),
        ),
      )
    : filteredByControls;

  /* Sort */
  const sorted = sortKey
    ? [...filtered].sort((a, b) => {
        let av: string | number | null;
        let bv: string | number | null;
        switch (sortKey) {
          case "name":      av = a.name; bv = b.name; break;
          case "email":     av = a.email; bv = b.email; break;
          case "role":      av = a.role; bv = b.role; break;
          case "resume":    av = a.resume ?? -1; bv = b.resume ?? -1; break;
          case "interview": av = a.interview ?? -1; bv = b.interview ?? -1; break;
          case "overall":   av = a.overall ?? -1; bv = b.overall ?? -1; break;
          case "created":   av = a.createdSort ?? 0; bv = b.createdSort ?? 0; break;
          default:          av = 0; bv = 0;
        }
        if (av === null) av = "";
        if (bv === null) bv = "";
        const cmp = typeof av === "string"
          ? av.localeCompare(bv as string)
          : (av as number) - (bv as number);
        return sortDir === "asc" ? cmp : -cmp;
      })
    : filtered;

  /* Column header button helper */
  const Th = ({
    col,
    label,
    align = "left",
    className = "",
    tooltip,
  }: {
    col: SortKey;
    label: string;
    align?: "left" | "center";
    className?: string;
    tooltip?: string;
  }) => (
    <th className={`px-4 py-3.5 whitespace-nowrap ${className}`}>
      <button
        onClick={() => handleSort(col)}
        className={`flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-[#0A1547]/40 hover:text-[#0A1547]/70 transition-colors ${align === "center" ? "mx-auto" : ""}`}
      >
        {label}
        {tooltip && <InfoTooltip content={tooltip} />}
        <SortIcon active={sortKey === col} dir={sortDir} />
      </button>
    </th>
  );

  return (
    <DashboardLayout title="Candidates">
      {/* ── Filter bar ────────────────────────────── */}
      <div
        className="bg-white rounded-2xl px-5 py-4 mb-5 flex flex-wrap items-center gap-3"
        style={{ border: "1px solid rgba(10,21,71,0.07)", boxShadow: "0 2px 12px rgba(10,21,71,0.04)" }}
      >
        <span className="text-xs font-black uppercase tracking-widest text-[#0A1547]/40">Filters</span>

        {/* Role filter */}
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-[#0A1547]/50">Role</label>
          <div className="relative">
            <select
              className="appearance-none w-36 px-4 py-2 rounded-full bg-gray-50 border border-gray-200 text-[#0A1547] text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#A380F6]/25 focus:border-[#A380F6] transition-all cursor-pointer pr-9"
              value={selectedRoleId}
              onChange={(event) => setSelectedRoleId(event.target.value)}
            >
              <option value="all">All Roles</option>
              {clientRoles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.title}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#0A1547]/40 pointer-events-none" />
          </div>
        </div>

        {/* Min Overall Score */}
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-[#0A1547]/50 whitespace-nowrap">Min Overall Score</label>
          <div className="relative flex items-center">
            <input
              ref={minScoreInputRef}
              type="number"
              min="0"
              max="100"
              value={minScore}
              onChange={(e) => setMinScore(e.target.value)}
              placeholder="e.g. 70"
              className="text-xs font-semibold text-[#0A1547] bg-gray-50 border border-gray-200 rounded-full pl-3 pr-7 py-1.5 w-24 h-[30px] focus:outline-none focus:ring-2 focus:ring-[#A380F6]/25 focus:border-[#A380F6] placeholder-gray-400"
            />
            {minScore !== "" && (
              <button
                onClick={() => { setMinScore(""); minScoreInputRef.current?.focus(); }}
                className="absolute right-2 text-[#0A1547]/30 hover:text-[#0A1547]/60 transition-colors"
                aria-label="Clear score filter"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* Candidate search */}
        <input
          type="text"
          value={candidateSearch}
          onChange={(e) => setCandidateSearch(e.target.value)}
          placeholder="Search candidate name or email..."
          className="text-xs font-semibold text-[#0A1547] bg-gray-50 border border-gray-200 rounded-full px-3 py-1.5 h-[30px] min-w-56 max-w-sm flex-1 focus:outline-none focus:ring-2 focus:ring-[#A380F6]/25 focus:border-[#A380F6] placeholder-gray-400"
        />
        {candidateSearch && (
          <button
            type="button"
            className="px-3 py-2 rounded-full text-xs font-bold text-[#0A1547]/55 bg-[#0A1547]/5 hover:bg-[#0A1547]/10 transition-colors"
            onClick={() => setCandidateSearch("")}
          >
            Clear
          </button>
        )}

        {/* Export */}
        <div className="ml-auto">
          <button
            onClick={() => {}}
            className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold rounded-full transition-all hover:opacity-90 active:scale-[0.98]"
            style={{ backgroundColor: "#A380F6", color: "white" }}
          >
            <FileDown className="w-3.5 h-3.5" />
            Export CSV
          </button>
        </div>
      </div>

      {/* ── Table ─────────────────────────────────── */}
      <div
        className="bg-white rounded-2xl overflow-hidden"
        style={{ border: "1px solid rgba(10,21,71,0.07)", boxShadow: "0 2px 12px rgba(10,21,71,0.04)" }}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                {/* Expand toggle — not sortable */}
                <th className="w-10 px-4 py-3.5" />

                <Th col="name"      label="Name" />
                <Th col="email"     label="Email"     className="hidden md:table-cell" />
                <Th col="role"      label="Role"      className="hidden lg:table-cell" />
                <Th col="resume"    label="Resume"    tooltip="AI-analyzed resume score out of 100" />
                <Th col="interview" label="Interview" tooltip="AI-scored interview performance out of 100" />
                <Th col="overall"   label="Overall"   tooltip="Combined weighted score from resume and interview" />
                <Th col="created"   label="Created"   className="hidden sm:table-cell pr-6" />
              </tr>
            </thead>
            <tbody>
              {clientLoading || candidatesLoading ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-sm text-[#0A1547]/35 font-semibold">
                    Loading candidates...
                  </td>
                </tr>
              ) : clientError || candidatesError ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-sm text-red-500 font-semibold">
                    {clientError || candidatesError}
                  </td>
                </tr>
              ) : sorted.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-sm text-[#0A1547]/35 font-semibold">
                    {candidates.length === 0 ? "No candidates yet." : "No candidates match your filters."}
                  </td>
                </tr>
              ) : (
                sorted.map((c, idx) => {
                  const isExpanded = expandedId === c.id;
                  const isLast = idx === sorted.length - 1;
                  return (
                    <React.Fragment key={c.id}>
                      <tr
                        className={`transition-colors cursor-pointer hover:bg-gray-50/70 ${
                          isExpanded ? "bg-[#F8F9FD]" : ""
                        } ${!isLast || isExpanded ? "border-b border-gray-100" : ""}`}
                        onClick={() => toggle(c.id)}
                      >
                        {/* Expand toggle */}
                        <td className="px-4 py-4 w-10">
                          <button
                            className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
                            style={{
                              backgroundColor: isExpanded
                                ? "rgba(163,128,246,0.12)"
                                : "rgba(10,21,71,0.05)",
                              color: isExpanded ? "#A380F6" : "#0A1547",
                            }}
                            onClick={(e) => { e.stopPropagation(); toggle(c.id); }}
                            aria-label={isExpanded ? "Collapse" : "Expand"}
                          >
                            {isExpanded
                              ? <ChevronUp className="w-3.5 h-3.5" />
                              : <ChevronDown className="w-3.5 h-3.5" />
                            }
                          </button>
                        </td>

                        {/* Name */}
                        <td className="px-4 py-4">
                          <p className="font-bold text-[#0A1547] text-sm leading-snug">{c.name}</p>
                          <p className="text-[11px] text-[#0A1547]/35 mt-0.5 md:hidden">{c.email}</p>
                        </td>

                        {/* Email */}
                        <td className="px-4 py-4 hidden md:table-cell">
                          <span className="text-sm text-[#0A1547]/55 font-medium">{c.email}</span>
                        </td>

                        {/* Role */}
                        <td className="px-4 py-4 hidden lg:table-cell">
                          <span className="text-sm text-[#0A1547]/70 font-semibold">{c.role}</span>
                        </td>

                        {/* Resume score */}
                        <td className="px-4 py-4"><ScoreCell score={c.resume} /></td>

                        {/* Interview score */}
                        <td className="px-4 py-4"><ScoreCell score={c.interview} /></td>

                        {/* Overall score */}
                        <td className="px-4 py-4">
                          {c.overall !== null ? (
                            <div className="min-w-[52px]">
                              <span
                                className="inline-flex items-center px-3.5 py-1.5 rounded-xl text-sm font-black"
                                style={{ backgroundColor: scoreBg(c.overall), color: scoreColor(c.overall) }}
                              >
                                {c.overall}%
                              </span>
                            </div>
                          ) : (
                            <span className="text-[#0A1547]/25 text-sm font-semibold">—</span>
                          )}
                        </td>

                        {/* Created */}
                        <td className="px-4 py-4 pr-6 hidden sm:table-cell">
                          <p className="text-xs font-semibold text-[#0A1547]/40 whitespace-nowrap leading-snug">
                            {c.created.split(" · ")[0]}
                          </p>
                          <p className="text-[11px] text-[#0A1547]/25 mt-0.5">
                            {c.created.split(" · ")[1]}
                          </p>
                        </td>
                      </tr>

                      {/* Expanded panel */}
                      {isExpanded && (
                        <tr className={!isLast ? "border-b border-gray-100" : ""}>
                          <td colSpan={8} className="p-0">
                            <ExpandedPanel
                              c={c}
                              onRefresh={refreshCandidatesFromRow}
                              onOpenTranscript={openTranscriptForCandidate}
                              onOpenResume={openResumeForCandidate}
                              onDownloadPdf={downloadPdfForCandidate}
                              actionLoading={actionLoading}
                              actionError={actionErrors[String(c.id)]}
                            />
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer row count */}
        <div className="px-6 py-3 border-t border-gray-100 flex items-center">
          <p className="text-[11px] text-[#0A1547]/35 font-semibold">
            {sorted.length} of {candidates.length} candidate{candidates.length !== 1 ? "s" : ""}
          </p>
        </div>
      </div>
      {transcriptModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 sm:p-6">
          <button
            type="button"
            onClick={() => setTranscriptModal(null)}
            className="absolute inset-0 bg-[#0A1547]/45"
            aria-label="Close transcript"
          />
          <div
            className="relative w-full max-w-2xl max-h-[85vh] bg-white rounded-2xl overflow-hidden"
            style={{ border: "1px solid rgba(10,21,71,0.10)", boxShadow: "0 20px 44px rgba(10,21,71,0.24)" }}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-[#0A1547]/40">Transcript</p>
                <h3 className="text-sm font-black text-[#0A1547] leading-snug">{transcriptModal.candidateName}</h3>
              </div>
              <button
                type="button"
                onClick={() => setTranscriptModal(null)}
                className="w-8 h-8 rounded-lg inline-flex items-center justify-center text-[#0A1547]/40 hover:text-[#0A1547] hover:bg-gray-100 transition-colors"
                aria-label="Close transcript"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-5 py-4 overflow-y-auto max-h-[calc(85vh-72px)]">
              <p className="text-sm leading-relaxed text-[#0A1547]/80 whitespace-pre-wrap break-words font-semibold">
                {transcriptModal.transcript}
              </p>
              {transcriptModalNotice && (
                <p
                  className={`mt-2 text-xs font-semibold ${
                    transcriptModalNotice.tone === "success" ? "text-[#009E73]" : "text-red-500"
                  }`}
                >
                  {transcriptModalNotice.text}
                </p>
              )}
              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setTranscriptModal(null)}
                  className="px-4 py-2 text-xs font-bold rounded-full border border-gray-200 text-[#0A1547]/70 hover:bg-gray-50 transition-colors"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => { void copyTranscriptFromModal(); }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-full border border-gray-200 text-[#0A1547]/70 hover:bg-gray-50 transition-colors"
                >
                  <Copy className="w-3.5 h-3.5" />
                  Copy Transcript
                </button>
                <button
                  type="button"
                  onClick={downloadTranscriptFromModal}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white rounded-full transition-all hover:opacity-90"
                  style={{ backgroundColor: "#A380F6" }}
                >
                  <FileDown className="w-3.5 h-3.5" />
                  Download Transcript
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
