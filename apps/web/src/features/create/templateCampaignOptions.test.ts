import { withDisplayCopy } from "./displayCopyProject";
import { describe, expect, it } from "vitest";
import { createDraftProject, getCreatorTemplate, projectKeepingContentForTemplate } from "./templates";
import { LAUNCH_PHOTO_POLICIES } from "@movprompt/creative-engine";
import { campaignPurposeChange, supportedCampaignGoal, templateCampaignIssue, templateCampaignOptions } from "./templateCampaignOptions";

describe("template-supported settings", () => {
  it.each(Object.keys(LAUNCH_PHOTO_POLICIES).filter(id => id !== "ad-studio-brand-ad"))("offers only portrait by default for %s", id => {
    const project = createDraftProject(id);
    expect(templateCampaignOptions(getCreatorTemplate(id)).ratios).toEqual(["9:16"]);
    expect(project.aspectRatio).toBe("9:16");
    const wide = { ...project, aspectRatio: "16:9" as const };
    const selected = projectKeepingContentForTemplate(wide, id);
    expect(selected.aspectRatio).toBe("9:16");
    expect(selected.product).toEqual(wide.product);
    expect(wide.aspectRatio).toBe("16:9");
  });
  it("offers every Ad Studio shape and keeps a supported saved shape", () => {
    const project = createDraftProject("ad-studio-brand-ad");
    expect(templateCampaignOptions(getCreatorTemplate("ad-studio-brand-ad")).ratios).toEqual(["9:16", "1:1", "4:5", "16:9"]);
    expect(project.audio).toBe(true);
    expect(projectKeepingContentForTemplate({ ...createDraftProject("perfume-advertisement"), aspectRatio: "16:9" }, "ad-studio-brand-ad").aspectRatio).toBe("16:9");
  });
  it("repairs an unsupported saved purpose instead of blocking the campaign", () => {
    const project = createDraftProject("app-service");
    project.goal = "bookings";
    project.bookingUrl = "https://example.com/book";
    const original = structuredClone(project);
    const options = templateCampaignOptions(getCreatorTemplate(project.templateId));
    expect(options.goals).toEqual(["demonstration", "launch"]);
    expect(options.resolutions).toEqual(["720p", "480p"]);
    expect(templateCampaignIssue(project, options)).toBe("");
    expect(supportedCampaignGoal(project.goal, options)).toBe("demonstration");
    expect(supportedCampaignGoal("launch", options)).toBe("launch");
    expect(project).toEqual(original);
  });

  it("rejects unsupported language, format and quality separately", () => {
    const project = createDraftProject("app-service");
    const options = { goals: project.goal ? [project.goal] : [], languages: ["en" as const], ratios: ["9:16" as const], resolutions: ["480p" as const] };
    expect(templateCampaignIssue({ ...project, language: "ar" }, options)).toContain("language");
    expect(templateCampaignIssue({ ...project, language: "en", aspectRatio: "16:9" }, options)).toContain("format");
    expect(templateCampaignIssue({ ...project, language: "en", aspectRatio: "9:16", resolution: "720p" }, options)).toContain("quality");
  });

  it("keeps display copy optional on purpose changes and retains explicitly entered text", () => {
    const project = createDraftProject("app-service");
    project.goal = "bookings";
    project.cta = "Book now";
    project.bookingUrl = "https://example.com/book";
    expect(campaignPurposeChange(project, "demonstration")).toMatchObject({ goal: "demonstration", cta: "", subtitles: false });
    expect(campaignPurposeChange(withDisplayCopy(project, { closingMessage: "Visit store" }), "launch")).toMatchObject({ goal: "launch", cta: "Visit store" });
    expect(project.bookingUrl).toBe("https://example.com/book");
  });
});
