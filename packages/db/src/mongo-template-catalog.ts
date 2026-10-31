import { createHash } from "node:crypto";
import { getVerifiedTemplatePreview, CUSTOM_TEMPLATE_FORM_DEFINITIONS, type CreativeTemplateRecipe } from "@movprompt/creative-engine";
import type { MongoDatabase } from "./mongo-client.js";
import { COLLECTIONS } from "./mongo-client.js";

function stableObjectId(...parts: Array<string | number>): string {
  return createHash("sha256")
    .update(parts.join("\0"))
    .digest("hex")
    .slice(0, 24);
}

export function mongoTemplateCatalogDocuments(catalog: readonly CreativeTemplateRecipe[], now = new Date()) {
  const versions = catalog.map((template) => {
    const id = stableObjectId("movprompt-template-version", template.id, template.versionNumber);
    const preview = getVerifiedTemplatePreview(template.id);
    return {
      id,
      templateId: stableObjectId("movprompt-template", template.id),
      versionNumber: template.versionNumber,
      localizedName: template.localizedName,
      localizedDescription: template.localizedDescription,
      recipe: {
        executableDefinition: template,
        ...(template.id === "product-with-model-ad" ? { customFormId: "product-model-ad-form-v1", customForm: CUSTOM_TEMPLATE_FORM_DEFINITIONS["product-with-model-ad"] } : {}),
        ...(template.id === "ad-studio-brand-ad" ? { customFormId: "ad-studio-brand-ad-form-v1" } : {}),
        ...(template.photoPolicy ? { photoPolicy: template.photoPolicy, supportedDurations: template.supportedDurations, durationRecipes: template.durationRecipes } : {}),
        templatePromptVersion: `${template.id}-v${template.versionNumber}`,
        outcome: template.outcome,
        verticals: template.verticals,
        goals: template.goals,
        requiredInputs: template.requiredInputs,
        presenterModes: template.capabilityPolicy.includes("presenter.ai_ugc") ? ["ai_ugc"] : ["none"],
        starterRenderEligible: template.starterRenderEligible,
        qualityStatus: template.qualityStatus,
        storyArc: template.storyArc,
        tone: template.tone,
        dialectPolicy: {
          arabicDialect: "kuwaiti",
          locale: "ar-KW",
          register: template.dialectRegister,
          crossDialectFallback: false,
        },
        visualSystem: template.visualSystem,
        soundDirection: template.soundDirection,
        capabilityPolicy: template.capabilityPolicy,
        protectedLayers: template.protectedLayers,
        complianceRules: template.complianceRules,
        qualityPolicy: template.qualityPolicy,
        tags: template.tags,
        scenes: template.scenes.map((scene) => ({
          id: scene.id,
          title: scene.title.en,
          purpose: scene.purpose.en,
          duration: scene.duration,
          headline: scene.headline.en,
          direction: scene.direction,
        })),
        sceneRecipe: template.scenes,
      },
      inputSchema: {
        type: "object",
        required: template.requiredInputs,
        properties: Object.fromEntries(template.requiredInputs.map((field) => [field, { type: "string" }])),
      },
      editSchema: {
        deterministic: ["headline", "price", "offer", "cta", "logo", "brand_color", "subtitles", "audio", "scene_order", "timing", "crop"],
        generative: ["visual_direction", "camera", "lighting", "motion", "setting"],
      },
      supportedLanguages: template.supportedLanguages,
      supportedRatios: template.supportedRatios,
      supportedMarkets: template.supportedMarkets,
      durationSeconds: template.durationSeconds,
      ...(preview ? {
        previewDurationSeconds: preview.durationSeconds,
        previewRecipeVersion: preview.recipeVersion,
      } : {}),
      previewObjectKey: preview?.objectKey ?? null,
      posterObjectKey: template.id === "product-with-model-ad" ? (preview ? "templates/v2/product-with-model-ad-car.jpg" : null) : template.id === "ad-studio-brand-ad" ? null : `templates/v${template.photoPolicy ? 1 : template.versionNumber}/${template.id}.${template.id === "jewelry-product-showcase" ? "png" : "jpg"}`,
      publishedAt: now,
      createdAt: now,
      updatedAt: now,
    };
  });
  const versionByTemplate = new Map(versions.map((version, index) => [catalog[index]!.id, version]));
  const templates = catalog.map((template) => ({
    id: stableObjectId("movprompt-template", template.id),
    slug: template.slug,
    category: template.category,
    discoveryCategory: template.discoveryCategory,
    publishingState: "published",
    currentPublishedVersionId: versionByTemplate.get(template.id)!.id,
    createdAt: now,
    updatedAt: now,
  }));
  return { templates, versions };
}

