import { describe, expect, it } from "vitest";
import { getCreativeTemplate } from "@movprompt/creative-engine";
import { mongoTemplateCatalogDocuments } from "../src/mongo-template-catalog.js";
import { resolveStoredTemplateDefinition } from "../src/template-definition.js";

describe("immutable executable definition resolver", () => {
  it("resolves changed stored directions and rejects family/version drift", () => {
    const original = getCreativeTemplate("premium-phone-reveal");
    const definition = structuredClone(original);
    definition.versionNumber += 10;
    definition.visualSystem =
      "A saved blue studio with a fixed overhead camera";
    const version = mongoTemplateCatalogDocuments([definition]).versions[0]!;
    expect(resolveStoredTemplateDefinition(version, original.id)).toEqual(
      definition,
    );
    expect(
      resolveStoredTemplateDefinition(version, original.id).visualSystem,
    ).not.toEqual(original.visualSystem);
    expect(() =>
      resolveStoredTemplateDefinition(version, "female-product-review"),
    ).toThrow("template_definition_family_mismatch");
    expect(() =>
      resolveStoredTemplateDefinition(
        { ...version, versionNumber: 1 },
        original.id,
      ),
    ).toThrow("template_definition_version_mismatch");
    expect(original.versionNumber).toBe(2);
  });
  it("uses historical persisted scenes rather than replacing them with the current code catalog", () => {
    const original = getCreativeTemplate("premium-phone-reveal");
    const version = mongoTemplateCatalogDocuments([original]).versions[0]!;
    const { executableDefinition: _definition, ...legacy } = version.recipe;
    legacy.sceneRecipe = legacy.sceneRecipe.map((scene, i) =>
      i === 0 ? { ...scene, camera: "Locked historical camera" } : scene,
    );
    expect(
      resolveStoredTemplateDefinition(
        { ...version, recipe: legacy },
        original.id,
      ).scenes[0]!.camera,
    ).toBe("Locked historical camera");
    expect(original.scenes[0]!.camera).not.toBe("Locked historical camera");
  });
});
