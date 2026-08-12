import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pagePath = path.join(projectRoot, "src/pages/SmsConsentEvidencePage.tsx");
const appPath = path.join(projectRoot, "src/App.tsx");
const contractPath = path.join(projectRoot, "src/lib/smsOtp.ts");
const imagePath = path.join(projectRoot, "public/compliance/alphascreen-sms-opt-in.jpg");

const page = fs.readFileSync(pagePath, "utf8");
const app = fs.readFileSync(appPath, "utf8");
const contract = fs.readFileSync(contractPath, "utf8");
const image = fs.readFileSync(imagePath);

const requiredCopy = [
  "Text Message",
  "transactional verification-code text messages",
  "Message and data rates may apply",
  "Reply STOP to opt out or HELP for help",
  "Text message consent is optional; you may choose Email instead",
  "/terms/",
  "/privacy/",
  "never sends marketing messages",
  "SMS sending is disabled on this compliance-evidence page",
];

const missing = requiredCopy.filter((text) => !`${page}\n${contract}`.includes(text));
if (missing.length > 0) {
  throw new Error(`SMS consent evidence is missing required copy: ${missing.join(", ")}`);
}

if (!app.includes('<Route path="/interview/sms-consent-evidence" component={SmsConsentEvidencePage} />')) {
  throw new Error("SMS consent evidence route is missing");
}

if (/fetch\s*\(|axios\.|sendOtpSms|\/api\//.test(page)) {
  throw new Error("SMS consent evidence page must not call a delivery or application API");
}

if (!/^\xff\xd8\xff/.test(image.subarray(0, 3).toString("latin1"))) {
  throw new Error("SMS consent evidence image is not a JPEG");
}

if (image.length < 20_000) {
  throw new Error("SMS consent evidence image is unexpectedly small");
}

console.log("Verified SMS consent evidence route, disclosure copy, non-sending behavior, and hosted JPEG asset.");
