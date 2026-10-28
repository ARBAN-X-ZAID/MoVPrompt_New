import { readFile } from "node:fs/promises";
import { describe, it, expect } from "vitest";
import { legacyAdminCutover } from "../../../../supabase/functions/_shared/legacy-admin-cutover.ts";
describe("legacy admin retirement", () => {
  it("refuses legacy admin operations regardless of supplied role/auth headers", async () => {
    const response = legacyAdminCutover(
      new Request("https://legacy.example/admin", {
        method: "POST",
        headers: { authorization: "Bearer synthetic-legacy-role" },
      }),
    );
    expect(response?.status).toBe(410);
    expect(await response?.json()).toMatchObject({
      code: "legacy_admin_retired",
    });
    expect(
      legacyAdminCutover(
        new Request("https://legacy.example/admin", { method: "OPTIONS" }),
      ),
    ).toBeNull();
  });
  it("guards every retired edge entry before its legacy handler", async () => {
    for (const name of [
      "admin-delete-user",
      "admin-revoke-all-sessions",
      "admin-resend-welcome",
      "admin-list-users-meta",
      "admin-send-password-reset",
      "admin-force-signout",
      "toggle-user-status",
      "generate-preset-preview",
    ]) {
      const text = await readFile(
        new URL(
          `../../../../supabase/functions/${name}/index.ts`,
          import.meta.url,
        ),
        "utf8",
      );
      expect(text).toContain("import { legacyAdminCutover }");
      expect(text).toMatch(
        /Deno\.serve\(async \(req\) => \{\s*const retired = legacyAdminCutover\(req\);\s*if \(retired\) return retired;/,
      );
    }
  });
});
