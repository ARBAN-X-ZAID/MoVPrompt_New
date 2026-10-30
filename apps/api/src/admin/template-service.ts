import { validateTemplateMedia } from "./template-media.js";
import {
  TemplatePublishInputSchema,
  TemplateRollbackInputSchema,
  TemplateDuplicateInputSchema,
  templateOutputHash,
  templateDefinitionChanges,
} from "./template-publishing.js";
import { createHash } from "node:crypto";
import { ObjectId, type Document } from "mongodb";
import { z } from "zod";
import {
  CreativeTemplateRecipeSchema,
  managedTemplateDefinitionIssues,
  getCreativeTemplate,
  getVerifiedTemplatePreview,
} from "@movprompt/creative-engine";
import {
  COLLECTIONS as C,
  mongoTemplateCatalogDocuments,
  resolveStoredTemplateDefinition,
  type MongoDatabase,
} from "@movprompt/db";
import {
  AdminDurationAvailabilitySchema,
  AdminReasonSchema,
  AdminTemplateMediaSchema,
} from "@movprompt/contracts";
import {
  ADMIN_COLLECTIONS as A,
  adminError,
  adminJson,
  adminObjectId,
  writeAdminAudit,
  type AdminActor,
  type AdminSecurity,
} from "./security.js";

export const TemplateDraftInputSchema = z
  .object({
    expectedRevision: z.number().int().min(0),
    baseVersionId: z.string().regex(/^[a-f0-9]{24}$/i),
    definition: CreativeTemplateRecipeSchema,
    templateMedia: AdminTemplateMediaSchema.optional(),
    publicMediaRightsConfirmed: z.literal(true).optional(),
    reason: AdminReasonSchema,
  })
  .strict();
export const TemplateStateInputSchema = z
  .object({
    expectedRevision: z.number().int().min(0),
    action: z.enum(["unpublish", "archive", "restore-publication"]),
    reason: AdminReasonSchema,
  })
  .strict();
