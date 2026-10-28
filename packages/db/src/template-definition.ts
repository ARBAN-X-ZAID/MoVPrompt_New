import {
  CreativeTemplateRecipeSchema,
  getCreativeTemplateVersion,
  type CreativeTemplateRecipe,
} from "@movprompt/creative-engine";
import type { Document } from "mongodb";

function effectiveDefinition(
  definition: CreativeTemplateRecipe,
): CreativeTemplateRecipe {
  // The original v2 Adstudio row omitted the character group while its runtime
  // validator used the shared subject+character policy. Preserve that historical
  // effective behavior when moving validation into immutable definitions.
  if (
    definition.id === "ad-studio-brand-ad" &&
    definition.versionNumber === 2 &&
    !definition.photoPolicy?.groups.some((group) => group.role === "character")
  )
    return {
      ...definition,
      photoPolicy: {
        version: 1,
        groups: [
          { role: "subject", min: 1, max: 3 },
          { role: "character", min: 0, max: 3 },
        ],
      },
    };
  return definition;
}

/** Resolve only a stored immutable version, never a browser-authored recipe. */
export function resolveStoredTemplateDefinition(
  version: Document,
  familyId: string,
): CreativeTemplateRecipe {
  const recipe = version.recipe ?? {};
  if (recipe.executableDefinition) {
    const definition = CreativeTemplateRecipeSchema.parse(
      recipe.executableDefinition,
    );
    if (definition.id !== familyId)
      throw new Error("template_definition_family_mismatch");
    if (definition.versionNumber !== Number(version.versionNumber))
      throw new Error("template_definition_version_mismatch");
    return effectiveDefinition(definition);
  }
  const baseline = getCreativeTemplateVersion(
    familyId,
    Number(version.versionNumber),
  );
  if (baseline.id !== familyId)
    throw new Error("template_definition_family_unknown");
  return effectiveDefinition(
    CreativeTemplateRecipeSchema.parse({
      ...baseline,
      versionNumber: Number(version.versionNumber),
      localizedName: version.localizedName ?? baseline.localizedName,
      localizedDescription:
        version.localizedDescription ?? baseline.localizedDescription,
      durationSeconds: version.durationSeconds ?? baseline.durationSeconds,
      supportedLanguages:
        version.supportedLanguages ?? baseline.supportedLanguages,
      supportedRatios: version.supportedRatios ?? baseline.supportedRatios,
      supportedMarkets: version.supportedMarkets ?? baseline.supportedMarkets,
      ...Object.fromEntries(
        [
          "outcome",
          "verticals",
          "goals",
          "requiredInputs",
          "starterRenderEligible",
          "qualityStatus",
          "storyArc",
          "tone",
          "visualSystem",
          "soundDirection",
          "capabilityPolicy",
          "protectedLayers",
          "complianceRules",
          "qualityPolicy",
          "tags",
          "photoPolicy",
          "supportedDurations",
          "durationRecipes",
        ]
          .filter((key) => recipe[key] !== undefined)
          .map((key) => [key, recipe[key]]),
      ),
      dialectRegister:
        recipe.dialectPolicy?.register ?? baseline.dialectRegister,
      scenes: recipe.sceneRecipe ?? baseline.scenes,
    }),
  );
}
