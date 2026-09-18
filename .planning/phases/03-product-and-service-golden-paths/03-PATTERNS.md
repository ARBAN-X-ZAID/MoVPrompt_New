# Phase 3: Product and Service Golden Paths - Pattern Map

**Mapped:** 2026-08-20  
**Files analyzed:** 18 likely new or modified files  
**Analogs found:** 18 / 18

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match quality |
|---|---|---|---|---|
| `packages/contracts/src/creator.ts` | contract/schema | request-response, transform | existing `packages/contracts/src/creator.ts` | exact extension |
| `apps/web/src/features/create/types.ts` | model | transform | existing `types.ts` | exact extension |
| `apps/web/src/features/create/contracts.ts` | draft contract/mapper | CRUD, transform | existing `contracts.ts` | exact extension |
| `apps/web/src/features/create/sourceFacts.ts` | utility | transform | `guestClaimSnapshot.ts` | role-match |
| `apps/web/src/features/create/templateRecommendations.ts` | utility | transform | `TemplateGrid.tsx` filtering/grouping and `creative-engine/catalog.ts` | role-match |
| `apps/web/src/features/create/SourceChoiceStep.tsx` | component | request-response | source area of `CreateStudio.tsx` | partial, extract from monolith |
| `apps/web/src/features/create/FactReviewStep.tsx` | component | CRUD, transform | details/review area of `CreateStudio.tsx` | partial, extract from monolith |
| `apps/web/src/features/create/OutcomeStep.tsx` | component | transform | `TemplateGrid.tsx` filter controls | role-match |
| `apps/web/src/features/create/TemplateRecommendations.tsx` | component | request-response, transform | `TemplateGrid.tsx` | exact conceptual match |
| `apps/web/src/features/create/CampaignSetupStep.tsx` | component | CRUD | details form of `CreateStudio.tsx` | partial, extract from monolith |
| `apps/web/src/features/create/CampaignReviewStep.tsx` | component | transform, request-response | summary/quote area of `CreateStudio.tsx` | partial, extract from monolith |
| `apps/web/src/features/create/TemplateGrid.tsx` | component | request-response | existing `TemplateGrid.tsx` | exact modification |
| `apps/web/src/features/create/TemplatePreviewDialog.tsx` | component | request-response | existing `TemplatePreviewDialog.tsx` | exact modification |
| `apps/web/src/features/create/CreateStudio.tsx` | controller/component | CRUD, request-response | existing `CreateStudio.tsx` | exact refactor |
| `apps/web/src/features/create/creator.css` | styling/config | transform | existing `creator.css` | exact extension |
| `apps/web/src/features/create/*.test.tsx` | test | request-response, transform | `TemplateGrid.test.tsx` | exact pattern |
| `apps/web/src/features/create/__tests__/creatorContracts.test.ts` | test | transform | existing `creatorContracts.test.ts` | exact extension |
| `apps/api/src/source-scanner.ts` / `creator-routes.ts` tests | service/route test | request-response | `source-scanner.test.ts`, `creator-routes.test.ts` | exact extension |

## Pattern Assignments

### `packages/contracts/src/creator.ts` (contract/schema, request-response)

**Analog:** the existing creator contract, especially source kind and campaign enum declarations at [creator.ts](/Users/muhammadzaid/Desktop/Projects/moveprompts/packages/contracts/src/creator.ts:6), public template metadata at [creator.ts](/Users/muhammadzaid/Desktop/Projects/moveprompts/packages/contracts/src/creator.ts:62), and source facts at [creator.ts](/Users/muhammadzaid/Desktop/Projects/moveprompts/packages/contracts/src/creator.ts:295).

**Schema style to copy** (lines 9-16, 21-40):

```ts
export const CampaignSourceKindSchema = z.enum([
  "product_url",
  "business_url",
  "product_upload",
  "service_manual",
  "real_footage",
]);
export type CampaignSourceKind = z.infer<typeof CampaignSourceKindSchema>;
```

**Fact/provenance pattern to extend** (lines 299-315):

```ts
export const ConfirmedFactSchema = z
  .object({
    field: z.enum(["name", "description", "price", "offer", "location", "booking_url", "whatsapp", "logo", "brand_color"]),
    value: z.string().trim().min(1).max(2_000),
    provenance: z.enum(["imported", "user_confirmed", "manual"]),
  })
  .strict();
```

**Apply:** Promote `ConfirmedFactSchema` into the single campaign fact collection rather than creating a product-only or business-only top-level shape. Add only enum values supported by the Phase 3 review contract (such as `brand`, service detail) and preserve `.strict()`, bounded strings, and portable serializable values. Extend `CampaignGoalSchema` with the locked nine outcomes before implementing UI labels; do not add browser-only goal strings.

