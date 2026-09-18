import { createHash } from "node:crypto";
import { PresenterModeSchema, TemplateQuoteEligibilitySchema, type PresenterMode } from "@movprompt/contracts";
import { COLLECTIONS, hashGenerationConfiguration, newMongoObjectId, type JsonObject, type MongoDatabase } from "@movprompt/db";
import type { Document } from "mongodb";
import type {
  GenerationRepository,
  OwnedGenerationQuote,
  OwnedPresenterFootageAsset,
  OwnedProjectVersion,
  OwnedReferenceAsset,
  OwnedRenderRun,
  PublishedTemplateVersion,
} from "./generation-repository.js";

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function renderRun(row: Document | null): OwnedRenderRun | null {
  if (!row) return null;
  return {
    id: String(row.id), projectId: String(row.projectId), projectVersionId: String(row.projectVersionId),
    capabilityAlias: String(row.capabilityAlias), quoteId: String(row.quoteId),
    quotedCredits: Number(row.quotedCredits), chargedCredits: Number(row.chargedCredits ?? 0),
    starterEntitlementUsed: row.starterEntitlementUsed === true,
    status: row.status, processingStage: row.processingStage,
    provider: typeof row.provider === "string" ? row.provider : null,
    providerRequestId: typeof row.providerRequestId === "string" ? row.providerRequestId : null,
    outputBucket: typeof row.outputBucket === "string" ? row.outputBucket : null,
    outputObjectKey: typeof row.outputObjectKey === "string" ? row.outputObjectKey : null,
    errorCode: typeof row.errorCode === "string" ? row.errorCode : null,
    errorMessage: typeof row.errorMessage === "string" ? row.errorMessage : null,
    chargedAt: row.chargedAt instanceof Date ? row.chargedAt : null,
    completedAt: row.completedAt instanceof Date ? row.completedAt : null,
    createdAt: row.createdAt as Date, updatedAt: row.updatedAt as Date,
  };
}

