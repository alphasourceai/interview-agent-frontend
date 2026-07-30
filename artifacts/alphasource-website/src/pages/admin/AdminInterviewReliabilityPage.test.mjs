import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const page = await readFile(path.join(here, "AdminInterviewReliabilityPage.tsx"), "utf8");
const app = await readFile(path.join(here, "../../App.tsx"), "utf8");
const layout = await readFile(path.join(here, "../../components/AdminLayout.tsx"), "utf8");

test("admin route and existing navigation include Interview Reliability", () => {
  assert.match(app, /AdminInterviewReliabilityPage/);
  assert.match(app, /path="\/admin\/interview-reliability"/);
  assert.match(layout, /label: "Interview Reliability"/);
  assert.match(layout, /href: "\/admin\/interview-reliability"/);
  assert.match(layout, /Audit Logs/);
});

test("summary strip, required filters, and all supported sorts are present", () => {
  for (const summary of [
    "total_interviews",
    "completed_normally",
    "incomplete",
    "reconnect_attempted",
    "reconnect_failed",
    "watchdog_terminated",
    "processing_incomplete_or_overdue",
  ]) {
    assert.match(page, new RegExp(summary));
  }
  for (const filter of [
    "time_range",
    "client_id",
    "role_id",
    "status",
    "attempt",
    "failure_category",
    "reconnect_outcome",
    "processing_state",
    "search",
  ]) {
    assert.match(page, new RegExp(filter));
  }
  for (const sort of ["started_at", "ended_at", "duration", "status", "failure", "processing_age"]) {
    assert.match(page, new RegExp(`value="${sort}"|changeSort\\("${sort}"\\)`));
  }
});

test("page preserves query state and implements apply, reset, pagination, loading, empty, and error states", () => {
  assert.match(page, /new URLSearchParams\(window\.location\.search\)/);
  assert.match(page, /window\.history\.replaceState/);
  assert.match(page, /window\.history\.pushState/);
  assert.match(page, /window\.addEventListener\("popstate", restoreFromHistory\)/);
  assert.match(page, /window\.removeEventListener\("popstate", restoreFromHistory\)/);
  assert.match(page, /Apply filters/);
  assert.match(page, /Reset/);
  assert.match(page, /Previous/);
  assert.match(page, /Next/);
  assert.match(page, /Loading interviews/);
  assert.match(page, /No interviews match the selected filters/);
  assert.match(page, /role="alert"/);
});

test("desktop filters use two ordered rows with a wide candidate search and trailing actions", () => {
  const primaryRow = page.indexOf('data-testid="reliability-filter-row-primary"');
  const secondaryRow = page.indexOf('data-testid="reliability-filter-row-secondary"');
  const candidateSearch = page.indexOf(">Candidate Search<", secondaryRow);
  const sort = page.indexOf(">Sort<", candidateSearch);
  const direction = page.indexOf(">Direction<", sort);
  const actions = page.indexOf('data-testid="reliability-filter-actions"', direction);
  assert.ok(primaryRow >= 0);
  assert.ok(secondaryRow > primaryRow);
  assert.ok(candidateSearch > secondaryRow);
  assert.ok(sort > candidateSearch);
  assert.ok(direction > sort);
  assert.ok(actions > direction);
  assert.match(page, /reliability-filter-row-primary" className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-7"/);
  assert.match(page, /space-y-1 md:col-span-2 xl:col-span-3/);
  assert.match(page, /reliability-filter-actions" className="flex flex-wrap items-center justify-end/);
  assert.match(page, /aria-label="Candidate Search"/);
});

test("pagination defaults to 20 and exposes only the approved page-size options", () => {
  assert.match(page, /type PageSize = 10 \| 20 \| 50 \| 100/);
  assert.match(page, /const PAGE_SIZE_OPTIONS = \[10, 20, 50, 100\] as const/);
  assert.match(page, /pageSize: 20/);
  assert.match(page, /page_size: String\(filters\.pageSize\)/);
  assert.match(page, /parsePageSize\(params\.get\("page_size"\)\)/);
  assert.match(page, /aria-label="Rows per page"/);
  assert.match(page, /PAGE_SIZE_OPTIONS\.map/);
  assert.match(page, /return PAGE_SIZE_OPTIONS\.includes\(parsed as PageSize\) \? \(parsed as PageSize\) : 20/);
  assert.doesNotMatch(page, /page_size: "25"/);
});

test("page-size changes preserve active state, reset page one, and clamp deleted-result pages", () => {
  assert.match(page, /const changePageSize = \(pageSize: PageSize\) =>/);
  assert.match(page, /const next = \{ \.\.\.filters, page: 1, pageSize \}/);
  assert.match(page, /setDraftFilters\(next\)/);
  assert.match(page, /setFilters\(next\)/);
  assert.match(page, /payload\.pagination\.page !== filters\.page/);
  assert.match(page, /filters\.page <= totalPages/);
  assert.match(page, /\{ \.\.\.current, page: totalPages \}/);
});

test("detail panel exposes bounded reliability, processing, attempt, and ordered timeline views", () => {
  assert.match(page, /role="dialog"/);
  assert.match(page, /aria-modal="true"/);
  assert.match(page, /Reliability summary/);
  assert.match(page, /Processing status/);
  assert.match(page, /Attempt and recovery/);
  assert.match(page, /Diagnostic timeline/);
  assert.match(page, /detail\.timeline/);
  assert.match(page, /detail\.timeline\.map/);
  assert.doesNotMatch(page, /groupedTimeline/);
  assert.match(page, /evidence_completeness/);
  assert.match(page, /Technical details/);
  assert.match(page, /event\.key === "Escape"/);
});

test("restricted diagnostic content and browser console logging are absent", () => {
  for (const restricted of [
    "transcript_scores",
    "interview_summary",
    "unanswered_candidate_questions",
    "provider_conversation_id",
    "participant_id",
    "claim_token",
    "transcript_hash",
    "storage_reference",
    "room_url",
    "resume_content",
    "candidate_email",
    "candidate_phone",
  ]) {
    assert.equal(page.includes(restricted), false, restricted);
  }
  assert.equal(/\bconsole\.(log|warn|error|debug)\b/.test(page), false);
});

test("accessibility basics include labelled filters, keyboard close, focus rings, and explicit detail controls", () => {
  assert.match(page, /aria-label="Interview reliability filters"/);
  assert.match(page, /aria-label="Reliability summary"/);
  assert.match(page, /aria-label="Close reliability detail"/);
  assert.match(page, /aria-label=\{`Open reliability detail for/);
  assert.match(page, /focus-visible:ring-2/);
  assert.match(page, /closeRef\.current\?\.focus/);
});
