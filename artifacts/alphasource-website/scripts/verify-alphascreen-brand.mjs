import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");
const marksRoot = path.join(root, "src/assets/branding/alphascreen/marks");

const expectedMarks = ["08", "09"].flatMap((geometry) =>
  ["gradient", "navy", "white", "duotone"].map(
    (treatment) => `alphascreen-mark-${geometry}-${treatment}.svg`,
  ),
);

for (const filename of expectedMarks) {
  const svg = fs.readFileSync(path.join(marksRoot, filename), "utf8");
  assert.match(svg, /<path\b/, `${filename} must contain vector paths`);
  assert.doesNotMatch(svg, /<image\b|data:image/i, `${filename} must not wrap raster artwork`);
}

const component = read("src/components/AlphaScreenBrand.tsx");
const css = read("src/index.css");
const dashboardBrand = read("src/components/DashboardBrand.tsx");
const home = read("src/pages/HomePage.tsx");
const overview = read("src/pages/AlphaScreenPage.tsx");
const retail = read("src/pages/AlphaScreenRetailPages.tsx");
const navbar = read("src/components/Navbar.tsx");
const footer = read("src/components/Footer.tsx");

assert.match(component, /geometry = "08"/, "#08 must be the default static mark");
assert.match(component, /geometry="09"[\s\S]*alphascreen-breathing-mark__active/, "#09 must be confined to the breathing component");
assert.match(css, /animation-iteration-count:\s*3/, "breathing must stop after three cycles");
assert.match(css, /@media \(prefers-reduced-motion: reduce\)/, "breathing must respect reduced motion");
assert.match(dashboardBrand, /AlphaScreenLockup/, "dashboard chrome must use the alphaScreen lockup");
assert.match(home, /AlphaScreenBreathingMark/, "the task-bound processing example must use the breathing mark");
assert.match(overview, /AlphaScreenLockup/, "the alphaScreen overview hero must use the official lockup");
assert.match(retail, /AlphaScreenLockup/, "alphaScreen retail heroes must use the official lockup");
assert.doesNotMatch(navbar, /AlphaScreenLockup|AlphaScreenMark/, "the corporate navbar must remain alphaSource branded");
assert.doesNotMatch(footer, /AlphaScreenLockup|AlphaScreenMark/, "the corporate footer must remain alphaSource branded");

const directGeometry09Uses = [
  "src/pages",
  "src/components",
].flatMap((relativeDir) => {
  const matches = [];
  const visit = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(fullPath);
      if (entry.isFile() && /\.(tsx?|jsx?)$/.test(entry.name)) {
        const content = fs.readFileSync(fullPath, "utf8");
        if (content.includes('geometry="09"')) matches.push(path.relative(root, fullPath));
      }
    }
  };
  visit(path.join(root, relativeDir));
  return matches;
});

assert.deepEqual(
  directGeometry09Uses,
  ["src/components/AlphaScreenBrand.tsx"],
  "#09 must not be used as a standalone product mark",
);

console.log(`alphaScreen brand verification passed (${expectedMarks.length} vector masters).`);
