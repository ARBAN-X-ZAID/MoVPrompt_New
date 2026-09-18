import { describe, expect, it } from "vitest";
import { r2StorageConfigFromEnv, R2Storage } from "../src/service.js";

const env = {
  R2_ACCOUNT_ID: "a".repeat(32), R2_ACCESS_KEY_ID: "access", R2_SECRET_ACCESS_KEY: "secret",
  R2_ASSETS_BUCKET: "creator-assets", R2_OUTPUTS_BUCKET: "creator-outputs",
  R2_TEMPLATE_PREVIEWS_BUCKET: "template-previews", R2_TEMPLATE_PREVIEWS_BASE_URL: "https://media.example.com",
};
describe("R2-only configuration", () => {
  it("derives the endpoint from the account; ignores alternate endpoint configuration", async () => {
    const config = r2StorageConfigFromEnv({ ...env, S3_ENDPOINT: "http://localhost:9000" });
    const signed = await new R2Storage(config).signDownload({ bucket: config.outputsBucket, key: "users/a/projects/b/video.mp4" });
    expect(new URL(signed.url).hostname).toContain(`${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`);
  });
  it.each(Object.keys(env).filter(key => key !== "R2_TEMPLATE_PREVIEWS_BASE_URL"))("requires %s with a useful setup message", (key) => {
    expect(() => r2StorageConfigFromEnv({ ...env, [key]: "" })).toThrow(key);
  });
  it("rejects malformed accounts", () => {
    expect(() => r2StorageConfigFromEnv({ ...env, R2_ACCOUNT_ID: "localhost/path" })).toThrow("R2_ACCOUNT_ID");
  });
  it("supports one private bucket without any public preview domain", () => {
    const config = r2StorageConfigFromEnv({ ...env, R2_ASSETS_BUCKET: "movprompt", R2_OUTPUTS_BUCKET: "movprompt", R2_TEMPLATE_PREVIEWS_BUCKET: "movprompt", R2_TEMPLATE_PREVIEWS_BASE_URL: "" });
    expect(config.assetsBucket).toBe("movprompt");
    expect(config.outputsBucket).toBe("movprompt");
    expect(config.previewsBucket).toBe("movprompt");
  });
  it("rejects a public preview URL when customer media shares that bucket", () => {
    expect(() => r2StorageConfigFromEnv({ ...env, R2_TEMPLATE_PREVIEWS_BUCKET: env.R2_OUTPUTS_BUCKET })).toThrow("private");
  });
});
