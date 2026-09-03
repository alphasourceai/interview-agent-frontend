import assert from "node:assert/strict";
import { after, test } from "node:test";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";

const testDirectory = dirname(fileURLToPath(import.meta.url));
const websiteRoot = join(testDirectory, "..", "..");

process.env.PORT ||= "4182";
process.env.BASE_PATH ||= "/";
process.env.NODE_ENV = "test";
process.env.VITE_SUPABASE_URL ||= "https://example.supabase.co";
process.env.VITE_SUPABASE_ANON_KEY ||= "test-anon-key";

const server = await createServer({
  appType: "custom",
  configFile: join(websiteRoot, "vite.config.ts"),
  logLevel: "silent",
  optimizeDeps: { include: [], noDiscovery: true },
  root: websiteRoot,
  server: { hmr: false, middlewareMode: true },
});
const statuses = await server.ssrLoadModule("/src/lib/interviewStatus.ts");
const candidates = await server.ssrLoadModule("/src/pages/dashboard/CandidatesPage.tsx");
after(async () => server.close());

test("every allowlisted backend state has one fixed concise label", () => {
  assert.deepEqual(statuses.INTERVIEW_STATE_LABELS, {
    not_started: "Not started",
    no_response: "No response",
    tech_issue: "Tech issue",
    processing: "Processing",
    incomplete: "Incomplete",
    scored: "Scored",
  });
});

test("invalid or raw backend status content is never rendered", () => {
  const raw = "database timeout: candidate@example.com";
  assert.equal(statuses.normalizeInterviewState(raw), undefined);
  const mapped = candidates.mapRowToCandidate({
    interview_state: raw,
    interview_state_label: raw,
    latest_interview_id: "interview-id-must-not-drive-state",
    interview_analysis: { summary: "insufficient data must not drive state" },
  }, 0);
  assert.equal(mapped.interviewState, undefined);
  assert.equal(mapped.interviewStateLabel, undefined);
  assert.equal(mapped.insufficientInterview, false);
});

test("finite scores including zero always render as percentages", () => {
  for (const score of [0, 58, 100]) {
    const mapped = candidates.mapRowToCandidate({
      interview_score: score,
      interview_state: "no_response",
      interview_analysis: { summary: "insufficient data" },
    }, 0);
    assert.equal(mapped.interview, score);
    const html = renderToStaticMarkup(React.createElement(candidates.ScoreCell, {
      score: mapped.interview,
      emptyState: mapped.interviewState,
    }));
    assert.match(html, new RegExp(`>${score}%<`));
    assert.doesNotMatch(html, /Interview status:/);
  }
});

test("a null score renders only the fixed accessible pill for its allowlisted state", () => {
  for (const [state, label] of Object.entries(statuses.INTERVIEW_STATE_LABELS)) {
    const html = renderToStaticMarkup(React.createElement(candidates.ScoreCell, {
      score: null,
      emptyState: state,
    }));
    assert.match(html, new RegExp(`aria-label=\"Interview status: ${label}\"`));
    assert.match(html, new RegExp(`>${label}<`));
    assert.match(html, /text-xs/);
  }
});
