import { CampaignResolutionSchema, type CampaignGoal, type PublicTemplate } from "@movprompt/contracts";
import { getCampaignGoalOption, type CreatorLanguage, type CreatorAspectRatio, type CreatorResolution, type CreatorProject, type CreatorTemplate } from "./types";

export type TemplateCampaignOptions = {
  goals: readonly CampaignGoal[];
  languages: readonly CreatorLanguage[];
  ratios: readonly CreatorAspectRatio[];
  resolutions: readonly CreatorResolution[];
};

export function templateCampaignOptions(template: CreatorTemplate | PublicTemplate): TemplateCampaignOptions {
  return {
    goals: template.goals,
    languages: "supportedLanguages" in template ? template.supportedLanguages : template.languages,
    ratios: "supportedRatios" in template ? template.supportedRatios : template.aspectRatios,
    // All current recipes use this shared API resolution contract. Do not
    // advertise unsupported provider qualities or expose provider model IDs.
    resolutions: [...CampaignResolutionSchema.options].reverse(),
  };
}

export function templateCampaignIssue(project: CreatorProject, options: TemplateCampaignOptions, arabic = false): string {
  if (!options.goals.includes(project.goal)) return arabic ? "اختر هدف حملة يدعمه القالب المحدد. معلوماتك وصورتك محفوظة." : "Choose a campaign purpose supported by this template. Your image and details are saved.";
  if (!options.languages.includes(project.language)) return arabic ? "اختر لغة يدعمها القالب المحدد." : "Choose a language supported by this template.";
  if (!options.ratios.includes(project.aspectRatio)) return arabic ? "اختر مقاس فيديو يدعمه القالب المحدد." : "Choose a video format supported by this template.";
  if (!options.resolutions.includes(project.resolution)) return arabic ? "اختر جودة فيديو يدعمها القالب المحدد." : "Choose a video quality supported by this template.";
  return "";
}

export function campaignPurposeChange(project: CreatorProject, goal: CampaignGoal): Partial<CreatorProject> {
  return {
    goal,
    ...(project.cta === getCampaignGoalOption(project.goal).defaultCta ? { cta: getCampaignGoalOption(goal).defaultCta } : {}),
  };
}
