import { createHash } from "node:crypto";
import {
  MongoClient,
  ObjectId,
  type ClientSession,
  type Collection,
  type Document,
} from "mongodb";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const OBJECT_ID_PATTERN = /^[0-9a-f]{24}$/i;
const OBJECT_ID_REFERENCE_FIELDS = new Set([
  "userId",
  "projectId",
  "projectVersionId",
  "templateId",
  "templateVersionId",
  "parentVersionId",
  "currentWorkingVersionId",
  "currentAcceptedVersionId",
  "latestRenderRunId",
  "latestRenderProjectVersionId",
  "runId",
  "renderRunId",
  "quoteId",
  "claimOperationId",
]);

export function newMongoObjectId(): string {
  return new ObjectId().toHexString();
}

/**
 * Converts API-facing identifiers to native MongoDB ObjectIds. Legacy UUIDs
 * are mapped deterministically so browser drafts created before this cutover
 * can still be claimed without persisting a second identifier field.
 */
export function toMongoObjectId(value: string | ObjectId): ObjectId {
  if (value instanceof ObjectId) return value;
  if (OBJECT_ID_PATTERN.test(value)) return new ObjectId(value);
  if (UUID_PATTERN.test(value)) {
    return new ObjectId(createHash("sha256").update(value.toLowerCase()).digest().subarray(0, 12));
  }
  throw new Error("Invalid MongoDB identifier");
}

export function mongoObjectIdString(value: unknown): string {
  if (value instanceof ObjectId) return value.toHexString();
  if (typeof value === "string" && OBJECT_ID_PATTERN.test(value)) return value.toLowerCase();
  throw new Error("Invalid MongoDB identifier");
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function storageValue(value: unknown, fieldName?: string): unknown {
  if (value === null || value === undefined || value instanceof Date || value instanceof ObjectId) return value;
  if (Array.isArray(value)) return value.map((item) => storageValue(item, fieldName));
  if (fieldName && OBJECT_ID_REFERENCE_FIELDS.has(fieldName) && typeof value === "string") {
    return toMongoObjectId(value);
  }
  if (!isPlainObject(value)) return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, storageValue(item)]));
}

export function mongoDocumentForStorage(document: Document): Document {
  const stored: Document = {};
  for (const [key, value] of Object.entries(document)) {
    if (key === "id") {
      stored._id = toMongoObjectId(String(value));
    } else {
      stored[key] = storageValue(value, key);
    }
  }
  return stored;
}

function mongoFilterForStorage(filter: Document): Document {
  const stored: Document = {};
  for (const [key, value] of Object.entries(filter)) {
    if (key === "id") {
      stored._id = storageValue(value, "_id") instanceof ObjectId
        ? storageValue(value, "_id")
        : Array.isArray(value)
          ? storageValue(value, "_id")
          : typeof value === "string"
            ? toMongoObjectId(value)
            : operatorIdentifierValue(value);
      continue;
    }
    if (key === "$or" || key === "$and" || key === "$nor") {
      stored[key] = Array.isArray(value) ? value.map((item) => mongoFilterForStorage(item as Document)) : value;
      continue;
    }
    if (key.startsWith("$")) {
      stored[key] = storageValue(value);
      continue;
    }
    const fieldName = key.split(".").at(-1)!;
    stored[key] = OBJECT_ID_REFERENCE_FIELDS.has(fieldName)
      ? operatorIdentifierValue(value)
      : storageValue(value, fieldName);
  }
  return stored;
}

function operatorIdentifierValue(value: unknown): unknown {
  if (typeof value === "string") return toMongoObjectId(value);
  if (value instanceof ObjectId || value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map(operatorIdentifierValue);
  if (!isPlainObject(value)) return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, key.startsWith("$") ? operatorIdentifierValue(item) : storageValue(item, key)]));
}

