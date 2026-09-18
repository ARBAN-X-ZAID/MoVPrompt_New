import {
  R2Storage,
  type PutPrivateObjectRequest,
  type GetPrivateObjectRequest,
  type SignUploadRequest,
  type SignedDownload,
  type SignedUpload,
} from "@movprompt/storage";

export type AssetObjectHead = {
  contentLength?: number;
  contentType?: string;
  checksumSha256?: string;
};

export interface AssetStorageGateway {
  readonly assetsBucket: string;
  readonly outputsBucket: string;
  signUpload(input: SignUploadRequest): Promise<SignedUpload>;
  signDownload(input: {
    bucket: string;
    key: string;
    downloadFilename?: string;
  }): Promise<SignedDownload>;
  put(input: PutPrivateObjectRequest): Promise<{ bucket: string; key: string }>;
  get(input: GetPrivateObjectRequest): Promise<{
    body: Uint8Array;
    contentType?: string;
    checksumSha256?: string;
  }>;
  head(bucket: string, key: string): Promise<AssetObjectHead>;
  checkBuckets(): Promise<void>;
}

export function createAssetStorageGateway(storage: R2Storage): AssetStorageGateway {
  return {
    assetsBucket: storage.assetsBucket,
    outputsBucket: storage.outputsBucket,
    signUpload: (input) => storage.signUpload(input),
    signDownload: (input) => storage.signDownload(input),
    put: (input) => storage.put(input),
    get: (input) => storage.get(input),
    async checkBuckets() {
      await Promise.all([
        storage.checkBucket(storage.assetsBucket),
        storage.checkBucket(storage.outputsBucket),
      ]);
    },
    async head(bucket, key) {
      const result = await storage.head(bucket, key);
      return {
        ...(result.ContentLength === undefined ? {} : { contentLength: result.ContentLength }),
        ...(result.ContentType === undefined ? {} : { contentType: result.ContentType }),
        ...(result.Metadata?.["sha256-hex"] === undefined
          ? {}
          : { checksumSha256: result.Metadata["sha256-hex"] }),
      };
    },
  };
}
