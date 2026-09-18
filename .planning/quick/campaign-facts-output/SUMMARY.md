# Campaign facts and availability delivery

Implemented locally under the previously approved GSD bypass. No commit, push,
deployment, new paid generation, credential changes or existing media rewrites.

## Findings and changes

- The live draft `9ae16303-3d23-43e3-9b0a-0342004addf1` selected Get bookings with
  an empty booking link. The strict template payload correctly rejected the
  incomplete settings, but the quote hook discarded the server message and
  displayed a generic service outage. Quotes now wait for valid required/contact
  fields; setup guidance identifies the missing booking link. Other setup errors
  retain the sanitized API message, support ID and retry controls. Expired local
  sessions also expose a refresh control. Backend submission validation remains.
- Removed Not added badges and repeated Optional — not added helper copy from
  empty fact fields. Required name, booking, WhatsApp and offer fields depend on
  campaign outcome and use red asterisks with aria-required. Description remains
  optional. A single legend explains optional fields. Required or supplied facts
  remain visible even when a product image is used in a booking template.
- Filled optional contact values remain editable in campaign setup and visible
  in final review. Supplied optional destinations are validated; blanks remain
  allowed when the outcome does not require them.
- Booking links were missing from the creative brief, and the prompt reserved
  deterministic text layers without a worker implementation that displayed the
  offer/contact fields. The brief now carries the booking link with consistency
  checks. All five template prompts reserve space and preserve supplied offer,
  WhatsApp and booking facts without inventing missing values.
- Finishing rasterizes exact English/Arabic text into a closing card for the
  final four seconds, before persisting the clean R2 master and generating its
  watermarked preview. Blank optional fields create no placeholders. Historical
  booking contexts remain supported. Unreadably long text fails explicitly
  instead of silently truncating a destination. Existing generated videos retain
  their original contents.
- Visual inspection caught missing Arabic glyphs in the default Canvas font.
  Explicit Arial/DejaVu font registration fixed the rendered text; the worker
  verifies font availability before advertising generation readiness. Linux
  worker Docker dependencies already include DejaVu Sans.

## Verification

- Web: 257 tests passed across 66 files. Subsequent one-line use of the already
  tested quote retryable state was checked with the targeted status tests, build,
  typecheck and lint.
- Worker: all 82 tests passed across 18 files with MOVPROMPT_TEST_FFMPEG=true,
  including actual H.264/AAC normalization, closing-frame changes, preserved
  duration/audio, clean-master/preview ordering and omitted empty facts.
- API: 146 tests passed; 25 optional integration tests skipped (their environment
  gates were not enabled). Contracts: 13 passed. Creative engine: 30 passed,
  including supplied facts in each of the five templates.
- Web typecheck/build, worker typecheck/build, shared-package builds, targeted
  ESLint and diff whitespace checks passed. Existing web chunk-size warning
  remains.
- Read-only health and feature flags confirmed MongoDB, private R2 and generation
  runtime ready after the worker's development reload. A valid salon campaign
  received HTTP 200 with estimateOnly=true from the local generation-quotes API;
  no render job or paid provider operation was submitted by this verification.
- Manual QA entered a booking link, WhatsApp number and offer, continued through
  setup and final review, and confirmed their exact values remained visible.
  Required markers were red, empty-state chatter absent, inputs contained and
  no horizontal overflow at 375, 768, 1024 and 1440 pixels in English/Arabic and
  light/dark. Temporary overrides were reset and the isolated QA tab closed.
- Local eight-second finishing fixture was rendered, decoded and visually
  inspected: Arabic CTA/offer plus exact WhatsApp and booking link are readable.
  Fixture media lives only in /tmp, not user projects or R2.

A fresh funded Gateway-to-R2 generation/download with these new text layers has
not been performed; no new paid test was requested in this task.
