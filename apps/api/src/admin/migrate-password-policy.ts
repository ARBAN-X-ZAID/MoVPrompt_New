import { createMongoDatabase, mongoConfigFromEnv } from "@movprompt/db";
import {
  migrateOwnerPasswordPolicy,
  restoreOwnerAuthenticationPolicy,
} from "./password-policy.js";

const email = process.argv
  .find((value) => value.startsWith("--email="))
  ?.slice(8)
  .trim()
  .toLowerCase();
const restore = process.argv.includes("--restore-previous-policy");
if (!email || (!restore && !process.argv.includes("--confirm-password-only")))
  throw new Error(
    "Provide --email=<designated-owner> --confirm-password-only (or --restore-previous-policy) through protected deployment access.",
  );
const database = createMongoDatabase(mongoConfigFromEnv());
try {
  await database.connect();
  const user = await database.db.collection("users").findOne({ email });
  if (!user) throw new Error("designated_owner_not_found");
  console.info(
    JSON.stringify(
      await (
        restore ? restoreOwnerAuthenticationPolicy : migrateOwnerPasswordPolicy
      )(database, String(user._id)),
    ),
  );
} finally {
  await database.close();
}
