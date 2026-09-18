import type {
  GuestClaimAssetManifest,
  GuestClaimSnapshot,
} from "@movprompt/contracts";

type GuestClaimSnapshotInput = Omit<GuestClaimSnapshot, "snapshotDigest">;

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * The digest is calculated from precisely the payload the server receives.
 * This lets receipt verification prove that the authenticated project is the
 * draft the guest configured, while keeping object storage coordinates server-owned.
 */
export async function buildGuestClaimSnapshot(input: GuestClaimSnapshotInput): Promise<GuestClaimSnapshot> {
  // IndexedDB retains undefined properties, while HTTP JSON omits them.
  // Store and hash exactly the same payload that the server will receive.
  const transferred = JSON.parse(JSON.stringify({
    ...input,
    assetManifest: [...input.assetManifest].sort((left, right) => left.ordinal - right.ordinal),
  })) as GuestClaimSnapshotInput;
  return {
    ...transferred,
    assetManifest: transferred.assetManifest as GuestClaimAssetManifest,
    snapshotDigest: await sha256(canonicalJson(transferred)),
  };
}
