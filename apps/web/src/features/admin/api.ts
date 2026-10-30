import { z } from "zod";
import {
  AdminIdentitySchema,
  AdminListResponseSchema,
  AdminCustomerRecordsSchema,
  AdminPaymentHistorySchema,
  type AdminResource,
} from "@movprompt/contracts";
import {
  request,
  apiOrigin,
  PortableApiError,
} from "@/lib/api/portableApiClient";

const base = "/api/v1/admin";
export const adminApi = {
  identity: () => request(`${base}/identity`, AdminIdentitySchema),
  confirmPassword: (password: string) =>
    request(`${base}/confirm-password`, AdminIdentitySchema, {
      method: "POST",
      body: { password },
    }),
  assure: (code: string, mode: "totp" | "backup" = "totp") =>
    request(`${base}/assurance`, AdminIdentitySchema, {
      method: "POST",
      body: { code, mode },
    }),
  list: (resource: AdminResource, query: URLSearchParams) =>
    request(`${base}/${resource}?${query}`, AdminListResponseSchema),
  customerRecords: (
    id: string,
    resource: AdminResource,
    query: URLSearchParams,
  ) =>
    request(
      `${base}/customers/${id}/records/${resource}?${query}`,
      AdminCustomerRecordsSchema,
    ),
  payments: (query: URLSearchParams) =>
    request(`${base}/payment-history?${query}`, AdminPaymentHistorySchema),
  get: (path: string) =>
    request(`${base}/${path}`, z.record(z.string(), z.unknown())),
  mutate: (path: string, body: unknown, key: string) =>
    request(`${base}/${path}`, z.record(z.string(), z.unknown()), {
      method: "POST",
      body,
      idempotencyKey: key,
    }).catch((error) => {
      if (
        error instanceof PortableApiError &&
        error.code === "owner_step_up_required"
      )
        window.dispatchEvent(
          new Event("movprompt:admin-confirmation-required"),
        );
      throw error;
    }),
  media: (
    kind: string,
    id: string,
    photoId?: string,
    download = false,
    restricted = false,
    revision?: number,
  ) =>
    `${apiOrigin()}${base}/media/${kind}/${id}?${new URLSearchParams({ ...(photoId ? { photoId } : {}), ...(revision ? { revision: String(revision) } : {}), download: String(download), restricted: String(restricted) })}`,
};
