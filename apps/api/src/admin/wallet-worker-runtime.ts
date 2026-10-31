import { createMongoDatabase } from "@movprompt/db";
import type { AuthGateway } from "../auth-gateway.js";

/** Wallet jobs operate on already-approved records. They never authenticate users. */
export function createWalletWorkerRuntime(environment: Readonly<Record<string, string | undefined>>) {
  if (environment.ADMIN_READ_ONLY !== "true")
    throw new Error("Restricted wallet worker requires explicit read-only configuration");
  if (!environment.MONGODB_URI || !environment.MONGODB_DATABASE)
    throw new Error("Wallet worker requires database configuration");
  const database = createMongoDatabase({ uri: environment.MONGODB_URI, databaseName: environment.MONGODB_DATABASE });
  const auth: AuthGateway = {
    getSession: async () => null,
    handle: async () => new Response(null, { status: 503 }),
  };
  return { admin: { database, auth }, close: () => database.close() };
}
