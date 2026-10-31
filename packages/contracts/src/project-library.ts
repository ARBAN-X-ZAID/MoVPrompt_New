import { z } from "zod";

import { MongoObjectIdSchema, RequestIdSchema } from "./api.js";
import { CreatorProjectSchema } from "./creator.js";
import { PublicRenderRunSchema, type RenderRunStatusSchema } from "./generation.js";

export const PROJECT_LIBRARY_PAGE_SIZE = 40;
export const PROJECT_LIBRARY_MAX_PAGE = 1_000_000;
export const PROJECT_LIBRARY_SEARCH_MAX_LENGTH = 120;

export const ProjectLibraryFilterSchema = z.enum(["all", "ready", "progress", "attention", "drafts"]);
export type ProjectLibraryFilter = z.infer<typeof ProjectLibraryFilterSchema>;
export type ProjectLibraryBucket = Exclude<ProjectLibraryFilter, "all">;

const TERMINAL_RUN_STATUSES: ReadonlySet<string> = new Set(["completed", "failed", "cancelled"]);

/**
 * The buckets are the single definition behind the Projects chips, the summary
 * and the server's query. The API derives its filters from these functions, so
 * a rule changed here changes both sides together.
 */
export function renderRunBucket(run: { status: z.infer<typeof RenderRunStatusSchema>; outputAvailable: boolean }): Exclude<ProjectLibraryBucket, "drafts"> {
  if (run.status === "completed" && run.outputAvailable) return "ready";
  if (run.status === "failed" || run.status === "cancelled") return "attention";
  return "progress";
}

export function draftProjectBucket(project: { status: string; hasGeneratedVideo?: boolean | undefined }): ProjectLibraryBucket {
  if (project.status === "generating") return "progress";
  if (project.status === "failed") return "attention";
  if (project.hasGeneratedVideo) return "ready";
  return "drafts";
}

export function isRenderRunActive(status: string): boolean {
  return !TERMINAL_RUN_STATUSES.has(status);
}

export const ProjectLibraryQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).max(PROJECT_LIBRARY_MAX_PAGE).default(1),
    limit: z.coerce.number().int().min(1).max(PROJECT_LIBRARY_PAGE_SIZE).default(PROJECT_LIBRARY_PAGE_SIZE),
    filter: ProjectLibraryFilterSchema.default("all"),
    search: z.string().trim().max(PROJECT_LIBRARY_SEARCH_MAX_LENGTH).default(""),
  })
  .strict();
export type ProjectLibraryQuery = z.infer<typeof ProjectLibraryQuerySchema>;

export const ProjectLibraryItemSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("run"), run: PublicRenderRunSchema }).strict(),
  z.object({ kind: z.literal("draft"), projectId: MongoObjectIdSchema.or(z.uuid()) }).strict(),
]);
export type ProjectLibraryItem = z.infer<typeof ProjectLibraryItemSchema>;

const LibraryCountSchema = z.number().int().nonnegative();

export const ProjectLibraryCountsSchema = z
  .object({
    all: LibraryCountSchema,
    ready: LibraryCountSchema,
    progress: LibraryCountSchema,
    attention: LibraryCountSchema,
    drafts: LibraryCountSchema,
  })
  .strict();
export type ProjectLibraryCounts = z.infer<typeof ProjectLibraryCountsSchema>;

export const ProjectLibraryResponseSchema = z
  .object({
    items: z.array(ProjectLibraryItemSchema).max(PROJECT_LIBRARY_PAGE_SIZE),
    projects: z.array(CreatorProjectSchema).max(PROJECT_LIBRARY_PAGE_SIZE),
    total: LibraryCountSchema,
    page: z.number().int().min(1),
    limit: z.number().int().min(1).max(PROJECT_LIBRARY_PAGE_SIZE),
    counts: ProjectLibraryCountsSchema,
    hasActive: z.boolean(),
    requestId: RequestIdSchema,
  })
  .strict();
export type ProjectLibraryResponse = z.infer<typeof ProjectLibraryResponseSchema>;
