# Phase 2 Context: Guest, Authentication, and Data Integrity

## Outcome

Let a Kuwait business owner finish a complete campaign before creating an account, authenticate only at Generate, and recover the exact campaign and private media without duplication or cross-user exposure.

## UX Brief

- **Primary user:** A business owner with no video-editing or account-system knowledge.
- **User goal:** Configure once, sign in once, and continue from the exact same campaign.
- **Business goal:** Reduce Generate-time abandonment while protecting private customer media and preventing duplicate projects or charges.
- **Main job:** Preserve the campaign across authentication and turn the local guest draft into one owned cloud project.
- **Main anxiety:** “Will signing in erase my work or upload my images to the wrong account?”
- **Desired action:** Select Generate, authenticate, confirm the recovered campaign, then submit once.
- **Success metric:** At least 99.5% exact draft recovery and zero duplicate claim/run/charge or cross-user access in the release suite.

## Locked Decisions

- Template Mode remains the default; Advanced uses the same draft/auth/claim foundation without adding a second ownership model.
- Guests can configure the complete campaign before authentication. Account creation appears only after Generate.
- Guest draft JSON and blobs stay in IndexedDB for seven days and recover only in the same browser.
- Guests do not receive cloud projects, anonymous Supabase accounts, or cloud uploads from page visits.
- Email/password is the private-beta primary path. Email verification does not interrupt the first campaign; the authenticated workspace shows a reminder to verify later.
- Google and Apple appear only when configured and must return through the same safe callback/claim contract.
- Authentication cancellation returns to the unchanged draft. Password reset returns only to a validated same-origin MovPrompt route.
- Resume priority is: stable pending generation intent, explicit safe same-origin next route, then `/create`.
- A stable `pendingGenerationId` and idempotency key bind claim, project/version creation, quote refresh, and eventual start. Callback replay must return the same records.
- Authentication never silently changes template, source, facts, language, market, CTA, WhatsApp/booking destination, price, offer, presenter, ratio, resolution, audio, subtitles, rights decision, or Advanced references.
- Local blobs are deleted only after project rows, private objects, checksums, and recovered server configuration are verified. Any failure keeps the complete local draft.
- Authenticated PostgreSQL and private S3-compatible storage are authoritative. Browser state becomes a recoverable cache, never the cloud source of truth.
- Signed URLs are response-only and refreshable. Database rows contain bucket/object keys, MIME, size, checksum, and ownership metadata.
- A draft claimed by one account cannot be viewed or claimed by another account on the same browser.
- Source scanning and authenticated mirroring share the same SSRF, redirect, DNS/IP, MIME, size, timeout, checksum, and abuse protections.

## Primary Flow

1. Guest configures a campaign and local media.
2. Generate validates campaign, rights, and local draft integrity.
3. The contextual auth dialog explains that the campaign is saved locally.
4. Email or configured social authentication completes.
5. Callback validates the return intent and loads the exact IndexedDB draft.
6. Server claims or mirrors assets into the authenticated user's private project namespace.
7. Server creates one immutable project version and returns canonical object metadata.
8. Browser verifies the recovered server configuration and object checksums.
9. Quote refreshes against that immutable version; changed price requires confirmation.
10. Pending generation submits once and routes to durable project progress.

## Secondary and Recovery Flows

- Cancel auth → unchanged creator and local media.
- Session already exists → skip auth UI and claim once.
- Duplicate callback/tab → same project/version/pending generation.
- Upload/mirror/claim failure → local draft remains; retry resumes from the failed asset without creating an empty project.
- Expired signed URL → request a new authorized URL from the stable object key.
- Wrong account signs in → do not expose or claim another account's previously claimed draft; require explicit safe account handling.
- Password reset → preserve safe return intent without trusting arbitrary external URLs.
- Offline/network interruption → keep draft, explain what failed, and provide Retry.

## Information Architecture and Screen Jobs

- **Create review:** Confirm the complete campaign and choose Generate.
- **Generate-time auth dialog:** Authenticate without leaving or re-entering campaign details.
- **Auth page/callback:** Complete the chosen credential flow and return safely; no onboarding detour.
- **Claim progress state:** Explain “Securing your campaign” with a cancellable/retryable saved state, not a fake render state.
- **Workspace reminder:** Non-blocking email-verification reminder after the first campaign path remains available.
- **Projects:** Show the one owned claimed project and durable generation state.

## Interaction States and Microcopy Contract

- Draft saved: “Your campaign is saved in this browser.”
- Auth cancelled: “Nothing changed. Continue editing when you’re ready.”
- Claiming: “Securing your campaign…”
- Upload failure: “We couldn’t secure this image. Your campaign is still saved here.” Actions: Retry / Replace image.
- Session mismatch: “This campaign belongs to a different signed-in account.” Do not reveal the other account.
- Expired draft: “This browser draft expired after 7 days.” Action: Start a new campaign.
- Callback replay: no duplicate success toast or second project; route to the existing project.
- Verification reminder: “Verify your email to protect your account.” It must not block the first private-beta campaign.

## Visual and Design-System Contract

- Reuse the existing creator/auth composition, typography, spacing, surfaces, amber action accent, semantic status colors, theme tokens, and RTL system.
- One dominant action per state. Do not add a new onboarding dashboard, generic card grid, or provider terminology.
- Auth and claim transitions use restrained opacity/position feedback and respect reduced motion.
- Every form retains visible labels, field errors, preserved input, 44 by 44 pixel targets, keyboard focus, modal focus trapping, and screen-reader announcements.
- Verify 375, 768, 1024, and 1440 pixels in English/Arabic and light/dark.

## Security and Data Boundaries

- Every authenticated mutation uses the session user, owner predicates, and restricted `withUserTransaction` database access.
- Idempotency keys are user- and intent-scoped; a key cannot be replayed across accounts or projects.
- Draft claim tokens/IDs are opaque, expiring, single-owner, and never contain signed URLs or secrets.
- Asset keys must match the canonical `userId/projectId/assetId` namespace and the exact database ownership row before read, quote, or generation.
- OAuth `next` values allow only validated same-origin application paths.
- Logs and public errors exclude passwords, tokens, provider IDs, signed URLs, raw remote URLs, and other users' identifiers.

## Deferred

- Cross-device guest drafts.
- Mandatory verification before the first private-beta campaign.
- Team/shared project claims.
- Production billing/top-up and subscription gates.
- Digital Twin enrollment and third-party consent.
