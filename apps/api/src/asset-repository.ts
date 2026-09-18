import type { CreatorAsset } from "@movprompt/contracts";

export type OwnedAssetRecord = CreatorAsset & {
  userId: string;
  storageOwnerId?: string;
  bucket: string;
  originalFilename?: string;
  sourceUrlHash?: string;
};

export type CreateAssetRecord = OwnedAssetRecord & {
  width?: number | undefined;
  height?: number | undefined;
  durationMs?: number | undefined;
};

export interface AssetRepository {
  isProjectOwned(userId: string, projectId: string): Promise<boolean>;
  createOrFind(record: CreateAssetRecord): Promise<OwnedAssetRecord>;
  findOwned(userId: string, projectId: string, assetId: string): Promise<OwnedAssetRecord | null>;
  updateVerifiedFootage?(input: {
    userId: string;
    projectId: string;
    assetId: string;
    durationMs: number;
  }): Promise<OwnedAssetRecord | null>;
  updateVerifiedImage?(input: {
    userId: string;
    projectId: string;
    assetId: string;
    width: number;
    height: number;
  }): Promise<OwnedAssetRecord | null>;
}
