import { PublicRenderRunSchema } from "../packages/contracts/src/generation.ts";

type JsonValue = string | number | boolean | null | JsonObject | JsonValue[];
type JsonObject = { [key: string]: JsonValue };

const FORBIDDEN_VALUE_FRAGMENTS = [
  "bytedance/",
  "vercel-ai-gateway",
  "vgw4.",
  "https://",
  "http://",
  "signature=",
  "api-key",
  "retry_attempt",
  "reviewer_evidence",
];

const PUBLIC_RUN_PATHS = new Set([
  "id", "projectId", "projectVersionId", "capability", "quoteId", "quotedCredits", "chargedCredits",
  "starterEntitlementUsed", "status", "processingStage", "outputAvailable", "error", "error.code",
  "error.message", "createdAt", "updatedAt", "completedAt",
]);
const LOG_PATHS = new Set(["level", "message", "timestamp", "requestId", "runId", "stage", "errorCode"]);

function assertAllowedPaths(value: JsonObject, allowedPaths: Set<string>, prefix = ""): void {
  for (const [key, child] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (!allowedPaths.has(path)) throw new Error(`redaction_unallowlisted_path:${path}`);
    if (child && typeof child === "object" && !Array.isArray(child)) {
      assertAllowedPaths(child, allowedPaths, path);
    }
  }
}

function assertNoSensitiveValues(value: JsonValue): void {
  if (typeof value === "string") {
    const normalized = value.toLowerCase();
    const match = FORBIDDEN_VALUE_FRAGMENTS.find((fragment) => normalized.includes(fragment));
    if (match) throw new Error(`redaction_forbidden_value:${match}`);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach(assertNoSensitiveValues);
    return;
  }
  if (value && typeof value === "object") {
    Object.values(value).forEach(assertNoSensitiveValues);
  }
}

const publicRun = PublicRenderRunSchema.parse({
  id: "11111111-1111-4111-8111-111111111111",
  projectId: "22222222-2222-4222-8222-222222222222",
  projectVersionId: "33333333-3333-4333-8333-333333333333",
  capability: "video.product_fidelity",
  quoteId: "44444444-4444-4444-8444-444444444444",
  quotedCredits: 80,
  chargedCredits: 80,
  starterEntitlementUsed: false,
  status: "processing",
  processingStage: "securing_output",
  outputAvailable: false,
  error: {
    code: "provider_output_unavailable",
    message: "We could not finish saving this video. Your project is safe; try again from Projects.",
  },
  createdAt: "2026-08-21T10:00:00.000Z",
  updatedAt: "2026-08-21T10:01:00.000Z",
  completedAt: null,
});

const structuredLogCapture: JsonObject = {
  level: "warn",
  message: "render_output_reconciliation_pending",
  timestamp: "2026-08-21T10:01:00.000Z",
  requestId: "req_phase4_fixture",
  runId: publicRun.id,
  stage: publicRun.processingStage,
  errorCode: publicRun.error?.code ?? null,
};

assertAllowedPaths(publicRun, PUBLIC_RUN_PATHS);
assertAllowedPaths(structuredLogCapture, LOG_PATHS);
assertNoSensitiveValues(publicRun);
assertNoSensitiveValues(structuredLogCapture);

console.info("phase4_redaction_verifier:pass");
