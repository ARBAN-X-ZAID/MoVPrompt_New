import { describe, expect, it } from "vitest";
import { createDraftProject, getCreatorTemplate } from "./templates";
import { campaignPurposeChange, templateCampaignIssue, templateCampaignOptions } from "./templateCampaignOptions";

describe("template-supported settings", () => {
  it("identifies the actual purpose mismatch while keeping the saved campaign intact", () => {
    const project = createDraftProject("app-service");
    project.goal = "bookings";
    project.bookingUrl = "https://example.com/book";
    const original = structuredClone(project);
    const options = templateCampaignOptions(getCreatorTemplate(project.templateId));
    expect(options.goals).toEqual(["demonstration", "launch"]);
    expect(options.resolutions).toEqual(["720p", "480p"]);
    expect(templateCampaignIssue(project, options)).toContain("campaign purpose");
    expect(project).toEqual(original);
    expect(templateCampaignIssue({ ...project, goal: "demonstration" }, options)).toBe("");
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
