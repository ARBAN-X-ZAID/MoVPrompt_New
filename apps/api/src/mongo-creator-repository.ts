import { createHash } from "node:crypto";
import {
  JsonObjectSchema,
  validateTemplateCampaignPayload,
  type BusinessVertical,
  type CampaignGoal,
  type ClaimDraftRequest,
  type CreatorProjectRecord,
  type PresenterMode,
  type ProjectVersion,
  type PublicTemplate,
} from "@movprompt/contracts";
import {
  COLLECTIONS,
  canonicalizeGenerationConfiguration,
  newMongoObjectId,
  type JsonObject,
  type MongoDatabase,
} from "@movprompt/db";
import type { ClientSession, Document, Filter } from "mongodb";
import { CreatorRepositoryError, type CreatorRepository } from "./creator-repository.js";

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function localized(value: Record<string, string>, fallback: string) {
  const en = value.en?.trim() || fallback;
  return { en, ar: value.ar?.trim() || en };
}

function templatePublic(row: Document): PublicTemplate {
  const recipe = (row.recipe ?? {}) as JsonObject;
  return {
    id: String(row.templateId), slug: String(row.slug), category: String(row.category),
    discoveryCategory: ["electronics", "food", "ecommerce", "advertising", "other"].includes(String(row.discoveryCategory))
      ? row.discoveryCategory as PublicTemplate["discoveryCategory"]
      : "other",
    versionId: String(row.id), versionNumber: Number(row.versionNumber),
    name: localized((row.localizedName ?? {}) as Record<string, string>, String(row.slug)),
    description: localized((row.localizedDescription ?? {}) as Record<string, string>, String(row.slug)),
    outcome: typeof recipe.outcome === "string" && recipe.outcome.trim() ? recipe.outcome : "Create a clear campaign outcome",
    verticals: strings(recipe.verticals).filter((item): item is BusinessVertical => ["salon", "clinic", "retail", "ecommerce", "real_estate", "services"].includes(item)),
    goals: strings(recipe.goals).filter((item): item is CampaignGoal => ["whatsapp_orders", "bookings", "launch", "offer", "demonstration", "education", "announcement", "trust", "brand_story"].includes(item)),
    durationSeconds: Number(row.durationSeconds),
    supportedLanguages: strings(row.supportedLanguages).filter((item): item is "ar" | "en" | "bilingual" => ["ar", "en", "bilingual"].includes(item)),
    supportedRatios: strings(row.supportedRatios).filter((item): item is "9:16" | "1:1" | "4:5" | "16:9" => ["9:16", "1:1", "4:5", "16:9"].includes(item)),
    supportedMarkets: strings(row.supportedMarkets).filter((item): item is "KW" => item === "KW"),
    requiredInputs: strings(recipe.requiredInputs),
    presenterModes: strings(recipe.presenterModes).filter((item): item is PresenterMode => ["none", "ai_ugc", "uploaded_spokesperson", "digital_twin"].includes(item)),
    starterRenderEligible: recipe.starterRenderEligible === true,
    previewAvailable: Boolean(row.previewObjectKey), posterAvailable: Boolean(row.posterObjectKey),
    qualityStatus: recipe.qualityStatus === "approved" || recipe.qualityStatus === "review" ? recipe.qualityStatus : "development",
    dialectPolicy: {
      arabicDialect: "kuwaiti", locale: "ar-KW",
      register: (recipe.dialectPolicy as JsonObject | undefined)?.register === "polished" ? "polished" : "conversational",
      crossDialectFallback: false,
    },
    qualityPolicy: {
      tier: "premium",
      acceptanceScore: typeof (recipe.qualityPolicy as JsonObject | undefined)?.acceptanceScore === "number" ? Number((recipe.qualityPolicy as JsonObject).acceptanceScore) : 85,
      internalRetryLimit: typeof (recipe.qualityPolicy as JsonObject | undefined)?.internalRetryLimit === "number" ? Number((recipe.qualityPolicy as JsonObject).internalRetryLimit) : 2,
      hardGates: strings((recipe.qualityPolicy as JsonObject | undefined)?.hardGates),
      scoredDimensions: strings((recipe.qualityPolicy as JsonObject | undefined)?.scoredDimensions),
    },
    capabilityPolicy: strings(recipe.capabilityPolicy), tags: strings(recipe.tags),
    scenes: Array.isArray(recipe.scenes) ? recipe.scenes.flatMap((scene) => {
      if (!scene || typeof scene !== "object" || Array.isArray(scene)) return [];
      const item = scene as Record<string, unknown>;
      if (typeof item.id !== "string" || typeof item.title !== "string" || typeof item.purpose !== "string" || typeof item.duration !== "number" || typeof item.direction !== "string") return [];
      return [{ id: item.id, title: item.title, purpose: item.purpose, duration: item.duration, headline: typeof item.headline === "string" ? item.headline : "", direction: item.direction }];
    }) : [],
  };
}

