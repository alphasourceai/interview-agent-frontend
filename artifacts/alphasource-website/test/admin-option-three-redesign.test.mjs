import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => fs.readFileSync(path.join(ROOT, relativePath), "utf8");
const layout = read("src/components/AdminLayout.tsx");
const overview = read("src/pages/admin/AdminOverviewPage.tsx");
const dashboardRoles = read("src/pages/dashboard/RolesPage.tsx");
const adminRoles = read("src/pages/admin/AdminRolesPage.tsx");

test("client and admin role creation controls use matched explicit heights", () => {
  assert.match(dashboardRoles, /className="h-12 w-full rounded-xl border px-4 text-sm/);
  assert.match(dashboardRoles, /className="h-12 w-full cursor-pointer rounded-xl border px-4 text-sm/);
  assert.match(dashboardRoles, /className="flex h-12 flex-1 cursor-pointer items-center/);
  assert.match(adminRoles, /"h-10 w-full rounded-xl px-3 text-sm/);
  assert.match(adminRoles, /className="flex h-10 w-full cursor-pointer items-center/);
});

test("admin shell follows the approved dark-rail hierarchy without removing controls", () => {
  assert.match(layout, /backgroundColor: "#071033"/);
  assert.match(layout, />Admin console</);
  assert.match(layout, /adminClientScopeLabel\(selectedClient\)/);
  assert.match(layout, /clientDropdownOpen/);
  assert.match(layout, /Search clients/);
  assert.match(layout, /System status/);
  assert.match(layout, /<AppearanceSelector \/>/);
  assert.match(layout, /const isOverview = location === "\/admin"/);
  assert.match(layout, /lg:w-\[calc\(100%-15rem\)\]/);
  assert.match(layout, /isOverview \? "lg:hidden" : ""/);
  assert.doesNotMatch(layout, /!isOverview && <header/);
  assert.match(layout, /aria-label="Open menu"/);
  for (const label of ["Overview", "Metrics", "Interview Reliability", "Clients", "Roles", "Candidates", "Billing", "Audit Logs"]) {
    assert.match(layout, new RegExp(`label: "${label}"`));
  }
});

test("admin overview uses real authenticated data in the approved option-three structure", () => {
  for (const label of [
    "Platform overview",
    "Client operational review",
    "Interview progress",
    "Completion follow-up",
    "Recent platform activity",
  ]) {
    assert.match(overview, new RegExp(label));
  }
  assert.match(overview, /getJson\("\/admin\/clients"/);
  assert.match(overview, /getJson\("\/admin\/roles"/);
  assert.match(overview, /`\/admin\/candidates\?client_id=/);
  assert.match(overview, /clientBreakdown\.slice\(0, 8\)/);
  assert.match(overview, /recentActivity\.slice\(0, 3\)/);
  assert.match(overview, /visibleClients = isAllClients/);
  assert.match(overview, /globalClients\.filter\(\(client\) => client\.id === selectedClientId\)/);
  assert.match(overview, /exportOverview/);
  assert.match(overview, /\.\.\.clientBreakdown\.map/);
  assert.match(overview, /isAllClients \? "across all clients" : "for selected client"/);
  assert.match(overview, /isAllClients \? "platform average" : "selected client average"/);
  assert.match(overview, /card\.label === "Active Roles"/);
  assert.match(overview, />Current active roles</);
  assert.match(overview, /sub: "in selected period"/);
  assert.doesNotMatch(overview, /sub: "total screenings"/);
  assert.match(overview, /<AppearanceSelector \/>/);
  assert.match(overview, /href="\/admin\/candidates"/);
  assert.match(overview, /href="\/admin\/clients"/);
  assert.doesNotMatch(overview, /Northstar Dental Group|Peakview Health|Juniper Retail|Atlas Services|Crescent Hospitality/);
  assert.doesNotMatch(overview, /All services operational/);
});
