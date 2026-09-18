import { createMongoDatabase, mongoConfigFromEnv } from "./mongo-client.js";
import { LAUNCH_CREATIVE_TEMPLATE_CATALOG } from "@movprompt/creative-engine";
import { ensureMongoRuntime } from "./mongo-runtime.js";

const database = createMongoDatabase(mongoConfigFromEnv(process.env));
try {
  await ensureMongoRuntime(database);
  console.info(`MovPrompt MongoDB indexes and ${LAUNCH_CREATIVE_TEMPLATE_CATALOG.length} published templates are ready`);
} finally {
  await database.close();
}