function versionPublic(row: Document): ProjectVersion {
  return {
    id: String(row.id), projectId: String(row.projectId),
    parentVersionId: typeof row.parentVersionId === "string" ? row.parentVersionId : null,
    templateVersionId: typeof row.templateVersionId === "string" ? row.templateVersionId : null,
    mode: row.mode as ProjectVersion["mode"], versionNumber: Number(row.versionNumber),
    configuration: JsonObjectSchema.parse(row.configuration ?? {}),
    productRecipe: JsonObjectSchema.parse(row.productRecipe ?? {}),
    campaignRecipe: JsonObjectSchema.parse(row.campaignRecipe ?? {}),
    changeReason: typeof row.changeReason === "string" ? row.changeReason : null,
    createdAt: (row.createdAt as Date).toISOString(),
  };
}

function assertPersistable(input: { mode: ClaimDraftRequest["mode"]; templateVersionId?: string | null | undefined; configuration: unknown; productRecipe: unknown; campaignRecipe: unknown }) {
  const result = validateTemplateCampaignPayload(input);
  if (result && !result.success) throw new CreatorRepositoryError("invalid_campaign_configuration");
}

function deterministicUuid(...parts: string[]): string {
  const bytes = createHash("sha256").update(parts.join("\0")).digest().subarray(0, 16);
  bytes[6] = (bytes[6]! & 0x0f) | 0x50; bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function createMongoCreatorRepository(database: MongoDatabase): CreatorRepository {
  const projects = database.collection(COLLECTIONS.creatorProjects);
  const versions = database.collection(COLLECTIONS.creatorProjectVersions);
  const templates = database.collection(COLLECTIONS.videoTemplates);
  const templateVersions = database.collection(COLLECTIONS.videoTemplateVersions);

  async function ensureTemplate(id: string | null | undefined, session?: ClientSession) {
    if (!id) return;
    const options = session ? { session } : {};
    const version = await templateVersions.findOne({ id, publishedAt: { $ne: null } }, options);
    const template = version ? await templates.findOne({ id: version.templateId, publishingState: "published" }, options) : null;
    if (!template) throw new CreatorRepositoryError("template_not_found");
  }

  async function deletionProtection(project: Document, session?: ClientSession) {
    const options = session ? { session } : {};
    const owner = { projectId: project.id, userId: project.userId };
    const savedRun = await database.collection(COLLECTIONS.renderRuns).findOne({
      ...owner, $or: [{ status: "completed" }, { outputObjectKey: { $exists: true, $nin: [null, ""] } }],
    }, options);
    const savedExport = await database.collection(COLLECTIONS.exports).findOne(owner, options);
    const activeRun = await database.collection(COLLECTIONS.renderRuns).findOne({
      ...owner, status: { $in: ["submitting", "queued", "processing", "cancelling"] },
    }, options);
    return {
      hasGeneratedVideo: Boolean(project.currentAcceptedVersionId || savedRun || savedExport || project.status === "completed"),
      hasActiveGeneration: Boolean(activeRun),
    };
  }

  async function loadProject(userId: string, projectId: string, session?: ClientSession): Promise<CreatorProjectRecord | null> {
    const options = session ? { session } : {};
    const project = await projects.findOne({ id: projectId, userId }, options);
    if (!project) return null;
    const workingVersionId = project.currentWorkingVersionId ?? project.currentAcceptedVersionId ?? null;
    const current = workingVersionId ? await versions.findOne({ id: workingVersionId, projectId, userId }, options) : null;
    const latestRun = workingVersionId ? await database.collection(COLLECTIONS.renderRuns).findOne(
      { projectId, projectVersionId: workingVersionId, userId }, { ...options, sort: { createdAt: -1, id: -1 } },
    ) : null;
    const [versionCount, outputCount] = await Promise.all([
      versions.countDocuments({ projectId, userId }, options),
      database.collection(COLLECTIONS.exports).countDocuments({ projectId, userId, status: "completed" }, options),
    ]);
    return {
      id: String(project.id), title: String(project.title), mode: project.mode as CreatorProjectRecord["mode"], status: project.status as CreatorProjectRecord["status"],
      currentWorkingVersionId: workingVersionId,
      currentAcceptedVersionId: typeof project.currentAcceptedVersionId === "string" ? project.currentAcceptedVersionId : null,
      latestRenderRunId: latestRun ? String(latestRun.id) : null,
      latestRenderProjectVersionId: latestRun ? String(latestRun.projectVersionId) : null,
      latestRenderRunStatus: latestRun ? latestRun.status as CreatorProjectRecord["latestRenderRunStatus"] : null,
      deletedAt: project.deletedAt instanceof Date ? project.deletedAt.toISOString() : null,
      createdAt: (project.createdAt as Date).toISOString(), updatedAt: (project.updatedAt as Date).toISOString(),
      currentVersion: current ? versionPublic(current) : null, versionCount, outputCount,
      ...await deletionProtection(project, session),
    };
  }

  const repository: CreatorRepository = {
    async listPublishedTemplates(filters) {
      const published = await templates.find({ publishingState: "published" }).sort({ category: 1, slug: 1 }).toArray();
      const rows = (await Promise.all(published.map(async (template) => {
        const version = await templateVersions.findOne({ id: template.currentPublishedVersionId, publishedAt: { $ne: null } });
        return version ? { ...version, templateId: template.id, slug: template.slug, category: template.category, discoveryCategory: template.discoveryCategory } : null;
      }))).filter(Boolean) as Document[];
      const mapped = rows.map(templatePublic);
      return mapped.filter((template) => (!filters.vertical || template.verticals.includes(filters.vertical)) && (!filters.goal || template.goals.includes(filters.goal)) && (!filters.language || template.supportedLanguages.includes(filters.language)));
    },
    async findPublishedTemplate(slugOrId) {
      return (await this.listPublishedTemplates({})).find((template) => template.slug === slugOrId || template.id === slugOrId) ?? null;
    },
    async claimDraft(userId, input) {
      assertPersistable(input);
      const projectId = await database.transaction(async (session) => {
        const existing = await projects.findOne({ userId, clientDraftId: input.draftId }, { session });
        if (existing) {
          const currentId = existing.currentWorkingVersionId ?? existing.currentAcceptedVersionId;
          const version = currentId ? await versions.findOne({ id: currentId, projectId: existing.id, userId }, { session }) : null;
          const requested = canonicalizeGenerationConfiguration({ title: input.title, mode: input.mode, templateVersionId: input.templateVersionId ?? null, configuration: input.configuration, productRecipe: input.productRecipe, campaignRecipe: input.campaignRecipe });
          const persisted = version ? canonicalizeGenerationConfiguration({ title: existing.title, mode: version.mode, templateVersionId: version.templateVersionId ?? null, configuration: version.configuration, productRecipe: version.productRecipe, campaignRecipe: version.campaignRecipe }) : "";
          if (requested !== persisted) throw new CreatorRepositoryError("idempotency_conflict");
          return String(existing.id);
        }
        await ensureTemplate(input.templateVersionId, session);
        const now = new Date(); const id = newMongoObjectId(); const versionId = newMongoObjectId();
        await projects.insertOne({ id, userId, title: input.title, mode: input.mode, status: "ready", clientDraftId: input.draftId, currentWorkingVersionId: versionId, currentAcceptedVersionId: null, deletedAt: null, createdAt: now, updatedAt: now }, { session });
        await versions.insertOne({ id: versionId, projectId: id, userId, mode: input.mode, versionNumber: 1, parentVersionId: null, templateVersionId: input.templateVersionId ?? null, configuration: input.configuration, productRecipe: input.productRecipe, campaignRecipe: input.campaignRecipe, changeReason: "Guest draft claimed after authentication", createdAt: now }, { session });
        return id;
      });
      const project = await loadProject(userId, projectId); if (!project) throw new Error("claimed_project_not_found"); return project;
    },
    async listProjects(userId, filters) {
      const filter: Filter<Document> = { userId };
      if (!filters.includeTrashed) filter.deletedAt = null;
      if (filters.status) filter.status = filters.status;
      if (filters.search) filter.title = { $regex: filters.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };
      const rows = await projects.find(filter).sort({ updatedAt: -1 }).toArray();
      return (await Promise.all(rows.map((row) => loadProject(userId, String(row.id))))).filter((row): row is CreatorProjectRecord => Boolean(row));
    },
    findOwnedProject: loadProject,
    async duplicateProject(userId, projectId, idempotencyKey) {
      const original = await loadProject(userId, projectId);
      if (!original?.currentVersion || original.deletedAt) throw new CreatorRepositoryError("project_not_found");
      return repository.claimDraft(userId, { draftId: deterministicUuid("movprompt-project-duplicate-v1", userId, projectId, idempotencyKey), title: `${original.title} copy`, mode: original.mode, ...(original.currentVersion.templateVersionId ? { templateVersionId: original.currentVersion.templateVersionId } : {}), configuration: { ...original.currentVersion.configuration, duplicateOfProjectId: projectId, duplicateOperationKey: idempotencyKey }, productRecipe: original.currentVersion.productRecipe, campaignRecipe: original.currentVersion.campaignRecipe });
    },
    async trashProject(userId, projectId) {
      return database.transaction(async (session) => {
        const project = await projects.findOne({ id: projectId, userId }, { session });
        if (!project) throw new CreatorRepositoryError("project_not_found");
        const protection = await deletionProtection(project, session);
        if (protection.hasGeneratedVideo) throw new CreatorRepositoryError("project_has_generated_video");
        if (protection.hasActiveGeneration) throw new CreatorRepositoryError("project_generation_in_progress");
        if (!project.deletedAt) {
          // Generation also writes this document in a transaction, serializing delete/submit races.
          const now = new Date();
          await projects.updateOne({ id: projectId, userId, deletedAt: null }, { $set: { status: "trashed", deletedAt: now, updatedAt: now } }, { session });
        }
        return (await loadProject(userId, projectId, session))!;
      });
    },
    async restoreProject(userId, projectId) {
      const result = await projects.updateOne({ id: projectId, userId, deletedAt: { $ne: null }, mediaCleanupState: { $nin: ["deleting", "deleted"] } }, { $set: { status: "draft", deletedAt: null, updatedAt: new Date() } });
      const project = await loadProject(userId, projectId); if (!result.matchedCount) throw new CreatorRepositoryError("project_not_found"); return project!;
    },
    async createVersion(userId, projectId, input, idempotencyKey) {
      assertPersistable(input); await ensureTemplate(input.templateVersionId);
      const id = await database.transaction(async (session) => {
        const project = await projects.findOne({ id: projectId, userId, deletedAt: null }, { session }); if (!project) throw new CreatorRepositoryError("project_not_found");
        const existing = await versions.findOne({ userId, projectId, operationKey: idempotencyKey }, { session });
        const requested = canonicalizeGenerationConfiguration({ parentVersionId: input.parentVersionId ?? null, templateVersionId: input.templateVersionId ?? null, mode: input.mode, configuration: input.configuration, productRecipe: input.productRecipe, campaignRecipe: input.campaignRecipe, changeReason: input.changeReason ?? null });
        if (existing) {
          const persisted = canonicalizeGenerationConfiguration({ parentVersionId: existing.parentVersionId ?? null, templateVersionId: existing.templateVersionId ?? null, mode: existing.mode, configuration: existing.configuration, productRecipe: existing.productRecipe, campaignRecipe: existing.campaignRecipe, changeReason: existing.changeReason ?? null });
          if (requested !== persisted) throw new CreatorRepositoryError("idempotency_conflict"); return String(existing.id);
        }
        if (input.parentVersionId && !(await versions.findOne({ id: input.parentVersionId, projectId, userId }, { session }))) throw new CreatorRepositoryError("parent_version_not_found");
        const last = await versions.findOne({ projectId, userId }, { session, sort: { versionNumber: -1 } }); const now = new Date(); const versionId = newMongoObjectId();
        await versions.insertOne({ id: versionId, projectId, userId, mode: input.mode, versionNumber: Number(last?.versionNumber ?? 0) + 1, parentVersionId: input.parentVersionId ?? null, templateVersionId: input.templateVersionId ?? null, configuration: input.configuration, productRecipe: input.productRecipe, campaignRecipe: input.campaignRecipe, changeReason: input.changeReason ?? null, operationKey: idempotencyKey, createdAt: now }, { session });
        await projects.updateOne({ id: projectId, userId }, { $set: { mode: input.mode, status: "ready", currentWorkingVersionId: versionId, updatedAt: now } }, { session }); return versionId;
      });
      return versionPublic((await versions.findOne({ id, projectId, userId }))!);
    },
    async replaceSource({ userId, projectId, parentVersionId, idempotencyKey, sourceFingerprint, sourceAssetIds, input }) {
      const uniqueIds = [...new Set(sourceAssetIds)];
      const count = await database.collection(COLLECTIONS.creatorProjectAssets).countDocuments({ id: { $in: uniqueIds }, projectId, userId });
      if (count !== uniqueIds.length) throw new CreatorRepositoryError("project_not_found");
      const version = await repository.createVersion(userId, projectId, { ...input, parentVersionId, changeReason: "Source replaced" }, idempotencyKey);
      if (String((version.configuration as Record<string, unknown>).sourceFingerprint) !== sourceFingerprint) throw new Error("source_fingerprint_persistence_failed");
      return version;
    },
    async listVersions(userId, projectId) {
      const project = await loadProject(userId, projectId); if (!project || project.deletedAt) throw new CreatorRepositoryError("project_not_found");
      return (await versions.find({ projectId, userId }).sort({ versionNumber: -1 }).toArray()).map(versionPublic);
    },
    async acceptVersion(userId, projectId, versionId) {
      const run = await database.collection(COLLECTIONS.renderRuns).findOne({ projectVersionId: versionId, projectId, userId, status: "completed" }); if (!run) throw new CreatorRepositoryError("project_not_found");
      const result = await projects.updateOne({ id: projectId, userId, deletedAt: null }, { $set: { currentWorkingVersionId: versionId, currentAcceptedVersionId: versionId, status: "completed", updatedAt: new Date() } }); if (!result.matchedCount) throw new CreatorRepositoryError("project_not_found"); return (await loadProject(userId, projectId))!;
    },
    async creditSummary(userId) {
      const [account, reservations, entitlement, ledger] = await Promise.all([
        database.collection(COLLECTIONS.creditAccounts).findOne({ userId }),
        database.collection(COLLECTIONS.creditReservations).find({ userId, status: "reserved" }).toArray(),
        database.collection(COLLECTIONS.entitlements).findOne({ userId, type: "starter_template_render", status: "available" }),
        database.collection(COLLECTIONS.creditLedger).find({ userId }).sort({ createdAt: -1 }).limit(50).toArray(),
      ]);
      const balance = Number(account?.balance ?? 0); const reserved = reservations.reduce((sum, row) => sum + Number(row.amount ?? 0), 0);
      return { balance, reserved, available: Math.max(0, balance - reserved), starterRenderAvailable: Boolean(entitlement), ledger: ledger.map((row) => ({ id: String(row.id), kind: row.kind, delta: Number(row.delta), balanceAfter: Number(row.balanceAfter), reason: String(row.reason), referenceType: typeof row.referenceType === "string" ? row.referenceType : null, referenceId: typeof row.referenceId === "string" ? row.referenceId : null, createdAt: (row.createdAt as Date).toISOString() })) as Awaited<ReturnType<CreatorRepository["creditSummary"]>>["ledger"] };
    },
    async findOwnedOutput(userId, projectId, runId) {
      const run = await database.collection(COLLECTIONS.renderRuns).findOne({ id: runId, projectId, userId, status: "completed", outputBucket: { $ne: null }, outputObjectKey: { $ne: null } });
      return run ? { bucket: String(run.outputBucket), objectKey: String(run.outputObjectKey) } : null;
    },
  };
  return repository;
}
