import type { QueryClient } from "@tanstack/react-query";
import { PortableApiError } from "@/lib/api/portableApiClient";

/** Scoped to admin queries: the shared client also serves the customer app. */
export function configureAdminQueries(client: QueryClient) {
  client.setQueryDefaults(["admin"], {
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    retry: (failures, error) => failures < 1 && error instanceof PortableApiError && error.retryable,
  });
}

/** Refreshes data after a change without re-checking identity or blocking the dialog that made it. */
export function invalidateAdminData(client: QueryClient) {
  void client.invalidateQueries({ queryKey: ["admin"], predicate: query => query.queryKey[1] !== "identity" });
}