### `apps/web/src/features/create/types.ts` and `contracts.ts` (browser model + draft mapper, transform)

**Analog:** [types.ts](/Users/muhammadzaid/Desktop/Projects/moveprompts/apps/web/src/features/create/types.ts:20) and [contracts.ts](/Users/muhammadzaid/Desktop/Projects/moveprompts/apps/web/src/features/create/contracts.ts:28).

**Project/draft mapping pattern** (contracts.ts lines 99-138):

```ts
export function projectToCreationDraft(project: CreatorProject, rightsConfirmed: boolean, status: DraftStatus = "editing"): CreationDraft {
  return {
    id: project.id,
    mode: "template",
    templateVersionId: project.templateId,
    product: project.product,
    assetKeys: project.product.images.flatMap((image) => image.assetKey ? [image.assetKey] : []),
    campaign: { market: project.market, language: project.language, goal: project.goal, presenterMode: project.presenterMode /* ... */ },
  };
}
```

**Apply:** Add normalized source facts/provenance once to `CreatorProject` and mirror them exactly through `CreationDraft` and `projectToCreationDraft`. Keep legacy `CreatorProduct` as a compatibility view only until all old callers migrate. The claim/version/generation configuration must derive from the normalized record, not a separately hand-built final-review payload.

### `apps/web/src/features/create/sourceFacts.ts` (new utility, transform)

**Analog:** deterministic snapshotting in [guestClaimSnapshot.ts](/Users/muhammadzaid/Desktop/Projects/moveprompts/apps/web/src/features/create/guestClaimSnapshot.ts:8) and immutable local draft persistence in [guestDraftStore.ts](/Users/muhammadzaid/Desktop/Projects/moveprompts/apps/web/src/features/create/guestDraftStore.ts:230).

**Deterministic transform pattern** (guestClaimSnapshot.ts lines 8-35):

```ts
function canonicalJson(value: unknown): string { /* sorted objects, stable arrays */ }

export async function buildGuestClaimSnapshot(input: GuestClaimSnapshotInput): Promise<GuestClaimSnapshot> {
  return { ...input, snapshotDigest: await sha256(canonicalJson(input)) };
}
```

**Apply:** Implement pure helpers such as `applyImportedFacts`, `editFact`, `confirmCampaignFacts`, `factsForReview`, and `requiredFactsForGoal`. Never mutate fact arrays in place. Preserve the invariant: imported -> manually added on edit; imported campaign-used facts -> user confirmed on explicit confirmation; non-campaign/missing fields remain unchanged. Keep strings and source asset IDs only—no blob URL or signed URL in normalized facts.

### `apps/web/src/features/create/templateRecommendations.ts` (new utility, transform)

**Analog:** [TemplateGrid.tsx](/Users/muhammadzaid/Desktop/Projects/moveprompts/apps/web/src/features/create/TemplateGrid.tsx:49) and the recipe surface in [catalog.ts](/Users/muhammadzaid/Desktop/Projects/moveprompts/packages/creative-engine/src/catalog.ts:274).

**Current deterministic catalog selection style** (TemplateGrid.tsx lines 49-70):

```ts
const filteredTemplates = templates.filter((template) => {
  const matchesVertical = vertical === "all" || template.verticals.includes(vertical);
  return matchesVertical && (!normalizedQuery || haystack.includes(normalizedQuery));
});
const orderedTemplates = selectedTemplate
  ? [selectedTemplate, ...readyPreviews, ...campaignDirections]
  : [...readyPreviews, ...campaignDirections];
```

**Apply:** Keep recommendation scoring pure and local: return `{ template, score, reasons, selectable, missingInputs }[]`, with stable tie-break by catalog order/template ID. Score only visible normalized facts: vertical, selected goal, source media, presenter compatibility, language, ratio, and required input availability. The UI shows at most three. Never silently select a non-selectable template or expose provider IDs.

### `SourceChoiceStep.tsx`, `FactReviewStep.tsx`, `OutcomeStep.tsx`, `CampaignSetupStep.tsx`, and `CampaignReviewStep.tsx` (new composed UI components)

**Analog:** `CreateStudio` state/controller at [CreateStudio.tsx](/Users/muhammadzaid/Desktop/Projects/moveprompts/apps/web/src/features/create/CreateStudio.tsx:238), source scan at [CreateStudio.tsx](/Users/muhammadzaid/Desktop/Projects/moveprompts/apps/web/src/features/create/CreateStudio.tsx:687), and final quote/auth handoff around [CreateStudio.tsx](/Users/muhammadzaid/Desktop/Projects/moveprompts/apps/web/src/features/create/CreateStudio.tsx:1059).

