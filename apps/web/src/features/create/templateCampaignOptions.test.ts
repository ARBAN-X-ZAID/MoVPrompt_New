import { describe, expect, it } from "vitest";
import { createDraftProject, getCreatorTemplate, projectKeepingContentForTemplate } from "./templates";
import { LAUNCH_PHOTO_POLICIES } from "@movprompt/creative-engine";
import { campaignPurposeChange, supportedCampaignGoal, templateCampaignIssue, templateCampaignOptions } from "./templateCampaignOptions";

describe("template-supported settings", () => {
  it.each(Object.keys(LAUNCH_PHOTO_POLICIES))("offers only portrait by default for %s", id => {
    const project = createDraftProject(id);
    expect(templateCampaignOptions(getCreatorTemplate(id)).ratios).toEqual(["9:16"]);
    expect(project.aspectRatio).toBe("9:16");
    const wide = { ...project, aspectRatio: "16:9" as const };
    const selected = projectKeepingContentForTemplate(wide, id);
    expect(selected.aspectRatio).toBe("9:16");
    expect(selected.product).toEqual(wide.product);
    expect(wide.aspectRatio).toBe("16:9");
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

  it("changes a default CTA only on explicit purpose selection, retaining contact details and custom CTAs", () => {
    const project = createDraftProject("app-service");
    project.goal = "bookings";
    project.cta = "Book now";
    project.bookingUrl = "https://example.com/book";
    expect(campaignPurposeChange(project, "demonstration")).toEqual({ goal: "demonstration", cta: "Learn more" });
    expect(campaignPurposeChange({ ...project, cta: "Visit store" }, "launch")).toEqual({ goal: "launch" });
    expect(project.bookingUrl).toBe("https://example.com/book");
  });
});