function mongoUpdateForStorage(update: Document): Document {
  if (!Object.keys(update).some((key) => key.startsWith("$"))) return mongoDocumentForStorage(update);
  return Object.fromEntries(Object.entries(update).map(([operator, value]) => {
    if (!isPlainObject(value)) return [operator, value];
    if (operator === "$setOnInsert") return [operator, mongoDocumentForStorage(value)];
    return [operator, Object.fromEntries(Object.entries(value).flatMap(([key, item]) => {
      if (key === "id") return [];
      const fieldName = key.split(".").at(-1)!;
      return [[key, OBJECT_ID_REFERENCE_FIELDS.has(fieldName) ? operatorIdentifierValue(item) : storageValue(item, fieldName)]];
    }))];
  }));
}

function mongoOptionsForStorage(options: unknown): unknown {
  if (!isPlainObject(options)) return options;
  const mapped = { ...options };
  for (const name of ["projection", "sort"] as const) {
    if (isPlainObject(mapped[name])) {
      mapped[name] = Object.fromEntries(Object.entries(mapped[name]).map(([key, value]) => [key === "id" ? "_id" : key, value]));
    }
  }
  return mapped;
}

export function mongoDocumentFromStorage<T>(value: T): T {
  if (value instanceof ObjectId) return value.toHexString() as T;
  if (Array.isArray(value)) return value.map((item) => mongoDocumentFromStorage(item)) as T;
  if (!isPlainObject(value)) return value;
  const document: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    document[key === "_id" ? "id" : key] = mongoDocumentFromStorage(item);
  }
  return document as T;
}

function mappedCursor<T extends Document>(cursor: T): T {
  return new Proxy(cursor, {
    get(target, property, receiver) {
      if (property === "toArray") return async () => mongoDocumentFromStorage(await (target as unknown as { toArray(): Promise<unknown[]> }).toArray());
      if (property === "next") return async () => mongoDocumentFromStorage(await (target as unknown as { next(): Promise<unknown> }).next());
      const member = Reflect.get(target, property, target);
      if (typeof member !== "function") return member;
      return (...args: unknown[]) => {
        const mappedArgs = property === "sort" && isPlainObject(args[0])
          ? [mongoOptionsForStorage({ sort: args[0] }) as { sort: Document }, ...args.slice(1)]
          : args;
        if (property === "sort" && isPlainObject(mappedArgs[0]) && "sort" in mappedArgs[0]) mappedArgs[0] = (mappedArgs[0] as { sort: Document }).sort;
        const result = (member as (...values: unknown[]) => unknown).apply(target, mappedArgs);
        return result === target ? receiver : result;
      };
    },
  }) as T;
}

function mappedCollection<T extends Document>(collection: Collection<T>): Collection<T> {
  return new Proxy(collection, {
    get(target, property) {
      const member = Reflect.get(target, property, target);
      if (typeof member !== "function") return member;
      if (property === "find") return (filter: Document = {}, options?: Document) => mappedCursor(member.call(target, mongoFilterForStorage(filter), mongoOptionsForStorage(options)));
      if (property === "findOne") return async (filter: Document = {}, options?: Document) => mongoDocumentFromStorage(await member.call(target, mongoFilterForStorage(filter), mongoOptionsForStorage(options)));
      if (property === "findOneAndUpdate") return async (filter: Document, update: Document, options?: Document) => mongoDocumentFromStorage(await member.call(target, mongoFilterForStorage(filter), mongoUpdateForStorage(update), mongoOptionsForStorage(options)));
      if (property === "insertOne") return (document: Document, options?: Document) => member.call(target, mongoDocumentForStorage(document), options);
      if (property === "insertMany") return (documents: Document[], options?: Document) => member.call(target, documents.map(mongoDocumentForStorage), options);
      if (property === "updateOne" || property === "updateMany") return (filter: Document, update: Document, options?: Document) => member.call(target, mongoFilterForStorage(filter), mongoUpdateForStorage(update), options);
      if (property === "countDocuments" || property === "deleteOne" || property === "deleteMany") return (filter: Document = {}, options?: Document) => member.call(target, mongoFilterForStorage(filter), options);
      if (property === "createIndex") return (keys: Document, options?: Document) => member.call(target, mongoFilterForStorage(keys), options);
      if (property === "bulkWrite") return (operations: Document[], options?: Document) => member.call(target, operations.map((operation) => {
        if (operation.updateOne) return { updateOne: { ...operation.updateOne, filter: mongoFilterForStorage(operation.updateOne.filter), update: mongoUpdateForStorage(operation.updateOne.update) } };
        if (operation.insertOne) return { insertOne: { document: mongoDocumentForStorage(operation.insertOne.document) } };
        return operation;
      }), options);
      return member.bind(target);
    },
  });
}

