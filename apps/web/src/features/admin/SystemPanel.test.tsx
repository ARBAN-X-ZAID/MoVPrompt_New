import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { it, expect, vi } from "vitest";
vi.mock("@/i18n/LanguageContext", () => ({
  useLanguage: () => ({ locale: "en" }),
}));
vi.mock("./api", () => ({
  adminApi: {
    get: async () => ({
      checks: [
        {
          key: "backup-recovery",
          state: "unavailable",
          stale: true,
          source: "admin_backup_evidence",
          evaluatedAt: "2026-10-28T00:00:00Z",
          observed: { evidence: null },
        },
      ],
      alerts: [],
      backupPolicy: { approved: false },
      lastLocalDrill: null,
    }),
  },
}));
import { SystemPanel } from "./SystemPanel";
it("renders stale checks and missing production evidence without presenting a successful backup or zero cost", async () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <SystemPanel />
    </QueryClientProvider>,
  );
  expect(
    await screen.findByRole("heading", {
      name: "Production backup and recovery",
    }),
  ).toBeVisible();
  expect(screen.getByText("Unavailable")).toBeVisible();
  expect(
    screen.getByText("Stale result · waiting for a new worker check"),
  ).toBeVisible();
  expect(screen.queryByText("Within limits")).toBeNull();
  client.clear();
});