**Controller callback pattern to retain:**

```ts
const updateProject = (changes: Partial<CreatorProject>) => {
  setProject((current) => ({ ...current, ...changes, updatedAt: new Date().toISOString() }));
};

const commitProject = (updater: (current: CreatorProject) => CreatorProject) => {
  setProject((current) => ({ ...updater(current), updatedAt: new Date().toISOString() }));
};
```

**Apply:** `CreateStudio` stays as the orchestration boundary: route/handoff reading, guest recovery, source-scan abort state, quote loading/retry, auth dialog, claim/start submission. New step components must be controlled/presentational—receive current normalized draft/project, locale, errors, busy state, and narrow callbacks. Do not create a second source scanner, quote call, project store, or Generate handler.

**Required UI primitives:** Copy visible labels, `aria-pressed`, `role="status"`, and locale branching from [TemplateGrid.tsx](/Users/muhammadzaid/Desktop/Projects/moveprompts/apps/web/src/features/create/TemplateGrid.tsx:97). Use real radio inputs/groups for the new source/outcome/presenter decisions where possible; selected-only color is insufficient.

### `TemplateGrid.tsx` and `TemplatePreviewDialog.tsx` (component, request-response)

**Analog:** existing [TemplateGrid.tsx](/Users/muhammadzaid/Desktop/Projects/moveprompts/apps/web/src/features/create/TemplateGrid.tsx:20) and [TemplatePreviewDialog.tsx](/Users/muhammadzaid/Desktop/Projects/moveprompts/apps/web/src/features/create/TemplatePreviewDialog.tsx:11).

**Preview-truth boundary to retain** (TemplateGrid.tsx lines 286-304):

```tsx
{template.previewVideo ? (
  <button type="button" onClick={() => onPreview(template)} aria-label={`Play ${template.name} preview`}>
    <Play aria-hidden="true" /><span>Play preview</span>
  </button>
) : (
  <Link to={`/templates/${encodeURIComponent(template.id)}`}>
    <ArrowUpRight aria-hidden="true" /><span>View direction</span>
  </Link>
)}
```

