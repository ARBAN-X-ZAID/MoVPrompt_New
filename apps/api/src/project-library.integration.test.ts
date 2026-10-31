import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ProjectLibraryQuerySchema, type ProjectLibraryCounts } from "@movprompt/contracts";
import { COLLECTIONS, createMongoDatabase, ensureMongoIndexes, newMongoObjectId } from "@movprompt/db";

import { createMongoCreatorRepository } from "./mongo-creator-repository.js";
import { createMongoGenerationRepository } from "./mongo-generation-repository.js";

const MONGO_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/?replicaSet=rs0&directConnection=true";

describe.skipIf(process.env.MOVPROMPT_TEST_MONGO !== "true")("project library", () => {
  const db = createMongoDatabase({ uri: MONGO_URI, databaseName: `movprompt_library_test_${Date.now()}` });
  const creators = createMongoCreatorRepository(db);
  const generation = createMongoGenerationRepository(db);
  beforeAll(async () => { await db.connect(); await ensureMongoIndexes(db); });
  afterAll(async () => { await db.db.dropDatabase(); await db.close(); });

  const LISTABLE = { creatorProject: { product: { name: "Oud" }, scenes: [] } };
  const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000);

  async function addProject(userId: string, fields: Record<string, unknown> = {}, configuration: Record<string, unknown> = LISTABLE) {
    const id = newMongoObjectId();
    const versionId = newMongoObjectId();
    await db.collection(COLLECTIONS.creatorProjects).insertOne({ id, userId, title: "Oud launch", mode: "template", status: "ready", deletedAt: null, currentWorkingVersionId: versionId, currentAcceptedVersionId: null, createdAt: minutesAgo(600), updatedAt: minutesAgo(10), ...fields });
    await db.collection(COLLECTIONS.creatorProjectVersions).insertOne({ id: versionId, projectId: id, userId, mode: "template", versionNumber: 1, configuration, createdAt: minutesAgo(600) });
    return { id, versionId };
  }

  async function addRun(userId: string, project: { id: string; versionId: string }, fields: Record<string, unknown> = {}) {
    const id = newMongoObjectId();
    const status = fields.status ?? "completed";
    await db.collection(COLLECTIONS.renderRuns).insertOne({
      id, projectId: project.id, projectVersionId: project.versionId, userId, idempotencyKey: `library-${id}`, capabilityAlias: "video.cinematic", quoteId: newMongoObjectId(), quotedCredits: 40, chargedCredits: 40,
      status, processingStage: "ready",
      ...(status === "completed" ? { outputBucket: "outputs", outputObjectKey: `users/${userId}/${id}.mp4` } : {}),
      createdAt: minutesAgo(5), updatedAt: minutesAgo(5), ...fields,
    });
    return id;
  }

  const list = (userId: string, query: Record<string, unknown> = {}) => generation.listProjectLibrary(userId, ProjectLibraryQuerySchema.parse(query));
  const keys = (page: Awaited<ReturnType<typeof list>>) => page.items.map((item) => item.kind === "run" ? item.run.id : item.projectId);
  const counts = (fields: Partial<ProjectLibraryCounts>): ProjectLibraryCounts => ({ all: 0, ready: 0, progress: 0, attention: 0, drafts: 0, ...fields });

  it("never returns or counts another owner's work", async () => {
    const owner = newMongoObjectId();
    const other = newMongoObjectId();
    const mine = await addProject(owner);
    const runId = await addRun(owner, mine);
    const theirs = await addProject(other);
    await addRun(other, theirs);
    await addRun(other, theirs, { status: "processing" });
    await addProject(other);

    const page = await list(owner);
    expect(keys(page)).toEqual([runId]);
    expect(page).toMatchObject({ total: 1, hasActive: false, counts: counts({ all: 1, ready: 1 }) });
    expect(await list(newMongoObjectId())).toMatchObject({ items: [], total: 0, counts: counts({}) });
    expect(await creators.listProjects(owner, { includeTrashed: false, ids: [mine.id, theirs.id] })).toHaveLength(1);
  });

  it("lists every run newest first, then drafts by last update, across the page boundary", async () => {
    const owner = newMongoObjectId();
    const generated = await addProject(owner, { status: "completed" });
    const runs = [
      await addRun(owner, generated, { createdAt: minutesAgo(1) }),
      await addRun(owner, generated, { createdAt: minutesAgo(2), status: "failed" }),
      await addRun(owner, generated, { createdAt: minutesAgo(3), status: "processing" }),
    ];
    // Created newest-last so the sort, not insertion order, decides.
    const older = await addProject(owner, { updatedAt: minutesAgo(30) });
    const newer = await addProject(owner, { updatedAt: minutesAgo(20) });

    const first = await list(owner, { limit: 2 });
    const second = await list(owner, { limit: 2, page: 2 });
    const third = await list(owner, { limit: 2, page: 3 });
    expect(keys(first)).toEqual([runs[0], runs[1]]);
    expect(keys(second)).toEqual([runs[2], newer.id]);
    expect(second.items.map((item) => item.kind)).toEqual(["run", "draft"]);
    expect(keys(third)).toEqual([older.id]);
    expect(first.total).toBe(5);
    expect(third).toMatchObject({ total: 5, counts: counts({ all: 5, ready: 1, attention: 1, progress: 1, drafts: 2 }) });
    expect((await list(owner, { limit: 2, page: 4 })).items).toEqual([]);
  });

  it("keeps pages stable when timestamps tie", async () => {
    const owner = newMongoObjectId();
    const tie = minutesAgo(5);
    const project = await addProject(owner);
    const runs = await Promise.all(Array.from({ length: 5 }, () => addRun(owner, project, { createdAt: tie })));
    const drafts = await Promise.all(Array.from({ length: 5 }, () => addProject(owner, { updatedAt: tie })));

    const seen: string[] = [];
    for (let page = 1; page <= 4; page += 1) seen.push(...keys(await list(owner, { limit: 3, page })));
    expect(seen).toHaveLength(10);
    expect(new Set(seen).size).toBe(10);
    expect(seen.slice(0, 5)).toEqual([...runs].sort().reverse());
    expect(seen.slice(5)).toEqual(drafts.map((draft) => draft.id).sort().reverse());
  });

  it("files runs and run-free projects into the same buckets as the page", async () => {
    const owner = newMongoObjectId();
    const project = await addProject(owner);
    const ready = await addRun(owner, project);
    const missingOutput = await addRun(owner, project, { outputBucket: null, outputObjectKey: null });
    const emptyOutput = await addRun(owner, project, { outputBucket: "outputs", outputObjectKey: "" });
    const failed = await addRun(owner, project, { status: "failed" });
    const failedWithOutput = await addRun(owner, project, { status: "failed", outputBucket: "outputs", outputObjectKey: "saved.mp4" });
    const cancelled = await addRun(owner, project, { status: "cancelled" });
    const queued = await addRun(owner, project, { status: "queued" });
    const generating = await addProject(owner, { status: "generating" });
    const stuck = await addProject(owner, { status: "failed", currentAcceptedVersionId: newMongoObjectId() });
    const accepted = await addProject(owner, { currentAcceptedVersionId: newMongoObjectId() });
    const finished = await addProject(owner, { status: "completed" });
    const exported = await addProject(owner);
    await db.collection(COLLECTIONS.exports).insertOne({ id: newMongoObjectId(), userId: owner, projectId: exported.id, status: "failed" });
    const plain = await addProject(owner, { status: "review" });

    const expected = {
      ready: [ready, accepted.id, finished.id, exported.id],
      progress: [missingOutput, emptyOutput, queued, generating.id],
      attention: [failed, failedWithOutput, cancelled, stuck.id],
      drafts: [plain.id],
    };
    for (const [filter, ids] of Object.entries(expected)) {
      const page = await list(owner, { filter });
      expect(keys(page).sort()).toEqual([...ids].sort());
      expect(page.total).toBe(ids.length);
    }
    expect((await list(owner)).counts).toEqual(counts({ all: 13, ready: 4, progress: 4, attention: 4, drafts: 1 }));
  });

  it("searches titles literally across runs and drafts while counts keep ignoring the search", async () => {
    const owner = newMongoObjectId();
    const summer = await addProject(owner, { title: "Summer (Oud) Sale" });
    const runId = await addRun(owner, summer);
    const arabic = await addProject(owner, { title: "حملة الصيف" });
    await addProject(owner, { title: "Winter gifts" });
    const library = counts({ all: 3, ready: 1, drafts: 2 });

    const caseInsensitive = await list(owner, { search: "summer" });
    expect(keys(caseInsensitive)).toEqual([runId]);
    expect(caseInsensitive).toMatchObject({ total: 1, counts: library });
    expect(keys(await list(owner, { search: "الصيف" }))).toEqual([arabic.id]);
    expect(keys(await list(owner, { search: "(oud)" }))).toEqual([runId]);
    expect(keys(await list(owner, { search: "S.mmer" }))).toEqual([]);
    expect(await list(owner, { search: ".*" })).toMatchObject({ items: [], total: 0, counts: library });
    expect(await list(owner, { search: "summer", filter: "drafts" })).toMatchObject({ items: [], total: 0 });
    expect(keys(await list(owner, { search: "summer", filter: "ready" }))).toEqual([runId]);
  });

  it("hides trashed projects and their runs, as the page always has", async () => {
    const owner = newMongoObjectId();
    const now = new Date();
    const gone = await addProject(owner, { status: "trashed", deletedAt: now });
    await addRun(owner, gone);
    await addProject(owner, { status: "trashed", deletedAt: now });
    const live = await addProject(owner);

    const page = await list(owner);
    expect(keys(page)).toEqual([live.id]);
    expect(page).toMatchObject({ total: 1, counts: counts({ all: 1, drafts: 1 }) });
    expect(await list(owner, { search: "Oud" })).toMatchObject({ total: 1 });
  });

  it("keeps unreleased business runs out of history and treats their project as a draft", async () => {
    const owner = newMongoObjectId();
    const hidden = await addProject(owner);
    await addRun(owner, hidden, { businessFundingId: newMongoObjectId(), status: "processing" });
    const released = await addProject(owner);
    const runId = await addRun(owner, released, { businessFundingId: newMongoObjectId(), businessCandidateReady: true });
    const saved = await addProject(owner);
    await addRun(owner, saved, { businessFundingId: newMongoObjectId() });

    const page = await list(owner);
    expect(keys(page)).toEqual(expect.arrayContaining([runId, hidden.id, saved.id]));
    expect(page).toMatchObject({ total: 3, hasActive: false, counts: counts({ all: 3, ready: 2, drafts: 1 }) });
  });

  it("omits projects the web client cannot open, matching projectFromCloud", async () => {
    const owner = newMongoObjectId();
    await addProject(owner, {}, { prompt: "Advanced direction" });
    await addProject(owner, {}, { creatorProject: { product: { name: "No scenes" } } });
    await addProject(owner, { currentWorkingVersionId: null });
    const listable = await addProject(owner);

    const page = await list(owner);
    expect(keys(page)).toEqual([listable.id]);
    expect(page.counts).toEqual(counts({ all: 1, drafts: 1 }));
  });

  it("reports activity anywhere in the library, not only on this page", async () => {
    const owner = newMongoObjectId();
    const project = await addProject(owner);
    await addRun(owner, project, { status: "cancelling", createdAt: minutesAgo(60) });
    await addRun(owner, project, { createdAt: minutesAgo(1) });

    expect((await list(owner, { limit: 1 })).hasActive).toBe(true);
    await db.collection(COLLECTIONS.renderRuns).updateMany({ userId: owner, status: "cancelling" }, { $set: { status: "cancelled" } });
    expect((await list(owner, { limit: 1 })).hasActive).toBe(false);
  });

  it("hydrates a page exactly as the full project list does", async () => {
    const owner = newMongoObjectId();
    const first = await addProject(owner, { title: "First" });
    await addRun(owner, first);
    await db.collection(COLLECTIONS.exports).insertOne({ id: newMongoObjectId(), userId: owner, projectId: first.id, status: "completed" });
    const second = await addProject(owner, { title: "Second" });
    await addProject(owner, { title: "Not on this page" });

    const everything = await creators.listProjects(owner, { includeTrashed: false });
    const page = await creators.listProjects(owner, { includeTrashed: false, ids: [first.id, second.id] });
    expect(page).toEqual(everything.filter((project) => project.id !== everything.find((row) => row.title === "Not on this page")!.id));
    expect(await creators.listProjects(owner, { includeTrashed: false, ids: [] })).toEqual([]);
  });
});
