import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import {
  createMongoDatabase,
  ensureMongoIndexes,
  ensureMongoTemplateCatalog,
  mongoTemplateCatalogDocuments,
  newMongoObjectId,
} from "@movprompt/db";
import {
  getCreativeTemplate,
  resolveDurationRecipe,
  defaultManagedTemplateForm,
  CreativeBriefSchema,
  compileTemplatePrompt,
  ENGINE_VERSION,
} from "@movprompt/creative-engine";
import type { GenerationJobPayload } from "@movprompt/contracts";
import { createMongoRenderLifecycleStore } from "./mongo-render-lifecycle-store.js";
const uri = process.env.ADMIN_TEST_MONGODB_URI;
describe.skipIf(!uri)("worker immutable managed-template resolution", () => {
  it("compiles the pinned definition after another version is published without changing facts, display copy or audio", async () => {
    const database = createMongoDatabase({
      uri: uri ?? "mongodb://127.0.0.1:27029/",
      databaseName: `movprompt_worker_template_${Date.now()}`,
    });
    await database.connect();
    try {
      await ensureMongoIndexes(database);
      const definition = structuredClone(
        getCreativeTemplate("premium-phone-reveal"),
      );
      definition.versionNumber = 7;
      definition.directionRuntimeVersion = 1;
      definition.managedForm = defaultManagedTemplateForm(definition);
      definition.visualSystem = "Saved blue studio with an overhead camera";
      await ensureMongoTemplateCatalog(database, [definition]);
      const stored = mongoTemplateCatalogDocuments([definition]).versions[0]!;
      const photos = [
        {
          objectKey: "users/synthetic/product.png",
          mimeType: "image/png",
          referenceRole: "subject" as const,
        },
      ];
      const variant = resolveDurationRecipe({
        id: definition.id,
        durationRecipes: definition.durationRecipes!,
        duration: 8,
        photos,
      });
      const displayCopy = {
        version: 1 as const,
        openingMessage: "",
        offer: "خصم ٢٠٪ حتى الجمعة",
        closingMessage: "",
      };
      const brief = CreativeBriefSchema.parse({
        engineVersion: ENGINE_VERSION,
        templateId: definition.id,
        templateRecipeVersion: 7,
        templatePromptVersion: `${definition.id}-v7`,
        templateVisualSystem: definition.visualSystem,
        durationVariant: variant.id,
        market: "KW",
        language: "ar",
        arabicDialect: "kuwaiti",
        dialectRegister: definition.dialectRegister,
        tone: definition.tone,
        vertical: definition.verticals[0],
        goal: definition.goals[0],
        product: { name: "Confirmed phone", callToAction: "" },
        scenes: variant.scenes,
        qualityPolicy: definition.qualityPolicy,
        displayCopy,
      });
      const payload: GenerationJobPayload = {
        renderRunId: newMongoObjectId(),
        userId: newMongoObjectId(),
        projectId: newMongoObjectId(),
        projectVersionId: newMongoObjectId(),
        quoteId: newMongoObjectId(),
        capability: "video.cinematic",
        idempotencyKey: `template-test:${randomUUID()}`,
        requestId: randomUUID(),
      };
      const configuration = {
        generation: {
          prompt: "Verified campaign",
          durationSeconds: 8,
          aspectRatio: "9:16",
          resolution: "720p",
          audio: false,
          references: photos,
          creativeBrief: brief,
        },
      };
      await database
        .collection("creator_project_versions")
        .insertOne({
          id: payload.projectVersionId,
          userId: payload.userId,
          projectId: payload.projectId,
          templateVersionId: stored.id,
          mode: "template",
          configuration,
        });
      await database
        .collection("render_runs")
        .insertOne({
          id: payload.renderRunId,
          userId: payload.userId,
          projectId: payload.projectId,
          projectVersionId: payload.projectVersionId,
          quoteId: payload.quoteId,
          capabilityAlias: payload.capability,
          idempotencyKey: payload.idempotencyKey,
          status: "processing",
          processingStage: "rendering",
        });
      const before = await database
        .collection("creator_project_versions")
        .findOne({ id: payload.projectVersionId });
      await ensureMongoTemplateCatalog(database, [
        {
          ...definition,
          versionNumber: 8,
          visualSystem: "New red studio, a different version",
        },
      ]);
      const snapshot =
        await createMongoRenderLifecycleStore(database).load(payload);
      expect(snapshot.templateDefinition?.versionNumber).toBe(7);
      expect(snapshot.templateDefinition?.visualSystem).toBe(
        definition.visualSystem,
      );
      const compiled = compileTemplatePrompt({
        templateDefinition: snapshot.templateDefinition!,
        brief: CreativeBriefSchema.parse(
          (snapshot.configuration.generation as Record<string, unknown>)
            .creativeBrief,
        ),
        photos,
        aspectRatio: "9:16",
        audio: false,
      });
      expect(compiled.prompt).toContain(definition.visualSystem);
      expect(compiled.prompt).not.toContain("New red studio");
      expect(compiled.prompt).toContain("MUTED OUTPUT");
      expect(
        (snapshot.configuration.generation as Record<string, unknown>).audio,
      ).toBe(false);
      expect(
        (snapshot.configuration.generation as Record<string, unknown>)
          .creativeBrief,
      ).toMatchObject({ displayCopy, product: brief.product });
      expect(
        await database
          .collection("creator_project_versions")
          .findOne({ id: payload.projectVersionId }),
      ).toEqual(before);
    } finally {
      await database.db.dropDatabase();
      await database.close();
    }
  });
});
