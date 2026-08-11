import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => fs.readFileSync(path.join(ROOT, relativePath), "utf8");
const bundled = await build({
  entryPoints: [path.join(ROOT, "src/lib/dashboardActivity.ts")],
  bundle: true,
  format: "esm",
  platform: "node",
  write: false,
});
const activity = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString("base64")}`);

test("dashboard activity timestamps accept only a newer finite positive value", () => {
  assert.equal(activity.parseDashboardActivity("1234.9"), 1234);
  assert.equal(activity.parseDashboardActivity(null), 0);
  assert.equal(activity.parseDashboardActivity("not-a-time"), 0);
  assert.equal(activity.newerDashboardActivity(1000, "1001"), 1001);
  assert.equal(activity.newerDashboardActivity(1000, "1000"), null);
  assert.equal(activity.newerDashboardActivity(1000, "999"), null);
  assert.equal(activity.newerDashboardActivity(1000, null), null);
});

test("dashboard activity in another tab reschedules the local inactivity deadline", () => {
  const app = read("src/App.tsx");
  assert.match(app, /window\.addEventListener\("storage",\s*handleStoredActivity\)/);
  assert.match(app, /event\.key\s*!==\s*DASHBOARD_ACTIVITY_STORAGE_KEY/);
  assert.match(app, /newerDashboardActivity\(lastActivityRef\.current,\s*event\.newValue\)/);
  assert.match(app, /scheduleFrom\(activityAt\)/);
  assert.match(app, /window\.removeEventListener\("storage",\s*handleStoredActivity\)/);
});

test("support voice lifecycle explicitly marks dashboard activity", () => {
  const voice = read("src/components/SupportVoicePopover.tsx");
  assert.match(voice, /signalDashboardActivity\(\)/);
  assert.match(voice, /if \(message\.type !== "audio_delta"\) signalDashboardActivity\(\)/);
});
