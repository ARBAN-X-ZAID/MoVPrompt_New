import type { PublicTemplate } from "@movprompt/contracts";

import { getCreatorTemplate } from "./templates";
import type { CreatorTemplate } from "./types";

export function creatorTemplateFromCatalog(template: PublicTemplate): CreatorTemplate {
  const local = getCreatorTemplate(template.slug || template.id);
  return {
    ...local,
    // Browser recipes and create URLs use slugs. MongoDB IDs are resolved
    // separately when obtaining the immutable version for save/quote/start.
    id: template.slug,
    name: template.name.en,
    nameAr: template.name.ar,
    eyebrow: template.category.replace(/-/g, " "),
    discoveryCategory: template.discoveryCategory,
    description: template.description.en,
    descriptionAr: template.description.ar,
    bestFor: template.outcome,
    duration: template.durationSeconds,
    languages: template.supportedLanguages,
    aspectRatios: template.supportedRatios,
    tags: template.tags,
    verticals: template.verticals,
    goals: template.goals,
    dialectRegister: template.dialectPolicy.register,
    qualityStatus: template.qualityStatus,
    scenes: template.scenes.length
      ? template.scenes.map((scene, index) => ({
          ...(local.scenes.find((item) => item.id === scene.id) ?? local.scenes[index] ?? local.scenes[0]!),
          ...scene,
        }))
      : local.scenes,
  };
}
