import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const DEFAULT_OUTPUT = path.join(ROOT, "src/content/support-voice-knowledge.json");
const DEFAULT_HASH_OUTPUT = path.join(ROOT, "src/content/support-voice-knowledge.sha256");

function outputArg(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? path.resolve(process.argv[index + 1]) : fallback;
}

const compiled = await build({
  stdin: {
    contents: `
      export {
        DASHBOARD_SUPPORT_KNOWLEDGE_VERSION,
        dataPracticeSections,
        faqSections,
        guidanceCards,
        productUpdates
      } from "./src/content/dashboardSupportContent.ts";
      export {
        PUBLIC_CONTENT_LAST_UPDATED,
        publicFaqSections,
        publicSupportQuestions,
        publicSupportTopics
      } from "./src/lib/publicContent.ts";
    `,
    resolveDir: ROOT,
    sourcefile: "support-voice-knowledge-entry.ts",
    loader: "ts",
  },
  absWorkingDir: ROOT,
  alias: { "@": path.join(ROOT, "src") },
  bundle: true,
  format: "esm",
  platform: "node",
  target: "node20",
  treeShaking: true,
  write: false,
  logLevel: "silent",
});

const moduleUrl = `data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString("base64")}`;
const content = await import(moduleUrl);

const snapshot = {
  schema_version: 1,
  knowledge_version: content.DASHBOARD_SUPPORT_KNOWLEDGE_VERSION,
  public_content_last_updated: content.PUBLIC_CONTENT_LAST_UPDATED,
  sources: {
    dashboard_faq: "src/content/dashboardSupportContent.ts",
    dashboard_rubric_faq: "src/content/rubricGuidance.ts#RUBRIC_FAQ",
    public_faq: "src/lib/publicContent.ts#publicFaqSections",
    public_support_topics: "src/lib/publicContent.ts#publicSupportTopics",
    public_support_questions: "src/lib/publicContent.ts#publicSupportQuestions",
  },
  dashboard: {
    guidance_cards: content.guidanceCards,
    data_practices: content.dataPracticeSections,
    product_updates: content.productUpdates,
    faq_sections: content.faqSections,
  },
  public: {
    faq_sections: content.publicFaqSections,
    support_topics: content.publicSupportTopics,
    support_questions: content.publicSupportQuestions,
  },
};

const json = `${JSON.stringify(snapshot, null, 2)}\n`;
const hash = crypto.createHash("sha256").update(json, "utf8").digest("hex");
const output = outputArg("--output", DEFAULT_OUTPUT);
const hashOutput = outputArg("--hash-output", DEFAULT_HASH_OUTPUT);

fs.mkdirSync(path.dirname(output), { recursive: true });
fs.mkdirSync(path.dirname(hashOutput), { recursive: true });
fs.writeFileSync(output, json, { encoding: "utf8", mode: 0o644 });
fs.writeFileSync(hashOutput, `${hash}\n`, { encoding: "utf8", mode: 0o644 });

if (pathToFileURL(output).protocol !== "file:" || pathToFileURL(hashOutput).protocol !== "file:") {
  throw new Error("SUPPORT_VOICE_KNOWLEDGE_OUTPUT_INVALID");
}

console.log(`support_voice_knowledge version=${snapshot.knowledge_version} sha256=${hash} bytes=${Buffer.byteLength(json)}`);