**Dialog primitive pattern** (TemplatePreviewDialog.tsx lines 17-59): use existing `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, and visible locale-aware close label.

**Apply:** Add requirement, duration, supported format, presenter compatibility, expected result, and quote state to recommendation/card metadata. Preserve this hard truth gate: only `previewVideo`/verified motion gets a play control; static direction must remain a non-playable direction detail. Development/review templates must be labelled or disabled based on actual availability.

### `apps/web/src/features/create/guestDraftStore.ts` / `guestClaimRecovery.ts` (store/recovery, file-I/O)

**Analog:** [guestDraftStore.ts](/Users/muhammadzaid/Desktop/Projects/moveprompts/apps/web/src/features/create/guestDraftStore.ts:230) and [guestClaimRecovery.ts](/Users/muhammadzaid/Desktop/Projects/moveprompts/apps/web/src/features/create/guestClaimRecovery.ts:42).

**Persistence/error pattern** (guestDraftStore.ts lines 264-288):

```ts
export async function saveGuestDraft(draft: CreationDraft): Promise<CreationDraft> {
  window.dispatchEvent(new CustomEvent(DRAFT_SAVE_EVENT, { detail: { draftId: draft.id, state: "saving" } }));
  try {
    const existing = await storage().getDraft(draft.id);
    const stored = asStoredDraft(draft, existing);
    await storage().putDraft(stored);
    // emit saved
    return stored;
  } catch (error) {
    // emit error, then throw; never convert to a successful save
    throw error;
  }
}
```

**Apply:** Any Phase 3 added source fact, presenter selection/right, outcome, or campaign field must be contained in the same `CreationDraft` snapshot and continue using this store. Preserve 7-day original expiry and ordered local blob manifest. Retry/cancelled-auth/recoverable-scan failures retain the exact saved draft.

### `apps/web/src/lib/api/portableApiClient.ts` and `apps/api/src/creator-routes.ts` (API client/routes, request-response)

**Analogs:** [portableApiClient.ts](/Users/muhammadzaid/Desktop/Projects/moveprompts/apps/web/src/lib/api/portableApiClient.ts:44), [creator-routes.ts](/Users/muhammadzaid/Desktop/Projects/moveprompts/apps/api/src/creator-routes.ts:86), and source route loop [creator-routes.ts](/Users/muhammadzaid/Desktop/Projects/moveprompts/apps/api/src/creator-routes.ts:507).

**Client error-envelope pattern:**

```ts
if (!response.ok) {
  const error = raw && typeof raw === "object" && "error" in raw ? raw.error : null;
  throw new PortableApiError(message, code, retryable, requestId, response.status);
}
return schema.parse(raw);
```

**Route guard/validation pattern:**

```ts
const { url } = SourceScanRequestSchema.parse(await parseJson(context.req.raw));
const quota = await services.rateLimiter.consumePublicScan({ headers: context.req.raw.headers });
if (!quota.allowed) throw new ApiHttpError({ code: "source_scan_rate_limited", status: 429, retryable: true });
const body = await scanSourceWithOneRetry(services.scanner, { url, kind, requestId: context.get("requestId") });
noStore(context);
return context.json(body);
```

**Apply:** Retain `PortableApiError` codes/request IDs into UI recovery copy. If the fact/scanner response needs Phase 3 fields, extend contract -> source scanner -> API client atomically, preserving `SourceScanRequestSchema`, bounded one transient retry, rate limits, public-IP policy, and `private, no-store`. Do not add any browser-side extraction or mirror arbitrary remote URLs.

### `apps/api/src/source-scanner.ts` (service, request-response)

**Analog:** [source-scanner.ts](/Users/muhammadzaid/Desktop/Projects/moveprompts/apps/api/src/source-scanner.ts:229).

**Security/error pattern to retain:**

```ts
try { initialUrl = parsePublicHttpUrl(input.url); } catch {
  throw new ApiHttpError({ code: "invalid_source_url", message: "Enter a complete public website link.", status: 400, retryable: false });
}
// enforce HTML MIME, content-length/stream limit, public-DNS-pinned fetch and redirect revalidation
```

**Apply:** Product and business use the same hardened fetch boundary. Parse additional *display-only imported* facts carefully and always mark them `imported`; business booking/location/WhatsApp remain user-confirmed fields if absent. Never change scanner behavior to trust source-page claims or to pull remote bytes into the guest browser.

### `apps/web/src/features/create/creator.css` (styling, transform)

**Analog:** template, form, cost, and responsive rules at [creator.css](/Users/muhammadzaid/Desktop/Projects/moveprompts/apps/web/src/features/create/creator.css:306), [creator.css](/Users/muhammadzaid/Desktop/Projects/moveprompts/apps/web/src/features/create/creator.css:377), and [creator.css](/Users/muhammadzaid/Desktop/Projects/moveprompts/apps/web/src/features/create/creator.css:916).

**Token/interaction style:**

```css
.creator-template-card.is-selected { border-color: hsl(var(--creator-action)); box-shadow: 0 0 0 3px hsl(var(--creator-action) / 0.12); }
.creator-button { min-height: 46px; /* existing primary/secondary variants */ }
.creator-template-search:focus-within { border-color: hsl(var(--creator-action)); box-shadow: 0 0 0 3px hsl(var(--creator-action) / .12); }
```

**Apply:** Add semantic phase classes under the existing `creator-*` namespace and existing theme variables. Use logical CSS properties (`margin-inline`, `text-align: start`, `inset-inline`) and extend mobile at the existing `800px`/`520px` breakpoints. Preserve `prefers-reduced-motion` blocks; no new global CSS or hard-coded parallel palette.

### Tests (unit/component/API)

**Component-test analog:** [TemplateGrid.test.tsx](/Users/muhammadzaid/Desktop/Projects/moveprompts/apps/web/src/features/create/TemplateGrid.test.tsx:1).

```ts
const view = render(<MemoryRouter><TemplateGrid onSelect={vi.fn()} /></MemoryRouter>);
expect(screen.getByRole("region", { name: "Ready previews" })).toBeVisible();
fireEvent.click(screen.getAllByRole("button", { name: /Play .* preview/ })[0]!);
expect(screen.getByRole("dialog").querySelector("video")).toHaveAttribute("controls");
view.unmount();
```

**Draft retention test analog:** [guestDraftStore.test.ts](/Users/muhammadzaid/Desktop/Projects/moveprompts/apps/web/src/features/create/guestDraftStore.test.ts:10) injects memory storage/clock and asserts exact restored JSON + blob keys.

**Contract journey test analog:** [creatorContracts.test.ts](/Users/muhammadzaid/Desktop/Projects/moveprompts/apps/web/src/features/create/__tests__/creatorContracts.test.ts:1) creates an actual template draft and asserts all settings survive `projectToCreationDraft`.

**API/security test analog:** [source-scanner.test.ts](/Users/muhammadzaid/Desktop/Projects/moveprompts/apps/api/src/source-scanner.test.ts:1) injects `fetch`/`resolveHost`; [creator-routes.test.ts](/Users/muhammadzaid/Desktop/Projects/moveprompts/apps/api/src/creator-routes.test.ts:1) uses `createApi` with typed stubs.

**Apply:** Add focused tests for (1) product + service source normalization and every provenance transition, (2) all nine outcomes -> deterministic max-three recommendations/one recovery, (3) static vs verified preview affordances, (4) presenter restrictions, (5) draft round trip after edit/quote/auth cancellation, (6) scan errors preserve local state, and (7) product/business source route contract. Use real roles/accessible names in component tests—do not assert only CSS classes.

## Shared Patterns

### Validation and public boundary

**Sources:** [creator.ts](/Users/muhammadzaid/Desktop/Projects/moveprompts/packages/contracts/src/creator.ts:295), [creator-routes.ts](/Users/muhammadzaid/Desktop/Projects/moveprompts/apps/api/src/creator-routes.ts:99), [portableApiClient.ts](/Users/muhammadzaid/Desktop/Projects/moveprompts/apps/web/src/lib/api/portableApiClient.ts:44).

- Zod validates request/query/response at each boundary.
- Browser consumes only parsed response objects; it sees safe `code`, `message`, `retryable`, and `requestId` on API failure.
- Public source scans do not require auth but remain rate limited and `no-store`; cloud project mutations require session + owner scope + idempotency.

### Draft, assets, and ownership

**Sources:** [contracts.ts](/Users/muhammadzaid/Desktop/Projects/moveprompts/apps/web/src/features/create/contracts.ts:56), [guestDraftStore.ts](/Users/muhammadzaid/Desktop/Projects/moveprompts/apps/web/src/features/create/guestDraftStore.ts:264), [guestClaimRecovery.ts](/Users/muhammadzaid/Desktop/Projects/moveprompts/apps/web/src/features/create/guestClaimRecovery.ts:121).

- Guest facts and blobs are IndexedDB-only until exact claim receipt checks pass.
- Persist asset keys/IDs and facts, never signed URLs or blob URLs into cloud/version payloads.
- Claim deletion is only after exact configuration + ordered manifest verification; Phase 3 must not shortcut that rule.

### Template preview truth

**Sources:** [templateMedia.ts](/Users/muhammadzaid/Desktop/Projects/moveprompts/apps/web/src/features/create/templateMedia.ts:72), [TemplateGrid.tsx](/Users/muhammadzaid/Desktop/Projects/moveprompts/apps/web/src/features/create/TemplateGrid.tsx:286).

- `previewVideo` is the sole gate for a Play affordance.
- Poster/static direction art remains visibly and verbally non-video; no fake progress bars or demo output substitution.

### UI accessibility and responsive behavior

**Sources:** [CreatorProgress.tsx](/Users/muhammadzaid/Desktop/Projects/moveprompts/apps/web/src/features/create/CreatorProgress.tsx:19), [TemplateGrid.tsx](/Users/muhammadzaid/Desktop/Projects/moveprompts/apps/web/src/features/create/TemplateGrid.tsx:114), [creator.css](/Users/muhammadzaid/Desktop/Projects/moveprompts/apps/web/src/features/create/creator.css:916).

- Existing controls provide `aria-pressed`, `aria-live`, labels, and mobile primary-action layout. Extend them with native radios/fieldsets and per-field linked errors.
- Maintain locale behavior through `useLanguage`, logical CSS, and existing reduced-motion query rather than parallel Arabic components.

## No Analog Found

| File/Concern | Role | Data Flow | Planning guidance |
|---|---|---|---|
| `sourceFacts.ts` fact state machine | utility | transform | No dedicated provenance state machine exists; build as small pure helpers with contract tests, modeled on canonical claim snapshot determinism. |
| `templateRecommendations.ts` scored recommendations | utility | transform | No ranking utility exists; keep algorithm deterministic/tested and separate from JSX. |
| Step component extraction | component | CRUD/request-response | Current behavior is inside 1,609-line `CreateStudio`; extract controlled components instead of copying the monolith. |
| Full 9-goal human translation catalog | localization | transform | Current contracts have six goals. Add shared semantic keys/translation records only after contract expansion; do not leave English fallbacks in Arabic UI. |

## Metadata

**Analog search scope:** `apps/web/src/features/create`, `apps/web/src/lib/api`, `apps/api/src`, `packages/contracts/src`, `packages/creative-engine/src`  
**Files scanned:** 27 source/test files  
**Pattern extraction date:** 2026-08-20
