import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { writeFile, readFile } from "node:fs/promises";
import { parseEnv } from "node:util";
import { fileURLToPath } from "node:url";
import { S3Client, HeadBucketCommand, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { MongoClient } from "mongodb";

const root = fileURLToPath(new URL("../", import.meta.url));
const env = parseEnv(await readFile(`${root}.env.infrastructure`, "utf8"));
assert.equal(env.COMPOSE_PROJECT_NAME, "movprompt-local");
const result = { checkedAt: new Date().toISOString(), scope: "local, synthetic data, generation disabled" };
const mongo = new MongoClient(env.MONGODB_URI);
try {
  await mongo.connect();
  const database = mongo.db(env.MONGODB_DATABASE);
  const hello = await database.admin().command({ hello: 1 });
  assert.equal(hello.setName, "rs0");
  assert.equal(hello.isWritablePrimary, true);
  await mongo.withSession((session) => session.withTransaction(async () => {
    await database.collection("runtime_verification").insertOne({ id: randomUUID(), createdAt: new Date() }, { session });
    await database.collection("runtime_verification").deleteMany({}, { session });
  }));
  result.mongodb = "replica set primary and transaction round trip passed";
} finally {
  await mongo.close();
}
for (const path of ["/healthz", "/api/v1/health", "/api/v1/feature-flags"]) {
  const response = await fetch(`http://localhost:8787${path}`, { signal: AbortSignal.timeout(10_000) });
  assert.equal(response.status, 200, path);
  const body = await response.json();
  if (path.endsWith("feature-flags")) assert.equal(body.features.generation, false);
  result[path] = "passed";
}
const id = randomUUID();
const email = `local-setup-${id}@example.test`;
const password = `Local-${randomUUID()}!`;
const signup = await fetch("http://localhost:8787/api/auth/sign-up/email", {
  method: "POST",
  headers: { "Content-Type": "application/json", Origin: "http://localhost:8080" },
  body: JSON.stringify({ name: "Local setup verification", email, password }),
});
assert.equal(signup.status, 200, "local email/password signup");
const cookies = signup.headers.getSetCookie().map((value) => value.split(";", 1)[0]).join("; ");
assert.ok(cookies, "signup sets a session cookie");
const session = await fetch("http://localhost:8787/api/auth/get-session", { headers: { Cookie: cookies, Origin: "http://localhost:8080" } });
assert.equal(session.status, 200);
assert.equal((await session.json()).user.email, email);
result.authentication = "signup and session round trip passed with synthetic local account";
const projects = await fetch("http://localhost:8787/api/v1/projects", { headers: { Cookie: cookies, Origin: "http://localhost:8080" } });
assert.equal(projects.status, 200, "owner-scoped MongoDB project list");
assert.ok(Array.isArray((await projects.json()).projects));
result.projects = "authenticated owner-scoped MongoDB project read passed";
const mail = await fetch("http://localhost:8025/api/v1/messages");
assert.equal(mail.status, 200);
const messages = await mail.json();
assert.ok(messages.messages?.some((message) => message.To?.some((recipient) => recipient.Address === email)), "verification email captured locally");
result.email = "verification email captured in Mailpit";
const s3 = new S3Client({ endpoint: "http://127.0.0.1:9000", region: env.S3_REGION, forcePathStyle: true,
  credentials: { accessKeyId: env.S3_ACCESS_KEY_ID, secretAccessKey: env.S3_SECRET_ACCESS_KEY } });
for (const Bucket of [env.S3_ASSETS_BUCKET, env.S3_OUTPUTS_BUCKET, env.S3_PREVIEWS_BUCKET]) {
  await s3.send(new HeadBucketCommand({ Bucket }));
}
const Bucket = env.S3_ASSETS_BUCKET;
const Key = `local-setup-verification/${id}.txt`;
try {
  await s3.send(new PutObjectCommand({ Bucket, Key, Body: "synthetic local storage verification", ContentType: "text/plain" }));
  const object = await s3.send(new GetObjectCommand({ Bucket, Key }));
  assert.equal(await object.Body.transformToString(), "synthetic local storage verification");
  const anonymous = await fetch(`http://127.0.0.1:9000/${Bucket}/${Key}`);
  assert.equal(anonymous.status, 403, "bucket must remain private");
  result.storage = "three private buckets reachable; authenticated write/read and anonymous denial passed";
} finally {
  await s3.send(new DeleteObjectCommand({ Bucket, Key }));
  s3.destroy();
}
await writeFile(`${root}.local-setup/runtime-verification.json`, JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
