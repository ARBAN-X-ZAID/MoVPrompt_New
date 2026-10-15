import { CUSTOM_FORM_TEMPLATE_CATALOG } from "../packages/creative-engine/src/index.js";
import { createMongoDatabase, mongoConfigFromEnv, mongoTemplateCatalogDocuments, ensureMongoTemplateCatalog } from "../packages/db/src/index.js";

// The default is an offline manifest. Production publication needs preview review.
if (!process.argv.includes("--apply-local")) {
  const documents = mongoTemplateCatalogDocuments(CUSTOM_FORM_TEMPLATE_CATALOG, new Date("2026-10-14T00:00:00Z"));
  console.log(JSON.stringify({ mode: "dry-run", existingTemplatesChanged: 0, templates: documents.templates, versions: documents.versions }, null, 2));
} else {
  const config = mongoConfigFromEnv();
  const uri = new URL(config.uri);
  if (!["127.0.0.1", "localhost", "[::1]"].includes(uri.hostname) || !config.databaseName.endsWith("_product_model_ad_test")) throw new Error("Use an isolated local database ending in _product_model_ad_test.");
  const database = createMongoDatabase(config);
  try {
    await database.connect();
    await ensureMongoTemplateCatalog(database, CUSTOM_FORM_TEMPLATE_CATALOG);
    console.log("Published the new template to the isolated local database only.");
  } finally { await database.close(); }
}
