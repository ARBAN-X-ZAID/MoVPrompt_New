import { readFile } from "node:fs/promises";

const files = process.argv.slice(2);
const targets = files.length > 0
  ? files
  : [
      ".planning/phases/03-product-and-service-golden-paths/03-UAT-EVIDENCE.md",
      ".planning/phases/03-product-and-service-golden-paths/03-BROWSER-EVIDENCE.md",
    ];

const forbidden = [
  { name: "email address", pattern: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i },
  { name: "bearer credential", pattern: /\bBearer\s+[A-Za-z0-9._~-]+/i },
  { name: "signed URL query", pattern: /(?:X-Amz-(?:Signature|Credential|Security-Token)|[?&](?:signature|token|state|access_token)=)/i },
  { name: "cookie value", pattern: /(?:set-cookie|cookie)\s*[:=]\s*[^\s;]+/i },
  { name: "private object key", pattern: /\b(?:private|users|assets|creator-assets|creator-outputs)\/[A-Za-z0-9_./-]{8,}/i },
  { name: "UUID", pattern: /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i },
  { name: "request identifier", pattern: /\b(?:request|trace)[_-]?id\s*[:=]\s*\S+/i },
  { name: "secret assignment", pattern: /\b(?:api[_-]?key|secret|password)\s*[:=]\s*\S+/i },
  { name: "remote URL", pattern: /https?:\/\/(?!127\.0\.0\.1|localhost)[^\s)]+/i },
];

const violations = [];
for (const file of targets) {
  const content = await readFile(file, "utf8");
  for (const [index, line] of content.split(/\r?\n/).entries()) {
    for (const rule of forbidden) {
      if (rule.pattern.test(line)) violations.push(`${file}:${index + 1}: ${rule.name}`);
    }
  }
}

if (violations.length > 0) {
  console.error("Phase 3 evidence contains restricted material:\n" + violations.join("\n"));
  process.exit(1);
}

console.log(`Phase 3 evidence redaction passed for ${targets.length} file(s).`);
