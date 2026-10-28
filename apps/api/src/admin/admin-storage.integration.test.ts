import {
  inventoryRetiredMedia,
  executeMediaCleanup,
  retentionPolicy,
} from "./media-retention.js";
import { createCustomerDataService } from "./customer-data.js";
import { createAdminPrivacyService } from "./privacy-service.js";
import { executeAccountErasure } from "./account-erasure.js";
import { LAUNCH_CREATIVE_TEMPLATE_CATALOG } from "@movprompt/creative-engine";
import { createPublishedTemplateMediaResolver } from "./template-media.js";
import { createAdminTemplateService } from "./template-service.js";
import { createAdminSecurity } from "./security.js";
import {
  ensureMongoTemplateCatalog,
  resolveStoredTemplateDefinition,
} from "@movprompt/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ObjectId } from "mongodb";
import { createHash, randomUUID } from "node:crypto";
import { createMongoDatabase } from "@movprompt/db";
import { R2Storage, r2StorageConfigFromEnv } from "@movprompt/storage";
import { createApi } from "../app.js";
import { loadApiConfig } from "../config.js";
import { createAssetStorageGateway } from "../asset-storage.js";
import type { AuthGateway } from "../auth-gateway.js";
import { ADMIN_COLLECTIONS as A, ensureAdminIndexes } from "./security.js";
import { createAdminOperationWorker } from "./operation-worker.js";

