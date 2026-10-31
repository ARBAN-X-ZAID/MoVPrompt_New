import type { ProjectLibraryResponse } from "@movprompt/contracts";
import { ProjectLibraryResponseSchema } from "@movprompt/contracts";
import { describe, expect, it, vi } from "vitest";

import type { AuthGateway, AuthenticatedSession } from "./auth-gateway.js";
import { createApi } from "./app.js";
import { loadApiConfig } from "./config.js";
import type { CreatorRepository } from "./creator-repository.js";
import type { GenerationApiService } from "./generation-service.js";
import { guestRouteAllowed } from "./guest-access.js";

const userId = "507f1f77bcf86cd799439011";
const projectId = "507f1f77bcf86cd799439012";
const draftId = "507f1f77bcf86cd799439013";
const session: AuthenticatedSession = {
  user: { id: userId, email: "creator@example.com", emailVerified: true, name: "Creator" },
  session: { id: "session-1" },
};
const run: ProjectLibraryResponse["items"][number] = {
  kind: "run",
  run: {
    id: "507f1f77bcf86cd799439014",
    projectId,
    projectVersionId: "507f1f77bcf86cd799439015",
    capability: "video.cinematic",
    quoteId: "507f1f77bcf86cd799439016",
    quotedCredits: 80,
    chargedCredits: 80,
    starterEntitlementUsed: false,
    status: "completed",
    processingStage: "ready",
    outputAvailable: true,
    error: null,
    createdAt: "2026-08-12T08:00:00.000Z",
    updatedAt: "2026-08-12T08:00:00.000Z",
    completedAt: "2026-08-12T08:01:00.000Z",
  },
};

function harness(currentSession: AuthenticatedSession | null, overrides: { templateMode?: boolean } = {}) {
  const listProjectLibrary = vi.fn<GenerationApiService["listProjectLibrary"]>(async () => ({
    items: [run, run, { kind: "draft", projectId: draftId }],
    total: 3,
    counts: { all: 3, ready: 2, progress: 0, attention: 0, drafts: 1 },
    hasActive: false,
  }));
  const listProjects = vi.fn<CreatorRepository["listProjects"]>(async () => []);
  const auth: AuthGateway = { handle: vi.fn(async () => new Response(null, { status: 204 })), getSession: vi.fn(async () => currentSession) };
  const api = createApi({
    config: loadApiConfig({
      APP_ENV: "test",
      API_PORT: "3001",
      FEATURE_AUTHENTICATION: "true",
      FEATURE_GENERATION: "true",
      FEATURE_TEMPLATE_MODE: overrides.templateMode === false ? "false" : "true",
    }),
    authGateway: auth,
    generationService: { isAvailable: () => true, listProjectLibrary } as unknown as GenerationApiService,
    creatorRepository: { listProjects } as unknown as CreatorRepository,
  });
  return { api, listProjectLibrary, listProjects };
}

describe("GET /api/v1/project-library", () => {
  it("requires a session", async () => {
    const { api, listProjectLibrary } = harness(null);
    expect((await api.request("/api/v1/project-library")).status).toBe(401);
    expect(listProjectLibrary).not.toHaveBeenCalled();
  });

  it("stays closed to guest sessions", () => {
    expect(guestRouteAllowed("GET", "/api/v1/project-library")).toBe(false);
  });

  it("scopes the page to the session and loads each page project once", async () => {
    const { api, listProjectLibrary, listProjects } = harness(session);
    const response = await api.request("/api/v1/project-library?page=2&limit=20&filter=ready&search=%20summer%20");

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(listProjectLibrary).toHaveBeenCalledExactlyOnceWith(userId, { page: 2, limit: 20, filter: "ready", search: "summer" });
    expect(listProjects).toHaveBeenCalledExactlyOnceWith(userId, { includeTrashed: false, ids: [projectId, draftId] });
    const body = ProjectLibraryResponseSchema.parse(await response.json());
    expect(body).toMatchObject({ page: 2, limit: 20, total: 3, hasActive: false, counts: { all: 3 } });
  });

  it("applies the documented defaults", async () => {
    const { api, listProjectLibrary } = harness(session);
    await api.request("/api/v1/project-library");
    expect(listProjectLibrary).toHaveBeenCalledWith(userId, { page: 1, limit: 40, filter: "all", search: "" });
  });

  it.each([
    "limit=41",
    "page=0",
    "filter=trashed",
    `userId=${projectId}`,
  ])("rejects ?%s", async (query) => {
    const { api, listProjectLibrary } = harness(session);
    const response = await api.request(`/api/v1/project-library?${query}`);
    expect(response.status).toBe(400);
    expect(listProjectLibrary).not.toHaveBeenCalled();
  });

  it("fails closed when projects are not available", async () => {
    const { api, listProjectLibrary } = harness(session, { templateMode: false });
    expect((await api.request("/api/v1/project-library")).status).toBe(503);
    expect(listProjectLibrary).not.toHaveBeenCalled();
  });
});
