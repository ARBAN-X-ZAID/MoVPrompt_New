import type { JsonObject } from "./types.js";

export const MOVPROMPT_WORKER_SERVICE_NAME = "movprompt-worker";

export type ServiceHeartbeatStatus = "starting" | "ready" | "stopping";

export interface ServiceHeartbeatRepository {
  beat(input: {
    serviceName: string;
    instanceId: string;
    status: ServiceHeartbeatStatus;
    metadata?: JsonObject;
    now?: Date;
  }): Promise<void>;
  findFreshReady(input: {
    serviceName: string;
    maxAgeSeconds: number;
    now?: Date;
  }): Promise<{ instanceId: string; metadata: JsonObject; lastSeenAt: Date } | null>;
  remove(input: { serviceName: string; instanceId: string }): Promise<void>;
}
