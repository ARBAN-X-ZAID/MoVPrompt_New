import {
  JsonObjectSchema,
  type ClaimDraftRequest,
  type CreatorProjectRecord,
  type JsonValue,
  type ProjectVersion,
} from "@movprompt/contracts";

import { PortableApiError, portableCreatorApi } from "@/lib/api/portableApiClient";
import type { AdvancedProjectConfiguration } from "./advancedStudioConfig";

type AdvancedProjectApi = Pick<
  typeof portableCreatorApi,
  "claimDraft" | "createVersion" | "getProject" | "getTemplate"
>;

export type PersistAdvancedProjectInput = {
  draftId: string;
  title: string;
  sourceTemplateVersionId?: string;
  configuration: AdvancedProjectConfiguration;
  productRecipe: Record<string, unknown>;
  campaignRecipe: Record<string, unknown>;
  operationId: string;
};

export type PersistedAdvancedProject = {
  project: CreatorProjectRecord;
  version: ProjectVersion;
};

function jsonObject(input: Record<string, unknown>): Record<string, JsonValue> {
  return JsonObjectSchema.parse(JSON.parse(JSON.stringify(input)));
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

async function publishedTemplateVersionId(
  sourceTemplateVersionId: string | undefined,
  api: AdvancedProjectApi,
): Promise<string | undefined> {
  if (!sourceTemplateVersionId) return undefined;
  if (isUuid(sourceTemplateVersionId)) return sourceTemplateVersionId;
  return (await api.getTemplate(sourceTemplateVersionId)).versionId;
}

async function ownedProject(projectId: string, api: AdvancedProjectApi) {
  try {
    return await api.getProject(projectId);
  } catch (error) {
    if (error instanceof PortableApiError && error.status === 404) return null;
    throw error;
  }
}

export async function persistPortableAdvancedProject(
  input: PersistAdvancedProjectInput,
  api: AdvancedProjectApi = portableCreatorApi,
): Promise<PersistedAdvancedProject> {
  const existing = await ownedProject(input.draftId, api);
  const templateVersionId = existing?.currentVersion?.templateVersionId
    ?? await publishedTemplateVersionId(input.sourceTemplateVersionId, api);
  const productRecipe = jsonObject(input.productRecipe);
  const campaignRecipe = jsonObject(input.campaignRecipe);

  if (!existing) {
    const request: ClaimDraftRequest = {
      draftId: input.draftId,
      title: input.title,
      mode: "advanced",
      ...(templateVersionId ? { templateVersionId } : {}),
      configuration: input.configuration,
      productRecipe,
      campaignRecipe,
    };
    const project = await api.claimDraft(request);
    if (!project.currentVersion) {
      throw new Error("The Advanced project was saved without a recoverable version.");
    }
    return { project, version: project.currentVersion };
  }

  const version = await api.createVersion(
    existing.id,
    {
      parentVersionId: existing.currentVersion?.id ?? null,
      ...(templateVersionId ? { templateVersionId } : {}),
      mode: "advanced",
      configuration: input.configuration,
      productRecipe,
      campaignRecipe,
      changeReason: "Advanced direction updated",
    },
    `advanced-version:${input.operationId}`,
  );
  return { project: existing, version };
}
