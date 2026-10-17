import { createRequire } from "node:module";
const requireApi = createRequire(new URL("../../../apps/api/package.json", import.meta.url));
const { Hono } = await import(requireApi.resolve("hono"));
const { cors } = await import(requireApi.resolve("hono/cors"));
import { R2Storage, r2StorageConfigFromEnv } from "../../../packages/storage/src/index.ts";
import { registerTemplatePreviewRoutes } from "../../../apps/api/src/template-preview-routes.ts";
// Read-only public preview routes only: no database, workers, auth or generation endpoints.
const app = new Hono();
app.use("*", cors({ origin: "http://127.0.0.1:8188" }));
registerTemplatePreviewRoutes(app as never, new R2Storage(r2StorageConfigFromEnv()));
Bun.serve({ hostname: "127.0.0.1", port: 18081, fetch: app.fetch });
console.log("Read-only template preview server: 127.0.0.1:18081");
