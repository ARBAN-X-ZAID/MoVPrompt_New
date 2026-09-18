import { createMongoDatabase, mongoConfigFromEnv } from "./mongo-client.js";
import { ensureMongoIndexes } from "./mongo-indexes.js";
import { LAUNCH_CREATIVE_TEMPLATE_CATALOG } from "@movprompt/creative-engine";
import { ensureMongoTemplateCatalog } from "./mongo-template-catalog.js";

const database = createMongoDatabase(mongoConfigFromEnv(process.env));
try {
  await database.connect();
  await ensureMongoIndexes(database);
  await ensureMongoTemplateCatalog(database, LAUNCH_CREATIVE_TEMPLATE_CATALOG, { prune: true });
  console.info(`MovPrompt MongoDB indexes and ${LAUNCH_CREATIVE_TEMPLATE_CATALOG.length} published templates are ready`);
} finally {
  await database.close();
}
