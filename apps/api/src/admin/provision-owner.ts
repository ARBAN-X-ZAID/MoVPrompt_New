import { readFileSync } from "node:fs";
import {
  createMongoDatabase,
  mongoConfigFromEnv,
  designateOwnerAccount,
} from "@movprompt/db";
import { authEnvironmentFromEnv, createMovPromptAuth } from "@movprompt/auth";
import { createAuthEmailDeliveryFromEnv } from "../email.js";
import { ensureAdminIndexes } from "./security.js";

const email = process.argv
  .find((value) => value.startsWith("--email="))
  ?.slice(8)
  .trim()
  .toLowerCase();
if (!email || !process.argv.includes("--confirm-owner-provision"))
  throw new Error(
    "Use protected deployment access: admin:provision --email=<owner-email> --confirm-owner-provision. Supply a new-account password through stdin only. Existing passwords are never overwritten.",
  );
const database = createMongoDatabase(mongoConfigFromEnv());
try {
  await database.connect();
  await ensureAdminIndexes(database);
  const designated = await database.db
    .collection("admin_owners")
    .findOne({ role: "owner" });
  if (designated) {
    const designatedUser = await database.db
      .collection("users")
      .findOne({ _id: designated.userId });
    if (designatedUser?.email?.toLowerCase() !== email)
      throw new Error("another_owner_is_already_designated");
  }
  let user = await database.db
    .collection("users")
    .findOne({ email }, { collation: { locale: "en", strength: 2 } });
  let created = false;
  if (!user) {
    const password = readFileSync(0, "utf8").trimEnd();
    if (password.length < 10 || password.length > 128)
      throw new Error("A 10–128 character password is required through stdin.");
    const auth = createMovPromptAuth({
      db: database,
      environment: authEnvironmentFromEnv(),
      sendEmail: createAuthEmailDeliveryFromEnv().sendEmail,
    });
    await auth.api.signUpEmail({
      body: { email, password, name: "MovPrompt owner" },
    });
    user = await database.db.collection("users").findOne({ email });
    if (!user) throw new Error("owner_account_creation_failed");
    created = true;
    // The CLI cannot hand an authenticated browser session to anyone.
    await database.db.collection("sessions").deleteMany({ userId: user._id });
  }
  const result = await designateOwnerAccount(database, String(user._id), {
    loginMode: process.argv.includes("--allow-unverified-email-login")
      ? "designated-email-password"
      : "verified-email",
  });
  console.info(JSON.stringify({ accountCreated: created, ...result }));
} finally {
  await database.close();
}
