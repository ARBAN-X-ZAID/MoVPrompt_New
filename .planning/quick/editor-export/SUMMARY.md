# Editor export and alignment fixed

## Result

The Radix export portal now carries `.creator-app` theme variables, an opaque light/dark panel, its own side-drawer entrance/exit animation, and a lighter blurred backdrop. It fits the available mobile width including scrollbar space, supports reduced motion, and reserves space for the localized close button in English and Arabic.

Aligned the scene duration icons, scene reorder buttons, editing tabs, change-request label/textarea/action spacing, toolbar actions, and a compact brand-color swatch with a readable hex value. Scene duration buttons disable at their bounds. Mobile toolbar actions align on full-width rows.

Extracted the export dialog to give downloads visible pending/error feedback and prevent duplicate actions. Selecting another ratio does not automatically generate or download a different video. Guest download now closes export and renders the sign-in gate inside the editor; the project remains saved.

## Download issues found in browser verification

The original R2 cross-origin blob fetch failed: a read-only signed range request returned HTTP 206 and an attachment response, but no `Access-Control-Allow-Origin`. Browser navigation to attachment URLs was also blocked in the running Brave browser. No security setting or bucket permission was changed.

Added an account-only output/file API route sharing the existing output ownership and readiness checks. It retrieves the signed private object server-side, streams an attachment, disables caching, and returns a clear retryable error on R2 retrieval failure. The web downloads a blob fetched from the API, keeping R2 access server-side and leaving the preview URL unchanged.

## Evidence

- Export interaction tests were written before the new component; private file route tests failed before the endpoint was added; API-blob download tests failed before the final download helper was implemented.
- Web: 227 passed. API: 144 passed, 8 optional MongoDB integration tests skipped. Web/API typechecks and web production build pass.
- ESLint for changed TypeScript/TSX files and `git diff --check` pass. Reviewed the React component against the React best-practices checklist.
- API tests cover owner delivery, guest denial, unauthenticated denial, missing owned media, and R2 retrieval errors. Web tests cover pending feedback, duplicate prevention, retryable errors, explicit alternate-format action, Arabic labels, API credentials, and rejecting error responses as videos.
- Browser downloaded the existing video to `/Users/arbaanq/Downloads/gsmarena_013-9x16.mp4`: H.264, 480 × 864, 8.041667 seconds, 1,535,063 bytes. Download SHA-256 matches the private R2 object's stored SHA-256; byte lengths also match.
- Export layout inspected in English/Arabic and light/dark at 375, 768, 1024, and 1440 pixels. No document horizontal overflow; opaque panel within viewport. Mobile brand swatch, equal toolbar actions, and inspector spacing inspected visually.
- No new generation, payment, push, deployment, public storage permission change, or deletion of existing media occurred.

## Limits

No alternate-format generation was submitted during this fix. Guest download access is covered by automated ownership tests; a separate new guest generation/login journey was not executed. Production AI review and other previously outstanding platform acceptance checks are unchanged. The build retains an existing large-chunk advisory.
