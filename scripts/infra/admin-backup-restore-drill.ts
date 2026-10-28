import { writeFile } from "node:fs/promises";
import { R2Storage, r2StorageConfigFromEnv } from "../../packages/storage/src/index.ts";
import { createMongoDatabase } from "../../packages/db/src/index.ts";
import { createAssetStorageGateway } from "../../apps/api/src/asset-storage.ts";
import { runIsolatedAdminBackupDrill } from "../../apps/api/src/admin/backup-drill.ts";
const uri = process.env.ADMIN_TEST_MONGODB_URI;
if (!uri || process.env.ADMIN_REAL_STORAGE_TEST !== "true") throw new Error("Explicit local ADMIN_TEST_MONGODB_URI and ADMIN_REAL_STORAGE_TEST=true are required.");
const evidence = await runIsolatedAdminBackupDrill(uri, createAssetStorageGateway(new R2Storage(r2StorageConfigFromEnv(process.env))));
const path = process.argv[2];
if (path) await writeFile(path, JSON.stringify(evidence, null, 2) + "\n", { mode: 0o600 });
const receiptDatabase = process.env.ADMIN_DRILL_RECEIPT_DATABASE;
if (receiptDatabase) {
  if (!/^movprompt_admin_ui_test$/.test(receiptDatabase)) throw new Error("The optional receipt target must be the local UI fixture database.");
  const database = createMongoDatabase({ uri, databaseName: receiptDatabase });
  try { await database.connect(); await database.db.collection("admin_backup_evidence").insertOne(evidence); }
  finally { await database.close(); }
}
console.info(JSON.stringify(evidence));