/**
 * adminManaged used to be set by rename and duration edits too, so on its own it
 * cannot tell a frozen head from an owner's choice. Heads changed before
 * publicationPinned existed prove their publish or rollback through the audit log.
 */
async function pinOwnerPublications(database: MongoDatabase, templateIds: string[]): Promise<void> {
  const templates = database.collection(COLLECTIONS.videoTemplates);
  const unpinned = await templates
    .find({ id: { $in: templateIds }, adminManaged: true, publicationPinned: { $exists: false } }, { projection: { id: 1 } })
    .toArray();
  if (!unpinned.length) return;
  const ids = unpinned.map(row => String(row.id));
  const chosen = new Set((await database.db.collection("audit_logs").distinct("target", {
    target: { $in: ids },
    action: { $in: ["template.publish", "template.rollback"] },
    outcome: "succeeded",
  })).map(String));
  // Recording false as well keeps this one audit scan from repeating every startup.
  await templates.bulkWrite(ids.map(id => ({
    updateOne: { filter: { id }, update: { $set: { publicationPinned: chosen.has(id) } }, upsert: false },
  })));
}

export async function ensureMongoTemplateCatalog(
  database: MongoDatabase,
  catalog: readonly CreativeTemplateRecipe[],
  options: { prune?: boolean } = {},
): Promise<void> {
  const documents = mongoTemplateCatalogDocuments(catalog);
  if (!documents.templates.length) return;
  await database.collection(COLLECTIONS.videoTemplateVersions).bulkWrite(
    documents.versions.map((version) => ({
      updateOne: {
        filter: { id: version.id },
        update: { $setOnInsert: version },
        upsert: true,
      },
    })),
  );
  await database.collection(COLLECTIONS.videoTemplates).bulkWrite(
    documents.templates.map((template) => ({
      updateOne: {
        filter: { id: template.id },
        // Baseline imports cannot overwrite an owner's publication or rollback.
        update: { $setOnInsert: { ...template, source: "code-baseline" } },
        upsert: true,
      },
    })),
  );
  await pinOwnerPublications(database, documents.templates.map(template => template.id));
  // Keep the pre-migration customer catalog working for code-managed heads. The
  // version pointer follows code releases until the owner picks a version with
  // publish, rollback or duplicate. Metadata overrides live in their own head
  // fields, so neither update below can overwrite a name, language or duration.
  await database.collection(COLLECTIONS.videoTemplates).bulkWrite(
    documents.templates.flatMap(({ id, createdAt: _createdAt, currentPublishedVersionId, ...template }) => [
      {
        updateOne: {
          filter: { id, publicationPinned: { $ne: true }, currentPublishedVersionId: { $ne: currentPublishedVersionId } },
          update: { $set: { currentPublishedVersionId, updatedAt: template.updatedAt } },
          upsert: false,
        },
      },
      {
        updateOne: {
          filter: { id, adminManaged: { $ne: true } },
          update: { $set: { ...template, source: "code-baseline" } },
          upsert: false,
        },
      },
    ]),
  );
  if (options.prune) {
    // Historical project versions keep pointing at immutable template versions.
    // Removing a recipe from the launch catalog therefore archives its catalog
    // entry while retaining both the entry and every version document.
    await database.collection(COLLECTIONS.videoTemplates).updateMany({
      id: { $nin: documents.templates.map((template) => template.id) },
      source: "code-baseline",
      adminManaged: { $ne: true },
    }, {
      $set: { publishingState: "archived", updatedAt: new Date() },
    });
  }
}
