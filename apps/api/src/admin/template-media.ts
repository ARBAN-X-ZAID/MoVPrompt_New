import { ObjectId, type ClientSession, type Document } from "mongodb";
import {
  AdminTemplateMediaSchema,
  type AdminTemplateMedia,
} from "@movprompt/contracts";
import { COLLECTIONS as C, type MongoDatabase } from "@movprompt/db";
import { OWNED_MEDIA, OWNED_MEDIA_REVISIONS } from "./owned-media-service.js";
import { adminError } from "./security.js";

export const templateMediaSlots = [
  "poster",
  "preview",
  "productSamples",
  "presenterSamples",
] as const;
type Slot = (typeof templateMediaSlots)[number];
export function mediaReferences(media: AdminTemplateMedia) {
  return templateMediaSlots.flatMap((slot) => {
    const value = media[slot];
    return (Array.isArray(value) ? value : value ? [value] : []).map(
      (reference, index) => ({ slot, index, ...reference }),
    );
  });
}
const permittedKind: Record<Slot, string> = {
  poster: "poster",
  preview: "video-preview",
  productSamples: "product-sample",
  presenterSamples: "presenter-sample",
};

/** Locks approved, independent company copies in the publishing transaction.
 * Customer library records can never be used as publication references. */
export async function validateTemplateMedia(
  database: MongoDatabase,
  value: unknown,
  session: ClientSession,
  outputHash?: string,
) {
  const media = AdminTemplateMediaSchema.parse(value ?? {});
  for (const ref of mediaReferences(media)) {
    const head = await database.db.collection(OWNED_MEDIA).findOne(
      {
        _id: new ObjectId(ref.mediaId),
        revision: ref.revision,
        approvedRevision: ref.revision,
        status: "approved",
        deletedAt: null,
        kind: permittedKind[ref.slot],
      },
      { session },
    );
    const revision = head
      ? await database.db.collection(OWNED_MEDIA_REVISIONS).findOne(
          {
            mediaId: head._id,
            revision: ref.revision,
            verifiedAt: { $ne: null },
          },
          { session },
        )
      : null;
    if (!head || !revision?.objectKey)
      return adminError(
        "template_media_unapproved",
        "Choose the current approved company-media revision for each slot.",
      );
    await database.db
      .collection(OWNED_MEDIA)
      .updateOne(
        { _id: head._id, stateRevision: head.stateRevision },
        { $inc: { publicUseFence: 1 } },
        { session },
      );
    if (ref.slot === "preview" && outputHash) {
      const evidence = await database.db
        .collection("admin_template_quality_evidence")
        .findOne(
          {
            outputHash,
            status: "passed",
            businessFunded: true,
            sourceRunId: revision.source?.runId,
          },
          { session },
        );
      if (!evidence)
        return adminError(
          "template_preview_evidence_required",
          "The selected preview needs matching verified output evidence for this recipe.",
        );
    }
  }
  return media;
}

export function publicTemplateMediaPaths(versionId: string, value: unknown) {
  const parsed = AdminTemplateMediaSchema.safeParse(value);
  if (!parsed.success) return undefined;
  const path = (slot: Slot, index = 0) =>
    `/api/v1/template-media/${versionId}/${slot}/${index}`;
  return {
    ...(parsed.data.poster ? { poster: path("poster") } : {}),
    ...(parsed.data.preview ? { preview: path("preview") } : {}),
    productSamples: parsed.data.productSamples.map((_, index) =>
      path("productSamples", index),
    ),
    presenterSamples: parsed.data.presenterSamples.map((_, index) =>
      path("presenterSamples", index),
    ),
  };
}

/** Current public publication + exact independent approved revision. Approval
 * withdrawal, trash or a replaced revision removes new public access immediately. */
export function createPublishedTemplateMediaResolver(database: MongoDatabase) {
  return async (
    versionId: string,
    slot: Slot,
    index: number,
  ): Promise<Document | null> => {
    const version = await database.db
      .collection(C.videoTemplateVersions)
      .findOne({ _id: new ObjectId(versionId), publishedAt: { $ne: null } });
    if (
      !version ||
      !(await database.db.collection(C.videoTemplates).findOne({
        _id: version.templateId,
        publishingState: "published",
        currentPublishedVersionId: versionId,
      }))
    )
      return null;
    const parsed = AdminTemplateMediaSchema.safeParse(version.templateMedia);
    if (!parsed.success) return null;
    const refs = mediaReferences(parsed.data);
    const ref = refs.find((item) => item.slot === slot && item.index === index);
    if (!ref) return null;
    const head = await database.db.collection(OWNED_MEDIA).findOne({
      _id: new ObjectId(ref.mediaId),
      revision: ref.revision,
      approvedRevision: ref.revision,
      status: "approved",
      deletedAt: null,
      kind: permittedKind[slot],
    });
    return head
      ? database.db.collection(OWNED_MEDIA_REVISIONS).findOne({
          mediaId: head._id,
          revision: ref.revision,
          verifiedAt: { $ne: null },
        })
      : null;
  };
}