export const COLLECTIONS = {
  users: "users",
  sessions: "sessions",
  accounts: "accounts",
  verifications: "verifications",
  videoTemplates: "video_templates",
  videoTemplateVersions: "video_template_versions",
  creatorProjects: "creator_projects",
  creatorProjectVersions: "creator_project_versions",
  creatorProjectAssets: "creator_project_assets",
  guestClaimOperations: "guest_claim_operations",
  guestClaimAssets: "guest_claim_assets",
  requestRateLimits: "request_rate_limits",
  generationQuotes: "generation_quotes",
  renderRuns: "render_runs",
  renderAttempts: "render_attempts",
  entitlements: "entitlements",
  creditAccounts: "credit_accounts",
  creditReservations: "credit_reservations",
  creditLedger: "credit_ledger",
  exports: "exports",
  paymentBundles: "payment_bundles",
  paymentOrders: "payment_orders",
  paymentAttempts: "payment_attempts",
  paymentRefunds: "payment_refunds",
  paymentEvents: "payment_events",
  notifications: "notifications",
  auditLogs: "audit_logs",
  outboxJobs: "outbox_jobs",
  serviceHeartbeats: "service_heartbeats",
  workerJobs: "worker_jobs",
} as const;

export interface MongoDatabaseConfig {
  uri: string;
  databaseName: string;
  applicationName?: string;
  maxPoolSize?: number;
}

export type MongoSessionOperation<T> = (session: ClientSession) => Promise<T>;

export class MongoDatabase {
  readonly client: MongoClient;
  readonly databaseName: string;

  constructor(config: MongoDatabaseConfig) {
    if (!config.uri.trim()) throw new Error("MONGODB_URI is required");
    if (!config.databaseName.trim()) throw new Error("MONGODB_DATABASE is required");
    this.databaseName = config.databaseName;
    this.client = new MongoClient(config.uri, {
      appName: config.applicationName ?? "movprompt",
      maxPoolSize: config.maxPoolSize ?? 20,
      retryReads: true,
      retryWrites: true,
    });
  }

  get db() {
    return this.client.db(this.databaseName);
  }

  collection<T extends Document = Document>(name: string): Collection<T> {
    return mappedCollection(this.db.collection<T>(name));
  }

  async connect(): Promise<void> {
    await this.client.connect();
    await this.db.command({ ping: 1 });
  }

  async transaction<T>(operation: MongoSessionOperation<T>): Promise<T> {
    return this.client.withSession((session) => session.withTransaction(
      () => operation(session),
      {
        readConcern: { level: "snapshot" },
        writeConcern: { w: "majority" },
        readPreference: "primary",
      },
    ));
  }

  async close(): Promise<void> {
    await this.client.close();
  }
}

export function mongoConfigFromEnv(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): MongoDatabaseConfig {
  const uri = environment.MONGODB_URI?.trim();
  if (!uri) throw new Error("MONGODB_URI is required");
  const databaseName = environment.MONGODB_DATABASE?.trim() || "movprompt";
  const maxPoolSize = environment.MONGODB_POOL_MAX ? Number(environment.MONGODB_POOL_MAX) : undefined;
  if (maxPoolSize !== undefined && (!Number.isSafeInteger(maxPoolSize) || maxPoolSize < 1)) {
    throw new Error("MONGODB_POOL_MAX must be a positive integer");
  }
  return {
    uri,
    databaseName,
    ...(environment.MONGODB_APPLICATION_NAME?.trim()
      ? { applicationName: environment.MONGODB_APPLICATION_NAME.trim() }
      : {}),
    ...(maxPoolSize === undefined ? {} : { maxPoolSize }),
  };
}

export function createMongoDatabase(config: MongoDatabaseConfig): MongoDatabase {
  return new MongoDatabase(config);
}
