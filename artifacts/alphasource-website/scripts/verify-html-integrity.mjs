import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const distRoot = path.join(projectRoot, "dist");
const WATCHDOG_ID = "alphasource-boot-watchdog";
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
const moduleSources = new Map();

if (!fs.existsSync(distRoot)) {
  errors.push(`Missing dist directory: ${path.relative(projectRoot, distRoot)}`);
} else {
  walk(distRoot);
}

for (const filePath of htmlFiles) {
  verifyHtmlFile(filePath);
}

verifySharedModuleSource();

if (errors.length > 0) {
  console.error("HTML integrity verification failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`Verified boot integrity for ${htmlFiles.length} HTML files.`);

function walk(dirPath) {
  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    const entryPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) walk(entryPath);
    if (entry.isFile() && entry.name.endsWith(".html")) htmlFiles.push(entryPath);
  }
}

function verifyHtmlFile(filePath) {
  const html = fs.readFileSync(filePath, "utf8");
  const routeLabel = path.relative(distRoot, filePath);
  const scriptTags = [...html.matchAll(/<script\b[^>]*>/gi)].map((match) => match[0]);
  const modules = scriptTags.filter((tag) => readAttr(tag, "type").value.toLowerCase() === "module");
  const watchdogs = html.match(new RegExp(`id=["']${WATCHDOG_ID}["']`, "gi")) || [];

  for (const script of scriptTags) {
    const type = readAttr(script, "type");
    const src = readAttr(script, "src");
    const normalizedType = type.value.trim().toLowerCase();

    if (type.present && !normalizedType) {
      errors.push(`${routeLabel}: script has an empty type attribute`);
    } else if (type.present && !VALID_SCRIPT_TYPES.has(normalizedType)) {
      errors.push(`${routeLabel}: script has an invalid type attribute: ${type.value}`);
    }

    if (src.present && !src.value.trim()) {
      errors.push(`${routeLabel}: script has an empty src attribute`);
    }

    if (src.present && isLocalJsAsset(src.value)) {
      if (normalizedType !== "module") {
        errors.push(`${routeLabel}: local JS asset is not loaded as a module script: ${src.value}`);
      }
      verifyLocalJsAsset(routeLabel, src.value);
    }
  }

  if (!/<div\b[^>]*\bid=["']root["']/i.test(html)) {
    errors.push(`${routeLabel}: missing #root`);
  }

  if (watchdogs.length !== 1) {
    errors.push(`${routeLabel}: expected one boot watchdog, found ${watchdogs.length}`);
  }

  if (modules.length !== 1) {
    errors.push(`${routeLabel}: expected one module script, found ${modules.length}`);
    return;
  }

  const module = modules[0];
  const src = readAttr(module, "src");
  if (!src.present || !src.value.trim()) {
    errors.push(`${routeLabel}: module script is missing src`);
    return;
  }

  if (!isLocalJsAsset(src.value)) {
    errors.push(`${routeLabel}: module src is not a local Vite JS asset: ${src.value}`);
    return;
  }

  const watchdog = readWatchdog(html);
  if (watchdog) {
    if (!watchdog.includes("reactCommitted") || !watchdog.includes("__boot_retry")) {
      errors.push(`${routeLabel}: watchdog is missing boot-state or retry-guard handling`);
    }
    if (/setInterval\s*\(/.test(watchdog)) {
      errors.push(`${routeLabel}: watchdog contains an interval-based reload path`);
    }
    if ((watchdog.match(/location\.replace\s*\(/g) || []).length > 1) {
      errors.push(`${routeLabel}: watchdog has more than one direct recovery navigation path`);
    }
  }

  moduleSources.set(routeLabel, src.value);
}

function readWatchdog(html) {
  const pattern = new RegExp(`<script\\b[^>]*id=["']${WATCHDOG_ID}["'][^>]*>([\\s\\S]*?)<\\/script>`, "i");
  const match = html.match(pattern);
  return match ? match[1] : "";
}

function verifySharedModuleSource() {
  const uniqueSources = new Set(moduleSources.values());
  if (uniqueSources.size <= 1) return;
  for (const [routeLabel, source] of moduleSources) {
    errors.push(`${routeLabel}: inconsistent module source: ${source}`);
  }
}

function verifyLocalJsAsset(routeLabel, srcValue) {
  const assetPath = path.join(distRoot, srcValue.replace(/^\/+/, ""));
  if (!assetPath.startsWith(`${distRoot}${path.sep}`) || !fs.existsSync(assetPath)) {
    errors.push(`${routeLabel}: local JS asset does not exist: ${srcValue}`);
    return;
  }

  const asset = fs.readFileSync(assetPath, "utf8");
  if (!asset.trim() || /^\s*<!doctype html/i.test(asset) || /^\s*<html[\s>]/i.test(asset)) {
    errors.push(`${routeLabel}: local JS asset is empty or HTML: ${srcValue}`);
  }
}

function readAttr(tag, name) {
  const pattern = new RegExp(`\\s${name}(?:\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+)))?`, "i");
  const match = tag.match(pattern);
  if (!match) return { present: false, value: "" };
  return { present: true, value: match[1] ?? match[2] ?? match[3] ?? "" };
}

function isLocalJsAsset(value) {
  return /^\/assets\/[^?#]+\.js(?:[?#].*)?$/i.test(value);
}
