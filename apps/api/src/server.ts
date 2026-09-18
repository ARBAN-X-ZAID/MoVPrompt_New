import { serve } from "@hono/node-server";
import { createApi } from "./app.js";
import { loadApiConfig } from "./config.js";
import { createRuntimeServices } from "./runtime-services.js";

const config = loadApiConfig();
const runtime = createRuntimeServices(config);
const app = createApi({ config, ...runtime });

const server = serve({
  fetch: app.fetch,
  port: config.port,
});

console.info(
  JSON.stringify({
    level: "info",
    message: "api_started",
    service: config.serviceName,
    version: config.version,
    port: config.port,
  }),
);

function shutdown(signal: string) {
  console.info(JSON.stringify({ level: "info", message: "api_stopping", signal }));
  server.close(async (error) => {
    if (error) {
      console.error(JSON.stringify({ level: "error", message: "api_stop_failed", error }));
      process.exitCode = 1;
    }
    try {
      await runtime.close();
    } catch (closeError) {
      console.error(
        JSON.stringify({
          level: "error",
          message: "api_runtime_close_failed",
          error: closeError instanceof Error ? closeError.message : String(closeError),
        }),
      );
      process.exitCode = 1;
    }
  });
}

process.once("SIGINT", () => shutdown("SIGINT"));
process.once("SIGTERM", () => shutdown("SIGTERM"));
