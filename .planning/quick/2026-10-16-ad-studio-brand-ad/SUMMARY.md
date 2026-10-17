# Ad Studio brand ad form — summary

## Outcome

`/ad-studio`, `/ad-studio/ad-studio-brand-ad` and `/ads` open one brand ad form (`ad-studio-brand-ad`).
Old `/ad-studio/<template>` links go to `/templates/<template>`.

- Brand card: brand name (60), website (optional, 200, validated), logo (optional), product photos (1–3),
  selling points (300), aesthetics (300), audience (200), description (600), socials (optional, 200).
- Your video: idea (2000), length 8/15/20, shape 9:16/1:1/4:5/16:9, resolution 480p/720p (default 720p),
  language ar/en/bilingual, voice and music toggle (default on).
- Every field has a placeholder, a one-line hint and a counter in English and Arabic. No fonts, no idea picker.
- Generate stays unavailable until every required field and a product photo are valid; pressing it lists what is missing.
- Guests: Generate saves the draft and photos to IndexedDB and opens the sign-in dialog ("Sign in to generate your ad").
  Sign-in returns to `/create?draft=<id>&resume=ready` with the filled form and "You're signed in. Press Generate to start."
  Nothing generates automatically. The API also refuses guest generation for this template.
- Logo, brand name, website and socials are drawn on the ending card by FFmpeg; Seedance never receives the logo.

## Evidence

- Tests: contracts 16, creative-engine 193, providers 43, db 9, API 201, worker 114 (13 more with FFmpeg), web 353.
- Two web failures in `productModelAd.test.tsx` predate this work (the removed "Closing action" field).
- Screenshots: `output/ad-studio-brand-ad/` at 375, 768, 1024 and 1440 in English/Arabic and light/dark; no horizontal overflow.

## Not done (needs approval)

- The template is not published to the live catalog. Until it is, the live form reports that template settings are unavailable.
- No paid generation was run.