export function createAdminTemplateService(
  database: MongoDatabase,
  security: AdminSecurity,
  environment: Readonly<Record<string, string | undefined>> = {},
) {
  const db = database.db;
  async function load(id: string) {
    const head = await db
      .collection(C.videoTemplates)
      .findOne({ _id: adminObjectId(id) });
    if (!head)
      return adminError("template_not_found", "Template not found.", 404);
    const versions = await db
      .collection(C.videoTemplateVersions)
      .find(
        { templateId: head._id },
        {
          projection: {
            versionNumber: 1,
            localizedName: 1,
            publishedAt: 1,
            createdAt: 1,
          },
        },
      )
      .sort({ versionNumber: -1 })
      .limit(100)
      .toArray();
    const active = await db.collection(C.videoTemplateVersions).findOne({
      _id: adminObjectId(String(head.currentPublishedVersionId)),
      templateId: head._id,
    });
    if (!active)
      return adminError(
        "template_version_not_found",
        "The template version is missing.",
        404,
      );
    const definition = resolveStoredTemplateDefinition(
      active,
      String(active.recipe?.familyId ?? head.slug),
    );
    const draft = await db
      .collection(A.templateDrafts)
      .findOne({ templateId: head._id });
    return adminJson({
      head,
      activeVersionId: active._id,
      definition,
      templateMedia: active.templateMedia ?? {
        productSamples: [],
        presenterSamples: [],
      },
      draft:
        draft?.status === "published"
          ? { ...draft, definition, baseVersionId: active._id }
          : draft?.definition
            ? {
                ...draft,
                definition: resolveStoredTemplateDefinition(
                  {
                    versionNumber: draft.definition.versionNumber,
                    recipe: { executableDefinition: draft.definition },
                  },
                  definition.id,
                ),
              }
            : draft,
      versions,
      publishing: {
        runtimeMigrationReady:
          environment.ADMIN_TEMPLATE_PUBLISHING_ENABLED === "true",
        reason:
          "Publishing requires the managed-template rollout flag and matching output evidence. Existing drafts remain pinned.",
      },
    });
  }
  function validate(
    definition: z.infer<typeof CreativeTemplateRecipeSchema>,
    baseline: z.infer<typeof CreativeTemplateRecipeSchema>,
  ) {
    const issues: string[] = managedTemplateDefinitionIssues(definition);
    if (definition.versionNumber !== baseline.versionNumber)
      issues.push("draft_version_number_is_fixed");
    if (baseline.versionNumber < getCreativeTemplate(baseline.id).versionNumber)
      issues.push("legacy_behavior_upgrade_requires_review");
    if (
      !definition.supportedLanguages.every((language) =>
        baseline.supportedLanguages.includes(language),
      ) ||
      !definition.supportedRatios.every((ratio) =>
        baseline.supportedRatios.includes(ratio),
      )
    )
      issues.push("unsupported_family_options");
    if (
      definition.photoPolicy?.groups.some((group) => {
        const supported = baseline.photoPolicy?.groups.find(
          (item) => item.role === group.role,
        );
        return (
          !supported || group.max > supported.max || group.min < supported.min
        );
      })
    )
      issues.push("unsupported_photo_policy");
    if (
      baseline.photoPolicy?.groups.some(
        (group) =>
          !definition.photoPolicy?.groups.some(
            (item) => item.role === group.role,
          ),
      )
    )
      issues.push("required_photo_role_removed");
    if (
      JSON.stringify(definition.requiredInputs) !==
      JSON.stringify(baseline.requiredInputs)
    )
      issues.push("family_required_inputs_are_fixed");
    if (definition.id !== baseline.id || definition.slug !== baseline.slug)
      issues.push("template_family_identity_is_fixed");
    if (
      definition.supportedLanguages.includes("bilingual") &&
      !baseline.supportedLanguages.includes("bilingual")
    )
      issues.push("unsupported_language_policy");
    if (
      JSON.stringify(definition.qualityPolicy) !==
      JSON.stringify(baseline.qualityPolicy)
    )
      issues.push("quality_policy_cannot_be_weakened_in_editor");
    if (
      JSON.stringify(definition.protectedLayers) !==
        JSON.stringify(baseline.protectedLayers) ||
      JSON.stringify(definition.complianceRules) !==
        JSON.stringify(baseline.complianceRules)
    )
      issues.push("protected_safety_rules_are_fixed");
    if (
      definition.capabilityPolicy.some(
        (capability) => !baseline.capabilityPolicy.includes(capability),
      )
    )
      issues.push("unsupported_capability");
    if (definition.verticals.includes("clinic"))
      issues.push("documented_external_clinic_review_required");
    if (
      definition.scenes.reduce((sum, scene) => sum + scene.duration, 0) !==
      definition.durationSeconds
    )
      issues.push("scene_durations_do_not_match_total");
    if (
      definition.supportedDurations &&
      !definition.supportedDurations.includes(
        definition.durationSeconds as 8 | 15 | 20,
      )
    )
      issues.push("default_duration_is_not_supported");
    for (const duration of definition.supportedDurations ?? []) {
      const scenes = definition.durationRecipes?.[String(duration)]?.scenes;
      if (
        !scenes ||
        scenes.reduce((sum, scene) => sum + scene.duration, 0) !== duration
      )
        issues.push(`duration_variant_${duration}_invalid`);
    }
    return {
      passed: issues.length === 0,
      issues,
      definitionHash: createHash("sha256")
        .update(JSON.stringify(definition))
        .digest("hex"),
      checks: [
        "schema",
        "family",
        "capabilities",
        "quality-policy",
        "protected-rules",
        "timing",
      ],
    };
  }
  async function save(
    actor: AdminActor,
    id: string,
    key: string,
    input: z.infer<typeof TemplateDraftInputSchema>,
  ) {
    return security.command(actor, key, { id, ...input }, async (session) => {
      const templateId = adminObjectId(id);
      const baseVersionId = adminObjectId(input.baseVersionId);
      const head = await db
        .collection(C.videoTemplates)
        .findOne({ _id: templateId }, { session });
      const version = await db
        .collection(C.videoTemplateVersions)
        .findOne({ _id: baseVersionId, templateId }, { session });
      if (!head || !version)
        return adminError(
          "template_version_not_found",
          "Template version not found.",
          404,
        );
      const previous = await db
        .collection(A.templateDrafts)
        .findOne({ templateId }, { session });
      if ((previous?.revision ?? 0) !== input.expectedRevision)
        return adminError(
          "template_draft_changed",
          "Reload the template draft before saving.",
        );
      const baseline = CreativeTemplateRecipeSchema.parse(
        resolveStoredTemplateDefinition(
          version,
          String(version.recipe?.familyId ?? head.slug),
        ),
      );
      const directionChanged = [
        "visualSystem",
        "soundDirection",
        "scenes",
        "durationRecipes",
      ].some(
        (key) =>
          JSON.stringify(
            input.definition[key as keyof typeof input.definition],
          ) !== JSON.stringify(baseline[key as keyof typeof baseline]),
      );
      const savedDefinition = directionChanged
        ? { ...input.definition, directionRuntimeVersion: 1 as const }
        : input.definition;
      const validation = validate(savedDefinition, baseline);
      const templateMedia = await validateTemplateMedia(
        database,
        input.templateMedia ?? version.templateMedia,
        session,
      );
      if (
        templateMedia.productSamples.length >
          (baseline.photoPolicy?.groups.find(
            (group) => group.role === "subject",
          )?.max ?? 3) ||
        templateMedia.presenterSamples.length >
          (baseline.photoPolicy?.groups.find(
            (group) => group.role === "character",
          )?.max ?? 0)
      )
        return adminError(
          "template_sample_limit",
          "Samples must match this family's product/presenter roles and limits.",
        );
      if (
        JSON.stringify(templateMedia) !==
          JSON.stringify(
            AdminTemplateMediaSchema.parse(version.templateMedia ?? {}),
          ) &&
        (templateMedia.poster ||
          templateMedia.preview ||
          templateMedia.productSamples.length ||
          templateMedia.presenterSamples.length) &&
        !input.publicMediaRightsConfirmed
      )
        return adminError(
          "template_public_media_review_required",
          "Confirm public-template rights for these company-media revisions.",
        );
      const now = new Date();
      const draft = {
        templateId,
        baseVersionId,
        definition: savedDefinition,
        templateMedia,
        publicMediaReview: input.publicMediaRightsConfirmed
          ? { actorId: adminObjectId(actor.userId), reviewedAt: now }
          : (previous?.publicMediaReview ?? null),
        validation,
        revision: input.expectedRevision + 1,
        status: "draft",
        updatedAt: now,
      };
      await db
        .collection(A.templateDrafts)
        .updateOne({ templateId }, { $set: draft }, { upsert: true, session });
      await db
        .collection("admin_template_draft_revisions")
        .insertOne(
          { ...draft, createdAt: now, ownerId: adminObjectId(actor.userId) },
          { session },
        );
      await writeAdminAudit(
        database,
        actor,
        "template.draft-save",
        id,
        { reason: input.reason, revision: draft.revision, validation },
        session,
      );
      return adminJson(draft);
    });
  }
  async function changeState(
    actor: AdminActor,
    id: string,
    key: string,
    input: z.infer<typeof TemplateStateInputSchema>,
  ) {
    return security.command(actor, key, { id, ...input }, async (session) => {
      const row = await db
        .collection(C.videoTemplates)
        .findOne({ _id: adminObjectId(id) }, { session });
      if (!row || (row.revision ?? 0) !== input.expectedRevision)
        return adminError(
          "template_publication_changed",
          "Reload the template before changing publication.",
        );
      if (input.action === "restore-publication") {
        const published = await db.collection(C.videoTemplateVersions).findOne(
          {
            _id: adminObjectId(String(row.currentPublishedVersionId)),
            templateId: row._id,
          },
          { session },
        );
        if (!published)
          return adminError(
            "template_version_not_found",
            "Published version is missing.",
          );
        await validateTemplateMedia(database, published.templateMedia, session);
      }
      const publishingState =
        input.action === "archive"
          ? "archived"
          : input.action === "unpublish"
            ? "unpublished"
            : "published";
      await db.collection(C.videoTemplates).updateOne(
        { _id: row._id },
        {
          $set: {
            publishingState,
            adminManaged: true,
            updatedAt: new Date(),
          },
          $inc: { revision: 1 },
        },
        { session },
      );
      await writeAdminAudit(
        database,
        actor,
        `template.${input.action}`,
        id,
        {
          reason: input.reason,
          previousState: row.publishingState,
          publishingState,
        },
        session,
      );
      return { id, publishingState, revision: input.expectedRevision + 1 };
    });
  }

  async function availability(actor: AdminActor, id: string, key: string, input: z.infer<typeof AdminDurationAvailabilitySchema>) {
    return security.command(actor, key, { id, ...input }, async (session) => {
      const row = await db.collection(C.videoTemplates).findOne({ _id: adminObjectId(id) }, { session });
      if (!row || (row.revision ?? 0) !== input.expectedRevision) return adminError("template_publication_changed", "Reload the template before changing availability.");
      const version = await db.collection(C.videoTemplateVersions).findOne({ _id: adminObjectId(String(row.currentPublishedVersionId)), templateId: row._id }, { session });
      if (!version) return adminError("template_version_not_found", "Template version missing.");
      const definition = resolveStoredTemplateDefinition(version, String(version.recipe?.familyId ?? row.slug));
      const supported = definition.supportedDurations ?? [definition.durationSeconds];
      if (new Set(input.enabledDurations).size !== input.enabledDurations.length || input.enabledDurations.some(value => !supported.includes(value as 8 | 15 | 20))) return adminError("unsupported_template_duration", "Select existing supported lengths only.", 400);
      await db.collection(C.videoTemplates).updateOne({ _id: row._id }, { $set: { enabledDurations: [...input.enabledDurations].sort((a,b) => a-b), adminManaged: true, updatedAt: new Date() }, $inc: { revision: 1 } }, { session });
      await writeAdminAudit(database, actor, "template.duration-availability", id, { before: row.enabledDurations ?? supported, after: input.enabledDurations }, session);
      return { id, revision: input.expectedRevision + 1, enabledDurations: input.enabledDurations };
    });
  }

  async function publish(
    actor: AdminActor,
    id: string,
    key: string,
    input: z.infer<typeof TemplatePublishInputSchema>,
  ) {
    if (environment.ADMIN_TEMPLATE_PUBLISHING_ENABLED !== "true")
      return adminError(
        "template_publishing_disabled",
        "Managed-template rollout has not been enabled.",
      );
    return security.command(actor, key, { id, ...input }, async (session) => {
      const templateId = adminObjectId(id);
      const head = await db
        .collection(C.videoTemplates)
        .findOne({ _id: templateId }, { session });
      const draft = await db
        .collection(A.templateDrafts)
        .findOne(
          { templateId, revision: input.draftRevision, status: "draft" },
          { session },
        );
      if (!head || !draft || (head.revision ?? 0) !== input.expectedRevision)
        return adminError(
          "template_publication_changed",
          "Reload the draft and publication before publishing.",
        );
      const base = await db
        .collection(C.videoTemplateVersions)
        .findOne({ _id: draft.baseVersionId, templateId }, { session });
      if (!base || String(head.currentPublishedVersionId) !== String(base._id))
        return adminError(
          "template_base_changed",
          "The publication changed after this draft was started. Review its changes against the current publication.",
        );
      const baseline = resolveStoredTemplateDefinition(
        base,
        String(base.recipe?.familyId ?? head.slug),
      );
      const definition = CreativeTemplateRecipeSchema.parse(draft.definition);
      const validation = validate(definition, baseline);
      if (!validation.passed)
        return adminError(
          "template_validation_failed",
          validation.issues.join(", "),
        );
      const hash = templateOutputHash(definition);
      const templateMedia = await validateTemplateMedia(
        database,
        draft.templateMedia ?? base.templateMedia,
        session,
        hash,
      );
      const inherited =
        hash === templateOutputHash(baseline) &&
        (Boolean(
          base.previewObjectKey && getVerifiedTemplatePreview(baseline.id),
        ) ||
          base.outputEvidence?.outputHash === hash);
      const evidence = await db
        .collection("admin_template_quality_evidence")
        .findOne(
          {
            templateId,
            outputHash: hash,
            status: "passed",
            businessFunded: true,
          },
          { session },
        );
      if (!inherited && evidence && !templateMedia.preview)
        return adminError(
          "template_preview_binding_required",
          "Approve and bind this business preview before publishing the changed video recipe.",
        );
      if (!inherited && !evidence)
        return adminError(
          "template_output_evidence_required",
          "This video-affecting change needs a matching business-funded preview and passing quality review. No customer credits will be used.",
        );
      const latest = await db
        .collection(C.videoTemplateVersions)
        .find({ templateId }, { session })
        .sort({ versionNumber: -1 })
        .limit(1)
        .next();
      const nextDefinition = CreativeTemplateRecipeSchema.parse({
        ...definition,
        versionNumber:
          Number(latest?.versionNumber ?? baseline.versionNumber) + 1,
      });
      const document = mongoTemplateCatalogDocuments([nextDefinition])
        .versions[0]!;
      const versionId = new ObjectId();
      const now = new Date();
      const { id: _id, templateId: _templateId, ...fields } = document;
      await db.collection(C.videoTemplateVersions).insertOne(
        {
          ...fields,
          _id: versionId,
          templateId,
          recipe: { ...document.recipe, familyId: definition.id },
          templateMedia,
          previewObjectKey: inherited
            ? base.previewObjectKey
            : evidence!.previewObjectKey,
          posterObjectKey: inherited
            ? base.posterObjectKey
            : evidence!.posterObjectKey,
          outputEvidence: {
            outputHash: hash,
            sourceVersionId: base._id,
            ...(evidence ? { evidenceId: evidence._id } : {}),
            inherited,
          },
          publishedAt: now,
          createdAt: now,
        },
        { session },
      );
      await db.collection(C.videoTemplates).updateOne(
        { _id: templateId },
        {
          $set: {
            publishingState: "published",
            currentPublishedVersionId: String(versionId),
            category: definition.category,
            discoveryCategory: definition.discoveryCategory,
            adminManaged: true,
            updatedAt: now,
          },
          $inc: { revision: 1 },
        },
        { session },
      );
      await db.collection(A.templateDrafts).updateOne(
        { _id: draft._id },
        {
          $set: {
            status: "published",
            publishedVersionId: versionId,
            updatedAt: now,
          },
        },
        { session },
      );
      await writeAdminAudit(
        database,
        actor,
        "template.publish",
        id,
        {
          reason: input.reason,
          previousVersionId: String(base._id),
          versionId: String(versionId),
          outputHash: hash,
          changes: templateDefinitionChanges(baseline, definition),
        },
        session,
      );
      return {
        id,
        versionId: String(versionId),
        versionNumber: nextDefinition.versionNumber,
        revision: input.expectedRevision + 1,
      };
    });
  }
  async function rollback(
    actor: AdminActor,
    id: string,
    key: string,
    input: z.infer<typeof TemplateRollbackInputSchema>,
  ) {
    return security.command(actor, key, { id, ...input }, async (session) => {
      const templateId = adminObjectId(id);
      const head = await db
        .collection(C.videoTemplates)
        .findOne({ _id: templateId }, { session });
      const version = await db.collection(C.videoTemplateVersions).findOne(
        {
          _id: adminObjectId(input.versionId),
          templateId,
          publishedAt: { $ne: null },
        },
        { session },
      );
      if (!head || !version || (head.revision ?? 0) !== input.expectedRevision)
        return adminError(
          "template_publication_changed",
          "Reload the template and choose a previously published version.",
        );
      await validateTemplateMedia(database, version.templateMedia, session);
      const restoredDefinition = resolveStoredTemplateDefinition(
        version,
        String(version.recipe?.familyId ?? head.slug),
      );
      await db.collection(C.videoTemplates).updateOne(
        { _id: templateId },
        {
          $set: {
            publishingState: "published",
            currentPublishedVersionId: input.versionId,
            category: restoredDefinition.category,
            discoveryCategory: restoredDefinition.discoveryCategory,
            adminManaged: true,
            updatedAt: new Date(),
          },
          $inc: { revision: 1 },
        },
        { session },
      );
      await writeAdminAudit(
        database,
        actor,
        "template.rollback",
        id,
        {
          reason: input.reason,
          previousVersionId: String(head.currentPublishedVersionId),
          versionId: input.versionId,
        },
        session,
      );
      return {
        id,
        versionId: input.versionId,
        revision: input.expectedRevision + 1,
      };
    });
  }
  async function duplicate(
    actor: AdminActor,
    sourceId: string,
    key: string,
    input: z.infer<typeof TemplateDuplicateInputSchema>,
  ) {
    return security.command(
      actor,
      key,
      { sourceId, ...input },
      async (session) => {
        const source = await db
          .collection(C.videoTemplates)
          .findOne({ _id: adminObjectId(sourceId) }, { session });
        const base = source
          ? await db.collection(C.videoTemplateVersions).findOne(
              {
                _id: adminObjectId(String(source.currentPublishedVersionId)),
                templateId: source._id,
              },
              { session },
            )
          : null;
        if (!source || !base)
          return adminError(
            "template_version_not_found",
            "Choose an existing supported template family.",
            404,
          );
        if (
          await db
            .collection(C.videoTemplates)
            .findOne({ slug: input.slug }, { session })
        )
          return adminError(
            "template_slug_in_use",
            "Choose another template address.",
          );
        const definition = resolveStoredTemplateDefinition(
          base,
          String(base.recipe?.familyId ?? source.slug),
        );
        const templateId = new ObjectId();
        const versionId = new ObjectId();
        const now = new Date();
        const { _id: _sourceVersion, ...version } = base;
        await db.collection(C.videoTemplateVersions).insertOne(
          {
            ...version,
            _id: versionId,
            templateId,
            localizedName: input.name,
            recipe: {
              ...base.recipe,
              familyId: definition.id,
              executableDefinition: {
                ...definition,
                localizedName: input.name,
              },
            },
            publishedAt: null,
            createdAt: now,
            updatedAt: now,
          },
          { session },
        );
        await db.collection(C.videoTemplates).insertOne(
          {
            _id: templateId,
            slug: input.slug,
            category: definition.category,
            discoveryCategory: definition.discoveryCategory,
            publishingState: "unpublished",
            currentPublishedVersionId: String(versionId),
            adminManaged: true,
            source: "owner",
            revision: 0,
            createdAt: now,
            updatedAt: now,
          },
          { session },
        );
        await writeAdminAudit(
          database,
          actor,
          "template.duplicate",
          String(templateId),
          { reason: input.reason, sourceId, familyId: definition.id },
          session,
        );
        return {
          id: String(templateId),
          versionId: String(versionId),
          revision: 0,
        };
      },
    );
  }
  async function compare(id: string, versionId: string) {
    const templateId = adminObjectId(id);
    const head = await db
      .collection(C.videoTemplates)
      .findOne({ _id: templateId });
    const version = await db
      .collection(C.videoTemplateVersions)
      .findOne({ _id: adminObjectId(versionId), templateId });
    const draft = await db.collection(A.templateDrafts).findOne({ templateId });
    if (!head || !version || !draft)
      return adminError(
        "template_version_not_found",
        "A saved draft and comparison version are required.",
        404,
      );
    const before = resolveStoredTemplateDefinition(
      version,
      String(version.recipe?.familyId ?? head.slug),
    );
    const after = CreativeTemplateRecipeSchema.parse(draft.definition);
    return adminJson({
      before,
      after,
      changes: templateDefinitionChanges(before, after),
      outputChanged: templateOutputHash(before) !== templateOutputHash(after),
    });
  }
  return {
    load,
    save,
    changeState,
    availability,
    validate,
    publish,
    rollback,
    duplicate,
    compare,
  };
}
