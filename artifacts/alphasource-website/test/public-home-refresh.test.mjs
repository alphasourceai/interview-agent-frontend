import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path) => readFileSync(resolve(root, path), "utf8");

const app = read("src/App.tsx");
const appearance = read("src/components/AppearanceSelector.tsx");
const navbar = read("src/components/Navbar.tsx");
const footer = read("src/components/Footer.tsx");
const styles = read("src/index.css");
const home = read("src/pages/HomePage.tsx");
const about = read("src/pages/AboutPage.tsx");
const alphaScreen = read("src/pages/AlphaScreenPage.tsx");

test("the full public site exposes the dashboard-style appearance contract", () => {
  assert.match(appearance, /value: "light"/);
  assert.match(appearance, /value: "dark"/);
  assert.match(appearance, /value: "system"/);
  assert.match(appearance, /alwaysShowLabel/);
  assert.match(navbar, /<AppearanceSelector \/>/);
  assert.match(navbar, /<AppearanceSelector alwaysShowLabel \/>/);
  assert.doesNotMatch(navbar, /isHomePage && <AppearanceSelector/);
  assert.match(app, /data-theme=\{resolvedMode\}/);
  assert.match(app, /public-site-rest/);
  assert.doesNotMatch(app, /resolvedMode : "light"/);
});

test("approved rest-of-site treatment keeps the footer and theme provider-neutral", () => {
  assert.match(footer, /const EXPLORE_LINKS/);
  assert.match(footer, /const PRODUCT_LINKS/);
  assert.match(footer, /Agentic AI that enhances human judgment — helping teams reclaim time and spot potential in every talent interaction\./);
  assert.match(footer, />Email us</);
  assert.match(footer, />AI Customer Support</);
  assert.match(footer, /AI_SUPPORT_PHONE_DISPLAY/);
  assert.match(styles, /\.public-site-rest\.dark main/);
  assert.match(styles, /\.dark \.gradient-hero-bg/);
});

test("dark technology copy and how-it-works card sizing remain consistent", () => {
  assert.match(about, /font-semibold text-\[#0A1547\]/);
  assert.match(about, /text-\[#0A1547\]\/70/);
  assert.doesNotMatch(about, /color: item\.weight === "semibold"/);
  assert.match(alphaScreen, /min-h-\[10\.625rem\] h-full bg-white rounded-2xl/);
});

test("approved homepage structure keeps the continuous dark value band", () => {
  assert.match(home, /function ValueBandSection\(\)/);
  assert.match(home, /bg-\[#070E36\]/);
  assert.match(home, /<HeroSection \/>\s*<ValueBandSection \/>\s*<PeopleDrivenSection \/>/);
  assert.match(home, /dark:bg-\[#09133E\]/);
  assert.match(home, /dark:bg-\[#0D1A4A\]/);
});

test("owner-approved hero and alphaScreen motion timings remain intact", () => {
  assert.match(home, /animate=\{\{ y: \[0, -10, 0\] \}\}/);
  assert.match(home, /duration: 5, repeat: Infinity/);
  assert.match(home, /duration: 4\.5/);
  assert.match(home, /duration: 3\.8/);
  assert.match(home, /delay: 0\.2/);
  assert.match(home, /delay: 0\.7/);
  assert.match(home, /delay: 1\.2/);
  assert.match(home, /delay: 1\.7/);
  assert.match(home, /delay: 2\.2, duration: 0\.5/);
});

test("public routes, contact form, and sign-in affordances remain wired", () => {
  for (const href of ["/", "/about/", "/alphascreen", "/alphascreen/how-it-works", "/#contact", "/faq"]) {
    assert.match(navbar, new RegExp(`href: "${href.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`));
  }
  assert.match(home, /<LeadCaptureForm/);
  assert.match(home, /formId="home-contact"/);
  assert.match(navbar, /data-testid="nav-login-button"/);
});
