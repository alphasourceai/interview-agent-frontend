import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const distRoot = path.join(projectRoot, "dist");
const manifestPath = path.join(projectRoot, "render-routes.json");
const redirectsPath = path.join(distRoot, "_redirects");

const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const errors = [];

const routeMarkerChecks = [
  "/faq",
  "/support",
  "/privacy",
  "/terms",
  "/alphascreen/pricing",
  "/alphascreen/security",
];

for (const route of manifest.publicRoutes) {
  const filePath = routeIndexPath(route);
  const html = readRequiredFile(filePath, `public route ${route}`);
  if (routeMarkerChecks.includes(route)) {
    assertIncludes(html, `data-public-prerender-route="${route}"`, `${route} route marker`);
  }
}

const indexHtml = readRequiredFile(path.join(distRoot, "index.html"), "root SPA shell");
assertIncludes(indexHtml, '<div id="root"', "root #root");
assertIncludes(indexHtml, 'script type="module"', "root module script");

for (const route of manifest.spaShellRoutes) {
  const shellHtml = readRequiredFile(routeIndexPath(route), `${route} SPA shell`);
  assertIncludes(shellHtml, '<div id="root"', `${route} #root`);
  assertIncludes(shellHtml, 'script type="module"', `${route} module script`);
  assertIncludes(shellHtml, "public-checkout-static-fallback", `${route} static fallback`);
}

for (const privateDir of ["dashboard", "admin", "membership-agreement", "interview-access"]) {
  const privatePath = path.join(distRoot, privateDir);
  if (fs.existsSync(privatePath)) {
    errors.push(`Private snapshot directory should not exist: ${path.relative(projectRoot, privatePath)}`);
  }
}

const redirectRules = readRedirectRules();
const expectedRules = [
  ...manifest.publicRedirects,
  ...manifest.publicRewrites,
  ...manifest.spaShellRewrites,
  ...manifest.dynamicSpaRewrites,
  manifest.catchAll,
].map(formatRouteRule);

if (redirectRules.length !== expectedRules.length) {
  errors.push(`_redirects rule count mismatch: expected ${expectedRules.length}, found ${redirectRules.length}`);
}

for (let index = 0; index < expectedRules.length; index += 1) {
  if (redirectRules[index] !== expectedRules[index]) {
    errors.push(
      `_redirects rule ${index + 1} mismatch: expected "${expectedRules[index]}", found "${redirectRules[index] ?? "<missing>"}"`,
    );
  }
}

if (errors.length > 0) {
  console.error("Route verification failed:");
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log(
  `Verified ${manifest.publicRoutes.length} public snapshots, ${manifest.spaShellRoutes.length} SPA shell route, and ${expectedRules.length} routing rules.`,
);

function routeIndexPath(route) {
  if (route === "/") return path.join(distRoot, "index.html");
  return path.join(distRoot, ...route.split("/").filter(Boolean), "index.html");
}

function readRequiredFile(filePath, label) {
  if (!fs.existsSync(filePath)) {
    errors.push(`Missing ${label}: ${path.relative(projectRoot, filePath)}`);
    return "";
  }

  const stats = fs.statSync(filePath);
  if (!stats.isFile() || stats.size === 0) {
    errors.push(`Empty or invalid ${label}: ${path.relative(projectRoot, filePath)}`);
    return "";
  }

  return fs.readFileSync(filePath, "utf8");
}

function assertIncludes(value, expected, label) {
  if (!value.includes(expected)) {
    errors.push(`Missing ${label}: ${expected}`);
  }
}

function readRedirectRules() {
  const content = readRequiredFile(redirectsPath, "dist _redirects");
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));
}

function formatRouteRule(rule) {
  return `${rule.source} ${rule.destination} ${rule.status}`;
}
