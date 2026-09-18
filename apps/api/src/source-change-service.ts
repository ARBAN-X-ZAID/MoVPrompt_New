import { createHash } from "node:crypto";

import type { ReplaceProjectSourceRequest } from "@movprompt/contracts";

import type { CreatorRepository } from "./creator-repository.js";

type SourceChangeRepository = Pick<CreatorRepository, "replaceSource">;

export type SourceChangeService = {
  replace(input: {
    userId: string;
    projectId: string;
    idempotencyKey: string;
    input: ReplaceProjectSourceRequest;
  }): Promise<{ version: Awaited<ReturnType<CreatorRepository["replaceSource"]>>; sourceFingerprint: string }>;
};

function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${canonical(object[key])}`).join(",")}}`;
}

export function sourceFingerprint(source: ReplaceProjectSourceRequest["source"]) {
  return createHash("sha256").update(canonical({
    type: source.type,
    name: source.name.trim(),
    description: source.description.trim(),
    price: source.price.trim(),
    brand: source.brand.trim(),
    assetIds: [...new Set(source.assetIds)].sort(),
  })).digest("hex");
}

function withoutIncompatibleOutput(
  configuration: ReplaceProjectSourceRequest["configuration"],
  fingerprint: string,
): ReplaceProjectSourceRequest["configuration"] {
  const next = structuredClone(configuration) as ReplaceProjectSourceRequest["configuration"];
  next.sourceFingerprint = fingerprint;
  const currentCreatorProject = next.creatorProject;
  if (currentCreatorProject && typeof currentCreatorProject === "object" && !Array.isArray(currentCreatorProject)) {
    const creatorProject = currentCreatorProject as Record<string, string | number | boolean | null | Record<string, never> | Array<never>>;
    creatorProject.videoUrl = null;
    creatorProject.jobId = null;
    creatorProject.renderRunId = null;
    creatorProject.lastError = null;
    creatorProject.pendingGenerationId = null;
    creatorProject.pendingQuoteCredits = null;
    creatorProject.status = "ready";
    creatorProject.sourceFingerprint = fingerprint;
  }
  return next;
}

export function createSourceChangeService({ repository }: { repository: SourceChangeRepository }): SourceChangeService {
  return {
    async replace({ userId, projectId, idempotencyKey, input }) {
      const fingerprint = sourceFingerprint(input.source);
      const version = await repository.replaceSource({
        userId,
        projectId,
        parentVersionId: input.parentVersionId,
        idempotencyKey,
        sourceFingerprint: fingerprint,
        sourceAssetIds: input.source.assetIds,
        input: {
          parentVersionId: input.parentVersionId,
          ...(input.templateVersionId ? { templateVersionId: input.templateVersionId } : {}),
          mode: input.mode,
          configuration: withoutIncompatibleOutput(input.configuration, fingerprint),
          productRecipe: input.productRecipe,
          campaignRecipe: input.campaignRecipe,
        },
      });
      return { version, sourceFingerprint: fingerprint };
    },
  };
}
