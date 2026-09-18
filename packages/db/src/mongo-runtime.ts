import { LAUNCH_CREATIVE_TEMPLATE_CATALOG } from "@movprompt/creative-engine";
import type { MongoDatabase } from "./mongo-client.js";
import { ensureMongoIndexes } from "./mongo-indexes.js";
import { ensureMongoTemplateCatalog } from "./mongo-template-catalog.js";

export async function ensureMongoRuntime(database: MongoDatabase): Promise<void> {
  await database.connect();
  await ensureMongoIndexes(database);
  await ensureMongoTemplateCatalog(database, LAUNCH_CREATIVE_TEMPLATE_CATALOG, { prune: true });
}
