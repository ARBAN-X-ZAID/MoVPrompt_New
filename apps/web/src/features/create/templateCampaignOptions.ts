import { displayCopyForProject } from "./displayCopyProject";
import {
  AD_STUDIO_BRAND_AD_ID,
  AD_STUDIO_BRAND_AD_RATIOS,
  CampaignResolutionSchema,
  type CampaignGoal,
  type PublicTemplate,
} from "@movprompt/contracts";
import { LAUNCH_PHOTO_POLICIES } from "@movprompt/creative-engine";
import {
  type CreatorLanguage,
  type CreatorAspectRatio,
  type CreatorResolution,
  type CreatorProject,
  type CreatorTemplate,
} from "./types";

export type TemplateCampaignOptions = {
  goals: readonly CampaignGoal[];
  languages: readonly CreatorLanguage[];
  ratios: readonly CreatorAspectRatio[];
  resolutions: readonly CreatorResolution[];
};

export function templateCampaignOptions(
  template: CreatorTemplate | PublicTemplate,
): TemplateCampaignOptions {
  const rawDefinition =
    "definition" in template
      ? template.definition
      : "executableDefinition" in template
        ? template.executableDefinition
        : undefined;
  const definition =
    rawDefinition &&
    typeof rawDefinition === "object" &&
    !Array.isArray(rawDefinition)
      ? rawDefinition
      : undefined;
  const resolutions =
    definition && Array.isArray(definition.supportedResolutions)
      ? definition.supportedResolutions.flatMap((value) => {
          const parsed = CampaignResolutionSchema.safeParse(value);
          return parsed.success ? [parsed.data] : [];
        })
      : [...CampaignResolutionSchema.options].reverse();
  return {
    goals: template.goals,
    languages:
      "supportedLanguages" in template
        ? template.supportedLanguages
        : template.languages,
    // Current launch templates use portrait output. Historical catalog versions
    // and Advanced formats remain intact; this is the guided creator policy.
    ratios:
      ("definition" in template
        ? template.definition?.supportedRatios
        : undefined) ??
      (("slug" in template ? template.slug : template.id) ===
      AD_STUDIO_BRAND_AD_ID
        ? AD_STUDIO_BRAND_AD_RATIOS
        : LAUNCH_PHOTO_POLICIES[
              "slug" in template ? template.slug : template.id
            ]
          ? ["9:16"]
          : "supportedRatios" in template
            ? template.supportedRatios
            : template.aspectRatios),
    // All current recipes use this shared API resolution contract. Do not
    // advertise unsupported provider qualities or expose provider model IDs.
    resolutions,
  };
}

/**
 * The purpose is no longer chosen by the buyer, so a saved value the template
 * does not support is repaired from the template instead of blocking.
 */
export function supportedCampaignGoal(
  goal: CampaignGoal,
  options: TemplateCampaignOptions,
): CampaignGoal {
  return options.goals.includes(goal) ? goal : (options.goals[0] ?? goal);
}

const OFFERED_LANGUAGES = ["en", "ar"] as const;
export type OfferedLanguage = (typeof OFFERED_LANGUAGES)[number];

/** Bilingual left the product, so buyers only ever pick from these. */
export function offeredCampaignLanguages(
  languages: readonly CreatorLanguage[],
): OfferedLanguage[] {
  return OFFERED_LANGUAGES.filter((language) => languages.includes(language));
}

/**
 * A language the owner turned off is repaired instead of blocking, because most
 * screens have no language picker for the buyer to fix it with.
 */
export function supportedCampaignLanguage(
  language: CreatorLanguage,
  options: Pick<TemplateCampaignOptions, "languages">,
): CreatorLanguage {
  if (options.languages.includes(language)) return language;
  return offeredCampaignLanguages(options.languages)[0] ?? options.languages[0] ?? language;
}

export function templateCampaignIssue(
  project: CreatorProject,
  options: TemplateCampaignOptions,
  arabic = false,
): string {
  if (!options.languages.includes(project.language))
    return arabic
      ? "اختر لغة يدعمها القالب المحدد."
      : "Choose a language supported by this template.";
  if (!options.ratios.includes(project.aspectRatio))
    return arabic
      ? "اختر مقاس فيديو يدعمه القالب المحدد."
      : "Choose a video format supported by this template.";
  if (!options.resolutions.includes(project.resolution))
    return arabic
      ? "اختر جودة فيديو يدعمها القالب المحدد."
      : "Choose a video quality supported by this template.";
  return "";
}

export function campaignPurposeChange(
  project: CreatorProject,
  goal: CampaignGoal,
): Partial<CreatorProject> {
  return {
    goal,
    displayCopy: displayCopyForProject(project),
    cta: displayCopyForProject(project).closingMessage,
    subtitles: false,
  };
}
