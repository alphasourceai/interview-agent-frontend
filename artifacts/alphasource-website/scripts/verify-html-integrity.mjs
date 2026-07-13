import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const distRoot = path.join(projectRoot, "dist");

const VALID_SCRIPT_TYPES = new Set([
  "application/ecmascript",
  "application/javascript",
  "application/json",
  "application/ld+json",
  "importmap",
  "module",
  "speculationrules",
  "text/ecmascript",
  "text/javascript",
]);

const errors = [];
const htmlFiles = [];
const externalJsSets = new Map();

if (!fs.existsSync(distRoot)) {
  errors.push(`Missing dist directory: ${path.relative(projectRoot, distRoot)}`);
} else {
  walk(distRoot);
}

for (const filePath of htmlFiles) {
  verifyHtmlFile(filePath);
}

verifyConsistentExternalJs();

if (errors.length > 0) {
  console.error("HTML integrity verification failed:");
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log(`Verified script integrity for ${htmlFiles.length} HTML files.`);

function walk(dirPath) {
  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    const entryPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      walk(entryPath);
    } else if (entry.isFile() && entry.name.endsWith(".html")) {
      htmlFiles.push(entryPath);
    }
  }
}

function verifyHtmlFile(filePath) {
  const html = fs.readFileSync(filePath, "utf8");
  const routeLabel = path.relative(distRoot, filePath);
  const scripts = [...html.matchAll(/<script\b[^>]*>[\s\S]*?<\/script>|<script\b[^>]*\/?>/gi)].map((match) => match[0]);
  const localJsSources = [];

  for (const script of scripts) {
    const type = readAttr(script, "type");
    const src = readAttr(script, "src");
    const hasSrc = src.present && src.value.trim() !== "";
    const normalizedType = type.present ? type.value.trim().toLowerCase() : "";

    if (type.present && normalizedType === "") {
      errors.push(`${routeLabel}: script has an empty type attribute: ${compact(script)}`);
    } else if (type.present && !VALID_SCRIPT_TYPES.has(normalizedType)) {
      errors.push(`${routeLabel}: script has invalid type "${type.value}": ${compact(script)}`);
    }

    if (src.present && src.value.trim() === "") {
      errors.push(`${routeLabel}: script has an empty src attribute: ${compact(script)}`);
    }

    if (normalizedType === "module" && !hasSrc) {
      errors.push(`${routeLabel}: module script is missing src: ${compact(script)}`);
    }

    if (hasSrc && isLocalJsAsset(src.value)) {
      if (normalizedType !== "module") {
        errors.push(`${routeLabel}: local JS asset is not loaded as a module script: ${compact(script)}`);
      }
      verifyLocalJsAsset(routeLabel, src.value);
      localJsSources.push(src.value);
    }
  }

  externalJsSets.set(routeLabel, localJsSources.sort().join("\n"));
}

function verifyLocalJsAsset(routeLabel, srcValue) {
  const assetPath = path.join(distRoot, srcValue.replace(/^\/+/, ""));
  if (!assetPath.startsWith(distRoot + path.sep)) {
    errors.push(`${routeLabel}: script src escapes dist: ${srcValue}`);
    return;
  }
  if (!fs.existsSync(assetPath)) {
    errors.push(`${routeLabel}: referenced JS asset does not exist: ${srcValue}`);
    return;
  }
  const body = fs.readFileSync(assetPath, "utf8");
  if (!body.trim()) {
    errors.push(`${routeLabel}: referenced JS asset is empty: ${srcValue}`);
    return;
  }
  if (/^\s*<!doctype html/i.test(body) || /^\s*<html[\s>]/i.test(body)) {
    errors.push(`${routeLabel}: referenced JS asset contains HTML: ${srcValue}`);
  }
}

function verifyConsistentExternalJs() {
  const unique = new Set(externalJsSets.values());
  if (unique.size <= 1) return;

  for (const [routeLabel, jsSet] of externalJsSets.entries()) {
    errors.push(`${routeLabel}: inconsistent JS bundle set: ${JSON.stringify(jsSet.split("\n").filter(Boolean))}`);
  }
}

function readAttr(tag, name) {
  const pattern = new RegExp(`\\s${name}(?:\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+)))?`, "i");
  const match = tag.match(pattern);
  if (!match) return { present: false, value: "" };
  return { present: true, value: match[1] ?? match[2] ?? match[3] ?? "" };
}

function isLocalJsAsset(value) {
  return /^\/assets\/[^?#]+\.js(?:[?#].*)?$/.test(value);
}

function compact(value) {
  return value.replace(/\s+/g, " ").trim().slice(0, 220);
}
