import assert from "node:assert/strict";
import { after, test } from "node:test";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const testDirectory = dirname(fileURLToPath(import.meta.url));
const websiteRoot = join(testDirectory, "..", "..");

process.env.PORT ||= "4177";
process.env.BASE_PATH ||= "/";
process.env.NODE_ENV = "test";

const server = await createServer({
  appType: "custom",
  configFile: join(websiteRoot, "vite.config.ts"),
  logLevel: "silent",
  optimizeDeps: { include: [], noDiscovery: true },
  root: websiteRoot,
  server: { hmr: false, middlewareMode: true },
});
const candidateErrors = await server.ssrLoadModule("/src/lib/candidateFlowErrors.ts");
after(async () => server.close());

test("duration configuration failure has one stable candidate-safe message", () => {
  assert.equal(
    candidateErrors.getCandidateFlowError(
      {
        code: "INTERVIEW_DURATION_NOT_CONFIGURED",
        detail: "synthetic raw configuration detail",
      },
      "fallback",
    ),
    "Interview duration is not configured. Please contact the hiring team.",
  );
});
