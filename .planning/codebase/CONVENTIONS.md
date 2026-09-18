# Coding Conventions

**Analysis Date:** 2026-08-16

## Naming Patterns

**Files:**
- Use PascalCase for React components/pages: `AuthGateDialog.tsx`, `CreatorProjects.tsx`.
- Use descriptive kebab-case for server/domain modules: `generation-service.ts`, `output-persister.ts`.
- Existing web feature helpers also use lower camel filenames: `guestDraftStore.ts`, `portableProjectMapper.ts`; match the surrounding directory.

**Functions:**
- Use lower camel case with action-oriented names: `createGenerationService`, `registerGenerationRoutes`, `loadApiConfig`.
- Factory functions begin with `create`; validation functions use `assert`, `parse`, `validate`, or schema names.

**Variables:**
- Use lower camel case.
- Use `SCREAMING_SNAKE_CASE` for module-level constants such as entitlement types and limits.

**Types:**
- Use PascalCase for interfaces, type aliases, schemas, and error classes.
- Suffix Zod schemas with `Schema`, repositories with `Repository`, services with `Service`, and input shapes with `Input`.

## Code Style

**Formatting:**
- TypeScript modules use semicolons, double-quoted imports/strings, trailing commas, and two-space indentation.
- No standalone Prettier configuration is detected; preserve local formatting and rely on TypeScript/ESLint checks.

**Linting:**
- ESLint 9 flat config in `eslint.config.js`.
- React Hooks recommended rules are errors.
- Fast Refresh export warnings remain warnings.
- Web legacy boundaries temporarily permit explicit `any`, empty object types, `require`, and TypeScript suppression while portable migration progresses.

## Import Organization

**Order:**
1. External/workspace package imports.
2. Blank line.
3. Relative module imports.
4. Type-only imports use `import type` when practical.

**Path Aliases:**
- Web uses `@/` for `apps/web/src/` through `apps/web/vite.config.ts` and TypeScript config.
- Server workspaces use package imports such as `@movprompt/db` and relative `.js` extensions for ESM output.

## Error Handling

**Patterns:**
- Parse all untrusted payloads with Zod before use.
- Throw domain-specific errors with stable codes and retryability rather than leaking raw provider responses.
- API maps internal errors to a shared envelope containing code, message, retryability, and request ID.
- Worker classifies pre-acceptance versus post-acceptance failures so reservations/refunds remain correct.
- Catch blocks must not silently convert failures into success states.

## Logging

**Framework:** Custom structured logger plus bounded `console` use.

**Patterns:**
- Include request ID, job ID, run ID, and worker ID where available.
- Do not log secrets, signed URLs, raw OAuth tokens, or full provider payloads.
- Sanitize provider usage metadata before persistence.

## Comments

**When to Comment:**
- Explain invariants, provider quirks, security boundaries, and exactly-once behavior.
- Avoid narrating obvious JSX or CRUD operations.

**JSDoc/TSDoc:**
- Used selectively for public services and security-critical helpers, for example `packages/db/src/user-transaction.ts` and `packages/providers/src/vercel-gateway-seedance.ts`.

## Function Design

**Size:**
- Prefer small validators/factories around a composed service, but several legacy web files exceed 1,000 lines; do not copy that pattern into new modules.

**Parameters:**
- Service methods accept a single typed input object.
- Runtime factories accept explicit dependency objects to support isolated tests.

**Return Values:**
- API/domain functions return typed records or discriminated status objects.
- Optional values are omitted rather than assigned `undefined` where `exactOptionalPropertyTypes` applies.

## Module Design

**Exports:**
- Shared packages export public surfaces from `src/index.ts`.
- Internal helpers remain file-local unless tests or adjacent modules require them.

**Barrel Files:**
- Use package-level barrels, not deep web-component barrels.
- Preserve `.js` extension imports in TypeScript server packages so built ESM works in Node.

## Security and Data Rules

- Never persist signed URLs; persist bucket/object keys.
- Every authenticated mutation must run through owner predicates and `withUserTransaction` where applicable.
- Every mutation endpoint must accept/validate an idempotency key when repetition can charge or duplicate state.
- Provider model IDs remain in server configuration, not public request bodies.
- Guest blobs stay in IndexedDB until server upload and checksum verification succeed.

---

*Convention analysis: 2026-08-16*
