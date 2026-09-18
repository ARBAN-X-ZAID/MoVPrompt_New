import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

import { createFootageVerifier, FootageVerificationError } from "./footage-verifier.js";

const mp4Bytes = new Uint8Array([0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d, 0, 0, 0, 0]);
const checksumSha256 = createHash("sha256").update(mp4Bytes).digest("hex");

describe("footage verifier", () => {
  it("accepts only a decodable allowed video stream and derives duration from the probe", async () => {
    const verifier = createFootageVerifier({
      probe: vi.fn(async () => ({
        streams: [{ codec_type: "video", codec_name: "h264", duration: "1.0" }],
        format: { format_name: "mov,mp4,m4a,3gp,3g2,mj2", duration: "12.345" },
      })),
    });

    await expect(verifier.verify({ bytes: mp4Bytes, mimeType: "video/mp4", checksumSha256 }))
      .resolves.toEqual({ durationMs: 12_345 });
  });

  it("rejects ftyp-only bytes, spoofed checksums and probe-reported overlong footage", async () => {
    const invalid = createFootageVerifier({ probe: vi.fn(async () => { throw new Error("invalid data"); }) });
    await expect(invalid.verify({ bytes: mp4Bytes, mimeType: "video/mp4", checksumSha256 }))
      .rejects.toMatchObject<FootageVerificationError>({ code: "invalid" });
    await expect(invalid.verify({ bytes: mp4Bytes, mimeType: "video/mp4", checksumSha256: "b".repeat(64) }))
      .rejects.toMatchObject<FootageVerificationError>({ code: "invalid" });

    const tooLong = createFootageVerifier({
      probe: vi.fn(async () => ({
        streams: [{ codec_type: "video", codec_name: "h264" }],
        format: { format_name: "mov,mp4", duration: "600.001" },
      })),
    });
    await expect(tooLong.verify({ bytes: mp4Bytes, mimeType: "video/mp4", checksumSha256 }))
      .rejects.toMatchObject<FootageVerificationError>({ code: "invalid" });
  });

  it("fails closed when FFprobe is unavailable", async () => {
    const unavailable = createFootageVerifier({
      probe: vi.fn(async () => {
        const error = new Error("not found") as NodeJS.ErrnoException;
        error.code = "ENOENT";
        throw error;
      }),
    });
    await expect(unavailable.verify({ bytes: mp4Bytes, mimeType: "video/mp4", checksumSha256 }))
      .rejects.toMatchObject<FootageVerificationError>({ code: "unavailable" });
  });
});
