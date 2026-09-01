import type { InterviewType } from "@/lib/interviewContract";

export interface RubricFaqItem {
  question: string;
  answer: string;
}

export interface InterviewTypeGuide {
  value: InterviewType;
  heading: string;
  bullets: readonly string[];
}

export const RUBRIC_FAQ: readonly Readonly<RubricFaqItem>[] = Object.freeze([
  Object.freeze({
    question: "What determines interview length?",
    answer: "Membership determines interview length. Essential interviews are 10 minutes, Pro interviews are 12 minutes, and Enterprise interviews are 15 minutes.",
  }),
  Object.freeze({
    question: "What determines the number of questions?",
    answer: "Membership determines the number of scored questions. Essential includes 5, Pro includes 6, and Enterprise includes 7.",
  }),
  Object.freeze({
    question: "What does interview type control?",
    answer: "Interview type controls the purpose and substance of the questions. You can choose Core, Leadership, or Technical based on what the role requires.",
  }),
  Object.freeze({
    question: "What is a Core interview?",
    answer: "A Core interview is a broad, role-relevant screen of experience, judgment, ownership, communication, adaptability, and readiness. It is not limited to entry-level roles.",
  }),
  Object.freeze({
    question: "What is a Leadership interview?",
    answer: "A Leadership interview evaluates coaching, accountability, prioritization, decision-making, conflict, change, and execution.",
  }),
  Object.freeze({
    question: "What is a Technical interview?",
    answer: "A Technical interview is a role-specific applied assessment of technical knowledge, troubleshooting, implementation, tradeoffs, risk, and quality.",
  }),
  Object.freeze({
    question: "Why does the interview begin with a warm-up?",
    answer: "The warm-up helps candidates adjust to speaking with an AI. It is not scored and is not used in hiring recommendations.",
  }),
  Object.freeze({
    question: "Does the warm-up count as an interview question?",
    answer: "No. The warm-up is separate from the membership-level scored-question count.",
  }),
]);

export const INTERVIEW_TYPE_SELECTION_GUIDE: readonly Readonly<InterviewTypeGuide>[] = Object.freeze([
  Object.freeze({
    value: "core",
    heading: "Choose Core when",
    bullets: Object.freeze([
      "The role is primarily an individual-contributor or general operating role.",
      "Broad evidence of experience, judgment, reliability, communication, and adaptability is needed.",
      "Specialized technical depth or people leadership is not the primary purpose.",
    ]),
  }),
  Object.freeze({
    value: "leadership",
    heading: "Choose Leadership when",
    bullets: Object.freeze([
      "The role manages people, teams, functions, or material organizational outcomes.",
      "Coaching, accountability, prioritization, conflict, change, and execution are central.",
      "Evidence from actual leadership examples is needed.",
    ]),
  }),
  Object.freeze({
    value: "technical",
    heading: "Choose Technical when",
    bullets: Object.freeze([
      "The role requires specialized applied knowledge.",
      "Troubleshooting, implementation, technical judgment, quality, compliance, or risk are central.",
      "A broad general screen would not adequately assess readiness.",
    ]),
  }),
]);

export const INTERVIEW_TYPE_CAUTIONS: readonly string[] = Object.freeze([
  "Core does not mean entry-level.",
  "Do not select Leadership based only on seniority.",
  "Do not select Technical merely because the role uses software or tools.",
  "Membership determines interview time and question quantity.",
  "Interview type determines question substance.",
]);
