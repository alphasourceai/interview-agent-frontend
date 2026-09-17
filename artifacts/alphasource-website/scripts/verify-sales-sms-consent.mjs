import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const errors = [];

const exactPrompt =
  "Before I text you, do you agree to receive text messages from alphaSource Network LLC about alphaScreen, including the information you requested, demo scheduling and reminders, and occasional promotional follow-ups? Message frequency varies. Message and data rates may apply. Consent is not a condition of purchase. Reply STOP to opt out or HELP for help. Do I have your permission to text this number?";

const page = read("src/pages/SalesSmsConsentPage.tsx");
const prerender = read("scripts/prerender-public-routes.mjs");
const privacy = read("src/pages/PrivacyPage.tsx");
const terms = read("src/pages/TermsPage.tsx");
const app = read("src/App.tsx");
const footer = read("src/components/Footer.tsx");
const manifest = JSON.parse(read("render-routes.json"));
const svg = read("public/sales-sms-verbal-consent-script.svg");
const sitemap = read("public/sitemap.xml");
const seo = read("src/lib/seo.ts");

assertIncludes(page, exactPrompt, "React consent page exact prompt");
assertIncludes(prerender, exactPrompt, "prerendered consent page exact prompt");
assertIncludes(page, "call recording reference", "React evidence indexing rule");
assertIncludes(prerender, "call recording reference", "prerender evidence indexing rule");
assertIncludes(page, "HELP requests to the sales or support team", "React HELP routing rule");
assertIncludes(prerender, "HELP requests are routed to the sales or support team", "prerender HELP routing rule");
for (const [label, content] of [
  ["React consent page", page],
  ["prerendered consent page", prerender],
  ["terms", terms],
]) {
  assertIncludes(content, "not sold or shared with third parties for their own marketing purposes", `${label} sharing restriction`);
  assertIncludes(content, "may retain the recorded call and contact-record details", `${label} consent-record retention`);
}
assertIncludes(svg, "EXACT RECORDED-CALL PROMPT", "carrier image heading");
assertIncludes(svg, "Do I have your permission to text this number?", "carrier image permission question");

for (const [label, content] of [
  ["privacy policy", privacy],
  ["terms", terms],
]) {
  assertIncludes(content, "Message frequency varies", `${label} frequency disclosure`);
  assertIncludes(content, "Message and data rates may apply", `${label} carrier-rates disclosure`);
  assertIncludes(content, "Consent is not a condition of purchase", `${label} optional-consent disclosure`);
  assertIncludes(content, "Reply STOP to opt out or HELP for help", `${label} STOP and HELP disclosure`);
}

assertIncludes(
  privacy,
  "not sold or shared with third parties for their own marketing purposes",
  "privacy mobile-information sharing restriction",
);
assertIncludes(app, 'path="/sales-sms-consent/"', "React trailing-slash route");
assertIncludes(footer, 'href="/sales-sms-consent/"', "public footer link");
assertIncludes(sitemap, "https://www.alphasourceai.com/sales-sms-consent/", "public sitemap consent route");
assertIncludes(seo, '"/sales-sms-consent",\n        "alphaScreen Sales SMS Verbal Consent"', "React consent-page structured data");

assert(
  manifest.publicRoutes.includes("/sales-sms-consent"),
  "render manifest public consent route",
);
assert(
  manifest.publicRedirects.some(
    (rule) => rule.source === "/sales-sms-consent" && rule.destination === "/sales-sms-consent/",
  ),
  "render manifest consent redirect",
);
assert(
  manifest.publicRewrites.some(
    (rule) =>
      rule.source === "/sales-sms-consent/" &&
      rule.destination === "/sales-sms-consent/index.html",
  ),
  "render manifest consent rewrite",
);

const pngPath = path.join(projectRoot, "public/sales-sms-verbal-consent-script.png");
assert(fs.existsSync(pngPath), "carrier-review PNG exists");
if (fs.existsSync(pngPath)) {
  assert(fs.statSync(pngPath).size > 10_000, "carrier-review PNG is non-empty");
}

if (errors.length > 0) {
  console.error("Sales SMS consent verification failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("Verified the sales SMS verbal-consent prompt, evidence process, policy disclosures, routing, and carrier image.");

function read(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), "utf8");
}

function assertIncludes(content, expected, label) {
  assert(content.includes(expected), label);
}

function assert(condition, label) {
  if (!condition) errors.push(`Missing or invalid ${label}`);
}
