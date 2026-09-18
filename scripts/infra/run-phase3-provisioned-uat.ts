import { readFile } from "node:fs/promises";

type FeatureFlagsResponse = {
  features?: { authentication?: boolean; assets?: boolean; generation?: boolean };
  generationAvailability?: { status?: "ready" | "unavailable"; reason?: string | null };
  auth?: { emailPassword?: boolean; configuredProviders?: string[] };
};

const evidencePath = ".planning/phases/03-product-and-service-golden-paths/03-UAT-EVIDENCE.md";
const apiBaseUrl = process.env.MOVPROMPT_UAT_API_BASE_URL?.trim() || "http://127.0.0.1:8787";

function safeOrigin(value: string): string {
  const origin = new URL(value);
  if (!['http:', 'https:'].includes(origin.protocol)) throw new Error("MOVPROMPT_UAT_API_BASE_URL must be HTTP(S)");
  if (!["127.0.0.1", "localhost"].includes(origin.hostname) && process.env.MOVPROMPT_UAT_ALLOW_REMOTE !== "true") {
    throw new Error("refusing to inspect a non-loopback UAT API without MOVPROMPT_UAT_ALLOW_REMOTE=true");
  }
  return origin.origin;
}

async function getJson(path: string): Promise<FeatureFlagsResponse> {
  const response = await fetch(`${safeOrigin(apiBaseUrl)}${path}`, { headers: { accept: "application/json" } });
  if (!response.ok) throw new Error(`${path} returned HTTP ${response.status}`);
  return response.json() as Promise<FeatureFlagsResponse>;
}

function containsAll(content: string, values: string[]) {
  return values.every((value) => content.includes(value));
}

async function verifyEvidence() {
  const evidence = await readFile(evidencePath, "utf8");
  const required = [
    "## Status",
    "PASS — Phase 03 provisioned UAT completed on a disposable local stack.",
    "No provider submission, provider request, provider attempt, or paid cost was made.",
    "## Observed product path",
    "## Observed service path",
  ];
  if (!containsAll(evidence, required)) {
    throw new Error("Phase 3 UAT evidence must state the passed product/service result and provider boundary explicitly.");
  }
  console.log("Phase 3 provisioned UAT evidence records both golden paths and the zero-provider boundary.");
}

async function inspectReadiness() {
  const [health, flags] = await Promise.all([getJson("/api/v1/health"), getJson("/api/v1/feature-flags")]);
  const blockers: string[] = [];
  if (!health || health.status !== "ok") blockers.push("API health is not ready");
  if (!flags.features?.authentication) blockers.push("authentication feature is disabled");
  if (!flags.features?.assets) blockers.push("private asset feature is disabled");
  if (!flags.auth?.emailPassword) blockers.push("email/password authentication is unavailable");
  if (!flags.features?.generation) blockers.push("generation feature is disabled");
  if (flags.generationAvailability?.status !== "ready") blockers.push(`generation availability is ${flags.generationAvailability?.reason ?? "unavailable"}`);

  // This harness deliberately performs only read-only readiness requests. A real
  // UAT is authorized only after the queue pause, Mailpit, worker heartbeat, and
  // disposable namespace are independently demonstrated.
  if (blockers.length) {
    console.error(`Phase 3 provisioned UAT NOT VERIFIED: ${blockers.join("; ")}.`);
    console.error("No mutation, provider submission, provider attempt, or paid cost was made.");
    process.exitCode = 2;
    return;
  }

  console.log("Phase 3 provisioned UAT readiness is available. This read-only command does not submit a render.");
}

if (process.argv.includes("--verify-evidence")) {
  await verifyEvidence();
} else {
  await inspectReadiness();
}
