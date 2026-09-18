const SAFE_SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const SHA256 = /^[a-f0-9]{64}$/;

export type CreatorAssetKind = "product" | "logo" | "audio" | "reference" | "footage";

function assertSegment(value: string, label: string): string {
  const normalized = value.trim();
  if (!SAFE_SEGMENT.test(normalized) || normalized === "." || normalized === "..") {
    throw new Error(`${label} is not a safe object-key segment`);
  }
  return normalized;
}

function assertChecksum(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (!SHA256.test(normalized)) throw new Error("checksumSha256 must be a lowercase SHA-256 hex digest");
  return normalized;
}

/**
 * Stable keys deliberately contain no filename supplied by a browser or provider.
 * Database rows own human-readable metadata; object keys only encode ownership.
 */
export const objectKeys = {
  creatorAsset(input: {
    userId: string;
    projectId: string;
    assetId: string;
    kind: CreatorAssetKind;
    checksumSha256: string;
  }): string {
    const userId = assertSegment(input.userId, "userId");
    const projectId = assertSegment(input.projectId, "projectId");
    const assetId = assertSegment(input.assetId, "assetId");
    const kind = assertSegment(input.kind, "kind");
    const checksum = assertChecksum(input.checksumSha256);
    return `users/${userId}/projects/${projectId}/assets/${kind}/${assetId}/${checksum}`;
  },

  creatorOutput(input: {
    userId: string;
    projectId: string;
    versionId: string;
    outputId: string;
  }): string {
    const userId = assertSegment(input.userId, "userId");
    const projectId = assertSegment(input.projectId, "projectId");
    const versionId = assertSegment(input.versionId, "versionId");
    const outputId = assertSegment(input.outputId, "outputId");
    return `users/${userId}/projects/${projectId}/versions/${versionId}/outputs/${outputId}`;
  },

  templatePreview(input: { templateId: string; versionId: string; mediaId: string }): string {
    const templateId = assertSegment(input.templateId, "templateId");
    const versionId = assertSegment(input.versionId, "versionId");
    const mediaId = assertSegment(input.mediaId, "mediaId");
    return `templates/${templateId}/versions/${versionId}/${mediaId}`;
  },
};

export function assertOwnedProjectKey(key: string, userId: string, projectId: string): void {
  const expectedPrefix = `users/${assertSegment(userId, "userId")}/projects/${assertSegment(projectId, "projectId")}/`;
  if (!key.startsWith(expectedPrefix)) throw new Error("Object key is outside the requested project namespace");
}

export function assertStorageKey(key: string): string {
  if (!key || key.startsWith("/") || key.endsWith("/") || key.includes("\\")) {
    throw new Error("Invalid object key");
  }
  const parts = key.split("/");
  if (parts.some((part) => !SAFE_SEGMENT.test(part) || part === "." || part === "..")) {
    throw new Error("Object key contains an unsafe segment");
  }
  return key;
}
