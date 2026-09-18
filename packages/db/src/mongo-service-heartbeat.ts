import { COLLECTIONS, type MongoDatabase } from "./mongo-client.js";
import type { JsonObject } from "./types.js";
import type { ServiceHeartbeatRepository } from "./service-heartbeat.js";

export function createMongoServiceHeartbeatRepository(database: MongoDatabase): ServiceHeartbeatRepository {
  const heartbeats = database.collection(COLLECTIONS.serviceHeartbeats);
  return {
    async beat(input) {
      const now = input.now ?? new Date();
      await heartbeats.updateOne(
        { serviceName: input.serviceName, instanceId: input.instanceId },
        {
          $set: { status: input.status, metadata: input.metadata ?? {}, lastSeenAt: now, updatedAt: now },
          $setOnInsert: { startedAt: now },
        },
        { upsert: true },
      );
    },
    async findFreshReady(input) {
      if (!Number.isSafeInteger(input.maxAgeSeconds) || input.maxAgeSeconds < 1) throw new Error("service_heartbeat_max_age_invalid");
      const cutoff = new Date((input.now ?? new Date()).getTime() - input.maxAgeSeconds * 1_000);
      const row = await heartbeats.findOne(
        { serviceName: input.serviceName, status: "ready", lastSeenAt: { $gt: cutoff } },
        { sort: { lastSeenAt: -1 } },
      );
      return row ? {
        instanceId: String(row.instanceId),
        metadata: (row.metadata ?? {}) as JsonObject,
        lastSeenAt: row.lastSeenAt as Date,
      } : null;
    },
    async remove(input) {
      await heartbeats.deleteOne({ serviceName: input.serviceName, instanceId: input.instanceId });
    },
  };
}
