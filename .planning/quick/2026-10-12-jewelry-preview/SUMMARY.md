# Jewelry 8-second preview result

## Delivered

- One authorized Seedance 2.5 image-to-video call through the existing Vercel configuration; retries disabled. The observed credit balance decreased by USD 1.85859. No other paid requests were made.
- Source: `docs/template-demos/posters/v1/jewelry-product-showcase.png`, SHA-256 `28be6ce118ee77bbb2a30e5a07acb4386089ca09a3e75a8bc9f0fed933876310`.
- Compiled the current `jewelry-product-showcase-v2-8s` recipe with one subject photo and audio explicitly off.
- Raw generation completed in 157.3 seconds, 720×1280 H.264, 8.041667 seconds, with no audio stream. Visual review found a duplicate bracelet and rearranged jewelry in its closing scene, so that ending was rejected.
- Published preview: generated detail opening (0–4 seconds), then a deterministic original-photo hero (4–8 seconds) with a gentle approach and stable closing hold. Exactly 8.000000 seconds, 720×1280, no audio. No cloth, people, extra pieces or text in the full-set close. This is a finished preview, not evidence that every raw generation preserves all product details.
- Video: `docs/template-demos/videos/v2/jewelry-product-showcase.mp4`; R2 key `templates/v2/jewelry-product-showcase.mp4`; SHA-256 `9efdae9c28c8f78cd7990c832df76369883b63f591aec03cf7d0efcc912d83e8`; 2,129,656 bytes. Uploaded and read-back verified. The existing v1 PNG poster is retained.
- The website explicitly explains the photo-locked ending in English/Arabic and associates the video with recipe v2 and 8 seconds only. Existing twelve preview paths and all 15/20-second recipes remain unchanged. Already-published poster-only recipe versions gain the verified preview in read projection without rewriting immutable database records.

## Verification

- Workspace tests: 801 passed, 49 gated/environment-dependent tests skipped. Includes preview allowlisting, exact revision mapping, old-poster-only projection without mutation, and all jewelry durations/photo constraints.
- Workspace type checks and builds passed; lint has zero errors and 20 existing Fast Refresh warnings. Production web build retains its existing chunk-size warning.
- Real R2-backed API handler returned HTTP 200 / video/mp4 and the exact published checksum, without starting the API runtime or accessing MongoDB.
- Rendered fixture checks: 16 cases at 375/768/1024/1440 pixels, English/Arabic, light/dark. Preview video plays, duration 8, dimensions 720×1280, muted. Selection, one-photo replacement and all three durations remain functional. No horizontal overflow or page errors. These browser checks use a fixture catalog and the actual finished MP4, not a live authenticated campaign.
- Contact sheets and mobile/desktop preview screenshots inspected. Raw media and provider diagnostics remain in ignored private artifacts; no signed URLs or credentials enter tracked metadata.

## Boundaries

No database mutations, environment changes, Git commit/push or deployment. R2 media exists; matching web/API code must be deployed before the live website can show this new preview. No extra paid retry or wider production quality guarantee.
