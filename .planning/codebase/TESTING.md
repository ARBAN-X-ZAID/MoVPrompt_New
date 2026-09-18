# Testing Patterns

**Analysis Date:** 2026-08-16

## Test Framework

**Runner:**
- Vitest 4.1.10.
- Config: `apps/web/vitest.config.ts`, `apps/api/vitest.config.ts`, `apps/worker/vitest.config.ts`, and `packages/*/vitest.config.ts` where needed.

**Assertion Library:**
- Vitest `expect`, mocks, fake timers, and snapshots where appropriate.
- Testing Library plus jest-dom for React DOM behavior.

**Run Commands:**
```bash
bun run test:all                  # All workspace tests
bun run --cwd apps/web test       # Web tests with dedicated localStorage file
bun run --cwd apps/api test       # API tests
bun run --cwd apps/worker test    # Worker tests
```

## Test File Organization

**Location:**
- Tests are primarily co-located beside source files.
- Package integration tests can live in `<package>/test/`.

**Naming:**
- `*.test.ts` and `*.test.tsx` for unit/component tests.
- `.local-setup/verify-runtime.mjs` for database-backed behavior.

**Structure:**
```text
apps/api/src/generation-service.test.ts
apps/worker/src/render-worker.postgres.test.ts
apps/web/src/features/create/projectStore.test.ts
packages/db/test/generation-service.postgres.test.ts
```

## Test Structure

**Suite Organization:**
```typescript
describe("generation service", () => {
  it("returns an idempotent existing run", async () => {
    // arrange dependencies and input
    // invoke the public service boundary
    // assert the durable state and public result
  });
});
```

**Patterns:**
- Inject repositories, clocks, fetchers, provider adapters, and storage clients.
- Test both happy path and stable error code/retryability.
- For lifecycle tests, assert database state and call counts, not only returned values.
- Reset browser storage and DOM state through `apps/web/src/test/setup.ts`.

## Mocking

**Framework:** Vitest `vi.fn`, `vi.mock`, and typed fake gateways.

**Patterns:**
```typescript
const enqueueGeneration = vi.fn(async () => "mongodb-job-id");
const now = () => new Date("2026-08-16T00:00:00.000Z");
```

**What to Mock:**
- Provider HTTP, SMTP, DNS, S3 commands, clocks, and browser navigation.
- Failure responses at each external boundary.

**What NOT to Mock:**
- Configuration hashing, Zod contracts, credit/entitlement transitions, migration order, and RLS ownership rules.
- Use a real temporary MongoDB database for those invariants.

## Fixtures and Factories

**Test Data:**
- Tests create explicit minimal users/projects/versions/quotes and stable UUIDs.
- Media tests use bounded byte fixtures and explicit MIME/checksum metadata.
- Campaign tests compile concrete English, Arabic, and bilingual briefs from `packages/creative-engine`.

**Location:**
- Most fixtures are local to the test file to keep ownership and provider assumptions visible.
- Shared browser setup is `apps/web/src/test/setup.ts`.

## Coverage

**Requirements:**
- No numeric coverage threshold is configured.
- CI enforces passing tests, typecheck, lint, builds, migration replay, RLS isolation, and the initial web JavaScript budget.

**View Coverage:**
```bash
# No repository coverage script is currently defined.
bun run test:all
```

## Test Types

**Unit Tests:**
- Contracts, configuration, pricing, prompt compilation, provider payloads, UI reducers/mappers, and interaction states.

**Integration Tests:**
- Hono route tests in `apps/api/src/*.test.ts`.
- Real MongoDB transaction, ownership, heartbeat, authentication and worker checks in `.local-setup/verify-runtime.mjs`.
- S3 boundaries are tested through typed client fakes in `packages/storage/test/`.

**E2E Tests:**
- No committed Playwright/Cypress browser E2E suite is detected.
- Rendered browser QA is therefore operational/manual rather than a repeatable CI gate.

## Common Patterns

**Async Testing:**
```typescript
await expect(service.start(input)).resolves.toMatchObject({ status: "queued" });
expect(enqueueGeneration).toHaveBeenCalledTimes(1);
```

**Error Testing:**
```typescript
await expect(operation()).rejects.toMatchObject({
  code: "quote_configuration_mismatch",
});
```

## Required Regression Strategy

- Add a focused unit test for every bug before or with the fix.
- Add MongoDB coverage for ownership, idempotency, credits, accepted-version pointers, or worker recovery changes.
- Add component tests for every auth, draft recovery, pricing, CTA/language, template media, and mobile interaction change.
- Keep live paid-provider tests explicitly guarded and excluded from default CI.

---

*Testing analysis: 2026-08-16*
