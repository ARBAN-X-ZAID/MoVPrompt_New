import { DisplayCopySchema, legacyDisplayCopy, type DisplayCopy } from "@movprompt/contracts";
import type { CreatorProject } from "./types";

export function displayCopyForProject(project: CreatorProject): DisplayCopy {
  return project.displayCopy ? DisplayCopySchema.parse(project.displayCopy) : legacyDisplayCopy({ offer: project.offer, cta: project.cta, openingMessage: project.productModelAd?.openingMessage });
}

/** Editing a working draft upgrades display policy without rewriting its accepted output. */
export function withDisplayCopy(project: CreatorProject, patch: Partial<Omit<DisplayCopy, "version">> = {}): CreatorProject {
  const displayCopy = DisplayCopySchema.parse({ ...displayCopyForProject(project), ...patch });
  return { ...project, displayCopy, cta: displayCopy.closingMessage, subtitles: false };
}
