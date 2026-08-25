import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => fs.readFileSync(path.join(ROOT, relativePath), "utf8");
const layout = read("src/components/DashboardLayout.tsx");
const overview = read("src/pages/dashboard/OverviewPage.tsx");
const support = read("src/components/SupportVoicePopover.tsx");
const appearance = read("src/components/AppearanceSelector.tsx");

test("option three shell keeps the client selector in the header", () => {
  const header = layout.slice(layout.indexOf("<header"), layout.indexOf("</header>"));
  assert.match(header, /clientDropdownOpen/);
  assert.match(layout, /selectedClient\.name/);
  assert.match(layout, /Search clients|clientSearchPlaceholder/);
});

test("option three shell includes the tour card and sidebar support action", () => {
  assert.match(layout, /Quick guide/i);
  assert.match(layout, /Need a refresher\?/);
  assert.match(layout, /Replay the dashboard tour/);
  assert.match(layout, /<SupportVoicePopover \/>/);
  assert.match(layout, /aria-label="Start dashboard tour"/);
  assert.match(layout, /min-h-0 flex-1 py-4/);
  assert.match(support, /placement = "sidebar"/);
});

test("shell renders titles and descriptions for every dashboard page", () => {
  for (const title of ["Overview", "Roles", "Automation", "Candidates", "Members", "Billing", "Entities", "Support"]) {
    assert.match(layout, new RegExp(`${title}:`));
  }
  assert.match(layout, /<h1[^>]*>\{title\}<\/h1>/);
  assert.match(layout, />\{pageDescription\}<\/p>/);
  assert.doesNotMatch(layout, /hidden truncate text-sm md:block/);
  assert.doesNotMatch(layout, /title === "Overview"/);
});

test("appearance uses a styled dashboard menu instead of a native select", () => {
  assert.match(appearance, /DropdownMenuTrigger/);
  assert.match(appearance, /DropdownMenuRadioGroup/);
  assert.match(appearance, /DropdownMenuRadioItem/);
  assert.match(appearance, /rounded-xl border/);
  assert.match(appearance, /Appearance: \$\{selectedOption\.label\}/);
  assert.doesNotMatch(appearance, /<select/);
});

test("overview labels the candidates route honestly", () => {
  assert.match(overview, /href="\/dashboard\/candidates"[^>]*>All candidates<\/Link>/);
  assert.doesNotMatch(overview, />Timeline<\/Link>/);
});

test("period and sidebar controls retain truthful behavior", () => {
  assert.match(overview, /const periodRows = useMemo/);
  assert.match(overview, /value: String\(stats\.roles\)/);
  assert.match(overview, /value: String\(stats\.candidates\)/);
  assert.doesNotMatch(overview, /ChevronDown/);
  assert.match(layout, /text-red-600 focus:bg-red-50 focus:text-red-700/);
  assert.match(layout, /<DropdownMenuItem[\s\S]*?<LogOut[\s\S]*?Sign Out[\s\S]*?<\/DropdownMenuItem>/);
});

test("overview uses live role and dashboard row endpoints for every panel", () => {
  assert.match(overview, /fetch\(`\$\{backendBase\}\/roles/);
  assert.match(overview, /fetch\(`\$\{backendBase\}\/dashboard\/rows/);
  assert.match(overview, /metricDefinitions/);
  assert.match(overview, /roleHealth/);
  assert.match(overview, /activityData/);
  assert.match(overview, /sortedRows\.slice\(0, 3\)/);
  assert.doesNotMatch(overview, /Morgan Miller|Alex Carter|Northstar Dental Group/);
});

test("option three overview retains the approved information hierarchy", () => {
  for (const label of [
    "Today&apos;s decisions",
    "Your action queue",
    "Role health",
    "Interview activity",
    "Recent movement",
    "Automations running",
  ]) {
    assert.match(overview, new RegExp(label));
  }
  assert.match(overview, /ResponsiveContainer/);
  assert.match(overview, /StatusBadge/);
});
