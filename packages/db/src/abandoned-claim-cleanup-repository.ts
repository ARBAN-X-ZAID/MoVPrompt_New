export type AbandonedClaimCleanupCandidateRecord = {
  claimId: string;
  assetId: string;
  userId: string;
  projectId: string;
  bucket: string;
  objectKey: string;
  kind: "product" | "logo" | "audio" | "reference" | "footage";
  checksumSha256: string;
  updatedAt: Date;
};
