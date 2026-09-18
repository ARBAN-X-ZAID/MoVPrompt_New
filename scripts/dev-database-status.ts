import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI?.trim();

if (!uri) {
  console.warn("[MovPrompt] Database not connected: MONGODB_URI is missing from .env");
  process.exit(0);
}

let client: MongoClient | null = null;

try {
  client = new MongoClient(uri, {
    connectTimeoutMS: 3_000,
    serverSelectionTimeoutMS: 3_000,
  });
  await client.connect();
  await client.db().command({ ping: 1 });
  console.log("[MovPrompt] Database connected: MongoDB is ready");
} catch (error) {
  const message = error instanceof Error
    ? error.message.split("\n")[0]!.replaceAll(uri, "[redacted]")
    : "Unknown connection error";
  console.warn(`[MovPrompt] Database not connected: ${message}`);
} finally {
  await client?.close().catch(() => undefined);
}