const enabled = Boolean(
  process.env.ADMIN_TEST_MONGODB_URI &&
  process.env.ADMIN_REAL_STORAGE_TEST === "true",
);
describe.skipIf(!enabled)(
  "logged admin media and exports on private R2",
  () => {
    const database = createMongoDatabase({
      uri: process.env.ADMIN_TEST_MONGODB_URI ?? "mongodb://127.0.0.1:27029/",
      databaseName: `movprompt_admin_storage_test_${Date.now()}`,
    });
    let r2: R2Storage;
    const owner = new ObjectId();
    const customer = new ObjectId();
    const entry = new ObjectId();
    const photoId = new ObjectId().toHexString();
    const sessionId = new ObjectId().toHexString();
    const key = `admin-test/${String(entry)}/fixture.png`;
    const createdKeys: string[] = [];
    const bytes = new Uint8Array(
      Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a3ioAAAAASUVORK5CYII=",
        "base64",
      ),
    );
    const auth: AuthGateway = {
      handle: async () => new Response(null),
      getSession: async (headers) =>
        headers.get("x-test-owner") === "yes"
          ? {
              user: {
                id: String(owner),
                name: "Storage test",
                email: "storage@example.test",
                emailVerified: true,
              },
              session: { id: sessionId },
            }
          : headers.get("x-test-customer") === "yes"
            ? {
                user: {
                  id: String(customer),
                  name: "QA customer",
                  email: "customer@example.test",
                  emailVerified: true,
                },
                session: { id: "customer-qa-session" },
              }
            : null,
    };
    beforeAll(async () => {
      r2 = new R2Storage(r2StorageConfigFromEnv(process.env));
      await database.connect();
      await ensureAdminIndexes(database);
      await database.db.collection("users").insertOne({
        _id: owner,
        emailVerified: true,
        twoFactorEnabled: true,
        name: "Owner",
      });
      await database.db
        .collection(A.owners)
        .insertOne({ userId: owner, role: "owner", active: true });
      await database.db.collection("twoFactor").insertOne({
        userId: owner,
        verified: true,
        backupCodes: "encrypted-test",
      });
      await database.db.collection(A.assurance).insertOne({
        userId: owner,
        sessionId,
        expiresAt: new Date(Date.now() + 3600000),
        recentUntil: new Date(Date.now() + 300000),
      });
      await r2.put({
        bucket: r2.assetsBucket,
        key,
        body: bytes,
        contentType: "image/png",
        metadata: {
          "sha256-hex": createHash("sha256").update(bytes).digest("hex"),
        },
      });
      createdKeys.push(key);
      await database.db.collection("creator_reference_library").insertOne({
        _id: entry,
        userId: customer,
        kind: "product",
        deleted: false,
        value: {
          name: "Private local QA pixel",
          photos: [{ id: photoId, mimeType: "image/png", objectKey: key }],
        },
      });
    });
    afterAll(async () => {
      for (const objectKey of createdKeys)
        await r2.delete(
          objectKey === key || objectKey.startsWith("admin-owned/")
            ? r2.assetsBucket
            : r2.outputsBucket,
          objectKey,
        );
      await database.db.dropDatabase();
      await database.close();
    });
    it("streams verified private bytes, logs access, supports ranges and refuses trashed media", async () => {
      const storage = createAssetStorageGateway(r2);
      const app = createApi({
        config: loadApiConfig({ APP_ENV: "test" }),
        environment: { FEATURE_OWNER_ADMIN: "true" },
        admin: { database, auth, storage },
      });
      const path = `/api/v1/admin/media/asset/${entry}?photoId=${photoId}`;
      expect((await app.request(path)).status).toBe(401);
      const response = await app.request(path, {
        headers: { "x-test-owner": "yes" },
      });
      expect(response.status).toBe(200);
      expect(new Uint8Array(await response.arrayBuffer())).toEqual(bytes);
      expect(response.headers.get("cache-control")).toContain("no-store");
      const range = await app.request(path, {
        headers: { "x-test-owner": "yes", range: "bytes=0-7" },
      });
      expect(range.status).toBe(206);
      expect(new Uint8Array(await range.arrayBuffer())).toEqual(
        bytes.slice(0, 8),
      );
      expect(
        await database.db
          .collection("audit_logs")
          .countDocuments({ action: "media.preview", target: String(entry) }),
      ).toBe(2);
      await database.db
        .collection("creator_reference_library")
        .updateOne({ _id: entry }, { $set: { deleted: true } });
      const inaccessible = await app.request(path, {
        headers: { "x-test-owner": "yes" },
      });
      expect(inaccessible.status).toBe(404);
      await database.db.collection("creator_reference_library").updateOne(
        { _id: entry },
        {
          $set: {
            trashUntil: new Date(Date.now() + 30 * 86400000),
            quarantinedAt: new Date(),
          },
        },
      );
      const restricted = await app.request(`${path}&restricted=true`, {
        headers: { "x-test-owner": "yes", range: "bytes=-8" },
      });
      expect(restricted.status).toBe(206);
      expect(new Uint8Array(await restricted.arrayBuffer())).toEqual(
        bytes.slice(-8),
      );
      expect(
        await database.db
          .collection("audit_logs")
          .findOne({ action: "media.preview", "changes.restricted": true }),
      ).toBeTruthy();
      const unsatisfiable = await app.request(`${path}&restricted=true`, {
        headers: { "x-test-owner": "yes", range: "bytes=9999-" },
      });
      expect(unsatisfiable.status).toBe(416);
      expect(unsatisfiable.headers.get("content-range")).toBe(
        `bytes */${bytes.length}`,
      );

      expect(
        (await app.request(path, { headers: { "x-test-owner": "yes" } }))
          .status,
      ).toBe(404);
    });
    it("copies approved owner media independently, verifies storage and revision-checks approval and trash", async () => {
      const storage = createAssetStorageGateway(r2);
      const app = createApi({
        config: loadApiConfig({ APP_ENV: "test" }),
        environment: { FEATURE_OWNER_ADMIN: "true" },
        admin: { database, auth, storage },
      });
      const ownerEntry = new ObjectId();
      const photo = new ObjectId().toHexString();
      const now = new Date().toISOString();
      const checksum = createHash("sha256").update(bytes).digest("hex");
      await database.db.collection("creator_reference_library").insertOne({
        _id: ownerEntry,
        userId: owner,
        kind: "product",
        deleted: false,
        value: {
          id: String(ownerEntry),
          kind: "product",
          name: "Company QA photo",
          revision: 1,
          photos: [
            {
              id: photo,
              name: "pixel.png",
              mimeType: "image/png",
              sizeBytes: bytes.length,
              width: 1,
              height: 1,
              objectKey: key,
              checksumSha256: checksum,
            },
          ],
          approved: true,
          deleted: false,
          reviewedAt: now,
          updatedAt: now,
          approval: {
            policyVersion: "2026-10-17",
            revision: 1,
            approved: true,
            reviewedAt: now,
            rightsConfirmed: true,
            sameSubjectConfirmed: true,
            adultConfirmed: false,
          },
        },
      });
      const post = async (
        path: string,
        body: unknown,
        operation = randomUUID(),
      ) =>
        app.request(`/api/v1/admin/${path}`, {
          method: "POST",
          headers: {
            "x-test-owner": "yes",
            "content-type": "application/json",
            "idempotency-key": operation,
          },
          body: JSON.stringify(body),
        });
      const body = {
        expectedRevision: 0,
        expectedStateRevision: 0,
        name: "Independent company sample",
        kind: "product-sample",
        source: {
          type: "library",
          entryId: String(ownerEntry),
          photoId: photo,
          revision: 1,
        },
        rightsConfirmed: true,
        adultLikenessConfirmed: false,
        reason: "Review owned company reference photo",
      };
      const rejected = await post("owned-media", {
        ...body,
        source: { ...body.source, entryId: String(entry), photoId },
      });
      expect(rejected.status).toBe(409);
      const operation = randomUUID();
      const response = await post("owned-media", body, operation);
      expect(response.status).toBe(200);
      const imported = await response.json();
      expect(
        (await (await post("owned-media", body, operation)).json()).id,
      ).toBe(imported.id);
      expect(
        await database.db.collection("admin_owned_media").countDocuments({}),
      ).toBe(1);
      expect(
        (
          await post(`owned-media/${imported.id}/actions`, {
            action: "approve",
            expectedRevision: 1,
            expectedStateRevision: 1,
            reason: "Premature approval should be rejected",
          })
        ).status,
      ).toBe(409);
      const worker = createAdminOperationWorker({
        database,
        auth,
        storage,
        environment: {},
      });
      await worker.tick();
      const head = await database.db
        .collection("admin_owned_media")
        .findOne({ _id: new ObjectId(imported.id) });
      expect(head).toMatchObject({
        status: "needs-review",
        revision: 1,
        stateRevision: 2,
        checksumSha256: checksum,
      });
      const revision = await database.db
        .collection("admin_owned_media_revisions")
        .findOne({ mediaId: new ObjectId(imported.id), revision: 1 });
      createdKeys.push(revision!.objectKey);
      expect(revision!.objectKey).not.toBe(key);
      expect(
        (
          await r2.get({
            bucket: r2.assetsBucket,
            key: revision!.objectKey,
            maxBytes: 1024,
          })
        ).body,
      ).toEqual(bytes);
      const approved = await post(`owned-media/${imported.id}/actions`, {
        action: "approve",
        expectedRevision: 1,
        expectedStateRevision: 2,
        reason: "Verified pixels and company permission",
      });
      expect(approved.status).toBe(200);
      expect(
        (
          await post(`owned-media/${imported.id}/actions`, {
            action: "withdraw-approval",
            expectedRevision: 1,
            expectedStateRevision: 2,
            reason: "Reject concurrent stale owner action",
          })
        ).status,
      ).toBe(409);
      await database.db
        .collection("creator_reference_library")
        .updateOne(
          { _id: ownerEntry },
          { $set: { deleted: true, "value.approved": false } },
        );
      await ensureMongoTemplateCatalog(
        database,
        LAUNCH_CREATIVE_TEMPLATE_CATALOG,
      );
      const template = await database.db
        .collection("video_templates")
        .findOne({ slug: "premium-phone-reveal" });
      const base = await database.db
        .collection("video_template_versions")
        .findOne({
          _id: new ObjectId(String(template!.currentPublishedVersionId)),
        });
      const service = createAdminTemplateService(
        database,
        createAdminSecurity(database, auth),
        { ADMIN_TEMPLATE_PUBLISHING_ENABLED: "true" },
      );
      const media = {
        productSamples: [{ mediaId: imported.id, revision: 1 }],
        presenterSamples: [],
      };
      const actor = {
        userId: String(owner),
        sessionId,
        requestId: "media-publication-qa",
      };
      const input = {
        expectedRevision: 0,
        baseVersionId: String(base!._id),
        definition: resolveStoredTemplateDefinition(
          base!,
          "premium-phone-reveal",
        ),
        templateMedia: media,
        reason: "Publish independent approved company sample",
      };
      await expect(
        service.save(actor, String(template!._id), randomUUID(), input),
      ).rejects.toMatchObject({
        code: "template_public_media_review_required",
      });
      const saved = (await service.save(
        actor,
        String(template!._id),
        randomUUID(),
        { ...input, publicMediaRightsConfirmed: true },
      )) as { revision: number };
      const published = await service.publish(
        actor,
        String(template!._id),
        randomUUID(),
        {
          expectedRevision: Number(template!.revision ?? 0),
          draftRevision: saved.revision,
          reason: "Owner reviewed public sample rights",
        },
      );
      const publicApp = createApi({
        assetStorage: storage,
        publishedTemplateMedia: createPublishedTemplateMediaResolver(database),
      });
      const publicPath = `/api/v1/template-media/${published.versionId}/productSamples/0`;
      const sample = await publicApp.request(publicPath);
      expect(sample.status).toBe(200);
      expect(new Uint8Array(await sample.arrayBuffer())).toEqual(bytes);
      expect(
        (
          await publicApp.request(publicPath, {
            headers: { range: "bytes=0-7" },
          })
        ).status,
      ).toBe(206);
      expect(
        (
          await publicApp.request(
            `/api/v1/template-media/${published.versionId}/presenterSamples/0`,
          )
        ).status,
      ).toBe(404);
      const preview = await app.request(
        `/api/v1/admin/media/owned/${imported.id}`,
        { headers: { "x-test-owner": "yes" } },
      );
      expect(preview.status).toBe(200);
      expect(new Uint8Array(await preview.arrayBuffer())).toEqual(bytes);
      expect(
        (
          await post(`owned-media/${imported.id}/actions`, {
            action: "trash",
            expectedRevision: 1,
            expectedStateRevision: 3,
            reason: "Review thirty-day recovery workflow",
          })
        ).status,
      ).toBe(200);
      expect((await publicApp.request(publicPath)).status).toBe(404);
      expect(
        (
          await app.request(`/api/v1/admin/media/owned/${imported.id}`, {
            headers: { "x-test-owner": "yes" },
          })
        ).status,
      ).toBe(404);
      expect(
        (
          await post(`owned-media/${imported.id}/actions`, {
            action: "restore",
            expectedRevision: 1,
            expectedStateRevision: 4,
            reason: "Restore copy for renewed approval",
          })
        ).status,
      ).toBe(200);
      expect(
        await database.db
          .collection("admin_owned_media")
          .findOne({ _id: new ObjectId(imported.id) }),
      ).toMatchObject({
        status: "needs-review",
        approvedRevision: null,
        stateRevision: 5,
        deletedAt: null,
      });
    });
    it("reviews historical photos through current owner access and logs the selected revision", async () => {
      await database.db
        .collection("creator_reference_library_revisions")
        .insertOne({
          entryId: String(entry),
          userId: customer,
          revision: 1,
          value: {
            photos: [{ id: photoId, objectKey: key, mimeType: "image/png" }],
          },
        });
      await database.db
        .collection("creator_reference_library")
        .updateOne(
          { _id: entry },
          { $set: { "value.photos": [], "value.revision": 2 } },
        );
      const app = createApi({
        environment: { FEATURE_OWNER_ADMIN: "true" },
        admin: { database, auth, storage: createAssetStorageGateway(r2) },
      });
      const path = `/api/v1/admin/media/asset/${entry}?photoId=${photoId}&revision=1`;
      expect((await app.request(path)).status).toBe(401);
      const response = await app.request(path, {
        headers: { "x-test-owner": "yes" },
      });
      expect(response.status).toBe(200);
      expect(new Uint8Array(await response.arrayBuffer())).toEqual(bytes);
      expect(
        await database.db.collection("audit_logs").countDocuments({
          action: "media.preview",
          target: String(entry),
          "changes.revision": 1,
        }),
      ).toBe(1);
      expect(
        (
          await app.request(path.replace("revision=1", "revision=8"), {
            headers: { "x-test-owner": "yes" },
          })
        ).status,
      ).toBe(404);
    });
    it("verifies independent support uploads and isolates private owner attachments", async () => {
      await database.db.collection("users").updateOne(
        { _id: customer },
        {
          $set: {
            email: "customer@example.test",
            name: "QA customer",
            emailVerified: true,
          },
        },
        { upsert: true },
      );
      const storage = createAssetStorageGateway(r2);
      const app = createApi({
        environment: {
          FEATURE_OWNER_ADMIN: "true",
          WEB_ORIGIN: "http://localhost:8080",
        },
        admin: { database, auth, storage },
      });
      const post = (
        path: string,
        body: unknown,
        isOwner = false,
        operation = randomUUID(),
      ) =>
        app.request(path, {
          method: "POST",
          headers: {
            ...(isOwner
              ? { "x-test-owner": "yes" }
              : { "x-test-customer": "yes" }),
            "content-type": "application/json",
            "idempotency-key": operation,
          },
          body: JSON.stringify(body),
        });
      const opened = await post("/api/v1/support", {
        subject: "Photo verification QA",
        category: "assets",
        message: "Review this attached image",
      });
      expect(opened.status).toBe(200);
      const caseId = (await opened.json()).id;
      const checksum = createHash("sha256").update(bytes).digest("hex");
      async function photo(isOwner = false, expectedChecksum = checksum) {
        const prefix = `/api/v1/${isOwner ? "admin/" : ""}support/${caseId}/attachments`;
        const operation = randomUUID();
        const input = {
          name: "qa.png",
          mimeType: "image/png",
          sizeBytes: bytes.length,
          checksumSha256: expectedChecksum,
        };
        const receipt = await (
          await post(prefix, input, isOwner, operation)
        ).json();
        expect(
          (await (await post(prefix, input, isOwner, operation)).json()).id,
        ).toBe(receipt.id);
        createdKeys.push(receipt.upload.key);
        if (expectedChecksum === checksum) {
          const upload = () =>
            app.request(`${prefix}/${receipt.id}/upload`, {
              method: "PUT",
              headers: {
                ...(isOwner
                  ? { "x-test-owner": "yes" }
                  : { "x-test-customer": "yes" }),
                "content-type": "image/png",
                "idempotency-key": randomUUID(),
                origin: "http://localhost:8080",
              },
              body: bytes,
            });
          expect((await upload()).status).toBe(200);
          expect((await upload()).status).toBe(200);
          expect(
            (
              await app.request(`${prefix}/${receipt.id}/upload`, {
                method: "PUT",
                headers: {
                  "content-type": "image/png",
                  "idempotency-key": randomUUID(),
                },
                body: bytes,
              })
            ).status,
          ).toBe(401);
          expect(
            (
              await app.request(`${prefix}/${receipt.id}/upload`, {
                method: "PUT",
                headers: {
                  "x-test-owner": "yes",
                  "content-type": "image/png",
                  "idempotency-key": randomUUID(),
                  origin: "https://evil.example",
                },
                body: bytes,
              })
            ).status,
          ).toBe(403);
        } else {
          expect(
            (
              await fetch(receipt.upload.url, {
                method: "PUT",
                headers: receipt.upload.headers,
                body: bytes,
              })
            ).ok,
          ).toBe(true);
        }
        const verified = await post(
          `${prefix}/${receipt.id}/verify`,
          {},
          isOwner,
        );
        if (verified.status === 200) {
          const row = await database.db
            .collection("support_attachments")
            .findOne({ _id: new ObjectId(receipt.id) });
          createdKeys.push(row!.objectKey);
          expect(row!.objectKey).not.toBe(receipt.upload.key);
        }
        return { id: receipt.id, response: verified };
      }
      const invalid = await photo(false, "0".repeat(64));
      expect(invalid.response.status).toBe(400);
      const customerPhoto = await photo();
      expect(customerPhoto.response.status).toBe(200);
      const sent = await post(`/api/v1/support/${caseId}/replies`, {
        expectedRevision: 1,
        message: "Exact customer wording",
        attachmentIds: [customerPhoto.id],
      });
      expect(sent.status).toBe(200);
      const file = `/api/v1/support/${caseId}/attachments/${customerPhoto.id}`;
      expect((await app.request(file)).status).toBe(401);
      expect(
        new Uint8Array(
          await (
            await app.request(file, { headers: { "x-test-customer": "yes" } })
          ).arrayBuffer(),
        ),
      ).toEqual(bytes);
      expect(
        (
          await post(`/api/v1/support/${caseId}/replies`, {
            expectedRevision: 2,
            message: "Cannot attach twice",
            attachmentIds: [customerPhoto.id],
          })
        ).status,
      ).toBe(409);
      const privatePhoto = await photo(true);
      expect(privatePhoto.response.status).toBe(200);
      expect(
        (
          await post(
            `/api/v1/admin/support/${caseId}`,
            {
              expectedRevision: 2,
              message: "Private inspection only",
              visibility: "private",
              attachmentIds: [privatePhoto.id],
              reason: "Owner note with verified photo",
            },
            true,
          )
        ).status,
      ).toBe(200);
      expect(
        (
          await app.request(
            `/api/v1/support/${caseId}/attachments/${privatePhoto.id}`,
            { headers: { "x-test-customer": "yes" } },
          )
        ).status,
      ).toBe(404);
      expect(
        (
          await app.request(
            `/api/v1/admin/support/${caseId}/attachments/${privatePhoto.id}`,
            { headers: { "x-test-owner": "yes" } },
          )
        ).status,
      ).toBe(200);
      const detail = await (
        await app.request(`/api/v1/support/${caseId}`, {
          headers: { "x-test-customer": "yes" },
        })
      ).text();
      expect(detail).toContain("Exact customer wording");
      expect(detail).not.toContain("Private inspection only");
      expect(detail).not.toContain("objectKey");
    });
    it("cleans expired staging and export objects while retaining linked support photos", async () => {
      const id = new ObjectId(),
        now = new Date(),
        old = new Date(now.getTime() - 40 * 86400000);
      const uploadKey = `support-uploads/${id}`,
        objectKey = `admin-test/support-linked/${id}.png`,
        exportKey = `admin-test/expired-export/${id}.json`;
      for (const key of [uploadKey, objectKey, exportKey]) {
        createdKeys.push(key);
        await r2.put({
          bucket: r2.assetsBucket,
          key,
          body: bytes,
          contentType: "image/png",
          metadata: {
            "sha256-hex": createHash("sha256").update(bytes).digest("hex"),
          },
        });
      }
      await database.db.collection("support_attachments").insertOne({
        _id: id,
        userId: customer,
        status: "verified",
        messageId: new ObjectId(),
        uploadKey,
        objectKey,
        bucket: r2.assetsBucket,
        createdAt: old,
        expiresAt: null,
      });
      await database.db.collection(A.operations).insertOne({
        kind: "customer.export",
        status: "completed",
        objectKey: exportKey,
        bucket: r2.assetsBucket,
        expiresAt: old,
        createdAt: old,
      });
      await inventoryRetiredMedia(database, createAssetStorageGateway(r2), now);
      const policy = {
        ADMIN_RETENTION_EXECUTION_ENABLED: "true",
        ADMIN_RETENTION_POLICY_VERSION: "synthetic-transient-v1",
        ADMIN_RETENTION_APPROVAL_REFERENCE: "disposable-fixture-only",
        ADMIN_FINANCIAL_RETENTION_DAYS: "2555",
        ADMIN_ACCOUNT_ERASURE_GRACE_DAYS: "30",
      };
      await executeMediaCleanup(
        database,
        createAssetStorageGateway(r2),
        policy,
        String(owner),
        now,
      );
      await expect(r2.head(r2.assetsBucket, uploadKey)).rejects.toMatchObject({
        $metadata: { httpStatusCode: 404 },
      });
      await expect(r2.head(r2.assetsBucket, exportKey)).rejects.toMatchObject({
        $metadata: { httpStatusCode: 404 },
      });
      expect((await r2.head(r2.assetsBucket, objectKey)).ContentLength).toBe(
        bytes.length,
      );
    });
    it("keeps live and active-copy references and purges only expired verified trash under an approved policy", async () => {
      const storage = createAssetStorageGateway(r2);
      const id = new ObjectId();
      const photo = new ObjectId().toHexString();
      const objectKey = `admin-test/retention/${id}.png`;
      createdKeys.push(objectKey);
      const checksum = createHash("sha256").update(bytes).digest("hex");
      await r2.put({
        bucket: r2.assetsBucket,
        key: objectKey,
        body: bytes,
        contentType: "image/png",
        metadata: { "sha256-hex": checksum },
      });
      const retiredAt = new Date(Date.now() - 31 * 86400000);
      await database.db.collection("creator_reference_library").insertOne({
        _id: id,
        userId: customer,
        deleted: true,
        trashedAt: retiredAt,
        trashUntil: new Date(retiredAt.getTime() + 30 * 86400000),
        updatedAt: retiredAt,
        value: {
          revision: 1,
          photos: [
            {
              id: photo,
              objectKey,
              mimeType: "image/png",
              checksumSha256: checksum,
              sizeBytes: bytes.length,
            },
          ],
        },
      });
      await inventoryRetiredMedia(database, storage);
      await expect(
        executeMediaCleanup(database, storage, {}, String(owner)),
      ).rejects.toThrow("admin_retention_gate_closed");
      const policy = {
        ADMIN_RETENTION_EXECUTION_ENABLED: "true",
        ADMIN_RETENTION_POLICY_VERSION: "synthetic-qa-v1",
        ADMIN_RETENTION_APPROVAL_REFERENCE: "disposable-local-test-only",
        ADMIN_FINANCIAL_RETENTION_DAYS: "3650",
        ADMIN_ACCOUNT_ERASURE_GRACE_DAYS: "30",
      };
      expect(retentionPolicy(policy)).toMatchObject({
        ready: true,
        enabled: true,
        mediaTrashDays: 30,
      });
      const reference = await database.db
        .collection("creator_project_assets")
        .insertOne({ userId: owner, objectKey, bucket: r2.assetsBucket });
      expect(
        await executeMediaCleanup(database, storage, policy, String(owner)),
      ).toMatchObject({ purged: 0, retained: 1 });
      await database.db
        .collection("creator_project_assets")
        .deleteOne({ _id: reference.insertedId });
      const pending = await database.db
        .collection("guest_claim_assets")
        .insertOne({
          userId: customer,
          status: "pending",
          librarySource: { entryId: String(id), photoId: photo, revision: 1 },
        });
      expect(
        await executeMediaCleanup(database, storage, policy, String(owner)),
      ).toMatchObject({ purged: 0, retained: 1 });
      await database.db.collection("guest_claim_assets").updateOne(
        { _id: pending.insertedId },
        {
          $set: {
            status: "verified",
            objectKey: "users/qa/independent-copy.png",
          },
        },
      );
      expect(
        await executeMediaCleanup(database, storage, policy, String(owner)),
      ).toMatchObject({ purged: 1, retained: 0 });
      await expect(r2.head(r2.assetsBucket, objectKey)).rejects.toThrow();
      expect(
        await database.db
          .collection("admin_retention_candidates")
          .findOne({ objectKey }),
      ).toMatchObject({ status: "purged", policyVersion: "synthetic-qa-v1" });
      expect(
        await executeMediaCleanup(database, storage, policy, String(owner)),
      ).toMatchObject({ purged: 0 });
    });
    it("rejects stale erasure reviews, then anonymizes a disposable account while retaining financial records and independent media references", async () => {
      const storage = createAssetStorageGateway(r2);
      const userId = new ObjectId();
      const projectId = new ObjectId();
      const versionId = new ObjectId();
      const requestId = new ObjectId();
      const now = new Date();
      const requestedAt = new Date(now.getTime() - 31 * 86400000);
      const objectKey = `admin-test/erasure/${userId}.png`;
      createdKeys.push(objectKey);
      const checksum = createHash("sha256").update(bytes).digest("hex");
      await r2.put({
        bucket: r2.assetsBucket,
        key: objectKey,
        body: bytes,
        contentType: "image/png",
        metadata: { "sha256-hex": checksum },
      });
      await database.db.collection("users").insertOne({
        _id: userId,
        name: "Disposable erasure QA",
        email: "erasure@example.test",
        emailVerified: true,
        deletionRequestedAt: requestedAt,
        deletionOperationId: requestId,
        createdAt: requestedAt,
        updatedAt: requestedAt,
      });
      await database.db.collection("accounts").insertOne({
        userId,
        providerId: "credential",
        password: "synthetic-hash",
      });
      await database.db
        .collection("credit_accounts")
        .insertOne({ userId, balance: 0, lifetimeSpent: 100 });
      await database.db.collection("credit_ledger").insertOne({
        userId,
        kind: "purchase",
        delta: 100,
        balanceAfter: 100,
        reason: "Synthetic historical purchase",
        createdAt: requestedAt,
      });
      await database.db.collection("payment_orders").insertOne({
        userId,
        status: "credited",
        amountMinor: 5000,
        currency: "KWD",
        createdAt: requestedAt,
      });
      await database.db.collection("creator_projects").insertOne({
        _id: projectId,
        userId,
        title: "Original disposable campaign",
        mode: "advanced",
        createdAt: requestedAt,
        updatedAt: requestedAt,
      });
      await database.db.collection("creator_project_versions").insertOne({
        _id: versionId,
        projectId,
        userId,
        versionNumber: 1,
        mode: "advanced",
        configuration: { privateName: "Disposable erasure QA" },
        productRecipe: {},
        campaignRecipe: {},
        createdAt: requestedAt,
      });
      await database.db.collection("creator_project_assets").insertOne({
        projectId,
        userId,
        kind: "product",
        bucket: r2.assetsBucket,
        objectKey,
        sizeBytes: bytes.length,
        checksumSha256: checksum,
        createdAt: requestedAt,
      });
      await database.db.collection(A.operations).insertOne({
        _id: requestId,
        userId,
        actorId: owner,
        kind: "customer.delete-request",
        status: "review-required",
        privacyRevision: 1,
        createdAt: requestedAt,
      });
      const oldExport = await database.db
        .collection(A.operations)
        .insertOne({
          userId,
          kind: "customer.export",
          status: "completed",
          bucket: r2.assetsBucket,
          objectKey,
          sizeBytes: bytes.length,
          checksumSha256: checksum,
          expiresAt: new Date(Date.now() + 86400000),
          createdAt: requestedAt,
        });
      const policy = {
        ADMIN_RETENTION_EXECUTION_ENABLED: "true",
        ADMIN_RETENTION_POLICY_VERSION: "synthetic-qa-v1",
        ADMIN_RETENTION_APPROVAL_REFERENCE: "disposable-local-test-only",
        ADMIN_FINANCIAL_RETENTION_DAYS: "3650",
        ADMIN_ACCOUNT_ERASURE_GRACE_DAYS: "30",
      };
      const privacy = createAdminPrivacyService(
        database,
        createAdminSecurity(database, auth),
        policy,
      );
      const data = createCustomerDataService(database, policy);
      const actor = {
        userId: String(owner),
        sessionId,
        requestId: "local-erasure-qa",
      };
      const manifest = await data.deletionManifest(userId);
      expect(manifest.blockers).toEqual([]);
      const review = {
        action: "approve-erasure" as const,
        expectedRevision: 1,
        manifestHash: manifest.manifestHash,
        policyVersion: "synthetic-qa-v1",
        confirmCustomerId: String(userId),
        reason: "Review disposable local synthetic account erasure",
      };
      await privacy.review(actor, String(requestId), randomUUID(), review);
      await database.db
        .collection("creator_projects")
        .updateOne(
          { _id: projectId },
          { $set: { title: "Unrelated edit preserved until review" } },
        );
      expect(
        await executeAccountErasure(
          database,
          { privacyRequestId: requestId },
          policy,
          storage,
        ),
      ).toMatchObject({ status: "review-required" });
      expect(
        await database.db.collection("users").findOne({ _id: userId }),
      ).not.toHaveProperty("erasedAt");
      expect(
        (
          await database.db
            .collection("creator_projects")
            .findOne({ _id: projectId })
        )?.title,
      ).toBe("Unrelated edit preserved until review");
      const changed = await database.db
        .collection(A.operations)
        .findOne({ _id: requestId });
      const fresh = await data.deletionManifest(userId);
      await privacy.review(actor, String(requestId), randomUUID(), {
        ...review,
        expectedRevision: changed!.privacyRevision,
        manifestHash: fresh.manifestHash,
      });
      const shared = await database.db
        .collection("creator_project_assets")
        .insertOne({ userId: customer, objectKey, bucket: r2.assetsBucket });
      expect(
        await executeAccountErasure(
          database,
          { privacyRequestId: requestId },
          policy,
          storage,
        ),
      ).toMatchObject({
        status: "erased",
        financialRecordsRetained: true,
        mediaCleanupPending: true,
      });
      expect(
        await database.db
          .collection(A.operations)
          .findOne({ _id: oldExport.insertedId }),
      ).toMatchObject({ status: "expired", privacyErasedAt: expect.any(Date) });
      const exportApi = createApi({
        environment: { FEATURE_OWNER_ADMIN: "true" },
        admin: { database, auth, storage },
      });
      expect(
        (
          await exportApi.request(
            `/api/v1/admin/exports/${oldExport.insertedId}/file`,
            { headers: { "x-test-owner": "yes" } },
          )
        ).status,
      ).toBe(404);
      expect(
        await database.db.collection("users").findOne({ _id: userId }),
      ).toMatchObject({
        email: `deleted-${userId}@account.invalid`,
        emailVerified: false,
      });
      expect(
        await database.db.collection("accounts").countDocuments({ userId }),
      ).toBe(0);
      expect(
        await database.db
          .collection("credit_ledger")
          .countDocuments({ userId }),
      ).toBe(1);
      expect(
        await database.db
          .collection("payment_orders")
          .countDocuments({ userId }),
      ).toBe(1);
      expect(
        await database.db.collection("credit_accounts").findOne({ userId }),
      ).toMatchObject({ balance: 0, lifetimeSpent: 100 });
      expect(
        (
          await database.db
            .collection("creator_project_versions")
            .findOne({ _id: versionId })
        )?.configuration,
      ).toEqual({});
      expect(
        await executeMediaCleanup(database, storage, policy, String(owner)),
      ).toMatchObject({ retained: 1 });
      await database.db
        .collection("creator_project_assets")
        .deleteOne({ _id: shared.insertedId });
      expect(
        await executeMediaCleanup(database, storage, policy, String(owner)),
      ).toMatchObject({ purged: 1 });
      const erased = await database.db
        .collection(A.operations)
        .findOne({ _id: requestId });
      await expect(
        privacy.review(actor, String(requestId), randomUUID(), {
          action: "cancel-request",
          expectedRevision: erased!.privacyRevision,
          reason: "Cannot undo permanent erasure",
        }),
      ).rejects.toMatchObject({ code: "privacy_request_changed" });
      const finalizer = createAdminOperationWorker({
        database,
        auth,
        storage,
        environment: policy,
      });
      for (let index = 0; index < 6; index++)
        if (!(await finalizer.tick())) break;
      expect(
        await database.db.collection(A.operations).countDocuments({
          privacyRequestId: requestId,
          status: { $in: ["queued", "running"] },
        }),
      ).toBe(0);
      const app = createApi({
        environment: { FEATURE_OWNER_ADMIN: "true" },
        admin: { database, auth, storage },
      });
      const restore = await app.request(
        `/api/v1/admin/customers/${userId}/actions`,
        {
          method: "POST",
          headers: {
            "x-test-owner": "yes",
            "content-type": "application/json",
            "idempotency-key": randomUUID(),
          },
          body: JSON.stringify({
            action: "restore",
            reason: "An erased account cannot be restored",
          }),
        },
      );
      expect(restore.status).toBe(409);
    });
    it("writes a private export, reads it through the owner boundary and logs the download", async () => {
      const now = new Date();
      const row = await database.db.collection(A.operations).insertOne({
        kind: "report.export",
        report: "customers",
        from: new Date(0),
        to: new Date(Date.now() + 10000),
        status: "queued",
        attempts: 0,
        availableAt: now,
        createdAt: now,
      });
      const storage = createAssetStorageGateway(r2);
      const worker = createAdminOperationWorker({
        database,
        auth,
        storage,
        environment: {},
      });
      await worker.tick();
      const operation = await database.db
        .collection(A.operations)
        .findOne({ _id: row.insertedId });
      expect(operation?.status).toBe("completed");
      createdKeys.push(operation!.objectKey);
      const app = createApi({
        config: loadApiConfig({ APP_ENV: "test" }),
        environment: { FEATURE_OWNER_ADMIN: "true" },
        admin: { database, auth, storage },
      });
      const path = `/api/v1/admin/exports/${row.insertedId}/file`;
      expect((await app.request(path)).status).toBe(401);
      const response = await app.request(path, {
        headers: { "x-test-owner": "yes" },
      });
      expect(response.status).toBe(200);
      expect(response.headers.get("content-disposition")).toContain(
        "attachment",
      );
      expect(await response.text()).toContain("email");
      expect(
        await database.db.collection("audit_logs").countDocuments({
          action: "report.download",
          target: String(row.insertedId),
        }),
      ).toBe(1);
    });
  },
);
