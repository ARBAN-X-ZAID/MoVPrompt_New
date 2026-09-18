import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@movprompt/contracts": fileURLToPath(
        new URL("../../packages/contracts/src/index.ts", import.meta.url),
      ),
      "@movprompt/db": fileURLToPath(
        new URL("../../packages/db/src/index.ts", import.meta.url),
      ),
      "@movprompt/creative-engine": fileURLToPath(
        new URL("../../packages/creative-engine/src/index.ts", import.meta.url),
      ),
      "@movprompt/providers": fileURLToPath(
        new URL("../../packages/providers/src/index.ts", import.meta.url),
      ),
    },
  },
  test: {
    environment: "node",
  },
});
