import type {
  BusinessVertical,
  CampaignGoal,
  CampaignLanguage,
  ClaimDraftRequest,
  CreateProjectVersionRequest,
  CreatorProjectRecord,
  ProjectVersion,
  PublicTemplate,
  ReplaceProjectSourceRequest,
} from "@movprompt/contracts";

type TemplateFilters = {
  vertical?: BusinessVertical;
  goal?: CampaignGoal;
  language?: CampaignLanguage;
};

type ProjectFilters = {
  status?: CreatorProjectRecord["status"];
  includeTrashed: boolean;
  search?: string;
};

export class CreatorRepositoryError extends Error {
  constructor(
    readonly code:
      | "project_has_generated_video"
      | "project_generation_in_progress"
      | "project_not_found"
      | "template_not_found"
      | "parent_version_not_found"
      | "idempotency_conflict"
      | "invalid_campaign_configuration",
  ) {
    super(code);
    this.name = "CreatorRepositoryError";
  }
}

export interface CreatorRepository {
  listPublishedTemplates(filters: TemplateFilters): Promise<PublicTemplate[]>;
  findPublishedTemplate(slugOrId: string): Promise<PublicTemplate | null>;
  claimDraft(userId: string, input: ClaimDraftRequest): Promise<CreatorProjectRecord>;
  listProjects(userId: string, filters: ProjectFilters): Promise<CreatorProjectRecord[]>;
  findOwnedProject(userId: string, projectId: string): Promise<CreatorProjectRecord | null>;
  duplicateProject(userId: string, projectId: string, idempotencyKey: string): Promise<CreatorProjectRecord>;
  trashProject(userId: string, projectId: string): Promise<CreatorProjectRecord>;
  restoreProject(userId: string, projectId: string): Promise<CreatorProjectRecord>;
  createVersion(
    userId: string,
    projectId: string,
    input: CreateProjectVersionRequest,
    idempotencyKey: string,
  ): Promise<ProjectVersion>;
  replaceSource(input: {
    userId: string;
    projectId: string;
    parentVersionId: string;
    idempotencyKey: string;
    sourceFingerprint: string;
    sourceAssetIds: string[];
    input: Omit<ReplaceProjectSourceRequest, "source" | "parentVersionId"> & { parentVersionId: string };
  }): Promise<ProjectVersion>;
  listVersions(userId: string, projectId: string): Promise<ProjectVersion[]>;
  acceptVersion(userId: string, projectId: string, versionId: string): Promise<CreatorProjectRecord>;
  creditSummary(userId: string): Promise<{
    balance: number;
    reserved: number;
    available: number;
    starterRenderAvailable: boolean;
    ledger: Array<{
      id: string;
      kind: "purchase" | "grant" | "charge" | "refund" | "adjustment";
      delta: number;
      balanceAfter: number;
      reason: string;
      referenceType: string | null;
      referenceId: string | null;
      createdAt: string;
    }>;
  }>;
  findOwnedOutput(userId: string, projectId: string, runId: string): Promise<{
    bucket: string;
    objectKey: string;
  } | null>;
}