export function createMongoGenerationRepository(database: MongoDatabase): GenerationRepository {
  const projects = database.collection(COLLECTIONS.creatorProjects);
  const versions = database.collection(COLLECTIONS.creatorProjectVersions);
  const assets = database.collection(COLLECTIONS.creatorProjectAssets);
  const templates = database.collection(COLLECTIONS.videoTemplates);
  const templateVersions = database.collection(COLLECTIONS.videoTemplateVersions);
  const runs = database.collection(COLLECTIONS.renderRuns);
  return {
    async findOwnedProjectVersion(userId, projectVersionId) {
      const version = await versions.findOne({ id: projectVersionId, userId });
      if (!version) return null;
      const project = await projects.findOne({ id: version.projectId, userId, status: { $ne: "trashed" } });
      if (!project) return null;
      return { ...(typeof project.storageOwnerId === "string" ? { storageOwnerId: project.storageOwnerId } : {}), id: String(version.id), projectId: String(version.projectId), mode: version.mode, templateVersionId: typeof version.templateVersionId === "string" ? version.templateVersionId : null, configuration: (version.configuration ?? {}) as JsonObject, productRecipe: (version.productRecipe ?? {}) as JsonObject, campaignRecipe: (version.campaignRecipe ?? {}) as JsonObject } as OwnedProjectVersion;
    },
    async findOwnedReferenceAssets(userId, projectId, objectKeys) {
      if (!objectKeys.length || !(await projects.findOne({ id: projectId, userId, status: { $ne: "trashed" } }))) return [];
      const rows = await assets.find({ userId, projectId, objectKey: { $in: objectKeys }, kind: { $in: ["product", "reference"] }, checksumSha256: { $ne: null } }).toArray();
      return rows.map((row) => ({ objectKey: String(row.objectKey), bucket: String(row.bucket), mimeType: String(row.mimeType), sizeBytes: Number(row.sizeBytes), checksumSha256: String(row.checksumSha256) })) as OwnedReferenceAsset[];
    },
    async findOwnedPresenterFootageAsset(userId, projectId, assetId) {
      if (!(await projects.findOne({ id: projectId, userId, status: { $ne: "trashed" } }))) return null;
      const row = await assets.findOne({ id: assetId, projectId, userId, kind: "footage" });
      return row ? { id: String(row.id), mimeType: String(row.mimeType), sizeBytes: Number(row.sizeBytes), checksumSha256: typeof row.checksumSha256 === "string" ? row.checksumSha256 : null, durationMs: typeof row.durationMs === "number" ? row.durationMs : null } as OwnedPresenterFootageAsset : null;
    },
    async findPublishedTemplateVersion(templateVersionId) {
      const version = await templateVersions.findOne({ id: templateVersionId, publishedAt: { $ne: null } });
      if (!version || !(await templates.findOne({ id: version.templateId, publishingState: "published" }))) return null;
      const recipe = (version.recipe ?? {}) as JsonObject; const inputSchema = (version.inputSchema ?? {}) as JsonObject;
      const parsed = TemplateQuoteEligibilitySchema.safeParse({ goals: strings(recipe.goals), supportedLanguages: strings(version.supportedLanguages), supportedRatios: strings(version.supportedRatios), supportedMarkets: strings(version.supportedMarkets), requiredInputs: strings(recipe.requiredInputs), capabilityPolicy: strings(recipe.capabilityPolicy) });
      const modes = [...new Set([...strings(recipe.presenterModes), ...strings(inputSchema.presenterModes)])].map((value) => PresenterModeSchema.safeParse(value)).flatMap((value) => value.success ? [value.data] : []);
      return { id: String(version.id), durationSeconds: Number(version.durationSeconds), starterRenderEligible: recipe.starterRenderEligible === true, eligibility: parsed.success ? parsed.data : null, supportedLanguages: strings(version.supportedLanguages), presenterModes: modes as PresenterMode[],
        ...(typeof recipe.templatePromptVersion === "string" && Array.isArray(recipe.sceneRecipe) ? {
          visualRecipe: { versionNumber: Number(version.versionNumber), promptVersion: recipe.templatePromptVersion, visualSystem: String(recipe.visualSystem), scenes: recipe.sceneRecipe },
        } : {}),
      } as PublishedTemplateVersion;
    },
    async hasAvailableStarterEntitlement(userId) {
      return Boolean(await database.collection(COLLECTIONS.entitlements).findOne({ userId, type: "starter_template_render", status: "available" }));
    },
    async findOwnedQuote(userId, quoteId) {
      const row = await database.collection(COLLECTIONS.generationQuotes).findOne({ id: quoteId, userId });
      return row ? { id: String(row.id), templateVersionId: typeof row.templateVersionId === "string" ? row.templateVersionId : null, capabilityAlias: String(row.capabilityAlias), credits: Number(row.credits), entitlementEligible: row.entitlementEligible === true, configurationHash: String(row.configurationHash), expiresAt: row.expiresAt as Date } as OwnedGenerationQuote : null;
    },
    async findOwnedRun(userId, runId) { return renderRun(await runs.findOne({ id: runId, userId })); },
    async listOwnedRuns(userId, projectId, limit) {
      const filter = { userId, ...(projectId ? { projectId } : {}) };
      const rows = await runs.find(filter).sort({ createdAt: -1, id: -1 }).limit(limit).toArray();
      const visible = await Promise.all(rows.map(async (row) => await projects.findOne({ id: row.projectId, userId, status: { $ne: "trashed" } }) ? renderRun(row) : null));
      return visible.filter((row): row is OwnedRenderRun => Boolean(row));
    },
    async requestOutputRecovery(userId, runId, idempotencyKey, now) {
      const found = await database.transaction(async (session) => {
        const run = await runs.findOne({ id: runId, userId }, { session }); if (!run) return null;
        const version = await versions.findOne({ id: run.projectVersionId, projectId: run.projectId, userId }, { session }); if (!version) return null;
        await runs.updateOne({ id: runId, userId }, { $set: { status: "processing", processingStage: "securing_output", errorCode: null, errorMessage: null, updatedAt: now } }, { session });
        await database.collection(COLLECTIONS.renderAttempts).updateOne({ renderRunId: runId, userId, attemptNumber: run.qualityAttempt }, { $set: { status: "processing", updatedAt: now } }, { session });
        await projects.updateOne({ id: run.projectId, userId, currentWorkingVersionId: run.projectVersionId }, { $set: { status: "generating", updatedAt: now } }, { session });
        const operationKey = `render.output_recovery:${runId}:${createHash("sha256").update(idempotencyKey).digest("hex").slice(0, 16)}`;
        await database.collection(COLLECTIONS.outboxJobs).updateOne({ topic: "render.start", operationKey }, { $setOnInsert: { id: newMongoObjectId(), topic: "render.start", operationKey, payload: { runId: run.id, userId: run.userId, projectId: run.projectId, projectVersionId: run.projectVersionId, quoteId: run.quoteId, capabilityAlias: run.capabilityAlias, configurationHash: hashGenerationConfiguration(version.configuration), qualityAttempt: run.qualityAttempt }, status: "pending", attempts: 0, availableAt: now, createdAt: now, updatedAt: now } }, { upsert: true, session });
        return String(run.id);
      });
      return found ? renderRun(await runs.findOne({ id: found, userId })) : null;
    },
    async requestProviderCancellation(userId, runId, now) {
      const result = await runs.updateOne({ id: runId, userId, status: { $in: ["queued", "processing"] }, providerRequestId: { $ne: null }, chargedAt: { $ne: null } }, { $set: { status: "cancelling", processingStage: "cancelling", updatedAt: now } });
      return result.matchedCount ? renderRun(await runs.findOne({ id: runId, userId })) : null;
    },
  };
}
